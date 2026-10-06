const cartItemsEl = document.getElementById("cartItems");
const emptyCartEl = document.getElementById("emptyCart");
const cartContentEl = document.getElementById("cartContent");
const checkoutBarEl = document.getElementById("checkoutBar");
const subtotalValueEl = document.getElementById("subtotalValue");
const totalValueEl = document.getElementById("totalValue");
const stickyTotalEl = document.getElementById("stickyTotal");
const cartCountLabelEl = document.getElementById("cartCountLabel");
const preorderNoticeEl = document.getElementById("preorderNotice");
const toast = document.getElementById("toast");

let cart = JSON.parse(localStorage.getItem("rmCart") || "[]");

function peso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getProduct(id) {
  return PRODUCTS.find((product) => product.id === id);
}

function normalizedCart() {
  return cart
    .map((item) => {
      const product = getProduct(item.id);
      if (!product) return null;

      return {
        id: product.id,
        name: product.name,
        categoryLabel: product.categoryLabel,
        price: product.price,
        image: product.image,
        fallbackEmoji: product.fallbackEmoji,
        preorder: Boolean(product.preorder),
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    })
    .filter(Boolean);
}

function saveCart() {
  localStorage.setItem("rmCart", JSON.stringify(cart));
}

function totalQuantity(items) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function subtotal(items) {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1400);
}

function itemCard(item) {
  return `
    <article class="cart-card" data-cart-id="${item.id}">
      <div class="item-image-wrap">
        <img
          class="item-image"
          src="${item.image}"
          alt="${item.name}"
          onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');"
        >
        <div class="item-fallback" aria-hidden="true">${item.fallbackEmoji || "🛍️"}</div>
        ${item.preorder ? `<span class="preorder-chip">Pre-Order</span>` : ""}
      </div>

      <div class="item-details">
        <p class="item-category">${item.categoryLabel}</p>
        <h2>${item.name}</h2>
        <div class="item-price">${peso(item.price)}</div>

        <div class="item-bottom">
          <div class="quantity-control">
            <button class="qty-button" type="button" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-button" type="button" data-action="increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>

          <button class="remove-button" type="button" data-action="remove" data-id="${item.id}" aria-label="Remove ${item.name}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18"/>
              <path d="M8 6V4h8v2"/>
              <path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderCart() {
  const items = normalizedCart();
  const count = totalQuantity(items);
  const amount = subtotal(items);

  cartCountLabelEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  subtotalValueEl.textContent = peso(amount);
  totalValueEl.textContent = peso(amount);
  stickyTotalEl.textContent = peso(amount);

  const hasPreorder = items.some((item) => item.preorder);
  preorderNoticeEl.hidden = !hasPreorder;

  if (items.length === 0) {
    cartContentEl.hidden = true;
    checkoutBarEl.hidden = true;
    emptyCartEl.hidden = false;
    return;
  }

  cartContentEl.hidden = false;
  checkoutBarEl.hidden = false;
  emptyCartEl.hidden = true;

  cartItemsEl.innerHTML = items.map(itemCard).join("");
}

function updateQuantity(id, delta) {
  const item = cart.find((entry) => entry.id === id);
  if (!item) return;

  item.quantity = Math.max(1, (Number(item.quantity) || 1) + delta);
  saveCart();
  renderCart();
}

function removeItem(id) {
  const product = getProduct(id);
  cart = cart.filter((entry) => entry.id !== id);
  saveCart();
  renderCart();
  showToast(`${product?.name || "Item"} removed`);
}

cartItemsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "increase") updateQuantity(id, 1);
  if (action === "decrease") updateQuantity(id, -1);
  if (action === "remove") removeItem(id);
});

document.getElementById("backButton").addEventListener("click", () => {
  window.location.href = new URL("index.html", document.baseURI).href;
});

document.getElementById("continueShoppingButton").addEventListener("click", () => {
  window.location.href = new URL("index.html", document.baseURI).href;
});

document.getElementById("clearCartButton").addEventListener("click", () => {
  if (cart.length === 0) {
    showToast("Your cart is already empty");
    return;
  }

  const confirmed = window.confirm("Remove all items from your cart?");
  if (!confirmed) return;

  cart = [];
  saveCart();
  renderCart();
  showToast("Cart cleared");
});

document.getElementById("checkoutButton").addEventListener("click", () => {
  window.location.href = new URL("checkout/", document.baseURI).href;
});

renderCart();
