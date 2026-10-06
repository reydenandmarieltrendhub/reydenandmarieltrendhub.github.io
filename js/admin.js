const ADMIN_KEY_SESSION = "rmAdminKeyV15";
const STATUSES = [
  ["RECEIVED", "Received"],
  ["CONFIRMED", "Confirmed"],
  ["PREPARING", "Preparing"],
  ["READY", "Ready"],
  ["OUT_FOR_DELIVERY", "Out for Delivery"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];

const SHIPMENT_STATUSES = [
  ["", "Not set"],
  ["PENDING_BOOKING", "Pending Booking"],
  ["BOOKED", "Booked"],
  ["PICKED_UP", "Picked Up"],
  ["IN_TRANSIT", "In Transit"],
  ["OUT_FOR_DELIVERY", "Out for Delivery"],
  ["DELIVERED", "Delivered"],
  ["RETURNED", "Returned"],
  ["CANCELLED", "Cancelled"],
];

const PAYMENT_STATUSES = [
  ["UNPAID", "Unpaid"],
  ["PENDING_VERIFICATION", "Pending Verification"],
  ["PAID", "Paid"],
  ["REFUNDED", "Refunded"],
];

const loginPanelEl = document.getElementById("loginPanel");
const dashboardEl = document.getElementById("dashboard");
const loginFormEl = document.getElementById("loginForm");
const adminKeyEl = document.getElementById("adminKey");
const loginButtonEl = document.getElementById("loginButton");
const toggleKeyButtonEl = document.getElementById("toggleKeyButton");
const logoutButtonEl = document.getElementById("logoutButton");
const setupNoticeEl = document.getElementById("setupNotice");
const refreshButtonEl = document.getElementById("refreshButton");
const searchInputEl = document.getElementById("searchInput");
const statusFilterEl = document.getElementById("statusFilter");
const ordersListEl = document.getElementById("ordersList");
const loadingStateEl = document.getElementById("loadingState");
const emptyStateEl = document.getElementById("emptyState");
const resultSummaryEl = document.getElementById("resultSummary");
const dashboardUpdatedEl = document.getElementById("dashboardUpdated");
const totalOrdersCountEl = document.getElementById("totalOrdersCount");
const receivedCountEl = document.getElementById("receivedCount");
const preparingCountEl = document.getElementById("preparingCount");
const completedCountEl = document.getElementById("completedCount");
const cancelledCountEl = document.getElementById("cancelledCount");
const totalSalesValueEl = document.getElementById("totalSalesValue");
const toastEl = document.getElementById("toast");

let adminKey = sessionStorage.getItem(ADMIN_KEY_SESSION) || "";
let currentOrders = [];
let searchTimer = null;

function getEndpoint() {
  const url = String(window.RM_STORE_CONFIG?.orderEndpoint || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url) ? url : "";
}

function showToast(message, duration = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(window.rmAdminToast);
  window.rmAdminToast = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status) {
  return STATUSES.find(([value]) => value === status)?.[1] || status || "Received";
}

function statusClass(status) {
  return `status-${String(status || "received").toLowerCase().replaceAll("_", "-")}`;
}

function shipmentLabel(status) {
  return SHIPMENT_STATUSES.find(([value]) => value === String(status || ""))?.[1] || "Not set";
}

function paymentStatusLabel(status) {
  return PAYMENT_STATUSES.find(([value]) => value === String(status || ""))?.[1] || "Not set";
}

function jsonp(action, params = {}, timeoutMs = 10000) {
  const endpoint = getEndpoint();
  if (!endpoint) return Promise.reject(new Error("Order receiver endpoint is not configured."));

  return new Promise((resolve, reject) => {
    const callbackName = `rmAdminCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

async function verifyKey(key) {
  const result = await jsonp("adminCheck", { adminKey: key });
  if (!result.ok || result.authorized !== true) {
    throw new Error(result.error === "ADMIN_NOT_CONFIGURED"
      ? "Admin access is not configured yet. Run setupOrderManager() in Apps Script first."
      : "Incorrect Admin Key.");
  }
}

function setAuthenticated(isAuthenticated) {
  loginPanelEl.hidden = isAuthenticated;
  dashboardEl.hidden = !isAuthenticated;
  logoutButtonEl.hidden = !isAuthenticated;
}

function setLoading(isLoading) {
  loadingStateEl.hidden = !isLoading;
  refreshButtonEl.disabled = isLoading;
  ordersListEl.style.opacity = isLoading ? ".55" : "1";
}

function renderStats(stats = {}) {
  totalOrdersCountEl.textContent = String(Number(stats.totalOrders) || 0);
  receivedCountEl.textContent = String(Number(stats.received) || 0);
  preparingCountEl.textContent = String(Number(stats.preparing) || 0);
  completedCountEl.textContent = String(Number(stats.completed) || 0);
  cancelledCountEl.textContent = String(Number(stats.cancelled) || 0);
  totalSalesValueEl.textContent = peso(stats.totalSales || 0);
  dashboardUpdatedEl.textContent = `Updated ${new Intl.DateTimeFormat("en-PH", { timeStyle: "short" }).format(new Date())}`;
}

async function loadStats() {
  const result = await jsonp("dashboardStats", { adminKey });
  if (!result.ok) {
    if (result.error === "UNAUTHORIZED") throw new Error("Your Admin Key is no longer valid.");
    throw new Error(result.error || "Could not load dashboard totals.");
  }
  renderStats(result.stats || {});
}

async function loadOrders() {
  if (!adminKey) return;
  setLoading(true);
  emptyStateEl.hidden = true;

  try {
    const [ordersResult] = await Promise.all([
      jsonp("listOrders", {
        adminKey,
        limit: "100",
        status: statusFilterEl.value,
        query: searchInputEl.value.trim(),
      }),
      loadStats(),
    ]);

    if (!ordersResult.ok) {
      if (ordersResult.error === "UNAUTHORIZED") throw new Error("Your Admin Key is no longer valid.");
      throw new Error(ordersResult.error || "Could not load orders.");
    }

    currentOrders = Array.isArray(ordersResult.orders) ? ordersResult.orders : [];
    renderOrders();
  } catch (error) {
    showToast(error.message || "Could not load orders", 3600);
    if (/Admin Key|UNAUTHORIZED|not valid/i.test(error.message || "")) lockAdmin();
  } finally {
    setLoading(false);
  }
}

function renderOrders() {
  const statusText = statusFilterEl.value === "ALL" ? "all statuses" : statusLabel(statusFilterEl.value).toLowerCase();
  const query = searchInputEl.value.trim();
  resultSummaryEl.textContent = query
    ? `${currentOrders.length} result${currentOrders.length === 1 ? "" : "s"} for “${query}”`
    : `${currentOrders.length} ${statusText} order${currentOrders.length === 1 ? "" : "s"} loaded`;

  if (!currentOrders.length) {
    ordersListEl.innerHTML = "";
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;
  ordersListEl.innerHTML = currentOrders.map(orderCardHtml).join("");
}

function orderCardHtml(order) {
  const options = STATUSES.map(([value, label]) =>
    `<option value="${value}" ${value === order.status ? "selected" : ""}>${label}</option>`
  ).join("");

  const shipmentOptions = SHIPMENT_STATUSES.map(([value, label]) =>
    `<option value="${value}" ${value === String(order.shipmentStatus || "") ? "selected" : ""}>${label}</option>`
  ).join("");

  const paymentOptions = PAYMENT_STATUSES.map(([value, label]) =>
    `<option value="${value}" ${value === String(order.paymentStatus || "") ? "selected" : ""}>${label}</option>`
  ).join("");

  const deliveryFee = order.deliveryFee == null ? "To be confirmed" : peso(order.deliveryFee);
  const preorder = order.preorderAccepted ? '<span class="preorder-tag">PRE-ORDER</span>' : "";
  const courier = order.courier || (String(order.paymentMethod || "").includes("J&T") ? "J&T Express" : "—");

  return `
    <article class="order-card" data-reference="${escapeHtml(order.reference)}">
      <div class="order-card-head">
        <div class="order-main">
          <span class="eyebrow">ORDER REFERENCE</span>
          <h3 class="order-ref">${escapeHtml(order.reference)}</h3>
          <div class="order-time">Received ${escapeHtml(displayDate(order.receivedAt))}</div>
        </div>
        <span class="status-badge ${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
      </div>

      <div class="order-card-body">
        <div class="customer-line">
          <div>
            <strong>${escapeHtml(order.customerName || "Unnamed customer")}${preorder}</strong>
            <span>${escapeHtml(order.mobileNumber || "No mobile number")}</span>
          </div>
          <div class="price">${escapeHtml(peso(order.estimatedTotal || order.subtotal))}</div>
        </div>

        <button class="details-toggle" type="button" aria-expanded="false">
          <span>View order details</span>
          <span class="chevron" aria-hidden="true">⌄</span>
        </button>

        <div class="order-details" hidden>
          <div class="detail-grid">
            <div class="detail-row"><span>Address</span><strong>${escapeHtml(order.deliveryAddress || "—")}</strong></div>
            <div class="detail-row"><span>Items</span><p>${escapeHtml(order.items || "—")}</p></div>
            <div class="detail-row"><span>Subtotal</span><strong>${escapeHtml(peso(order.subtotal))}</strong></div>
            <div class="detail-row"><span>Delivery fee</span><strong>${escapeHtml(deliveryFee)}</strong></div>
            <div class="detail-row"><span>Payment</span><strong>${escapeHtml(order.paymentMethod || "To be confirmed")}</strong></div>
            <div class="detail-row"><span>Payment status</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></div>
            <div class="detail-row"><span>Courier</span><strong>${escapeHtml(courier)}</strong></div>
            <div class="detail-row"><span>Tracking no.</span><strong>${escapeHtml(order.trackingNumber || "Not assigned")}</strong></div>
            <div class="detail-row"><span>Shipment</span><strong>${escapeHtml(shipmentLabel(order.shipmentStatus))}</strong></div>
            ${order.deliveryNote ? `<div class="detail-row"><span>Customer note</span><p>${escapeHtml(order.deliveryNote)}</p></div>` : ""}
          </div>

          <div class="order-controls fulfillment-controls">
            <label class="edit-field">
              <span>Order status</span>
              <select class="status-select">${options}</select>
            </label>
            <label class="edit-field">
              <span>J&T tracking number</span>
              <input class="tracking-input" type="text" maxlength="120" value="${escapeHtml(order.trackingNumber || "")}" placeholder="Enter AWB / tracking number" />
            </label>
            <label class="edit-field">
              <span>Shipment status</span>
              <select class="shipment-select">${shipmentOptions}</select>
            </label>
            <label class="edit-field">
              <span>Payment status</span>
              <select class="payment-status-select">${paymentOptions}</select>
            </label>
            <label class="edit-field note-field">
              <span>Admin note</span>
              <textarea class="admin-note" rows="2" maxlength="500" placeholder="Optional internal note">${escapeHtml(order.adminNote || "")}</textarea>
            </label>
            <button class="save-button" type="button">Save Update</button>
          </div>
          <div class="updated-line">Last status update: ${escapeHtml(displayDate(order.statusUpdatedAt))}</div>
        </div>
      </div>
    </article>
  `;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrder(reference) {
  const result = await jsonp("getOrder", { adminKey, reference });
  if (!result.ok) throw new Error(result.error || "Could not verify order update.");
  return result.order || null;
}

async function updateOrder(card) {
  const reference = card.dataset.reference;
  const status = card.querySelector(".status-select").value;
  const adminNote = card.querySelector(".admin-note").value.trim();
  const trackingNumber = card.querySelector(".tracking-input").value.trim();
  const shipmentStatus = card.querySelector(".shipment-select").value;
  const paymentStatus = card.querySelector(".payment-status-select").value;
  const button = card.querySelector(".save-button");
  const endpoint = getEndpoint();

  button.disabled = true;
  button.textContent = "Saving…";

  try {
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        action: "updateOrderStatus",
        adminKey,
        reference,
        status,
        adminNote,
        trackingNumber,
        shipmentStatus,
        paymentStatus,
      }),
    });

    let verified = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sleep(450 + attempt * 250);
      const order = await getOrder(reference);
      if (
        order &&
        order.status === status &&
        String(order.adminNote || "") === adminNote &&
        String(order.trackingNumber || "") === trackingNumber &&
        String(order.shipmentStatus || "") === shipmentStatus &&
        String(order.paymentStatus || "") === paymentStatus
      ) {
        verified = true;
        break;
      }
    }

    if (!verified) throw new Error("The update could not be confirmed yet. Try Refresh.");
    showToast(`${reference} updated`);
    await loadOrders();
  } catch (error) {
    showToast(error.message || "Could not update order", 3800);
  } finally {
    button.disabled = false;
    button.textContent = "Save Update";
  }
}

function toggleDetails(button) {
  const details = button.closest(".order-card")?.querySelector(".order-details");
  if (!details) return;
  const opening = details.hidden;
  details.hidden = !opening;
  button.setAttribute("aria-expanded", String(opening));
  button.querySelector("span:first-child").textContent = opening ? "Hide order details" : "View order details";
}

function lockAdmin() {
  sessionStorage.removeItem(ADMIN_KEY_SESSION);
  adminKey = "";
  currentOrders = [];
  ordersListEl.innerHTML = "";
  adminKeyEl.value = "";
  setAuthenticated(false);
}

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = adminKeyEl.value.trim();
  if (!key) return;

  setupNoticeEl.hidden = true;
  loginButtonEl.disabled = true;
  loginButtonEl.textContent = "Checking…";

  try {
    if (!getEndpoint()) throw new Error("js/store-config.js does not contain your Apps Script /exec URL.");
    await verifyKey(key);
    adminKey = key;
    sessionStorage.setItem(ADMIN_KEY_SESSION, key);
    setAuthenticated(true);
    await loadOrders();
  } catch (error) {
    setupNoticeEl.textContent = error.message || "Could not sign in.";
    setupNoticeEl.hidden = false;
  } finally {
    loginButtonEl.disabled = false;
    loginButtonEl.textContent = "Open Order Manager";
  }
});

toggleKeyButtonEl.addEventListener("click", () => {
  const showing = adminKeyEl.type === "text";
  adminKeyEl.type = showing ? "password" : "text";
  toggleKeyButtonEl.textContent = showing ? "Show" : "Hide";
});

logoutButtonEl.addEventListener("click", lockAdmin);
refreshButtonEl.addEventListener("click", loadOrders);
statusFilterEl.addEventListener("change", loadOrders);
searchInputEl.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadOrders, 350);
});

ordersListEl.addEventListener("click", (event) => {
  const detailsButton = event.target.closest(".details-toggle");
  if (detailsButton) {
    toggleDetails(detailsButton);
    return;
  }

  const saveButton = event.target.closest(".save-button");
  if (!saveButton) return;
  const card = saveButton.closest(".order-card");
  if (card) updateOrder(card);
});

(async function boot() {
  if (!getEndpoint()) {
    setupNoticeEl.textContent = "Order receiver not configured. Put your Google Apps Script /exec URL in js/store-config.js first.";
    setupNoticeEl.hidden = false;
    return;
  }

  if (!adminKey) return;

  try {
    await verifyKey(adminKey);
    setAuthenticated(true);
    await loadOrders();
  } catch (_) {
    lockAdmin();
  }
})();
