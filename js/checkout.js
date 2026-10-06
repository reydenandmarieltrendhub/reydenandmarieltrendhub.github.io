const CART_KEY = "rmCart";
const DRAFT_KEY = "rmCheckoutDraft";
const PROFILE_KEY = "rmCustomerProfile";

const cart = readJson(CART_KEY, []);
let draft = readJson(DRAFT_KEY, {});
let checkoutConfig = null;

const checkoutContentEl = document.getElementById("checkoutContent");
const emptyStateEl = document.getElementById("emptyState");
const bottomBarEl = document.getElementById("bottomBar");
const orderItemsEl = document.getElementById("orderItems");
const subtotalValueEl = document.getElementById("subtotalValue");
const totalValueEl = document.getElementById("totalValue");
const stickyTotalEl = document.getElementById("stickyTotal");
const summaryDeliveryFeeEl = document.getElementById("summaryDeliveryFee");
const deliveryFeeValueEl = document.getElementById("deliveryFeeValue");
const deliveryRuleTextEl = document.getElementById("deliveryRuleText");
const freeDeliveryNoticeEl = document.getElementById("freeDeliveryNotice");
const paymentLoadingEl = document.getElementById("paymentLoading");
const paymentOptionsEl = document.getElementById("paymentOptions");
const paymentErrorEl = document.getElementById("paymentError");
const gotymeQrPanelEl = document.getElementById("gotymeQrPanel");
const preorderNoticeEl = document.getElementById("preorderNotice");
const preorderAgreementEl = document.getElementById("preorderAgreement");
const preorderCheckboxEl = document.getElementById("preorderCheckbox");
const formEl = document.getElementById("checkoutForm");
const toastEl = document.getElementById("toast");
const reviewButtonEl = document.getElementById("reviewButton");

const requiredFields = ["fullName", "mobileNumber", "street", "barangay", "city", "province"];

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

function showToast(message, duration = 2200) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(window.checkoutToastTimer);
  window.checkoutToastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function go(route) {
  window.location.href = new URL(route, document.baseURI).href;
}

function getEndpoint() {
  const url = String(window.RM_STORE_CONFIG?.orderEndpoint || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url) ? url : "";
}

function jsonp(action, params = {}, timeoutMs = 9000) {
  const endpoint = getEndpoint();
  if (!endpoint) return Promise.reject(new Error("Online checkout is not configured."));

  return new Promise((resolve, reject) => {
    const callbackName = `rmCheckout_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      reject(new Error("Could not load store checkout settings."));
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
      reject(new Error("Checkout settings request timed out."));
    }, timeoutMs);
  });
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
        <span>Qty: ${item.quantity}</span>
        ${item.preorder ? '<span class="preorder-mini">PRE-ORDER</span>' : ""}
      </div>
      <div class="order-price">${peso(item.price * item.quantity)}</div>
    </div>
  `;
}

function loadDraftIntoForm() {
  /* RM customer profile prefill v24 */
  const profile = readJson(PROFILE_KEY, {});
  ["fullName", "mobileNumber", "street", "barangay", "city", "province"].forEach((key) => {
    if ((!draft[key] || !String(draft[key]).trim()) && typeof profile[key] === "string") {
      draft[key] = profile[key];
    }
  });
  [...formEl.elements].forEach((control) => {
    if (!control.name || control.type === "checkbox" || control.type === "radio") return;
    if (typeof draft[control.name] === "string") control.value = draft[control.name];
  });

  preorderCheckboxEl.checked = draft.preorderAccepted === true;
}

function selectedPaymentMethod() {
  return formEl.querySelector('input[name="paymentMethod"]:checked')?.value || "";
}

function calculateDeliveryFee(amount) {
  if (!checkoutConfig) return 0;

  const flat = Math.max(0, Number(checkoutConfig.flatDeliveryFee) || 0);
  const freeMin = Math.max(0, Number(checkoutConfig.freeDeliveryMinimum) || 0);
  return freeMin > 0 && amount >= freeMin ? 0 : flat;
}

function paymentLabel(code) {
  if (code === "JNT_COD") return "J&T Express — Cash on Delivery";
  if (code === "GOTYME") return "GoTyme Bank / InstaPay QR";
  return "";
}

function saveDraft() {
  const data = { ...draft };

  [...formEl.elements].forEach((control) => {
    if (!control.name || control.type === "checkbox" || control.type === "radio") return;
    data[control.name] = control.value.trim();
  });

  const items = normalizedCart();
  const amount = subtotal(items);
  const fee = calculateDeliveryFee(amount);

  data.preorderAccepted = preorderCheckboxEl.checked;
  data.paymentMethod = selectedPaymentMethod();
  data.paymentLabel = paymentLabel(data.paymentMethod);
  data.deliveryFee = fee;
  data.subtotal = amount;
  data.estimatedTotal = amount + fee;

  if (checkoutConfig) {
    data.gotymeAccountName = checkoutConfig.gotymeAccountName || "REYDEN ALBARICO";
    data.gotymeAccountLast4 = checkoutConfig.gotymeAccountLast4 || "4507";
    data.paymentInstructions =
      data.paymentMethod === "GOTYME"
        ? checkoutConfig.gotymeInstructions || ""
        : checkoutConfig.jntCodInstructions || "";
  }

  draft = data;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function validateField(input) {
  const wrapper = input.closest(".field");
  if (!wrapper) return true;

  const valid = input.value.trim().length > 0;
  wrapper.classList.toggle("invalid", !valid);
  return valid;
}

function validateCheckout(hasPreorder) {
  let valid = true;
  let firstInvalid = null;

  requiredFields.forEach((id) => {
    const input = document.getElementById(id);
    const ok = validateField(input);
    if (!ok && !firstInvalid) firstInvalid = input;
    valid = ok && valid;
  });

  if (!selectedPaymentMethod()) {
    paymentErrorEl.hidden = false;
    document.getElementById("paymentCard").classList.add("payment-invalid");
    valid = false;
    if (!firstInvalid) firstInvalid = document.getElementById("paymentCard");
  } else {
    paymentErrorEl.hidden = true;
    document.getElementById("paymentCard").classList.remove("payment-invalid");
  }

  if (hasPreorder && !preorderCheckboxEl.checked) {
    preorderAgreementEl.classList.add("invalid");
    if (!firstInvalid) firstInvalid = preorderCheckboxEl;
    valid = false;
  } else {
    preorderAgreementEl.classList.remove("invalid");
  }

  if (!checkoutConfig) {
    valid = false;
    showToast("Store checkout settings are still loading");
  }

  if (!valid && firstInvalid?.scrollIntoView) {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return valid;
}

function updateGotymePanel() {
  if (!gotymeQrPanelEl || !checkoutConfig) return;

  const selected = selectedPaymentMethod() === "GOTYME";
  gotymeQrPanelEl.hidden = !selected;

  if (selected) {
    document.getElementById("gotymeAccountName").textContent =
      checkoutConfig.gotymeAccountName || "REYDEN ALBARICO";
    document.getElementById("gotymeAccountHint").textContent =
      checkoutConfig.gotymeAccountLast4
        ? `Account ending in ${checkoutConfig.gotymeAccountLast4}`
        : "GoTyme Bank / InstaPay";
    document.getElementById("gotymeInstructions").textContent =
      checkoutConfig.gotymeInstructions ||
      "Scan the QR using a bank or e-wallet that supports InstaPay.";
  }
}

function renderPaymentOptions() {
  const options = [];

  if (checkoutConfig.jntCodEnabled) {
    options.push(`
      <label class="payment-option">
        <input type="radio" name="paymentMethod" value="JNT_COD">
        <span class="payment-radio"></span>
        <span class="payment-copy">
          <strong>J&T Express — Cash on Delivery</strong>
          <small>${escapeHtml(checkoutConfig.jntCodInstructions || "Pay the total amount to the J&T Express rider when your parcel is delivered.")}</small>
          <small class="payment-note">J&T COD is available only after the store confirms your order and books the shipment.</small>
        </span>
        <span class="payment-badge">J&T COD</span>
      </label>
    `);
  }

  if (checkoutConfig.gotymeEnabled) {
    const account = [
      checkoutConfig.gotymeAccountName || "REYDEN ALBARICO",
      checkoutConfig.gotymeAccountLast4 ? `•••• ${checkoutConfig.gotymeAccountLast4}` : ""
    ].filter(Boolean).join(" • ");

    options.push(`
      <label class="payment-option">
        <input type="radio" name="paymentMethod" value="GOTYME">
        <span class="payment-radio"></span>
        <span class="payment-copy">
          <strong>GoTyme Bank / InstaPay QR</strong>
          <small>${escapeHtml(account || "Scan the store QR to pay")}</small>
          <small class="payment-note">${escapeHtml(checkoutConfig.gotymeInstructions || "Scan using a bank or e-wallet that supports InstaPay.")}</small>
        </span>
        <span class="payment-badge gotyme">QR PAY</span>
      </label>
    `);
  }

  paymentLoadingEl.hidden = true;
  paymentOptionsEl.hidden = false;

  paymentOptionsEl.innerHTML =
    options.join("") ||
    '<div class="config-error">No payment method is currently enabled. J&T COD stays unavailable until the store activates its approved J&T COD account.</div>';

  const allowed = Array.from(
    paymentOptionsEl.querySelectorAll('input[name="paymentMethod"]')
  ).map((el) => el.value);

  const preferred = allowed.includes(draft.paymentMethod) ? draft.paymentMethod : allowed[0];

  if (preferred) {
    const input = paymentOptionsEl.querySelector(`input[value="${preferred}"]`);
    if (input) input.checked = true;
  }

  reviewButtonEl.disabled = !preferred;
  updateGotymePanel();

  paymentOptionsEl.addEventListener("change", () => {
    paymentErrorEl.hidden = true;
    document.getElementById("paymentCard").classList.remove("payment-invalid");
    saveDraft();
    renderTotals();
    updateGotymePanel();
  });
}

function renderTotals() {
  const amount = subtotal(normalizedCart());
  const fee = calculateDeliveryFee(amount);
  const total = amount + fee;

  subtotalValueEl.textContent = peso(amount);
  deliveryFeeValueEl.textContent = checkoutConfig ? (fee === 0 ? "FREE" : peso(fee)) : "—";
  summaryDeliveryFeeEl.textContent = checkoutConfig ? (fee === 0 ? "FREE" : peso(fee)) : "—";
  totalValueEl.textContent = peso(total);
  stickyTotalEl.textContent = peso(total);

  if (checkoutConfig) {
    const freeMin = Math.max(0, Number(checkoutConfig.freeDeliveryMinimum) || 0);
    const flat = Math.max(0, Number(checkoutConfig.flatDeliveryFee) || 0);

    deliveryRuleTextEl.textContent =
      checkoutConfig.deliveryFeeNote ||
      (freeMin > 0
        ? `${peso(flat)} flat fee • FREE at ${peso(freeMin)}+`
        : `${peso(flat)} flat delivery fee`);

    freeDeliveryNoticeEl.hidden = !(freeMin > 0);

    if (freeMin > 0) {
      freeDeliveryNoticeEl.textContent =
        amount >= freeMin
          ? "Free delivery unlocked for this order."
          : `Add ${peso(Math.max(0, freeMin - amount))} more to unlock free delivery.`;
    }
  }
}

function renderCheckout() {
  const items = normalizedCart();

  if (!items.length) {
    checkoutContentEl.hidden = true;
    bottomBarEl.hidden = true;
    emptyStateEl.hidden = false;
    return false;
  }

  checkoutContentEl.hidden = false;
  bottomBarEl.hidden = false;
  emptyStateEl.hidden = true;

  orderItemsEl.innerHTML = items.map(orderItem).join("");

  const hasPreorder = items.some((item) => item.preorder);
  preorderNoticeEl.hidden = !hasPreorder;
  preorderAgreementEl.hidden = !hasPreorder;

  renderTotals();
  return hasPreorder;
}

async function loadCheckoutConfig() {
  try {
    const result = await jsonp("checkoutConfig");

    if (!result?.ok || !result.config) {
      throw new Error(result?.error || "Checkout settings unavailable.");
    }

    checkoutConfig = result.config;
    renderPaymentOptions();
    renderTotals();
    saveDraft();
  } catch (error) {
    console.error(error);

    paymentLoadingEl.hidden = true;
    paymentOptionsEl.hidden = false;
    paymentOptionsEl.innerHTML = `
      <div class="config-error">
        ${escapeHtml(error?.message || "Could not load checkout settings.")}
        Please try again after the store is online.
      </div>
    `;

    deliveryRuleTextEl.textContent = "Could not load delivery fee";
    reviewButtonEl.disabled = true;
  }
}

const hasPreorder = Boolean(renderCheckout());
loadDraftIntoForm();
loadCheckoutConfig();

formEl.addEventListener("input", (event) => {
  const input = event.target;

  if (input.matches("input, textarea")) {
    const wrapper = input.closest(".field");
    if (wrapper && input.value.trim()) wrapper.classList.remove("invalid");

    if (input === preorderCheckboxEl && input.checked) {
      preorderAgreementEl.classList.remove("invalid");
    }

    saveDraft();
  }
});

formEl.addEventListener("change", () => {
  saveDraft();
  renderTotals();
});

document.getElementById("backButton").addEventListener("click", () => go("cart/"));
document.getElementById("editCartButton").addEventListener("click", () => go("cart/"));
document.getElementById("shopButton").addEventListener("click", () => go("index.html"));

reviewButtonEl.addEventListener("click", () => {
  if (!validateCheckout(hasPreorder)) {
    showToast("Please complete the required checkout details");
    return;
  }

  saveDraft();
  go("review/");
});
