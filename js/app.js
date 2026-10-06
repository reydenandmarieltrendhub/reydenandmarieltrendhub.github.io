const searchInput = document.getElementById("searchInput");
const productGrid = document.getElementById("productGrid");
const categoryButtons = [...document.querySelectorAll(".category")];
const emptyState = document.getElementById("emptyState");
const cartBadge = document.querySelector(".cart-badge");
const toast = document.getElementById("toast");
const navItems = [...document.querySelectorAll(".nav-item")];

let selectedCategory = "all";

const savedProducts = new Set(
  JSON.parse(localStorage.getItem("rmSavedProducts") || "[]")
);

const cart = JSON.parse(localStorage.getItem("rmCart") || "[]");

function peso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function soldLabel(value) {
  if (value >= 1000) {
    const rounded = value >= 10000
      ? Math.round(value / 1000)
      : (value / 1000).toFixed(1).replace(".0", "");
    return `${rounded}K sold`;
  }
  return `${value} sold`;
}

function discountPercent(product) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

function cartQuantity() {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function updateCartBadge() {
  cartBadge.textContent = cartQuantity();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1500);
}

function productCard(product) {
  const isSaved = savedProducts.has(product.id);
  const discount = discountPercent(product);

  const socialProof =
    product.rating != null || product.sold != null
      ? `
        <div class="rating-row">
          ${product.rating != null ? `<span>★ ${product.rating}</span>` : ""}
          ${product.sold != null ? `<small>${soldLabel(product.sold)}</small>` : ""}
        </div>
      `
      : `<div class="rating-row"><small>New at R&amp;M Trend Hub</small></div>`;

  return `
    <article class="product-card"
      data-id="${product.id}"
      data-name="${product.name.toLowerCase()}"
      data-category="${product.category}">
      <div class="product-image">
        <img
          class="product-photo"
          src="${product.image}"
          alt="${product.name}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');"
        >
        <div class="image-fallback" aria-hidden="true">${product.fallbackEmoji || "🛍️"}</div>

        ${discount ? `<span class="discount-badge">-${discount}%</span>` : ""}
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}

        <button
          class="heart-button ${isSaved ? "saved" : ""}"
          type="button"
          data-save-id="${product.id}"
          aria-label="Save ${product.name}">
          ${isSaved ? "♥" : "♡"}
        </button>
      </div>

      <div class="product-info">
        <p class="product-category">${product.categoryLabel}</p>
        <h4>${product.name}</h4>

        ${socialProof}

        <div class="price-row">
          <strong>${peso(product.price)}</strong>
          ${product.oldPrice ? `<span>${peso(product.oldPrice)}</span>` : ""}
        </div>

        <button class="add-btn" type="button" data-add-id="${product.id}">
          <span>${product.preorder ? "Pre-Order" : "Add to Cart"}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    </article>
  `;
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = PRODUCTS.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.categoryLabel.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategory === "all" ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  productGrid.innerHTML = filtered.map(productCard).join("");
  emptyState.hidden = filtered.length !== 0;
}

function saveCart() {
  localStorage.setItem("rmCart", JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId) {
  const product = PRODUCTS.find((item) => item.id === productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      fallbackEmoji: product.fallbackEmoji,
      preorder: Boolean(product.preorder),
      quantity: 1,
    });
  }

  saveCart();
  showToast(
    product.preorder
      ? `${product.name} added as a pre-order`
      : `${product.name} added to cart`
  );
}

function toggleSaved(productId) {
  const product = PRODUCTS.find((item) => item.id === productId);
  if (!product) return;

  if (savedProducts.has(productId)) {
    savedProducts.delete(productId);
    showToast(`${product.name} removed from saved items`);
  } else {
    savedProducts.add(productId);
    showToast(`${product.name} saved`);
  }

  localStorage.setItem("rmSavedProducts", JSON.stringify([...savedProducts]));
  renderProducts();
}

productGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-id]");
  if (addButton) {
    addToCart(addButton.dataset.addId);
    return;
  }

  const saveButton = event.target.closest("[data-save-id]");
  if (saveButton) {
    toggleSaved(saveButton.dataset.saveId);
  }
});

searchInput.addEventListener("input", renderProducts);

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedCategory = button.dataset.category;
    renderProducts();

    button.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  });
});

document.querySelector(".hero-button").addEventListener("click", () => {
  document.querySelector(".products-section").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

document.querySelector(".cart-button").addEventListener("click", (event) => {
  event.preventDefault();
  window.location.href = new URL("cart/", document.baseURI).href;
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");
  });
});

const timerParts = [...document.querySelectorAll(".deal-timer span")];
let remainingSeconds = (2 * 60 * 60) + (18 * 60) + 45;

function updateDealTimer() {
  remainingSeconds = Math.max(0, remainingSeconds - 1);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .forEach((value, index) => {
      timerParts[index].textContent = value;
    });
}

updateCartBadge();
renderProducts();
setInterval(updateDealTimer, 1000);


/* RM clean-route guard v14 */
document.addEventListener("click", (event) => {
  const button = event.target.closest?.(".cart-button");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  window.location.href = new URL("cart/", document.baseURI).href;
}, true);
