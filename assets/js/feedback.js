/**
 * Lillia and Rowena Furniture — Centralized UI/UX Feedback, Loading & Confirmation Module
 * File: assets/js/feedback.js
 *
 * Provides reusable, accessible, zero-dependency components for:
 * 1. Logout Confirmation Modal (Customer & Admin) with loading state & flash toast
 * 2. Action Confirmation Dialogs for destructive, irreversible, or financial actions
 * 3. Toast Notification System (success, error, warning, info) with deduplication & flash persistence
 * 4. Button Loading Spinners (preserving button width/height & preventing duplicate clicks)
 * 5. Skeleton Loading Placeholders (Product cards, tables, and dashboard sections)
 * 6. Inline Form Validation Feedback (field-level error messages, focus management, auto-clear)
 * 7. Friendly Empty States & Error Retry States
 */

const FLASH_TOAST_STORAGE_KEY = 'lr_flash_toasts_v1';
const activeToastKeys = new Map();

const TOAST_META = {
  success: {
    defaultTitle: 'Success',
    duration: 4200,
    iconSvg: `<svg class="w-5 h-5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
  },
  error: {
    defaultTitle: 'Action Could Not Be Completed',
    duration: 6500,
    iconSvg: `<svg class="w-5 h-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>`,
  },
  warning: {
    defaultTitle: 'Attention Needed',
    duration: 5000,
    iconSvg: `<svg class="w-5 h-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>`,
  },
  info: {
    defaultTitle: 'Information',
    duration: 4200,
    iconSvg: `<svg class="w-5 h-5 shrink-0 text-[#0095FF]" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>`,
  },
};

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pure helper to normalize a toast configuration object.
 */
export function normalizeToastPayload(input = {}) {
  const rawType = String(input.type || 'info').toLowerCase();
  const type = TOAST_META[rawType] ? rawType : 'info';
  const meta = TOAST_META[type];
  const title = String(input.title || meta.defaultTitle).trim();
  const message = String(input.message || input.description || '').trim();
  const duration =
    typeof input.duration === 'number' && input.duration > 0 ? input.duration : meta.duration;
  const dedupeKey = `${type}:${title}:${message}`.toLowerCase();
  return {
    type,
    title,
    message,
    duration,
    dedupeKey,
    iconSvg: meta.iconSvg,
  };
}

function ensureToastContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById('lr-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lr-toast-container';
    container.className = 'lr-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Display a non-blocking Toast Notification (success, error, warning, info).
 */
export function showToast(options = {}) {
  const normalized = normalizeToastPayload(
    typeof options === 'string' ? { type: 'info', message: options } : options
  );
  if (!normalized.message && !normalized.title) return null;
  if (typeof document === 'undefined') return normalized;

  if (activeToastKeys.has(normalized.dedupeKey)) {
    return activeToastKeys.get(normalized.dedupeKey);
  }

  const container = ensureToastContainer();
  if (!container) return null;

  const toastEl = document.createElement('div');
  toastEl.className = `lr-toast lr-toast-${normalized.type}`;
  toastEl.setAttribute('role', normalized.type === 'error' ? 'alert' : 'status');
  toastEl.setAttribute('data-toast-type', normalized.type);

  toastEl.innerHTML = `
    <div class="lr-toast-icon">${normalized.iconSvg}</div>
    <div class="lr-toast-content">
      <p class="lr-toast-title">${escHtml(normalized.title)}</p>
      ${normalized.message ? `<p class="lr-toast-desc">${escHtml(normalized.message)}</p>` : ''}
    </div>
    <button type="button" class="lr-toast-close" aria-label="Close notification">✕</button>
  `;

  let removed = false;
  const dismissToast = () => {
    if (removed) return;
    removed = true;
    activeToastKeys.delete(normalized.dedupeKey);
    toastEl.classList.add('is-leaving');
    setTimeout(() => {
      toastEl.remove();
    }, 220);
  };

  const closeBtn = toastEl.querySelector('.lr-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', dismissToast);
  }

  activeToastKeys.set(normalized.dedupeKey, toastEl);
  container.appendChild(toastEl);

  requestAnimationFrame(() => {
    toastEl.classList.add('is-visible');
  });

  if (normalized.duration > 0) {
    setTimeout(dismissToast, normalized.duration);
  }

  return toastEl;
}

/**
 * Queue a toast notification to be displayed after a page redirect.
 */
export function queueFlashToast(options = {}) {
  const normalized = normalizeToastPayload(options);
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existingRaw = sessionStorage.getItem(FLASH_TOAST_STORAGE_KEY);
      const list = existingRaw ? JSON.parse(existingRaw) : [];
      const safeList = Array.isArray(list) ? list : [];
      safeList.push({
        type: normalized.type,
        title: normalized.title,
        message: normalized.message,
        duration: normalized.duration,
      });
      sessionStorage.setItem(FLASH_TOAST_STORAGE_KEY, JSON.stringify(safeList));
    }
  } catch (_err) {
    // Ignore storage error
  }
}

/**
 * Consume and display any flash toasts stored in sessionStorage, URL query (?logged_out=1), or server __SERVER_FLASH__.
 */
export function consumeFlashToasts() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Check URL query parameter (?logged_out=1)
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('logged_out') === '1') {
      url.searchParams.delete('logged_out');
      window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
      showToast({
        type: 'success',
        title: 'Logged Out Successfully',
        message: 'You have been safely signed out of your account.',
      });
    }
  } catch (_err) {
    // Ignore URL parse error
  }

  // 2. Check PHP Server Flash message if injected
  if (window.__SERVER_FLASH__ && typeof window.__SERVER_FLASH__ === 'object') {
    const flash = window.__SERVER_FLASH__;
    window.__SERVER_FLASH__ = null;
    if (flash.message || flash.title) {
      showToast(flash);
    }
  }

  // 3. Check sessionStorage flash queue
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(FLASH_TOAST_STORAGE_KEY);
      if (raw) {
        sessionStorage.removeItem(FLASH_TOAST_STORAGE_KEY);
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((item) => showToast(item));
        }
      }
    }
  } catch (_err) {
    // Ignore storage error
  }
}

/**
 * Set a button into a loading state with a CSS spinner while preserving its dimensions.
 * Returns a restore() function that restores the original button state.
 */
export function setButtonLoading(button, loadingText = 'Processing...') {
  if (!button || typeof document === 'undefined') {
    return () => {};
  }
  if (button.getAttribute('data-lr-loading') === 'true') {
    return () => {};
  }

  const rect = button.getBoundingClientRect();
  const originalHtml = button.innerHTML;
  const originalDisabled = button.disabled;
  const originalMinWidth = button.style.minWidth;
  const originalMinHeight = button.style.minHeight;

  if (rect.width > 0) {
    button.style.minWidth = `${Math.ceil(rect.width)}px`;
  }
  if (rect.height > 0) {
    button.style.minHeight = `${Math.ceil(rect.height)}px`;
  }

  button.setAttribute('data-lr-loading', 'true');
  button.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.classList.add('lr-btn-is-loading');

  button.innerHTML = `
    <span class="lr-btn-spinner-wrap">
      <span class="lr-btn-spinner" aria-hidden="true"></span>
      <span>${escHtml(loadingText)}</span>
    </span>
  `;

  return function restoreButton() {
    button.removeAttribute('data-lr-loading');
    button.removeAttribute('aria-busy');
    button.disabled = originalDisabled;
    button.classList.remove('lr-btn-is-loading');
    button.style.minWidth = originalMinWidth;
    button.style.minHeight = originalMinHeight;
    button.innerHTML = originalHtml;
  };
}

/**
 * Execute a sync or async callback while showing a loading spinner on the button.
 * Prevents duplicate clicks and always restores the button if an error occurs.
 */
export async function withButtonLoading(button, loadingText, actionFn) {
  if (button && button.getAttribute('data-lr-loading') === 'true') {
    return undefined;
  }
  const restore = setButtonLoading(button, loadingText);
  try {
    return await actionFn();
  } finally {
    restore();
  }
}

/**
 * Open a reusable, keyboard-accessible Confirmation Modal for important actions
 * (including Logout, Order Cancellation, Product/Material Deletion, Voucher Revocation, Checkout, etc.).
 */
export function openConfirmDialog({
  title = 'Confirm Action',
  message = '',
  description = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel = 'Processing...',
  confirmVariant = '',
  variant = 'danger', // 'danger' | 'primary' | 'warning' | 'logout'
  iconType = '',
  icon = 'warning', // 'logout' | 'danger' | 'warning' | 'info'
  keepOpenOnConfirm = false,
  onConfirm = null,
  onCancel = null,
} = {}) {
  if (typeof document === 'undefined') {
    if (typeof onConfirm === 'function') onConfirm();
    return null;
  }

  const resolvedMessage = description || message || 'Are you sure you want to proceed?';
  const resolvedVariant = confirmVariant || variant || 'danger';
  const resolvedIcon = iconType || icon || 'warning';

  let overlay = document.getElementById('lr-global-confirm-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lr-global-confirm-modal';
    overlay.className = 'lr-confirm-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'lr-confirm-modal-title');
    overlay.setAttribute('aria-describedby', 'lr-confirm-modal-desc');
    document.body.appendChild(overlay);
  }

  const iconMarkup =
    resolvedIcon === 'logout'
      ? `<div class="lr-confirm-icon lr-confirm-icon-logout" aria-hidden="true">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        </div>`
      : resolvedIcon === 'info' || resolvedVariant === 'primary'
      ? `<div class="lr-confirm-icon lr-confirm-icon-info" aria-hidden="true">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>`
      : `<div class="lr-confirm-icon lr-confirm-icon-danger" aria-hidden="true">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>`;

  const confirmBtnClass =
    resolvedVariant === 'primary'
      ? 'lr-confirm-btn lr-confirm-btn-primary'
      : 'lr-confirm-btn lr-confirm-btn-danger';

  overlay.innerHTML = `
    <div class="lr-confirm-card">
      <div class="lr-confirm-header">
        ${iconMarkup}
        <div class="lr-confirm-text-wrap">
          <h3 id="lr-confirm-modal-title" class="lr-confirm-title">${escHtml(title)}</h3>
          <p id="lr-confirm-modal-desc" class="lr-confirm-desc">${escHtml(resolvedMessage)}</p>
        </div>
      </div>
      <div class="lr-confirm-actions">
        <button type="button" id="lr-confirm-cancel-btn" data-confirm-cancel="true" class="lr-confirm-btn lr-confirm-btn-cancel">
          ${escHtml(cancelLabel)}
        </button>
        <button type="button" id="lr-confirm-accept-btn" data-confirm-accept="true" class="${confirmBtnClass}">
          ${escHtml(confirmLabel)}
        </button>
      </div>
    </div>
  `;

  overlay.classList.remove('hidden');

  const cancelBtn = overlay.querySelector('#lr-confirm-cancel-btn');
  const acceptBtn = overlay.querySelector('#lr-confirm-accept-btn');
  let isProcessing = false;

  const closeDialog = () => {
    overlay.classList.add('hidden');
    document.removeEventListener('keydown', onKeyDown);
  };

  const handleCancel = () => {
    if (isProcessing) return;
    closeDialog();
    if (typeof onCancel === 'function') onCancel();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      e.preventDefault();
      handleCancel();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancel);
  }

  overlay.onclick = (e) => {
    if (e.target === overlay) handleCancel();
  };

  if (acceptBtn) {
    acceptBtn.focus();
    acceptBtn.addEventListener('click', async () => {
      if (isProcessing) return;
      isProcessing = true;
      if (cancelBtn) cancelBtn.disabled = true;
      const restore = setButtonLoading(acceptBtn, loadingLabel);
      try {
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
        if (!keepOpenOnConfirm) {
          closeDialog();
        }
      } catch (err) {
        restore();
        if (cancelBtn) cancelBtn.disabled = false;
        isProcessing = false;
        throw err;
      } finally {
        if (!keepOpenOnConfirm) {
          restore();
          if (cancelBtn) cancelBtn.disabled = false;
          isProcessing = false;
        }
      }
    });
  }

  return overlay;
}

/**
 * Requirement 1: Standardized Logout Confirmation Dialog for both Customer and Admin accounts.
 * - Logout icon
 * - Title: "Are you sure you want to log out?"
 * - Description: "You will need to sign in again to access your account."
 * - Cancel button & "Yes, Log Out" button
 * - Spinning indicator + "Logging out..." text + disabled state while logging out
 * - Flash toast notification on destination page
 */
export function confirmAndExecuteLogout(onLogoutConfirm) {
  return openConfirmDialog({
    title: 'Are you sure you want to log out?',
    description: 'You will need to sign in again to access your account.',
    confirmLabel: 'Yes, Log Out',
    cancelLabel: 'Cancel',
    loadingLabel: 'Logging out...',
    confirmVariant: 'danger',
    iconType: 'logout',
    keepOpenOnConfirm: false,
    onConfirm: async () => {
      if (typeof onLogoutConfirm === 'function') {
        await onLogoutConfirm();
      }
    },
  });
}

/**
 * Form Validation Feedback Helpers:
 * - Highlights invalid input (.has-error)
 * - Renders inline error message directly below the field (.lr-field-error)
 * - Auto-clears when the user edits the field
 */
export function setFieldError(inputEl, message, focusOrOptions = false) {
  if (!inputEl) return;
  const focus =
    typeof focusOrOptions === 'boolean'
      ? focusOrOptions
      : Boolean(focusOrOptions && focusOrOptions.focus);
  inputEl.classList.add('has-error');
  inputEl.setAttribute('aria-invalid', 'true');

  const parent = inputEl.parentElement;
  if (parent) {
    let errEl = parent.querySelector('.lr-field-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'lr-field-error';
      errEl.setAttribute('role', 'alert');
      parent.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  const clearOnInput = () => {
    clearFieldError(inputEl);
    inputEl.removeEventListener('input', clearOnInput);
    inputEl.removeEventListener('change', clearOnInput);
  };
  inputEl.addEventListener('input', clearOnInput);
  inputEl.addEventListener('change', clearOnInput);

  if (focus && typeof inputEl.focus === 'function') {
    inputEl.focus();
  }
}

export function clearFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('has-error');
  inputEl.removeAttribute('aria-invalid');
  const parent = inputEl.parentElement;
  if (parent) {
    const errEl = parent.querySelector('.lr-field-error');
    if (errEl) errEl.remove();
  }
}

export function clearFormErrors(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('.has-error').forEach((el) => {
    el.classList.remove('has-error');
    el.removeAttribute('aria-invalid');
  });
  formEl.querySelectorAll('.lr-field-error').forEach((el) => el.remove());
}

/**
 * Skeleton Loading Placeholders for Product Cards, Tables, and Dashboard Metrics.
 */
export function renderProductCardSkeletons(containerOrCount = 4, maybeCount = 4) {
  const isElement =
    containerOrCount &&
    typeof containerOrCount === 'object' &&
    'innerHTML' in containerOrCount;
  const count = isElement ? maybeCount : containerOrCount;
  const safeCount = Math.max(1, Math.min(12, Number(count) || 4));
  const markup = Array.from({ length: safeCount })
    .map(
      () => `
      <div class="rounded-2xl bg-white border border-slate-200 overflow-hidden p-4 space-y-3" aria-hidden="true">
        <div class="lr-skeleton aspect-[4/3] w-full rounded-xl"></div>
        <div class="space-y-2 pt-1">
          <div class="lr-skeleton h-3 w-24 rounded"></div>
          <div class="lr-skeleton h-5 w-3/4 rounded"></div>
          <div class="lr-skeleton h-3 w-full rounded"></div>
          <div class="lr-skeleton h-3 w-2/3 rounded"></div>
        </div>
        <div class="lr-skeleton h-10 w-full rounded-xl mt-2"></div>
      </div>
    `
    )
    .join('');
  if (isElement) {
    containerOrCount.innerHTML = markup;
  }
  return markup;
}

export function renderTableSkeletonRows(columns = 5, rows = 4) {
  const safeCols = Math.max(1, Number(columns) || 5);
  const safeRows = Math.max(1, Number(rows) || 4);
  return Array.from({ length: safeRows })
    .map(
      () => `
      <tr aria-hidden="true">
        ${Array.from({ length: safeCols })
          .map(() => `<td class="py-3 px-4"><div class="lr-skeleton h-4 w-full rounded"></div></td>`)
          .join('')}
      </tr>
    `
    )
    .join('');
}

/**
 * Reusable Friendly Empty State markup generator.
 */
export function buildEmptyStateHtml({
  title = 'No records found',
  description = 'There are no items to display right now.',
  actionLabel = '',
  actionId = '',
  actionAttr = '',
} = {}) {
  return `
    <div class="lr-empty-state">
      <div class="lr-empty-state-icon" aria-hidden="true">
        <svg class="w-6 h-6 text-[#0095FF]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <p class="lr-empty-state-title">${escHtml(title)}</p>
      <p class="lr-empty-state-desc">${escHtml(description)}</p>
      ${
        actionLabel
          ? `<div class="pt-2">
              <button type="button" ${actionId ? `id="${escHtml(actionId)}"` : ''} ${actionAttr} class="px-4 py-2 rounded-xl bg-[#0095FF] hover:bg-[#0077CC] text-white text-xs font-semibold cursor-pointer transition-colors">
                ${escHtml(actionLabel)}
              </button>
            </div>`
          : ''
      }
    </div>
  `;
}
