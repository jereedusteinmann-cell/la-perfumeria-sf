(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Config
  // ------------------------------------------------------------------
  const WHATSAPP_NUMBER = "5493564000000"; // TODO: reemplazar por el número real del negocio (con código de país, sin +)
  const PAGE_SIZE = 24;
  const CART_STORAGE_KEY = "laperfumeria_cart_v1";

  const CATEGORY_LABELS = {
    "COMBO 100 Ml Perfumes sellados": "Combos 100 ml",
    "combos de decants": "Combos de decants",
    "Decants 5ml hombres": "Decants 5 ml · Hombre",
    "Decants 5ml mujer": "Decants 5 ml · Mujer",
    "Perfumes arabes 100 ml": "Perfumes árabes 100 ml",
    "Perfumes de Mujer diseñador y árabe 100 ml": "Perfumes Mujer 100 ml",
    "Perfumes diseñador y nicho 100 ml": "Perfumes Diseñador y Nicho",
    "Kits y sets": "Kits y sets",
  };

  const KIND_BADGES = {
    combo: "Combo",
    decant: "Decant 5 ml",
    mist: "Mist",
  };

  function deriveGender(category) {
    const c = category.toLowerCase();
    if (c.includes("hombre")) return "hombre";
    if (c.includes("mujer")) return "mujer";
    return "unisex";
  }

  function formatPrice(value) {
    return "$ " + Math.round(value).toLocaleString("es-AR");
  }

  function resolveImage(src) {
    if (/^https?:\/\//.test(src)) return src;
    return "https://la-perfumeria-catalogo.sbaim5.chatgpt.site" + src;
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const state = {
    products: [],
    category: "todas",
    gender: "todos",
    query: "",
    visibleCount: PAGE_SIZE,
    cart: loadCart(),
  };

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch {
      /* storage unavailable — cart just won't persist */
    }
  }

  // ------------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------------
  const el = {
    grid: document.getElementById("productGrid"),
    categoryList: document.getElementById("categoryList"),
    resultCount: document.getElementById("resultCount"),
    emptyState: document.getElementById("emptyState"),
    loadMore: document.getElementById("loadMore"),
    searchInput: document.getElementById("searchInput"),
    genderChips: document.querySelectorAll("[data-filter-gender]"),

    cartToggle: document.getElementById("cartToggle"),
    cartCount: document.getElementById("cartCount"),
    cartDrawer: document.getElementById("cartDrawer"),
    drawerOverlay: document.getElementById("drawerOverlay"),
    cartClose: document.getElementById("cartClose"),
    cartItems: document.getElementById("cartItems"),
    cartEmpty: document.getElementById("cartEmpty"),
    cartTotal: document.getElementById("cartTotal"),
    cartCheckout: document.getElementById("cartCheckout"),

    modalOverlay: document.getElementById("modalOverlay"),
    modalClose: document.getElementById("modalClose"),
    modalImage: document.getElementById("modalImage"),
    modalCategory: document.getElementById("modalCategory"),
    modalTitle: document.getElementById("modalTitle"),
    modalPrice: document.getElementById("modalPrice"),
    modalDescription: document.getElementById("modalDescription"),
    modalQty: document.getElementById("modalQty"),
    modalQtyMinus: document.getElementById("modalQtyMinus"),
    modalQtyPlus: document.getElementById("modalQtyPlus"),
    modalAdd: document.getElementById("modalAdd"),

    toast: document.getElementById("toast"),
    footerWhatsapp: document.getElementById("footerWhatsapp"),
  };

  let modalProduct = null;
  let modalQty = 1;
  let toastTimer = null;

  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------
  async function loadProducts() {
    const res = await fetch("data/products.json");
    const raw = await res.json();
    state.products = raw.map((p) => ({
      ...p,
      image: resolveImage(p.image),
      gender: deriveGender(p.category),
    }));
    renderCategoryList();
    renderGrid();
  }

  // ------------------------------------------------------------------
  // Rendering — category sidebar
  // ------------------------------------------------------------------
  function renderCategoryList() {
    const counts = {};
    state.products.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    const categories = Object.keys(CATEGORY_LABELS).filter((c) => counts[c]);

    const items = [
      { key: "todas", label: "Todas las categorías", count: state.products.length },
      ...categories.map((c) => ({ key: c, label: CATEGORY_LABELS[c], count: counts[c] })),
    ];

    el.categoryList.innerHTML = items
      .map(
        (item) => `
      <li>
        <button data-category="${escapeAttr(item.key)}" class="${item.key === state.category ? "is-active" : ""}">
          <span>${escapeHtml(item.label)}</span>
          <span class="count">${item.count}</span>
        </button>
      </li>`
      )
      .join("");

    el.categoryList.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.dataset.category;
        state.visibleCount = PAGE_SIZE;
        renderCategoryList();
        renderGrid();
        el.grid.closest(".catalog__results").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ------------------------------------------------------------------
  // Filtering
  // ------------------------------------------------------------------
  function getFiltered() {
    const q = state.query.trim().toLowerCase();
    return state.products.filter((p) => {
      if (state.category !== "todas" && p.category !== state.category) return false;
      if (state.gender !== "todos" && p.gender !== state.gender) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // ------------------------------------------------------------------
  // Rendering — product grid
  // ------------------------------------------------------------------
  function renderGrid() {
    const filtered = getFiltered();
    const visible = filtered.slice(0, state.visibleCount);

    el.resultCount.textContent = filtered.length
      ? `${filtered.length} producto${filtered.length === 1 ? "" : "s"}`
      : "";

    el.emptyState.hidden = filtered.length !== 0;
    el.grid.hidden = filtered.length === 0;
    el.loadMore.hidden = visible.length >= filtered.length;

    el.grid.innerHTML = visible.map(cardTemplate).join("");

    el.grid.querySelectorAll(".product-card").forEach((card) => {
      const id = card.dataset.id;
      card.querySelector(".product-card__media").addEventListener("click", () => openModal(id));
      card.querySelector(".product-card__title").addEventListener("click", () => openModal(id));
      card.querySelector(".product-card__add").addEventListener("click", (ev) => {
        ev.stopPropagation();
        addToCart(id, 1);
        pulseAdd(card.querySelector(".product-card__add"));
      });
    });
  }

  function cardTemplate(p) {
    const badge = KIND_BADGES[p.kind] || "";
    const hasDiscount = p.originalPrice && p.originalPrice > p.price;
    return `
      <article class="product-card" data-id="${escapeAttr(p.id)}">
        <div class="product-card__media" role="button" tabindex="0" aria-label="Ver ${escapeAttr(p.title)}">
          ${badge ? `<span class="product-card__badge">${badge}</span>` : ""}
          <img src="${p.image}" alt="${escapeAttr(p.title)}" loading="lazy" width="220" height="220">
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(CATEGORY_LABELS[p.category] || p.category)}</p>
          <h3 class="product-card__title">${escapeHtml(p.title)}</h3>
          <div class="product-card__footer">
            <span class="product-card__price">
              ${formatPrice(p.price)}
              ${hasDiscount ? `<small>${formatPrice(p.originalPrice)}</small>` : ""}
            </span>
            <button class="product-card__add" aria-label="Agregar ${escapeAttr(p.title)} al pedido">
              <svg viewBox="0 0 24 24"><use href="#icon-plus"/></svg>
            </button>
          </div>
        </div>
      </article>`;
  }

  function pulseAdd(button) {
    button.style.transform = "scale(0.85)";
    requestAnimationFrame(() => {
      button.style.transform = "";
    });
  }

  // ------------------------------------------------------------------
  // Product modal
  // ------------------------------------------------------------------
  function openModal(id) {
    const product = state.products.find((p) => p.id === id);
    if (!product) return;
    modalProduct = product;
    modalQty = 1;
    el.modalImage.src = product.image;
    el.modalImage.alt = product.title;
    el.modalCategory.textContent = CATEGORY_LABELS[product.category] || product.category;
    el.modalTitle.textContent = product.title;
    el.modalPrice.textContent = formatPrice(product.price);
    el.modalDescription.textContent = product.description;
    el.modalQty.textContent = modalQty;
    el.modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    el.modalOverlay.hidden = true;
    document.body.style.overflow = "";
    modalProduct = null;
  }

  el.modalClose.addEventListener("click", closeModal);
  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeCart();
    }
  });

  el.modalQtyMinus.addEventListener("click", () => {
    modalQty = Math.max(1, modalQty - 1);
    el.modalQty.textContent = modalQty;
  });
  el.modalQtyPlus.addEventListener("click", () => {
    modalQty = Math.min(20, modalQty + 1);
    el.modalQty.textContent = modalQty;
  });
  el.modalAdd.addEventListener("click", () => {
    if (!modalProduct) return;
    addToCart(modalProduct.id, modalQty);
    closeModal();
  });

  // ------------------------------------------------------------------
  // Cart
  // ------------------------------------------------------------------
  function addToCart(id, qty) {
    const existing = state.cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      state.cart.push({ id, qty });
    }
    saveCart();
    renderCart();
    showToast("Agregado al pedido");
  }

  function updateQty(id, qty) {
    const item = state.cart.find((i) => i.id === id);
    if (!item) return;
    item.qty = qty;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((i) => i.id !== id);
    }
    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((i) => i.id !== id);
    saveCart();
    renderCart();
  }

  function cartLines() {
    return state.cart
      .map((item) => {
        const product = state.products.find((p) => p.id === item.id);
        return product ? { product, qty: item.qty } : null;
      })
      .filter(Boolean);
  }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((sum, l) => sum + l.qty, 0);
    const total = lines.reduce((sum, l) => sum + l.qty * l.product.price, 0);

    el.cartCount.hidden = count === 0;
    el.cartCount.textContent = count;
    el.cartTotal.textContent = formatPrice(total);
    el.cartCheckout.disabled = lines.length === 0;
    el.cartEmpty.hidden = lines.length !== 0;

    el.cartItems.innerHTML =
      (lines.length ? "" : "") +
      lines
        .map(
          (line) => `
        <div class="cart-item" data-id="${escapeAttr(line.product.id)}">
          <div class="cart-item__media"><img src="${line.product.image}" alt="" width="64" height="64"></div>
          <div class="cart-item__info">
            <p class="cart-item__title">${escapeHtml(line.product.title)}</p>
            <p class="cart-item__price">${formatPrice(line.product.price)}</p>
            <div class="cart-item__row">
              <div class="qty-stepper">
                <button class="icon-btn" data-action="dec" aria-label="Restar unidad"><svg viewBox="0 0 24 24"><use href="#icon-minus"/></svg></button>
                <span>${line.qty}</span>
                <button class="icon-btn" data-action="inc" aria-label="Sumar unidad"><svg viewBox="0 0 24 24"><use href="#icon-plus"/></svg></button>
              </div>
              <button class="cart-item__remove" data-action="remove">Quitar</button>
            </div>
          </div>
        </div>`
        )
        .join("");

    if (!lines.length) {
      el.cartItems.prepend(el.cartEmpty);
    }

    el.cartItems.querySelectorAll(".cart-item").forEach((row) => {
      const id = row.dataset.id;
      const item = state.cart.find((i) => i.id === id);
      row.querySelector('[data-action="dec"]').addEventListener("click", () => updateQty(id, item.qty - 1));
      row.querySelector('[data-action="inc"]').addEventListener("click", () => updateQty(id, item.qty + 1));
      row.querySelector('[data-action="remove"]').addEventListener("click", () => removeFromCart(id));
    });
  }

  function openCart() {
    el.cartDrawer.hidden = false;
    el.drawerOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    el.cartDrawer.hidden = true;
    el.drawerOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  el.cartToggle.addEventListener("click", openCart);
  el.cartClose.addEventListener("click", closeCart);
  el.drawerOverlay.addEventListener("click", closeCart);

  el.cartCheckout.addEventListener("click", () => {
    const lines = cartLines();
    if (!lines.length) return;
    const total = lines.reduce((sum, l) => sum + l.qty * l.product.price, 0);
    const body = lines
      .map((l) => `• ${l.qty} x ${l.product.title} — ${formatPrice(l.product.price * l.qty)}`)
      .join("\n");
    const message = `Hola! Quiero hacer este pedido de La Perfumería:\n\n${body}\n\nTotal: ${formatPrice(total)}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  });

  // ------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------
  function showToast(text) {
    el.toast.textContent = text;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.hidden = true;
    }, 2200);
  }

  // ------------------------------------------------------------------
  // Search & gender filters
  // ------------------------------------------------------------------
  let searchDebounce;
  el.searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.query = e.target.value;
      state.visibleCount = PAGE_SIZE;
      renderGrid();
    }, 180);
  });

  el.genderChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      el.genderChips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      state.gender = chip.dataset.filterGender;
      state.visibleCount = PAGE_SIZE;
      renderGrid();
    });
  });

  el.loadMore.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderGrid();
  });

  // ------------------------------------------------------------------
  // Misc
  // ------------------------------------------------------------------
  el.footerWhatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}`;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  renderCart();
  loadProducts();
})();
