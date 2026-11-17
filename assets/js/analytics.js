import {
  generateOwnEntityId,
  formatManilaDateTimeParts,
  formatVoucherIssuedDisplay,
  formatVoucherExpiryDisplay,
  computeVoucherStatusInfo,
  isOrderCompleted,
  getMaterialStockStatus,
  getProductStockStatus,
  computeMaterialInventoryMetrics,
  computeInventoryMetrics,
} from './store.js';

const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const getDaysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, '0');
const fmtYmd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const fmtUsd = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`;

function parseManilaDateOnly(raw) {
  if (!raw) return null;
  const clean = String(raw).trim();
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const ms = Date.parse(clean);
  if (Number.isNaN(ms)) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function computePercentageChange(currentValue, previousValue) {
  const curr = Number(currentValue) || 0;
  const prev = Number(previousValue) || 0;
  if (Math.abs(prev) < 0.0001) {
    if (Math.abs(curr) < 0.0001) {
      return { percentChange: 0, direction: 'flat', formatted: '0.0%', formattedChange: '0.0%', badgeLabel: '0.0% vs prior period', previousZero: true, isNewFromZero: false };
    }
    const formatted = curr > 0 ? '+100.0%' : '-100.0%';
    return {
      percentChange: curr > 0 ? 100 : -100,
      direction: curr > 0 ? 'up' : 'down',
      formatted,
      formattedChange: curr > 0 ? '+100.0% (New)' : '-100.0%',
      badgeLabel: curr > 0 ? '+100.0% (up from 0)' : '-100.0%',
      previousZero: true,
      isNewFromZero: curr > 0,
    };
  }
  const pct = Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const formatted = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  return { percentChange: pct, direction, formatted, formattedChange: formatted, badgeLabel: `${formatted} vs prior period`, previousZero: false, isNewFromZero: false };
}

export function resolveAnalyticsDateRange(filterOptions = {}, nowMs = Date.now()) {
  const nMap = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(nowMs))
      .map((p) => [p.type, p.value])
  );
  const curY = Number(nMap.year);
  const curM = Number(nMap.month);
  const preset = String(filterOptions?.preset || 'this_month').trim().toLowerCase();
  let selectedYear = Number(filterOptions?.year) || curY;
  let selectedMonth = Math.min(12, Math.max(1, Number(filterOptions?.month) || curM));
  let startDate = '', endDate = '', previousStartDate = '', previousEndDate = '', periodLabel = '', previousPeriodLabel = '';

  const setMonthBounds = (y, m) => {
    startDate = fmtYmd(y, m, 1);
    endDate = fmtYmd(y, m, getDaysInMonth(y, m));
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    previousStartDate = fmtYmd(py, pm, 1);
    previousEndDate = fmtYmd(py, pm, getDaysInMonth(py, pm));
    selectedYear = y;
    selectedMonth = m;
    periodLabel = `${MONTH_FULL[m - 1]} ${y}`;
    previousPeriodLabel = `${MONTH_FULL[pm - 1]} ${py}`;
  };

  if (preset === 'last_month') {
    setMonthBounds(curM === 1 ? curY - 1 : curY, curM === 1 ? 12 : curM - 1);
  } else if (preset === 'select_month') {
    setMonthBounds(selectedYear, selectedMonth);
  } else if (preset === 'this_year') {
    startDate = `${selectedYear}-01-01`;
    endDate = `${selectedYear}-12-31`;
    previousStartDate = `${selectedYear - 1}-01-01`;
    previousEndDate = `${selectedYear - 1}-12-31`;
    periodLabel = `Full Year ${selectedYear}`;
    previousPeriodLabel = `Full Year ${selectedYear - 1}`;
  } else if (preset === 'custom_range') {
    let rs = parseManilaDateOnly(filterOptions?.startDate) || fmtYmd(curY, curM, 1);
    let re = parseManilaDateOnly(filterOptions?.endDate) || fmtYmd(curY, curM, getDaysInMonth(curY, curM));
    if (re < rs) [rs, re] = [re, rs];
    startDate = rs;
    endDate = re;
    const sUtc = Date.parse(`${startDate}T00:00:00Z`);
    const eUtc = Date.parse(`${endDate}T00:00:00Z`);
    const span = Math.max(1, Math.round((eUtc - sUtc) / 86400000) + 1);
    const peUtc = sUtc - 86400000;
    previousStartDate = new Date(peUtc - (span - 1) * 86400000).toISOString().slice(0, 10);
    previousEndDate = new Date(peUtc).toISOString().slice(0, 10);
    selectedYear = Number(startDate.slice(0, 4)) || curY;
    selectedMonth = Number(startDate.slice(5, 7)) || curM;
    periodLabel = `${startDate} to ${endDate}`;
    previousPeriodLabel = `${previousStartDate} to ${previousEndDate}`;
  } else {
    setMonthBounds(curY, curM);
  }

  const countDays = (s, e) => Math.max(1, Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86400000) + 1 || 30);
  const resolvedPreset = ['this_month', 'last_month', 'select_month', 'this_year', 'custom_range'].includes(preset) ? preset : 'this_month';

  return {
    preset: resolvedPreset, startDate, endDate, previousStartDate, previousEndDate, periodLabel, previousPeriodLabel, selectedYear, selectedMonth, timezone: 'Asia/Manila',
    current: { startDate, endDate, label: periodLabel, year: selectedYear, month: selectedMonth, dayCount: countDays(startDate, endDate) },
    previous: { startDate: previousStartDate, endDate: previousEndDate, label: previousPeriodLabel, dayCount: countDays(previousStartDate, previousEndDate) },
  };
}

export function getAnalyticsOrderDate(order) {
  const value = order?.completedAt || order?.orderDate;
  if (!value) return null;
  return parseManilaDateOnly(value);
}

function getOrderAmt(o) {
  const explicit = Number(o?.totalAmount);
  if (o?.totalAmount != null && Number.isFinite(explicit) && explicit >= 0) return Math.round(explicit);
  return Math.max(0, Math.round(Math.max(1, Number(o?.quantity || 1)) * Math.max(0, Number(o?.unitPrice || 0)) + Math.max(0, Number(o?.extraCost || 0)) - Math.max(0, Number(o?.voucherDiscountAmount || 0))));
}

export function computeMonthlyAnalyticsReport(storeData = {}, filterOptionsArg = {}, nowMsArg = Date.now()) {
  const filter = storeData?.filterInput || storeData?.filterOptions || filterOptionsArg || {};
  const nowMs = Number.isFinite(Number(storeData?.nowMs)) ? Number(storeData.nowMs) : (Number.isFinite(Number(nowMsArg)) ? Number(nowMsArg) : Date.now());
  const range = resolveAnalyticsDateRange(filter, nowMs);
  const products = Array.isArray(storeData?.catalog) ? storeData.catalog : (Array.isArray(storeData?.products) ? storeData.products : []);
  const categories = Array.isArray(storeData?.categories) ? storeData.categories : [];
  const materials = Array.isArray(storeData?.materials) ? storeData.materials : [];
  const vouchers = Array.isArray(storeData?.vouchers) ? storeData.vouchers : [];
  const customers = Array.isArray(storeData?.customers) ? storeData.customers : [];
  const inventoryTransactions = Array.isArray(storeData?.inventoryTransactions) ? storeData.inventoryTransactions : [];

  const seenOrders = new Set();
  const operationalOrders = (Array.isArray(storeData?.orders) ? storeData.orders : []).filter((ord) => {
    if (!ord || typeof ord !== 'object') return false;
    const k = String(ord.orderId || ord.orderNumber || ord.id || '').trim().toUpperCase();
    if (k && seenOrders.has(k)) return false;
    if (k) seenOrders.add(k);
    return true;
  });
  const orders = operationalOrders.filter(isOrderCompleted);
  const completionDates = new Map(orders.map((o) => [o, getAnalyticsOrderDate(o)]));

  const productById = new Map();
  const productBySku = new Map();
  products.forEach((p) => {
    if (p?.id) productById.set(String(p.id), p);
    if (p?.sku) productBySku.set(String(p.sku).toUpperCase(), p);
    if (p?.productId) productBySku.set(String(p.productId).toUpperCase(), p);
  });

  const inRange = (dStr, s, e) => { const d = parseManilaDateOnly(dStr); return Boolean(d && d >= s && d <= e); };

  const computeWindow = (s, e) => {
    const periodOrders = orders.filter((o) => inRange(completionDates.get(o), s, e));
    let totalRevenue = 0, totalProductsSold = 0, totalDiscountsGiven = 0;
    const seenItems = new Set();
    periodOrders.forEach((o) => {
      totalRevenue += getOrderAmt(o);
      const ik = String(o.orderItemId || o.orderId || o.orderNumber || o.id || '');
      if (!ik || !seenItems.has(ik)) {
        if (ik) seenItems.add(ik);
        totalProductsSold += Math.max(1, Number(o.quantity || 1));
      }
      totalDiscountsGiven += Math.max(0, Number(o.voucherDiscountAmount || 0));
    });
    const newCusts = customers.filter((c) => inRange(c?.registeredAt || c?.createdAt, s, e));
    const count = periodOrders.length;
    return {
      periodOrders, totalRevenue: Math.round(totalRevenue), grossBookedRevenue: Math.round(totalRevenue),
      totalOrders: count, completedOrders: count, pendingOrders: 0, processingOrders: 0, shippedOrders: 0, cancelledOrders: 0,
      totalProductsSold, newCustomers: newCusts.length, newCustomersList: newCusts,
      totalDiscountsGiven: Math.round(totalDiscountsGiven), averageOrderValue: count > 0 ? Math.round(totalRevenue / count) : 0,
      revenueEligibleOrderCount: count,
    };
  };

  const cur = computeWindow(range.startDate, range.endDate);
  const prev = computeWindow(range.previousStartDate, range.previousEndDate);

  const kpi = (key, label, cv, pv, fc, fp, subtitle) => {
    const comp = computePercentageChange(cv, pv);
    return { key, label, value: cv, previousValue: pv, formattedValue: fc, formattedPreviousValue: fp, subtitle, ...comp, comparison: comp };
  };

  const summary = {
    totalRevenue: kpi('totalRevenue', 'Total Revenue', cur.totalRevenue, prev.totalRevenue, fmtUsd(cur.totalRevenue), fmtUsd(prev.totalRevenue), `${cur.completedOrders} completed order(s)`),
    totalOrders: kpi('totalOrders', 'Total Orders', cur.totalOrders, prev.totalOrders, String(cur.totalOrders), String(prev.totalOrders), `Completed sales: ${fmtUsd(cur.grossBookedRevenue)}`),
    completedOrders: kpi('completedOrders', 'Completed Orders', cur.completedOrders, prev.completedOrders, String(cur.completedOrders), String(prev.completedOrders), 'Delivered & settled in full'),
    pendingOrders: kpi('pendingOrders', 'Pending Orders', 0, 0, '0', '0', '0 in workshop · 0 ready/shipped'),
    cancelledOrders: kpi('cancelledOrders', 'Cancelled Orders', 0, 0, '0', '0', 'Excluded from realized revenue'),
    totalProductsSold: kpi('totalProductsSold', 'Total Products Sold', cur.totalProductsSold, prev.totalProductsSold, `${cur.totalProductsSold} pcs`, `${prev.totalProductsSold} pcs`, 'Furniture units in completed orders'),
    newCustomers: kpi('newCustomers', 'New Customers', cur.newCustomers, prev.newCustomers, String(cur.newCustomers), String(prev.newCustomers), `${customers.length} total registered clients`),
    totalDiscountsGiven: kpi('totalDiscountsGiven', 'Total Discounts Given', cur.totalDiscountsGiven, prev.totalDiscountsGiven, fmtUsd(cur.totalDiscountsGiven), fmtUsd(prev.totalDiscountsGiven), 'Fixed-amount vouchers redeemed'),
    averageOrderValue: kpi('averageOrderValue', 'Average Order Value', cur.averageOrderValue, prev.averageOrderValue, fmtUsd(cur.averageOrderValue), fmtUsd(prev.averageOrderValue), 'Revenue per completed order'),
    grossOrderValue: cur.grossBookedRevenue, processingOrdersCount: 0, shippedOrdersCount: 0,
  };
  const summaryCards = [summary.totalRevenue, summary.totalOrders, summary.completedOrders, summary.pendingOrders, summary.cancelledOrders, summary.totalProductsSold, summary.newCustomers, summary.totalDiscountsGiven, summary.averageOrderValue];

  const daysInMonth = getDaysInMonth(range.selectedYear, range.selectedMonth);
  const dailySeries = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateKey = fmtYmd(range.selectedYear, range.selectedMonth, d);
    const dayOrders = orders.filter((o) => completionDates.get(o) === dateKey);
    const rev = Math.round(dayOrders.reduce((s, o) => s + getOrderAmt(o), 0));
    const units = dayOrders.reduce((s, o) => s + Math.max(1, Number(o.quantity || 1)), 0);
    const lbl = `${MONTH_SHORT[range.selectedMonth - 1]} ${d}`;
    return { date: dateKey, dayOfMonth: d, dayLabel: String(d), label: lbl, shortLabel: lbl, revenue: rev, orders: dayOrders.length, orderCount: dayOrders.length, completedOrders: dayOrders.length, nonCancelledOrderCount: dayOrders.length, unitsSold: units };
  });

  const monthlySeries = [];
  for (let m = 1; m <= 12; m += 1) {
    const mw = computeWindow(fmtYmd(range.selectedYear, m, 1), fmtYmd(range.selectedYear, m, getDaysInMonth(range.selectedYear, m)));
    const mom = computePercentageChange(mw.totalRevenue, m > 1 ? monthlySeries[m - 2].revenue : 0);
    monthlySeries.push({
      month: m, monthIndex: m, monthKey: `${range.selectedYear}-${pad2(m)}`, monthName: MONTH_FULL[m - 1], fullLabel: `${MONTH_FULL[m - 1]} ${range.selectedYear}`,
      label: MONTH_SHORT[m - 1], shortName: MONTH_SHORT[m - 1], revenue: mw.totalRevenue, grossBookedRevenue: mw.grossBookedRevenue,
      orders: mw.totalOrders, orderCount: mw.totalOrders, completedOrders: mw.completedOrders, productsSold: mw.totalProductsSold,
      vsPreviousMonth: mom, monthOverMonthChange: mom, isSelectedMonth: m === range.selectedMonth,
    });
  }

  const catMap = new Map(categories.map((c) => [String(c.id).toLowerCase(), { categoryId: String(c.id).toLowerCase(), categoryCode: c.categoryId || c.code || 'CAT-LR', categoryName: c.name, revenue: 0, unitsSold: 0, orders: 0, orderCount: 0 }]));
  cur.periodOrders.forEach((o) => {
    const mp = productById.get(String(o.furnitureId || '')) || productBySku.get(String(o.sku || '').toUpperCase());
    const raw = String(mp?.categoryId || o?.categoryName || 'living').toLowerCase();
    const slug = raw.includes('dining') ? 'dining' : raw.includes('bed') ? 'bedroom' : (raw.includes('study') || raw.includes('office') || raw.includes('desk')) ? 'office' : raw.includes('kitchen') ? 'kitchen' : 'living';
    if (!catMap.has(slug)) catMap.set(slug, { categoryId: slug, categoryCode: 'CAT-LR', categoryName: o.categoryName || 'Collection', revenue: 0, unitsSold: 0, orders: 0, orderCount: 0 });
    const b = catMap.get(slug);
    b.orders += 1; b.orderCount += 1; b.unitsSold += Math.max(1, Number(o.quantity || 1)); b.revenue += getOrderAmt(o);
  });
  const totalCatRev = Math.max(1, Array.from(catMap.values()).reduce((s, c) => s + c.revenue, 0));
  const categoryRevenue = Array.from(catMap.values()).map((c) => ({ ...c, sharePercent: cur.totalRevenue > 0 ? Math.round((c.revenue / totalCatRev) * 1000) / 10 : 0 })).sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);

  const revComp = summary.totalRevenue.comparison;
  const pStatus = revComp.percentChange > 0 ? 'Improving' : revComp.percentChange < 0 ? 'Declining' : 'Stable';
  const pInsight = pStatus === 'Improving' ? `Realized revenue increased by ${revComp.formatted} (${fmtUsd(cur.totalRevenue)} vs ${fmtUsd(prev.totalRevenue)} in ${range.previousPeriodLabel}).` : `Realized revenue is ${fmtUsd(cur.totalRevenue)} compared to ${range.previousPeriodLabel}.`;
  const salesAnalytics = { year: range.selectedYear, dailySeries, monthlySeries, monthlyComparison: monthlySeries, categoryRevenue, revenueByCategory: categoryRevenue, performanceDirection: pStatus.toLowerCase(), performanceInsight: pInsight, performanceTrend: { status: pStatus, comparison: revComp, currentRevenue: cur.totalRevenue, previousRevenue: prev.totalRevenue, summaryText: pInsight } };

  const prodSalesMap = new Map(products.map((p) => {
    const st = getProductStockStatus(p);
    return [String(p.id), { id: String(p.id), productId: p.productId || p.sku || 'LR-ITEM', sku: p.sku || p.productId || 'LR-ITEM', name: p.name, categoryId: p.categoryId, categoryName: p.categoryName || 'Showroom Collection', image: p.image || 'assets/images/category_living_lounge.jpg', quantitySold: 0, totalRevenue: 0, orderCount: 0, currentStock: st.availableStock, minStockLevel: st.minStockLevel, stockStatusKey: st.statusKey, stockStatusLabel: st.label }];
  }));
  const seenProdItems = new Set();
  cur.periodOrders.forEach((o) => {
    const ik = String(o.orderItemId || o.orderId || o.orderNumber || o.id || '');
    if (ik && seenProdItems.has(ik)) return;
    if (ik) seenProdItems.add(ik);
    const mp = productById.get(String(o.furnitureId || '')) || productBySku.get(String(o.sku || '').toUpperCase());
    const mk = mp ? String(mp.id) : String(o.furnitureId || o.sku || o.id);
    if (!prodSalesMap.has(mk)) prodSalesMap.set(mk, { id: mk, productId: o.sku || 'LR-CUSTOM', sku: o.sku || 'LR-CUSTOM', name: o.furnitureName || 'Custom Piece', categoryId: 'living', categoryName: o.categoryName || 'Bespoke Commission', image: 'assets/images/category_living_lounge.jpg', quantitySold: 0, totalRevenue: 0, orderCount: 0, currentStock: 1, minStockLevel: 1, stockStatusKey: 'in_stock', stockStatusLabel: 'In Stock' });
    const entry = prodSalesMap.get(mk);
    entry.quantitySold += Math.max(1, Number(o.quantity || 1));
    entry.orderCount += 1;
    entry.totalRevenue += getOrderAmt(o);
  });
  const allProductRankings = Array.from(prodSalesMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue || b.quantitySold - a.quantitySold || a.name.localeCompare(b.name)).map((item, idx) => ({ ...item, rank: idx + 1 }));
  const topFive = allProductRankings.slice(0, 5);
  const lowSelling = allProductRankings.filter((i) => i.quantitySold <= 1).sort((a, b) => a.quantitySold - b.quantitySold || a.totalRevenue - b.totalRevenue).slice(0, 5);
  const bestSellingProducts = { allRankedProducts: allProductRankings, topFive, topFiveProducts: topFive, lowSellingProducts: lowSelling, lowPerformingProducts: lowSelling };

  const statusDistribution = [
    { status: 'Pending', statusKey: 'Pending', label: 'Pending', sqlStatusLabel: 'Pending · Timber Selection', color: '#D97706', count: 0, totalAmount: 0, totalValue: 0, sharePercent: 0, percentage: 0 },
    { status: 'Processing', statusKey: 'Processing', label: 'Processing', sqlStatusLabel: 'InProduction · Workshop Joinery', color: '#0095FF', count: 0, totalAmount: 0, totalValue: 0, sharePercent: 0, percentage: 0 },
    { status: 'Shipped', statusKey: 'Shipped', label: 'Shipped', sqlStatusLabel: 'Ready · Dispatched / Transit', color: '#6366F1', count: 0, totalAmount: 0, totalValue: 0, sharePercent: 0, percentage: 0 },
    { status: 'Completed', statusKey: 'Completed', label: 'Completed', sqlStatusLabel: 'Delivered · Completed', color: '#059669', count: cur.totalOrders, totalAmount: cur.totalRevenue, totalValue: cur.totalRevenue, sharePercent: cur.totalOrders > 0 ? 100 : 0, percentage: cur.totalOrders > 0 ? 100 : 0 },
    { status: 'Cancelled', statusKey: 'Cancelled', label: 'Cancelled', sqlStatusLabel: 'Cancelled', color: '#DC2626', count: 0, totalAmount: 0, totalValue: 0, sharePercent: 0, percentage: 0 },
  ];
  const orderAnalytics = { totalOrders: cur.totalOrders, distribution: statusDistribution, statusDistribution };

  const custStats = new Map();
  customers.forEach((c) => {
    const email = String(c?.email || '').trim().toLowerCase();
    if (email) custStats.set(email, { customerId: c.customerId || c.id || 'LR-CUS-300', name: c.fullName || c.name || 'Client', email: c.email, company: c.company || 'Private Residence', registeredAt: parseManilaDateOnly(c.registeredAt || c.createdAt) || '2026-09-01', periodOrders: 0, periodSpent: 0, lifetimeOrders: 0, lifetimeSpent: 0 });
  });
  orders.forEach((o) => {
    const email = String(o?.clientEmail || o?.customerEmail || '').trim().toLowerCase();
    if (!email) return;
    if (!custStats.has(email)) custStats.set(email, { customerId: generateOwnEntityId('customer', email).codeId, name: o.clientName || o.customerName || 'Showroom Client', email, company: o.clientCompany || 'Private Residence', registeredAt: parseManilaDateOnly(o.orderDate) || '2026-09-01', periodOrders: 0, periodSpent: 0, lifetimeOrders: 0, lifetimeSpent: 0 });
    const st = custStats.get(email);
    const amt = getOrderAmt(o);
    st.lifetimeOrders += 1; st.lifetimeSpent += amt;
    if (inRange(completionDates.get(o), range.startDate, range.endDate)) { st.periodOrders += 1; st.periodSpent += amt; }
  });
  const allCusts = Array.from(custStats.values());
  const topCustomers = [...allCusts].sort((a, b) => b.periodSpent - a.periodSpent || b.lifetimeSpent - a.lifetimeSpent).map((c, idx) => ({ ...c, rank: idx + 1, isReturning: c.lifetimeOrders > 1 }));
  const monthlyRegistrationTrend = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const ms = fmtYmd(range.selectedYear, m, 1), me = fmtYmd(range.selectedYear, m, getDaysInMonth(range.selectedYear, m));
    return { month: m, monthIndex: m, monthName: MONTH_FULL[i], label: MONTH_SHORT[i], shortName: MONTH_SHORT[i], newRegistrations: allCusts.filter((c) => c.registeredAt >= ms && c.registeredAt <= me).length, activeBuyers: new Set(orders.filter((o) => inRange(completionDates.get(o), ms, me)).map((o) => String(o.clientEmail || o.customerEmail || '').toLowerCase())).size };
  });
  const customerAnalytics = {
    newCustomersCount: cur.newCustomers, newCustomersList: cur.newCustomersList,
    customersWhoPlacedOrdersCount: allCusts.filter((c) => c.periodOrders > 0).length,
    orderingCustomersCount: allCusts.filter((c) => c.periodOrders > 0).length,
    returningCustomersCount: allCusts.filter((c) => c.periodOrders > 0 && c.lifetimeOrders > 1).length,
    totalLifetimeReturningCustomers: allCusts.filter((c) => c.lifetimeOrders > 1).length,
    totalRegisteredCustomers: allCusts.length, highestPurchaseCustomers: topCustomers, topCustomers,
    monthlyRegistrationTrends: monthlyRegistrationTrend, monthlyRegistrationTrend,
  };

  const prodMetrics = computeInventoryMetrics(products);
  const matMetrics = computeMaterialInventoryMetrics(materials);
  const catInvValue = products.reduce((s, p) => s + Math.round(Math.max(0, Number(p.inStockCount ?? 0)) * Math.max(0, Number(p.effectivePrice ?? p.price ?? 0))), 0);
  const matsRestock = [...matMetrics.outOfStockItems, ...matMetrics.lowStockItems].map((m) => {
    const st = getMaterialStockStatus(m);
    return { ...m, materialId: m.materialId || m.code || 'MAT-01', category: m.materialType || 'Solid Timber', quantity: st.availableStock, minimumStock: st.minStockLevel, unit: m.unit || 'units', status: st.label };
  });
  const periodInvTx = inventoryTransactions.filter((tx) => inRange(tx.dateTime || tx.date, range.startDate, range.endDate));
  const consumedMap = new Map();
  periodInvTx.filter((tx) => tx.transactionType === 'Stock Out').forEach((tx) => {
    const k = String(tx.materialId || tx.materialCode || tx.materialName || '');
    const ex = consumedMap.get(k) || { materialId: tx.materialId, materialCode: tx.materialCode || 'MAT-01', code: tx.materialCode || 'MAT-01', materialName: tx.materialName || 'Material', name: tx.materialName || 'Material', materialType: tx.materialType || 'Solid Timber', unit: tx.unit || 'units', quantityConsumed: 0, unitsConsumed: 0, unitCost: Number(tx.unitCost || 0), estimatedCost: 0, totalCost: 0, transactionCount: 0, transactionsCount: 0, lastReason: tx.reason || 'Workshop Production' };
    const q = Math.max(0, Number(tx.quantity || 0));
    ex.quantityConsumed += q; ex.unitsConsumed += q; ex.estimatedCost += Math.round(q * ex.unitCost); ex.totalCost = ex.estimatedCost; ex.transactionCount += 1; ex.transactionsCount = ex.transactionCount;
    consumedMap.set(k, ex);
  });
  const matsConsumed = Array.from(consumedMap.values()).sort((a, b) => b.estimatedCost - a.estimatedCost);
  const stockInTx = periodInvTx.filter((tx) => tx.transactionType === 'Stock In');
  const inventoryAnalytics = {
    currentSnapshot: {
      totalAvailableProducts: products.filter((p) => Number(p?.inStockCount ?? 0) > 0).length, totalCatalogProducts: products.length,
      totalAvailableUnits: prodMetrics.totalStockAvailable, totalProductUnitsInStock: prodMetrics.totalStockAvailable,
      lowStockProductsCount: prodMetrics.lowStockCount, lowStockProducts: (prodMetrics.lowStockItems || []).map((p) => ({ ...p, productId: p.productId || p.sku || 'LR-ITEM', stock: Math.max(0, Number(p.inStockCount ?? 0)), minStock: Math.max(0, Number(p.minStockLevel ?? 2)) })),
      outOfStockProductsCount: prodMetrics.outOfStockCount, outOfStockProducts: (prodMetrics.outOfStockItems || []).map((p) => ({ ...p, productId: p.productId || p.sku || 'LR-ITEM', stock: 0, minStock: 2 })),
      totalMaterials: materials.length, materialsRequiringRestockingCount: matsRestock.length, materialsRequiringRestockCount: matsRestock.length,
      materialsRequiringRestocking: matsRestock, materialsRequiringRestock: matsRestock,
      materialInventoryValue: matMetrics.totalInventoryValue, currentMaterialInventoryValue: matMetrics.totalInventoryValue,
      catalogInventoryValue: catInvValue, currentProductCatalogValue: catInvValue, currentInventoryValue: matMetrics.totalInventoryValue + catInvValue,
    },
    periodMovements: {
      periodLabel: range.periodLabel, totalMovementsCount: periodInvTx.length, materialsConsumedInPeriod: matsConsumed,
      totalUnitsConsumed: matsConsumed.reduce((s, m) => s + m.quantityConsumed, 0), totalMaterialUnitsConsumed: matsConsumed.reduce((s, m) => s + m.quantityConsumed, 0),
      totalConsumedValue: matsConsumed.reduce((s, m) => s + m.estimatedCost, 0), totalMaterialCostConsumed: matsConsumed.reduce((s, m) => s + m.estimatedCost, 0),
      stockInCount: stockInTx.length, totalUnitsRestocked: stockInTx.reduce((s, t) => s + Math.max(0, Number(t.quantity || 0)), 0),
      totalMaterialUnitsRestocked: stockInTx.reduce((s, t) => s + Math.max(0, Number(t.quantity || 0)), 0),
      totalRestockedCost: Math.round(stockInTx.reduce((s, t) => s + Math.max(0, Number(t.purchaseCost || 0)), 0)),
      totalRestockSpend: Math.round(stockInTx.reduce((s, t) => s + Math.max(0, Number(t.purchaseCost || 0)), 0)),
      periodTransactions: periodInvTx,
    },
  };

  const normalizedVouchers = vouchers.map((v) => {
    const st = computeVoucherStatusInfo(v, nowMs);
    const issuedDate = parseManilaDateOnly(v.issuedAt || v.createdAt);
    const issuedDisp = formatVoucherIssuedDisplay(v), expiryDisp = formatVoucherExpiryDisplay(v);
    return { ...v, voucherId: v.voucherId || generateOwnEntityId('voucher', v.code || v.id).codeId, productName: v.furnitureName || v.productName || 'Showroom Piece', discountAmount: Math.max(0, Number(v.discountAmount ?? v.discountValue ?? 0)), effectiveStatus: st.status, status: st.status, badgeClass: st.badgeClass, remainingLabel: st.remainingLabel, issuedDisplay: issuedDisp, expiryDisplay: expiryDisp, issuedAt: issuedDisp.full || v.createdAt || '—', expiresAt: expiryDisp.full || v.expiryDate || 'No expiry', issuedDate, expiryDate: parseManilaDateOnly(v.expiresAt || v.expiryDate) };
  });
  const vouchersInPeriod = normalizedVouchers.filter((v) => inRange(v.issuedDate, range.startDate, range.endDate));
  const vCode = (o) => String(o.appliedVoucherCode || o.voucherCode || '').trim().toUpperCase();
  const redeemedVouchers = new Set(orders.map(vCode).filter(Boolean)).size;
  const redeemedInPeriodCount = new Set(cur.periodOrders.map(vCode).filter(Boolean)).size;
  const totalDiscountRedeemed = Math.round(orders.reduce((s, o) => s + Math.max(0, Number(o.voucherDiscountAmount || 0)), 0));
  const voucherAnalytics = {
    totalVouchersIssued: normalizedVouchers.length, totalIssuedInPeriod: vouchersInPeriod.length, vouchersIssuedInSelectedPeriod: vouchersInPeriod.length,
    activeVouchers: normalizedVouchers.filter((v) => v.effectiveStatus === 'Active' || v.effectiveStatus === 'Expiring Soon').length,
    expiringSoonVouchers: normalizedVouchers.filter((v) => v.effectiveStatus === 'Expiring Soon').length,
    redeemedVouchers, redeemedInPeriodCount,
    expiredVouchers: normalizedVouchers.filter((v) => v.effectiveStatus === 'Expired').length,
    revokedVouchers: normalizedVouchers.filter((v) => v.effectiveStatus === 'Revoked' || v.effectiveStatus === 'Cancelled').length,
    totalDiscountIssued: Math.round(normalizedVouchers.reduce((s, v) => s + v.discountAmount, 0)),
    totalDiscountRedeemed, periodDiscountRedeemed: cur.totalDiscountsGiven,
    redemptionRate: normalizedVouchers.length > 0 ? Math.round((redeemedVouchers / normalizedVouchers.length) * 1000) / 10 : 0,
    periodRedemptionRate: vouchersInPeriod.length > 0 ? Math.round((redeemedInPeriodCount / vouchersInPeriod.length) * 1000) / 10 : 0,
    voucherBreakdown: normalizedVouchers, vouchers: normalizedVouchers,
  };

  const transactions = cur.periodOrders.map((o) => {
    const amt = getOrderAmt(o), disc = Math.max(0, Number(o.voucherDiscountAmount || 0));
    return {
      orderId: o.orderId || o.orderNumber, orderNumber: o.orderNumber || o.orderId, orderDate: o.orderDate,
      completedAt: completionDates.get(o), reportDate: completionDates.get(o),
      clientName: o.clientName || o.customerName, clientEmail: o.clientEmail || o.customerEmail,
      furnitureName: o.furnitureName, productId: o.sku || o.furnitureId, sku: o.sku || o.furnitureId,
      quantity: Math.max(1, Number(o.quantity || 1)), totalAmount: amt, depositPaid: Math.max(0, Number(o.depositPaid || 0)),
      discountAmount: disc, voucherDiscountAmount: disc, appliedVoucherCode: o.appliedVoucherCode || o.voucherCode || null,
      normalizedStatus: 'Completed', statusBucket: 'Completed', stageLabel: o.status || o.stage,
      paymentStatus: o.paymentStatus || 'Pending', realizedRevenue: amt,
    };
  });

  return {
    recognitionBasis: 'completed_orders', businessName: 'Lillia and Rowena Furniture',
    generatedAtIso: new Date(nowMs).toISOString(), generatedAtManila: formatManilaDateTimeParts(new Date(nowMs).toISOString()).full,
    dateRange: range, period: range.current, previousPeriod: range.previous, summary, summaryCards,
    kpis: { totalRevenue: cur.totalRevenue, totalOrders: cur.totalOrders, completedOrders: cur.completedOrders, pendingOrders: 0, cancelledOrders: 0, totalProductsSold: cur.totalProductsSold, newCustomers: cur.newCustomers, totalDiscountsGiven: cur.totalDiscountsGiven, averageOrderValue: cur.averageOrderValue },
    salesAnalytics, bestSellingProducts, productAnalytics: bestSellingProducts, orderAnalytics, customerAnalytics, inventoryAnalytics, voucherAnalytics, transactions, periodOrders: transactions,
  };
}

export function buildAnalyticsCsvContent(report) {
  if (!report || typeof report !== 'object') return '';
  const esc = (v) => {
    const s = String(v ?? '').replace(/\r?\n/g, ' ');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ['Business Name', esc(report.businessName || 'Lillia and Rowena Furniture')].join(','),
    ['Report Period', esc(report.dateRange?.periodLabel || report.period?.label || '')].join(','),
    ['Date Range', esc(`${report.dateRange?.startDate || ''} to ${report.dateRange?.endDate || ''}`)].join(','),
    ['Generated Date (PHT)', esc(report.generatedAtManila || '')].join(','), '',
    'MONTHLY BUSINESS SUMMARY KPIs',
    'Metric,Selected Period Value,Previous Period Value,Change (%)',
    ...(report.summaryCards || []).map((c) => [esc(c.label), esc(c.formattedValue), esc(c.formattedPreviousValue), esc(c.comparison?.formatted || c.formattedChange || '0.0%')].join(',')), '',
    'BEST-SELLING PRODUCTS',
    'Rank,Product ID,Product Name,Category,Quantity Sold,Total Revenue ($),Stock Availability',
    ...(report.bestSellingProducts?.allRankedProducts || []).map((p) => [esc(p.rank), esc(p.productId), esc(p.name), esc(p.categoryName), esc(p.quantitySold), esc(`$${p.totalRevenue}`), esc(`${p.currentStock} (${p.stockStatusLabel})`)].join(',')), '',
    'TRANSACTION DETAILS',
    'Order ID,Completion Date,Customer,Customer Email,Product,Product ID,Qty,Order Total ($),Discount ($),Status',
    ...(report.transactions || []).map((o) => [esc(o.orderId), esc(o.reportDate || o.completedAt || o.orderDate), esc(o.clientName), esc(o.clientEmail), esc(o.furnitureName), esc(o.sku), esc(o.quantity), esc(`$${o.totalAmount}`), esc(`$${o.voucherDiscountAmount}`), esc(o.statusBucket)].join(',')),
  ];
  return lines.join('\r\n');
}

export function buildAnalyticsPdfBytes(report) {
  const safe = (s) => String(s ?? '').replace(/₱/g, '$').replace(/[—–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7E]/g, '').replace(/([()\\])/g, '\\$1');
  const lines = [
    'LILLIA AND ROWENA FURNITURE - MONTHLY ANALYTICS & BUSINESS REPORT',
    `Reporting Period: ${report?.dateRange?.periodLabel || 'Current Period'} (${report?.dateRange?.startDate || ''} to ${report?.dateRange?.endDate || ''})`,
    `Generated On: ${report?.generatedAtManila || ''} (Asia/Manila)`,
    '--------------------------------------------------------------------------------',
    '1. EXECUTIVE BUSINESS SUMMARY',
    ...(report?.summaryCards || []).map((c) => `   - ${c.label}: ${c.formattedValue} (Prior: ${c.formattedPreviousValue} | ${c.formattedChange || '0.0%'})`),
    '--------------------------------------------------------------------------------',
    '2. TOP 5 BEST-SELLING PRODUCTS',
    ...(report?.bestSellingProducts?.topFive || []).map((p) => `   #${p.rank} [${p.productId}] ${p.name} - Sold: ${p.quantitySold} pcs | Revenue: $${p.totalRevenue}`),
    '--------------------------------------------------------------------------------',
    `3. PERIOD TRANSACTIONS (${(report?.transactions || []).length} record(s))`,
    ...(report?.transactions || []).slice(0, 12).map((o) => `   ${o.orderId} | ${o.reportDate || o.orderDate} | ${o.clientName} | ${o.sku} (x${o.quantity}) | $${o.totalAmount}`),
  ];
  const ops = ['BT', '/F1 9 Tf', '40 755 Td', '13 TL', ...lines.map((l, i) => `${i === 0 ? '' : 'T* '}(${safe(l)}) Tj`), 'ET'].join('\n');
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${ops.length} >>\nstream\n${ops}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((o) => { offsets.push(pdf.length); pdf += o; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map((off) => `${String(off).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
