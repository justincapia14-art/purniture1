/**
 * Part 5: Lillia and Rowena Furniture — Client-Side Login & Registration Controller
 * File: assets/js/login.js
 * Communicates with server-side PDO endpoint (`api.php`) instead of browser `localStorage`.
 */

import {
  consumeFlashToasts,
  showToast,
  queueFlashToast,
  withButtonLoading,
  confirmAndExecuteLogout,
  setFieldError,
  clearFormErrors,
} from './feedback.js';

document.addEventListener('DOMContentLoaded', () => {
  consumeFlashToasts();

  const form = document.getElementById('lr-login-form');
  const nameGroup = document.getElementById('register-name-group');
  const nameInput = document.getElementById('register-name');
  const phoneGroup = document.getElementById('register-phone-group');
  const phoneInput = document.getElementById('register-phone');
  const addressGroup = document.getElementById('register-address-group');
  const addressInput = document.getElementById('register-address');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const modeInput = document.getElementById('login-mode');
  const authModeTabsContainer = document.getElementById('customer-auth-mode-tabs');
  const signInModeBtn = document.getElementById('auth-mode-signin');
  const registerModeBtn = document.getElementById('auth-mode-register');
  const errorBanner = document.getElementById('login-error-banner');
  const submitButton = document.getElementById('login-submit-btn');
  const headingTitle = document.getElementById('login-heading-title');
  const headingSubtitle = document.getElementById('login-heading-subtitle');
  const activeSessionBanner = document.getElementById('login-active-session-banner');
  const activeSessionUser = document.getElementById('login-active-session-user');
  const activeSessionActions = document.getElementById('login-active-session-actions');

  let currentMode = 'signin'; // 'signin' | 'register'
  let serverStoreCache = null;
  const API_ENDPOINT = window.location.pathname.includes('/src/') ? 'api.php' : 'src/api.php';

  async function fetchServerState() {
    try {
      const res = await fetch(`${API_ENDPOINT}?action=state`, { cache: 'no-store' });
      if (res.ok) {
        serverStoreCache = await res.json();
        return serverStoreCache;
      }
    } catch (_e) {
      // Ignore network error
    }
    return null;
  }

  async function renderActiveSessionBanner() {
    if (!activeSessionBanner || !activeSessionUser || !activeSessionActions) return;
    try {
      const data = (await fetchServerState()) || serverStoreCache;
      const session = data?.sessionUser || null;
      if (!session || !session.email || !session.role) {
        activeSessionBanner.style.display = 'none';
        return;
      }

      const isAdmin = String(session.role).toLowerCase() === 'admin';
      const displayName = session.name || session.email;
      activeSessionBanner.style.display = 'block';
      activeSessionUser.textContent = `${displayName} (${isAdmin ? 'Admin' : 'Customer'})`;
      activeSessionActions.innerHTML = isAdmin
        ? `
    <a href="dashboard.html?role=admin" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: #0095FF; color: #FFF; font-size: 0.75rem; font-weight: 700; text-decoration: none;">Admin Dashboard →</a>
    <a href="index.html" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: #FFFFFF; border: 1px solid #CBD5E1; color: #0F172A; font-size: 0.75rem; font-weight: 700; text-decoration: none;">Back to Showroom</a>
    <button type="button" id="login-page-logout-btn" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: #FEE2E2; border: 1px solid #FECACA; color: #DC2626; font-size: 0.75rem; font-weight: 700; cursor: pointer;">Log Out</button>
        `
        : `
    <a href="dashboard.html?role=client&tab=home" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: #0095FF; color: #FFF; font-size: 0.75rem; font-weight: 700; text-decoration: none;">My Account →</a>
    <a href="dashboard.html?role=client&tab=orders" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: #FFFFFF; border: 1px solid #CBD5E1; color: #0F172A; font-size: 0.75rem; font-weight: 700; text-decoration: none;">My Orders</a>
    <button type="button" id="login-page-logout-btn" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: #FEE2E2; border: 1px solid #FECACA; color: #DC2626; font-size: 0.75rem; font-weight: 700; cursor: pointer;">Log Out</button>
        `;

      const logoutBtn = document.getElementById('login-page-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          confirmAndExecuteLogout(async () => {
            try {
              await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_session', sessionUser: null }),
              });
            } catch (_err) {
              // Ignore network error
            }
            await renderActiveSessionBanner();
            showToast({
              type: 'success',
              title: 'Logged Out Successfully',
              message: 'You have been safely signed out of your account.',
            });
          });
        });
      }
    } catch (_e) {
      activeSessionBanner.style.display = 'none';
    }
  }

  function updateAuthUI() {
    const isRegister = currentMode === 'register';

    if (modeInput) modeInput.value = isRegister ? 'register' : 'signin';

    if (authModeTabsContainer) {
      authModeTabsContainer.style.display = 'flex';
    }

    if (signInModeBtn && registerModeBtn) {
      signInModeBtn.style.background = !isRegister ? '#0F172A' : 'transparent';
      signInModeBtn.style.color = !isRegister ? '#FFFFFF' : '#475569';
      registerModeBtn.style.background = isRegister ? '#0F172A' : 'transparent';
      registerModeBtn.style.color = isRegister ? '#FFFFFF' : '#475569';
    }

    if (nameGroup) {
      nameGroup.style.display = isRegister ? 'block' : 'none';
    }
    if (phoneGroup) {
      phoneGroup.style.display = isRegister ? 'block' : 'none';
    }
    if (addressGroup) {
      addressGroup.style.display = isRegister ? 'block' : 'none';
    }

    if (isRegister) {
      if (headingTitle) headingTitle.textContent = 'Create Your Account';
      if (headingSubtitle) {
        headingSubtitle.textContent =
          'Enter your full name, email, password, phone number, and delivery address to create your customer account.';
      }
      if (submitButton) submitButton.textContent = 'Create Account & Continue →';
    } else {
      if (headingTitle) headingTitle.textContent = 'Sign In to Your Account';
      if (headingSubtitle) {
        headingSubtitle.textContent =
          'Access your orders, saved delivery address, and personal vouchers, or create a new customer account.';
      }
      if (submitButton) submitButton.textContent = 'Sign In to My Account →';
    }

    hideError();
  }

  function setMode(mode) {
    currentMode = mode === 'register' ? 'register' : 'signin';
    updateAuthUI();
  }

  function showError(message, toastTitle = 'Authentication Error') {
    if (errorBanner) {
      errorBanner.textContent = message;
      errorBanner.style.display = 'block';
    }
    showToast({
      type: 'error',
      title: toastTitle,
      message,
    });
  }

  function hideError() {
    if (form) {
      clearFormErrors(form);
    } else {
      [nameInput, emailInput, passwordInput, phoneInput, addressInput].forEach((el) => {
        if (el) el.classList.remove('has-error');
      });
    }
    if (!errorBanner) return;
    errorBanner.textContent = '';
    errorBanner.style.display = 'none';
  }

  if (signInModeBtn) {
    signInModeBtn.addEventListener('click', () => setMode('signin'));
  }
  if (registerModeBtn) {
    registerModeBtn.addEventListener('click', () => setMode('register'));
  }

  // Check URL query parameters (?mode=register)
  const params = new URLSearchParams(window.location.search);
  const urlMode = (params.get('mode') || '').toLowerCase();
  if (urlMode === 'register') {
    setMode('register');
  } else {
    updateAuthUI();
  }

  renderActiveSessionBanner();

  if (form) {
    form.addEventListener('submit', async (event) => {
      hideError();
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      const isRegister = currentMode === 'register';
      const fullName = nameInput ? nameInput.value.trim() : '';
      const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
      const address = addressInput ? addressInput.value.trim() : '';

      let firstInvalidField = null;
      let firstErrorMessage = '';

      if (isRegister && fullName.length < 2) {
        const msg = 'Please enter your full name (at least 2 characters).';
        setFieldError(nameInput, msg, false);
        firstInvalidField = firstInvalidField || nameInput;
        firstErrorMessage = firstErrorMessage || msg;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const msg = 'Please enter a valid email address.';
        setFieldError(emailInput, msg, false);
        firstInvalidField = firstInvalidField || emailInput;
        firstErrorMessage = firstErrorMessage || msg;
      }

      if (!password || password.length < 6) {
        const msg = 'Password must be at least 6 characters.';
        setFieldError(passwordInput, msg, false);
        firstInvalidField = firstInvalidField || passwordInput;
        firstErrorMessage = firstErrorMessage || msg;
      }

      if (isRegister && phoneNumber.length < 7) {
        const msg = 'Please enter a valid phone number.';
        setFieldError(phoneInput, msg, false);
        firstInvalidField = firstInvalidField || phoneInput;
        firstErrorMessage = firstErrorMessage || msg;
      }

      if (isRegister && address.length < 5) {
        const msg = 'Please enter your complete delivery address.';
        setFieldError(addressInput, msg, false);
        firstInvalidField = firstInvalidField || addressInput;
        firstErrorMessage = firstErrorMessage || msg;
      }

      if (firstInvalidField) {
        event.preventDefault();
        if (typeof firstInvalidField.focus === 'function') {
          firstInvalidField.focus();
        }
        showError(firstErrorMessage, 'Please Check Required Fields');
        return;
      }

      const formAction = (form.getAttribute('action') || '').toLowerCase();
      if (window.location.pathname.endsWith('.php') || formAction.includes('index.php')) {
        if (submitButton) {
          submitButton.disabled = true;
        }
        return;
      }

      event.preventDefault();

      let targetRoleParam = 'client';
      let redirectNow = false;
      let authenticatedName = fullName || email;

      await withButtonLoading(
        submitButton,
        isRegister ? 'Creating account...' : 'Signing in...',
        async () => {
          try {
            if (isRegister) {
              const regRes = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'register_customer',
                  fullName,
                  email,
                  password,
                  phoneNumber,
                  address,
                }),
              });
              const regData = await regRes.json().catch(() => null);
              if (!regRes.ok || (regData && regData.ok === false)) {
                const errMsg =
                  regData?.error || 'Could not register account. That email may already be registered.';
                if (regData?.errors && typeof regData.errors === 'object') {
                  if (regData.errors.fullName) setFieldError(nameInput, regData.errors.fullName, false);
                  if (regData.errors.email) setFieldError(emailInput, regData.errors.email, false);
                  if (regData.errors.password) setFieldError(passwordInput, regData.errors.password, false);
                  if (regData.errors.phoneNumber) setFieldError(phoneInput, regData.errors.phoneNumber, false);
                  if (regData.errors.address) setFieldError(addressInput, regData.errors.address, false);
                }
                showError(errMsg, 'Registration Failed');
                return;
              }
              authenticatedName =
                regData?.user?.fullName || regData?.sessionUser?.name || fullName || email;
              targetRoleParam = 'client';
              redirectNow = true;
            } else {
              const loginRes = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'login_user',
                  email,
                  password,
                }),
              });
              const loginData = await loginRes.json().catch(() => null);
              if (!loginRes.ok || !loginData || loginData.ok === false) {
                showError(
                  loginData?.error ||
                    'Incorrect email or password. Please verify your credentials and try again.',
                  'Incorrect Email or Password'
                );
                return;
              }
              const detectedRoleRaw = String(
                loginData.sessionUser?.role || loginData.user?.role || 'Customer'
              ).toLowerCase();
              authenticatedName =
                loginData.sessionUser?.name ||
                loginData.user?.fullName ||
                loginData.user?.name ||
                email;
              targetRoleParam = detectedRoleRaw === 'admin' ? 'admin' : 'client';
              redirectNow = true;
            }
          } catch (_e) {
            showError(
              'Unable to reach authentication server. Please check your connection and try again.',
              'Connection Error'
            );
          }
        }
      );

      if (!redirectNow) {
        return;
      }

      queueFlashToast({
        type: 'success',
        title: isRegister ? 'Account Created Successfully' : 'Signed In Successfully',
        message: isRegister
          ? `Welcome to Lillia and Rowena Furniture, ${authenticatedName}!`
          : `Welcome back, ${authenticatedName}.`,
      });

      const redirectParam = (params.get('redirect') || '').toLowerCase();
      if (redirectParam === 'request-design' && targetRoleParam !== 'admin') {
        window.location.href = 'index.html?trigger=request-design';
        return;
      }
      window.location.href = `dashboard.html?role=${targetRoleParam}`;
    });
  }
});

