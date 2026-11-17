<!-- Storefront Reusable HTML Templates (src/views/partials/storefront-templates.php) -->
<template id="tpl-product-card">
  <article class="group bg-white rounded-3xl border border-slate-200/90 hover:border-[#0095FF] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
    <div>
      <div class="relative aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer" data-role="card-image-trigger">
        <img data-role="card-img" src="" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div class="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          <span data-role="card-category" class="px-2.5 py-1 rounded-full bg-[#0D1015]/85 backdrop-blur-xs text-white text-[11px] font-semibold"></span>
          <span data-role="card-discount" class="hidden px-2.5 py-1 rounded-full bg-[#0095FF] text-white font-mono-tech text-[11px] font-bold"></span>
        </div>
        <span data-role="card-stock-badge" class="absolute top-3 right-3 px-2.5 py-1 rounded-full border text-[11px] font-mono-tech font-semibold"></span>
      </div>
      <div class="p-5 space-y-2.5">
        <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono-tech">
          <span data-role="card-sku"></span>
          <span data-role="card-shipping"></span>
        </div>
        <h3 data-role="card-title" class="font-serif-display text-lg font-bold text-[#0D1015] group-hover:text-[#0095FF] transition-colors cursor-pointer"></h3>
        <p data-role="card-desc" class="text-xs text-slate-600 line-clamp-2"></p>
        <p data-role="card-dims" class="text-[11px] text-slate-500 font-mono-tech"></p>
      </div>
    </div>
    <div class="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
      <div class="flex items-baseline justify-between gap-2">
        <div>
          <span data-role="card-price" class="font-mono-tech text-xl font-bold text-[#0D1015]"></span>
          <span data-role="card-orig-price" class="hidden font-mono-tech text-xs text-slate-400 line-through ml-1.5"></span>
        </div>
        <button type="button" data-role="card-offer-btn" class="text-xs font-semibold text-[#0095FF] hover:underline cursor-pointer">
          Make Offer
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" data-role="card-detail-btn" class="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-[#0D1015] text-xs font-semibold text-[#0D1015] transition-colors cursor-pointer">
          View Details
        </button>
        <button type="button" data-role="card-cart-btn" class="px-3 py-2.5 rounded-xl bg-[#0D1015] hover:bg-[#0095FF] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold transition-colors cursor-pointer">
          Add to Cart
        </button>
      </div>
    </div>
  </article>
</template>

<template id="tpl-category-card">
  <a href="" data-role="cat-link" class="group relative rounded-3xl overflow-hidden border border-slate-200 aspect-4/3 flex flex-col justify-end p-5 bg-slate-900">
    <img data-role="cat-img" src="" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
    <div class="inset-0 bg-gradient-to-t from-[#0D1015]/90 via-[#0D1015]/30 to-transparent absolute"></div>
    <div class="relative z-10 text-white space-y-1">
      <span data-role="cat-count" class="font-mono-tech text-[11px] uppercase tracking-wider text-[#BCE3FF]"></span>
      <h3 data-role="cat-name" class="font-serif-display text-lg font-bold"></h3>
      <p data-role="cat-tagline" class="text-xs text-slate-200 line-clamp-1"></p>
    </div>
  </a>
</template>

<template id="tpl-cart-drawer-item">
  <div class="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
    <div class="flex items-center gap-3 min-w-0">
      <img data-role="item-img" src="" alt="" class="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0" />
      <div class="min-w-0">
        <p data-role="item-name" class="font-serif-display text-sm font-bold text-[#0D1015] truncate"></p>
        <p data-role="item-meta" class="text-xs text-slate-500 truncate"></p>
        <div class="flex items-center gap-2 mt-1.5">
          <button type="button" data-role="item-dec" class="w-6 h-6 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">−</button>
          <span data-role="item-qty" class="font-mono-tech text-xs font-bold"></span>
          <button type="button" data-role="item-inc" class="w-6 h-6 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">+</button>
          <button type="button" data-role="item-remove" class="text-[11px] font-semibold text-rose-600 hover:underline ml-1 cursor-pointer">Remove</button>
        </div>
      </div>
    </div>
    <p data-role="item-total" class="font-mono-tech text-sm font-bold text-[#0D1015] shrink-0"></p>
  </div>
</template>

<template id="tpl-finish-swatch">
  <button type="button" data-role="swatch-btn" class="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all">
    <span data-role="swatch-dot" class="w-3.5 h-3.5 rounded-full border border-slate-300"></span>
    <span data-role="swatch-name"></span>
    <span data-role="swatch-delta" class="hidden font-mono-tech text-[11px] text-slate-500"></span>
  </button>
</template>

<template id="tpl-catalog-color-filter">
  <button type="button" data-role="color-btn" class="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all">
    <span data-role="color-dot" class="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"></span>
    <span data-role="color-name"></span>
    <span data-role="color-count" class="font-mono-tech text-[11px] opacity-75"></span>
  </button>
</template>

<template id="tpl-catalog-room-tag">
  <button type="button" data-role="room-btn" class="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"></button>
</template>

