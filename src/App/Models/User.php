<?php

declare(strict_types=1);

namespace App\Models;

use Library\Database;
use Library\Exceptions\AuthenticationException;
use Library\Exceptions\DatabaseException;
use Library\Exceptions\ValidationException;

/**
 * Part 3: User Model — Lillia and Rowena Furniture
 * Maps to the MySQL `Customer` (CustomerID, FullName, Email, PasswordHash, PhoneNumber, Address)
 * and `Admin` (AdminID, Email, PasswordHash) tables defined in database/furniture.sql.
 */
class User
{
    private Database $db;

    /**
     * Default seeded accounts matching Customer and Admin tables in database/furniture.sql
     *
     * @var array<int, array<string, mixed>>
     */
    private const DEFAULT_ACCOUNTS = [
        [
            'id'           => 'LR-CUS-301',
            'customerId'   => 'LR-CUS-301',
            'role'         => 'Customer',
            'fullName'     => 'Rowena Vance',
            'email'        => 'rowena.vance@vancearchitects.com',
            'passwordPlain'=> 'ClientPass2025!',
            'phoneNumber'  => '+1 (212) 555-0148',
            'address'      => 'Suite 400, 118 Mercer St, SoHo, New York, NY 10013',
        ],
        [
            'id'           => 'LR-CUS-302',
            'customerId'   => 'LR-CUS-302',
            'role'         => 'Customer',
            'fullName'     => 'Julian Mercier',
            'email'        => 'j.mercier@mercierstudio.co',
            'passwordPlain'=> 'ClientPass2025!',
            'phoneNumber'  => '+1 (212) 555-0164',
            'address'      => '45 Crosby St, Loft 3B, New York, NY 10012',
        ],
        [
            'id'           => 'LR-CUS-304',
            'customerId'   => 'LR-CUS-304',
            'role'         => 'Customer',
            'fullName'     => 'Elena Rostova',
            'email'        => 'elena@rostovainteriors.com',
            'passwordPlain'=> 'ClientPass2025!',
            'phoneNumber'  => '+1 (212) 555-0182',
            'address'      => '720 Park Ave, Apt 9A, New York, NY 10021',
        ],
        [
            'id'           => 'LR-CUS-308',
            'customerId'   => 'LR-CUS-308',
            'role'         => 'Customer',
            'fullName'     => 'Marcus Sterling',
            'email'        => 'm.sterling@sterlingcapital.io',
            'passwordPlain'=> 'ClientPass2025!',
            'phoneNumber'  => '+1 (212) 555-0199',
            'address'      => '15 Central Park West, New York, NY 10023',
        ],
        [
            'id'           => 'LR-CUS-315',
            'customerId'   => 'LR-CUS-315',
            'role'         => 'Customer',
            'fullName'     => 'Clara Vance',
            'email'        => 'clara.vance@architects.io',
            'passwordPlain'=> 'ClientPass2025!',
            'phoneNumber'  => '+1 (212) 555-0148',
            'address'      => '412 Mercer St, Penthouse B, New York, NY 10013',
        ],
        [
            'id'           => 'LR-CUS-319',
            'customerId'   => 'LR-CUS-319',
            'role'         => 'Customer',
            'fullName'     => 'Julian Thorne',
            'email'        => 'j.thorne@studio-thorne.com',
            'passwordPlain'=> 'ClientPass2025!',
            'phoneNumber'  => '+1 (415) 555-0193',
            'address'      => '88 Pacific Ave, San Francisco, CA 94111',
        ],
        [
            'id'           => 'ADM-LR-901',
            'adminId'      => 'ADM-LR-901',
            'role'         => 'Admin',
            'fullName'     => 'Lillia Mercier (Business Owner)',
            'email'        => 'admin@lilliarowena.com',
            'passwordPlain'=> 'MasterJoinery#01',
            'phoneNumber'  => '+1 (212) 555-0100',
            'address'      => 'Lillia and Rowena Furniture Showroom, New York',
        ],
    ];

    public function __construct(?Database $db = null)
    {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Validate login input fields and throw ValidationException if invalid.
     *
     * @throws ValidationException
     */
    public function validateCredentials(string $email, string $password): void
    {
        $errors = [];
        $trimmedEmail = trim($email);

        if ($trimmedEmail === '') {
            $errors['email'] = 'Email address is required.';
        } elseif (!filter_var($trimmedEmail, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Please enter a valid email address.';
        }

        if ($password === '') {
            $errors['password'] = 'Password is required.';
        } elseif (strlen($password) < 6) {
            $errors['password'] = 'Password must be at least 6 characters.';
        }

        if (!empty($errors)) {
            throw new ValidationException(reset($errors), $errors);
        }
    }

    /**
     * Authenticate a Customer or Admin by email and password.
     *
     * @return array<string, mixed>
     * @throws ValidationException
     * @throws AuthenticationException
     * @throws DatabaseException
     */
    public function authenticate(string $email, string $password, ?string $expectedRole = null): array
    {
        $this->validateCredentials($email, $password);
        $normalizedEmail = strtolower(trim($email));

        $user = $this->findByEmail($normalizedEmail, $expectedRole);
        if ($user === null) {
            throw new AuthenticationException('No account found with that email address.');
        }

        $storedHash = (string) ($user['passwordHash'] ?? '');
        $plainFallback = (string) ($user['passwordPlain'] ?? '');

        $verified = false;
        if ($storedHash !== '' && password_verify($password, $storedHash)) {
            $verified = true;
        } elseif ($plainFallback !== '' && hash_equals($plainFallback, $password)) {
            $verified = true;
        }

        if (!$verified) {
            throw new AuthenticationException('Incorrect password for ' . $normalizedEmail . '.');
        }

        unset($user['passwordHash'], $user['passwordPlain']);
        return $user;
    }

    /**
     * Find a user in `Admin` or `Customer` table by email.
     *
     * @return array<string, mixed>|null
     * @throws DatabaseException
     */
    public function findByEmail(string $email, ?string $role = null): ?array
    {
        $normalizedEmail = strtolower(trim($email));

        if ($this->db->isMySqlConnected()) {
            if ($role === null || strcasecmp($role, 'Admin') === 0) {
                $adminRow = $this->db->fetch(
                    'SELECT AdminID AS id, Email AS email, PasswordHash AS passwordHash FROM Admin WHERE LOWER(Email) = :email LIMIT 1',
                    [':email' => $normalizedEmail]
                );
                if ($adminRow !== null) {
                    $adminRow['role'] = 'Admin';
                    $adminRow['fullName'] = 'Lillia Mercier (Admin)';
                    return $adminRow;
                }
            }

            if ($role === null || strcasecmp($role, 'Customer') === 0) {
                $customerRow = $this->db->fetch(
                    'SELECT CustomerID AS id, FullName AS fullName, Email AS email, PasswordHash AS passwordHash, PhoneNumber AS phoneNumber, Address AS address
                     FROM Customer WHERE LOWER(Email) = :email LIMIT 1',
                    [':email' => $normalizedEmail]
                );
                if ($customerRow !== null) {
                    $customerRow['role'] = 'Customer';
                    return $customerRow;
                }
            }
        }

        $accounts = $this->getAllSeedAndStoreUsers();
        foreach ($accounts as $account) {
            if (strtolower((string) $account['email']) === $normalizedEmail) {
                if ($role !== null && strcasecmp((string) $account['role'], $role) !== 0) {
                    continue;
                }
                return $account;
            }
        }

        return null;
    }

    /**
     * Register a new Customer in the `Customer` table (or JSON store fallback).
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws ValidationException
     * @throws DatabaseException
     */
    public function register(array $data): array
    {
        $fullName = trim((string) ($data['fullName'] ?? ''));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $phoneNumber = trim((string) ($data['phoneNumber'] ?? ''));
        $address = trim((string) ($data['address'] ?? ''));

        $errors = [];
        if ($fullName === '') {
            $errors['fullName'] = 'Full name is required.';
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }
        if (strlen($password) < 6) {
            $errors['password'] = 'Password must be at least 6 characters.';
        }
        if ($phoneNumber === '' || strlen($phoneNumber) < 7) {
            $errors['phoneNumber'] = 'A valid phone number is required.';
        }
        if ($address === '' || strlen($address) < 5) {
            $errors['address'] = 'A complete delivery address is required.';
        }

        if (!empty($errors)) {
            throw new ValidationException(reset($errors), $errors);
        }

        if ($this->findByEmail($email) !== null) {
            throw new ValidationException('An account with this email already exists.', [
                'email' => 'An account with this email already exists.',
            ]);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $customerId = 'LR-CUS-' . (320 + (abs((int) crc32($email . '|' . microtime(true))) % 679));

        if ($this->db->isMySqlConnected()) {
            $this->db->query(
                'INSERT INTO Customer (CustomerID, FullName, Email, PasswordHash, PhoneNumber, Address)
                 VALUES (:id, :name, :email, :hash, :phone, :addr)',
                [
                    ':id'    => $customerId,
                    ':name'  => $fullName,
                    ':email' => $email,
                    ':hash'  => $passwordHash,
                    ':phone' => $phoneNumber ?: null,
                    ':addr'  => $address ?: null,
                ]
            );
        } else {
            $store = $this->db->readStore();
            $customers = isset($store['customers']) && is_array($store['customers']) ? $store['customers'] : [];
            $newCustomer = [
                'id'           => $customerId,
                'customerId'   => $customerId,
                'role'         => 'Customer',
                'fullName'     => $fullName,
                'name'         => $fullName,
                'email'        => $email,
                'passwordHash' => $passwordHash,
                'passwordPlain'=> $password,
                'phoneNumber'  => $phoneNumber,
                'phone'        => $phoneNumber,
                'address'      => $address,
            ];
            $customers[] = $newCustomer;
            $store['customers'] = $customers;
            $this->db->writeStore($store);
        }

        return [
            'id'          => $customerId,
            'customerId'  => $customerId,
            'role'        => 'Customer',
            'fullName'    => $fullName,
            'email'       => $email,
            'phoneNumber' => $phoneNumber,
            'address'     => $address,
        ];
    }

    /**
     * Validate and update a customer's profile, delivery address, and directory record on the server.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function updateCustomerProfile(array $input): array
    {
        $name = trim((string) ($input['name'] ?? $input['fullName'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? $input['phoneNumber'] ?? ''));
        $city = trim((string) ($input['city'] ?? ''));
        $address = trim((string) ($input['address'] ?? ''));
        $notes = trim((string) ($input['notes'] ?? ''));
        $avatar = trim((string) ($input['avatar'] ?? ''));

        if ($name === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ValidationException('Full Name and a valid Email Address are required.');
        }
        if ($address === '') {
            throw new ValidationException('A delivery street address is required.');
        }

        $store = $this->db->readStore();
        $profile = [
            'name'    => $name,
            'email'   => $email,
            'phone'   => $phone,
            'city'    => $city,
            'address' => $address,
            'notes'   => $notes,
            'avatar'  => $avatar,
        ];
        $store['customerProfile'] = $profile;

        $customers = isset($store['customers']) && is_array($store['customers']) ? $store['customers'] : [];
        $updatedInList = false;
        foreach ($customers as &$c) {
            if (strtolower(trim((string) ($c['email'] ?? ''))) === $email) {
                $c['fullName'] = $name;
                $c['name'] = $name;
                $c['phoneNumber'] = $phone;
                $c['phone'] = $phone;
                $c['city'] = $city;
                $c['address'] = $address;
                $c['notes'] = $notes;
                if ($avatar !== '') {
                    $c['avatar'] = $avatar;
                }
                $updatedInList = true;
                break;
            }
        }
        unset($c);

        if (!$updatedInList) {
            $customerId = 'LR-CUS-' . (100 + (abs((int) crc32('customer:' . $email)) % 899));
            $customers[] = [
                'id'          => $customerId,
                'customerId'  => $customerId,
                'role'        => 'Customer',
                'fullName'    => $name,
                'name'        => $name,
                'email'       => $email,
                'phoneNumber' => $phone,
                'phone'       => $phone,
                'city'        => $city,
                'address'     => $address,
                'notes'       => $notes,
                'avatar'      => $avatar,
            ];
        }
        $store['customers'] = array_values($customers);

        if (isset($store['sessionUser']) && is_array($store['sessionUser'])) {
            $sessionEmail = strtolower(trim((string) ($store['sessionUser']['email'] ?? '')));
            if ($sessionEmail === $email || ($store['sessionUser']['role'] ?? '') === 'client') {
                $store['sessionUser']['name'] = $name;
                $store['sessionUser']['email'] = $email;
                if ($avatar !== '') {
                    $store['sessionUser']['avatar'] = $avatar;
                }
                if (session_status() === PHP_SESSION_ACTIVE) {
                    $_SESSION['user'] = $store['sessionUser'];
                }
            }
        }

        $this->db->writeStore($store);
        return $profile;
    }

    /**
     * Build the aggregated customer directory with total orders, spend, and balance due.
     *
     * @param array<int, array<string, mixed>> $orders
     * @param array<int, array<string, mixed>> $customers
     * @param array<string, mixed>|null $customerProfile
     * @return array<int, array<string, mixed>>
     */
    public function computeCustomerDirectory(array $orders, array $customers = [], ?array $customerProfile = null): array
    {
        $map = [];
        $upsert = static function (array $entry) use (&$map): void {
            $email = strtolower(trim((string) ($entry['email'] ?? '')));
            if ($email === '' || $email === 'admin@lilliarowena.com') {
                return;
            }
            if (!isset($map[$email])) {
                $num = 100 + (abs((int) crc32('customer:' . $email)) % 899);
                $map[$email] = [
                    'customerId'     => (string) ($entry['customerId'] ?? $entry['id'] ?? ('LR-CUS-' . $num)),
                    'name'           => (string) ($entry['fullName'] ?? $entry['name'] ?? $email),
                    'email'          => $email,
                    'phone'          => (string) ($entry['phoneNumber'] ?? $entry['phone'] ?? '—'),
                    'address'        => (string) ($entry['address'] ?? '—'),
                    'ordersCount'    => 0,
                    'totalSpent'     => 0.0,
                    'balanceDue'     => 0.0,
                    'lastOrderDate'  => '—',
                    'orderNumbers'   => [],
                    'accountStatus'  => (string) ($entry['accountStatus'] ?? 'Active Account'),
                ];
            } else {
                if (!empty($entry['fullName']) || !empty($entry['name'])) {
                    $map[$email]['name'] = (string) ($entry['fullName'] ?? $entry['name']);
                }
                if (!empty($entry['phoneNumber']) || !empty($entry['phone'])) {
                    $map[$email]['phone'] = (string) ($entry['phoneNumber'] ?? $entry['phone']);
                }
                if (!empty($entry['address'])) {
                    $map[$email]['address'] = (string) $entry['address'];
                }
            }
        };

        foreach (self::DEFAULT_ACCOUNTS as $seedAcc) {
            if (($seedAcc['role'] ?? '') === 'Customer') {
                $upsert($seedAcc);
            }
        }
        foreach ($customers as $c) {
            if (is_array($c)) {
                $upsert($c);
            }
        }
        if (is_array($customerProfile) && !empty($customerProfile['email'])) {
            $upsert($customerProfile);
        }

        foreach ($orders as $ord) {
            if (!is_array($ord)) {
                continue;
            }
            $email = strtolower(trim((string) ($ord['customerEmail'] ?? '')));
            if ($email === '') {
                continue;
            }
            $upsert([
                'customerId' => $ord['customerId'] ?? null,
                'name'       => $ord['customerName'] ?? $email,
                'email'      => $email,
                'phone'      => $ord['customerPhone'] ?? null,
                'address'    => $ord['deliveryAddress'] ?? null,
            ]);
            if (isset($map[$email])) {
                $map[$email]['ordersCount']++;
                $map[$email]['totalSpent'] += (float) ($ord['totalAmount'] ?? 0);
                $map[$email]['balanceDue'] += (float) ($ord['balanceDue'] ?? 0);
                $ordNo = (string) ($ord['orderNumber'] ?? '');
                if ($ordNo !== '') {
                    $map[$email]['orderNumbers'][] = $ordNo;
                }
                $ordDate = (string) ($ord['orderDate'] ?? '');
                if ($ordDate !== '' && ($map[$email]['lastOrderDate'] === '—' || $ordDate > $map[$email]['lastOrderDate'])) {
                    $map[$email]['lastOrderDate'] = $ordDate;
                }
            }
        }

        $list = array_values($map);
        usort($list, static fn(array $a, array $b): int => $b['totalSpent'] <=> $a['totalSpent']);
        return $list;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getAllSeedAndStoreUsers(): array
    {
        $users = [];
        foreach (self::DEFAULT_ACCOUNTS as $acc) {
            $acc['passwordHash'] = password_hash((string) $acc['passwordPlain'], PASSWORD_DEFAULT);
            $users[] = $acc;
        }

        try {
            $store = $this->db->readStore();
            if (isset($store['customers']) && is_array($store['customers'])) {
                foreach ($store['customers'] as $customUser) {
                    if (is_array($customUser)) {
                        $users[] = $customUser;
                    }
                }
            }
        } catch (DatabaseException) {
            // Ignore if store file not initialized yet
        }

        return $users;
    }
}
