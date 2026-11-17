<?php

declare(strict_types=1);

namespace Library;

/**
 * Explicit Hash Table with Polynomial Rolling ASCII Hash Function & Separate Chaining (PSR-4: Library\HashTable).
 *
 * // ALGORITHM B5: Hash function
 * // Chapter: Chapter 9 (Hash Tables)
 * // Purpose: Converts string keys (Voucher Codes, Product IDs, Order IDs, and Customer Emails)
 * //          into bucket indices using ASCII character codes % table size, paired with Separate
 * //          Chaining collision resolution for O(1) average lookup and duplicate order detection.
 * // Time Complexity: O(key length) for hash computation; O(1) average insert/search/delete (O(n) worst case)
 * // Space Complexity: O(n + m) where n is the number of stored key-value pairs and m is the bucket count
 */
final class HashTable
{
    /** @var array<int, array<int, array{key: string, value: mixed}>> Fixed-size array of bucket chains */
    private array $buckets;

    /** @var int Number of buckets (chosen as a prime number to distribute keys evenly) */
    private int $bucketCount;

    /** @var int Number of unique keys currently stored */
    private int $count = 0;

    public function __construct(int $bucketCount = 53)
    {
        $this->bucketCount = max(7, $bucketCount);
        $this->buckets = array_fill(0, $this->bucketCount, []);
    }

    /**
     * // ALGORITHM B5: Hash function
     * // Chapter: Chapter 9 (Hash Tables)
     * // Purpose: Turns a string key into a valid bucket number (0 to bucketCount - 1)
     * //          by summing weighted ASCII character codes modulo the table size.
     * // Time Complexity: O(key length)
     * // Space Complexity: O(1) auxiliary space
     */
    public function hashKey(string $key): int
    {
        $normalized = trim($key);
        $length = strlen($normalized);
        $hashSum = 0;

        for ($i = 0; $i < $length; $i++) {
            $hashSum = ($hashSum * 31 + ord($normalized[$i])) % $this->bucketCount;
        }

        return $hashSum < 0 ? $hashSum + $this->bucketCount : $hashSum;
    }

    /**
     * Insert or update a key-value pair in the computed bucket chain (Separate Chaining).
     */
    public function put(string $key, mixed $value): void
    {
        $bucketIndex = $this->hashKey($key);
        $chain = &$this->buckets[$bucketIndex];
        $chainLength = count($chain);

        for ($i = 0; $i < $chainLength; $i++) {
            if ($chain[$i]['key'] === $key) {
                $chain[$i]['value'] = $value;
                return;
            }
        }

        $chain[] = [
            'key'   => $key,
            'value' => $value,
        ];
        $this->count++;
    }

    /**
     * Retrieve the value associated with a key in O(1) average time, or return $default if not found.
     */
    public function get(string $key, mixed $default = null): mixed
    {
        $bucketIndex = $this->hashKey($key);
        $chain = $this->buckets[$bucketIndex];
        $chainLength = count($chain);

        for ($i = 0; $i < $chainLength; $i++) {
            if ($chain[$i]['key'] === $key) {
                return $chain[$i]['value'];
            }
        }

        return $default;
    }

    /**
     * Check whether a key exists in the hash table in O(1) average time.
     */
    public function has(string $key): bool
    {
        $bucketIndex = $this->hashKey($key);
        $chain = $this->buckets[$bucketIndex];
        $chainLength = count($chain);

        for ($i = 0; $i < $chainLength; $i++) {
            if ($chain[$i]['key'] === $key) {
                return true;
            }
        }

        return false;
    }

    /**
     * Delete a key-value pair from its bucket chain in O(1) average time.
     */
    public function remove(string $key): bool
    {
        $bucketIndex = $this->hashKey($key);
        $chain = &$this->buckets[$bucketIndex];
        $chainLength = count($chain);

        for ($i = 0; $i < $chainLength; $i++) {
            if ($chain[$i]['key'] === $key) {
                array_splice($chain, $i, 1);
                $this->count--;
                return true;
            }
        }

        return false;
    }

    /**
     * Return total number of stored entries.
     */
    public function size(): int
    {
        return $this->count;
    }

    /**
     * Return all stored values across all bucket chains.
     *
     * @return array<int, mixed>
     */
    public function values(): array
    {
        $all = [];
        for ($b = 0; $b < $this->bucketCount; $b++) {
            $chain = $this->buckets[$b];
            $chainLen = count($chain);
            for ($i = 0; $i < $chainLen; $i++) {
                $all[] = $chain[$i]['value'];
            }
        }

        return $all;
    }
}
