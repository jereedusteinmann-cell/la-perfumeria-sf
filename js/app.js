(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Config
  // ------------------------------------------------------------------
  const WHATSAPP_NUMBER = "5493564363921";
  const PAGE_SIZE = 24;
  const CART_STORAGE_KEY = "laperfumeria_cart_v1";

  // Muted, brand-consistent palette for accord chips — picked by hashing the
  // accord name, so the same accord always lands on the same color.
  const ACCORD_PALETTE = [
    "#e4c1ae", "#c9cba3", "#e8d8a6", "#b9a6c9",
    "#a9c7c0", "#d8a48f", "#b7b7a4", "#d9bf77",
  ];
  function accordColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return ACCORD_PALETTE[hash % ACCORD_PALETTE.length];
  }

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

  // Ordered most-specific-first so e.g. "Emporio Armani" wins over the
  // generic "Armani", and abbreviations map back to a readable brand name.
  const BRANDS = [
    { name: "Jean Paul Gaultier", tokens: ["jean paul gaultier", "jpg"] },
    { name: "Yves Saint Laurent", tokens: ["yves saint laurent", "ysl"] },
    { name: "Giorgio Armani", tokens: ["giorgio armani"] },
    { name: "Emporio Armani", tokens: ["emporio armani"] },
    { name: "Armani", tokens: ["armani"] },
    { name: "Dolce & Gabbana", tokens: ["dolce gabbana", "dolce & gabbana", "d&g"] },
    { name: "Maison Francis Kurkdjian", tokens: ["maison francis kurkdjian", "mfk"] },
    { name: "Parfums de Marly", tokens: ["parfums de marly"] },
    { name: "Carolina Herrera", tokens: ["carolina herrera"] },
    { name: "Paco Rabanne", tokens: ["paco rabanne"] },
    { name: "Tom Ford", tokens: ["tom ford"] },
    { name: "Xerjoff", tokens: ["xerjoff"] },
    { name: "Montale", tokens: ["montale"] },
    { name: "Mancera", tokens: ["mancera"] },
    { name: "Creed", tokens: ["creed"] },
    { name: "Chanel", tokens: ["chanel"] },
    { name: "Dior", tokens: ["dior"] },
    { name: "Versace", tokens: ["versace"] },
    { name: "Valentino", tokens: ["valentino"] },
    { name: "Prada", tokens: ["prada"] },
    { name: "Gucci", tokens: ["gucci"] },
    { name: "Burberry", tokens: ["burberry"] },
    { name: "Bvlgari", tokens: ["bvlgari", "bulgari"] },
    { name: "Givenchy", tokens: ["givenchy"] },
    { name: "Azzaro", tokens: ["azzaro"] },
    { name: "Ralph Lauren", tokens: ["ralph lauren", "polo "] },
    { name: "Issey Miyake", tokens: ["issey miyake"] },
    { name: "Amouage", tokens: ["amouage"] },
    { name: "Nishane", tokens: ["nishane"] },
    { name: "Kilian", tokens: ["kilian"] },
    { name: "Moschino", tokens: ["moschino"] },
    { name: "Lancôme", tokens: ["lancome", "lancôme"] },
    { name: "Hugo Boss", tokens: ["hugo boss"] },
    { name: "Nautica", tokens: ["nautica"] },
    { name: "Lattafa", tokens: ["lattafa"] },
    { name: "Armaf", tokens: ["armaf"] },
    { name: "Afnan", tokens: ["afnan"] },
    { name: "Rasasi", tokens: ["rasasi"] },
    { name: "Al Haramain", tokens: ["al haramain"] },
  ];

  function deriveGender(category, fragranceGender) {
    if (fragranceGender) return fragranceGender.toLowerCase();
    const c = category.toLowerCase();
    if (c.includes("hombre")) return "hombre";
    if (c.includes("mujer")) return "mujer";
    return "unisex";
  }

  function deriveBrand(title) {
    const t = title.toLowerCase();
    const match = BRANDS.find((b) => b.tokens.some((token) => t.includes(token)));
    return match ? match.name : null;
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
    brand: "todas",
    sort: "relevancia",
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
    brandFilter: document.getElementById("brandFilter"),
    sortSelect: document.getElementById("sortSelect"),

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
    modalFragrance: document.getElementById("modalFragrance"),
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
    const [productsRes, profilesRes] = await Promise.all([
      fetch("data/products.json"),
      fetch("data/fragrance-profiles.json"),
    ]);
    const raw = await productsRes.json();
    const profiles = await profilesRes.json();
    state.products = raw.map((p) => {
      const fragrance = profiles[p.id] || null;
      return {
        ...p,
        image: resolveImage(p.image),
        gender: deriveGender(p.category, fragrance && fragrance.gender),
        brand: deriveBrand(p.title),
        fragrance,
      };
    });
    renderCategoryList();
    renderBrandOptions();
    renderGrid();
  }

  function renderBrandOptions() {
    const counts = {};
    state.products.forEach((p) => {
      if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
    });
    const brands = Object.keys(counts).sort((a, b) => a.localeCompare(b, "es"));
    el.brandFilter.innerHTML =
      `<option value="todas">Todas las marcas</option>` +
      brands.map((b) => `<option value="${escapeAttr(b)}">${escapeHtml(b)} (${counts[b]})</option>`).join("");
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
    const list = state.products.filter((p) => {
      if (state.category !== "todas" && p.category !== state.category) return false;
      if (state.gender !== "todos" && p.gender !== state.gender) return false;
      if (state.brand !== "todas" && p.brand !== state.brand) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      return true;
    });

    switch (state.sort) {
      case "precio-asc":
        return list.sort((a, b) => a.price - b.price);
      case "precio-desc":
        return list.sort((a, b) => b.price - a.price);
      case "nombre-asc":
        return list.sort((a, b) => a.title.localeCompare(b.title, "es"));
      default:
        return list;
    }
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

  }

  // Event delegation: one listener handles all cards, including ones added
  // later by "Ver más productos" — cheaper than binding per card render.
  el.grid.addEventListener("click", (ev) => {
    const addBtn = ev.target.closest(".product-card__add");
    const card = ev.target.closest(".product-card");
    if (!card) return;
    const id = card.dataset.id;
    if (addBtn) {
      addToCart(id, 1);
      bumpCartIcon();
      return;
    }
    openModal(id);
  });

  function accordChipsTemplate(fragrance, limit) {
    if (!fragrance || !fragrance.accords || !fragrance.accords.length) return "";
    const accords = limit ? fragrance.accords.slice(0, limit) : fragrance.accords;
    return `
      <ul class="accord-list">
        ${accords
          .map(
            (a) =>
              `<li class="accord-chip" style="background:${accordColor(a)}">${escapeHtml(a)}</li>`
          )
          .join("")}
      </ul>`;
  }

  function cardTemplate(p) {
    const badge = KIND_BADGES[p.kind] || "";
    const hasDiscount = p.originalPrice && p.originalPrice > p.price;
    return `
      <article class="product-card" data-id="${escapeAttr(p.id)}">
        <div class="product-card__media">
          ${badge ? `<span class="product-card__badge">${badge}</span>` : ""}
          <img src="${p.image}" alt="${escapeAttr(p.title)}" loading="lazy" width="220" height="220">
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(CATEGORY_LABELS[p.category] || p.category)}</p>
          <button type="button" class="product-card__title">${escapeHtml(p.title)}</button>
          ${accordChipsTemplate(p.fragrance, 2)}
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

  // ------------------------------------------------------------------
  // Product modal
  // ------------------------------------------------------------------
  // Shared open/close for the modal and cart drawer: un-hide, then add the
  // class that drives the CSS transition on the next frame (so the browser
  // registers the initial state first); on close, remove the class and wait
  // for the transition to finish before re-hiding.
  function revealOverlay(overlayEl) {
    overlayEl.hidden = false;
    // Double rAF: guarantees the browser has painted the closed state at
    // least once before the class flips, so the transition actually plays
    // (a single rAF can still land before that first paint in some engines).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlayEl.classList.add("is-open"));
    });
  }

  function dismissOverlay(overlayEl) {
    overlayEl.classList.remove("is-open");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlayEl.hidden = true;
    };
    overlayEl.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 400); // safety net if transitionend doesn't fire
  }

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
    renderModalFragrance(product.fragrance);
    el.modalQty.textContent = modalQty;
    revealOverlay(el.modalOverlay);
    document.body.style.overflow = "hidden";
  }

  function renderModalFragrance(fragrance) {
    if (!fragrance || !fragrance.accords || !fragrance.accords.length) {
      el.modalFragrance.hidden = true;
      el.modalFragrance.innerHTML = "";
      return;
    }
    el.modalFragrance.hidden = false;
    el.modalFragrance.innerHTML = `
      <p class="modal__fragrance-label">Acordes principales</p>
      ${accordChipsTemplate(fragrance)}
      ${fragrance.notes ? `<p class="modal__fragrance-notes">${escapeHtml(fragrance.notes)}</p>` : ""}
      ${
        fragrance.source
          ? `<a class="modal__fragrance-source" href="${escapeAttr(fragrance.source)}" target="_blank" rel="noopener">Fuente del perfil aromático<svg viewBox="0 0 24 24"><use href="#icon-chevron"/></svg></a>`
          : ""
      }
    `;
  }

  function closeModal() {
    dismissOverlay(el.modalOverlay);
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
    bumpCartIcon();
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
    revealOverlay(el.cartDrawer);
    revealOverlay(el.drawerOverlay);
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    dismissOverlay(el.cartDrawer);
    dismissOverlay(el.drawerOverlay);
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
    el.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("is-visible");
    }, 2200);
  }

  function bumpCartIcon() {
    el.cartToggle.classList.remove("is-bumping");
    // Force reflow so the class can be re-added and replay the transition
    // even when items are added again before the previous bump settles.
    void el.cartToggle.offsetWidth;
    el.cartToggle.classList.add("is-bumping");
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

  el.brandFilter.addEventListener("change", () => {
    state.brand = el.brandFilter.value;
    state.visibleCount = PAGE_SIZE;
    renderGrid();
  });

  el.sortSelect.addEventListener("change", () => {
    state.sort = el.sortSelect.value;
    state.visibleCount = PAGE_SIZE;
    renderGrid();
  });

  el.loadMore.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderGrid();
  });

  // ------------------------------------------------------------------
  // Misc
  // ------------------------------------------------------------------
  el.footerWhatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}`;

  const siteHeader = document.querySelector(".site-header");
  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        siteHeader.classList.toggle("is-scrolled", window.scrollY > 8);
        scrollTicking = false;
      });
    },
    { passive: true }
  );

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
