(() => {
  const CART_KEY = "rmCart";
  const SAVED_KEY = "rmSavedProducts";
  const PROFILE_KEY = "rmCustomerProfile";
  const page = document.body.dataset.customerPage || "";

  const safeRead = (key, fallback) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  };

  const PRODUCTS_LIST = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
  let cart = safeRead(CART_KEY, []);
  let saved = new Set(safeRead(SAVED_KEY, []));
  let category = "all";

  const peso = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

  const soldLabel = (value) => {
    if (value == null) return "";
    if (value >= 1000) {
      const rounded = value >= 10000 ? Math.round(value / 1000) : (value / 1000).toFixed(1).replace(".0", "");
      return `${rounded}K sold`;
    }
    return `${value} sold`;
  };

  const discountPercent = (product) => {
    if (!product.oldPrice || product.oldPrice <= product.price) return 0;
    return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const toast = document.getElementById("customerToast");
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.rmCustomerToastTimer);
    window.rmCustomerToastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
  };

  const saveCart = () => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadges();
  };

  const saveSaved = () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
    updateBadges();
  };

  const updateBadges = () => {
    const qty = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0;
    document.querySelectorAll(".cart-badge").forEach((el) => { el.textContent = qty; });
    document.querySelectorAll("[data-saved-count]").forEach((el) => { el.textContent = saved.size; });
  };

  const productCard = (product) => {
    const isSaved = saved.has(product.id);
    const discount = discountPercent(product);
    const socialProof = product.rating != null || product.sold != null
      ? `<div class="rating-row">${product.rating != null ? `<span>★ ${escapeHtml(product.rating)}</span>` : ""}${product.sold != null ? `<small>${soldLabel(product.sold)}</small>` : ""}</div>`
      : `<div class="rating-row"><small>New at R&amp;M Trend Hub</small></div>`;

    return `
      <article class="product-card" data-id="${escapeHtml(product.id)}">
        <div class="product-image">
          <img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"
            onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');">
          <div class="image-fallback" aria-hidden="true">${escapeHtml(product.fallbackEmoji || "🛍️")}</div>
          ${discount ? `<span class="discount-badge">-${discount}%</span>` : ""}
          ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
          <button class="heart-button ${isSaved ? "saved" : ""}" type="button" data-save-id="${escapeHtml(product.id)}" aria-label="${isSaved ? "Remove" : "Save"} ${escapeHtml(product.name)}">
            ${isSaved ? "♥" : "♡"}
          </button>
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHtml(product.categoryLabel || product.category || "Product")}</p>
          <h4>${escapeHtml(product.name)}</h4>
          ${socialProof}
          <div class="price-row"><strong>${peso(product.price)}</strong>${product.oldPrice ? `<span>${peso(product.oldPrice)}</span>` : ""}</div>
          <button class="add-btn" type="button" data-add-id="${escapeHtml(product.id)}">
            <span>${product.preorder ? "Pre-Order" : "Add to Cart"}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </article>`;
  };

  function addToCart(id) {
    const product = PRODUCTS_LIST.find((item) => item.id === id);
    if (!product) return;
    if (!Array.isArray(cart)) cart = [];
    const existing = cart.find((item) => item.id === id);
    if (existing) existing.quantity = (Number(existing.quantity) || 0) + 1;
    else cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: product.image || "",
      fallbackEmoji: product.fallbackEmoji || "🛍️",
      preorder: Boolean(product.preorder),
      quantity: 1,
    });
    saveCart();
    showToast(product.preorder ? `${product.name} added as a pre-order` : `${product.name} added to cart`);
  }

  function toggleSaved(id) {
    const product = PRODUCTS_LIST.find((item) => item.id === id);
    if (!product) return;
    if (saved.has(id)) {
      saved.delete(id);
      showToast(`${product.name} removed from Saved`);
    } else {
      saved.add(id);
      showToast(`${product.name} saved`);
    }
    saveSaved();
    renderCatalog();
  }

  const grid = document.getElementById("customerProductGrid");
  const empty = document.getElementById("customerEmpty");
  const search = document.getElementById("customerSearchInput");

  function renderCatalog() {
    if (!grid) return;
    const q = (search?.value || "").trim().toLowerCase();
    const list = PRODUCTS_LIST.filter((product) => {
      if (page === "saved" && !saved.has(product.id)) return false;
      const searchMatch = !q || product.name.toLowerCase().includes(q) || String(product.categoryLabel || "").toLowerCase().includes(q);
      const categoryMatch = category === "all" || product.category === category;
      return searchMatch && categoryMatch;
    });
    grid.innerHTML = list.map(productCard).join("");
    if (empty) empty.hidden = list.length !== 0;
    const countEl = document.getElementById("catalogCount");
    if (countEl) countEl.textContent = list.length;
  }

  grid?.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-id]");
    if (add) return addToCart(add.dataset.addId);
    const save = event.target.closest("[data-save-id]");
    if (save) toggleSaved(save.dataset.saveId);
  });

  search?.addEventListener("input", renderCatalog);
  document.querySelectorAll("[data-customer-category]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-customer-category]").forEach((x) => x.classList.remove("active"));
      button.classList.add("active");
      category = button.dataset.customerCategory;
      renderCatalog();
    });
  });

  document.querySelectorAll("[data-cart-route]").forEach((button) => {
    button.addEventListener("click", () => { window.location.href = new URL("cart/", document.baseURI).href; });
  });

  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    const profile = safeRead(PROFILE_KEY, {});
    [...profileForm.elements].forEach((control) => {
      if (control.name && typeof profile[control.name] === "string") control.value = profile[control.name];
    });

    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = {};
      [...profileForm.elements].forEach((control) => {
        if (control.name) data[control.name] = control.value.trim();
      });
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
      showToast("Customer profile saved on this device");
    });

    document.getElementById("clearProfileButton")?.addEventListener("click", () => {
      localStorage.removeItem(PROFILE_KEY);
      profileForm.reset();
      showToast("Customer profile cleared");
    });
  }

  updateBadges();
  renderCatalog();
})();
