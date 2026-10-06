const STATUS_FLOW = [
  ["RECEIVED", "Received"],
  ["CONFIRMED", "Confirmed"],
  ["PREPARING", "Preparing"],
  ["READY", "Ready"],
  ["OUT_FOR_DELIVERY", "Out for Delivery"],
  ["COMPLETED", "Completed"],
];

const STATUS_MESSAGES = {
  RECEIVED: "The store received your order and will review the details.",
  CONFIRMED: "Your order was confirmed by the store.",
  PREPARING: "Your order is currently being prepared.",
  READY: "Your order is ready for the next delivery or pickup step.",
  OUT_FOR_DELIVERY: "Your order is on the way.",
  COMPLETED: "Your order has been completed. Thank you for shopping with us!",
  CANCELLED: "This order has been cancelled.",
};

const formEl = document.getElementById("trackForm");
const referenceInputEl = document.getElementById("referenceInput");
const mobileInputEl = document.getElementById("mobileInput");
const trackButtonEl = document.getElementById("trackButton");
const resultPanelEl = document.getElementById("resultPanel");
const notFoundPanelEl = document.getElementById("notFoundPanel");
const errorPanelEl = document.getElementById("errorPanel");
const errorMessageEl = document.getElementById("errorMessage");
const refreshButtonEl = document.getElementById("refreshButton");
const toastEl = document.getElementById("toast");

let lastLookup = null;
let refreshTimer = null;

function getEndpoint() {
  const url = String(window.RM_STORE_CONFIG?.orderEndpoint || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url) ? url : "";
}

function showToast(message, duration = 2600) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(window.rmTrackToast);
  window.rmTrackToast = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function peso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function displayDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelForStatus(status) {
  if (status === "CANCELLED") return "Cancelled";
  return STATUS_FLOW.find(([value]) => value === status)?.[1] || "Received";
}

function statusClass(status) {
  return `status-${String(status || "received").toLowerCase().replaceAll("_", "-")}`;
}

function shipmentLabel(status) {
  const labels = {
    PENDING_BOOKING: "Pending Booking",
    BOOKED: "Booked",
    PICKED_UP: "Picked Up",
    IN_TRANSIT: "In Transit",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    RETURNED: "Returned",
    CANCELLED: "Cancelled",
  };
  return labels[String(status || "")] || "Not booked";
}

function paymentStatusLabel(status) {
  const labels = {
    UNPAID: "Unpaid",
    PENDING_VERIFICATION: "Pending Verification",
    PAID: "Paid",
    REFUNDED: "Refunded",
  };
  return labels[String(status || "")] || "Not set";
}

function jsonp(action, params = {}, timeoutMs = 10000) {
  const endpoint = getEndpoint();
  if (!endpoint) return Promise.reject(new Error("Order tracking is not configured yet."));

  return new Promise((resolve, reject) => {
    const callbackName = `rmTrackCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let done = false;
    let timer = null;

    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data || {});
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not reach the order receiver."));
    };

    const query = new URLSearchParams({
      action,
      ...params,
      callback: callbackName,
      _: Date.now().toString(),
    });

    script.src = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query.toString()}`;
    document.head.appendChild(script);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("The order receiver timed out."));
    }, timeoutMs);
  });
}

function setLoading(loading) {
  trackButtonEl.disabled = loading;
  refreshButtonEl.disabled = loading;
  trackButtonEl.querySelector("span").textContent = loading ? "Checking…" : "Track My Order";
}

function hideStates() {
  resultPanelEl.hidden = true;
  notFoundPanelEl.hidden = true;
  errorPanelEl.hidden = true;
}

function renderProgress(status) {
  const container = document.getElementById("progressSteps");
  const currentIndex = STATUS_FLOW.findIndex(([value]) => value === status);
  const effectiveIndex = status === "COMPLETED" ? STATUS_FLOW.length - 1 : Math.max(0, currentIndex);

  container.innerHTML = STATUS_FLOW.map(([value, label], index) => {
    const done = status !== "CANCELLED" && index <= effectiveIndex;
    const current = status !== "CANCELLED" && index === effectiveIndex;
    return `
      <div class="progress-step ${done ? "done" : ""} ${current ? "current" : ""}">
        <div class="progress-dot">${done ? "✓" : index + 1}</div>
        <span>${label}</span>
      </div>
    `;
  }).join("");
}

function renderOrder(order) {
  document.getElementById("resultReference").textContent = order.reference || "—";
  document.getElementById("resultCustomer").textContent = order.customerName || "Customer";

  const badge = document.getElementById("statusBadge");
  badge.className = `status-badge ${statusClass(order.status)}`;
  badge.textContent = labelForStatus(order.status);

  const cancelled = order.status === "CANCELLED";
  document.getElementById("cancelledNotice").hidden = !cancelled;
  document.getElementById("progressWrap").hidden = cancelled;
  if (!cancelled) renderProgress(order.status);

  document.getElementById("latestUpdate").textContent = displayDate(order.statusUpdatedAt || order.receivedAt);
  document.getElementById("statusMessage").textContent = STATUS_MESSAGES[order.status] || STATUS_MESSAGES.RECEIVED;
  document.getElementById("itemsValue").textContent = order.items || "—";
  document.getElementById("subtotalValue").textContent = peso(order.subtotal);
  document.getElementById("deliveryFeeValue").textContent = order.deliveryFee == null ? "To be confirmed" : peso(order.deliveryFee);
  document.getElementById("paymentValue").textContent = order.paymentMethod || "To be confirmed";

  const shippingInfo = document.getElementById("shippingInfo");
  const hasShippingInfo = Boolean(order.courier || order.trackingNumber || order.shipmentStatus || order.paymentStatus);
  shippingInfo.hidden = !hasShippingInfo;
  document.getElementById("courierValue").textContent = order.courier || "Not assigned";
  document.getElementById("trackingValue").textContent = order.trackingNumber || "Not assigned";
  document.getElementById("shipmentValue").textContent = shipmentLabel(order.shipmentStatus);
  document.getElementById("paymentStatusValue").textContent = paymentStatusLabel(order.paymentStatus);

  document.getElementById("totalValue").textContent = peso(order.estimatedTotal || order.subtotal);
  document.getElementById("preorderBadge").hidden = !order.preorderAccepted;

  resultPanelEl.hidden = false;
  notFoundPanelEl.hidden = true;
  errorPanelEl.hidden = true;
}

async function lookup(reference, mobile, { quiet = false } = {}) {
  const cleanReference = String(reference || "").trim().toUpperCase();
  const cleanMobile = String(mobile || "").trim();

  if (!cleanReference || !cleanMobile) {
    showToast("Enter your order reference and mobile number");
    return;
  }

  hideStates();
  setLoading(true);

  try {
    const result = await jsonp("trackOrder", {
      reference: cleanReference,
      mobile: cleanMobile,
    });

    if (!result.ok) throw new Error(result.error || "Tracking request failed.");

    lastLookup = { reference: cleanReference, mobile: cleanMobile };
    sessionStorage.setItem("rmTrackLastRef", cleanReference);

    if (!result.found || !result.order) {
      resultPanelEl.hidden = true;
      notFoundPanelEl.hidden = false;
      if (!quiet) showToast("No matching order found");
      return;
    }

    renderOrder(result.order);
    if (!quiet) showToast("Order status updated");
  } catch (error) {
    errorMessageEl.textContent = error?.message || "We couldn't reach the order receiver. Please try again in a moment.";
    errorPanelEl.hidden = false;
  } finally {
    setLoading(false);
  }
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  lookup(referenceInputEl.value, mobileInputEl.value);
});

refreshButtonEl.addEventListener("click", () => {
  if (!lastLookup) return;
  lookup(lastLookup.reference, lastLookup.mobile);
});

referenceInputEl.addEventListener("input", () => {
  referenceInputEl.value = referenceInputEl.value.toUpperCase();
});

const rememberedRef = sessionStorage.getItem("rmTrackLastRef");
if (rememberedRef) referenceInputEl.value = rememberedRef;

refreshTimer = setInterval(() => {
  if (lastLookup && !document.hidden) lookup(lastLookup.reference, lastLookup.mobile, { quiet: true });
}, 60000);

window.addEventListener("beforeunload", () => clearInterval(refreshTimer));
