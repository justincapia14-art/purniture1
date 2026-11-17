/**
 * Lillia and Rowena Furniture — Client-Side Login & Registration UI Controller
 * Delegates credential validation, authentication, and account registration to PHP (`src/api.php`).
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const form = $('lr-login-form');
  const nameGroup = $('register-name-group');
  const nameInput = $('register-name');
  const phoneGroup = $('register-phone-group');
  const phoneInput = $('register-phone');
  const addressGroup = $('register-address-group');
  const addressInput = $('register-address');
  const emailInput = $('login-email');
  const passwordInput = $('login-password');
  const roleInput = $('login-role');
  const modeInput = $('login-mode');
  const roleButtons = document.querySelectorAll('[data-role-tab]');
  const authModeTabs = $('customer-auth-mode-tabs');
  const signInBtn = $('auth-mode-signin');
  const registerBtn = $('auth-mode-register');
  const demoBox = $('demo-credentials-box');
  const fillDemoBtn = $('fill-demo-credentials');
  const demoEmailLabel = $('demo-email-preview');
  const errorBanner = $('login-error-banner');
  const submitButton = $('login-submit-btn');
  const headingTitle = $('login-heading-title');
  const headingSubtitle = $('login-heading-subtitle');
  const sessionBanner = $('login-active-session-banner');
  const sessionUserEl = $('login-active-session-user');
  const sessionActions = $('login-active-session-actions');

  const DEMO = {
    Customer: { email: 'rowena.vance@vancearchitects.com', password: 'ClientPass2025!', label: 'Sign In to My Account →' },
    Admin: { email: 'admin@lilliarowena.com', password: 'MasterJoinery#01', label: 'Sign In to Admin Console →' },
  };

  let currentRole = 'Customer';
  let currentMode = 'signin';
  const API_ENDPOINT = window.location.pathname.includes('/src/') ? 'api.php' : 'src/api.php';

  const showError = (msg) => {
    if (!errorBanner) return;
    errorBanner.textContent = msg;
    errorBanner.style.display = 'block';
  };

  const hideError = () => {
    [nameInput, emailInput, passwordInput, phoneInput, addressInput].forEach((el) => el?.classList.remove('has-error'));
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.style.display = 'none';
    }
  };

  const primaryLink = $('login-session-primary-link');
  const secondaryLink = $('login-session-secondary-link');
  const logoutBtn = $('login-page-logout-btn');

  logoutBtn?.addEventListener('click', async () => {
    await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_session', sessionUser: null }),
    }).catch(() => {});
    renderActiveSessionBanner();
  });

  async function renderActiveSessionBanner() {
    if (!sessionBanner || !sessionUserEl || !sessionActions) return;
    try {
      const res = await fetch(`${API_ENDPOINT}?action=state`, { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      const session = data?.sessionUser;
      if (!session?.email || !session?.role) {
        sessionBanner.style.display = 'none';
        return;
      }
      const isAdmin = String(session.role).toLowerCase() === 'admin';
      sessionBanner.style.display = 'block';
      sessionUserEl.textContent = `${session.name || session.email} (${isAdmin ? 'Admin' : 'Customer'})`;
      if (primaryLink) {
        primaryLink.href = isAdmin ? 'dashboard.html?role=admin' : 'dashboard.html?role=client&tab=home';
        primaryLink.textContent = isAdmin ? 'Admin Dashboard →' : 'My Account →';
      }
      if (secondaryLink) {
        secondaryLink.href = isAdmin ? 'index.html' : 'dashboard.html?role=client&tab=orders';
        secondaryLink.textContent = isAdmin ? 'Back to Showroom' : 'My Orders';
      }
    } catch {
      sessionBanner.style.display = 'none';
    }
  }

  function updateAuthUI() {
    const isAdmin = currentRole === 'Admin';
    const isReg = !isAdmin && currentMode === 'register';
    if (roleInput) roleInput.value = currentRole;
    if (modeInput) modeInput.value = isReg ? 'register' : 'signin';
    roleButtons.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-role-tab') === currentRole));
    if (authModeTabs) authModeTabs.style.display = isAdmin ? 'none' : 'flex';
    if (signInBtn && registerBtn) {
      signInBtn.style.background = !isReg ? '#0F172A' : 'transparent';
      signInBtn.style.color = !isReg ? '#FFFFFF' : '#475569';
      registerBtn.style.background = isReg ? '#0F172A' : 'transparent';
      registerBtn.style.color = isReg ? '#FFFFFF' : '#475569';
    }
    [nameGroup, phoneGroup, addressGroup].forEach((g) => { if (g) g.style.display = isReg ? 'block' : 'none'; });
    if (demoBox) demoBox.style.display = isReg ? 'none' : 'flex';

    if (isAdmin || !isReg) {
      const preset = isAdmin ? DEMO.Admin : DEMO.Customer;
      if (headingTitle) headingTitle.textContent = isAdmin ? 'Admin Console Sign In' : 'Sign In to Your Account';
      if (headingSubtitle) {
        headingSubtitle.textContent = isAdmin
          ? 'Sign in with administrator credentials to manage products, workshop materials & stock, vouchers, and orders.'
          : 'Sign in to view your orders, manage your shopping cart, and redeem personal discount vouchers.';
      }
      if (emailInput) emailInput.value = preset.email;
      if (passwordInput) passwordInput.value = preset.password;
      if (demoEmailLabel) demoEmailLabel.textContent = preset.email;
      if (submitButton) submitButton.textContent = preset.label;
    } else {
      if (headingTitle) headingTitle.textContent = 'Create Your Account';
      if (headingSubtitle) headingSubtitle.textContent = 'Enter your full name, email, password, phone number, and delivery address to create your customer account.';
      if (emailInput && (emailInput.value === DEMO.Admin.email || emailInput.value === DEMO.Customer.email)) emailInput.value = '';
      if (passwordInput && (passwordInput.value === DEMO.Admin.password || passwordInput.value === DEMO.Customer.password)) passwordInput.value = '';
      if (submitButton) submitButton.textContent = 'Create Account & Continue →';
    }
    hideError();
  }

  roleButtons.forEach((btn) => btn.addEventListener('click', () => {
    currentRole = btn.getAttribute('data-role-tab') === 'Admin' ? 'Admin' : 'Customer';
    if (currentRole === 'Admin') currentMode = 'signin';
    updateAuthUI();
  }));
  signInBtn?.addEventListener('click', () => { currentMode = 'signin'; updateAuthUI(); });
  registerBtn?.addEventListener('click', () => { currentMode = 'register'; currentRole = 'Customer'; updateAuthUI(); });
  fillDemoBtn?.addEventListener('click', () => { currentMode = 'signin'; updateAuthUI(); });

  const params = new URLSearchParams(window.location.search);
  if ((params.get('role') || '').toLowerCase() === 'admin') currentRole = 'Admin';
  else if ((params.get('mode') || '').toLowerCase() === 'register') currentMode = 'register';
  updateAuthUI();
  renderActiveSessionBanner();

  form?.addEventListener('submit', async (event) => {
    hideError();
    const formAction = (form.getAttribute('action') || '').toLowerCase();
    if (window.location.pathname.endsWith('.php') || formAction.includes('index.php')) return;
    event.preventDefault();

    const role = roleInput?.value || 'Customer';
    const isReg = role !== 'Admin' && currentMode === 'register';
    const payload = isReg
      ? {
          action: 'register_customer',
          fullName: nameInput?.value.trim() || '',
          email: emailInput?.value.trim() || '',
          password: passwordInput?.value || '',
          phoneNumber: phoneInput?.value.trim() || '',
          address: addressInput?.value.trim() || '',
        }
      : {
          action: 'login_user',
          email: emailInput?.value.trim() || '',
          password: passwordInput?.value || '',
          role,
        };

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok === false) {
        showError(data?.error || 'Authentication failed. Please check your credentials.');
        return;
      }
      const targetRole = role === 'Admin' ? 'admin' : 'client';
      if ((params.get('redirect') || '').toLowerCase() === 'request-design' && targetRole !== 'admin') {
        window.location.href = 'index.html?trigger=request-design';
        return;
      }
      window.location.href = `dashboard.html?role=${targetRole}`;
    } catch {
      showError('Unable to reach authentication server. Please try again.');
    }
  });
});
