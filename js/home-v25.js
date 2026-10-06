(() => {
  const CART_KEY = "rmCart";
  const SAVED_KEY = "rmSavedProducts";
  const PRODUCTS_LIST = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch (_) { return fallback; }
  };

  let cart = readJson(CART_KEY, []);
  let saved = new Set(readJson(SAVED_KEY, []));

  const peso = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(value) || 0);

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const toast = document.getElementById("toast");
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.rmHomeToastTimer);
    window.rmHomeToastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  };

  const updateCartBadge = () => {
    const qty = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0;
    document.querySelectorAll(".cart-badge").forEach((el) => { el.textContent = qty; });
  };

  const saveCart = () => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
  };

  const saveSaved = () => localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));

  const addToCart = (id) => {
    const product = PRODUCTS_LIST.find((item) => item.id === id);
    if (!product) return;
    if (!Array.isArray(cart)) cart = [];
    const existing = cart.find((item) => item.id === id);
    if (existing) existing.quantity = (Number(existing.quantity) || 0) + 1;
    else cart.push({
      id: product.id, name: product.name, price: Number(product.price) || 0,
      image: product.image || "", fallbackEmoji: product.fallbackEmoji || "🛍️",
      preorder: Boolean(product.preorder), quantity: 1,
    });
    saveCart();
    showToast(product.preorder ? `${product.name} added as a pre-order` : `${product.name} added to cart`);
  };

  const featureCard = (product) => {
    const isSaved = saved.has(product.id);
    return `<article class="home-feature-card-v25">
      <div class="home-feature-image-v25">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');">
        <div class="home-feature-fallback-v25" aria-hidden="true">${escapeHtml(product.fallbackEmoji || "🛍️")}</div>
        <span class="home-feature-badge-v25">${escapeHtml(product.badge || (product.preorder ? "Pre-order" : "Featured"))}</span>
        <button class="home-save-v25 ${isSaved ? "saved" : ""}" type="button" data-home-save="${escapeHtml(product.id)}" aria-label="Save ${escapeHtml(product.name)}">${isSaved ? "♥" : "♡"}</button>
      </div>
      <div class="home-feature-body-v25">
        <small>${escapeHtml(product.categoryLabel || product.category || "Product")}</small>
        <h4>${escapeHtml(product.name)}</h4>
        <div class="home-feature-price-v25">${peso(product.price)}</div>
        <button class="home-feature-add-v25" type="button" data-home-add="${escapeHtml(product.id)}">${product.preorder ? "Pre-Order" : "Add to Cart"}</button>
      </div>
    </article>`;
  };

  const featuredGrid = document.getElementById("homeFeaturedGridV25");
  const renderFeatured = () => {
    if (!featuredGrid) return;
    const featured = PRODUCTS_LIST.slice(0, 4);
    featuredGrid.innerHTML = featured.map(featureCard).join("");
  };

  const preorder = PRODUCTS_LIST.find((product) => product.preorder);
  const preorderHost = document.getElementById("homePreorderV25");
  if (preorderHost) {
    if (!preorder) preorderHost.hidden = true;
    else {
      preorderHost.innerHTML = `<div class="home-preorder-copy-v25">
        <span>Pre-order spotlight</span>
        <h3>${escapeHtml(preorder.name)}</h3>
        <p>Reserve one of our highlighted pre-order finds before stock arrives.</p>
        <strong>${peso(preorder.price)}</strong>
        <div class="home-preorder-actions-v25">
          <button type="button" data-home-add="${escapeHtml(preorder.id)}">Pre-Order</button>
          <a href="shop/">View Shop</a>
        </div>
      </div>
      <div class="home-preorder-image-v25">
        <img src="${escapeHtml(preorder.image)}" alt="${escapeHtml(preorder.name)}" onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');">
        <div class="home-feature-fallback-v25" aria-hidden="true">${escapeHtml(preorder.fallbackEmoji || "🛍️")}</div>
      </div>`;
    }
  }

  document.addEventListener("click", (event) => {
    const add = event.target.closest?.("[data-home-add]");
    if (add) {
      addToCart(add.dataset.homeAdd);
      return;
    }

    const save = event.target.closest?.("[data-home-save]");
    if (save) {
      const id = save.dataset.homeSave;
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
      renderFeatured();
      return;
    }

    if (event.target.closest?.(".cart-button")) {
      event.preventDefault();
      window.location.href = new URL("cart/", document.baseURI).href;
      return;
    }

    const nav = event.target.closest?.(".bottom-nav .nav-item");
    if (nav) {
      const label = nav.getAttribute("aria-label");
      const routes = { Home: "index.html", Shop: "shop/", Saved: "saved/", Account: "account/" };
      if (routes[label]) {
        event.preventDefault();
        window.location.href = new URL(routes[label], document.baseURI).href;
      }
    }
  });

  document.querySelector(".hero-button")?.addEventListener("click", () => {
    window.location.href = new URL("shop/", document.baseURI).href;
  });

  updateCartBadge();
  renderFeatured();
})();
