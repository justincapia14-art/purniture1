<?php

declare(strict_types=1);

namespace Library;

/**
 * FIFO Order Processing Queue (PSR-4: Library\OrderQueue).
 *
 * // DATA STRUCTURE A1: Queue
 * // Chapter: Chapter 4 (Stacks and Queues)
 * // Purpose: Holds customer furniture orders in First-In, First-Out (FIFO) arrival order
 * //          for workshop production partitioning and completed-order sales reporting.
 * // Time Complexity: Enqueue: O(1), Dequeue: O(1), Peek: O(1), Size/IsEmpty: O(1)
 * // Space Complexity: O(n) where n is the number of queued order records
 */
final class OrderQueue
{
    /** @var array<int, array<string, mixed>> */
    private array $elements = [];

    /** @var int Index of the current front element in the queue */
    private int $front = 0;

    /** @var int Index where the next rear element will be inserted */
    private int $rear = 0;

    /**
     * Create a new FIFO OrderQueue and optionally enqueue an initial list of orders.
     *
     * @param array<int, mixed> $initialOrders
     */
    public function __construct(array $initialOrders = [])
    {
        foreach ($initialOrders as $order) {
            if (is_array($order)) {
                $this->enqueue($order);
            }
        }
    }

    /**
     * Add an order record to the rear of the queue in O(1) time.
     *
     * @param array<string, mixed> $order
     */
    public function enqueue(array $order): void
    {
        $this->elements[$this->rear] = $order;
        $this->rear++;
    }

    /**
     * Remove and return the earliest order from the front of the queue in O(1) time
     * by advancing the front pointer instead of shifting array elements in O(n).
     *
     * @return array<string, mixed>|null
     */
    public function dequeue(): ?array
    {
        if ($this->isEmpty()) {
            return null;
        }

        $frontOrder = $this->elements[$this->front];
        unset($this->elements[$this->front]);
        $this->front++;

        // Reset pointers when the queue becomes completely empty to keep indices compact
        if ($this->front === $this->rear) {
            $this->elements = [];
            $this->front = 0;
            $this->rear = 0;
        }

        return $frontOrder;
    }

    /**
     * Inspect the order at the front of the queue in O(1) time without removing it.
     *
     * @return array<string, mixed>|null
     */
    public function peek(): ?array
    {
        if ($this->isEmpty()) {
            return null;
        }

        return $this->elements[$this->front];
    }

    /**
     * Check whether the queue has no remaining orders in O(1) time.
     */
    public function isEmpty(): bool
    {
        return $this->front >= $this->rear;
    }

    /**
     * Return the number of orders currently waiting in the queue in O(1) time.
     */
    public function size(): int
    {
        return $this->rear - $this->front;
    }

    /**
     * Return all remaining queued orders in FIFO sequence from front to rear in O(n) time.
     *
     * @return array<int, array<string, mixed>>
     */
    public function toArray(): array
    {
        $result = [];
        for ($i = $this->front; $i < $this->rear; $i++) {
            if (isset($this->elements[$i])) {
                $result[] = $this->elements[$i];
            }
        }

        return $result;
    }
}
