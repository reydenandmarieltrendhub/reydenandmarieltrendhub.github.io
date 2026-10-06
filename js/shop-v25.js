(() => {
  const CART_KEY = "rmCart";
  const SAVED_KEY = "rmSavedProducts";
  const PRODUCTS_LIST = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch (_) { return fallback; } };
  let cart = readJson(CART_KEY, []);
  let saved = new Set(readJson(SAVED_KEY, []));
  let category = "all";
  let stock = "all";

  const peso = (value) => new Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP", minimumFractionDigits:0, maximumFractionDigits:0 }).format(Number(value) || 0);
  const escapeHtml = (value) => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const soldLabel = (value) => value == null ? "" : value >= 1000 ? `${value >= 10000 ? Math.round(value/1000) : (value/1000).toFixed(1).replace('.0','')}K sold` : `${value} sold`;
  const discountPercent = (p) => (!p.oldPrice || p.oldPrice <= p.price) ? 0 : Math.round(((p.oldPrice-p.price)/p.oldPrice)*100);

  const toast = document.getElementById("shopToast");
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(window.rmShopToastTimer); window.rmShopToastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  };
  const updateBadge = () => {
    const qty = Array.isArray(cart) ? cart.reduce((sum,item) => sum + (Number(item.quantity)||0),0) : 0;
    document.querySelectorAll(".cart-badge").forEach((el) => el.textContent = qty);
  };
  const saveCart = () => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateBadge(); };
  const saveSaved = () => localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));

  function card(product) {
    const isSaved = saved.has(product.id);
    const discount = discountPercent(product);
    const social = product.rating != null || product.sold != null
      ? `<div class="rating-row">${product.rating != null ? `<span>★ ${escapeHtml(product.rating)}</span>` : ""}${product.sold != null ? `<small>${soldLabel(product.sold)}</small>` : ""}</div>`
      : `<div class="rating-row"><small>New at R&amp;M Trend Hub</small></div>`;
    return `<article class="product-card" data-id="${escapeHtml(product.id)}">
      <div class="product-image">
        <img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.classList.add('show');">
        <div class="image-fallback" aria-hidden="true">${escapeHtml(product.fallbackEmoji || "🛍️")}</div>
        ${discount ? `<span class="discount-badge">-${discount}%</span>` : ""}
        ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
        <button class="heart-button ${isSaved ? "saved" : ""}" type="button" data-save-id="${escapeHtml(product.id)}" aria-label="${isSaved ? "Remove" : "Save"} ${escapeHtml(product.name)}">${isSaved ? "♥" : "♡"}</button>
      </div>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.preorder ? "Pre-Order • " : "Ready Stock • ")}${escapeHtml(product.categoryLabel || product.category || "Product")}</p>
        <h4>${escapeHtml(product.name)}</h4>${social}
        <div class="price-row"><strong>${peso(product.price)}</strong>${product.oldPrice ? `<span>${peso(product.oldPrice)}</span>` : ""}</div>
        <button class="add-btn" type="button" data-add-id="${escapeHtml(product.id)}"><span>${product.preorder ? "Pre-Order" : "Add to Cart"}</span><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
    </article>`;
  }

  const grid = document.getElementById("shopProductGrid");
  const empty = document.getElementById("shopEmpty");
  const search = document.getElementById("shopSearchInput");
  const sort = document.getElementById("shopSortSelect");

  function filteredProducts() {
    const q = (search?.value || "").trim().toLowerCase();
    let list = PRODUCTS_LIST.filter((product) => {
      const matchesSearch = !q || product.name.toLowerCase().includes(q) || String(product.categoryLabel || product.category || "").toLowerCase().includes(q);
      const matchesCategory = category === "all" || product.category === category;
      const matchesStock = stock === "all" || (stock === "preorder" ? Boolean(product.preorder) : !product.preorder);
      return matchesSearch && matchesCategory && matchesStock;
    });
    switch (sort?.value) {
      case "price-low": list = [...list].sort((a,b) => Number(a.price)-Number(b.price)); break;
      case "price-high": list = [...list].sort((a,b) => Number(b.price)-Number(a.price)); break;
      case "name": list = [...list].sort((a,b) => String(a.name).localeCompare(String(b.name))); break;
    }
    return list;
  }

  function render() {
    const list = filteredProducts();
    grid.innerHTML = list.map(card).join("");
    empty.hidden = list.length !== 0;
    const count = document.getElementById("shopResultCount"); if (count) count.textContent = list.length;
    const label = document.getElementById("shopResultLabel");
    if (label) label.textContent = `${list.length} of ${PRODUCTS_LIST.length} products`;
  }

  function addToCart(id) {
    const p = PRODUCTS_LIST.find((item) => item.id === id); if (!p) return;
    if (!Array.isArray(cart)) cart = [];
    const existing = cart.find((item) => item.id === id);
    if (existing) existing.quantity = (Number(existing.quantity)||0)+1;
    else cart.push({id:p.id,name:p.name,price:Number(p.price)||0,image:p.image||"",fallbackEmoji:p.fallbackEmoji||"🛍️",preorder:Boolean(p.preorder),quantity:1});
    saveCart(); showToast(p.preorder ? `${p.name} added as a pre-order` : `${p.name} added to cart`);
  }

  grid.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-id]"); if (add) return addToCart(add.dataset.addId);
    const save = event.target.closest("[data-save-id]");
    if (save) {
      const id = save.dataset.saveId; const p = PRODUCTS_LIST.find((item) => item.id === id); if (!p) return;
      if (saved.has(id)) { saved.delete(id); showToast(`${p.name} removed from Saved`); }
      else { saved.add(id); showToast(`${p.name} saved`); }
      saveSaved(); render();
    }
  });

  search?.addEventListener("input", render);
  sort?.addEventListener("change", render);
  document.querySelectorAll("[data-shop-category]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-shop-category]").forEach((x) => x.classList.remove("active"));
    button.classList.add("active"); category = button.dataset.shopCategory; render();
  }));
  document.querySelectorAll("[data-stock-filter]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-stock-filter]").forEach((x) => x.classList.remove("active"));
    button.classList.add("active"); stock = button.dataset.stockFilter; render();
  }));
  document.querySelector("[data-shop-cart]")?.addEventListener("click", () => { window.location.href = new URL("cart/", document.baseURI).href; });

  updateBadge(); render();
})();
