<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\AnalyticsReport;
use App\Models\Product;
use App\Models\User;
use Library\Database;
use Library\Exceptions\AuthenticationException;
use Library\Exceptions\DatabaseException;
use Library\Exceptions\ValidationException;

/**
 * Part 4: HomeControllers
 * Handles Login, Logout, Dashboard rendering, and server-side POST actions in XAMPP / PHP.
 */
class HomeControllers
{
    private Database $db;
    private User $userModel;
    private Product $productModel;
    private AnalyticsReport $analyticsModel;

    public function __construct(?Database $db = null)
    {
        $this->db = $db ?? Database::getInstance();
        $this->userModel = new User($this->db);
        $this->productModel = new Product($this->db);
        $this->analyticsModel = new AnalyticsReport($this->db, $this->productModel);
    }

    /**
     * Render or process the Login page (`index.php` -> `views/login.php`).
     */
    public function login(): void
    {
        $error = null;
        $fieldErrors = [];
        $email = '';
        $role = 'Customer';

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
            $email = trim((string) ($_POST['email'] ?? ''));
            $password = (string) ($_POST['password'] ?? '');
            $role = trim((string) ($_POST['role'] ?? 'Customer'));
            $mode = strtolower(trim((string) ($_POST['mode'] ?? 'signin')));
            $isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH'])
                || str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');

            try {
                if ($mode === 'register' && strcasecmp($role, 'Admin') !== 0) {
                    $authenticatedUser = $this->userModel->register([
                        'fullName'    => trim((string) ($_POST['full_name'] ?? $_POST['fullName'] ?? '')),
                        'email'       => $email,
                        'password'    => $password,
                        'phoneNumber' => trim((string) ($_POST['phone_number'] ?? $_POST['phoneNumber'] ?? '')),
                        'address'     => trim((string) ($_POST['address'] ?? '')),
                    ]);
                } else {
                    $authenticatedUser = $this->userModel->authenticate($email, $password, $role);
                }
                $_SESSION['user'] = $authenticatedUser;
                $targetRole = strcasecmp((string) ($authenticatedUser['role'] ?? ''), 'Admin') === 0 ? 'admin' : 'client';

                if ($isAjax) {
                    jsonResponse([
                        'ok'       => true,
                        'user'     => $authenticatedUser,
                        'redirect' => 'home.php?role=' . $targetRole,
                    ]);
                }

                redirect('home.php?role=' . $targetRole);
            } catch (ValidationException $e) {
                $error = $e->getMessage();
                $fieldErrors = $e->getErrors();
                if ($isAjax) {
                    jsonResponse([
                        'ok'     => false,
                        'error'  => $error,
                        'errors' => $fieldErrors,
                    ], 422);
                }
            } catch (AuthenticationException $e) {
                $error = $e->getMessage();
                if ($isAjax) {
                    jsonResponse([
                        'ok'    => false,
                        'error' => $error,
                    ], 401);
                }
            } catch (DatabaseException $e) {
                $error = $e->getMessage();
                if ($isAjax) {
                    jsonResponse([
                        'ok'    => false,
                        'error' => $error,
                    ], 500);
                }
            }
        }

        $store = $this->db->readStore();
        require dirname(__DIR__, 2) . '/views/login.php';
    }

    /**
     * Render the Logged-In Dashboard page (`home.php` -> `views/home.php`)
     * and process server-side checkout, order, inventory, and profile POST requests.
     */
    public function home(): void
    {
        $user = currentUser();

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
            $action = trim((string) ($_POST['action'] ?? 'checkout'));
            try {
                switch ($action) {
                    case 'checkout':
                        $customerEmail = trim((string) ($_POST['customerEmail'] ?? ($user['email'] ?? '')));
                        $voucherCode = isset($_POST['voucherCode']) ? trim((string) $_POST['voucherCode']) : null;
                        $rawItems = $_POST['cartItems'] ?? '[]';
                        $cartItems = is_string($rawItems) ? (json_decode($rawItems, true) ?: []) : (is_array($rawItems) ? $rawItems : []);
                        $pricing = $this->productModel->calculateCartOrderWithVoucher($cartItems, $voucherCode, $customerEmail);
                        jsonResponse(['ok' => true, 'pricing' => $pricing]);
                        break;

                    case 'place_order':
                        $result = $this->productModel->placeCartOrder($_POST);
                        jsonResponse(['ok' => true, 'createdOrders' => $result['createdOrders'], 'pricing' => $result['pricing']]);
                        break;

                    case 'create_custom_order':
                        $result = $this->productModel->createCustomOrder($_POST);
                        jsonResponse(['ok' => true, 'order' => $result['order']]);
                        break;

                    case 'update_order_status':
                        $order = $this->productModel->updateOrderStatus((string) ($_POST['orderNumber'] ?? ''), $_POST);
                        jsonResponse(['ok' => true, 'order' => $order]);
                        break;

                    case 'record_stock_movement':
                        $result = $this->productModel->applyMaterialStockMovement($_POST);
                        jsonResponse(array_merge(['ok' => true], $result));
                        break;

                    case 'update_customer_profile':
                        $profile = $this->userModel->updateCustomerProfile($_POST);
                        jsonResponse(['ok' => true, 'customerProfile' => $profile]);
                        break;
                }
            } catch (\Throwable $e) {
                jsonResponse(['ok' => false, 'error' => $e->getMessage()], 422);
            }
        }

        $store = $this->db->readStore();
        $products = $this->productModel->getAll();
        $customerDirectory = $this->userModel->computeCustomerDirectory(
            isset($store['orders']) && is_array($store['orders']) ? $store['orders'] : [],
            isset($store['customers']) && is_array($store['customers']) ? $store['customers'] : [],
            isset($store['customerProfile']) && is_array($store['customerProfile']) ? $store['customerProfile'] : null
        );
        $analyticsReport = $this->analyticsModel->generateReport();
        require dirname(__DIR__, 2) . '/views/home.php';
    }

    /**
     * Clear the current user session and redirect to `index.php`.
     */
    public function logout(): never
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        redirect('index.php');
    }
}
