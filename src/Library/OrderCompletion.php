<?php

declare(strict_types=1);

namespace Library;

/** Shared completion and reporting-date policy for persistence and PHP reports. */
final class OrderCompletion
{
    /** Keep the same completion rules as the browser/preview store. */
    public static function isCompleted(array $order): bool
    {
        $status = (string) ($order['status'] ?? '');
        $sqlStatus = (string) ($order['sqlStatus'] ?? '');
        if (stripos($status, 'Cancelled') !== false || $sqlStatus === 'Cancelled') {
            return false;
        }
        return ($order['isCompleted'] ?? false) === true
            || preg_match('/Completed|Delivered/i', $status) === 1
            || ($sqlStatus === 'Delivered' && preg_match('/Dispatched|Transit/i', $status) !== 1);
    }

    /** Existing completed orders without a timestamp retain their original date. */
    public static function reportDate(array $order): ?string
    {
        $raw = trim((string) (!empty($order['completedAt']) ? $order['completedAt'] : ($order['orderDate'] ?? '')));
        if ($raw === '') {
            return null;
        }
        try {
            $tz = new \DateTimeZone('Asia/Manila');
            return (new \DateTimeImmutable($raw, $tz))->setTimezone($tz)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * // DATA STRUCTURE A1: Queue
     * // Chapter: Chapter 4 (Stacks and Queues)
     * // Purpose: Enqueues incoming customer orders in arrival order and dequeues them in FIFO sequence
     * //          to partition active workshop orders from completed sales orders in O(1) per operation.
     * // Time Complexity: Enqueue: O(1) per order, Dequeue: O(1) per order, Total: O(n)
     * // Space Complexity: O(n) to hold n orders in the FIFO queue
     *
     * @param array<int, mixed> $orders
     * @return array{activeOrders: array<int, array<string, mixed>>, completedOrders: array<int, array<string, mixed>>}
     */
    public static function partitionOrdersByCompletion(array $orders): array
    {
        $orderQueue = new OrderQueue($orders);
        $activeOrders = [];
        $completedOrders = [];

        while (!$orderQueue->isEmpty()) {
            $order = $orderQueue->dequeue();
            if ($order === null) {
                continue;
            }
            if (self::isCompleted($order)) {
                $completedOrders[] = $order;
            } else {
                $activeOrders[] = $order;
            }
        }

        return [
            'activeOrders'    => $activeOrders,
            'completedOrders' => $completedOrders,
        ];
    }
}
