<?php

declare(strict_types=1);

namespace App\Models;

use Library\Database;
use Library\Exceptions\ValidationException;
use Library\OrderCompletion;

/**
 * Product, Order, Inventory, Offer & Voucher Domain Model mapped to `Product`, `Category`,
 * `Voucher`, `Customer_Order`, `Order_Item`, `Material`, `Payment`, and `Customization`
 * tables in `database/furniture.sql`.
 */
class Product
{
    private Database $db;

    public function __construct(?Database $db = null)
    {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Generate a deterministic or unique entity identifier matching database/furniture.sql conventions.
     */
    public function generateEntityId(string $entityType, string $seed = '', string $categoryId = ''): string
    {
        $type = strtolower(trim($entityType));
        $cleanSeed = trim($seed) !== '' ? trim($seed) : (string) round(microtime(true) * 1000);
        $num = 100 + (abs((int) crc32($type . ':' . $cleanSeed)) % 899);

        return match ($type) {
            'customer' => 'LR-CUS-' . $num,
            'admin' => 'ADM-LR-901',
            'category' => match (strtolower(trim($categoryId))) {
                'living'  => 'CAT-LR-01',
                'dining'  => 'CAT-LR-02',
                'bedroom' => 'CAT-LR-03',
                'office'  => 'CAT-LR-04',
                'kitchen' => 'CAT-LR-05',
                default   => 'CAT-LR-02',
            },
            'product'       => strtoupper($cleanSeed),
            'material'      => 'MAT-LR-' . $num,
            'voucher'       => 'VCH-LR-' . $num,
            'order'         => str_starts_with(strtoupper($cleanSeed), 'LR-') ? strtoupper($cleanSeed) : 'LR-ORD-' . $num,
            'order_item'    => 'OI-' . strtoupper(preg_replace('/[^A-Z0-9-]/i', '', $cleanSeed) ?: (string) $num),
            'payment'       => 'PAY-' . strtoupper(preg_replace('/[^A-Z0-9-]/i', '', $cleanSeed) ?: (string) $num),
            'customization' => 'CST-' . strtoupper(preg_replace('/[^A-Z0-9-]/i', '', $cleanSeed) ?: (string) $num),
            default         => 'ID-LR-' . $num,
        };
    }

    /**
     * Calculate color variant extra cost and effective unit price for a catalog product.
     *
     * @param array<string, mixed> $product
     * @return array<string, mixed>
     */
    public function computeVariantPricing(array $product, string $selectedColorName = ''): array
    {
        $basePrice = max(0.0, (float) ($product['price'] ?? 0));
        $discountPercent = max(0.0, min(80.0, (float) ($product['discountPercent'] ?? 0)));
        $variants = isset($product['colorVariants']) && is_array($product['colorVariants']) ? $product['colorVariants'] : [];

        $matchedVariant = null;
        $cleanColor = strtolower(trim($selectedColorName));
        if ($cleanColor !== '') {
            foreach ($variants as $v) {
                if (is_array($v) && strtolower(trim((string) ($v['name'] ?? ''))) === $cleanColor) {
                    $matchedVariant = $v;
                    break;
                }
            }
        }
        if ($matchedVariant === null && !empty($variants) && is_array($variants[0])) {
            $matchedVariant = $variants[0];
        }

        $extraCost = max(0.0, (float) ($matchedVariant['extraCost'] ?? 0));
        $variantListPrice = round($basePrice + $extraCost, 2);
        $effectiveUnitPrice = $discountPercent > 0
            ? round($variantListPrice * (1.0 - $discountPercent / 100.0))
            : round($variantListPrice);

        return [
            'basePrice'          => $basePrice,
            'extraCost'          => $extraCost,
            'discountPercent'    => $discountPercent,
            'variantListPrice'   => $variantListPrice,
            'effectiveUnitPrice' => $effectiveUnitPrice,
            'colorName'          => (string) ($matchedVariant['name'] ?? ($selectedColorName ?: 'Signature Finish')),
            'swatch'             => (string) ($matchedVariant['swatch'] ?? '#5C4033'),
            'materialNotes'      => (string) ($matchedVariant['materialNotes'] ?? ($product['material'] ?? 'Solid kiln-dried timber')),
        ];
    }

    /**
     * Return all catalog products (both Normal Products and Customized Messenger Products)
     * with their color variants (`Customization.ColorFinish` / `ExtraCost`) and storewide discount percentages.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(): array
    {
        $store = $this->db->readStore();
        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];
        return array_values(array_map(static function (array $product): array {
            $isCustomized = ($product['productType'] ?? '') === 'customized' || !empty($product['isCustomClientDesign']);
            $product['productType'] = $isCustomized ? 'customized' : 'standard';
            $product['origin'] = $isCustomized ? 'Messenger customization' : 'Admin';
            $product['isCustomClientDesign'] = $isCustomized;
            $product['publiclyVisible'] = true;
            $product['canBePurchased'] = true;
            $product['adminEditable'] = true;
            $product['customClientEmail'] = null;
            return $product;
        }, $products));
    }

    /**
     * Create or update a Normal Product ('standard') or Customized Product ('customized' from Messenger).
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function createOrUpdateProduct(array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $sku = strtoupper(trim((string) ($input['sku'] ?? '')));
        $image = trim((string) ($input['image'] ?? ''));
        $price = (float) ($input['price'] ?? 0);
        $discountPercent = max(0.0, min(80.0, (float) ($input['discountPercent'] ?? 0)));
        $rawType = strtolower(trim((string) ($input['productType'] ?? 'standard')));

        if (strlen($name) < 3) {
            throw new ValidationException('Product Name must be at least 3 characters.');
        }
        if (strlen($sku) < 4) {
            throw new ValidationException('SKU Code must be at least 4 characters.');
        }
        if ($image === '') {
            throw new ValidationException('Product image is required when adding or editing a product.');
        }
        if ($price < 50.0) {
            throw new ValidationException('Base Price must be at least $50.');
        }

        $isCustomized = ($rawType === 'customized' || $rawType === 'messenger');
        $productType = $isCustomized ? 'customized' : 'standard';
        $origin = $isCustomized ? 'Messenger customization' : 'Admin';
        $categoryId = (string) ($input['categoryId'] ?? 'dining');
        $inStockCount = max(0, (int) ($input['inStockCount'] ?? 3));

        return [
            'id'                      => (string) ($input['id'] ?? ($isCustomized ? 'furn-cust-' : 'furn-std-') . strtolower($sku)),
            'productId'               => $sku,
            'sku'                     => $sku,
            'name'                    => $name,
            'image'                   => $image,
            'productType'             => $productType,
            'origin'                  => $origin,
            'isCustomClientDesign'    => $isCustomized,
            'publiclyVisible'         => true,
            'canBePurchased'          => true,
            'adminEditable'           => true,
            'customClientEmail'       => null,
            'categoryId'              => $categoryId,
            'categoryFk'              => $this->generateEntityId('category', $categoryId, $categoryId),
            'price'                   => round($price),
            'discountPercent'         => round($discountPercent),
            'effectivePrice'          => round($price * (1.0 - $discountPercent / 100.0)),
            'inStockCount'            => $inStockCount,
            'stockStatus'             => $inStockCount > 0 ? 'In Stock' : 'Out of Stock',
            'leadTime'                => trim((string) ($input['leadTime'] ?? ($inStockCount > 0 ? 'Ready to Ship (5–7 Days)' : 'Made to Order (4–6 Weeks)'))),
            'material'                => trim((string) ($input['material'] ?? 'Solid Kiln-Dried Hardwood')),
            'dimensions'              => trim((string) ($input['dimensions'] ?? 'Standard Dimensions')),
            'finish'                  => trim((string) ($input['finish'] ?? 'Hand-rubbed organic oil')),
            'joinery'                 => trim((string) ($input['joinery'] ?? 'Mortise and tenon joinery')),
            'description'             => trim((string) ($input['description'] ?? 'Handcrafted solid timber furniture piece.')),
            'badge'                   => trim((string) ($input['badge'] ?? ($isCustomized ? 'Customized Messenger Piece' : 'New Release'))),
            'featured'                => (bool) ($input['featured'] ?? true),
            'colorVariants'           => isset($input['colorVariants']) && is_array($input['colorVariants']) ? $input['colorVariants'] : [],
            'messengerConversationId' => $isCustomized ? ($input['messengerConversationId'] ?? null) : null,
            'customizationNotes'      => $isCustomized ? ($input['customizationNotes'] ?? null) : null,
        ];
    }

    /**
     * Resolve the authoritative status of a voucher using Asia/Manila server time.
     *
     * @param array<string, mixed> $voucher
     */
    public function resolveVoucherStatus(array $voucher, ?int $nowTs = null): string
    {
        $rawStatus = trim((string) ($voucher['status'] ?? 'Active'));
        if ($rawStatus === 'Used') {
            return 'Used';
        }
        if ($rawStatus === 'Revoked' || $rawStatus === 'Cancelled') {
            return 'Revoked';
        }
        if ($rawStatus === 'Expired') {
            return 'Expired';
        }

        $manilaTz = new \DateTimeZone('Asia/Manila');
        $now = $nowTs ?? (new \DateTimeImmutable('now', $manilaTz))->getTimestamp();
        $expTs = $this->resolveVoucherExpirationTimestamp($voucher, $manilaTz);

        if ($expTs !== null) {
            $remainingSec = $expTs - $now;
            if ($remainingSec <= 0) {
                return 'Expired';
            }
            if ($remainingSec <= 3600) {
                return 'Expiring Soon';
            }
        }

        return 'Active';
    }

    /**
     * Resolve the Unix timestamp of a voucher's expiration in Asia/Manila timezone.
     *
     * @param array<string, mixed> $voucher
     */
    public function resolveVoucherExpirationTimestamp(array $voucher, ?\DateTimeZone $manilaTz = null): ?int
    {
        $tz = $manilaTz ?? new \DateTimeZone('Asia/Manila');
        $expiresAt = trim((string) ($voucher['expiresAt'] ?? ''));
        if ($expiresAt !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiresAt)) {
            try {
                $dt = new \DateTimeImmutable($expiresAt, $tz);
                return $dt->getTimestamp();
            } catch (\Throwable) {
                // Fall back to expiryDate
            }
        }

        $expiryDate = trim((string) ($voucher['expiryDate'] ?? $expiresAt));
        if ($expiryDate !== '') {
            try {
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiryDate)) {
                    $dt = new \DateTimeImmutable($expiryDate . ' 23:59:59', $tz);
                } else {
                    $dt = new \DateTimeImmutable($expiryDate, $tz);
                }
                return $dt->getTimestamp();
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    /**
     * Normalize all voucher statuses dynamically based on current server time.
     *
     * @param array<int, array<string, mixed>> $vouchers
     * @return array<int, array<string, mixed>>
     */
    public function normalizeVouchersStatus(array $vouchers): array
    {
        $manilaTz = new \DateTimeZone('Asia/Manila');
        $nowTs = (new \DateTimeImmutable('now', $manilaTz))->getTimestamp();

        foreach ($vouchers as &$v) {
            if (is_array($v)) {
                $v['discountType'] = 'fixed';
                $v['status'] = $this->resolveVoucherStatus($v, $nowTs);
            }
        }
        unset($v);

        return $vouchers;
    }

    /**
     * Validate and create a fixed-amount discount voucher with server-side issuance timestamp
     * and Asia/Manila expiration handling.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function createVoucher(array $input): array
    {
        $store = $this->db->readStore();
        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];
        $vouchers = isset($store['vouchers']) && is_array($store['vouchers']) ? $store['vouchers'] : [];

        $customerEmail = strtolower(trim((string) ($input['customerEmail'] ?? '')));
        if ($customerEmail === '' || filter_var($customerEmail, FILTER_VALIDATE_EMAIL) === false) {
            throw new ValidationException('Enter a valid customer email address.');
        }

        $furnitureId = trim((string) ($input['furnitureId'] ?? $input['productId'] ?? ''));
        $matchedProduct = null;
        foreach ($products as $prod) {
            if ((string) ($prod['id'] ?? '') === $furnitureId) {
                $matchedProduct = $prod;
                break;
            }
        }

        if ($furnitureId === '' || $matchedProduct === null) {
            throw new ValidationException('Select a valid eligible product from the catalog.');
        }

        $code = strtoupper(preg_replace('/\s+/', '-', trim((string) ($input['code'] ?? ''))) ?? '');
        if (strlen($code) < 3) {
            throw new ValidationException('Enter or generate a valid voucher code (at least 3 characters).');
        }

        foreach ($vouchers as $existing) {
            if (strtoupper(trim((string) ($existing['code'] ?? ''))) === $code) {
                throw new ValidationException('Voucher code "' . $code . '" already exists. Please generate or enter a unique code.');
            }
        }

        $discountAmount = round((float) ($input['discountAmount'] ?? $input['discountValue'] ?? 0), 2);
        if ($discountAmount <= 0) {
            throw new ValidationException('Discount Amount ($) must be greater than $0.');
        }

        $maxProductPrice = (float) ($matchedProduct['effectivePrice'] ?? $matchedProduct['price'] ?? 0);
        if ($maxProductPrice > 0 && $discountAmount > $maxProductPrice) {
            throw new ValidationException(
                sprintf(
                    'Discount Amount ($%s) cannot exceed the eligible product\'s price ($%s for %s).',
                    number_format($discountAmount, 0),
                    number_format($maxProductPrice, 0),
                    (string) ($matchedProduct['name'] ?? 'Selected Product')
                )
            );
        }

        $manilaTz = new \DateTimeZone('Asia/Manila');
        $issuedNow = new \DateTimeImmutable('now', $manilaTz);
        $issuedTs = $issuedNow->getTimestamp();

        $expirationMethod = strtolower(trim((string) ($input['expirationMethod'] ?? 'duration')));
        if ($expirationMethod !== 'custom' && $expirationMethod !== 'duration') {
            throw new ValidationException('Select a valid expiration method (Custom Date & Time or Set Duration).');
        }

        if ($expirationMethod === 'custom') {
            $expiryDate = trim((string) ($input['expiryDate'] ?? ''));
            $expiryTime = trim((string) ($input['expiryTime'] ?? ''));
            if ($expiryDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiryDate)) {
                throw new ValidationException('Select a valid expiration date.');
            }
            if ($expiryTime === '' || !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $expiryTime)) {
                throw new ValidationException('Select a valid expiration time.');
            }
            $timeNormalized = strlen($expiryTime) === 5 ? $expiryTime . ':00' : $expiryTime;
            try {
                $expiresDt = new \DateTimeImmutable($expiryDate . ' ' . $timeNormalized, $manilaTz);
            } catch (\Throwable) {
                throw new ValidationException('Invalid expiration date and time.');
            }
            if ($expiresDt->getTimestamp() <= $issuedTs) {
                throw new ValidationException('Expiration date and time cannot be in the past. Please choose a future time (Asia/Manila).');
            }
        } else {
            $durationValue = (float) ($input['durationValue'] ?? 0);
            $durationUnit = strtolower(trim((string) ($input['durationUnit'] ?? 'hours')));
            if ($durationValue <= 0) {
                throw new ValidationException('Duration must be greater than 0.');
            }
            $unitSeconds = match ($durationUnit) {
                'minutes', 'minute' => 60,
                'hours', 'hour'     => 3600,
                'days', 'day'       => 86400,
                default             => throw new ValidationException('Select a valid duration unit (Minutes, Hours, or Days).'),
            };
            $expiresTs = $issuedTs + (int) round($durationValue * $unitSeconds);
            $expiresDt = (new \DateTimeImmutable('@' . $expiresTs))->setTimezone($manilaTz);
        }

        $emailPrefix = explode('@', $customerEmail)[0] ?: 'Showroom Client';
        $defaultName = ucwords(str_replace(['.', '_', '-'], ' ', $emailPrefix));
        $customerName = trim((string) ($input['customerName'] ?? '')) ?: $defaultName;
        $issuedByAdmin = trim((string) ($input['issuedByAdmin'] ?? '')) ?: 'Lillia Mercier';
        $voucherId = strtoupper(trim((string) ($input['voucherId'] ?? ('VCH-LR-' . (100 + (abs((int) crc32($code)) % 899))))));

        $voucher = [
            'id'               => (string) ($input['id'] ?? ('vch-' . (int) round(microtime(true) * 1000))),
            'voucherId'        => $voucherId,
            'code'             => $code,
            'customerEmail'    => $customerEmail,
            'customerName'     => $customerName,
            'furnitureId'      => (string) $matchedProduct['id'],
            'furnitureSku'     => (string) ($matchedProduct['sku'] ?? 'LR-ITEM'),
            'furnitureName'    => (string) ($matchedProduct['name'] ?? 'Eligible Piece'),
            'productPrice'     => $maxProductPrice,
            'discountType'     => 'fixed',
            'discountPercent'  => null,
            'discountAmount'   => $discountAmount,
            'discountValue'    => $discountAmount,
            'status'           => 'Active',
            'issuedByAdmin'    => $issuedByAdmin,
            'createdAt'        => $issuedNow->format('Y-m-d'),
            'issuedAt'         => $issuedNow->format(\DateTimeInterface::ATOM),
            'expiryDate'       => $expiresDt->format('Y-m-d'),
            'expiresAt'        => $expiresDt->format(\DateTimeInterface::ATOM),
            'expirationMethod' => $expirationMethod,
        ];
        $voucher['status'] = $this->resolveVoucherStatus($voucher, $issuedTs);

        array_unshift($vouchers, $voucher);
        $store['vouchers'] = $this->normalizeVouchersStatus($vouchers);
        $this->db->writeStore($store);

        return $voucher;
    }

    /**
     * Revoke an issued voucher by ID or Code.
     *
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function revokeVoucher(string $voucherId): array
    {
        $cleanId = trim($voucherId);
        if ($cleanId === '') {
            throw new ValidationException('Voucher ID is required.');
        }

        $store = $this->db->readStore();
        $vouchers = isset($store['vouchers']) && is_array($store['vouchers']) ? $store['vouchers'] : [];
        $manilaTz = new \DateTimeZone('Asia/Manila');
        $revokedAt = (new \DateTimeImmutable('now', $manilaTz))->format(\DateTimeInterface::ATOM);

        $revokedVoucher = null;
        foreach ($vouchers as &$v) {
            $matchesId = (string) ($v['id'] ?? '') === $cleanId;
            $matchesCode = strcasecmp((string) ($v['code'] ?? ''), $cleanId) === 0;
            if (!$matchesId && !$matchesCode) {
                continue;
            }
            if (($v['status'] ?? '') === 'Used') {
                throw new ValidationException('Cannot revoke a voucher that has already been redeemed.');
            }
            $v['status'] = 'Revoked';
            $v['revokedAt'] = $revokedAt;
            $revokedVoucher = $v;
            break;
        }
        unset($v);

        if ($revokedVoucher === null) {
            throw new ValidationException('Voucher not found.');
        }

        $store['vouchers'] = $this->normalizeVouchersStatus($vouchers);
        $this->db->writeStore($store);

        return $revokedVoucher;
    }

    /**
     * Validate a single-customer, single-product Voucher matching the MySQL stored procedure
     * `check_voucher_use(p_voucher_id, p_order_id, p_check_status)` in `database/furniture.sql`.
     *
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function validateVoucherForCustomerAndProduct(
        string $code,
        string $customerEmail,
        string $productId
    ): array {
        $normalizedCode = strtoupper(trim($code));
        $normalizedEmail = strtolower(trim($customerEmail));

        if ($normalizedCode === '') {
            throw new ValidationException('Voucher code is required.');
        }

        $store = $this->db->readStore();
        $vouchers = isset($store['vouchers']) && is_array($store['vouchers']) ? $store['vouchers'] : [];
        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];

        foreach ($vouchers as $voucher) {
            if (strtoupper((string) ($voucher['code'] ?? '')) !== $normalizedCode) {
                continue;
            }

            $voucherEmail = strtolower(trim((string) ($voucher['customerEmail'] ?? '')));
            if ($voucherEmail !== '' && $voucherEmail !== 'all' && $voucherEmail !== '*') {
                if ($normalizedEmail === '' || $voucherEmail !== $normalizedEmail) {
                    throw new ValidationException(
                        'SQLSTATE[45000]: Voucher does not belong to the customer of this order (' . $voucher['customerEmail'] . ' only).'
                    );
                }
            }

            $targetProductId = (string) ($voucher['furnitureId'] ?? $voucher['productId'] ?? '');
            if ($targetProductId !== $productId) {
                $targetName = (string) ($voucher['furnitureName'] ?? $voucher['productName'] ?? $targetProductId);
                throw new ValidationException(
                    'This voucher is only valid for the selected product (' . $targetName . ').'
                );
            }

            $effectiveStatus = $this->resolveVoucherStatus($voucher);
            if ($effectiveStatus === 'Expired') {
                throw new ValidationException('SQLSTATE[45000]: Voucher "' . $normalizedCode . '" has expired.');
            }
            if ($effectiveStatus === 'Revoked') {
                throw new ValidationException('SQLSTATE[45000]: Voucher "' . $normalizedCode . '" has been revoked.');
            }
            if ($effectiveStatus !== 'Active' && $effectiveStatus !== 'Expiring Soon') {
                throw new ValidationException('SQLSTATE[45000]: Voucher is not active (Status: ' . $effectiveStatus . ').');
            }

            $discountAmount = (float) ($voucher['discountAmount'] ?? $voucher['discountValue'] ?? 0);
            if ($discountAmount <= 0) {
                throw new ValidationException('Voucher discount amount must be greater than $0.');
            }

            foreach ($products as $prod) {
                if ((string) ($prod['id'] ?? '') === $targetProductId) {
                    $maxPrice = (float) ($prod['effectivePrice'] ?? $prod['price'] ?? 0);
                    if ($maxPrice > 0 && $discountAmount > $maxPrice) {
                        throw new ValidationException('Voucher discount amount exceeds the eligible product price.');
                    }
                    break;
                }
            }

            $voucher['status'] = $effectiveStatus;
            return $voucher;
        }

        throw new ValidationException('Voucher code "' . $normalizedCode . '" was not found.');
    }

    /**
     * Server-side cart & voucher validation and discount recalculation.
     * Ensures a product-specific voucher ONLY discounts the product selected by the admin
     * and never discounts other products in the customer's shopping cart.
     *
     * @param array<int, array<string, mixed>> $cartItems
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function calculateCartOrderWithVoucher(
        array $cartItems,
        ?string $voucherCode,
        string $customerEmail
    ): array {
        if (empty($cartItems)) {
            throw new ValidationException('Shopping cart cannot be empty.');
        }

        $store = $this->db->readStore();
        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];
        $vouchers = isset($store['vouchers']) && is_array($store['vouchers']) ? $store['vouchers'] : [];

        $productMap = [];
        foreach ($products as $prod) {
            if (!empty($prod['id'])) {
                $productMap[(string) $prod['id']] = $prod;
            }
        }

        $matchedVoucher = null;
        $targetProductId = '';
        $normalizedCode = strtoupper(trim((string) $voucherCode));

        if ($normalizedCode !== '') {
            foreach ($vouchers as $v) {
                if (strtoupper(trim((string) ($v['code'] ?? ''))) === $normalizedCode) {
                    $matchedVoucher = $v;
                    break;
                }
            }

            if ($matchedVoucher === null) {
                throw new ValidationException('Voucher code "' . $normalizedCode . '" was not found.');
            }

            $effectiveStatus = $this->resolveVoucherStatus($matchedVoucher);
            if ($effectiveStatus === 'Expired') {
                throw new ValidationException('Voucher "' . $normalizedCode . '" has expired.');
            }
            if ($effectiveStatus === 'Revoked') {
                throw new ValidationException('Voucher "' . $normalizedCode . '" has been revoked and is no longer valid.');
            }
            if ($effectiveStatus !== 'Active' && $effectiveStatus !== 'Expiring Soon') {
                throw new ValidationException('Voucher "' . $normalizedCode . '" is no longer active (' . $effectiveStatus . ').');
            }
            $matchedVoucher['status'] = $effectiveStatus;

            $voucherEmail = strtolower(trim((string) ($matchedVoucher['customerEmail'] ?? '')));
            $normalizedEmail = strtolower(trim($customerEmail));
            if ($voucherEmail !== '' && $voucherEmail !== 'all' && $voucherEmail !== '*') {
                if ($normalizedEmail === '' || $voucherEmail !== $normalizedEmail) {
                    throw new ValidationException(
                        'SQLSTATE[45000]: Voucher does not belong to the customer of this order.'
                    );
                }
            }

            $targetProductId = (string) ($matchedVoucher['furnitureId'] ?? $matchedVoucher['productId'] ?? '');
            $hasEligibleProductInCart = false;
            foreach ($cartItems as $item) {
                $itemProductId = (string) ($item['productId'] ?? $item['furnitureId'] ?? '');
                if ($itemProductId !== '' && $itemProductId === $targetProductId) {
                    $hasEligibleProductInCart = true;
                    break;
                }
            }

            if (!$hasEligibleProductInCart) {
                $targetName = (string) ($matchedVoucher['furnitureName'] ?? $matchedVoucher['productName'] ?? $targetProductId);
                throw new ValidationException(
                    'This voucher is only valid for the selected product (' . $targetName . ').'
                );
            }

            $discountVal = (float) ($matchedVoucher['discountAmount'] ?? $matchedVoucher['discountValue'] ?? 0);
            if ($discountVal <= 0) {
                throw new ValidationException('Voucher "' . $normalizedCode . '" has an invalid discount amount.');
            }
            if (isset($productMap[$targetProductId])) {
                $maxProdPrice = (float) ($productMap[$targetProductId]['effectivePrice'] ?? $productMap[$targetProductId]['price'] ?? 0);
                if ($maxProdPrice > 0 && $discountVal > $maxProdPrice) {
                    throw new ValidationException(
                        'Voucher "' . $normalizedCode . '" discount ($' . $discountVal . ') exceeds the eligible product price ($' . $maxProdPrice . ').'
                    );
                }
            }
        }

        $isPercentage = $matchedVoucher !== null && (
            ($matchedVoucher['discountType'] ?? '') === 'percentage' ||
            (float) ($matchedVoucher['discountPercent'] ?? 0) > 0
        );
        $percentageRate = $isPercentage
            ? max(0.0, min(100.0, (float) ($matchedVoucher['discountPercent'] ?? $matchedVoucher['discountValue'] ?? $matchedVoucher['discountAmount'] ?? 0)))
            : 0.0;
        $remainingFixedDiscount = ($matchedVoucher !== null && !$isPercentage)
            ? max(0.0, (float) ($matchedVoucher['discountAmount'] ?? $matchedVoucher['discountValue'] ?? 0))
            : 0.0;

        $rawSubtotal = 0.0;
        $eligibleSubtotal = 0.0;
        $totalDiscount = 0.0;
        $lineBreakdowns = [];

        foreach ($cartItems as $item) {
            $itemProductId = (string) ($item['productId'] ?? $item['furnitureId'] ?? '');
            if (!isset($productMap[$itemProductId])) {
                throw new ValidationException('Invalid product "' . $itemProductId . '" in cart.');
            }

            $authoritativeProduct = $productMap[$itemProductId];
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $availableStock = max(0, (int) ($authoritativeProduct['inStockCount'] ?? 0));
            if ($availableStock <= 0) {
                throw new ValidationException('Product "' . ($authoritativeProduct['name'] ?? $itemProductId) . '" is currently out of stock.');
            }
            if ($quantity > $availableStock) {
                throw new ValidationException(
                    'Requested quantity (' . $quantity . ') for "' . ($authoritativeProduct['name'] ?? $itemProductId) . '" exceeds available stock (' . $availableStock . ').'
                );
            }

            $unitPrice = (float) ($item['unitPrice'] ?? $authoritativeProduct['effectivePrice'] ?? $authoritativeProduct['price'] ?? 0);
            $rawLineTotal = round($unitPrice * $quantity, 2);
            $rawSubtotal += $rawLineTotal;

            $isEligible = ($matchedVoucher !== null && $itemProductId === $targetProductId);
            $lineDiscount = 0.0;

            if ($isEligible) {
                $eligibleSubtotal += $rawLineTotal;
                if ($isPercentage) {
                    $lineDiscount = min($rawLineTotal, round($rawLineTotal * ($percentageRate / 100.0)));
                } else {
                    $lineDiscount = min($rawLineTotal, $remainingFixedDiscount);
                    $remainingFixedDiscount = max(0.0, $remainingFixedDiscount - $lineDiscount);
                }
                $totalDiscount += $lineDiscount;
            }

            $lineBreakdowns[] = [
                'productId'         => $itemProductId,
                'productName'       => (string) ($authoritativeProduct['name'] ?? ''),
                'unitPrice'         => $unitPrice,
                'quantity'          => $quantity,
                'rawLineTotal'      => $rawLineTotal,
                'isVoucherEligible' => $isEligible,
                'lineDiscount'      => $lineDiscount,
                'finalLineTotal'    => max(0.0, $rawLineTotal - $lineDiscount),
            ];
        }

        $subtotal = max(0.0, $rawSubtotal - $totalDiscount);
        $deliveryFee = $subtotal === 0.0 ? 0.0 : ($subtotal >= 5000.0 ? 0.0 : 250.0);
        $totalAmount = $subtotal + $deliveryFee;

        return [
            'rawSubtotal'           => $rawSubtotal,
            'eligibleSubtotal'      => $eligibleSubtotal,
            'voucherDiscountAmount' => $totalDiscount,
            'subtotal'              => $subtotal,
            'whiteGloveDeliveryFee' => $deliveryFee,
            'totalAmount'           => $totalAmount,
            'lineBreakdowns'        => $lineBreakdowns,
            'validatedVoucher'      => $matchedVoucher,
        ];
    }

    /**
     * Place a customer shopping cart order on the server:
     * - Validates customer delivery address & contact info
     * - Verifies product stock & deducts ordered quantities
     * - Validates and redeems optional product-specific voucher
     * - Creates Stock Out inventory audit records
     * - Persists new Order records and clears cartItems
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function placeCartOrder(array $payload): array
    {
        $store = $this->db->readStore();
        $cartItems = isset($payload['cartItems']) && is_array($payload['cartItems'])
            ? $payload['cartItems']
            : (isset($store['cartItems']) && is_array($store['cartItems']) ? $store['cartItems'] : []);

        if (empty($cartItems)) {
            throw new ValidationException('Your shopping cart is empty.');
        }

        $profile = isset($payload['customerProfile']) && is_array($payload['customerProfile'])
            ? $payload['customerProfile']
            : (isset($store['customerProfile']) && is_array($store['customerProfile']) ? $store['customerProfile'] : []);

        $customerName = trim((string) ($payload['customerName'] ?? $profile['name'] ?? ''));
        $customerEmail = strtolower(trim((string) ($payload['customerEmail'] ?? $profile['email'] ?? '')));
        $customerPhone = trim((string) ($payload['customerPhone'] ?? $profile['phone'] ?? ''));
        $deliveryAddress = trim((string) ($payload['deliveryAddress'] ?? $profile['address'] ?? ''));
        $voucherCode = trim((string) ($payload['voucherCode'] ?? ''));
        $paymentPlan = strtolower(trim((string) ($payload['paymentPlan'] ?? 'full'))) === 'deposit' ? 'deposit' : 'full';
        $paymentMethod = trim((string) ($payload['paymentMethod'] ?? 'Credit / Debit Card'));

        if ($customerName === '' || $customerEmail === '' || $deliveryAddress === '') {
            throw new ValidationException('Please complete your delivery address and contact profile before placing an order.');
        }

        $pricing = $this->calculateCartOrderWithVoucher($cartItems, $voucherCode !== '' ? $voucherCode : null, $customerEmail);
        $validatedVoucher = $pricing['validatedVoucher'];

        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];
        $vouchers = isset($store['vouchers']) && is_array($store['vouchers']) ? $store['vouchers'] : [];
        $orders = isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [];
        $transactions = isset($store['inventoryTransactions']) && is_array($store['inventoryTransactions'])
            ? $store['inventoryTransactions']
            : [];

        $manilaTz = new \DateTimeZone('Asia/Manila');
        $todayIso = (new \DateTimeImmutable('now', $manilaTz))->format('Y-m-d');
        $baseOrderNum = 2491 + count($orders);
        $createdOrders = [];

        foreach ($cartItems as $idx => $item) {
            $itemProductId = (string) ($item['productId'] ?? $item['furnitureId'] ?? '');
            $qty = max(1, (int) ($item['quantity'] ?? 1));
            $breakdown = $pricing['lineBreakdowns'][$idx] ?? null;

            $prodIndex = null;
            foreach ($products as $pIdx => $p) {
                if ((string) ($p['id'] ?? '') === $itemProductId) {
                    $prodIndex = $pIdx;
                    break;
                }
            }
            if ($prodIndex === null) {
                throw new ValidationException('Product "' . $itemProductId . '" was not found in the catalog.');
            }

            $catalogProduct = $products[$prodIndex];
            $prevStock = max(0, (int) ($catalogProduct['inStockCount'] ?? 0));
            if ($qty > $prevStock) {
                throw new ValidationException('Insufficient stock for "' . ($catalogProduct['name'] ?? $itemProductId) . '".');
            }
            $newStock = max(0, $prevStock - $qty);
            $products[$prodIndex]['inStockCount'] = $newStock;
            $products[$prodIndex]['stockStatus'] = $newStock > 0 ? 'In Stock' : 'Out of Stock';

            $orderNumber = 'LR-' . ($baseOrderNum + $idx);
            $lineRawTotal = (float) ($breakdown['rawLineTotal'] ?? ($qty * (float) ($item['unitPrice'] ?? $catalogProduct['price'] ?? 0)));
            $lineDiscount = (float) ($breakdown['lineDiscount'] ?? 0.0);
            $lineDelivery = ($idx === 0) ? (float) ($pricing['whiteGloveDeliveryFee'] ?? 0.0) : 0.0;
            $lineTotal = max(0.0, round($lineRawTotal - $lineDiscount + $lineDelivery, 2));
            $depositPaid = $paymentPlan === 'deposit' ? round($lineTotal * 0.5, 2) : $lineTotal;
            $balanceDue = max(0.0, round($lineTotal - $depositPaid, 2));

            $orderRecord = [
                'orderNumber'           => $orderNumber,
                'orderId'               => $orderNumber,
                'orderItemId'           => 'OI-' . $orderNumber . '-1',
                'paymentId'             => 'PAY-' . $orderNumber,
                'customizationId'       => 'CST-' . $orderNumber,
                'customerId'            => $this->generateEntityId('customer', $customerEmail),
                'productId'             => (string) ($catalogProduct['sku'] ?? $catalogProduct['productId'] ?? 'LR-ITEM'),
                'voucherId'             => ($validatedVoucher !== null && !empty($breakdown['isVoucherEligible'])) ? ($validatedVoucher['voucherId'] ?? null) : null,
                'customerName'          => $customerName,
                'customerEmail'         => $customerEmail,
                'customerPhone'         => $customerPhone,
                'deliveryAddress'       => $deliveryAddress,
                'furnitureId'           => (string) ($catalogProduct['id'] ?? $itemProductId),
                'furnitureName'         => (string) ($catalogProduct['name'] ?? $item['name'] ?? 'Catalog Piece'),
                'sku'                   => (string) ($catalogProduct['sku'] ?? $item['sku'] ?? 'LR-ITEM'),
                'quantity'              => $qty,
                'unitPrice'             => (float) ($breakdown['unitPrice'] ?? $item['unitPrice'] ?? $catalogProduct['price'] ?? 0),
                'productDiscountPercent'=> (float) ($catalogProduct['discountPercent'] ?? 0),
                'colorFinish'           => (string) ($item['selectedColor'] ?? 'Signature Finish'),
                'selectedColor'         => (string) ($item['selectedColor'] ?? 'Signature Finish'),
                'selectedColorSwatch'   => (string) ($item['selectedColorSwatch'] ?? '#5C4033'),
                'extraCost'             => (float) ($item['extraCost'] ?? 0),
                'customDimensions'      => (string) ($catalogProduct['dimensions'] ?? 'Standard Showroom Dimensions'),
                'materialFinish'        => (string) (($item['selectedColor'] ?? 'Signature Finish') . ' — ' . ($catalogProduct['material'] ?? 'Solid Timber')),
                'orderDate'             => $todayIso,
                'estimatedDelivery'     => (string) ($catalogProduct['leadTime'] ?? 'Ready to Ship (5–7 Days)'),
                'stage'                 => 'Deposit Received',
                'stageIndex'            => 0,
                'totalAmount'           => $lineTotal,
                'depositPaid'           => $depositPaid,
                'balanceDue'            => $balanceDue,
                'paymentMethod'         => $paymentMethod,
                'paymentStatus'         => $balanceDue <= 0.0 ? 'Paid' : 'Partial (50% Deposit)',
                'voucherCode'           => ($validatedVoucher !== null && !empty($breakdown['isVoucherEligible'])) ? $validatedVoucher['code'] : null,
                'voucherDiscountAmount' => $lineDiscount,
                'deliveryFee'           => $lineDelivery,
                'craftsmanNotes'        => 'Order placed via online showroom checkout (' . $paymentMethod . ').',
            ];

            array_unshift($orders, $orderRecord);
            $createdOrders[] = $orderRecord;

            array_unshift($transactions, [
                'id'              => 'inv-tx-' . (int) round(microtime(true) * 1000) . '-' . $idx,
                'date'            => $todayIso,
                'itemType'        => 'Product',
                'itemId'          => (string) $catalogProduct['id'],
                'itemName'        => (string) $catalogProduct['name'],
                'transactionType' => 'Stock Out',
                'quantity'        => $qty,
                'unit'            => 'pcs',
                'previousStock'   => $prevStock,
                'newStock'        => $newStock,
                'reason'          => 'Customer Order ' . $orderNumber . ' (' . $customerName . ')',
                'performedBy'     => $customerName,
            ]);
        }

        if ($validatedVoucher !== null) {
            foreach ($vouchers as &$v) {
                if (strcasecmp((string) ($v['code'] ?? ''), (string) ($validatedVoucher['code'] ?? '')) === 0) {
                    $v['status'] = 'Used';
                    $v['usedAt'] = $todayIso;
                    $v['usedByOrder'] = $createdOrders[0]['orderNumber'] ?? null;
                    break;
                }
            }
            unset($v);
        }

        $store['products'] = array_values($products);
        $store['orders'] = array_values($orders);
        $store['vouchers'] = $this->normalizeVouchersStatus($vouchers);
        $store['inventoryTransactions'] = array_values($transactions);
        $store['cartItems'] = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION['cartItems'] = [];
        }

        $this->db->writeStore($store);

        return [
            'createdOrders' => $createdOrders,
            'pricing'       => $pricing,
            'store'         => $store,
        ];
    }

    /**
     * Create a bespoke custom furniture commission order on the server:
     * - Validates custom dimensions (L >= 30, W >= 30, H >= 25 cm)
     * - Verifies & deducts workshop raw material stock
     * - Calculates custom joinery pricing & 50% deposit
     * - Logs Stock Out material movement & persists new Order
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function createCustomOrder(array $payload): array
    {
        $store = $this->db->readStore();
        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];
        $materials = isset($store['materials']) && is_array($store['materials']) ? $store['materials'] : [];
        $orders = isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [];
        $transactions = isset($store['inventoryTransactions']) && is_array($store['inventoryTransactions'])
            ? $store['inventoryTransactions']
            : [];

        $furnitureId = trim((string) ($payload['furnitureId'] ?? $payload['productId'] ?? ''));
        $materialId = trim((string) ($payload['materialId'] ?? ''));
        $finishColor = trim((string) ($payload['finishColor'] ?? 'Hand-Rubbed Organic Linen Oil'));
        $lengthCm = (float) ($payload['lengthCm'] ?? 0);
        $widthCm = (float) ($payload['widthCm'] ?? 0);
        $heightCm = (float) ($payload['heightCm'] ?? 0);
        $quantity = max(1, (int) ($payload['quantity'] ?? 1));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if ($lengthCm < 30 || $widthCm < 30 || $heightCm < 25) {
            throw new ValidationException('Please enter valid custom dimensions (minimum 30cm × 30cm × 25cm).');
        }

        $baseProduct = null;
        foreach ($products as $p) {
            if ((string) ($p['id'] ?? '') === $furnitureId) {
                $baseProduct = $p;
                break;
            }
        }
        if ($baseProduct === null && !empty($products)) {
            $baseProduct = $products[0];
        }
        if ($baseProduct === null) {
            throw new ValidationException('Select a valid base furniture model for customization.');
        }

        $matIdx = null;
        foreach ($materials as $idx => $m) {
            if ((string) ($m['id'] ?? '') === $materialId) {
                $matIdx = $idx;
                break;
            }
        }
        if ($matIdx === null && !empty($materials)) {
            $matIdx = 0;
        }
        if ($matIdx === null) {
            throw new ValidationException('Select a valid workshop timber or raw material.');
        }

        $material = $materials[$matIdx];
        $requiredUnitsPerItem = max(2, (int) round(($lengthCm * $widthCm) / 3500.0));
        $totalMaterialNeeded = $requiredUnitsPerItem * $quantity;
        $availableMatStock = (float) ($material['stockQuantity'] ?? $material['inStockCount'] ?? 0);

        if ($totalMaterialNeeded > $availableMatStock) {
            throw new ValidationException(
                sprintf(
                    'Insufficient workshop stock for %s: requires %s %s, but only %s %s available.',
                    (string) ($material['name'] ?? 'Material'),
                    (string) $totalMaterialNeeded,
                    (string) ($material['unit'] ?? 'units'),
                    (string) $availableMatStock,
                    (string) ($material['unit'] ?? 'units')
                )
            );
        }

        $baseUnit = (float) ($baseProduct['effectivePrice'] ?? $baseProduct['price'] ?? 1200);
        $materialSurcharge = round($requiredUnitsPerItem * (float) ($material['unitCost'] ?? 20) * 0.45);
        $customJoineryFee = 180.0;
        $unitCustomPrice = round($baseUnit + $materialSurcharge + $customJoineryFee);
        $totalAmount = round($unitCustomPrice * $quantity);
        $depositPaid = round($totalAmount * 0.5);
        $balanceDue = max(0.0, $totalAmount - $depositPaid);

        $newMatStock = round($availableMatStock - $totalMaterialNeeded, 2);
        $materials[$matIdx]['stockQuantity'] = $newMatStock;
        $materials[$matIdx]['inStockCount'] = $newMatStock;

        $profile = isset($store['customerProfile']) && is_array($store['customerProfile']) ? $store['customerProfile'] : [];
        $customerName = trim((string) ($payload['customerName'] ?? $profile['name'] ?? 'Rowena Vance'));
        $customerEmail = strtolower(trim((string) ($payload['customerEmail'] ?? $profile['email'] ?? 'rowena.vance@vancearchitects.com')));
        $customerPhone = trim((string) ($payload['customerPhone'] ?? $profile['phone'] ?? ''));
        $deliveryAddress = trim((string) ($payload['deliveryAddress'] ?? $profile['address'] ?? ''));

        $manilaTz = new \DateTimeZone('Asia/Manila');
        $todayIso = (new \DateTimeImmutable('now', $manilaTz))->format('Y-m-d');
        $orderNumber = 'LR-' . (2510 + count($orders));
        $dimensionsFormatted = sprintf('%dcm L × %dcm W × %dcm H', (int) round($lengthCm), (int) round($widthCm), (int) round($heightCm));

        $orderRecord = [
            'orderNumber'        => $orderNumber,
            'orderId'            => $orderNumber,
            'orderItemId'        => 'OI-' . $orderNumber . '-1',
            'paymentId'          => 'PAY-' . $orderNumber,
            'customizationId'    => 'CST-' . $orderNumber,
            'customerId'         => $this->generateEntityId('customer', $customerEmail),
            'productId'          => (string) ($baseProduct['sku'] ?? $baseProduct['productId'] ?? 'LR-CUSTOM'),
            'customerName'       => $customerName,
            'customerEmail'      => $customerEmail,
            'customerPhone'      => $customerPhone,
            'deliveryAddress'    => $deliveryAddress,
            'furnitureId'        => (string) ($baseProduct['id'] ?? $furnitureId),
            'furnitureName'      => ($baseProduct['name'] ?? 'Custom Piece') . ' (Custom Commission)',
            'sku'                => ($baseProduct['sku'] ?? 'LR-CUST') . '-CUST',
            'quantity'           => $quantity,
            'unitPrice'          => $unitCustomPrice,
            'colorFinish'        => $finishColor,
            'selectedColor'      => $finishColor,
            'extraCost'          => $materialSurcharge + $customJoineryFee,
            'customDimensions'   => $dimensionsFormatted,
            'materialFinish'     => ($material['name'] ?? 'Solid Timber') . ' · ' . $finishColor,
            'orderDate'          => $todayIso,
            'estimatedDelivery'  => 'Custom Atelier Build (6–8 Weeks)',
            'stage'              => 'Deposit Received',
            'stageIndex'         => 0,
            'totalAmount'        => $totalAmount,
            'depositPaid'        => $depositPaid,
            'balanceDue'         => $balanceDue,
            'paymentMethod'      => 'Bank Wire / 50% Commission Deposit',
            'paymentStatus'      => 'Partial (50% Deposit)',
            'isCustomCommission' => true,
            'craftsmanNotes'     => $notes !== '' ? $notes : 'Custom dimensions ' . $dimensionsFormatted . ' using ' . ($material['name'] ?? 'Workshop Timber') . '.',
        ];

        array_unshift($orders, $orderRecord);
        array_unshift($transactions, [
            'id'              => 'inv-tx-' . (int) round(microtime(true) * 1000),
            'date'            => $todayIso,
            'itemType'        => 'Material',
            'itemId'          => (string) ($material['id'] ?? ''),
            'itemName'        => (string) ($material['name'] ?? 'Material'),
            'transactionType' => 'Stock Out',
            'quantity'        => $totalMaterialNeeded,
            'unit'            => (string) ($material['unit'] ?? 'units'),
            'previousStock'   => $availableMatStock,
            'newStock'        => $newMatStock,
            'reason'          => 'Custom Commission ' . $orderNumber . ' (' . $dimensionsFormatted . ')',
            'performedBy'     => $customerName,
        ]);

        $store['materials'] = array_values($materials);
        $store['orders'] = array_values($orders);
        $store['inventoryTransactions'] = array_values($transactions);
        $this->db->writeStore($store);

        return [
            'order' => $orderRecord,
            'store' => $store,
        ];
    }

    /**
     * Update an order's production stage, payment status, and completion timestamp in Asia/Manila time.
     *
     * @param array<string, mixed> $updates
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function updateOrderStatus(string $orderNumber, array $updates): array
    {
        $cleanOrderNo = trim($orderNumber);
        if ($cleanOrderNo === '') {
            throw new ValidationException('Order number is required.');
        }

        $store = $this->db->readStore();
        $orders = isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [];
        $stages = ['Deposit Received', 'Timber Joinery', 'Surface Finishing', 'Quality Inspection', 'White-Glove Delivery', 'Completed'];

        $updatedOrder = null;
        foreach ($orders as &$ord) {
            if (strcasecmp((string) ($ord['orderNumber'] ?? ''), $cleanOrderNo) !== 0) {
                continue;
            }
            $previousOrder = $ord;

            if (isset($updates['stage']) && trim((string) $updates['stage']) !== '') {
                $newStage = trim((string) $updates['stage']);
                $ord['stage'] = $newStage;
                $stageIdx = array_search($newStage, $stages, true);
                if ($stageIdx !== false) {
                    $ord['stageIndex'] = $stageIdx;
                }
            } elseif (isset($updates['stageIndex']) && is_numeric($updates['stageIndex'])) {
                $idx = max(0, min(count($stages) - 1, (int) $updates['stageIndex']));
                $ord['stageIndex'] = $idx;
                $ord['stage'] = $stages[$idx];
            }

            if (isset($updates['paymentStatus']) && trim((string) $updates['paymentStatus']) !== '') {
                $ord['paymentStatus'] = trim((string) $updates['paymentStatus']);
            }
            if (isset($updates['estimatedDelivery']) && trim((string) $updates['estimatedDelivery']) !== '') {
                $ord['estimatedDelivery'] = trim((string) $updates['estimatedDelivery']);
            }
            if (isset($updates['craftsmanNotes'])) {
                $ord['craftsmanNotes'] = trim((string) $updates['craftsmanNotes']);
            }

            if (
                strcasecmp((string) ($ord['paymentStatus'] ?? ''), 'Paid') === 0 ||
                OrderCompletion::isCompleted($ord)
            ) {
                $ord['depositPaid'] = (float) ($ord['totalAmount'] ?? $ord['depositPaid'] ?? 0);
                $ord['balanceDue'] = 0.0;
                $ord['paymentStatus'] = 'Paid';
            }

            $ord = OrderCompletion::withCompletedTimestamp($ord, $previousOrder);
            $updatedOrder = $ord;
            break;
        }
        unset($ord);

        if ($updatedOrder === null) {
            throw new ValidationException('Order "' . $cleanOrderNo . '" not found.');
        }

        $store['orders'] = array_values($orders);
        $this->db->writeStore($store);

        return $updatedOrder;
    }

    /**
     * Request order cancellation by customer (allowed only in early production stages).
     *
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function requestOrderCancellation(string $orderNumber): array
    {
        $cleanOrderNo = trim($orderNumber);
        if ($cleanOrderNo === '') {
            throw new ValidationException('Order number is required.');
        }

        $store = $this->db->readStore();
        $orders = isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [];
        $updatedOrder = null;

        foreach ($orders as &$ord) {
            if (strcasecmp((string) ($ord['orderNumber'] ?? ''), $cleanOrderNo) !== 0) {
                continue;
            }
            $stageIdx = (int) ($ord['stageIndex'] ?? 0);
            if ($stageIdx > 1 || ($ord['stage'] ?? '') === 'Cancelled') {
                throw new ValidationException('Orders can only be cancelled prior to Surface Finishing.');
            }
            $ord['cancellationRequested'] = true;
            $ord['cancellationStatus'] = 'Pending Admin Review';
            $ord['craftsmanNotes'] = 'Customer requested order cancellation — awaiting workshop admin approval.';
            $updatedOrder = $ord;
            break;
        }
        unset($ord);

        if ($updatedOrder === null) {
            throw new ValidationException('Order "' . $cleanOrderNo . '" not found.');
        }

        $store['orders'] = array_values($orders);
        $this->db->writeStore($store);

        return $updatedOrder;
    }

    /**
     * Approve or decline a customer's order cancellation request (Admin action).
     *
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function resolveOrderCancellation(string $orderNumber, string $decision): array
    {
        $cleanOrderNo = trim($orderNumber);
        $cleanDecision = strtolower(trim($decision));
        if ($cleanOrderNo === '') {
            throw new ValidationException('Order number is required.');
        }

        $store = $this->db->readStore();
        $orders = isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [];
        $updatedOrder = null;

        foreach ($orders as &$ord) {
            if (strcasecmp((string) ($ord['orderNumber'] ?? ''), $cleanOrderNo) !== 0) {
                continue;
            }
            if ($cleanDecision === 'approve' || $cleanDecision === 'approved') {
                $ord['stage'] = 'Cancelled';
                $ord['cancellationRequested'] = false;
                $ord['cancellationStatus'] = 'Approved';
                $ord['balanceDue'] = 0.0;
                $ord['paymentStatus'] = 'Refunded / Voided';
                $ord['craftsmanNotes'] = 'Order cancellation approved by workshop administrator.';
            } else {
                $ord['cancellationRequested'] = false;
                $ord['cancellationStatus'] = 'Declined';
                $ord['craftsmanNotes'] = 'Cancellation request declined — timber joinery already underway.';
            }
            $updatedOrder = $ord;
            break;
        }
        unset($ord);

        if ($updatedOrder === null) {
            throw new ValidationException('Order "' . $cleanOrderNo . '" not found.');
        }

        $store['orders'] = array_values($orders);
        $this->db->writeStore($store);

        return $updatedOrder;
    }

    /**
     * Record full payment of remaining balance on an order.
     *
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function recordOrderPayment(string $orderNumber, string $paymentMethod = 'Credit / Debit Card'): array
    {
        $cleanOrderNo = trim($orderNumber);
        if ($cleanOrderNo === '') {
            throw new ValidationException('Order number is required.');
        }

        $store = $this->db->readStore();
        $orders = isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [];
        $manilaTz = new \DateTimeZone('Asia/Manila');
        $todayIso = (new \DateTimeImmutable('now', $manilaTz))->format('Y-m-d');
        $updatedOrder = null;

        foreach ($orders as &$ord) {
            if (strcasecmp((string) ($ord['orderNumber'] ?? ''), $cleanOrderNo) !== 0) {
                continue;
            }
            $ord['depositPaid'] = (float) ($ord['totalAmount'] ?? $ord['depositPaid'] ?? 0);
            $ord['balanceDue'] = 0.0;
            $ord['paymentStatus'] = 'Paid';
            $ord['paymentMethod'] = trim($paymentMethod) !== '' ? trim($paymentMethod) : 'Credit / Debit Card';
            $ord['lastPaymentDate'] = $todayIso;
            $updatedOrder = $ord;
            break;
        }
        unset($ord);

        if ($updatedOrder === null) {
            throw new ValidationException('Order "' . $cleanOrderNo . '" not found.');
        }

        $store['orders'] = array_values($orders);
        $this->db->writeStore($store);

        return $updatedOrder;
    }

    /**
     * Validate and build a Workshop Raw Material record (Material table).
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function createOrUpdateMaterial(array $input): array
    {
        $name = trim((string) ($input['name'] ?? $input['materialName'] ?? ''));
        $materialType = trim((string) ($input['materialType'] ?? 'Hardwood Timber'));
        $unit = trim((string) ($input['unit'] ?? 'bd ft'));
        $unitCost = (float) ($input['unitCost'] ?? -1);
        $stockQuantity = (float) ($input['stockQuantity'] ?? 0);

        if (strlen($name) < 2) {
            throw new ValidationException('Material Name must be at least 2 characters.');
        }
        if ($unit === '') {
            throw new ValidationException('Unit of measurement is required.');
        }
        if ($unitCost < 0) {
            throw new ValidationException('Unit Cost must be 0 or greater.');
        }
        if ($stockQuantity < 0) {
            throw new ValidationException('Stock Quantity must be 0 or greater.');
        }

        $id = (string) ($input['id'] ?? 'mat-' . time());
        return [
            'id'            => $id,
            'materialId'    => (string) ($input['materialId'] ?? $this->generateEntityId('material', $name)),
            'name'          => $name,
            'materialType'  => $materialType,
            'unit'          => $unit,
            'unitCost'      => round($unitCost, 2),
            'stockQuantity' => round($stockQuantity, 2),
            'inStockCount'  => round($stockQuantity, 2),
            'reorderPoint'  => max(1, (int) ($input['reorderPoint'] ?? 15)),
            'supplier'      => trim((string) ($input['supplier'] ?? 'Atelier Timber Partner')),
            'updatedAt'     => date('Y-m-d'),
        ];
    }

    /**
     * Record a Material Stock In or Stock Out movement and enforce non-negative inventory levels.
     *
     * @param array<string, mixed> $materialOrProduct
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function recordStockMovement(array $materialOrProduct, array $input): array
    {
        $type = trim((string) ($input['transactionType'] ?? 'Stock In')) === 'Stock Out' ? 'Stock Out' : 'Stock In';
        $quantity = (float) ($input['quantity'] ?? 0);
        if ($quantity <= 0) {
            throw new ValidationException('Stock movement quantity must be greater than zero.');
        }

        $previousStock = max(0.0, (float) ($materialOrProduct['stockQuantity'] ?? $materialOrProduct['inStockCount'] ?? 0));
        if ($type === 'Stock Out' && $quantity > $previousStock) {
            throw new ValidationException(
                'Cannot deduct ' . $quantity . ' from "' . ($materialOrProduct['name'] ?? 'Material') . '". Only ' . $previousStock . ' available in stock.'
            );
        }

        $newStock = round($type === 'Stock In' ? ($previousStock + $quantity) : ($previousStock - $quantity), 2);

        return [
            'previousStock'   => $previousStock,
            'newStock'        => $newStock,
            'transactionType' => $type,
            'quantity'        => $quantity,
        ];
    }

    /**
     * Execute and persist a workshop raw material Stock In / Stock Out movement and audit log entry.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function applyMaterialStockMovement(array $payload): array
    {
        $materialId = trim((string) ($payload['materialId'] ?? $payload['itemId'] ?? ''));
        if ($materialId === '') {
            throw new ValidationException('Material ID is required.');
        }

        $store = $this->db->readStore();
        $materials = isset($store['materials']) && is_array($store['materials']) ? $store['materials'] : [];
        $transactions = isset($store['inventoryTransactions']) && is_array($store['inventoryTransactions'])
            ? $store['inventoryTransactions']
            : [];

        $targetIdx = null;
        foreach ($materials as $idx => $mat) {
            if ((string) ($mat['id'] ?? '') === $materialId) {
                $targetIdx = $idx;
                break;
            }
        }

        if ($targetIdx === null) {
            throw new ValidationException('Selected material was not found in workshop inventory.');
        }

        $material = $materials[$targetIdx];
        $movement = $this->recordStockMovement($material, $payload);
        $manilaTz = new \DateTimeZone('Asia/Manila');
        $todayIso = (new \DateTimeImmutable('now', $manilaTz))->format('Y-m-d');

        $materials[$targetIdx]['stockQuantity'] = $movement['newStock'];
        $materials[$targetIdx]['inStockCount'] = $movement['newStock'];
        $materials[$targetIdx]['updatedAt'] = $todayIso;

        $txRecord = [
            'id'              => 'inv-tx-' . (int) round(microtime(true) * 1000),
            'date'            => $todayIso,
            'itemType'        => 'Material',
            'itemId'          => (string) ($material['id'] ?? $materialId),
            'itemName'        => (string) ($material['name'] ?? 'Material'),
            'transactionType' => $movement['transactionType'],
            'quantity'        => $movement['quantity'],
            'unit'            => (string) ($material['unit'] ?? 'units'),
            'previousStock'   => $movement['previousStock'],
            'newStock'        => $movement['newStock'],
            'reason'          => trim((string) ($payload['reason'] ?? ($movement['transactionType'] === 'Stock In' ? 'Supplier Restock' : 'Workshop Production Allocation'))),
            'performedBy'     => trim((string) ($payload['performedBy'] ?? 'Lillia Mercier')),
        ];

        array_unshift($transactions, $txRecord);
        $store['materials'] = array_values($materials);
        $store['inventoryTransactions'] = array_values($transactions);
        $this->db->writeStore($store);

        return [
            'material'              => $materials[$targetIdx],
            'transaction'           => $txRecord,
            'materials'             => $store['materials'],
            'inventoryTransactions' => $store['inventoryTransactions'],
        ];
    }

    /**
     * Validate and persist a customer "Make an Offer" Messenger proposal.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function validateAndCreateOffer(array $input): array
    {
        $clientName = trim((string) ($input['clientName'] ?? ''));
        $clientContact = trim((string) ($input['clientContact'] ?? ''));
        $proposedPrice = (float) ($input['proposedPrice'] ?? 0);
        $quantity = max(1, min(50, (int) ($input['quantity'] ?? 1)));

        if (strlen($clientName) < 2) {
            throw new ValidationException('Please enter your full name (at least 2 characters).');
        }
        if (strlen($clientContact) < 5) {
            throw new ValidationException('Please provide a valid email address or phone number.');
        }
        if ($proposedPrice < 25.0) {
            throw new ValidationException('Please enter a valid proposed offer amount (at least $25).');
        }

        $store = $this->db->readStore();
        $products = isset($store['products']) && is_array($store['products']) ? $store['products'] : [];
        $furnitureId = trim((string) ($input['furnitureId'] ?? $input['productId'] ?? ''));
        $matchedProduct = null;
        foreach ($products as $p) {
            if ((string) ($p['id'] ?? '') === $furnitureId) {
                $matchedProduct = $p;
                break;
            }
        }
        if ($matchedProduct === null && !empty($products)) {
            $matchedProduct = $products[0];
        }

        $listedPrice = (float) ($input['listedPrice'] ?? ($matchedProduct['effectivePrice'] ?? $matchedProduct['price'] ?? $proposedPrice));
        $manilaTz = new \DateTimeZone('Asia/Manila');
        $now = new \DateTimeImmutable('now', $manilaTz);
        $proposalCode = 'LR-OFFER-' . strtoupper(substr(md5($clientName . microtime(true)), 0, 5));

        $offerRecord = [
            'proposalCode'      => $proposalCode,
            'createdAtIso'      => $now->format(\DateTimeInterface::ATOM),
            'createdAtFormatted'=> $now->format('M j, Y, g:i A'),
            'furnitureId'       => (string) ($matchedProduct['id'] ?? $furnitureId),
            'furnitureName'     => (string) ($matchedProduct['name'] ?? $input['furnitureName'] ?? 'Custom Showroom Piece'),
            'sku'               => (string) ($matchedProduct['sku'] ?? $input['sku'] ?? 'LR-CUSTOM'),
            'listedPrice'       => round($listedPrice, 2),
            'proposedPrice'     => round($proposedPrice, 2),
            'quantity'          => $quantity,
            'selectedFinish'    => trim((string) ($input['selectedFinish'] ?? 'Signature Finish')),
            'customDimensions'  => trim((string) ($input['customDimensions'] ?? ($matchedProduct['dimensions'] ?? 'Standard Showroom Dimensions'))),
            'clientName'        => $clientName,
            'clientContact'     => $clientContact,
            'notes'             => trim((string) ($input['notes'] ?? 'No additional customization notes.')),
        ];

        $offers = isset($store['offers']) && is_array($store['offers']) ? $store['offers'] : [];
        array_unshift($offers, $offerRecord);
        $store['offers'] = array_slice($offers, 0, 20);
        $this->db->writeStore($store);

        return $offerRecord;
    }

    /**
     * Remove a product from the catalog by ID.
     *
     * @param array<int, array<string, mixed>> $products
     * @param string $productId
     * @return array<int, array<string, mixed>>
     * @throws ValidationException
     */
    public function removeProduct(array $products, string $productId): array
    {
        $cleanId = trim($productId);
        if ($cleanId === '') {
            throw new ValidationException('Product ID is required to remove a product.');
        }

        $filtered = array_values(array_filter($products, static function (array $p) use ($cleanId): bool {
            return (string) ($p['id'] ?? '') !== $cleanId;
        }));

        if (count($filtered) === count($products)) {
            throw new ValidationException('Product not found in catalog.');
        }

        return $filtered;
    }
}
