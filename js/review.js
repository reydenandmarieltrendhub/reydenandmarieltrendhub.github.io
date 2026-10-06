const CART_KEY = "rmCart";
const DRAFT_KEY = "rmCheckoutDraft";
const ORDERS_KEY = "rmOrders";
const LAST_ORDER_KEY = "rmLastOrder";

let cart = readJson(CART_KEY, []);
let draft = readJson(DRAFT_KEY, {});
let currentOrder = null;
let checkoutConfig = null;

const reviewContentEl = document.getElementById("reviewContent");
const missingStateEl = document.getElementById("missingState");
const successStateEl = document.getElementById("successState");
const bottomBarEl = document.getElementById("bottomBar");
const orderItemsEl = document.getElementById("orderItems");
const subtotalValueEl = document.getElementById("subtotalValue");
const totalValueEl = document.getElementById("totalValue");
const stickyTotalEl = document.getElementById("stickyTotal");
const preorderNoticeEl = document.getElementById("preorderNotice");
const toastEl = document.getElementById("toast");
const confirmButtonEl = document.getElementById("confirmButton");
const connectionNoticeEl = document.getElementById("connectionNotice");

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function peso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function go(route) {
  window.location.href = new URL(route, document.baseURI).href;
}

function normalizedCart() {
  if (!Array.isArray(cart)) return [];

  return cart
    .filter((item) => item && item.id && Number(item.quantity) > 0)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || "Item"),
      price: Number(item.price) || 0,
      image: String(item.image || ""),
      fallbackEmoji: String(item.fallbackEmoji || "🛍️"),
      preorder: Boolean(item.preorder),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));
}

function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function hasRequiredDraft() {
  return ["fullName", "mobileNumber", "street", "barangay", "city", "province", "paymentMethod"]
    .every((key) => typeof draft[key] === "string" && draft[key].trim());
}

function showToast(message, duration = 2200) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(window.reviewToastTimer);
  window.reviewToastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function orderItem(item) {
  return `
    <div class="order-item">
      <div class="order-image-wrap">
        <img class="order-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"
          onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');">
        <div class="order-fallback" aria-hidden="true">${escapeHtml(item.fallbackEmoji)}</div>
      </div>
      <div class="order-copy">
        <strong>${escapeHtml(item.name)}</strong>
        <span>Qty: ${item.quantity} × ${peso(item.price)}</span>
        ${item.preorder ? '<span class="preorder-mini">PRE-ORDER</span>' : ""}
      </div>
      <div class="order-price">${peso(item.price * item.quantity)}</div>
    </div>
  `;
}

function getEndpoint() {
  const url = String(window.RM_STORE_CONFIG?.orderEndpoint || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url) ? url : "";
}

function jsonp(action, params = {}, timeoutMs = 9000) {
  const endpoint = getEndpoint();

  if (!endpoint) {
    return Promise.reject(new Error("Online order receiver is not configured."));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `rmReview_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      script.remove();
      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data || {});
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not reach the store receiver."));
    };

    const query = new URLSearchParams({
      action,
      ...params,
      callback: callbackName,
      _: String(Date.now()),
    });

    script.src = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query.toString()}`;
    document.head.appendChild(script);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Store request timed out."));
    }, timeoutMs);
  });
}

function calculateDeliveryFee(amount) {
  const flat = Math.max(0, Number(checkoutConfig?.flatDeliveryFee) || 0);
  const freeMin = Math.max(0, Number(checkoutConfig?.freeDeliveryMinimum) || 0);

  return freeMin > 0 && amount >= freeMin ? 0 : flat;
}

function paymentAvailable(code) {
  if (code === "JNT_COD") return checkoutConfig?.jntCodEnabled === true;
  if (code === "GOTYME") return checkoutConfig?.gotymeEnabled === true;
  return false;
}

function paymentLabel(code) {
  if (code === "JNT_COD") return "J&T Express — Cash on Delivery";
  if (code === "GOTYME") return "GoTyme Bank / InstaPay QR";
  return "";
}

function applyServerConfigToDraft() {
  const amount = subtotal(normalizedCart());
  const fee = calculateDeliveryFee(amount);

  draft.deliveryFee = fee;
  draft.subtotal = amount;
  draft.estimatedTotal = amount + fee;
  draft.paymentLabel = paymentLabel(draft.paymentMethod);
  draft.paymentInstructions =
    draft.paymentMethod === "GOTYME"
      ? checkoutConfig?.gotymeInstructions || ""
      : checkoutConfig?.jntCodInstructions || "";
  draft.gotymeAccountName = checkoutConfig?.gotymeAccountName || "REYDEN ALBARICO";
  draft.gotymeAccountLast4 = checkoutConfig?.gotymeAccountLast4 || "4507";

  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function renderReview() {
  const items = normalizedCart();

  if (!items.length || !hasRequiredDraft()) {
    reviewContentEl.hidden = true;
    bottomBarEl.hidden = true;
    successStateEl.hidden = true;
    missingStateEl.hidden = false;
    return false;
  }

  missingStateEl.hidden = true;
  successStateEl.hidden = true;
  reviewContentEl.hidden = false;
  bottomBarEl.hidden = false;

  document.getElementById("customerName").textContent = draft.fullName.trim();
  document.getElementById("customerMobile").textContent = draft.mobileNumber.trim();

  document.getElementById("deliveryAddress").textContent =
    [draft.street, draft.barangay, draft.city, draft.province]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", ");

  const notesEl = document.getElementById("deliveryNotes");
  const notes = String(draft.deliveryNotes || "").trim();
  notesEl.hidden = !notes;
  notesEl.textContent = notes ? `Delivery note: ${notes}` : "";

  orderItemsEl.innerHTML = items.map(orderItem).join("");

  const amount = subtotal(items);
  const fee = calculateDeliveryFee(amount);
  const total = amount + fee;

  subtotalValueEl.textContent = peso(amount);
  document.getElementById("summaryDeliveryFee").textContent = fee === 0 ? "FREE" : peso(fee);
  document.getElementById("reviewDeliveryFee").textContent = fee === 0 ? "FREE" : peso(fee);
  totalValueEl.textContent = peso(total);
  stickyTotalEl.textContent = peso(total);

  const freeMin = Math.max(0, Number(checkoutConfig?.freeDeliveryMinimum) || 0);
  const flat = Math.max(0, Number(checkoutConfig?.flatDeliveryFee) || 0);

  document.getElementById("deliveryRuleText").textContent =
    checkoutConfig?.deliveryFeeNote ||
    (freeMin > 0
      ? `${peso(flat)} flat fee • FREE at ${peso(freeMin)}+`
      : `${peso(flat)} flat delivery fee`);

  document.getElementById("reviewPaymentMethod").textContent =
    paymentLabel(draft.paymentMethod) || "—";

  const paymentDetail = document.getElementById("reviewPaymentDetail");

  const reviewGotymeQr = document.getElementById("reviewGotymeQr");

  if (draft.paymentMethod === "GOTYME") {
    const accountName = checkoutConfig?.gotymeAccountName || "REYDEN ALBARICO";
    const last4 = checkoutConfig?.gotymeAccountLast4 || "4507";

    paymentDetail.textContent = `${accountName}${last4 ? ` • •••• ${last4}` : ""}`;
    reviewGotymeQr.hidden = false;
    document.getElementById("reviewGotymeName").textContent = accountName;
    document.getElementById("reviewGotymeHint").textContent =
      last4 ? `Account ending in ${last4}` : "GoTyme Bank / InstaPay";
    document.getElementById("reviewGotymeInstructions").textContent =
      checkoutConfig?.gotymeInstructions ||
      "Scan the QR using a bank or e-wallet that supports InstaPay.";
  } else {
    paymentDetail.textContent =
      checkoutConfig?.jntCodInstructions || "Pay the total amount to the J&T Express rider when your parcel is delivered.";
    reviewGotymeQr.hidden = true;
  }

  preorderNoticeEl.hidden = !items.some((item) => item.preorder);

  return true;
}

function randomSuffix() {
  try {
    const bytes = new Uint8Array(2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (n) => n.toString(36).padStart(2, "0"))
      .join("")
      .toUpperCase()
      .slice(0, 4);
  } catch (_) {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
  }
}

function makeOrderReference() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return `RM-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}-${randomSuffix()}`;
}

function buildOrder() {
  const items = normalizedCart();
  const amount = subtotal(items);
  const fee = calculateDeliveryFee(amount);

  return {
    reference: makeOrderReference(),
    status: "submitting",
    createdAt: new Date().toISOString(),
    customer: {
      fullName: String(draft.fullName || "").trim(),
      mobileNumber: String(draft.mobileNumber || "").trim(),
    },
    delivery: {
      street: String(draft.street || "").trim(),
      barangay: String(draft.barangay || "").trim(),
      city: String(draft.city || "").trim(),
      province: String(draft.province || "").trim(),
      notes: String(draft.deliveryNotes || "").trim(),
      fee,
    },
    payment: {
      method: String(draft.paymentMethod || "").trim(),
      status: draft.paymentMethod === "JNT_COD" ? "unpaid-cod" : "pending-verification",
    },
    preorderAccepted: Boolean(draft.preorderAccepted),
    items,
    subtotal: amount,
    estimatedTotal: amount + fee,
  };
}

function saveOrder(order) {
  const existing = readJson(ORDERS_KEY, []);
  const orders = Array.isArray(existing) ? existing : [];
  const withoutDuplicate = orders.filter((item) => item && item.reference !== order.reference);

  withoutDuplicate.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(withoutDuplicate.slice(0, 50)));
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
}

function orderAsText(order) {
  const itemLines = order.items.map(
    (item) =>
      `• ${item.name} — Qty ${item.quantity} × ${peso(item.price)} = ${peso(
        item.price * item.quantity
      )}${item.preorder ? " (Pre-order)" : ""}`
  );

  const address = [
    order.delivery.street,
    order.delivery.barangay,
    order.delivery.city,
    order.delivery.province,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "Reyden & Mariel Trend Hub",
    `Order Ref: ${order.reference}`,
    "Status: Received by store",
    "",
    `Customer: ${order.customer.fullName}`,
    `Mobile: ${order.customer.mobileNumber}`,
    `Address: ${address}`,
    order.delivery.notes ? `Delivery note: ${order.delivery.notes}` : "",
    "",
    "Items:",
    ...itemLines,
    "",
    `Subtotal: ${peso(order.subtotal)}`,
    `Delivery fee: ${order.delivery.fee === 0 ? "FREE" : peso(order.delivery.fee)}`,
    `Total: ${peso(order.estimatedTotal)}`,
    `Payment method: ${paymentLabel(order.payment.method)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }
}

function setSubmitting(isSubmitting) {
  confirmButtonEl.disabled = isSubmitting;
  confirmButtonEl.classList.toggle("is-loading", isSubmitting);
  confirmButtonEl.querySelector("span").textContent =
    isSubmitting ? "Sending Order…" : "Place Order";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyOrderReceived(reference) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await jsonp("status", { reference });

      if (result?.ok === true && result?.received === true) {
        return true;
      }
    } catch (_) {
      // Retry after a short delay.
    }

    await sleep(700 + attempt * 350);
  }

  return false;
}

async function submitOrderOnline(order) {
  const endpoint = getEndpoint();

  if (!endpoint) {
    throw new Error("Online order receiver is not configured yet.");
  }

  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    cache: "no-store",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify({
      action: "createOrder",
      store: "Reyden & Mariel Trend Hub",
      sourceUrl: window.location.href,
      order,
    }),
  });

  const received = await verifyOrderReceived(order.reference);

  if (!received) {
    throw new Error("The store could not confirm receipt yet. Please try again.");
  }
}

function showSuccess(order) {
  reviewContentEl.hidden = true;
  missingStateEl.hidden = true;
  bottomBarEl.hidden = true;
  successStateEl.hidden = false;

  document.getElementById("orderReference").textContent = order.reference;

  document.getElementById("successMessage").textContent =
    order.payment.method === "GOTYME"
      ? "Your order was received. Your selected payment method is GoTyme Bank / InstaPay QR. Follow the store's payment instruction and keep your order reference for tracking."
      : "Your order was received with J&T Express Cash on Delivery selected. The store will confirm the order and book the J&T shipment after COD service is active. Your tracking number will appear on the Track Order page once assigned.";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initializeReview() {
  if (!getEndpoint()) {
    connectionNoticeEl.classList.add("setup-required");
    connectionNoticeEl.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>
      </svg>
      <p><strong>Store setup required.</strong> The online order receiver is not configured.</p>
    `;
    renderReview();
    return;
  }

  try {
    const result = await jsonp("checkoutConfig");

    if (!result?.ok || !result.config) {
      throw new Error(result?.error || "Checkout settings unavailable.");
    }

    checkoutConfig = result.config;

    if (!paymentAvailable(draft.paymentMethod)) {
      connectionNoticeEl.classList.add("setup-required");
      connectionNoticeEl.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>
        </svg>
        <p><strong>Payment selection changed.</strong> Return to checkout and choose an available payment method.</p>
      `;
      renderReview();
      confirmButtonEl.disabled = true;
      return;
    }

    applyServerConfigToDraft();

    const canReview = renderReview();

    if (canReview) {
      connectionNoticeEl.classList.remove("setup-required");
      connectionNoticeEl.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/>
        </svg>
        <p><strong>Ready to place order.</strong> Delivery fee and payment method are included in the total shown above.</p>
      `;
      confirmButtonEl.disabled = false;
    }
  } catch (error) {
    console.error(error);

    renderReview();
    connectionNoticeEl.classList.add("setup-required");
    connectionNoticeEl.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>
      </svg>
      <p><strong>Could not load checkout settings.</strong> ${escapeHtml(
        error?.message || "Try again later."
      )}</p>
    `;
    confirmButtonEl.disabled = true;
  }
}

confirmButtonEl.addEventListener("click", async () => {
  if (confirmButtonEl.disabled || !checkoutConfig) return;

  if (!paymentAvailable(draft.paymentMethod)) {
    showToast("Please return to checkout and choose a payment method", 3200);
    return;
  }

  setSubmitting(true);
  const order = buildOrder();

  try {
    await submitOrderOnline(order);

    order.status = "received";
    order.receivedAt = new Date().toISOString();

    saveOrder(order);
    currentOrder = order;

    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(DRAFT_KEY);

    cart = [];
    draft = {};

    showSuccess(order);
  } catch (error) {
    console.error(error);
    showToast(error?.message || "Could not send order. Please try again.", 4200);
    setSubmitting(false);
  }
});

document.getElementById("backButton").addEventListener("click", () => go("checkout/"));
document.getElementById("editDetailsButton").addEventListener("click", () => go("checkout/"));
document.getElementById("editCartButton").addEventListener("click", () => go("cart/"));
document.getElementById("shopButton").addEventListener("click", () => go("index.html"));
document.getElementById("continueButton").addEventListener("click", () => go("index.html"));

document.getElementById("copyOrderButton").addEventListener("click", async () => {
  const order = currentOrder || readJson(LAST_ORDER_KEY, null);

  if (!order) {
    showToast("No saved order found");
    return;
  }

  const copied = await copyText(orderAsText(order));
  showToast(copied ? "Order details copied" : "Could not copy order details");
});

initializeReview();
