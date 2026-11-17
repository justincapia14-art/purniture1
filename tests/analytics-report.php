<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Models\AnalyticsReport;
use App\Models\Product;
use Library\Database;
use Library\HashTable;
use Library\OrderCompletion;
use Library\OrderQueue;

final class ReportFixtureDatabase extends Database
{
    public function __construct(private array $fixture) {}
    public function readStore(): array { return $this->fixture; }
    public function isMySqlConnected(): bool { return false; }
}

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function report(array $orders, int $month = 11): array
{
    return (new AnalyticsReport(new ReportFixtureDatabase(['orders' => $orders])))
        ->generateReport(['preset' => 'select_month', 'year' => 2026, 'month' => $month]);
}

$pending = [
    'orderId' => 'ORDER-1', 'orderDate' => '2026-10-31',
    'status' => 'Order Confirmed', 'sqlStatus' => 'Pending',
    'totalAmount' => 1000, 'depositPaid' => 1000, 'paymentStatus' => 'Paid in Full',
];
$completed = array_merge($pending, [
    'status' => 'Delivered · Completed', 'sqlStatus' => 'Delivered', 'isCompleted' => true,
    'completedAt' => '2026-10-31T16:30:00Z',
]);

check(!OrderCompletion::isCompleted($pending), 'Payment alone must not complete an order');
check(OrderCompletion::reportDate($completed) === '2026-11-01', 'Use Manila completion date');
check(report([$pending])['summary']['totalRevenue']['value'] === 0.0, 'Pending sale leaked into PHP report');
check(report([$completed])['summary']['totalRevenue']['value'] === 1000.0, 'Completed sale missing');
check(report([$completed])['summary']['totalOrders']['value'] === 1, 'Completed order count incorrect');
check(report([$completed, $completed])['summary']['totalOrders']['value'] === 1, 'Duplicate order counted');
check(report([$completed], 10)['summary']['totalRevenue']['value'] === 0.0, 'Completion shifted into order month');

$cancelled = array_merge($completed, ['sqlStatus' => 'Cancelled', 'status' => 'Order Cancelled']);
check(report([$cancelled])['summary']['totalOrders']['value'] === 0, 'Cancelled sale included');
$transit = array_merge($pending, ['sqlStatus' => 'Delivered', 'status' => 'Dispatched · White-Glove Transit']);
check(!OrderCompletion::isCompleted($transit), 'Legacy transit status incorrectly completed');
$legacy = $completed;
unset($legacy['completedAt']);
check(OrderCompletion::reportDate($legacy) === '2026-10-31', 'Legacy order-date fallback missing');
$free = array_merge($completed, ['totalAmount' => 0]);
check(report([$free])['summary']['totalRevenue']['value'] === 0.0, 'Zero total incorrectly recomputed');

// Verify A1: Queue (OrderQueue + partitionOrdersByCompletion)
$queue = new OrderQueue();
$queue->enqueue($pending);
$queue->enqueue($completed);
check($queue->size() === 2, 'OrderQueue size must be 2');
check($queue->dequeue()['orderId'] === 'ORDER-1', 'OrderQueue FIFO order preserved');
$partitioned = OrderCompletion::partitionOrdersByCompletion([$pending, $completed]);
check(count($partitioned['activeOrders']) === 1 && count($partitioned['completedOrders']) === 1, 'Queue partition failed');

// Verify B4 + B1: Insertion sort + Binary search on catalog products
$sampleProducts = [
    ['id' => 'furn-of-01', 'sku' => 'LR-OF-319', 'name' => 'Vance Executive Desk', 'categoryId' => 'office'],
    ['id' => 'furn-bd-01', 'sku' => 'LR-BD-204', 'name' => 'Atelier Platform Bed', 'categoryId' => 'bedroom'],
    ['id' => 'furn-lv-01', 'sku' => 'LR-LV-014', 'name' => 'Rowena Curved Sofa', 'categoryId' => 'living'],
];
$sortedProducts = Product::insertionSortProductsById($sampleProducts);
check($sortedProducts[0]['id'] === 'furn-bd-01', 'Insertion sort must order furn-bd-01 first');
$foundProduct = Product::findProductByIdBinarySearch($sortedProducts, 'furn-lv-01');
check($foundProduct !== null && $foundProduct['sku'] === 'LR-LV-014', 'Binary search must locate furn-lv-01');

// Verify B2: Linear search on catalog products
$linearMatches = Product::searchCatalogLinear($sampleProducts, 'Executive', 'all');
check(count($linearMatches) === 1 && $linearMatches[0]['id'] === 'furn-of-01', 'Linear search must match Executive');

// Verify B3: Merge sort on analytics rankings
$merged = AnalyticsReport::mergeSortRecords(
    [['rev' => 1200], ['rev' => 4500], ['rev' => 3100]],
    static fn(array $a, array $b): int => $b['rev'] <=> $a['rev']
);
check($merged[0]['rev'] === 4500 && $merged[2]['rev'] === 1200, 'Merge sort must rank descending');

// Verify B5: Hash function + Separate Chaining HashTable
$hashTable = new HashTable(53);
$hashTable->put('VCH-ROWENA-SOFA400', ['discount' => 400]);
check($hashTable->has('vch-rowena-sofa400') && $hashTable->get('VCH-ROWENA-SOFA400')['discount'] === 400, 'HashTable lookup failed');

echo "PHP completed-order reporting and DSA (A1, B1-B5) checks passed.\n";
