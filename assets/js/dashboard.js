import {
  ADMIN_MESSENGER_PLACEHOLDER_URL,
  PRODUCT_TYPES,
  applyAdminOrderUpdate,
  applyMaterialStockMovement,
  buildProductRecord,
  calculateExpirationFromInput,
  calculateOrderPricing,
  computeCustomerDirectory,
  computeInventoryMetrics,
  computeMaterialInventoryMetrics,
  computeVariantPricing,
  computeVoucherStatusInfo,
  createCustomOrderRequest,
  filterCustomerVouchers,
  filterInventoryMaterials,
  formatSimplifiedProductCardData,
  formatVoucherBenefitLabel,
  formatVoucherExpiryDisplay,
  formatVoucherIssuedDisplay,
  generateOwnEntityId,
  getCompletedTransactionsForCustomer,
  getManilaDateInputDefaults,
  getMaterialCategories,
  getMaterialStockStatus,
  getProductStockStatus,
  isOrderCompleted,
  paginateItems,
  partitionOrdersByCompletion,
  recordCustomerOrderPayment,
  removeProductFromCatalog,
  requestOrderCancellation,
  resolveOrderCancellationRequest,
  revokeVoucherInList,
  validateAndCreateVoucher,
  validateNewFurnitureInput,
  validateVoucherForOrder,
  verifyAndCreateOrder,
} from './store.js';

import {
  buildAnalyticsCsvContent,
  buildAnalyticsPdfBytes,
  computeMonthlyAnalyticsReport,
  resolveAnalyticsDateRange,
} from './analytics.js';

export function createDashboard({
  state,
  API_ENDPOINT,
  FRIENDLY_CUSTOMER_STEPS,
  syncCustomerAvatarDOM,
  usd,
  bindLiveSearchInput,
  syncDatabaseStore,
  persistProductToStorage,
  saveMaterialsToStorage,
  saveOrdersToStorage,
  saveSessionUserToServer,
  saveCartToStorage,
  saveCustomerProfileToStorage,
  bindRequestDesignTriggers,
}) {
  let voucherCountdownTimerId = null;
  let pendingConfirmAction = null;
  let pendingCancelAction = null;

  function cloneTpl(id) {
    const tpl = document.getElementById(id);
    return tpl && tpl.content && tpl.content.firstElementChild
      ? tpl.content.firstElementChild.cloneNode(true)
      : null;
  }

  function setRole(root, role, text) {
    const el = root?.querySelector(`[data-role="${role}"]`);
    if (el) el.textContent = text;
    return el;
  }

  function createOption(value, label, selected = false) {
    const opt = document.createElement('option');
    opt.value = String(value ?? '');
    opt.textContent = String(label ?? '');
    opt.selected = Boolean(selected);
    return opt;
  }

  function applyStatusBadge(badgeEl, textEl, statusKey, customLabel = null) {
    if (!badgeEl) return;
    const cls =
      statusKey === 'out_of_stock'
        ? 'admin-status-out-of-stock'
        : statusKey === 'low_stock'
        ? 'admin-status-low-stock'
        : 'admin-status-in-stock';
    badgeEl.className = `admin-status-badge ${cls}`;
    const label =
      customLabel ||
      (statusKey === 'out_of_stock' ? 'Out of Stock' : statusKey === 'low_stock' ? 'Low Stock' : 'In Stock');
    if (textEl) textEl.textContent = label;
    else badgeEl.textContent = label;
  }

  function openAdminConfirmModal({
    title,
    message,
    confirmLabel = 'Confirm',
    confirmVariant = 'danger',
    onConfirm,
    onCancel = null,
  }) {
    const modal = document.getElementById('admin-confirm-modal');
    if (!modal) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }
    const setTxt = (id, t) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t;
    };
    setTxt('admin-confirm-title', title || 'Confirm Action');
    setTxt('admin-confirm-message', message || 'Are you sure you want to proceed?');
    const acceptBtn = document.getElementById('admin-confirm-accept');
    if (acceptBtn) {
      acceptBtn.textContent = confirmLabel;
      acceptBtn.className =
        confirmVariant === 'primary' ? 'admin-btn admin-btn-primary' : 'admin-btn admin-btn-danger';
    }
    pendingConfirmAction = onConfirm;
    pendingCancelAction = onCancel;
    modal.classList.remove('hidden');
  }

  function showClientBanner(msg) {
    const banner = document.getElementById('client-action-banner');
    if (!banner) return;
    banner.textContent = `✓ ${msg}`;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 3500);
  }

  function showAdminBanner(msg, isError = false) {
    const banner = document.getElementById('admin-status-banner');
    if (!banner) return;
    banner.className = isError
      ? 'p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3'
      : 'p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3';
    const textWrap = document.createElement('span');
    textWrap.textContent = `${isError ? '! ' : '✓ '}${msg}`;
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'text-xs font-semibold hover:underline cursor-pointer';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => banner.classList.add('hidden'));
    banner.replaceChildren(textWrap, dismissBtn);
    banner.classList.remove('hidden');
  }

  function startVoucherCountdownTicker() {
    if (voucherCountdownTimerId) clearInterval(voucherCountdownTimerId);
    voucherCountdownTimerId = setInterval(() => {
      const nowMs = Date.now();
      let statusChanged = false;
      (state.vouchers || []).forEach((v) => {
        const info = computeVoucherStatusInfo(v, nowMs);
        if (v.status !== info.status) {
          v.status = info.status;
          statusChanged = true;
        }
      });
      if (statusChanged) {
        renderDashboardContent();
        return;
      }
      document.querySelectorAll('[data-voucher-countdown]').forEach((el) => {
        const key = el.getAttribute('data-voucher-countdown') || '';
        const matched = (state.vouchers || []).find(
          (v) => String(v.id || '') === key || String(v.code || '').toUpperCase() === key.toUpperCase()
        );
        if (matched) el.textContent = computeVoucherStatusInfo(matched, nowMs).remainingLabel;
      });
    }, 1000);
  }

  function initDashboardPage() {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');
    let activeUser = state.sessionUser;
    if ((urlRole === 'admin' || urlRole === 'client') && (!activeUser || activeUser.role !== urlRole)) {
      activeUser =
        urlRole === 'admin'
          ? { email: 'admin@lilliarowena.com', name: 'Lillia Mercier (Business Owner)', role: 'admin' }
          : { email: 'rowena.vance@vancearchitects.com', name: 'Rowena Vance', role: 'client' };
      saveSessionUserToServer(activeUser);
    }
    if (!activeUser) {
      window.location.href = window.location.pathname.endsWith('.php')
        ? new URL('index.php', window.location.href).href
        : 'login.html';
      return;
    }

    const isAdmin = activeUser.role === 'admin';
    if (activeUser.name) state.customerProfile.name = activeUser.name;
    if (activeUser.email) state.customerProfile.email = activeUser.email;
    if (activeUser.avatar && !state.customerProfile.avatar) state.customerProfile.avatar = activeUser.avatar;

    const matchedCust = (state.customers || []).find(
      (c) => String(c.email || '').trim().toLowerCase() === String(activeUser.email || '').trim().toLowerCase()
    );
    if (matchedCust && String(activeUser.email || '').trim().toLowerCase() !== 'rowena.vance@vancearchitects.com') {
      state.customerProfile.phone = matchedCust.phoneNumber || matchedCust.phone || '';
      state.customerProfile.address = matchedCust.address || '';
      state.customerProfile.city = matchedCust.city || '';
      state.customerProfile.notes = matchedCust.notes || '';
      if (matchedCust.avatar) state.customerProfile.avatar = matchedCust.avatar;
    }

    document.getElementById('portal-top-header')?.classList.toggle('hidden', isAdmin);
    document.getElementById('client-portal-wrapper')?.classList.toggle('hidden', isAdmin);
    document.getElementById('client-portal-view')?.classList.toggle('hidden', isAdmin);
    document.getElementById('admin-portal-view')?.classList.toggle('hidden', !isAdmin);

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setTxt('portal-header-subtitle', isAdmin ? 'Admin Management Console' : 'Customer Account Dashboard');
    setTxt('portal-user-badge', `${state.customerProfile.name} (${isAdmin ? 'Admin' : 'Customer'})`);
    ['client-welcome-name', 'client-sidebar-name', 'admin-sidebar-user-name'].forEach((id) =>
      setTxt(id, state.customerProfile.name)
    );
    ['client-welcome-email', 'client-sidebar-email', 'admin-sidebar-user-email'].forEach((id) =>
      setTxt(id, state.customerProfile.email)
    );
    syncCustomerAvatarDOM(state.customerProfile);

    const handlePortalLogout = async (e) => {
      e.preventDefault();
      state.sessionUser = null;
      state.cartItems = [];
      try {
        await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_session', sessionUser: null }),
        });
      } catch (_err) {
        // Ignore network error
      }
      window.location.href = window.location.pathname.endsWith('.php')
        ? new URL('logout.php', window.location.href).href
        : 'login.html';
    };
    document.getElementById('portal-logout-btn')?.addEventListener('click', handlePortalLogout);
    document.getElementById('admin-logout-btn')?.addEventListener('click', handlePortalLogout);
    bindRequestDesignTriggers();

    const clientTabBtns = document.querySelectorAll('[data-client-tab]');
    const switchClientTab = (target) => {
      state.activeClientTab = target || 'home';
      clientTabBtns.forEach((b) => {
        const isSel = b.getAttribute('data-client-tab') === state.activeClientTab;
        b.className = isSel
          ? 'client-tab-btn w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer bg-[#0095FF] text-white shadow-xs'
          : 'client-tab-btn w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer bg-[#F8FBFF] text-[#0D1015] hover:bg-[#EBF6FF]';
      });
      document.querySelectorAll('.client-tab-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.id !== `client-tab-${state.activeClientTab}`);
      });
    };
    clientTabBtns.forEach((btn) =>
      btn.addEventListener('click', () => switchClientTab(btn.getAttribute('data-client-tab') || 'home'))
    );
    document.querySelectorAll('[data-switch-client-tab]').forEach((btn) =>
      btn.addEventListener('click', () => switchClientTab(btn.getAttribute('data-switch-client-tab') || 'home'))
    );

    const requestedClientTab = (params.get('tab') || '').toLowerCase();
    if (!isAdmin && ['home', 'orders', 'address', 'transactions', 'cart', 'vouchers'].includes(requestedClientTab)) {
      switchClientTab(requestedClientTab);
    }

    const applyCustomerAvatarUpdate = (newAvatarSrc) => {
      const cleanAvatar = String(newAvatarSrc || '').trim();
      state.customerProfile.avatar = cleanAvatar;
      if (state.sessionUser) state.sessionUser.avatar = cleanAvatar;
      syncCustomerAvatarDOM(state.customerProfile);
      saveCustomerProfileToStorage();
    };
    const clientAvatarFileInput = document.getElementById('client-profile-avatar-file');
    clientAvatarFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        applyCustomerAvatarUpdate(dataUrl);
        const serverRes = await syncDatabaseStore('upload_product_image', {
          fileName: `avatar_${file.name || 'profile.jpg'}`,
          dataUrl,
        });
        if (serverRes?.ok && serverRes.imagePath) applyCustomerAvatarUpdate(serverRes.imagePath);
        showClientBanner('Updated your profile picture.');
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('client-profile-avatar-clear-btn')?.addEventListener('click', () => {
      if (clientAvatarFileInput) clientAvatarFileInput.value = '';
      applyCustomerAvatarUpdate('');
      showClientBanner('Removed your profile picture.');
    });

    document.getElementById('client-address-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = (id, fb) => document.getElementById(id)?.value.trim() || fb;
      state.customerProfile = {
        name: val('client-input-name', state.customerProfile.name),
        email: val('client-input-email', state.customerProfile.email),
        phone: val('client-input-phone', state.customerProfile.phone),
        city: val('client-input-city', state.customerProfile.city),
        address: val('client-input-address', state.customerProfile.address),
        notes: val('client-input-notes', state.customerProfile.notes),
        avatar: document.getElementById('client-input-avatar')?.value.trim() ?? (state.customerProfile.avatar || ''),
      };
      await syncDatabaseStore('update_customer_profile', { customerProfile: state.customerProfile });
      if (state.sessionUser) {
        state.sessionUser.name = state.customerProfile.name;
        state.sessionUser.email = state.customerProfile.email;
        state.sessionUser.avatar = state.customerProfile.avatar;
        saveSessionUserToServer(state.sessionUser);
      }
      ['client-welcome-name', 'client-sidebar-name'].forEach((id) => setTxt(id, state.customerProfile.name));
      ['client-welcome-email', 'client-sidebar-email'].forEach((id) => setTxt(id, state.customerProfile.email));
      setTxt('portal-user-badge', `${state.customerProfile.name} (Customer)`);
      syncCustomerAvatarDOM(state.customerProfile);
      showClientBanner('Saved your updated Profile, Address & Contact information.');
      renderDashboardContent();
    });

    const clientApplyVoucherBtn = document.getElementById('client-cart-apply-voucher-btn');
    const clientVoucherInput = document.getElementById('client-cart-voucher-input');
    const clientVoucherFeedback = document.getElementById('client-cart-voucher-feedback');
    clientApplyVoucherBtn?.addEventListener('click', async () => {
      const code = clientVoucherInput?.value.trim().toUpperCase() || '';
      const email = state.customerProfile.email || state.sessionUser?.email || '';
      let result = validateVoucherForOrder(state.vouchers, code, email, state.cartItems, state.catalog);
      if (result.valid) {
        const serverCheck = await syncDatabaseStore('validate_voucher', {
          voucherCode: code,
          customerEmail: email,
          cartItems: state.cartItems.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        });
        if (serverCheck && !serverCheck.valid) {
          result = { valid: false, discountAmount: 0, voucher: null, errorMessage: serverCheck.error || 'Invalid voucher.' };
        }
      }
      if (clientVoucherFeedback) {
        clientVoucherFeedback.classList.remove('hidden');
        if (result.valid) {
          state.appliedVoucher = result.voucher;
          clientVoucherFeedback.textContent = `✓ Voucher ${result.voucher.code} (${formatVoucherBenefitLabel(
            result.voucher
          )}) applied to "${result.voucher.furnitureName || result.voucher.productName}" (-${usd(result.discountAmount)})!`;
          clientVoucherFeedback.className = 'text-xs font-semibold text-emerald-700';
        } else {
          state.appliedVoucher = null;
          clientVoucherFeedback.textContent = `✕ ${result.errorMessage}`;
          clientVoucherFeedback.className = 'text-xs font-semibold text-rose-700';
        }
      }
      renderDashboardContent();
    });

    document.getElementById('client-cart-checkout-btn')?.addEventListener('click', async () => {
      if (state.cartItems.length === 0) return;
      const voucherCode = state.appliedVoucher ? state.appliedVoucher.code : '';
      const serverCheckout = await syncDatabaseStore('place_order', {
        voucherCode,
        customerProfile: state.customerProfile,
        cartItems: state.cartItems,
      });
      if (serverCheckout && serverCheckout.ok && serverCheckout.order) {
        if (Array.isArray(serverCheckout.catalog)) state.catalog = serverCheckout.catalog;
        if (Array.isArray(serverCheckout.orders)) state.orders = serverCheckout.orders;
        if (Array.isArray(serverCheckout.vouchers)) state.vouchers = serverCheckout.vouchers;
        if (Array.isArray(serverCheckout.inventoryTransactions))
          state.inventoryTransactions = serverCheckout.inventoryTransactions;
        state.cartItems = [];
        state.appliedVoucher = null;
        if (clientVoucherInput) clientVoucherInput.value = '';
        clientVoucherFeedback?.classList.add('hidden');
        showClientBanner(`Order #${serverCheckout.order.orderNumber} placed for ${usd(serverCheckout.order.totalAmount)}.`);
        switchClientTab('orders');
        renderDashboardContent();
        return;
      }

      const checkoutResult = verifyAndCreateOrder({
        catalog: state.catalog,
        vouchers: state.vouchers,
        customerProfile: state.customerProfile,
        sessionUser: state.sessionUser,
        cartItems: state.cartItems,
        voucherCode,
      });
      if (!checkoutResult.ok) {
        state.appliedVoucher = null;
        if (clientVoucherFeedback) {
          clientVoucherFeedback.classList.remove('hidden');
          clientVoucherFeedback.textContent = `✕ ${checkoutResult.errorMessage}`;
          clientVoucherFeedback.className = 'text-xs font-semibold text-rose-700';
        }
        renderDashboardContent();
        return;
      }
      state.catalog = checkoutResult.updatedCatalog;
      state.orders.unshift(checkoutResult.order);
      if (checkoutResult.validatedVoucher) {
        const usedCode = String(checkoutResult.validatedVoucher.code || '').toUpperCase();
        state.vouchers = state.vouchers.map((v) =>
          String(v.code || '').toUpperCase() === usedCode ? { ...v, status: 'Used' } : v
        );
      }
      state.cartItems = [];
      state.appliedVoucher = null;
      saveCartToStorage();
      syncDatabaseStore('sync_store');
      showClientBanner(`Order #${checkoutResult.order.orderNumber} placed for ${usd(checkoutResult.order.totalAmount)}.`);
      switchClientTab('orders');
      renderDashboardContent();
    });

    // Static Custom Commission Form Events
    document.getElementById('cust-ord-product')?.addEventListener('change', (e) => {
      state.clientCustomOrderInput.productId = e.target.value;
      renderDashboardContent();
    });
    document.getElementById('cust-ord-material')?.addEventListener('change', (e) => {
      state.clientCustomOrderInput.materialId = e.target.value;
      renderDashboardContent();
    });
    document.getElementById('client-cancel-custom-commission-btn')?.addEventListener('click', () => {
      state.clientCustomOrderOpen = false;
      renderDashboardContent();
    });
    document.getElementById('client-custom-commission-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userEmail = state.sessionUser?.email || state.customerProfile.email;
      const selectedMat = state.materials.find((m) => m.id === document.getElementById('cust-ord-material')?.value);
      const extraCost = Math.max(250, Math.round(Number(selectedMat?.unitCost || 0) * 4));
      const customInput = {
        productId: document.getElementById('cust-ord-product')?.value || '',
        materialId: document.getElementById('cust-ord-material')?.value || '',
        colorFinish: document.getElementById('cust-ord-finish')?.value || 'Natural Oil',
        lengthCm: document.getElementById('cust-ord-length')?.value || 240,
        widthCm: document.getElementById('cust-ord-width')?.value || 100,
        heightCm: document.getElementById('cust-ord-height')?.value || 75,
        notes: document.getElementById('cust-ord-notes')?.value || '',
        extraCost,
        materialQtyUsed: 2,
      };
      const serverRes = await syncDatabaseStore('create_custom_order', {
        customInput,
        customerProfile: { name: state.customerProfile.name, email: userEmail },
      });
      if (serverRes && serverRes.ok && serverRes.order) {
        if (Array.isArray(serverRes.orders)) state.orders = serverRes.orders;
        if (Array.isArray(serverRes.materials)) state.materials = serverRes.materials;
        if (Array.isArray(serverRes.inventoryTransactions))
          state.inventoryTransactions = serverRes.inventoryTransactions;
        state.clientCustomOrderOpen = false;
        showClientBanner(`Custom Commission #${serverRes.order.orderNumber} submitted!`);
        renderDashboardContent();
        return;
      }
      const res = createCustomOrderRequest({
        catalog: state.catalog,
        materials: state.materials,
        customerProfile: { name: state.customerProfile.name, email: userEmail },
        customInput,
      });
      if (!res.ok) {
        const errEl = document.getElementById('client-custom-commission-error');
        if (errEl) {
          errEl.textContent = res.errorMessage;
          errEl.classList.remove('hidden');
        }
        return;
      }
      state.orders.unshift(res.order);
      saveOrdersToStorage();
      state.clientCustomOrderOpen = false;
      showClientBanner(`Custom Commission #${res.order.orderNumber} submitted!`);
      renderDashboardContent();
    });

    const adminSidebar = document.getElementById('admin-sidebar');
    const adminBackdrop = document.getElementById('admin-sidebar-backdrop');
    const adminMobileMenuBtn = document.getElementById('admin-mobile-menu-btn');
    const setAdminSidebarOpen = (open) => {
      adminSidebar?.classList.toggle('is-open', open);
      adminBackdrop?.classList.toggle('is-open', open);
      adminMobileMenuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    adminMobileMenuBtn?.addEventListener('click', () =>
      setAdminSidebarOpen(!adminSidebar?.classList.contains('is-open'))
    );
    document.getElementById('admin-sidebar-close-btn')?.addEventListener('click', () => setAdminSidebarOpen(false));
    adminBackdrop?.addEventListener('click', () => setAdminSidebarOpen(false));

    const ADMIN_SECTION_META = {
      overview: {
        eyebrow: 'Store Summary',
        title: 'Dashboard Overview',
        description: 'Monitor store performance, inventory health, and recent customer orders at a glance.',
      },
      catalog: {
        eyebrow: 'Catalog Management',
        title: 'Products',
        description: 'Manage handcrafted furniture pieces, pricing, room categories, and finished stock availability.',
      },
      'add-product': {
        eyebrow: 'Catalog Management',
        title: 'Add or Edit Product',
        description: 'Create or update a Standard Product or Customized Product (Messenger) in the store catalog.',
      },
      inventory: {
        eyebrow: 'Inventory & Stock Management',
        title: 'Inventory & Stock Management',
        description: 'Track workshop materials, monitor stock thresholds, record stock movements, and review audit history.',
      },
      vouchers: {
        eyebrow: 'Promotions',
        title: 'Discount Vouchers',
        description: 'Issue and manage single-item promotional discount codes for customers.',
      },
      orders: {
        eyebrow: 'Order Management',
        title: 'Customer Orders',
        description: 'Manage order production stages and track customer payments — updates sync live to the Customer Dashboard.',
      },
      customers: {
        eyebrow: 'Customer Management',
        title: 'Customer Directory',
        description: 'View registered client profiles, delivery addresses, order history, and lifetime spend.',
      },
      analytics: {
        eyebrow: 'Business Intelligence & Reporting',
        title: 'Analytics & Business Reports',
        description: 'Monthly performance KPIs, daily & annual revenue trends, best-selling pieces, order status distribution, customer retention, inventory movements, and voucher analytics.',
      },
    };

    document.getElementById('client-toggle-custom-order-btn')?.addEventListener('click', () => {
      state.clientCustomOrderOpen = !state.clientCustomOrderOpen;
      renderDashboardContent();
    });
    document.querySelectorAll('[data-open-custom-builder]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.clientCustomOrderOpen = true;
        switchClientTab('orders');
        renderDashboardContent();
      })
    );

    const adminTabBtns = document.querySelectorAll('[data-admin-tab]');
    const prodForm = document.getElementById('admin-product-form');
    const prodErrorEl = document.getElementById('admin-product-form-error');
    const prodEditIdInput = document.getElementById('prod-edit-id');
    const prodTypeSelect = document.getElementById('prod-type');
    const prodMessengerThreadSelect = document.getElementById('prod-messenger-thread');
    const prodCustomNotesInput = document.getElementById('prod-custom-notes');
    const prodImageInput = document.getElementById('prod-image');
    const prodImageFileInput = document.getElementById('prod-image-file');

    if (prodMessengerThreadSelect) {
      prodMessengerThreadSelect.replaceChildren(
        createOption('', 'None — General Messenger Customization'),
        ...(state.messengerConversations || []).map((c) =>
          createOption(c.id, `${c.customerName} (${c.customerEmail}) — ${c.topic}`)
        )
      );
    }

    const syncProductImagePreview = (rawValue) => {
      const cleanSrc = String(rawValue ?? (prodImageInput ? prodImageInput.value : '')).trim();
      const preview = document.getElementById('prod-image-preview');
      const empty = document.getElementById('prod-image-empty-state');
      if (!preview || !empty) return;
      if (cleanSrc) {
        preview.src = cleanSrc.startsWith('data:') || cleanSrc.startsWith('http') ? cleanSrc : cleanSrc.replace(/^\//, '');
        preview.classList.remove('hidden');
        empty.classList.add('hidden');
      } else {
        preview.removeAttribute('src');
        preview.classList.add('hidden');
        empty.classList.remove('hidden');
      }
    };

    const syncProductFormTypeUI = () => {
      const isCustomized = prodTypeSelect?.value === 'customized';
      const isEditing = Boolean(prodEditIdInput?.value);
      document.getElementById('prod-messenger-section')?.classList.toggle('hidden', !isCustomized);
      document.getElementById('admin-delete-editing-product-btn')?.classList.toggle('hidden', !isEditing);
      setTxt(
        'admin-product-form-title',
        isEditing ? (isCustomized ? 'Edit Customized Product' : 'Edit Product') : isCustomized ? 'Add Customized Product' : 'Add Product'
      );
      setTxt('admin-save-product-btn', isEditing ? 'Update Product' : 'Save Product');
    };

    const resetProductFormForCreate = (defaultType = 'standard') => {
      if (prodEditIdInput) prodEditIdInput.value = '';
      if (prodTypeSelect) prodTypeSelect.value = defaultType;
      if (prodMessengerThreadSelect) prodMessengerThreadSelect.value = '';
      if (prodCustomNotesInput) prodCustomNotesInput.value = '';
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v;
      };
      setVal('prod-name', '');
      setVal('prod-category', 'living');
      setVal('prod-sku', generateOwnEntityId('product', '', 'living').codeId);
      setVal('prod-price', '2850');
      setVal('prod-discount', '0');
      setVal('prod-dimensions', '240cm L × 100cm W × 75cm H');
      setVal('prod-stock', '4');
      setVal('prod-min-stock', '2');
      setVal('prod-colors', 'Natural Walnut|#5C3A21|0, Smoked Oak|#3D312A|180, Ebonized Ash|#1C1917|260');
      setVal('prod-image', 'assets/images/category_dining_tables.jpg');
      if (prodImageFileInput) prodImageFileInput.value = '';
      syncProductImagePreview('assets/images/category_dining_tables.jpg');
      prodErrorEl?.classList.add('hidden');
      syncProductFormTypeUI();
    };
    window.__resetProductForm = resetProductFormForCreate;

    const handleRemoveProductById = (productId) => {
      const pid = String(productId || '').trim();
      const prod = state.catalog.find((item) => item.id === pid);
      if (!prod) return;
      openAdminConfirmModal({
        title: 'Remove Product',
        message: `Are you sure you want to remove "${prod.name}" (${prod.sku}) from the store catalog?`,
        confirmLabel: 'Remove Product',
        onConfirm: () => {
          const res = removeProductFromCatalog({
            catalog: state.catalog,
            cartItems: state.cartItems,
            vouchers: state.vouchers,
            productId: pid,
          });
          if (!res.ok) return;
          state.catalog = res.updatedCatalog;
          state.cartItems = res.updatedCartItems;
          state.vouchers = res.updatedVouchers;
          saveCartToStorage();
          syncDatabaseStore('delete_product', { productId: pid, vouchers: state.vouchers });
          if (prodEditIdInput?.value === pid) {
            resetProductFormForCreate('standard');
            switchAdminTab('catalog');
          }
          showAdminBanner(`Removed "${prod.name}" (${prod.sku}) from the store catalog.`);
          renderDashboardContent();
        },
      });
    };
    window.__removeProductById = handleRemoveProductById;

    window.__openProductFormForEdit = (product) => {
      if (!product) return;
      const isCustomized = product.productType === 'customized' || Boolean(product.isCustomClientDesign);
      if (prodEditIdInput) prodEditIdInput.value = product.id;
      if (prodTypeSelect) prodTypeSelect.value = isCustomized ? 'customized' : 'standard';
      if (prodMessengerThreadSelect) prodMessengerThreadSelect.value = product.messengerConversationId || '';
      if (prodCustomNotesInput) prodCustomNotesInput.value = product.customizationNotes || '';
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v;
      };
      setVal('prod-name', product.name || '');
      setVal('prod-sku', product.sku || '');
      setVal('prod-category', product.categoryId || 'dining');
      setVal('prod-price', String(product.price || 2850));
      setVal('prod-discount', String(product.discountPercent || 0));
      setVal('prod-dimensions', product.dimensions || 'Standard Dimensions');
      setVal('prod-stock', String(product.inStockCount ?? 4));
      setVal('prod-min-stock', String(product.minStockLevel ?? 2));
      if (Array.isArray(product.colorVariants) && product.colorVariants.length > 0) {
        setVal(
          'prod-colors',
          product.colorVariants.map((v) => `${v.name}|${v.hex || '#5C3A21'}|${Number(v.priceDelta || 0)}`).join(', ')
        );
      }
      setVal('prod-image', String(product.image || '').trim());
      syncProductImagePreview(product.image);
      prodErrorEl?.classList.add('hidden');
      switchAdminTab('add-product', true);
      syncProductFormTypeUI();
      prodForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    prodTypeSelect?.addEventListener('change', syncProductFormTypeUI);
    prodImageInput?.addEventListener('input', () => syncProductImagePreview(prodImageInput.value));
    document.getElementById('prod-image-clear-btn')?.addEventListener('click', () => {
      if (prodImageInput) prodImageInput.value = '';
      if (prodImageFileInput) prodImageFileInput.value = '';
      syncProductImagePreview('');
    });
    prodForm?.querySelectorAll('[data-prod-image-preset]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-prod-image-preset') || '';
        if (prodImageInput) prodImageInput.value = path;
        syncProductImagePreview(path);
      })
    );

    const switchAdminTab = (targetKey, preserveProductForm = false) => {
      const target = targetKey || 'overview';
      state.activeAdminTab = target;
      if (target === 'add-product' && !preserveProductForm) resetProductFormForCreate('standard');
      adminTabBtns.forEach((b) => {
        const tabAttr = b.getAttribute('data-admin-tab');
        const isSel = tabAttr === target || (target === 'add-product' && tabAttr === 'catalog');
        b.classList.toggle('is-active', isSel);
        if (isSel) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      const meta = ADMIN_SECTION_META[target] || ADMIN_SECTION_META.overview;
      setTxt('admin-page-eyebrow', meta.eyebrow);
      setTxt('admin-page-title', meta.title);
      setTxt('admin-page-description', meta.description);
      document.getElementById('admin-overview-section')?.classList.toggle('hidden', target !== 'overview');
      prodForm?.classList.toggle('hidden', target !== 'add-product');
      document
        .getElementById('admin-catalog-list')
        ?.classList.toggle('hidden', target !== 'catalog' && target !== 'add-product');
      prodErrorEl?.classList.add('hidden');
      document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
        if (target === 'overview') panel.classList.add('hidden');
        else {
          const panelTarget = target === 'add-product' ? 'catalog' : target;
          panel.classList.toggle('hidden', panel.id !== `admin-tab-${panelTarget}`);
        }
      });
      setAdminSidebarOpen(false);
      if (target === 'analytics') renderAdminAnalyticsSection();
    };
    window.__switchAdminTab = switchAdminTab;

    adminTabBtns.forEach((btn) =>
      btn.addEventListener('click', () => switchAdminTab(btn.getAttribute('data-admin-tab') || 'overview'))
    );
    document.querySelectorAll('[data-admin-jump]').forEach((btn) =>
      btn.addEventListener('click', () => switchAdminTab(btn.getAttribute('data-admin-jump') || 'overview'))
    );
    document.getElementById('admin-toggle-add-product-btn')?.addEventListener('click', () => switchAdminTab('add-product'));
    document.getElementById('admin-close-product-form')?.addEventListener('click', () => switchAdminTab('catalog'));
    document.getElementById('admin-cancel-product-btn')?.addEventListener('click', () => switchAdminTab('catalog'));

    bindLiveSearchInput('admin-catalog-search', 'adminProductSearch', () => {
      state.adminProductPage = 1;
      renderDashboardContent();
    });
    bindLiveSearchInput('admin-inv-stock-search', 'adminInventoryStockSearch', () => {
      state.adminInventoryPage = 1;
      renderDashboardContent();
    });
    document.getElementById('admin-inv-category-filter')?.addEventListener('change', (e) => {
      state.adminInventoryCategoryFilter = e.target.value;
      state.adminInventoryPage = 1;
      renderDashboardContent();
    });
    bindLiveSearchInput('admin-orders-search', 'adminOrderSearch', renderDashboardContent);
    bindLiveSearchInput('admin-customers-search', 'adminCustomerSearch', renderDashboardContent);

    // Static Analytics Controls Events
    document.querySelectorAll('[data-analytics-preset]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.adminAnalyticsPreset = btn.getAttribute('data-analytics-preset') || 'this_month';
        renderAdminAnalyticsSection();
      })
    );
    document.querySelectorAll('[data-analytics-quick-month]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const [yStr, mStr] = (btn.getAttribute('data-analytics-quick-month') || '2026-11').split('-');
        state.adminAnalyticsPreset = 'select_month';
        state.adminAnalyticsYear = yStr;
        state.adminAnalyticsMonth = String(Number(mStr));
        renderAdminAnalyticsSection();
      })
    );
    document.getElementById('analytics-overview-period-select')?.addEventListener('change', (e) => {
      const [yStr, mStr] = String(e.target.value || '2026-11').split('-');
      state.adminAnalyticsPreset = 'select_month';
      state.adminAnalyticsYear = yStr;
      state.adminAnalyticsMonth = String(Number(mStr));
      renderAdminAnalyticsSection();
    });
    document.getElementById('analytics-export-pdf-btn')?.addEventListener('click', () => {
      const report = window.__latestAnalyticsReport;
      if (!report) return;
      const pdfBytes = buildAnalyticsPdfBytes(report);
      const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `lillia-rowena-analytics-${String(report.period.label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      a.click();
      showAdminBanner(`Downloaded PDF Report for ${report.period.label}.`);
    });
    document.getElementById('analytics-export-csv-btn')?.addEventListener('click', async () => {
      const report = window.__latestAnalyticsReport;
      if (!report) return;
      const serverCsv = await syncDatabaseStore('export_analytics_csv', { filterInput: window.__latestAnalyticsFilter });
      const csvText = serverCsv?.ok && serverCsv.csv ? serverCsv.csv : buildAnalyticsCsvContent(report);
      const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `lillia-rowena-analytics-${String(report.period.label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
      a.click();
      showAdminBanner(`Exported CSV Report for ${report.period.label}.`);
    });
    document.getElementById('analytics-print-report-btn')?.addEventListener('click', () => window.print());

    const confirmModal = document.getElementById('admin-confirm-modal');
    document.getElementById('admin-confirm-cancel')?.addEventListener('click', () => {
      const fn = pendingCancelAction;
      pendingConfirmAction = null;
      pendingCancelAction = null;
      confirmModal?.classList.add('hidden');
      if (typeof fn === 'function') fn();
    });
    document.getElementById('admin-confirm-accept')?.addEventListener('click', () => {
      const fn = pendingConfirmAction;
      pendingConfirmAction = null;
      pendingCancelAction = null;
      confirmModal?.classList.add('hidden');
      if (typeof fn === 'function') fn();
    });

    prodForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = prodEditIdInput ? prodEditIdInput.value.trim() : '';
      const productType = prodTypeSelect ? prodTypeSelect.value : PRODUCT_TYPES.NORMAL;
      const name = document.getElementById('prod-name').value.trim();
      const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
      const categoryId = document.getElementById('prod-category').value;
      const price = Number(document.getElementById('prod-price').value);
      const discountPercent = Number(document.getElementById('prod-discount').value) || 0;
      const dimensions = document.getElementById('prod-dimensions').value.trim() || 'Standard Dimensions';
      const stockVal = document.getElementById('prod-stock')?.value;
      const minStockVal = document.getElementById('prod-min-stock')?.value;
      const inStockCount = stockVal !== undefined && stockVal !== '' ? Number(stockVal) : 4;
      const minStockLevel = minStockVal !== undefined && minStockVal !== '' ? Number(minStockVal) : 2;
      const colorsRaw = document.getElementById('prod-colors').value;
      const image = prodImageInput ? prodImageInput.value.trim() : '';
      const messengerConversationId = prodMessengerThreadSelect ? prodMessengerThreadSelect.value.trim() : '';
      const customizationNotes = prodCustomNotesInput ? prodCustomNotesInput.value.trim() : '';

      const validation = validateNewFurnitureInput({ name, sku, price, inStockCount, productType, image });
      if (!validation.valid) {
        if (prodErrorEl) {
          prodErrorEl.textContent = validation.errorMessage;
          prodErrorEl.classList.remove('hidden');
        }
        return;
      }
      prodErrorEl?.classList.add('hidden');
      const matchedConv = (state.messengerConversations || []).find((c) => c.id === messengerConversationId);
      const existingProduct = editId ? state.catalog.find((item) => item.id === editId) || null : null;
      const savedProduct = buildProductRecord(
        {
          productType,
          name,
          sku,
          categoryId,
          price,
          discountPercent,
          dimensions,
          inStockCount,
          minStockLevel,
          colorsRaw,
          image,
          messengerConversationId: productType === 'customized' ? messengerConversationId || null : null,
          messengerCustomerName: productType === 'customized' ? matchedConv?.customerName || null : null,
          messengerTopic: productType === 'customized' ? matchedConv?.topic || null : null,
          customizationNotes: productType === 'customized' ? customizationNotes || null : null,
        },
        existingProduct
      );
      if (existingProduct) {
        state.catalog = state.catalog.map((item) => (item.id === existingProduct.id ? savedProduct : item));
      } else {
        state.catalog.unshift(savedProduct);
      }
      persistProductToStorage(savedProduct);
      resetProductFormForCreate('standard');
      switchAdminTab('catalog');
      showAdminBanner(
        existingProduct
          ? `Updated "${savedProduct.name}" (${savedProduct.sku}).`
          : `Added "${savedProduct.name}" (${savedProduct.sku}) to the store catalog.`
      );
      renderDashboardContent();
    });

    // Admin Voucher Form Wiring
    const vchExpMethodInput = document.getElementById('vch-expiration-method');
    const vchDurationValueInput = document.getElementById('vch-duration-value');
    const vchDurationUnitSelect = document.getElementById('vch-duration-unit');
    const vchExpiryDateInput = document.getElementById('vch-expiry-date');
    const vchExpiryTimeInput = document.getElementById('vch-expiry-time');

    const syncVoucherExpirationPreview = () => {
      const box = document.getElementById('vch-expiration-preview');
      const txt = document.getElementById('vch-expiration-preview-text');
      const badge = document.getElementById('vch-expiration-preview-badge');
      if (!box || !txt || !badge) return;
      const defaults = getManilaDateInputDefaults(Date.now());
      if (vchExpiryDateInput && !vchExpiryDateInput.value) vchExpiryDateInput.value = defaults.defaultDate;
      if (vchExpiryTimeInput && !vchExpiryTimeInput.value) vchExpiryTimeInput.value = defaults.defaultTime;
      const calc = calculateExpirationFromInput(
        {
          expirationMethod: vchExpMethodInput?.value || 'duration',
          durationValue: vchDurationValueInput?.value,
          durationUnit: vchDurationUnitSelect?.value,
          expiryDate: vchExpiryDateInput?.value,
          expiryTime: vchExpiryTimeInput?.value,
        },
        Date.now()
      );
      if (!calc.ok) {
        box.classList.add('is-invalid');
        txt.textContent = calc.errorMessage || 'Invalid expiration settings.';
        badge.textContent = 'Invalid Expiry';
        return;
      }
      box.classList.remove('is-invalid');
      txt.textContent = `Expires ${calc.formattedManila} (Asia/Manila)`;
      badge.textContent = calc.remainingLabel;
    };

    document.querySelectorAll('[data-vch-exp-method]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const method = btn.getAttribute('data-vch-exp-method') || 'duration';
        if (vchExpMethodInput) vchExpMethodInput.value = method;
        document.querySelectorAll('[data-vch-exp-method]').forEach((b) =>
          b.classList.toggle('is-active', b.getAttribute('data-vch-exp-method') === method)
        );
        document.getElementById('vch-duration-panel')?.classList.toggle('hidden', method !== 'duration');
        document.getElementById('vch-custom-expiry-panel')?.classList.toggle('hidden', method !== 'custom');
        syncVoucherExpirationPreview();
      })
    );
    document.querySelectorAll('[data-vch-quick-duration]').forEach((chip) =>
      chip.addEventListener('click', () => {
        const [val, unit] = (chip.getAttribute('data-vch-quick-duration') || '24|hours').split('|');
        if (vchExpMethodInput) vchExpMethodInput.value = 'duration';
        if (vchDurationValueInput && val) vchDurationValueInput.value = val;
        if (vchDurationUnitSelect && unit) vchDurationUnitSelect.value = unit;
        syncVoucherExpirationPreview();
      })
    );
    [vchDurationValueInput, vchDurationUnitSelect, vchExpiryDateInput, vchExpiryTimeInput].forEach((el) =>
      el?.addEventListener('input', syncVoucherExpirationPreview)
    );
    document.getElementById('admin-generate-voucher-btn')?.addEventListener('click', () => {
      const disc = Math.max(1, Math.round(Number(document.getElementById('vch-discount')?.value) || 300));
      const codeInput = document.getElementById('vch-code');
      if (codeInput) codeInput.value = `SAVE-${disc}-${Math.floor(100 + Math.random() * 900)}`;
    });

    document.getElementById('admin-voucher-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const vchErrorEl = document.getElementById('admin-voucher-form-error');
      const customerEmail = document.getElementById('vch-email')?.value.trim() || '';
      const matchedCustRecord = (state.customers || []).find(
        (c) => String(c.email || '').trim().toLowerCase() === customerEmail.toLowerCase()
      );
      const payloadInput = {
        customerEmail,
        customerName: matchedCustRecord ? matchedCustRecord.fullName || matchedCustRecord.name : '',
        furnitureId: document.getElementById('vch-product')?.value || '',
        code: document.getElementById('vch-code')?.value.trim().toUpperCase() || '',
        discountAmount: Number(document.getElementById('vch-discount')?.value),
        expirationMethod: vchExpMethodInput?.value || 'duration',
        durationValue: Number(vchDurationValueInput?.value),
        durationUnit: vchDurationUnitSelect?.value || 'hours',
        expiryDate: vchExpiryDateInput?.value || '',
        expiryTime: vchExpiryTimeInput?.value || '',
        issuedByAdmin: state.sessionUser?.name || 'Lillia Mercier',
      };
      const localCheck = validateAndCreateVoucher(payloadInput, state.catalog, state.vouchers, Date.now());
      if (!localCheck.ok) {
        if (vchErrorEl) {
          vchErrorEl.textContent = localCheck.errorMessage;
          vchErrorEl.classList.remove('hidden');
        }
        return;
      }
      vchErrorEl?.classList.add('hidden');
      const serverRes = await syncDatabaseStore('create_voucher', { voucher: payloadInput });
      const createdVoucher = serverRes?.voucher || localCheck.voucher;
      if (Array.isArray(serverRes?.vouchers)) state.vouchers = serverRes.vouchers;
      else state.vouchers = [createdVoucher, ...state.vouchers];
      const codeEl = document.getElementById('vch-code');
      if (codeEl) codeEl.value = '';
      showAdminBanner(
        `Voucher ${createdVoucher.code} (${usd(createdVoucher.discountAmount)} OFF "${
          createdVoucher.furnitureName
        }") issued to ${createdVoucher.customerEmail}.`
      );
      renderDashboardContent();
    });

    switchAdminTab(state.activeAdminTab || 'overview');
    renderDashboardContent();
    syncVoucherExpirationPreview();
    startVoucherCountdownTicker();
  }

  function renderDashboardContent() {
    const userEmail = state.sessionUser?.email || 'rowena.vance@vancearchitects.com';
    const clientViewEl = document.getElementById('client-portal-view');
    const adminViewEl = document.getElementById('admin-portal-view');
    const shouldRenderClient = !clientViewEl || !clientViewEl.classList.contains('hidden');
    const shouldRenderAdmin = !adminViewEl || !adminViewEl.classList.contains('hidden');

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    if (shouldRenderClient) {
      const displayOrders = state.orders.filter(
        (o) => String(o.clientEmail || '').trim().toLowerCase() === userEmail.toLowerCase()
      );
      const displayVouchers = filterCustomerVouchers(state.vouchers, userEmail);
      const usableCustomerVouchers = displayVouchers.filter((v) => computeVoucherStatusInfo(v).isUsable);
      const cartQty = state.cartItems.reduce((sum, c) => sum + c.quantity, 0);
      const completedTransactions = getCompletedTransactionsForCustomer(displayOrders, userEmail);
      const activeClientOrdersCount = displayOrders.filter((o) => !isOrderCompleted(o)).length;

      setTxt('user-stat-orders', `${activeClientOrdersCount} Active ${activeClientOrdersCount === 1 ? 'Order' : 'Orders'}`);
      setTxt('user-stat-vouchers', `${usableCustomerVouchers.length} Ready to Use`);
      setTxt('user-stat-cart', `${cartQty} ${cartQty === 1 ? 'Item' : 'Items'}`);
      setTxt('sidebar-badge-orders', String(displayOrders.length));
      setTxt('sidebar-badge-transactions', String(completedTransactions.length));
      setTxt('sidebar-badge-cart', String(cartQty));
      setTxt('sidebar-badge-vouchers', String(usableCustomerVouchers.length));

      // Home Latest Order Preview
      const homeOrderPreview = document.getElementById('client-home-order-preview');
      if (homeOrderPreview) {
        if (displayOrders[0]) {
          const latest = displayOrders[0];
          const matched = state.catalog.find((p) => p.id === latest.furnitureId) || state.catalog[0];
          const imgUrl = (matched ? matched.image : 'assets/images/category_dining_tables.jpg').replace(/^\//, '');
          const node = cloneTpl('tpl-client-home-order');
          if (node) {
            const img = node.querySelector('[data-role="ord-img"]');
            if (img) {
              img.src = imgUrl;
              img.alt = latest.furnitureName;
            }
            setRole(node, 'ord-status-num', `${latest.status} · #${latest.orderNumber}`);
            setRole(node, 'ord-title', latest.furnitureName);
            setRole(node, 'ord-finish', latest.selectedFinish);
            setRole(node, 'ord-dims', latest.customDimensions || 'Standard Dimensions');
            setRole(node, 'ord-total', usd(latest.totalAmount));
            homeOrderPreview.replaceChildren(node);
          }
        } else {
          const empty = document.createElement('p');
          empty.className = 'pt-4 border-t border-[#E2E8F0] text-center py-6 text-sm font-bold text-[#0D1015]';
          empty.textContent = 'No Active Orders Yet';
          homeOrderPreview.replaceChildren(empty);
        }
      }

      // Home Delivery Address Preview
      const formattedAddr = [state.customerProfile.address, state.customerProfile.city]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join(', ');
      setTxt('client-home-addr-name', state.customerProfile.name);
      setTxt('client-home-addr-phone', state.customerProfile.phone || 'No phone number added');
      setTxt('client-home-addr-line', formattedAddr || 'No delivery address added');

      // Home Live Catalog Feed
      const homeCatalogFeedEl = document.getElementById('client-home-catalog-feed');
      if (homeCatalogFeedEl) {
        const cards = state.catalog.slice(0, 6).map((prod) => {
          const card = formatSimplifiedProductCardData(prod);
          const node = cloneTpl('tpl-client-catalog-card');
          if (!node) return document.createElement('div');
          const img = node.querySelector('[data-role="cat-img"]');
          if (img) {
            img.src = (card.image || 'assets/images/category_dining_tables.jpg').replace(/^\//, '');
            img.alt = card.name;
          }
          setRole(node, 'cat-name', card.categoryName);
          setRole(node, 'cat-avail', card.availabilityLabel);
          setRole(node, 'prod-name', card.name);
          setRole(node, 'prod-price', usd(card.sellingPrice));
          const link = node.querySelector('[data-role="prod-link"]');
          if (link) {
            link.href = `catalog.html?category=${encodeURIComponent(prod.categoryId || 'all')}&product=${encodeURIComponent(card.id)}`;
            link.textContent = card.ctaLabel;
          }
          return node;
        });
        homeCatalogFeedEl.replaceChildren(...cards);
      }

      const setInputVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = val;
      };
      setInputVal('client-input-name', state.customerProfile.name);
      setInputVal('client-input-email', state.customerProfile.email);
      setInputVal('client-input-phone', state.customerProfile.phone);
      setInputVal('client-input-city', state.customerProfile.city);
      setInputVal('client-input-address', state.customerProfile.address);
      setInputVal('client-input-notes', state.customerProfile.notes);
      syncCustomerAvatarDOM(state.customerProfile);

      // Custom Commission Builder (Populates static form in HTML)
      const customOrderCardEl = document.getElementById('client-custom-order-card');
      setTxt(
        'client-toggle-custom-order-btn',
        state.clientCustomOrderOpen ? 'Close Custom Commission Builder' : '+ Commission Custom Piece'
      );
      if (customOrderCardEl) {
        customOrderCardEl.classList.toggle('hidden', !state.clientCustomOrderOpen);
        if (state.clientCustomOrderOpen) {
          const selectedBaseProd =
            state.catalog.find((p) => p.id === state.clientCustomOrderInput.productId) || state.catalog[0];
          const availableMaterials = state.materials.filter((m) => Number(m.stockQuantity || 0) > 0);
          const selectedMat =
            availableMaterials.find((m) => m.id === state.clientCustomOrderInput.materialId) ||
            availableMaterials[0] ||
            state.materials[0];
          const basePrice = Number(selectedBaseProd?.effectivePrice || selectedBaseProd?.price || 2850);
          const extraCost = Math.max(250, Math.round(Number(selectedMat?.unitCost || 0) * 4));
          const estimatedTotal = basePrice + extraCost;

          setTxt('cust-ord-estimated-total', usd(estimatedTotal));
          setTxt('client-submit-custom-commission-btn', `Submit Custom Commission (${usd(estimatedTotal)})`);
          const prodSelect = document.getElementById('cust-ord-product');
          if (prodSelect) {
            prodSelect.replaceChildren(
              ...state.catalog.map((p) =>
                createOption(p.id, `${p.name} (${usd(p.effectivePrice)})`, p.id === selectedBaseProd?.id)
              )
            );
          }
          const matSelect = document.getElementById('cust-ord-material');
          if (matSelect) {
            matSelect.replaceChildren(
              ...state.materials.map((m) =>
                createOption(m.id, `${m.name} (${m.stockQuantity} ${m.unit} avail)`, m.id === selectedMat?.id)
              )
            );
          }
        }
      }

      // Customer Orders List
      const friendlyOrdersEl = document.getElementById('client-orders-friendly-list');
      if (friendlyOrdersEl) {
        if (displayOrders.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'bg-white rounded-3xl border border-[#BCE3FF] p-8 text-center font-serif-display text-lg font-bold text-[#0D1015]';
          empty.textContent = 'You Have Not Placed Any Orders Yet';
          friendlyOrdersEl.replaceChildren(empty);
        } else {
          const orderCards = displayOrders.map((ord) => {
            const node = cloneTpl('tpl-client-order-card');
            if (!node) return document.createElement('article');
            const matchedProd = state.catalog.find((p) => p.id === ord.furnitureId) || state.catalog[0];
            const imgUrl = (matchedProd ? matchedProd.image : 'assets/images/category_dining_tables.jpg').replace(/^\//, '');
            const isCompleted = isOrderCompleted(ord);
            let friendlyStep = 1;
            if (/Joinery|Finishing|Timber/i.test(ord.status)) friendlyStep = 2;
            if (/Quality/i.test(ord.status)) friendlyStep = 3;
            if (isCompleted || /Dispatched|Delivered/i.test(ord.status)) friendlyStep = 4;
            const pct = Math.round((friendlyStep / 4) * 100);
            const totalAmt = Number(ord.totalAmount || 0);
            const paidAmt = Number(ord.depositPaid ?? totalAmt);
            const balanceDue = Math.max(0, totalAmt - paidAmt);
            const isCancelled = /Cancelled/i.test(String(ord.status || '')) || ord.sqlStatus === 'Cancelled';
            const isCancelPending = Boolean(ord.cancellationRequested) && !isCancelled;
            const canCancel = friendlyStep < 4 && !isCancelled && !isCancelPending && !isCompleted;

            const img = node.querySelector('[data-role="ord-img"]');
            if (img) {
              img.src = imgUrl;
              img.alt = ord.furnitureName;
            }
            const statusEl = setRole(node, 'ord-status', ord.status);
            if (statusEl) {
              statusEl.className = `font-semibold ${
                isCancelled ? 'text-rose-700' : isCompleted ? 'text-emerald-700' : 'text-[#0077CC]'
              }`;
            }
            setRole(node, 'ord-number', `Order #${ord.orderNumber}`);
            node.querySelector('[data-role="ord-completed-badge"]')?.classList.toggle('hidden', !isCompleted);
            node.querySelector('[data-role="ord-cancel-badge"]')?.classList.toggle('hidden', !isCancelPending);
            setRole(node, 'ord-name', ord.furnitureName);
            setRole(node, 'ord-finish', ord.selectedFinish);
            setRole(node, 'ord-dims', ord.customDimensions);
            setRole(
              node,
              'ord-payment-summary',
              balanceDue > 0 ? `Paid ${usd(paidAmt)} · Balance Due ${usd(balanceDue)}` : 'Paid in Full'
            );
            setRole(node, 'ord-total', usd(totalAmt));

            const pctLabel = setRole(node, 'ord-pct-label', isCancelled ? 'Order Cancelled' : `${pct}% Complete`);
            if (pctLabel) pctLabel.className = `font-mono-tech font-bold ${isCancelled ? 'text-rose-600' : 'text-[#0095FF]'}`;
            const pctBar = node.querySelector('[data-role="ord-pct-bar"]');
            if (pctBar) {
              pctBar.className = `h-full rounded-full ${isCancelled ? 'bg-rose-500' : 'bg-[#0095FF]'}`;
              pctBar.style.width = `${isCancelled ? 100 : pct}%`;
            }

            const stepsEl = node.querySelector('[data-role="ord-steps"]');
            if (stepsEl) {
              const stepNodes = FRIENDLY_CUSTOMER_STEPS.map((label, idx) => {
                const stepNode = cloneTpl('tpl-client-order-step');
                if (!stepNode) return document.createElement('div');
                const active = !isCancelled && idx + 1 <= friendlyStep;
                stepNode.className = `flex items-center gap-1.5 text-[11px] ${active ? 'text-[#0D1015] font-bold' : 'text-[#94A3B8]'}`;
                const dot = setRole(stepNode, 'step-dot', active ? '✓' : String(idx + 1));
                if (dot) {
                  dot.className = `w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    active ? 'bg-[#0095FF] text-white' : 'bg-[#E2E8F0] text-[#64748B]'
                  }`;
                }
                setRole(stepNode, 'step-label', label);
                return stepNode;
              });
              stepsEl.replaceChildren(...stepNodes);
            }

            const payBtn = node.querySelector('[data-role="ord-pay-btn"]');
            if (payBtn && balanceDue > 0 && !isCancelled) {
              payBtn.classList.remove('hidden');
              payBtn.textContent = `Pay Remaining Balance (${usd(balanceDue)})`;
              payBtn.addEventListener('click', async () => {
                const serverRes = await syncDatabaseStore('record_order_payment', {
                  orderNumber: ord.orderNumber,
                  paymentMethod: 'Card',
                });
                if (serverRes?.ok && Array.isArray(serverRes.orders)) state.orders = serverRes.orders;
                else {
                  const res = recordCustomerOrderPayment({ orders: state.orders, orderNumber: ord.orderNumber, paymentMethod: 'Card' });
                  if (!res.ok) return showClientBanner(res.errorMessage || 'Unable to process payment.');
                  state.orders = res.updatedOrders;
                  saveOrdersToStorage();
                }
                showClientBanner(`Paid remaining balance for Order #${ord.orderNumber}.`);
                renderDashboardContent();
              });
            }

            const cancelBtn = node.querySelector('[data-role="ord-cancel-btn"]');
            if (cancelBtn && canCancel) {
              cancelBtn.classList.remove('hidden');
              cancelBtn.addEventListener('click', async () => {
                const serverRes = await syncDatabaseStore('request_order_cancellation', { orderNumber: ord.orderNumber });
                if (serverRes?.ok && Array.isArray(serverRes.orders)) state.orders = serverRes.orders;
                else {
                  const res = requestOrderCancellation({ orders: state.orders, orderNumber: ord.orderNumber });
                  if (!res.ok) return showClientBanner(res.errorMessage || 'Unable to request cancellation.');
                  state.orders = res.updatedOrders;
                  saveOrdersToStorage();
                }
                showClientBanner(`Cancellation request for Order #${ord.orderNumber} sent to Admin.`);
                renderDashboardContent();
              });
            }

            const msgLink = node.querySelector('[data-role="ord-messenger-link"]');
            if (msgLink) msgLink.href = ADMIN_MESSENGER_PLACEHOLDER_URL;

            return node;
          });
          friendlyOrdersEl.replaceChildren(...orderCards);
        }
      }

      // Customer Completed Transactions Table
      const txTbody = document.getElementById('client-transactions-tbody');
      if (txTbody) {
        const totalVol = completedTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        setTxt('client-transactions-total', usd(totalVol));
        const rows = completedTransactions.map((tx) => {
          const tr = cloneTpl('tpl-client-tx-row');
          if (!tr) return document.createElement('tr');
          tr.setAttribute('data-testid', `client-transaction-row-${tx.orderNumber}`);
          setRole(tr, 'tx-id', tx.txId);
          setRole(tr, 'tx-ord', `#${tx.orderNumber}`);
          setRole(tr, 'tx-date', tx.date);
          setRole(tr, 'tx-piece', tx.piece);
          setRole(tr, 'tx-meta', `${tx.finish} · ${tx.dimensions || 'Standard Dimensions'}`);
          setRole(tr, 'tx-status', tx.status || 'Completed');
          setRole(tr, 'tx-amount', usd(tx.amount));
          return tr;
        });
        txTbody.replaceChildren(...rows);
      }

      // Customer Cart Workspace
      const cartEmptyEl = document.getElementById('client-cart-empty-state');
      const cartWorkspaceEl = document.getElementById('client-cart-workspace');
      const cartItemsListEl = document.getElementById('client-cart-items-list');
      if (cartEmptyEl && cartWorkspaceEl && cartItemsListEl) {
        if (state.cartItems.length === 0) {
          cartEmptyEl.classList.remove('hidden');
          cartWorkspaceEl.classList.add('hidden');
          cartItemsListEl.replaceChildren();
          state.appliedVoucher = null;
        } else {
          cartEmptyEl.classList.add('hidden');
          cartWorkspaceEl.classList.remove('hidden');
          if (state.appliedVoucher) {
            const recheck = validateVoucherForOrder(
              state.vouchers,
              state.appliedVoucher.code,
              userEmail,
              state.cartItems,
              state.catalog
            );
            if (!recheck.valid) state.appliedVoucher = null;
          }
          const linePrices = state.cartItems.map((c) => ({
            productId: c.product.id,
            productName: c.product.name,
            finish: c.finish,
            unitPrice: computeVariantPricing(c.product, c.finish).effectivePrice,
            quantity: c.quantity,
          }));
          const totals = calculateOrderPricing(linePrices, state.appliedVoucher);

          const itemNodes = state.cartItems.map((entry, idx) => {
            const node = cloneTpl('tpl-client-cart-item');
            if (!node) return document.createElement('article');
            const item = entry.product;
            const pricing = computeVariantPricing(item, entry.finish);
            const breakdown = totals.lineBreakdowns[idx] || {
              finalLineTotal: pricing.effectivePrice * entry.quantity,
            };
            const img = node.querySelector('[data-role="cart-img"]');
            if (img) {
              img.src = (item.image || 'assets/images/category_living_lounge.jpg').replace(/^\//, '');
              img.alt = item.name;
            }
            setRole(node, 'cart-name', item.name);
            setRole(node, 'cart-finish', entry.finish);
            setRole(node, 'cart-unit-price', usd(pricing.effectivePrice));
            setRole(node, 'cart-qty', String(entry.quantity));
            setRole(node, 'cart-line-total', usd(breakdown.finalLineTotal));

            const changeQty = (delta) => {
              if (!state.cartItems[idx]) return;
              state.cartItems[idx].quantity += delta;
              if (state.cartItems[idx].quantity <= 0) state.cartItems.splice(idx, 1);
              saveCartToStorage();
              renderDashboardContent();
            };
            node.querySelector('[data-role="cart-dec"]')?.addEventListener('click', () => changeQty(-1));
            node.querySelector('[data-role="cart-inc"]')?.addEventListener('click', () => changeQty(1));
            node.querySelector('[data-role="cart-remove"]')?.addEventListener('click', () => {
              state.cartItems.splice(idx, 1);
              saveCartToStorage();
              renderDashboardContent();
            });
            return node;
          });
          cartItemsListEl.replaceChildren(...itemNodes);

          setTxt('client-cart-subtotal', usd(totals.rawSubtotal));
          const voucherRow = document.getElementById('client-cart-voucher-row');
          if (voucherRow) {
            voucherRow.classList.toggle('hidden', totals.voucherDiscountAmount <= 0);
            voucherRow.classList.toggle('flex', totals.voucherDiscountAmount > 0);
            setTxt('client-cart-voucher-discount', `-${usd(totals.voucherDiscountAmount)}`);
          }
          setTxt('client-cart-delivery', usd(totals.whiteGloveDeliveryFee));
          setTxt('client-cart-total', usd(totals.totalAmount));
        }
      }

      // Customer Voucher Wallet
      const friendlyVouchersEl = document.getElementById('client-vouchers-friendly-list');
      if (friendlyVouchersEl) {
        const voucherNodes = displayVouchers.map((v) => {
          const node = cloneTpl('tpl-client-voucher-card');
          if (!node) return document.createElement('div');
          const statusInfo = computeVoucherStatusInfo(v);
          const issuedInfo = formatVoucherIssuedDisplay(v);
          const expiryInfo = formatVoucherExpiryDisplay(v);
          const discountAmt = Number(v.discountAmount ?? v.discountValue ?? 0);

          setRole(node, 'vch-discount', `${usd(discountAmt)} OFF FIXED DISCOUNT`);
          setRole(node, 'vch-product', v.furnitureName || v.productName);
          const badgeEl = node.querySelector('[data-role="vch-status-badge"]');
          if (badgeEl) badgeEl.className = `admin-status-badge ${statusInfo.badgeClass}`;
          setRole(node, 'vch-status-text', statusInfo.status);
          setRole(node, 'vch-code', v.code);
          setRole(node, 'vch-issued', issuedInfo.primary);
          setRole(node, 'vch-expires', expiryInfo.primary);

          const countdownEl = setRole(node, 'vch-countdown', statusInfo.remainingLabel);
          if (countdownEl) {
            countdownEl.setAttribute('data-voucher-countdown', v.id);
            countdownEl.className = `vch-remaining-badge ${
              statusInfo.isUsable ? 'vch-remaining-active' : 'vch-remaining-inactive'
            }`;
          }

          node.querySelector('[data-role="vch-copy-btn"]')?.addEventListener('click', () => {
            showClientBanner(`Copied voucher code ${v.code}.`);
          });

          const useBtn = node.querySelector('[data-role="vch-use-btn"]');
          if (useBtn && statusInfo.isUsable) {
            useBtn.classList.remove('hidden');
            useBtn.addEventListener('click', () => {
              const pid = v.furnitureId || v.productId;
              const product = state.catalog.find((p) => p.id === pid);
              if (product && Number(product.inStockCount ?? 0) > 0) {
                const finish = product.defaultFinish || 'Natural Finish';
                if (!state.cartItems.some((c) => c.product.id === product.id)) {
                  state.cartItems.push({ product, finish, quantity: 1 });
                  saveCartToStorage();
                }
                const check = validateVoucherForOrder(state.vouchers, v.code, userEmail, state.cartItems, state.catalog);
                if (check.valid) state.appliedVoucher = check.voucher;
              }
              document.querySelector('[data-client-tab="cart"]')?.click();
              renderDashboardContent();
            });
          }
          return node;
        });
        friendlyVouchersEl.replaceChildren(...voucherNodes);
      }
    }

    if (!shouldRenderAdmin) return;

    const discountedCount = state.catalog.filter((p) => Number(p.discountPercent || 0) > 0).length;
    const activeVoucherCount = state.vouchers.filter((v) => computeVoucherStatusInfo(v).isUsable).length;
    const totalOrderRevenue = state.orders
      .filter(isOrderCompleted)
      .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const invMetrics = computeMaterialInventoryMetrics(state.materials);
    const customerDirectory = computeCustomerDirectory(state.orders, state.customers, state.customerProfile);

    setTxt('admin-stat-catalog', `${state.catalog.length} Items`);
    setTxt(
      'admin-stat-catalog-sub',
      discountedCount > 0 ? `${discountedCount} currently discounted` : 'All at standard price'
    );
    setTxt('admin-stat-vouchers', `${activeVoucherCount} Active`);
    setTxt('admin-stat-orders', `${state.orders.length} Orders`);
    setTxt('admin-stat-revenue', usd(totalOrderRevenue));
    setTxt('admin-nav-count-products', String(state.catalog.length));
    setTxt('admin-nav-count-inventory', String(invMetrics.totalMaterials));
    setTxt('admin-nav-count-vouchers', String(state.vouchers.length));
    setTxt('admin-nav-count-orders', String(state.orders.length));
    setTxt('admin-nav-count-customers', String(customerDirectory.length));

    // Overview Charts & Recent Orders
    const chartCategoriesEl = document.getElementById('admin-chart-categories');
    if (chartCategoriesEl) {
      const totalItems = Math.max(1, state.catalog.length);
      const bars = [
        { id: 'living', label: 'Living Room' },
        { id: 'dining', label: 'Dining Room' },
        { id: 'bedroom', label: 'Bedroom' },
        { id: 'office', label: 'Study/Work Desks' },
        { id: 'kitchen', label: 'Kitchen' },
      ].map((cat) => {
        const node = cloneTpl('tpl-admin-category-bar');
        if (!node) return document.createElement('div');
        const matches = state.catalog.filter((p) => p.categoryId === cat.id);
        const pct = Math.round((matches.length / totalItems) * 100);
        setRole(node, 'bar-label', cat.label);
        setRole(node, 'bar-count', `${matches.length} items`);
        const fill = node.querySelector('[data-role="bar-fill"]');
        if (fill) fill.style.width = `${matches.length > 0 ? Math.max(8, pct) : 0}%`;
        return node;
      });
      chartCategoriesEl.replaceChildren(...bars);
    }

    const recentTbody = document.getElementById('admin-recent-orders-tbody');
    if (recentTbody) {
      const rows = state.orders.slice(0, 4).map((o) => {
        const tr = cloneTpl('tpl-admin-recent-order-row');
        if (!tr) return document.createElement('tr');
        setRole(tr, 'ord-num', `#${o.orderNumber}`);
        setRole(tr, 'ord-client', o.clientName);
        setRole(tr, 'ord-prod', o.furnitureName);
        setRole(tr, 'ord-stage', o.status.split('·')[0].trim());
        setRole(tr, 'ord-total', usd(o.totalAmount));
        return tr;
      });
      recentTbody.replaceChildren(...rows);
    }

    // Admin Catalog Section
    const adminCatalogTbody = document.getElementById('admin-catalog-tbody');
    if (adminCatalogTbody) {
      const query = (state.adminProductSearch || '').trim().toLowerCase();
      const catFilter = state.adminProductCategory || 'all';
      const stockFilter = state.adminProductStockFilter || 'all';
      const typeFilter = state.adminProductTypeFilter || 'all';
      const prodMetrics = computeInventoryMetrics(state.catalog);
      setTxt('prod-kpi-total', String(prodMetrics.totalProducts));
      setTxt('prod-kpi-in-stock', String(prodMetrics.inStockCount));
      setTxt('prod-kpi-low-stock', String(prodMetrics.lowStockCount));
      setTxt('prod-kpi-out-stock', String(prodMetrics.outOfStockCount));

      const filteredProducts = state.catalog.filter((p) => {
        const pType = p.productType === 'customized' || p.isCustomClientDesign ? 'customized' : 'standard';
        const stockInfo = getProductStockStatus(p);
        return (
          (catFilter === 'all' || p.categoryId === catFilter) &&
          (typeFilter === 'all' || pType === typeFilter) &&
          (stockFilter === 'all' || stockInfo.statusKey === stockFilter) &&
          (!query || p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query))
        );
      });
      const prodPagination = paginateItems(filteredProducts, state.adminProductPage || 1, 6);
      state.adminProductPage = prodPagination.currentPage;

      const rows = prodPagination.items.map((p) => {
        const tr = cloneTpl('tpl-admin-product-row');
        if (!tr) return document.createElement('tr');
        tr.setAttribute('data-product-row', p.id);
        const stockInfo = getProductStockStatus(p);
        const img = tr.querySelector('[data-role="prod-img"]');
        if (img) {
          img.src = (p.image || 'assets/images/category_dining_tables.jpg').replace(/^\//, '');
          img.alt = p.name;
        }
        setRole(tr, 'prod-name', p.name);
        setRole(tr, 'prod-sku', `ProductID: ${p.productId || p.sku}`);
        setRole(tr, 'prod-cat', p.categoryName);
        setRole(tr, 'prod-stock', `${stockInfo.availableStock} pcs`);
        setRole(tr, 'prod-min', `${stockInfo.minStockLevel} pcs`);
        setRole(tr, 'prod-price', usd(p.effectivePrice));
        applyStatusBadge(
          tr.querySelector('[data-role="prod-badge"]'),
          tr.querySelector('[data-role="prod-badge-text"]'),
          stockInfo.statusKey
        );
        tr.querySelector('[data-role="prod-edit"]')?.addEventListener('click', () => window.__openProductFormForEdit?.(p));
        tr.querySelector('[data-role="prod-remove"]')?.addEventListener('click', () => window.__removeProductById?.(p.id));
        return tr;
      });
      adminCatalogTbody.replaceChildren(...rows);
    }

    // Admin Inventory & Stock Management
    const adminInvTbody = document.getElementById('admin-inventory-tbody');
    if (adminInvTbody) {
      const metrics = computeMaterialInventoryMetrics(state.materials);
      setTxt('inv-kpi-total-materials', String(metrics.totalMaterials));
      setTxt('inv-kpi-in-stock', String(metrics.inStockCount));
      setTxt('inv-kpi-low-stock', String(metrics.lowStockCount));
      setTxt('inv-kpi-out-stock', String(metrics.outOfStockCount));
      setTxt('inv-kpi-total-value', usd(metrics.totalInventoryValue));

      const catSelect = document.getElementById('admin-inv-category-filter');
      if (catSelect) {
        const categories = getMaterialCategories(state.materials);
        catSelect.replaceChildren(
          createOption('all', 'All Categories', state.adminInventoryCategoryFilter === 'all'),
          ...categories.map((cat) => createOption(cat, cat, state.adminInventoryCategoryFilter === cat))
        );
      }

      const filteredMaterials = filterInventoryMaterials(state.materials, {
        searchQuery: state.adminInventoryStockSearch || '',
        categoryFilter: state.adminInventoryCategoryFilter || 'all',
        statusFilter: state.adminInventoryStockFilter || 'all',
      });
      const pagination = paginateItems(filteredMaterials, state.adminInventoryPage || 1, 5);
      state.adminInventoryPage = pagination.currentPage;

      const rows = pagination.items.map((m) => {
        const tr = cloneTpl('tpl-admin-material-row');
        if (!tr) return document.createElement('tr');
        tr.setAttribute('data-material-row', m.id);
        const st = getMaterialStockStatus(m);
        setRole(tr, 'mat-name', m.name);
        setRole(tr, 'mat-code', `MaterialID: ${m.materialId || m.sku || m.code}`);
        setRole(tr, 'mat-type', m.materialType);
        setRole(tr, 'mat-stock', `${st.availableStock} ${m.unit}`);
        setRole(tr, 'mat-min', `${st.minStockLevel} ${m.unit}`);
        setRole(tr, 'mat-cost', usd(m.unitCost));
        applyStatusBadge(
          tr.querySelector('[data-role="mat-badge"]'),
          tr.querySelector('[data-role="mat-badge-text"]'),
          st.statusKey
        );
        tr.querySelector('[data-role="mat-restock"]')?.addEventListener('click', async () => {
          const movementInput = {
            materialId: m.id,
            transactionType: 'Stock In',
            quantity: 10,
            reason: 'Workshop Raw Material Restock',
            date: new Date().toISOString().slice(0, 10),
          };
          const serverRes = await syncDatabaseStore('record_stock_movement', {
            movementInput,
            adminName: state.sessionUser?.name || 'Admin',
          });
          if (serverRes?.ok && Array.isArray(serverRes.materials)) {
            state.materials = serverRes.materials;
            if (Array.isArray(serverRes.inventoryTransactions))
              state.inventoryTransactions = serverRes.inventoryTransactions;
          } else {
            const res = applyMaterialStockMovement({
              materials: state.materials,
              adminName: 'Admin',
              movementInput,
            });
            if (res.ok) {
              state.materials = res.updatedMaterials;
              state.inventoryTransactions.unshift(res.transaction);
              saveMaterialsToStorage();
            }
          }
          showAdminBanner('Added +10 stock units to material inventory.');
          renderDashboardContent();
        });
        return tr;
      });
      adminInvTbody.replaceChildren(...rows);
    }

    // Admin Vouchers Section
    const vchSelect = document.getElementById('vch-product');
    if (vchSelect) {
      const prev = vchSelect.value;
      vchSelect.replaceChildren(
        ...state.catalog.map((p) =>
          createOption(p.id, `${p.name} (${p.sku} · ${usd(p.effectivePrice)})`, p.id === prev)
        )
      );
    }
    const adminVouchersTbody = document.getElementById('admin-vouchers-tbody');
    if (adminVouchersTbody) {
      setTxt('admin-vouchers-count-heading', `Issued Vouchers (${state.vouchers.length})`);
      const nowMs = Date.now();
      const rows = state.vouchers.map((v) => {
        const tr = cloneTpl('tpl-admin-voucher-row');
        if (!tr) return document.createElement('tr');
        const statusInfo = computeVoucherStatusInfo(v, nowMs);
        setRole(tr, 'vch-code', v.code);
        setRole(tr, 'vch-cust-name', v.customerName || 'Client');
        setRole(tr, 'vch-cust-email', v.customerEmail);
        setRole(tr, 'vch-prod', v.furnitureName || v.productName);
        setRole(tr, 'vch-disc', `-${usd(v.discountAmount ?? v.discountValue ?? 0)}`);
        const stEl = setRole(tr, 'vch-status', statusInfo.status);
        if (stEl) stEl.className = `admin-status-badge ${statusInfo.badgeClass}`;
        const revokeBtn = tr.querySelector('[data-role="vch-revoke"]');
        if (revokeBtn && statusInfo.status !== 'Revoked' && statusInfo.status !== 'Used') {
          revokeBtn.classList.remove('hidden');
          revokeBtn.addEventListener('click', async () => {
            const serverRes = await syncDatabaseStore('revoke_voucher', { voucherId: v.id });
            if (serverRes?.ok && Array.isArray(serverRes.vouchers)) state.vouchers = serverRes.vouchers;
            else {
              const fb = revokeVoucherInList(state.vouchers, v.id, Date.now());
              if (fb.ok) state.vouchers = fb.vouchers;
            }
            showAdminBanner('Voucher has been revoked.');
            renderDashboardContent();
          });
        }
        return tr;
      });
      adminVouchersTbody.replaceChildren(...rows);
    }

    // Admin Orders Section
    const activeOrdersTbody = document.getElementById('admin-active-orders-tbody');
    const completedOrdersTbody = document.getElementById('admin-completed-orders-tbody');
    if (activeOrdersTbody && completedOrdersTbody) {
      const statusOptions = [
        'Order Confirmed · In Production Queue',
        'Timber Selection & Kiln Verification',
        'In Joinery & Millwork',
        'Hand-Rubbed Finishing & Upholstery',
        'Quality Inspection · Ready for Dispatch',
        'Dispatched · White-Glove Transit',
        'Delivered · Completed',
      ];
      const ordQuery = (state.adminOrderSearch || '').trim().toLowerCase();
      const stageFilter = state.adminOrderStage || 'all';
      const { activeOrders, completedOrders } = partitionOrdersByCompletion(state.orders);
      const inProdCount = activeOrders.filter((o) => /Joinery|Finishing|Millwork|Quality/i.test(o.status)).length;
      const matchesOrderQuery = (o) =>
        !ordQuery ||
        o.orderNumber.toLowerCase().includes(ordQuery) ||
        o.clientName.toLowerCase().includes(ordQuery) ||
        o.clientEmail.toLowerCase().includes(ordQuery) ||
        o.furnitureName.toLowerCase().includes(ordQuery);

      const filteredActiveOrders = activeOrders.filter((o) => matchesOrderQuery(o) && stageFilter !== 'completed');
      const filteredCompletedOrders = completedOrders.filter((o) => matchesOrderQuery(o));

      setTxt('admin-orders-total-count', String(state.orders.length));
      setTxt('admin-orders-active-count', String(activeOrders.length));
      setTxt('admin-orders-inprod-count', String(inProdCount));
      setTxt('admin-orders-completed-count', String(completedOrders.length));
      setTxt('admin-active-orders-heading', `Active Orders (${filteredActiveOrders.length})`);
      setTxt('admin-completed-orders-heading', `Completed Orders (${filteredCompletedOrders.length})`);
      setTxt('admin-completed-section-badge', `${completedOrders.length} Completed`);

      const activeRows = filteredActiveOrders.map((o) => {
        const tr = cloneTpl('tpl-admin-active-order-row');
        if (!tr) return document.createElement('tr');
        tr.setAttribute('data-testid', `admin-active-order-row-${o.orderNumber}`);
        setRole(tr, 'ord-num', `#${o.orderNumber}`);
        setRole(tr, 'ord-client', o.clientName);
        setRole(tr, 'ord-email', o.clientEmail);
        setRole(tr, 'ord-prod', o.furnitureName);
        setRole(tr, 'ord-finish', o.selectedFinish);
        setRole(tr, 'ord-total', usd(o.totalAmount));

        const sel = tr.querySelector('[data-role="ord-select"]');
        if (sel) {
          sel.setAttribute('aria-label', `Update status for order ${o.orderNumber}`);
          sel.replaceChildren(...statusOptions.map((st) => createOption(st, st, o.status === st)));
          sel.addEventListener('change', async (e) => {
            const nextStatus = e.target.value;
            const performUpdate = async () => {
              const serverRes = await syncDatabaseStore('update_order_status', {
                orderNumber: o.orderNumber,
                status: nextStatus,
              });
              if (serverRes?.ok && Array.isArray(serverRes.orders)) {
                state.orders = serverRes.orders;
              } else {
                const res = applyAdminOrderUpdate({
                  orders: state.orders,
                  orderNumber: o.orderNumber,
                  updates: { status: nextStatus },
                });
                if (res.ok) {
                  state.orders = res.updatedOrders;
                  saveOrdersToStorage();
                }
              }
              showAdminBanner(`Updated Order #${o.orderNumber} stage to "${nextStatus}".`);
              renderDashboardContent();
            };
            if (/Completed|Delivered/i.test(nextStatus)) {
              openAdminConfirmModal({
                title: `Complete Order #${o.orderNumber}?`,
                message: `Mark Order #${o.orderNumber} (${o.furnitureName}) as Completed?`,
                confirmLabel: 'Yes, Complete Order',
                confirmVariant: 'primary',
                onConfirm: performUpdate,
                onCancel: () => {
                  sel.value = o.status;
                  renderDashboardContent();
                },
              });
            } else {
              await performUpdate();
            }
          });
        }

        if (o.cancellationRequested) {
          const cancelWrap = tr.querySelector('[data-role="ord-cancel-actions"]');
          cancelWrap?.classList.remove('hidden');
          const handleDecision = async (decision) => {
            const serverRes = await syncDatabaseStore('resolve_order_cancellation', {
              orderNumber: o.orderNumber,
              decision,
            });
            if (serverRes?.ok && Array.isArray(serverRes.orders)) state.orders = serverRes.orders;
            else {
              const res = resolveOrderCancellationRequest({ orders: state.orders, orderNumber: o.orderNumber, decision });
              if (res.ok) {
                state.orders = res.updatedOrders;
                saveOrdersToStorage();
              }
            }
            showAdminBanner(
              `${decision === 'approve' ? 'Approved' : 'Declined'} cancellation request for Order #${o.orderNumber}.`
            );
            renderDashboardContent();
          };
          tr.querySelector('[data-role="ord-approve-cancel"]')?.addEventListener('click', () => handleDecision('approve'));
          tr.querySelector('[data-role="ord-decline-cancel"]')?.addEventListener('click', () => handleDecision('decline'));
        }
        return tr;
      });
      activeOrdersTbody.replaceChildren(...activeRows);

      const completedRows = filteredCompletedOrders.map((o) => {
        const tr = cloneTpl('tpl-admin-completed-order-row');
        if (!tr) return document.createElement('tr');
        tr.setAttribute('data-testid', `admin-completed-order-row-${o.orderNumber}`);
        const ordDigits = String(o.orderNumber || '').split('-').pop() || '0000';
        setRole(tr, 'ord-num', `#${o.orderNumber}`);
        setRole(tr, 'ord-tx', o.transactionReference || `TXN-2026-${ordDigits}`);
        setRole(tr, 'ord-client', o.clientName);
        setRole(tr, 'ord-prod', o.furnitureName);
        setRole(tr, 'ord-date', o.completedAt || o.orderDate);
        setRole(tr, 'ord-total', usd(o.totalAmount));
        return tr;
      });
      completedOrdersTbody.replaceChildren(...completedRows);
    }

    // Admin Customer Directory
    const adminCustomersTbody = document.getElementById('admin-customers-tbody');
    if (adminCustomersTbody) {
      const custQuery = (state.adminCustomerSearch || '').trim().toLowerCase();
      const filteredCustomers = customerDirectory.filter(
        (c) => !custQuery || c.name.toLowerCase().includes(custQuery) || c.email.toLowerCase().includes(custQuery)
      );
      const rows = filteredCustomers.map((c) => {
        const tr = cloneTpl('tpl-admin-customer-row');
        if (!tr) return document.createElement('tr');
        setRole(tr, 'cust-name', c.name);
        setRole(tr, 'cust-id', `CustomerID: ${c.customerId || c.id}`);
        setRole(tr, 'cust-email', c.email);
        setRole(tr, 'cust-phone', c.phone);
        setRole(tr, 'cust-address', c.address);
        setRole(tr, 'cust-orders', `${c.orderCount} orders`);
        setRole(tr, 'cust-spent', usd(c.totalSpent));
        return tr;
      });
      adminCustomersTbody.replaceChildren(...rows);
    }

    if (state.activeAdminTab === 'analytics') renderAdminAnalyticsSection();
  }

  function applyOverviewMetricBadge(badgeId, metric) {
    const el = document.getElementById(badgeId);
    if (!el || !metric) return;
    const pct = Math.abs(Number(metric.percentChange ?? metric.percentage ?? 0));
    if (metric.isNewFromZero && Number(metric.value || 0) > 0) {
      el.className = 'monthly-overview-badge is-new';
      el.textContent = 'New';
      return;
    }
    if (metric.direction === 'flat' || pct < 0.05) {
      el.className = 'monthly-overview-badge is-flat';
      el.textContent = 'No change';
      return;
    }
    el.className = `monthly-overview-badge ${metric.direction === 'up' ? 'is-up' : 'is-down'}`;
    el.textContent = `${metric.direction === 'up' ? '↑' : '↓'} ${pct.toFixed(1)}%`;
  }

  function renderAdminAnalyticsSection() {
    const analyticsEl = document.getElementById('admin-tab-analytics');
    if (!analyticsEl) return;

    const nowMs = Date.now();
    const defaultManilaRange = resolveAnalyticsDateRange({ preset: 'this_month' }, nowMs);
    const selectedYear = Number(state.adminAnalyticsYear) || defaultManilaRange.current.year;
    const selectedMonth = Number(state.adminAnalyticsMonth) || defaultManilaRange.current.month;
    const filterInput = {
      preset: state.adminAnalyticsPreset || 'this_month',
      year: selectedYear,
      month: selectedMonth,
      startDate: state.adminAnalyticsStartDate || defaultManilaRange.current.startDate,
      endDate: state.adminAnalyticsEndDate || defaultManilaRange.current.endDate,
    };

    const report = computeMonthlyAnalyticsReport({
      catalog: state.catalog,
      categories: state.categories,
      orders: state.orders,
      customers: state.customers,
      customerProfile: state.customerProfile,
      materials: state.materials,
      inventoryTransactions: state.inventoryTransactions,
      vouchers: state.vouchers,
      filterInput,
      nowMs,
    });
    window.__latestAnalyticsReport = report;
    window.__latestAnalyticsFilter = filterInput;

    const s = report.summary;
    const bestSellers = report.bestSellingProducts;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setTxt('analytics-active-period-label', report.period.label);
    setTxt('analytics-period-start', report.period.startDate);
    setTxt('analytics-period-end', report.period.endDate);

    document.querySelectorAll('[data-analytics-preset]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-analytics-preset') === filterInput.preset);
    });

    const periodSelect = document.getElementById('analytics-overview-period-select');
    if (periodSelect) {
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const opts = [];
      for (let m = 12; m >= 1; m--) {
        const val = `2026-${String(m).padStart(2, '0')}`;
        const isSel = Number(report.period.year) === 2026 && Number(report.period.month) === m;
        opts.push(createOption(val, `${monthNames[m - 1]} 2026`, isSel));
      }
      periodSelect.replaceChildren(...opts);
    }

    setTxt('analytics-kpi-rev-val', usd(s.totalRevenue.value));
    applyOverviewMetricBadge('analytics-kpi-rev-badge', s.totalRevenue);
    setTxt('analytics-kpi-ord-val', String(s.totalOrders.value));
    applyOverviewMetricBadge('analytics-kpi-ord-badge', s.totalOrders);
    setTxt('analytics-kpi-sold-val', String(s.totalProductsSold.value));
    applyOverviewMetricBadge('analytics-kpi-sold-badge', s.totalProductsSold);
    setTxt('analytics-kpi-cust-val', String(s.newCustomers.value));
    applyOverviewMetricBadge('analytics-kpi-cust-badge', s.newCustomers);

    setTxt('analytics-rev-trend-title', `Revenue trend (${report.period.label})`);
    setTxt('analytics-rev-trend-val', usd(s.totalRevenue.value));
    setTxt('analytics-status-completed', String(s.completedOrders.value));
    setTxt('analytics-status-pending', String(s.pendingOrders.value));
    setTxt('analytics-status-cancelled', String(s.cancelledOrders.value));
    setTxt('analytics-kpi-aov', usd(s.averageOrderValue.value));
    setTxt('analytics-kpi-discounts', usd(s.totalDiscountsGiven.value));

    setTxt('analytics-bestsellers-heading', `Top 5 Best-Selling Products (${report.period.label})`);
    const bsTbody = document.getElementById('analytics-best-sellers-tbody');
    if (bsTbody) {
      const rows = (bestSellers.topFive || []).map((item) => {
        const tr = cloneTpl('tpl-analytics-bestseller-row');
        if (!tr) return document.createElement('tr');
        setRole(tr, 'bs-rank', `#${item.rank}`);
        setRole(tr, 'bs-name', item.name);
        setRole(tr, 'bs-cat', item.categoryName);
        setRole(tr, 'bs-qty', `${item.quantitySold} units`);
        setRole(tr, 'bs-rev', usd(item.totalRevenue));
        return tr;
      });
      bsTbody.replaceChildren(...rows);
    }

    setTxt('analytics-tx-heading', `Period Transaction Details (${report.period.label})`);
    setTxt('analytics-tx-count', `${(report.transactions || []).length} Transactions`);
    const txTbody = document.getElementById('analytics-transactions-tbody');
    if (txTbody) {
      const rows = (report.transactions || []).map((t) => {
        const tr = cloneTpl('tpl-analytics-tx-row');
        if (!tr) return document.createElement('tr');
        setRole(tr, 'atx-num', `#${t.orderNumber}`);
        setRole(tr, 'atx-date', t.reportDate || t.completedAt || t.orderDate);
        setRole(tr, 'atx-client', t.clientName);
        setRole(tr, 'atx-prod', t.furnitureName);
        setRole(tr, 'atx-status', t.normalizedStatus);
        setRole(tr, 'atx-rev', usd(t.realizedRevenue));
        return tr;
      });
      txTbody.replaceChildren(...rows);
    }
  }

  return { initDashboardPage };
}
