<?php
/**
 * Part 5: Login View Template (views/login.php)
 * Rendered by App\Controllers\HomeControllers::login() via index.php.
 *
 * @var string|null $error
 * @var array<string, string> $fieldErrors
 * @var string $email
 * @var string $mode
 */
$submittedEmail = trim((string) ($email ?? ''));
$activeMode = strtolower(trim((string) ($mode ?? 'signin'))) === 'register' ? 'register' : 'signin';
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="../" />
    <title>Lillia and Rowena Furniture — Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="assets/css/login.css" />
  </head>
  <body class="lr-login-body">
    <main class="login-shell">
      <div style="margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
        <a href="index.html" style="text-decoration: none; font-size: 0.875rem; font-weight: 700; color: #475569;">
          ← Back to Showroom Collection
        </a>
        <span class="lr-mono" style="font-size: 0.75rem; color: #0095FF; font-weight: 600;">
          MYSQL 8.0.16+ INNODB · PSR-4 COMPOSER
        </span>
      </div>

      <div class="login-grid">
        <!-- Left Architectural Showcase Column -->
        <aside class="login-showcase">
          <img src="assets/images/hero_living_room_atelier.jpg" alt="Lillia and Rowena Furniture" class="login-showcase-img" />
          <div class="login-showcase-overlay"></div>

          <div style="position: relative; z-index: 2;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2.25rem;">
              <div class="lr-serif" style="width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; background: #0095FF; color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                LR
              </div>
              <div>
                <div class="lr-serif" style="font-size: 1.125rem; font-weight: 700; color: #FFF;">Lillia and Rowena Furniture</div>
              </div>
            </div>

            <p class="lr-mono" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.14em; color: #38BDF8; margin: 0 0 0.75rem;">
              CLIENT &amp; ADMIN PORTAL
            </p>
            <h1 class="lr-serif" style="font-size: 2.15rem; line-height: 1.15; margin: 0 0 1rem; color: #FFF;">
              Direct Access to Commission Ledgers &amp; Studio Records.
            </h1>
            <p style="font-size: 0.925rem; line-height: 1.65; color: #CBD5E1; margin: 0;">
              Customers track custom timber sizing, color finish variants, and single-product Messenger Vouchers. Administrators manage products, storewide discounts, and custom furniture designs.
            </p>
          </div>

          <div style="position: relative; z-index: 2; border-top: 1px solid rgba(255,255,255,0.14); padding-top: 1.25rem; margin-top: 2rem;">
            <div class="lr-mono" style="font-size: 0.72rem; color: #BAE6FD;">
              TABLES: Admin · Customer · Product · Voucher · Customer_Order · Order_Item
            </div>
          </div>
        </aside>

        <!-- Right Authentication Form Column -->
        <section class="login-form-panel">
          <div style="max-width: 440px; width: 100%; margin: 0 auto;">
            <h2 id="login-heading-title" class="lr-serif" style="font-size: 1.85rem; margin: 0 0 0.4rem; color: #0F172A;">
              Sign In to Your Account
            </h2>
            <p id="login-heading-subtitle" style="font-size: 0.9rem; color: #475569; margin: 0 0 1.25rem;">
              Access your orders, saved delivery address, and personal vouchers, or create a new customer account.
            </p>

            <!-- Auth Mode Toggle: Sign In vs Create Account -->
            <div
              id="customer-auth-mode-tabs"
              style="display: flex; gap: 0.5rem; margin-bottom: 1.1rem; background: #F8FAFC; padding: 0.3rem; border-radius: 0.75rem; border: 1px solid #E2E8F0;"
            >
              <button
                type="button"
                id="auth-mode-signin"
                data-auth-mode="signin"
                style="flex: 1; padding: 0.45rem 0.75rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 700; cursor: pointer; background: <?= $activeMode === 'signin' ? '#0F172A' : 'transparent' ?>; color: <?= $activeMode === 'signin' ? '#FFFFFF' : '#475569' ?>;"
              >
                Sign In
              </button>
              <button
                type="button"
                id="auth-mode-register"
                data-auth-mode="register"
                style="flex: 1; padding: 0.45rem 0.75rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 700; cursor: pointer; background: <?= $activeMode === 'register' ? '#0F172A' : 'transparent' ?>; color: <?= $activeMode === 'register' ? '#FFFFFF' : '#475569' ?>;"
              >
                Create Account
              </button>
            </div>

            <!-- Error Banner -->
            <div
              id="login-error-banner"
              class="form-error-banner"
              style="display: <?= !empty($error) ? 'block' : 'none' ?>;"
            >
              <?= e($error ?? '') ?>
            </div>

            <!-- Unified Login / Registration Form -->
            <form id="lr-login-form" method="post" action="src/index.php" novalidate>
              <input type="hidden" id="login-mode" name="mode" value="<?= e($activeMode) ?>" />

              <div id="register-name-group" class="form-group" style="display: <?= $activeMode === 'register' ? 'block' : 'none' ?>;">
                <label class="form-label" for="register-name">Full Name</label>
                <input
                  id="register-name"
                  name="full_name"
                  type="text"
                  class="form-input <?= isset($fieldErrors['fullName']) ? 'has-error' : '' ?>"
                  placeholder="Enter your full name"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="login-email">Email Address</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  class="form-input <?= isset($fieldErrors['email']) ? 'has-error' : '' ?>"
                  value="<?= e($submittedEmail) ?>"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="login-password">Password</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  class="form-input <?= isset($fieldErrors['password']) ? 'has-error' : '' ?>"
                  value=""
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              <div id="register-phone-group" class="form-group" style="display: <?= $activeMode === 'register' ? 'block' : 'none' ?>;">
                <label class="form-label" for="register-phone">Phone Number</label>
                <input
                  id="register-phone"
                  name="phone_number"
                  type="tel"
                  class="form-input <?= isset($fieldErrors['phoneNumber']) ? 'has-error' : '' ?>"
                  placeholder="e.g. +1 (212) 555-0148"
                />
              </div>

              <div id="register-address-group" class="form-group" style="display: <?= $activeMode === 'register' ? 'block' : 'none' ?>;">
                <label class="form-label" for="register-address">Address</label>
                <input
                  id="register-address"
                  name="address"
                  type="text"
                  class="form-input <?= isset($fieldErrors['address']) ? 'has-error' : '' ?>"
                  placeholder="Enter your street address, city &amp; zip"
                />
              </div>

              <button type="submit" id="login-submit-btn" class="btn-submit">
                <?= $activeMode === 'register' ? 'Create Account & Continue →' : 'Sign In to My Account →' ?>
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>

    <script src="assets/js/login.js"></script>
  </body>
</html>
