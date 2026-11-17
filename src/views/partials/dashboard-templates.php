<!-- Dashboard Reusable HTML Templates (src/views/partials/dashboard-templates.php) -->
<template id="tpl-client-home-order">
  <div class="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex items-center gap-3.5">
      <img data-role="ord-img" src="" alt="" class="w-16 h-16 rounded-xl object-cover border border-[#BCE3FF] shrink-0" />
      <div>
        <p data-role="ord-status-num" class="font-mono-tech text-xs text-[#0077CC] font-bold"></p>
        <h3 data-role="ord-title" class="font-serif-display text-base font-bold text-[#0D1015] mt-0.5"></h3>
        <p class="text-xs text-[#475569]">
          Finish: <strong data-role="ord-finish" class="text-[#0D1015]"></strong> · Size: <span data-role="ord-dims"></span>
        </p>
      </div>
    </div>
    <p data-role="ord-total" class="font-mono-tech text-lg font-bold text-[#0095FF] shrink-0"></p>
  </div>
</template>

<template id="tpl-client-catalog-card">
  <div class="p-4 rounded-2xl border border-[#BCE3FF] bg-[#F8FBFF] flex flex-col justify-between gap-3 h-full">
    <div class="flex items-start gap-3.5">
      <img data-role="cat-img" src="" alt="" class="w-16 h-16 rounded-xl object-cover border border-[#BCE3FF] shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-1">
          <span data-role="cat-name" class="text-[11px] font-semibold uppercase tracking-wider text-[#0077CC]"></span>
          <span data-role="cat-avail" class="text-[11px] font-mono-tech font-semibold text-emerald-700"></span>
        </div>
        <h3 data-role="prod-name" class="font-serif-display text-sm font-bold text-[#0D1015] truncate mt-0.5"></h3>
        <p data-role="prod-price" class="font-mono-tech text-sm font-bold text-[#0095FF] mt-1"></p>
      </div>
    </div>
    <div class="pt-2 border-t border-[#E2E8F0] mt-auto">
      <a data-role="prod-link" href="" class="block px-3 py-2 rounded-xl bg-[#0D1015] hover:bg-[#0095FF] text-white text-xs font-semibold transition-colors text-center"></a>
    </div>
  </div>
</template>

<template id="tpl-client-order-card">
  <article class="bg-white rounded-3xl border border-[#BCE3FF] p-6 sm:p-7 shadow-2xs space-y-5">
    <div class="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
      <div class="flex items-center gap-4">
        <img data-role="ord-img" src="" alt="" class="w-20 h-20 rounded-2xl object-cover border border-[#BCE3FF] shrink-0" />
        <div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span data-role="ord-status" class="font-semibold"></span>
            <span>·</span>
            <span data-role="ord-number" class="font-mono-tech text-[#64748B]"></span>
            <span data-role="ord-completed-badge" class="hidden px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold">✓ Completed · In Completed Transactions</span>
            <span data-role="ord-cancel-badge" class="hidden px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">Cancellation Pending Admin Approval</span>
          </div>
          <h3 data-role="ord-name" class="font-serif-display text-xl font-bold text-[#0D1015] mt-1"></h3>
          <p class="text-xs text-[#475569] mt-0.5">
            Color Finish: <span data-role="ord-finish" class="font-semibold text-[#0D1015]"></span> · Size: <span data-role="ord-dims"></span>
          </p>
        </div>
      </div>
      <div class="sm:text-right shrink-0">
        <p data-role="ord-payment-summary" class="text-xs text-[#64748B]"></p>
        <p data-role="ord-total" class="font-mono-tech text-2xl font-bold text-[#0095FF]"></p>
      </div>
    </div>
    <div class="p-4 rounded-2xl bg-[#F8FBFF] border border-[#E2E8F0] space-y-3">
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-[#0D1015]">Workshop &amp; Delivery Progress</span>
        <span data-role="ord-pct-label" class="font-mono-tech font-bold"></span>
      </div>
      <div class="w-full h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
        <div data-role="ord-pct-bar" class="h-full rounded-full"></div>
      </div>
      <div data-role="ord-steps" class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1"></div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" data-role="ord-pay-btn" class="hidden px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"></button>
        <button type="button" data-role="ord-cancel-btn" class="hidden px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer">Request Cancel Order</button>
      </div>
      <a data-role="ord-messenger-link" href="https://www.messenger.com/t/100000505712325" target="_blank" rel="noopener noreferrer" class="font-semibold text-[#0095FF] hover:underline">Ask Owner About This Order on Messenger ↗</a>
    </div>
  </article>
</template>

<template id="tpl-client-order-step">
  <div data-role="step-wrap" class="flex items-center gap-1.5 text-[11px]">
    <span data-role="step-dot" class="w-4 h-4 rounded-full flex items-center justify-center text-[10px]"></span>
    <span data-role="step-label"></span>
  </div>
</template>

<template id="tpl-client-tx-row">
  <tr>
    <td data-role="tx-id" class="font-mono-tech text-xs font-bold text-[#0D1015] whitespace-nowrap"></td>
    <td data-role="tx-ord" class="font-mono-tech text-xs font-bold text-[#0095FF] whitespace-nowrap"></td>
    <td data-role="tx-date" class="font-mono-tech text-xs text-[#475569] whitespace-nowrap"></td>
    <td class="admin-col-primary">
      <p data-role="tx-piece" class="admin-table-title"></p>
      <p data-role="tx-meta" class="admin-table-sub"></p>
    </td>
    <td class="whitespace-nowrap">
      <span class="admin-status-badge admin-status-in-stock">
        <span class="admin-status-badge-dot"></span>
        <span data-role="tx-status"></span>
      </span>
    </td>
    <td data-role="tx-amount" class="text-right font-mono-tech font-bold text-[#0D1015] whitespace-nowrap"></td>
  </tr>
</template>

<template id="tpl-client-cart-item">
  <article class="bg-white rounded-3xl border border-[#BCE3FF] p-5 shadow-2xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
    <div class="flex items-center gap-4 min-w-0">
      <img data-role="cart-img" src="" alt="" class="w-20 h-20 rounded-2xl object-cover border border-[#BCE3FF] shrink-0" />
      <div class="min-w-0 space-y-1">
        <h3 data-role="cart-name" class="font-serif-display text-lg font-bold text-[#0D1015] truncate"></h3>
        <p class="text-xs text-[#475569]">
          Finish: <span data-role="cart-finish" class="font-semibold text-[#0D1015]"></span> · <span data-role="cart-unit-price"></span> each
        </p>
        <div class="flex items-center gap-3 pt-1">
          <div class="inline-flex items-center rounded-xl border border-[#BCE3FF] bg-[#F8FBFF]">
            <button type="button" data-role="cart-dec" class="px-3 py-1 text-xs font-bold cursor-pointer">−</button>
            <span data-role="cart-qty" class="px-3 py-1 font-mono-tech text-xs font-bold"></span>
            <button type="button" data-role="cart-inc" class="px-3 py-1 text-xs font-bold cursor-pointer">+</button>
          </div>
          <button type="button" data-role="cart-remove" class="text-xs font-semibold text-rose-700 hover:underline cursor-pointer">Remove</button>
        </div>
      </div>
    </div>
    <div class="sm:text-right shrink-0">
      <p data-role="cart-line-total" class="font-mono-tech text-lg font-bold text-[#0D1015]"></p>
    </div>
  </article>
</template>

<template id="tpl-client-voucher-card">
  <div class="p-5 sm:p-6 rounded-3xl border border-[#BCE3FF] bg-white space-y-4 shadow-2xs flex flex-col justify-between">
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <span data-role="vch-discount" class="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#EBF6FF] border border-[#BCE3FF] font-mono-tech text-xs font-bold text-[#0077CC]"></span>
          <h3 data-role="vch-product" class="font-serif-display text-base font-bold text-[#0D1015] mt-2"></h3>
        </div>
        <span data-role="vch-status-badge" class="admin-status-badge">
          <span class="admin-status-badge-dot"></span>
          <span data-role="vch-status-text"></span>
        </span>
      </div>
      <div class="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#F8FBFF] border border-[#BCE3FF]">
        <code data-role="vch-code" class="font-mono-tech text-sm font-bold text-[#0D1015]"></code>
        <button type="button" data-role="vch-copy-btn" class="px-3 py-1.5 rounded-lg bg-[#EBF6FF] text-[#0077CC] text-xs font-semibold cursor-pointer">Copy Code</button>
      </div>
      <div class="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
        <div>
          <span class="block text-[10px] font-semibold uppercase text-slate-400">Issued (PHT)</span>
          <span data-role="vch-issued" class="font-semibold text-slate-800 block mt-0.5"></span>
        </div>
        <div>
          <span class="block text-[10px] font-semibold uppercase text-slate-400">Expires (PHT)</span>
          <span data-role="vch-expires" class="font-semibold text-slate-800 block mt-0.5"></span>
        </div>
      </div>
    </div>
    <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
      <span data-role="vch-countdown" class="vch-remaining-badge"></span>
      <button type="button" data-role="vch-use-btn" class="hidden px-3.5 py-2 rounded-xl bg-[#0095FF] text-white text-xs font-semibold cursor-pointer">Use in Checkout →</button>
    </div>
  </div>
</template>

<template id="tpl-admin-category-bar">
  <div>
    <div class="flex items-center justify-between text-xs">
      <span data-role="bar-label" class="font-semibold text-slate-800"></span>
      <span data-role="bar-count" class="font-mono-tech text-slate-500"></span>
    </div>
    <div class="admin-progress-track">
      <div data-role="bar-fill" class="admin-progress-fill-blue"></div>
    </div>
  </div>
</template>

<template id="tpl-admin-recent-order-row">
  <tr>
    <td data-role="ord-num" class="font-mono-tech text-xs font-bold text-[#0095FF]"></td>
    <td><p data-role="ord-client" class="admin-table-title"></p></td>
    <td><p data-role="ord-prod" class="admin-table-title"></p></td>
    <td><span data-role="ord-stage" class="admin-status-badge admin-status-in-stock"></span></td>
    <td data-role="ord-total" class="text-right font-mono-tech font-bold"></td>
  </tr>
</template>

<template id="tpl-admin-product-row">
  <tr>
    <td class="admin-col-primary">
      <div class="flex items-center gap-3">
        <img data-role="prod-img" src="" alt="" class="admin-thumb" />
        <div>
          <p data-role="prod-name" class="admin-table-title"></p>
          <p data-role="prod-sku" class="admin-table-sub font-mono-tech"></p>
        </div>
      </div>
    </td>
    <td><span data-role="prod-cat" class="admin-category-tag"></span></td>
    <td data-role="prod-stock" class="font-mono-tech font-semibold"></td>
    <td data-role="prod-min" class="font-mono-tech"></td>
    <td data-role="prod-price" class="font-mono-tech font-semibold"></td>
    <td>
      <span data-role="prod-badge" class="admin-status-badge">
        <span class="admin-status-badge-dot"></span>
        <span data-role="prod-badge-text"></span>
      </span>
    </td>
    <td class="text-right whitespace-nowrap">
      <button type="button" data-role="prod-edit" class="admin-btn admin-btn-sm admin-btn-secondary">Edit</button>
      <button type="button" data-role="prod-remove" class="admin-btn admin-btn-sm admin-btn-danger">Remove</button>
    </td>
  </tr>
</template>

<template id="tpl-admin-material-row">
  <tr>
    <td class="admin-col-primary">
      <p data-role="mat-name" class="admin-table-title"></p>
      <p data-role="mat-code" class="admin-table-sub font-mono-tech"></p>
    </td>
    <td><span data-role="mat-type" class="admin-category-tag"></span></td>
    <td data-role="mat-stock" class="font-mono-tech font-semibold"></td>
    <td data-role="mat-min" class="font-mono-tech"></td>
    <td data-role="mat-cost" class="font-mono-tech"></td>
    <td>
      <span data-role="mat-badge" class="admin-status-badge">
        <span class="admin-status-badge-dot"></span>
        <span data-role="mat-badge-text"></span>
      </span>
    </td>
    <td class="text-right whitespace-nowrap">
      <button type="button" data-role="mat-restock" class="admin-btn admin-btn-sm admin-btn-secondary">+10 Stock</button>
    </td>
  </tr>
</template>

<template id="tpl-admin-voucher-row">
  <tr>
    <td><span data-role="vch-code" class="vch-code-chip"></span></td>
    <td>
      <p data-role="vch-cust-name" class="admin-table-title"></p>
      <p data-role="vch-cust-email" class="admin-table-sub font-mono-tech"></p>
    </td>
    <td data-role="vch-prod"></td>
    <td data-role="vch-disc" class="font-mono-tech font-bold text-[#0095FF]"></td>
    <td><span data-role="vch-status" class="admin-status-badge"></span></td>
    <td class="text-right">
      <button type="button" data-role="vch-revoke" class="hidden admin-btn admin-btn-sm admin-btn-danger">Revoke</button>
    </td>
  </tr>
</template>

<template id="tpl-admin-active-order-row">
  <tr>
    <td class="whitespace-nowrap">
      <p data-role="ord-num" class="font-mono-tech text-xs font-bold text-[#0095FF]"></p>
    </td>
    <td>
      <p data-role="ord-client" class="admin-table-title"></p>
      <p data-role="ord-email" class="admin-table-sub"></p>
    </td>
    <td>
      <p data-role="ord-prod" class="admin-table-title"></p>
      <p data-role="ord-finish" class="admin-table-sub"></p>
    </td>
    <td>
      <select data-role="ord-select" class="admin-select admin-order-status-select"></select>
      <div data-role="ord-cancel-actions" class="hidden mt-2 flex items-center gap-2">
        <button type="button" data-role="ord-approve-cancel" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold cursor-pointer">Approve Cancel</button>
        <button type="button" data-role="ord-decline-cancel" class="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-semibold cursor-pointer">Decline</button>
      </div>
    </td>
    <td data-role="ord-total" class="text-right font-mono-tech text-sm font-bold"></td>
  </tr>
</template>

<template id="tpl-admin-completed-order-row">
  <tr>
    <td data-role="ord-num" class="font-mono-tech text-xs font-bold text-[#0095FF]"></td>
    <td data-role="ord-tx" class="font-mono-tech text-xs font-bold"></td>
    <td><p data-role="ord-client" class="admin-table-title"></p></td>
    <td><p data-role="ord-prod" class="admin-table-title"></p></td>
    <td data-role="ord-date" class="font-mono-tech text-xs"></td>
    <td><span class="admin-status-badge admin-status-in-stock">Completed</span></td>
    <td data-role="ord-total" class="text-right font-mono-tech text-sm font-bold text-emerald-700"></td>
  </tr>
</template>

<template id="tpl-admin-customer-row">
  <tr>
    <td class="admin-col-primary">
      <p data-role="cust-name" class="admin-table-title"></p>
      <p data-role="cust-id" class="admin-table-sub font-mono-tech"></p>
    </td>
    <td data-role="cust-email" class="text-xs"></td>
    <td data-role="cust-phone" class="font-mono-tech text-xs"></td>
    <td data-role="cust-address" class="text-xs"></td>
    <td data-role="cust-orders" class="font-mono-tech font-semibold"></td>
    <td data-role="cust-spent" class="font-mono-tech font-semibold text-[#0095FF]"></td>
  </tr>
</template>

<template id="tpl-analytics-bestseller-row">
  <tr>
    <td data-role="bs-rank" class="font-mono-tech font-bold"></td>
    <td><p data-role="bs-name" class="admin-table-title"></p></td>
    <td data-role="bs-cat"></td>
    <td data-role="bs-qty" class="font-mono-tech font-bold"></td>
    <td data-role="bs-rev" class="font-mono-tech font-bold text-[#0095FF]"></td>
  </tr>
</template>

<template id="tpl-analytics-tx-row">
  <tr>
    <td data-role="atx-num" class="font-mono-tech text-xs font-bold text-[#0095FF]"></td>
    <td data-role="atx-date" class="font-mono-tech text-xs"></td>
    <td data-role="atx-client"></td>
    <td data-role="atx-prod"></td>
    <td data-role="atx-status"></td>
    <td data-role="atx-rev" class="text-right font-mono-tech font-bold text-emerald-700"></td>
  </tr>
</template>
