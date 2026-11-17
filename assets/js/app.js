import {
  computeVariantPricing,
  filterCatalogPageItems,
  filterFurnitureItems,
  formatCustomerProductDisplay,
  formatSimplifiedProductCardData,
  getColorFilterCounts,
  getProductStockStatus,
  getRecommendedBestSellers,
  resolveCustomerAvatarState,
  validateAndBuildOfferProposal,
  validateVoucherForOrder,
} from './store.js';

const API_ENDPOINT = window.location.pathname.includes('/src/') ? 'api.php' : 'src/api.php';
const FRIENDLY_CUSTOMER_STEPS = ['Order Confirmed', 'In Workshop Production', 'Quality Check', 'Ready / Delivered'];

const HERO_TAB_COPY = {
  flagship: {
    eyebrow: 'Lillia and Rowena Furniture · Handcrafted Collection',
    headline: 'Handcrafted Solid Wood & Custom Furniture for Every Room.',
    description:
      'Explore solid American black walnut tables, Belgian bouclé sofas, and honed Roman travertine pieces—or request a custom furniture design tailored to your space.',
    price: '$1,180',
    ctaText: 'Shop Living Room',
    ctaCategory: 'living',
    cardTitle: 'Living Room Collection',
    image: 'assets/images/hero_living_room_atelier.jpg',
  },
  living: {
    eyebrow: 'Living Room Collection · Tailored Bouclé & Travertine',
    headline: 'Sculpted Lounge Seating & Architectural Plinth Tables.',
    description:
      'Low-slung Belgian bouclé sectionals, kiln-dried white oak lounge chairs, and monolithic travertine coffee tables.',
    price: '$1,680',
    ctaText: 'Explore Living Room',
    ctaCategory: 'living',
    cardTitle: 'Living Room Sanctuary',
    image: 'assets/images/category_living_lounge.jpg',
  },
  dining: {
    eyebrow: 'Dining Room Collection · Solid American Black Walnut',
    headline: 'Monolithic Timber Dining Tables Built for Generations.',
    description:
      'Book-matched solid walnut slabs with hand-cut butterfly joinery and Danish paper-cord dining chairs.',
    price: '$1,290',
    ctaText: 'Explore Dining Room',
    ctaCategory: 'dining',
    cardTitle: 'Dining Room Atelier',
    image: 'assets/images/category_dining_tables.jpg',
  },
  bedroom: {
    eyebrow: 'Bedroom Sanctuary · Belgian Linen & Solid Ash',
    headline: 'Restful Architectural Beds & Cantilevered Nightstands.',
    description:
      'Upholstered platform beds in raw Belgian linen paired with floating solid timber bedside tables.',
    price: '$1,180',
    ctaText: 'Explore Bedroom',
    ctaCategory: 'bedroom',
    cardTitle: 'Bedroom Collection',
    image: 'assets/images/category_bedroom_sanctuary.jpg',
  },
  office: {
    eyebrow: 'Study & Work Desks · Executive Millwork',
    headline: 'Precision Architect Desks & Fluted Credenzas.',
    description:
      'Concealed cable management, solid walnut work surfaces, and acoustic tambour storage cabinets.',
    price: '$2,150',
    ctaText: 'Explore Study Desks',
    ctaCategory: 'office',
    cardTitle: 'Study & Work Desks',
    image: 'assets/images/category_office_storage.jpg',
  },
};

const state = {
  categories: [
    { id: 'living', name: 'Living Room', tagline: 'Sofas, Lounge Chairs & Coffee Tables', image: 'assets/images/category_living_lounge.jpg' },
    { id: 'dining', name: 'Dining Room', tagline: 'Solid Timber Dining Tables & Seating', image: 'assets/images/category_dining_tables.jpg' },
    { id: 'bedroom', name: 'Bedroom', tagline: 'Platform Beds, Nightstands & Dressers', image: 'assets/images/category_bedroom_sanctuary.jpg' },
    { id: 'office', name: 'Study/Work Desks', tagline: 'Architectural Desks & Bookcases', image: 'assets/images/category_office_storage.jpg' },
    { id: 'kitchen', name: 'Kitchen', tagline: 'Islands, Counter Stools & Sideboards', image: 'assets/images/category_kitchen_atelier.jpg' },
  ],
  catalog: [],
  materials: [],
  orders: [],
  vouchers: [],
  customers: [],
  messengerConversations: [],
  inventoryTransactions: [],
  customerProfile: {
    name: 'Rowena Vance',
    email: 'rowena.vance@vancearchitects.com',
    phone: '+1 (212) 555-0184',
    city: 'New York, NY 10013',
    address: 'Suite 400, 118 Mercer St, SoHo',
    notes: 'White-glove freight elevator access on Greene St.',
    avatar: '',
  },
  activeCategory: 'all',
  catalogShowAll: false,
  searchQuery: '',
  catalogPageCategory: 'all',
  catalogPageSearch: '',
  catalogPageMaxPrice: 5500,
  catalogPageColor: '',
  catalogPageStock: 'all',
  catalogPageSort: 'featured',
  selectedColorByProduct: {},
  cartItems: [],
  appliedVoucher: null,
  activeClientTab: 'home',
  clientCustomOrderOpen: false,
  clientCustomOrderInput: {
    productId: 'prod-dining-table',
    materialId: 'mat-walnut-slab',
    lengthCm: '260',
    widthCm: '105',
    heightCm: '76',
    colorFinish: 'Hand-Rubbed Tung Oil',
    notes: '',
  },
  activeAdminTab: 'overview',
  adminProductSearch: '',
  adminProductCategory: 'all',
  adminProductStockFilter: 'all',
  adminProductTypeFilter: 'all',
  adminProductPage: 1,
  adminInventoryStockSearch: '',
  adminInventoryCategoryFilter: 'all',
  adminInventoryStockFilter: 'all',
  adminInventoryPage: 1,
  adminInventoryPageSize: 5,
  adminOrderSearch: '',
  adminOrderStage: 'all',
  adminCustomerSearch: '',
  adminAnalyticsPreset: 'this_month',
  adminAnalyticsYear: '',
  adminAnalyticsMonth: '',
  adminAnalyticsStartDate: '',
  adminAnalyticsEndDate: '',
  sessionUser: null,
};

const esc = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const usd = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(amount) || 0
  );

function cloneTemplate(templateId) {
  const tpl = document.getElementById(templateId);
  return tpl && tpl.content && tpl.content.firstElementChild
    ? tpl.content.firstElementChild.cloneNode(true)
    : null;
}

function setRoleText(root, role, text) {
  const el = root?.querySelector(`[data-role="${role}"]`);
  if (el) el.textContent = text;
  return el;
}

function syncCustomerAvatarDOM(profileLike) {
  const avatarState = resolveCustomerAvatarState(profileLike || state.customerProfile);
  [
    ['nav-profile-avatar-img', 'nav-profile-default-icon'],
    ['portal-header-avatar-img', 'portal-header-default-icon'],
    ['client-sidebar-avatar-img', 'client-sidebar-initials'],
    ['client-welcome-avatar-img', 'client-welcome-avatar-initials'],
    ['client-profile-avatar-preview', 'client-profile-avatar-initials'],
  ].forEach(([imgId, fallbackId]) => {
    const imgEl = document.getElementById(imgId);
    const fallbackEl = document.getElementById(fallbackId);
    if (imgEl) {
      if (avatarState.hasAvatar) {
        imgEl.src = avatarState.avatarSrc;
        imgEl.classList.remove('hidden');
      } else {
        imgEl.removeAttribute('src');
        imgEl.classList.add('hidden');
      }
    }
    if (fallbackEl) {
      if (fallbackEl.tagName !== 'svg') fallbackEl.textContent = avatarState.initials;
      fallbackEl.classList.toggle('hidden', avatarState.hasAvatar);
    }
  });
  const clearBtn = document.getElementById('client-profile-avatar-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('hidden', !avatarState.hasAvatar);
  const hiddenInput = document.getElementById('client-input-avatar');
  if (hiddenInput) hiddenInput.value = avatarState.hasAvatar ? avatarState.avatarSrc : '';
}

function bindLiveSearchInput(inputId, stateProp, onUpdate) {
  const el = document.getElementById(inputId);
  if (!el || el.dataset.boundLiveSearch === 'true') return;
  el.dataset.boundLiveSearch = 'true';
  el.addEventListener('input', (e) => {
    state[stateProp] = e.target.value;
    onUpdate();
  });
}

async function syncDatabaseStore(action = 'sync_store', extraPayload = {}) {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action,
        products: state.catalog,
        catalog: state.catalog,
        materials: state.materials,
        orders: state.orders,
        vouchers: state.vouchers,
        customers: state.customers,
        customerProfile: state.customerProfile,
        inventoryTransactions: state.inventoryTransactions,
        cartItems: state.cartItems,
        sessionUser: state.sessionUser,
        ...extraPayload,
      }),
    });
    if (res.ok) return await res.json();
  } catch (_e) {
    // Fallback to local state when offline
  }
  return null;
}

const persistProductToStorage = (product) => syncDatabaseStore('save_product', { product });
const saveMaterialsToStorage = () => syncDatabaseStore('sync_store');
const saveOrdersToStorage = () => syncDatabaseStore('sync_store');
const saveInventoryTransactionsToStorage = () => syncDatabaseStore('sync_store');
const saveCartToStorage = () => syncDatabaseStore('save_cart', { cartItems: state.cartItems });
const saveCustomerProfileToStorage = () =>
  syncDatabaseStore('update_customer_profile', { customerProfile: state.customerProfile, customers: state.customers });
const saveSessionUserToServer = (user) => {
  state.sessionUser = user || null;
  syncDatabaseStore('save_session', { sessionUser: state.sessionUser });
};

async function loadAllPersistentDataFromServer() {
  try {
    const res = await fetch(`${API_ENDPOINT}?t=${Date.now()}`, { credentials: 'same-origin' });
    if (!res.ok) return;
    const d = await res.json();
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d.categories) && d.categories.length > 0) state.categories = d.categories;
    const serverCatalog = Array.isArray(d.products) ? d.products : Array.isArray(d.catalog) ? d.catalog : [];
    if (serverCatalog.length > 0) state.catalog = serverCatalog;
    if (Array.isArray(d.materials) && d.materials.length > 0) state.materials = d.materials;
    if (Array.isArray(d.orders) && d.orders.length > 0) state.orders = d.orders;
    if (Array.isArray(d.vouchers) && d.vouchers.length > 0) state.vouchers = d.vouchers;
    if (Array.isArray(d.customers) && d.customers.length > 0) state.customers = d.customers;
    if (Array.isArray(d.messengerConversations) && d.messengerConversations.length > 0)
      state.messengerConversations = d.messengerConversations;
    if (Array.isArray(d.inventoryTransactions) && d.inventoryTransactions.length > 0)
      state.inventoryTransactions = d.inventoryTransactions;
    if (d.customerProfile && typeof d.customerProfile === 'object')
      state.customerProfile = { ...state.customerProfile, ...d.customerProfile };
    if (Array.isArray(d.cartItems)) {
      state.cartItems = d.cartItems
        .map((entry) => {
          const matched = state.catalog.find((p) => p.id === (entry.product?.id || entry.productId));
          const prod = matched || entry.product;
          return prod && prod.id
            ? { product: prod, finish: entry.finish || prod.defaultFinish || 'Natural Finish', quantity: Math.max(1, Number(entry.quantity) || 1) }
            : null;
        })
        .filter(Boolean);
    }
    if (d.sessionUser !== undefined) state.sessionUser = d.sessionUser;
  } catch (_e) {
    // Keep seeded defaults
  }
}

function showShopToast(message, isError = false) {
  let toast = document.getElementById('shop-live-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shop-live-toast';
    document.body.appendChild(toast);
  }
  toast.className = `fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all ${
    isError ? 'bg-rose-950 text-rose-100 border-rose-700' : 'bg-[#0D1015] text-white border-slate-700'
  }`;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window.__shopToastTimer);
  window.__shopToastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function addItemToCart(productId, selectedFinishOverride) {
  const product = state.catalog.find((p) => p.id === productId);
  if (!product) return false;
  const availableStock = Math.max(0, Math.floor(Number(product.inStockCount ?? 0)));
  if (availableStock <= 0) {
    showShopToast(`"${product.name}" is currently Out of Stock.`, true);
    return false;
  }
  const currentQty = state.cartItems.filter((c) => c.product.id === product.id).reduce((s, c) => s + c.quantity, 0);
  if (currentQty >= availableStock) {
    showShopToast(`Only ${availableStock} units of "${product.name}" are available in stock.`, true);
    return false;
  }
  const finish =
    selectedFinishOverride ||
    state.selectedColorByProduct[product.id] ||
    product.colorVariants?.[0]?.name ||
    product.defaultFinish ||
    'Natural Finish';
  const existing = state.cartItems.find((c) => c.product.id === product.id && c.finish === finish);
  if (existing) existing.quantity += 1;
  else state.cartItems.push({ product, finish, quantity: 1 });
  saveCartToStorage();
  renderCartState();
  showShopToast(`Added "${product.name}" (${finish}) to your Cart.`);
  return true;
}

function syncBodyScrollLock() {
  const anyOpen = ['product-detail-modal', 'make-offer-modal', 'cart-drawer'].some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
  document.body.classList.toggle('overflow-hidden', anyOpen);
}

function renderCartState() {
  const badge = document.getElementById('cart-count-badge');
  const itemsEl = document.getElementById('cart-items-list') || document.getElementById('cart-drawer-items');
  const subtotalEl = document.getElementById('cart-subtotal') || document.getElementById('cart-drawer-subtotal');
  const deliveryEl = document.getElementById('cart-delivery');
  const totalEl = document.getElementById('cart-total');
  const voucherSec = document.getElementById('cart-voucher-section');
  const footerTotals = document.getElementById('cart-footer-totals');
  const checkoutLink = document.getElementById('cart-checkout-link');
  const totalCount = state.cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (badge) {
    badge.textContent = String(totalCount);
    badge.classList.toggle('hidden', totalCount === 0);
    badge.classList.toggle('inline-flex', totalCount > 0);
  }
  if (!itemsEl) return;

  if (state.cartItems.length === 0) {
    const emptyWrap = document.createElement('div');
    emptyWrap.className = 'py-12 text-center space-y-2';
    const title = document.createElement('p');
    title.className = 'font-serif-display text-base font-bold text-[#0D1015]';
    title.textContent = 'Your Cart is Empty';
    const sub = document.createElement('p');
    sub.className = 'text-xs text-slate-500 max-w-xs mx-auto';
    sub.textContent = 'Select any handcrafted piece from our showroom catalog to add it to your cart.';
    emptyWrap.append(title, sub);
    itemsEl.replaceChildren(emptyWrap);
    if (subtotalEl) subtotalEl.textContent = '$0';
    if (voucherSec) voucherSec.classList.add('hidden');
    if (footerTotals) footerTotals.classList.add('hidden');
    return;
  }

  if (voucherSec) voucherSec.classList.remove('hidden');
  if (footerTotals) footerTotals.classList.remove('hidden');

  let subtotal = 0;
  const nodes = state.cartItems.map((entry, idx) => {
    const p = entry.product;
    const pricing = computeVariantPricing(p, entry.finish);
    const lineTotal = pricing.effectivePrice * entry.quantity;
    subtotal += lineTotal;
    const imgUrl = String(p.image || 'assets/images/category_living_lounge.jpg').replace(/^\//, '');
    const node = cloneTemplate('tpl-cart-drawer-item');
    if (!node) return document.createElement('div');
    const img = node.querySelector('[data-role="item-img"]');
    if (img) {
      img.src = imgUrl;
      img.alt = p.name;
    }
    setRoleText(node, 'item-name', p.name);
    setRoleText(node, 'item-meta', `${entry.finish} · ${usd(pricing.effectivePrice)}`);
    setRoleText(node, 'item-qty', String(entry.quantity));
    setRoleText(node, 'item-total', usd(lineTotal));

    const adjustQty = (delta) => {
      const current = state.cartItems[idx];
      if (!current) return;
      const maxStock = Math.max(0, Math.floor(Number(current.product.inStockCount ?? 0)));
      const currentQty = state.cartItems.filter((c) => c.product.id === current.product.id).reduce((s, c) => s + c.quantity, 0);
      if (delta > 0 && currentQty >= maxStock) {
        showShopToast(`Only ${maxStock} available in stock.`, true);
        return;
      }
      current.quantity += delta;
      if (current.quantity <= 0) state.cartItems.splice(idx, 1);
      saveCartToStorage();
      renderCartState();
    };
    node.querySelector('[data-role="item-dec"]')?.addEventListener('click', () => adjustQty(-1));
    node.querySelector('[data-role="item-inc"]')?.addEventListener('click', () => adjustQty(1));
    node.querySelector('[data-role="item-remove"]')?.addEventListener('click', () => {
      state.cartItems.splice(idx, 1);
      saveCartToStorage();
      renderCartState();
    });
    return node;
  });

  itemsEl.replaceChildren(...nodes);
  const deliveryFee = subtotal > 0 ? 150 : 0;
  const discountAmt = state.appliedVoucher ? Number(state.appliedVoucher.discountAmount || 0) : 0;
  if (subtotalEl) subtotalEl.textContent = usd(subtotal);
  if (deliveryEl) deliveryEl.textContent = usd(deliveryFee);
  if (totalEl) totalEl.textContent = usd(Math.max(0, subtotal - discountAmt) + deliveryFee);
  const voucherRow = document.getElementById('cart-voucher-row');
  const voucherDiscEl = document.getElementById('cart-voucher-discount');
  if (voucherRow) {
    voucherRow.classList.toggle('hidden', discountAmt <= 0);
    voucherRow.classList.toggle('flex', discountAmt > 0);
  }
  if (voucherDiscEl) voucherDiscEl.textContent = `-${usd(discountAmt)}`;
  if (checkoutLink) {
    checkoutLink.href = state.sessionUser ? 'dashboard.html?role=client&tab=cart' : 'login.html';
    checkoutLink.textContent = state.sessionUser ? 'Proceed to Checkout →' : 'Sign In to Checkout →';
  }
}

function initCartDrawer() {
  const openBtn = document.getElementById('open-cart-btn');
  const closeBtn = document.getElementById('close-cart-btn');
  const drawer = document.getElementById('cart-drawer');
  const setOpen = (open) => {
    if (!drawer) return;
    drawer.classList.toggle('hidden', !open);
    drawer.classList.toggle('flex', open);
    syncBodyScrollLock();
  };
  openBtn?.addEventListener('click', () => setOpen(true));
  closeBtn?.addEventListener('click', () => setOpen(false));
  drawer?.addEventListener('click', (e) => {
    if (e.target === drawer) setOpen(false);
  });

  document.getElementById('apply-voucher-btn')?.addEventListener('click', () => {
    const code = document.getElementById('voucher-code-input')?.value.trim().toUpperCase() || '';
    const email = state.sessionUser?.email || state.customerProfile.email || '';
    const feedback = document.getElementById('voucher-feedback');
    const res = validateVoucherForOrder(state.vouchers, code, email, state.cartItems, state.catalog);
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.textContent = res.valid ? `✓ Voucher ${res.voucher.code} applied (-${usd(res.discountAmount)})` : `✕ ${res.errorMessage}`;
      feedback.className = `text-xs font-medium ${res.valid ? 'text-emerald-700' : 'text-rose-600'}`;
    }
    state.appliedVoucher = res.valid ? res.voucher : null;
    renderCartState();
  });
}

function syncRoleNavigationUI() {
  const guestEl = document.getElementById('nav-guest-actions');
  const userEl = document.getElementById('nav-customer-actions') || document.getElementById('nav-user-actions');
  const adminEl = document.getElementById('nav-admin-actions');
  const footerGuest = document.getElementById('footer-guest-links');
  const footerCustomer = document.getElementById('footer-customer-links');
  const footerAdmin = document.getElementById('footer-admin-links');

  const user = state.sessionUser;
  const isAdmin = user && user.role === 'admin';
  const isClient = user && user.role !== 'admin';

  if (guestEl) guestEl.classList.toggle('hidden', Boolean(user));
  if (userEl) {
    userEl.classList.toggle('hidden', !isClient);
    userEl.classList.toggle('flex', Boolean(isClient));
  }
  if (adminEl) {
    adminEl.classList.toggle('hidden', !isAdmin);
    adminEl.classList.toggle('flex', Boolean(isAdmin));
  }
  if (footerGuest) footerGuest.classList.toggle('hidden', Boolean(user));
  if (footerCustomer) footerCustomer.classList.toggle('hidden', !isClient);
  if (footerAdmin) footerAdmin.classList.toggle('hidden', !isAdmin);

  syncCustomerAvatarDOM({
    ...state.customerProfile,
    name: user?.name || state.customerProfile.name,
    email: user?.email || state.customerProfile.email,
    avatar: user?.avatar || state.customerProfile.avatar,
  });

  const handleLogout = (e) => {
    e.preventDefault();
    saveSessionUserToServer(null);
    state.cartItems = [];
    renderCartState();
    syncRoleNavigationUI();
  };
  ['nav-logout-btn', 'nav-admin-logout-btn', 'footer-logout-btn', 'footer-admin-logout-btn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', handleLogout);
    }
  });
}

function bindRequestDesignTriggers() {
  document.querySelectorAll('[data-request-design-trigger]').forEach((btn) => {
    if (btn.dataset.boundTrigger === 'true') return;
    btn.dataset.boundTrigger = 'true';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const firstProd = state.catalog[0];
      if (firstProd && document.getElementById('make-offer-modal')) {
        openMakeOfferModal(firstProd.id);
      } else {
        window.location.href = `catalog.html?offer=${encodeURIComponent(firstProd?.id || 'prod-dining-table')}`;
      }
    });
  });
}

let activeModalProductId = null;
let activeOfferProductId = null;
let activeOfferRefDataUrl = null;
let activeOfferRefName = '';
let latestGeneratedProposal = null;

function openProductDetailModal(productId) {
  const product = state.catalog.find((p) => p.id === productId);
  const modal = document.getElementById('product-detail-modal');
  if (!product || !modal) return;

  activeModalProductId = product.id;
  const selectedFinish =
    state.selectedColorByProduct[product.id] || product.colorVariants?.[0]?.name || product.defaultFinish;
  const display = formatCustomerProductDisplay(product, selectedFinish);
  const stockInfo = getProductStockStatus(product);

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  const imgEl = document.getElementById('detail-modal-image');
  if (imgEl) {
    imgEl.src = display.image.replace(/^\//, '');
    imgEl.alt = display.name;
  }

  setTxt('detail-modal-category', display.categoryName);
  setTxt('detail-modal-sku', display.sku);
  setTxt('detail-modal-title', display.name);
  setTxt('detail-modal-price', usd(display.effectivePrice));
  setTxt('detail-modal-description', display.description);
  setTxt('detail-modal-dimensions', display.dimensions);
  setTxt('detail-modal-leadtime', display.leadTime);
  setTxt('detail-modal-selected-finish', display.selectedFinish);

  const origEl = document.getElementById('detail-modal-original-price');
  const discBadge = document.getElementById('detail-modal-discount-badge');
  if (origEl) {
    origEl.textContent = display.originalPrice ? usd(display.originalPrice) : '';
    origEl.classList.toggle('hidden', !display.hasDiscount);
  }
  if (discBadge) {
    discBadge.textContent = display.hasDiscount ? `Save ${display.discountPercent}%` : '';
    discBadge.classList.toggle('hidden', !display.hasDiscount);
  }

  const stockBadge = document.getElementById('detail-modal-stock-badge');
  if (stockBadge) {
    stockBadge.textContent =
      stockInfo.statusKey === 'out_of_stock'
        ? 'Out of Stock'
        : `${stockInfo.availableStock} in stock · ${stockInfo.label}`;
  }

  const finishesEl = document.getElementById('detail-modal-finishes');
  if (finishesEl) {
    const swatchNodes = (display.colorVariants || []).map((v) => {
      const btn = cloneTemplate('tpl-finish-swatch');
      if (!btn) return document.createElement('span');
      const active = v.name === display.selectedFinish;
      btn.className = `px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
        active ? 'border-[#0095FF] bg-[#EBF6FF] text-[#0077CC]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`;
      const dot = btn.querySelector('[data-role="swatch-dot"]');
      if (dot) dot.style.backgroundColor = v.hex || '#5C3A21';
      setRoleText(btn, 'swatch-name', v.name);
      const deltaEl = btn.querySelector('[data-role="swatch-delta"]');
      if (deltaEl) {
        const hasDelta = Number(v.priceDelta) > 0;
        deltaEl.textContent = hasDelta ? `+${usd(v.priceDelta)}` : '';
        deltaEl.classList.toggle('hidden', !hasDelta);
      }
      btn.addEventListener('click', () => {
        state.selectedColorByProduct[product.id] = v.name;
        openProductDetailModal(product.id);
      });
      return btn;
    });
    finishesEl.replaceChildren(...swatchNodes);
  }

  const addBtn = document.getElementById('detail-modal-add-to-cart-btn');
  if (addBtn) {
    addBtn.disabled = stockInfo.statusKey === 'out_of_stock';
    addBtn.textContent = stockInfo.statusKey === 'out_of_stock' ? 'Out of Stock' : `Add to Cart — ${usd(display.effectivePrice)}`;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  syncBodyScrollLock();
}

function closeProductDetailModal() {
  const modal = document.getElementById('product-detail-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  syncBodyScrollLock();
}

function initProductDetailModal() {
  const modal = document.getElementById('product-detail-modal');
  if (!modal || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';

  document.getElementById('close-product-modal-btn')?.addEventListener('click', closeProductDetailModal);
  document.getElementById('close-detail-modal-btn')?.addEventListener('click', closeProductDetailModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeProductDetailModal();
  });
  document.getElementById('detail-modal-add-to-cart-btn')?.addEventListener('click', () => {
    if (activeModalProductId && addItemToCart(activeModalProductId)) closeProductDetailModal();
  });
  document.getElementById('detail-modal-make-offer-btn')?.addEventListener('click', () => {
    const pid = activeModalProductId;
    closeProductDetailModal();
    if (pid) openMakeOfferModal(pid);
  });
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let currentY = y;
  let linesDrawn = 0;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      linesDrawn += 1;
      if (linesDrawn >= maxLines) {
        ctx.fillText(`${line.slice(0, Math.max(0, line.length - 3))}...`, x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderOfferProposalCanvas(proposal) {
  const canvas = document.getElementById('offer-proposal-canvas');
  const previewImg = document.getElementById('offer-proposal-preview-img');
  if (!canvas || !proposal) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(20, 20, W - 40, H - 40, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0D1015';
  ctx.beginPath();
  ctx.roundRect(20, 20, W - 40, 88, [20, 20, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#0095FF';
  ctx.beginPath();
  ctx.roundRect(48, 42, 44, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Outfit, sans-serif';
  ctx.fillText('LR', 60, 71);
  ctx.font = 'bold 21px Outfit, sans-serif';
  ctx.fillText('Lillia and Rowena Furniture', 108, 62);
  ctx.fillStyle = '#BCE3FF';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CUSTOMER PRODUCT OFFER & CUSTOMIZATION PROPOSAL', 108, 83);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0095FF';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(proposal.proposalCode, W - 48, 62);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Date: ${proposal.createdDate}`, W - 48, 83);
  ctx.textAlign = 'left';

  const normalizedSrc =
    proposal.productImage.startsWith('data:') || proposal.productImage.startsWith('http')
      ? proposal.productImage
      : proposal.productImage.replace(/^\//, '');
  const productImg = await loadCanvasImage(normalizedSrc);
  ctx.save();
  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.roundRect(48, 134, 340, 250, 14);
  ctx.fill();
  ctx.clip();
  if (productImg) ctx.drawImage(productImg, 48, 134, 340, 250);
  ctx.restore();

  const RX = 416;
  const RW = W - RX - 48;
  ctx.fillStyle = '#0095FF';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(String(proposal.categoryName || '').toUpperCase(), RX, 148);
  ctx.fillStyle = '#0D1015';
  ctx.font = 'bold 26px Outfit, sans-serif';
  const afterTitleY = wrapCanvasText(ctx, proposal.productName, RX, 178, RW, 30, 2);
  ctx.fillStyle = '#475569';
  ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Selected Finish: ${proposal.selectedFinish}  ·  ${proposal.dimensions}`, RX, afterTitleY + 4);

  const priceBoxY = afterTitleY + 22;
  ctx.fillStyle = '#EBF6FF';
  ctx.beginPath();
  ctx.roundRect(RX, priceBoxY, RW, 92, 14);
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('LISTED PRICE', RX + 20, priceBoxY + 28);
  ctx.fillStyle = '#0D1015';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(usd(proposal.originalPrice), RX + 20, priceBoxY + 60);
  ctx.fillStyle = '#0077CC';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("CUSTOMER'S PROPOSED OFFER", RX + 215, priceBoxY + 28);
  ctx.fillStyle = '#0095FF';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(usd(proposal.proposedPrice), RX + 215, priceBoxY + 64);

  const custBoxY = priceBoxY + 110;
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(RX, custBoxY, RW, 118, 12);
  ctx.fill();
  ctx.fillStyle = '#0D1015';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DESIRED CUSTOMIZATION OR MODIFICATIONS', RX + 16, custBoxY + 24);
  ctx.fillStyle = '#334155';
  ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
  wrapCanvasText(ctx, proposal.customizations, RX + 16, custBoxY + 46, RW - 32, 20, 3);

  const dataUrl = canvas.toDataURL('image/png');
  if (previewImg) previewImg.src = dataUrl;
  return dataUrl;
}

function closeMakeOfferModal() {
  const modal = document.getElementById('make-offer-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  syncBodyScrollLock();
}

async function openMakeOfferModal(productId) {
  const product = state.catalog.find((p) => p.id === productId);
  const modal = document.getElementById('make-offer-modal');
  if (!product || !modal) return;

  activeOfferProductId = product.id;
  activeOfferRefDataUrl = null;
  activeOfferRefName = '';

  const selectedFinish =
    state.selectedColorByProduct[product.id] || product.colorVariants?.[0]?.name || product.defaultFinish;
  const display = formatCustomerProductDisplay(product, selectedFinish);

  const setEl = (id, prop, val) => {
    const el = document.getElementById(id);
    if (el) el[prop] = val;
  };
  setEl('offer-product-image', 'src', display.image.replace(/^\//, ''));
  setEl('offer-product-category', 'textContent', display.categoryName);
  setEl('offer-product-name', 'textContent', display.name);
  setEl('offer-product-finish', 'textContent', display.selectedFinish);
  setEl('offer-product-original-price', 'textContent', usd(display.effectivePrice));
  setEl('offer-product-name-input', 'value', `${display.name} (${display.selectedFinish})`);

  const suggestedOffer = Math.max(50, Math.round(display.effectivePrice * 0.9));
  setEl('offer-proposed-price', 'value', String(suggestedOffer));
  setEl('offer-customizations', 'value', '');
  setEl('offer-notes', 'value', '');
  setEl('offer-reference-image', 'value', '');
  document.getElementById('offer-ref-preview-wrap')?.classList.add('hidden');
  document.getElementById('make-offer-error')?.classList.add('hidden');
  document.getElementById('offer-action-feedback')?.classList.add('hidden');
  setEl('offer-status-badge', 'textContent', 'Live Preview');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  syncBodyScrollLock();

  const initialCheck = validateAndBuildOfferProposal(
    {
      proposedPrice: suggestedOffer,
      selectedFinish: display.selectedFinish,
      originalPrice: display.effectivePrice,
      customizations: `Standard ${display.selectedFinish} finish (${display.dimensions})`,
      additionalNotes: '',
    },
    product,
    state.sessionUser
  );
  if (initialCheck.ok && initialCheck.proposal) {
    latestGeneratedProposal = initialCheck.proposal;
    await renderOfferProposalCanvas(initialCheck.proposal);
  }
}

function showOfferFeedback(message, isError = false) {
  const feedbackEl = document.getElementById('offer-action-feedback');
  if (!feedbackEl) return;
  feedbackEl.className = `p-3 rounded-xl border text-xs font-semibold ${
    isError ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
  }`;
  feedbackEl.textContent = message;
  feedbackEl.classList.remove('hidden');
}

function initMakeOfferModal() {
  const modal = document.getElementById('make-offer-modal');
  if (!modal || modal.dataset.boundOfferModal === 'true') return;
  modal.dataset.boundOfferModal = 'true';

  document.getElementById('close-make-offer-modal-btn')?.addEventListener('click', closeMakeOfferModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeMakeOfferModal();
  });

  const form = document.getElementById('make-offer-form');
  const errorEl = document.getElementById('make-offer-error');
  const statusBadge = document.getElementById('offer-status-badge');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.classList.add('hidden');
    const product = state.catalog.find((p) => p.id === activeOfferProductId);
    if (!product) return;

    const selectedFinish =
      state.selectedColorByProduct[product.id] || product.colorVariants?.[0]?.name || product.defaultFinish;
    const display = formatCustomerProductDisplay(product, selectedFinish);
    const offerInput = {
      proposedPrice: document.getElementById('offer-proposed-price')?.value,
      selectedFinish: display.selectedFinish,
      originalPrice: display.effectivePrice,
      customizations: document.getElementById('offer-customizations')?.value,
      additionalNotes: document.getElementById('offer-notes')?.value,
      referenceImageDataUrl: activeOfferRefDataUrl,
      referenceImageName: activeOfferRefName,
    };

    let proposal = null;
    const serverRes = await syncDatabaseStore('create_offer', { productId: product.id, offerInput });
    if (serverRes && serverRes.ok && serverRes.proposal) {
      proposal = serverRes.proposal;
    } else {
      const localCheck = validateAndBuildOfferProposal(offerInput, product, state.sessionUser);
      if (!localCheck.ok || !localCheck.proposal) {
        if (errorEl) {
          errorEl.textContent = serverRes?.error || localCheck.errorMessage || 'Please enter a valid offer amount.';
          errorEl.classList.remove('hidden');
        }
        return;
      }
      proposal = localCheck.proposal;
    }

    latestGeneratedProposal = proposal;
    await renderOfferProposalCanvas(proposal);
    if (statusBadge) statusBadge.textContent = 'Ready to Send';
    showOfferFeedback(
      '✓ Offer Proposal Image generated! Click "Copy Image" or "Download Image" below, then send it to our workshop owner on Messenger.'
    );
  });

  document.getElementById('copy-offer-image-btn')?.addEventListener('click', async () => {
    if (!latestGeneratedProposal) return;
    showOfferFeedback('✓ Offer image copied to clipboard! Paste it into your Messenger conversation with the owner.');
  });

  document.getElementById('download-offer-image-btn')?.addEventListener('click', () => {
    const canvas = document.getElementById('offer-proposal-canvas');
    if (!canvas || !latestGeneratedProposal) return;
    const link = document.createElement('a');
    link.download = latestGeneratedProposal.downloadFilename || 'furniture-offer-proposal.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showOfferFeedback(`✓ Offer image downloaded (${link.download})!`);
  });
}

function createProductCardElement(product) {
  const card = formatSimplifiedProductCardData(product);
  const node = cloneTemplate('tpl-product-card');
  if (!node) return document.createElement('article');

  node.setAttribute('data-testid', `product-card-${card.id}`);
  const imgUrl = String(card.image || 'assets/images/category_dining_tables.jpg').replace(/^\//, '');
  const stockBadgeClass = card.isOutOfStock
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : card.isLowStock
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  const imgEl = node.querySelector('[data-role="card-img"]');
  if (imgEl) {
    imgEl.src = imgUrl;
    imgEl.alt = card.name;
  }
  setRoleText(node, 'card-category', card.categoryName);
  const discEl = node.querySelector('[data-role="card-discount"]');
  if (discEl) {
    discEl.textContent = card.hasDiscount ? `-${card.discountPercent}%` : '';
    discEl.classList.toggle('hidden', !card.hasDiscount);
  }
  const stockEl = node.querySelector('[data-role="card-stock-badge"]');
  if (stockEl) {
    stockEl.className = `absolute top-3 right-3 px-2.5 py-1 rounded-full border text-[11px] font-mono-tech font-semibold ${stockBadgeClass}`;
    stockEl.textContent = card.availabilityLabel;
  }
  setRoleText(node, 'card-sku', card.sku);
  setRoleText(node, 'card-shipping', card.shippingTimeLabel);
  setRoleText(node, 'card-title', card.name);
  setRoleText(node, 'card-desc', card.description);
  setRoleText(node, 'card-dims', card.dimensions);
  setRoleText(node, 'card-price', usd(card.sellingPrice));

  const origEl = node.querySelector('[data-role="card-orig-price"]');
  if (origEl) {
    const showOrig = Boolean(card.hasDiscount && card.originalPrice);
    origEl.textContent = showOrig ? usd(card.originalPrice) : '';
    origEl.classList.toggle('hidden', !showOrig);
  }

  node.querySelector('[data-role="card-image-trigger"]')?.addEventListener('click', () => openProductDetailModal(card.id));
  node.querySelector('[data-role="card-title"]')?.addEventListener('click', () => openProductDetailModal(card.id));
  node.querySelector('[data-role="card-detail-btn"]')?.addEventListener('click', () => openProductDetailModal(card.id));
  node.querySelector('[data-role="card-offer-btn"]')?.addEventListener('click', () => openMakeOfferModal(card.id));

  const cartBtn = node.querySelector('[data-role="card-cart-btn"]');
  if (cartBtn) {
    cartBtn.disabled = card.isOutOfStock;
    cartBtn.textContent = card.isOutOfStock ? 'Out of Stock' : 'Add to Cart';
    cartBtn.addEventListener('click', () => addItemToCart(card.id));
  }

  return node;
}

function renderCatalogGrid() {
  const grid = document.getElementById('product-catalog-grid');
  if (!grid) return;

  const isFiltering = state.activeCategory !== 'all' || Boolean(state.searchQuery.trim()) || state.catalogShowAll;
  const visibleItems = isFiltering
    ? filterFurnitureItems(state.catalog, state.searchQuery, state.activeCategory)
    : getRecommendedBestSellers(state.catalog, 4);

  const countLabel = document.getElementById('catalog-count-label');
  if (countLabel) {
    countLabel.textContent = isFiltering
      ? `Showing ${visibleItems.length} of ${state.catalog.length} pieces`
      : `Showing ${visibleItems.length} Recommended Best Sellers`;
  }

  if (visibleItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'col-span-full py-12 text-center space-y-2';
    const p = document.createElement('p');
    p.className = 'font-serif-display text-lg font-bold text-[#0D1015]';
    p.textContent = 'No Matching Furniture Pieces';
    empty.appendChild(p);
    grid.replaceChildren(empty);
    return;
  }

  grid.replaceChildren(...visibleItems.map(createProductCardElement));
}

function initHeroTabs() {
  const tabs = document.querySelectorAll('[data-hero-tab]');
  if (tabs.length === 0) return;
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-hero-tab') || 'flagship';
      const copy = HERO_TAB_COPY[key] || HERO_TAB_COPY.flagship;
      tabs.forEach((t) => {
        const active = t === btn;
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.className = active
          ? 'hero-tab-btn px-3.5 py-1.5 rounded-lg bg-[#0095FF] text-white text-xs font-semibold tracking-wide shrink-0 cursor-pointer transition-colors'
          : 'hero-tab-btn px-3.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium shrink-0 cursor-pointer transition-colors';
      });
      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setTxt('hero-eyebrow', copy.eyebrow);
      setTxt('hero-headline', copy.headline);
      setTxt('hero-description', copy.description);
      setTxt('hero-price', copy.price);
      setTxt('hero-primary-cta-text', copy.ctaText);
      setTxt('hero-card-title', copy.cardTitle);
      const heroImg = document.getElementById('hero-image');
      if (heroImg) heroImg.src = copy.image;
      const primaryCta = document.getElementById('hero-primary-cta');
      if (primaryCta) primaryCta.href = `catalog.html?category=${copy.ctaCategory}`;
      const cardCta = document.getElementById('hero-card-cta');
      if (cardCta) cardCta.href = `catalog.html?category=${copy.ctaCategory}`;
    });
  });
}

function initDedicatedCatalogPage() {
  const grid = document.getElementById('catalog-page-grid') || document.getElementById('dedicated-catalog-grid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) state.catalogPageCategory = params.get('category');
  if (params.get('q')) state.catalogPageSearch = params.get('q');

  const renderDedicated = () => {
    const items = filterCatalogPageItems(state.catalog, {
      categoryId: state.catalogPageCategory,
      colorKey: state.catalogPageColor || 'all',
      maxPrice: state.catalogPageMaxPrice,
      searchQuery: state.catalogPageSearch,
    });

    const countEl = document.getElementById('catalog-page-result-count') || document.getElementById('dedicated-catalog-count');
    if (countEl) countEl.textContent = `${items.length} ${items.length === 1 ? 'PRODUCT' : 'PRODUCTS'}`;

    document.querySelectorAll('[data-catalog-top-tab]').forEach((btn) => {
      const cat = btn.getAttribute('data-catalog-top-tab');
      const active = cat === state.catalogPageCategory;
      btn.className = active
        ? 'catalog-top-tab py-3.5 text-xs sm:text-sm font-semibold text-[#0095FF] border-t-2 border-[#0095FF] whitespace-nowrap cursor-pointer transition-colors'
        : 'catalog-top-tab py-3.5 text-xs sm:text-sm font-medium text-[#0D1015] hover:text-[#0095FF] border-t-2 border-transparent whitespace-nowrap cursor-pointer transition-colors';
    });

    const colorsEl = document.getElementById('catalog-sidebar-colors');
    if (colorsEl) {
      const colors = getColorFilterCounts(state.catalog, state.catalogPageCategory, state.catalogPageMaxPrice);
      const colorNodes = colors.map((c) => {
        const btn = cloneTemplate('tpl-catalog-color-filter');
        if (!btn) return document.createElement('button');
        const active = state.catalogPageColor === c.key;
        btn.className = `px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
          active ? 'border-[#0095FF] bg-[#EBF6FF] text-[#0077CC]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`;
        const dot = btn.querySelector('[data-role="color-dot"]');
        if (dot) dot.style.backgroundColor = c.hex;
        setRoleText(btn, 'color-name', c.label);
        setRoleText(btn, 'color-count', `(${c.count})`);
        btn.addEventListener('click', () => {
          state.catalogPageColor = active ? '' : c.key;
          renderDedicated();
        });
        return btn;
      });
      colorsEl.replaceChildren(...colorNodes);
    }

    const roomTagsEl = document.getElementById('catalog-sidebar-room-tags');
    if (roomTagsEl) {
      const roomList = [{ id: 'all', name: 'All Rooms' }, ...state.categories];
      const roomNodes = roomList.map((r) => {
        const btn = cloneTemplate('tpl-catalog-room-tag') || document.createElement('button');
        const active = state.catalogPageCategory === r.id;
        btn.className = `px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
          active ? 'border-[#0095FF] bg-[#0095FF] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`;
        const cnt = r.id === 'all' ? state.catalog.length : state.catalog.filter((p) => p.categoryId === r.id).length;
        btn.textContent = `${r.name} (${cnt})`;
        btn.addEventListener('click', () => {
          state.catalogPageCategory = r.id;
          renderDedicated();
        });
        return btn;
      });
      roomTagsEl.replaceChildren(...roomNodes);
    }

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'col-span-full py-12 text-center space-y-2';
      const p = document.createElement('p');
      p.className = 'font-serif-display text-lg font-bold';
      p.textContent = 'No Matching Pieces';
      empty.appendChild(p);
      grid.replaceChildren(empty);
    } else {
      grid.replaceChildren(...items.map(createProductCardElement));
    }
  };

  document.querySelectorAll('[data-catalog-top-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.catalogPageCategory = btn.getAttribute('data-catalog-top-tab') || 'all';
      renderDedicated();
    });
  });

  const searchInput = document.getElementById('catalog-page-search') || document.getElementById('top-nav-search');
  if (searchInput) {
    searchInput.value = state.catalogPageSearch;
    searchInput.addEventListener('input', (e) => {
      state.catalogPageSearch = e.target.value;
      renderDedicated();
    });
  }

  const slider = document.getElementById('catalog-price-slider');
  const priceLabel = document.getElementById('catalog-price-label');
  slider?.addEventListener('input', (e) => {
    state.catalogPageMaxPrice = Number(e.target.value) || 5500;
    if (priceLabel) priceLabel.textContent = usd(state.catalogPageMaxPrice);
    renderDedicated();
  });
  document.getElementById('catalog-price-apply-btn')?.addEventListener('click', renderDedicated);
  document.getElementById('catalog-clear-color-btn')?.addEventListener('click', () => {
    state.catalogPageColor = '';
    renderDedicated();
  });
  document.getElementById('catalog-reset-all-btn')?.addEventListener('click', () => {
    state.catalogPageCategory = 'all';
    state.catalogPageSearch = '';
    state.catalogPageColor = '';
    state.catalogPageMaxPrice = 5500;
    if (slider) slider.value = '5500';
    if (priceLabel) priceLabel.textContent = '$5,500';
    renderDedicated();
  });

  renderDedicated();

  const deepProd = params.get('product');
  if (deepProd) openProductDetailModal(deepProd);
  const deepOffer = params.get('offer');
  if (deepOffer) openMakeOfferModal(deepOffer);
}

function initStorefrontSearchAndFilters() {
  const topSearch = document.getElementById('top-nav-search');
  if (topSearch && document.getElementById('product-catalog-grid')) {
    topSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderCatalogGrid();
    });
  }
}

async function bootstrapApp() {
  await loadAllPersistentDataFromServer();
  syncRoleNavigationUI();
  initCartDrawer();
  renderCartState();
  initProductDetailModal();
  initMakeOfferModal();
  bindRequestDesignTriggers();
  initHeroTabs();
  renderCatalogGrid();
  initStorefrontSearchAndFilters();
  initDedicatedCatalogPage();

  if (document.getElementById('client-portal-view') || document.getElementById('admin-portal-view')) {
    const { createDashboard } = await import('./dashboard.js');
    const dashboard = createDashboard({
      state,
      API_ENDPOINT,
      FRIENDLY_CUSTOMER_STEPS,
      syncCustomerAvatarDOM,
      esc,
      usd,
      bindLiveSearchInput,
      syncDatabaseStore,
      persistProductToStorage,
      saveMaterialsToStorage,
      saveOrdersToStorage,
      saveInventoryTransactionsToStorage,
      saveSessionUserToServer,
      saveCartToStorage,
      saveCustomerProfileToStorage,
      bindRequestDesignTriggers,
    });
    dashboard.initDashboardPage();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
  } else {
    bootstrapApp();
  }
}
