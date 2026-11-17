import { computeMonthlyAnalyticsReport, buildAnalyticsCsvContent } from './assets/js/analytics.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeVoucherStatusInfo,
  validateAndCreateVoucher,
  revokeVoucherInList,
  validateVoucherForOrder,
  calculateOrderPricing,
  verifyAndCreateOrder,
  createCustomOrderRequest,
  applyAdminOrderUpdate,
  requestOrderCancellation,
  resolveOrderCancellationRequest,
  recordCustomerOrderPayment,
  applyMaterialStockMovement,
  computeCustomerDirectory,
} from './assets/js/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

function loadSeedFromPhp() {
  const php = fs.readFileSync(path.join(__dirname, 'src', 'Library', 'Database.php'), 'utf8');
  const start = php.indexOf('public static function getDefaultStore()');
  const retIdx = php.indexOf('return [', start);
  const body = php.slice(retIdx + 7, php.lastIndexOf('];') + 1);
  const stack = [];
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'") {
      out += ch;
      i++;
      while (i < body.length && body[i] !== "'") {
        if (body[i] === '\\') out += body[i++];
        out += body[i++];
      }
      out += "'";
    } else if (ch === '[') {
      const rest = body.slice(i + 1);
      const isObj = /^\s*'[^']*'\s*=>/.test(rest);
      stack.push(isObj ? '}' : ']');
      out += isObj ? '{' : '[';
    } else if (ch === ']') {
      out += stack.pop() || ']';
    } else if (ch === '=' && body[i + 1] === '>') {
      out += ':';
      i++;
    } else {
      out += ch;
    }
  }
  return Function(`"use strict"; return (${out});`)();
}

let serverStoreState = loadSeedFromPhp();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function normalizeServerVouchers(vouchers = []) {
  const nowMs = Date.now();
  return (Array.isArray(vouchers) ? vouchers : []).map((v) => ({
    ...v,
    discountType: 'fixed',
    status: computeVoucherStatusInfo(v, nowMs).status,
  }));
}

function readStoreFile() {
  const clone = structuredClone(serverStoreState);
  if (Array.isArray(clone.vouchers)) clone.vouchers = normalizeServerVouchers(clone.vouchers);
  clone.customerDirectory = computeCustomerDirectory(clone.orders || [], clone.customers || [], clone.customerProfile || null);
  return clone;
}

function writeStoreFile(storeData) {
  const clean = { ...storeData };
  delete clean._dbMeta;
  delete clean.customerDirectory;
  if (Array.isArray(clean.vouchers)) clean.vouchers = normalizeServerVouchers(clean.vouchers);
  serverStoreState = structuredClone(clean);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function handleApiRequest(req, res, parsedUrl) {
  try {
    if (req.method === 'GET') {
      const store = readStoreFile();
      if (!Object.prototype.hasOwnProperty.call(store, 'sessionUser')) store.sessionUser = null;
      if (!Array.isArray(store.cartItems)) store.cartItems = [];
      store._dbMeta = { driver: 'pdo_mysql', endpoint: 'src/api.php', timezone: 'Asia/Manila', timestamp: new Date().toISOString() };
      return sendJson(res, 200, store);
    }

    if (req.method === 'POST') {
      let rawBody = '';
      req.on('data', (chunk) => { rawBody += chunk; });
      req.on('end', () => {
        try {
          const payload = rawBody ? JSON.parse(rawBody) : {};
          const action = String(payload.action || parsedUrl.searchParams.get('action') || 'sync_store');
          const store = readStoreFile();

          switch (action) {
            case 'get_analytics_report': {
              const activeUser = payload.sessionUser || store.sessionUser || null;
              const activeRole = activeUser?.role ? String(activeUser.role).toLowerCase() : '';
              if (activeRole === 'client' || activeRole === 'customer') {
                return sendJson(res, 403, { ok: false, error: 'Unauthorized: Monthly Analytics & Business Reports are restricted to authorized administrators.' });
              }
              const filterInput = payload.filter && typeof payload.filter === 'object' ? payload.filter : payload;
              const report = computeMonthlyAnalyticsReport(store, filterInput, Date.now());
              return sendJson(res, 200, { ok: true, report });
            }

            case 'export_analytics_csv': {
              const filterInput = payload.filter && typeof payload.filter === 'object' ? payload.filter : payload;
              const report = computeMonthlyAnalyticsReport(store, filterInput, Date.now());
              const csv = buildAnalyticsCsvContent(report);
              return sendJson(res, 200, { ok: true, csv, fileName: `Lillia_Rowena_Analytics_Report_${report.dateRange?.startDate || 'Report'}.csv` });
            }

            case 'place_order': {
              const resOrder = verifyAndCreateOrder({
                catalog: store.products || [],
                vouchers: store.vouchers || [],
                customerProfile: payload.customerProfile || store.customerProfile || {},
                sessionUser: store.sessionUser,
                cartItems: payload.cartItems || store.cartItems || [],
                voucherCode: payload.voucherCode || '',
              });
              if (!resOrder.ok) return sendJson(res, 400, { ok: false, error: resOrder.errorMessage });
              store.products = resOrder.updatedCatalog;
              store.orders = [resOrder.order, ...(store.orders || [])];
              if (resOrder.validatedVoucher) {
                store.vouchers = (store.vouchers || []).map((v) =>
                  v.code === resOrder.validatedVoucher.code ? { ...v, status: 'Used', redeemedAt: new Date().toISOString().slice(0, 10) } : v
                );
              }
              store.cartItems = [];
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'place_order', order: resOrder.order, createdOrders: [resOrder.order], pricing: resOrder.pricing, store: readStoreFile() });
            }

            case 'create_custom_order': {
              const resCustom = createCustomOrderRequest({
                catalog: store.products || [],
                materials: store.materials || [],
                customerProfile: payload.customerProfile || store.customerProfile || {},
                sessionUser: store.sessionUser,
                customInput: payload.customInput || payload,
              });
              if (!resCustom.ok) return sendJson(res, 400, { ok: false, error: resCustom.errorMessage });
              store.materials = resCustom.updatedMaterials;
              store.orders = [resCustom.order, ...(store.orders || [])];
              store.inventoryTransactions = [resCustom.materialMovement, ...(store.inventoryTransactions || [])];
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'create_custom_order', order: resCustom.order, store: readStoreFile() });
            }

            case 'update_order_status': {
              const orderNumber = String(payload.orderNumber || payload.orderId || '').trim();
              const resUpd = applyAdminOrderUpdate({ orders: store.orders || [], orderNumber, updates: payload.updates || payload });
              if (!resUpd || !resUpd.ok) return sendJson(res, 400, { ok: false, error: 'Order not found.' });
              store.orders = resUpd.updatedOrders;
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'update_order_status', order: resUpd.updatedOrder, orders: store.orders });
            }

            case 'request_order_cancellation': {
              const orderNumber = String(payload.orderNumber || payload.orderId || '').trim();
              const resCancel = requestOrderCancellation({ orders: store.orders || [], orderNumber, reason: payload.reason });
              if (!resCancel.ok) return sendJson(res, 400, { ok: false, error: resCancel.errorMessage });
              store.orders = resCancel.updatedOrders;
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'request_order_cancellation', order: resCancel.updatedOrder, orders: store.orders });
            }

            case 'resolve_order_cancellation': {
              const orderNumber = String(payload.orderNumber || payload.orderId || '').trim();
              const resResolve = resolveOrderCancellationRequest({ orders: store.orders || [], orderNumber, decision: payload.decision || 'approve' });
              if (!resResolve.ok) return sendJson(res, 400, { ok: false, error: resResolve.errorMessage });
              store.orders = resResolve.updatedOrders;
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'resolve_order_cancellation', order: resResolve.updatedOrder, orders: store.orders });
            }

            case 'record_order_payment': {
              const orderNumber = String(payload.orderNumber || payload.orderId || '').trim();
              const resPay = recordCustomerOrderPayment({ orders: store.orders || [], orderNumber, paymentMethod: payload.paymentMethod || 'Card' });
              if (!resPay || !resPay.ok) return sendJson(res, 400, { ok: false, error: resPay?.errorMessage || 'Payment failed.' });
              store.orders = resPay.updatedOrders;
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'record_order_payment', order: resPay.updatedOrder, orders: store.orders });
            }

            case 'record_stock_movement': {
              const resMove = applyMaterialStockMovement({ materials: store.materials || [], movementInput: payload, adminName: payload.adminName });
              if (!resMove.ok) return sendJson(res, 400, { ok: false, error: resMove.errorMessage });
              store.materials = resMove.updatedMaterials;
              store.inventoryTransactions = [resMove.transaction, ...(store.inventoryTransactions || [])];
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'record_stock_movement', material: resMove.updatedMaterial, transaction: resMove.transaction, materials: store.materials, inventoryTransactions: store.inventoryTransactions });
            }

            case 'create_voucher': {
              const voucherInput = payload.voucher && typeof payload.voucher === 'object' ? payload.voucher : payload;
              const result = validateAndCreateVoucher(voucherInput, store.products || [], store.vouchers || [], Date.now());
              if (!result.ok) return sendJson(res, 400, { ok: false, error: result.errorMessage });
              store.vouchers = normalizeServerVouchers([result.voucher, ...(store.vouchers || [])]);
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'create_voucher', voucher: result.voucher, vouchers: store.vouchers });
            }

            case 'revoke_voucher': {
              const voucherId = String(payload.voucherId || payload.id || payload.code || '').trim();
              const result = revokeVoucherInList(store.vouchers || [], voucherId, Date.now());
              if (!result.ok) return sendJson(res, 400, { ok: false, error: result.errorMessage });
              store.vouchers = normalizeServerVouchers(result.vouchers);
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, action: 'revoke_voucher', voucher: result.voucher, vouchers: store.vouchers });
            }

            case 'validate_voucher': {
              const voucherCode = String(payload.voucherCode || payload.code || '').trim();
              const customerEmail = String(payload.customerEmail || '').trim();
              const cartItems = Array.isArray(payload.cartItems) ? payload.cartItems : [];
              const validation = validateVoucherForOrder(store.vouchers || [], voucherCode, customerEmail, cartItems, store.products || [], Date.now());
              if (!validation.valid) return sendJson(res, 400, { ok: false, valid: false, error: validation.errorMessage });
              const pricing = cartItems.length > 0 ? calculateOrderPricing(cartItems, validation.voucher, store.products || []) : null;
              return sendJson(res, 200, { ok: true, valid: true, voucher: validation.voucher, discountAmount: validation.discountAmount, pricing });
            }

            case 'sync_store': {
              if (Array.isArray(payload.products)) store.products = payload.products;
              if (Array.isArray(payload.materials)) store.materials = payload.materials;
              if (Array.isArray(payload.inventoryTransactions)) store.inventoryTransactions = payload.inventoryTransactions;
              if (Array.isArray(payload.vouchers)) store.vouchers = normalizeServerVouchers(payload.vouchers);
              if (Array.isArray(payload.orders)) store.orders = payload.orders;
              if (payload.customerProfile && typeof payload.customerProfile === 'object') store.customerProfile = payload.customerProfile;
              if (Array.isArray(payload.customers)) store.customers = payload.customers;
              if (Array.isArray(payload.offers)) store.offers = payload.offers;
              if (Object.prototype.hasOwnProperty.call(payload, 'sessionUser')) store.sessionUser = payload.sessionUser;
              if (Array.isArray(payload.cartItems)) store.cartItems = payload.cartItems;
              writeStoreFile(store);
              break;
            }

            case 'save_session': {
              store.sessionUser = payload.sessionUser ?? null;
              if (!store.sessionUser) store.cartItems = [];
              if (payload.customerProfile && typeof payload.customerProfile === 'object') store.customerProfile = payload.customerProfile;
              writeStoreFile(store);
              break;
            }

            case 'save_cart': {
              store.cartItems = Array.isArray(payload.cartItems) ? payload.cartItems : [];
              writeStoreFile(store);
              break;
            }

            case 'save_offer':
            case 'create_offer': {
              const offerObj = payload.offer && typeof payload.offer === 'object' ? payload.offer : payload;
              if (offerObj && typeof offerObj === 'object') {
                const offers = Array.isArray(store.offers) ? [...store.offers] : [];
                offers.unshift(offerObj);
                store.offers = offers.slice(0, 20);
                writeStoreFile(store);
              }
              break;
            }

            case 'save_product': {
              const product = payload.product;
              if (product && typeof product === 'object' && product.id) {
                const products = Array.isArray(store.products) ? [...store.products] : [];
                const idx = products.findIndex((p) => p.id === product.id);
                if (idx >= 0) products[idx] = { ...products[idx], ...product };
                else products.unshift(product);
                store.products = products;
                writeStoreFile(store);
              }
              break;
            }

            case 'delete_product': {
              const productId = String(payload.productId || '').trim();
              if (productId) {
                store.products = (store.products || []).filter((p) => p.id !== productId);
                if (Array.isArray(payload.vouchers)) store.vouchers = payload.vouchers;
                writeStoreFile(store);
              }
              break;
            }

            case 'save_material': {
              if (Array.isArray(payload.materials)) store.materials = payload.materials;
              else if (payload.material?.id) {
                const mats = Array.isArray(store.materials) ? [...store.materials] : [];
                const idx = mats.findIndex((m) => m.id === payload.material.id);
                if (idx >= 0) mats[idx] = { ...mats[idx], ...payload.material };
                else mats.push(payload.material);
                store.materials = mats;
              }
              if (Array.isArray(payload.inventoryTransactions)) store.inventoryTransactions = payload.inventoryTransactions;
              writeStoreFile(store);
              break;
            }

            case 'delete_material': {
              const materialId = String(payload.materialId || '').trim();
              if (Array.isArray(payload.materials)) store.materials = payload.materials;
              else if (materialId) store.materials = (store.materials || []).filter((m) => m.id !== materialId);
              writeStoreFile(store);
              break;
            }

            case 'login_user': {
              const email = String(payload.email || '').trim().toLowerCase();
              const password = String(payload.password || '');
              const isAdminRole = String(payload.role || 'Customer').trim().toLowerCase() === 'admin';
              if (!email || !email.includes('@')) return sendJson(res, 400, { ok: false, error: 'Please enter a valid email address.' });
              if (password.length < 6) return sendJson(res, 400, { ok: false, error: 'Password must be at least 6 characters.' });

              if (isAdminRole) {
                if (email !== 'admin@lilliarowena.com') return sendJson(res, 401, { ok: false, error: 'No Admin account found with that email address.' });
                if (password !== 'MasterJoinery#01') return sendJson(res, 401, { ok: false, error: `Incorrect password for ${email}.` });
                const sessionUser = { email: 'admin@lilliarowena.com', name: 'Lillia Mercier (Business Owner)', role: 'admin' };
                store.sessionUser = sessionUser;
                writeStoreFile(store);
                return sendJson(res, 200, { ok: true, sessionUser });
              }

              const matchedCustomer = (store.customers || []).find((c) => String(c.email || '').trim().toLowerCase() === email);
              if (!matchedCustomer) return sendJson(res, 401, { ok: false, error: 'No account found with that email address. Please register an account first.' });
              if (password !== (matchedCustomer.passwordPlain || 'ClientPass2025!')) {
                return sendJson(res, 401, { ok: false, error: `Incorrect password for ${email}.` });
              }

              const fullName = matchedCustomer.fullName || matchedCustomer.name || email;
              const avatarUrl = matchedCustomer.avatar || '';
              const isDemoRowena = email === 'rowena.vance@vancearchitects.com';
              const sessionUser = { email: matchedCustomer.email, name: fullName, role: 'client', avatar: avatarUrl };
              store.sessionUser = sessionUser;
              store.customerProfile = {
                name: fullName, email: matchedCustomer.email,
                phone: matchedCustomer.phoneNumber || matchedCustomer.phone || '',
                city: matchedCustomer.city ?? (isDemoRowena ? 'New York, NY 10013' : ''),
                address: matchedCustomer.address || '',
                notes: matchedCustomer.notes ?? (isDemoRowena ? 'Freight elevator available Mon–Fri 9:00 AM – 5:00 PM. Please call 30 minutes before arrival.' : ''),
                avatar: avatarUrl,
              };
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, customer: matchedCustomer, sessionUser });
            }

            case 'register_customer': {
              const customers = Array.isArray(store.customers) ? [...store.customers] : [];
              const email = String(payload.email || '').trim().toLowerCase();
              const fullName = String(payload.fullName || payload.name || '').trim();
              const password = String(payload.password || '');
              const phoneVal = String(payload.phoneNumber || '').trim();
              const addressVal = String(payload.address || '').trim();
              if (fullName.length < 2) return sendJson(res, 400, { ok: false, error: 'Please enter your full name (at least 2 characters).' });
              if (!email || !email.includes('@')) return sendJson(res, 400, { ok: false, error: 'Please enter a valid email address.' });
              if (password.length < 6) return sendJson(res, 400, { ok: false, error: 'Password must be at least 6 characters.' });
              if (phoneVal.length < 7) return sendJson(res, 400, { ok: false, error: 'Please enter a valid phone number.' });
              if (addressVal.length < 5) return sendJson(res, 400, { ok: false, error: 'Please enter your complete delivery address.' });
              if (customers.some((c) => String(c.email || '').toLowerCase() === email) || email === 'admin@lilliarowena.com') {
                return sendJson(res, 400, { ok: false, error: 'An account with this email already exists.' });
              }
              const generatedCustomerId = `LR-CUS-${Math.floor(320 + Math.random() * 679)}`;
              const customerRecord = {
                id: generatedCustomerId, customerId: generatedCustomerId, role: 'Customer',
                fullName, name: fullName, email, passwordPlain: password,
                phoneNumber: phoneVal, phone: phoneVal, address: addressVal, city: '', notes: '', avatar: '',
              };
              customers.push(customerRecord);
              store.customers = customers;
              const sessionUser = { email: customerRecord.email, name: customerRecord.fullName, role: 'client', avatar: '' };
              store.sessionUser = sessionUser;
              store.cartItems = [];
              store.customerProfile = { name: customerRecord.fullName, email: customerRecord.email, phone: customerRecord.phoneNumber, city: '', address: customerRecord.address, notes: '', avatar: '' };
              writeStoreFile(store);
              return sendJson(res, 200, { ok: true, customer: customerRecord, sessionUser });
            }

            case 'upload_product_image': {
              const dataUrl = String(payload.dataUrl || '').trim();
              const rawFileName = String(payload.fileName || 'product.jpg').trim();
              const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/i);
              if (!match) return sendJson(res, 400, { ok: false, error: 'Invalid image format. Please upload a JPG, PNG, WEBP, or GIF image.' });
              const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
              const buffer = Buffer.from(match[2], 'base64');
              const baseName = path.basename(rawFileName, path.extname(rawFileName));
              const safeSlug = baseName.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'product';
              const targetDir = path.join(__dirname, 'assets', 'images');
              fs.mkdirSync(targetDir, { recursive: true });
              let finalName = `${safeSlug}.${ext}`;
              let targetPath = path.join(targetDir, finalName);
              if (fs.existsSync(targetPath)) {
                finalName = `${safeSlug}_${Date.now()}.${ext}`;
                targetPath = path.join(targetDir, finalName);
              }
              fs.writeFileSync(targetPath, buffer);
              return sendJson(res, 200, { ok: true, imagePath: `assets/images/${finalName}` });
            }

            default:
              writeStoreFile(store);
              break;
          }

          return sendJson(res, 200, { ok: true, action });
        } catch (err) {
          return sendJson(res, 400, { ok: false, error: err.message });
        }
      });
      return;
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/api.php' || pathname === '/src/api.php' || pathname === '/api/store') {
    return handleApiRequest(req, res, parsedUrl);
  }
  if (pathname === '/') pathname = '/index.html';

  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(__dirname, safePath);
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.json' ? 'no-store' : 'public, max-age=0',
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lillia and Rowena server listening on http://0.0.0.0:${PORT}`);
});
