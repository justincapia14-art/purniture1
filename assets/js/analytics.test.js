import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyAdminOrderUpdate, recordCustomerOrderPayment } from './store.js';
import { computeMonthlyAnalyticsReport, buildAnalyticsCsvContent, buildAnalyticsPdfBytes, getAnalyticsOrderDate } from './analytics.js';

const nowMs = Date.parse('2026-11-17T04:00:00Z');
const baseOrder = {
  orderId: 'ORDER-1', orderNumber: 'ORDER-1', orderDate: '2026-10-31',
  status: 'Order Confirmed', sqlStatus: 'Pending', paymentStatus: 'Unpaid',
  clientName: 'Test Customer', clientEmail: 'test@example.com',
  furnitureId: 'piece-1', furnitureName: 'Test Chair', sku: 'CHAIR-1',
  categoryName: 'Living Room', quantity: 2, unitPrice: 550, totalAmount: 1000,
  voucherDiscountAmount: 100, appliedVoucherCode: 'SAVE100', depositPaid: 0,
};
const reportFor = (orders, filter = { preset: 'select_month', year: 2026, month: 11 }, extra = {}) =>
  computeMonthlyAnalyticsReport({
    orders, products: [{ id: 'piece-1', name: 'Test Chair', categoryId: 'living', inStockCount: 10 }],
    categories: [{ id: 'living', name: 'Living Room' }], ...extra,
  }, filter, nowMs);
const complete = (order = baseOrder, completedAt = '2026-11-01T01:00:00+08:00') =>
  applyAdminOrderUpdate(order, { status: 'Delivered · Completed', completedAt });

describe('Completed-order sales reporting', () => {
  it('excludes unpaid, deposit-paid, fully paid, production, ready and dispatched orders', () => {
    const orders = [
      baseOrder,
      { ...baseOrder, depositPaid: 500, paymentStatus: 'Deposit Paid' },
      recordCustomerOrderPayment(baseOrder),
      { ...baseOrder, status: 'Workshop Joinery', sqlStatus: 'InProduction', depositPaid: 1000 },
      { ...baseOrder, status: 'Ready for Delivery', sqlStatus: 'Ready', depositPaid: 1000 },
      { ...baseOrder, status: 'Dispatched · White-Glove Transit', sqlStatus: 'Delivered', depositPaid: 1000 },
    ].map((order, i) => ({ ...order, orderId: 'UNFINISHED-' + i, orderNumber: 'UNFINISHED-' + i, orderDate: '2026-11-01' }));
    const report = reportFor(orders);
    assert.equal(report.summary.totalOrders.value, 0);
    assert.equal(report.summary.totalRevenue.value, 0);
    assert.equal(report.summary.totalProductsSold.value, 0);
    assert.equal(report.summary.totalDiscountsGiven.value, 0);
    assert.equal(report.summary.averageOrderValue.value, 0);
    assert.equal(report.transactions.length, 0);
    assert.equal(report.bestSellingProducts.allRankedProducts[0].quantitySold, 0);
    assert.equal(report.customerAnalytics.orderingCustomersCount, 0);
    assert.ok(report.salesAnalytics.monthlySeries.every(row => row.revenue === 0 && row.orders === 0));
  });

  it('adds revenue, quantities, discounts, customer spending and exports only after completion', () => {
    const completed = complete();
    const updated = reportFor([completed]);
    assert.equal(updated.summary.totalOrders.value, 1);
    assert.equal(updated.summary.totalRevenue.value, 1000);
    assert.equal(updated.summary.totalProductsSold.value, 2);
    assert.equal(updated.summary.totalDiscountsGiven.value, 100);
    assert.equal(updated.summary.averageOrderValue.value, 1000);
    assert.equal(updated.bestSellingProducts.topFive[0].totalRevenue, 1000);
    assert.equal(updated.salesAnalytics.categoryRevenue[0].revenue, 1000);
    assert.equal(updated.customerAnalytics.topCustomers[0].periodSpent, 1000);
    assert.equal(updated.transactions[0].reportDate, '2026-11-01');
    assert.ok(buildAnalyticsCsvContent(updated).includes('Completion Date'));
    assert.ok(buildAnalyticsCsvContent(updated).includes('ORDER-1,2026-11-01'));
    assert.ok(buildAnalyticsPdfBytes(updated).byteLength > 500);
  });

  it('recognizes cross-month completions in Manila time and leaves October unchanged', () => {
    const completed = complete(baseOrder, '2026-10-31T16:30:00Z');
    assert.equal(getAnalyticsOrderDate(completed), '2026-11-01');
    const november = reportFor([completed]);
    assert.equal(november.summary.totalRevenue.value, 1000);
    assert.equal(november.summary.totalRevenue.previousValue, 0);
    assert.equal(november.salesAnalytics.dailySeries[0].revenue, 1000);
    assert.equal(november.salesAnalytics.monthlySeries[9].revenue, 0);
    assert.equal(november.salesAnalytics.monthlySeries[10].revenue, 1000);
    const october = reportFor([completed], { preset: 'select_month', year: 2026, month: 10 });
    assert.equal(october.summary.totalRevenue.value, 0);
    const custom = reportFor([completed], { preset: 'custom_range', startDate: '2026-11-01', endDate: '2026-11-01' });
    assert.equal(custom.summary.totalOrders.value, 1);
  });

  it('keeps completion idempotent, excludes cancellation/reopening, and prevents duplicate counting', () => {
    const completed = complete();
    const repeated = applyAdminOrderUpdate(completed, { status: 'Delivered · Completed' });
    assert.equal(repeated.completedAt, completed.completedAt);
    assert.equal(reportFor([completed, repeated]).summary.totalOrders.value, 1);
    const reopened = applyAdminOrderUpdate(completed, { status: 'Order Confirmed' });
    assert.equal(reopened.completedAt, undefined);
    assert.equal(reportFor([reopened]).summary.totalRevenue.value, 0);
    const cancelled = applyAdminOrderUpdate(completed, { status: 'Order Cancelled' });
    assert.equal(reportFor([cancelled]).summary.totalRevenue.value, 0);
    const completedAgain = complete(reopened, '2026-12-01');
    assert.equal(reportFor([completedAgain]).summary.totalRevenue.value, 0);
    assert.equal(reportFor([completedAgain], { preset: 'select_month', year: 2026, month: 12 }).summary.totalRevenue.value, 1000);
  });

  it('supports legacy completed orders, preserves historical prices and accepts zero-value sales', () => {
    const legacy = { ...baseOrder, orderDate: '2026-11-03', status: 'Delivered · Completed', sqlStatus: 'Delivered' };
    const report = reportFor([legacy], undefined, { products: [{ id: 'piece-1', name: 'Test Chair', price: 999999 }] });
    assert.equal(report.summary.totalRevenue.value, 1000);
    assert.equal(report.transactions[0].reportDate, '2026-11-03');
    assert.equal(reportFor([{ ...legacy, totalAmount: 0 }]).summary.totalRevenue.value, 0);
  });

  it('does not recognize a reserved voucher discount on an unfinished order', () => {
    const extra = { vouchers: [{ id: 'v1', code: 'SAVE100', status: 'Used', discountAmount: 100, redeemedAt: '2026-11-01' }] };
    assert.equal(reportFor([baseOrder], undefined, extra).voucherAnalytics.totalDiscountRedeemed, 0);
    assert.equal(reportFor([baseOrder], undefined, extra).voucherAnalytics.redeemedVouchers, 0);
    assert.equal(reportFor([complete()], undefined, extra).voucherAnalytics.redeemedInPeriodCount, 1);
    assert.equal(reportFor([complete()], undefined, extra).voucherAnalytics.periodDiscountRedeemed, 100);
  });
});
