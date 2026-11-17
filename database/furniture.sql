-- =====================================================================
-- Lillia and Rowena Furniture — Final Optimized 3NF MySQL / MariaDB Schema & Seed
-- Database: `lillia_rowena_furniture` (InnoDB, utf8mb4_unicode_ci)
-- Pre-Optimization Backup: `database/backup_before_optimization.sql`
--
-- Active Entities (12 Normalized 3NF Tables — Non-Incrementing Code IDs):
--   1. Admin                 (AdminID PK, Email UNIQUE, PasswordHash)
--   2. Category              (CategoryID PK, CategoryName UNIQUE, Description)
--   3. Customer              (CustomerID PK, FullName, Email UNIQUE, PasswordHash, PhoneNumber, Address)
--   4. Product               (ProductID PK, CategoryID FK, ProductName, BasePrice)
--   5. Material              (MaterialID PK, MaterialName, MaterialType, Unit, UnitCost, StockQuantity)
--   6. Voucher               (VoucherID PK, CustomerID FK, ProductID FK, AdminID FK, Code UNIQUE, DiscountValue, ExpiresAt, Status, IssuedAt)
--   7. Customer_Order        (OrderID PK, CustomerID FK, OrderDate, CompletedAt, Status)
--   8. Order_Item            (OrderItemID PK, OrderID FK, ProductID FK, VoucherID FK UNIQUE, ItemType, Quantity, UnitPrice)
--   9. Order_Item_Material   (OrderItemID PK/FK, MaterialID PK/FK, QuantityUsed)
--  10. Customization         (CustomizationID PK, OrderItemID FK UNIQUE, Length, Width, Height, ColorFinish, Notes, ExtraCost)
--  11. Payment               (PaymentID PK, OrderID FK, PaymentDate, Amount)
--  12. Production_Task       (TaskID PK, OrderItemID FK, StartDate, TaskStatus)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `lillia_rowena_furniture`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lillia_rowena_furniture`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TRIGGER IF EXISTS `trg_order_item_bi`;
DROP TRIGGER IF EXISTS `trg_order_item_bu`;
DROP PROCEDURE IF EXISTS `check_voucher_use`;
DROP PROCEDURE IF EXISTS `sp_record_stock_movement`;

-- Drop unused legacy entities if present from earlier drafts
DROP TABLE IF EXISTS `Delivery`;
DROP TABLE IF EXISTS `Employee`;
DROP TABLE IF EXISTS `Supplier`;

-- Recreate active 12 tables cleanly
DROP TABLE IF EXISTS `Production_Task`;
DROP TABLE IF EXISTS `Payment`;
DROP TABLE IF EXISTS `Customization`;
DROP TABLE IF EXISTS `Order_Item_Material`;
DROP TABLE IF EXISTS `Order_Item`;
DROP TABLE IF EXISTS `Customer_Order`;
DROP TABLE IF EXISTS `Voucher`;
DROP TABLE IF EXISTS `Material`;
DROP TABLE IF EXISTS `Product`;
DROP TABLE IF EXISTS `Customer`;
DROP TABLE IF EXISTS `Category`;
DROP TABLE IF EXISTS `Admin`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. INDEPENDENT ENTITIES (3NF — Non-Incrementing Code Primary Keys)
-- =============================================================================

CREATE TABLE `Admin` (
    `AdminID`       VARCHAR(50)  NOT NULL,
    `Email`         VARCHAR(255) NOT NULL,
    `PasswordHash`  VARCHAR(255) NOT NULL,
    CONSTRAINT `pk_admin` PRIMARY KEY (`AdminID`),
    CONSTRAINT `uq_admin_email` UNIQUE (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Category` (
    `CategoryID`    VARCHAR(50)  NOT NULL,
    `CategoryName`  VARCHAR(100) NOT NULL,
    `Description`   VARCHAR(255) DEFAULT NULL,
    CONSTRAINT `pk_category` PRIMARY KEY (`CategoryID`),
    CONSTRAINT `uq_category_name` UNIQUE (`CategoryName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Customer` (
    `CustomerID`    VARCHAR(50)  NOT NULL,
    `FullName`      VARCHAR(150) NOT NULL,
    `Email`         VARCHAR(255) NOT NULL,
    `PasswordHash`  VARCHAR(255) NOT NULL,
    `PhoneNumber`   VARCHAR(30)  DEFAULT NULL,
    `Address`       VARCHAR(255) DEFAULT NULL,
    CONSTRAINT `pk_customer` PRIMARY KEY (`CustomerID`),
    CONSTRAINT `uq_customer_email` UNIQUE (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. CATALOG & WORKSHOP INVENTORY ENTITIES
-- =============================================================================

CREATE TABLE `Product` (
    `ProductID`    VARCHAR(50)    NOT NULL,
    `CategoryID`   VARCHAR(50)    NOT NULL,
    `ProductName`  VARCHAR(150)   NOT NULL,
    `BasePrice`    DECIMAL(10,2)  NOT NULL,
    CONSTRAINT `pk_product` PRIMARY KEY (`ProductID`),
    CONSTRAINT `chk_product_base_price` CHECK (`BasePrice` >= 0),
    INDEX `idx_product_category` (`CategoryID`),
    INDEX `idx_product_name` (`ProductName`),
    CONSTRAINT `fk_product_category`
        FOREIGN KEY (`CategoryID`) REFERENCES `Category`(`CategoryID`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Material` (
    `MaterialID`     VARCHAR(50)    NOT NULL,
    `MaterialName`   VARCHAR(150)   NOT NULL,
    `MaterialType`   VARCHAR(100)   NOT NULL DEFAULT 'Solid Timber',
    `Unit`           VARCHAR(20)    NOT NULL,
    `UnitCost`       DECIMAL(10,2)  NOT NULL,
    `StockQuantity`  DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    CONSTRAINT `pk_material` PRIMARY KEY (`MaterialID`),
    CONSTRAINT `chk_material_unit_cost` CHECK (`UnitCost` >= 0),
    CONSTRAINT `chk_material_stock_qty` CHECK (`StockQuantity` >= 0),
    INDEX `idx_material_type` (`MaterialType`),
    INDEX `idx_material_name` (`MaterialName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. VOUCHER ENTITY (Issued by an Admin to ONE Customer for ONE Product)
--    Note: Redundant `ExpiryDate` removed; `ExpiresAt` (DATETIME) is authoritative.
-- =============================================================================

CREATE TABLE `Voucher` (
    `VoucherID`      VARCHAR(50)    NOT NULL,
    `CustomerID`     VARCHAR(50)    NOT NULL,
    `ProductID`      VARCHAR(50)    NOT NULL,
    `AdminID`        VARCHAR(50)    NOT NULL,
    `Code`           VARCHAR(50)    NOT NULL,
    `DiscountValue`  DECIMAL(10,2)  NOT NULL,
    `ExpiresAt`      DATETIME       DEFAULT NULL,
    `Status`         VARCHAR(20)    NOT NULL DEFAULT 'Active',
    `IssuedAt`       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `pk_voucher` PRIMARY KEY (`VoucherID`),
    CONSTRAINT `uq_voucher_code` UNIQUE (`Code`),
    CONSTRAINT `uq_voucher_product_pair` UNIQUE (`VoucherID`, `ProductID`),
    CONSTRAINT `chk_voucher_discount` CHECK (`DiscountValue` > 0),
    CONSTRAINT `chk_voucher_status`
        CHECK (`Status` IN ('Active','Expiring Soon','Used','Expired','Revoked','Cancelled')),
    INDEX `idx_voucher_customer` (`CustomerID`),
    INDEX `idx_voucher_product` (`ProductID`),
    INDEX `idx_voucher_admin` (`AdminID`),
    INDEX `idx_voucher_status` (`Status`),
    CONSTRAINT `fk_voucher_customer`
        FOREIGN KEY (`CustomerID`) REFERENCES `Customer`(`CustomerID`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_voucher_product`
        FOREIGN KEY (`ProductID`) REFERENCES `Product`(`ProductID`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_voucher_admin`
        FOREIGN KEY (`AdminID`) REFERENCES `Admin`(`AdminID`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. ORDERS, LINE ITEMS, MATERIALS, CUSTOMIZATIONS, PAYMENTS & TASKS
-- =============================================================================

CREATE TABLE `Customer_Order` (
    `OrderID`      VARCHAR(50)  NOT NULL,
    `CustomerID`   VARCHAR(50)  NOT NULL,
    `OrderDate`    DATE         NOT NULL,
    `CompletedAt`  DATE         DEFAULT NULL,
    `Status`       VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    CONSTRAINT `pk_customer_order` PRIMARY KEY (`OrderID`),
    CONSTRAINT `chk_customer_order_status`
        CHECK (`Status` IN ('Pending','InProduction','Ready','Delivered','Cancelled')),
    INDEX `idx_order_customer` (`CustomerID`),
    INDEX `idx_order_status_completed` (`Status`, `CompletedAt`, `OrderDate`),
    CONSTRAINT `fk_order_customer`
        FOREIGN KEY (`CustomerID`) REFERENCES `Customer`(`CustomerID`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Order_Item` (
    `OrderItemID`  VARCHAR(50)    NOT NULL,
    `OrderID`      VARCHAR(50)    NOT NULL,
    `ProductID`    VARCHAR(50)    NOT NULL,
    `VoucherID`    VARCHAR(50)    DEFAULT NULL,
    `ItemType`     VARCHAR(20)    NOT NULL DEFAULT 'Standard',
    `Quantity`     INT            NOT NULL DEFAULT 1,
    `UnitPrice`    DECIMAL(10,2)  NOT NULL,
    CONSTRAINT `pk_order_item` PRIMARY KEY (`OrderItemID`),
    CONSTRAINT `uq_order_item_voucher` UNIQUE (`VoucherID`),
    CONSTRAINT `chk_order_item_type` CHECK (`ItemType` IN ('Standard','Custom')),
    CONSTRAINT `chk_order_item_qty` CHECK (`Quantity` > 0),
    CONSTRAINT `chk_order_item_price` CHECK (`UnitPrice` >= 0),
    INDEX `idx_order_item_order` (`OrderID`),
    INDEX `idx_order_item_product` (`ProductID`),
    CONSTRAINT `fk_order_item_order`
        FOREIGN KEY (`OrderID`) REFERENCES `Customer_Order`(`OrderID`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_order_item_product`
        FOREIGN KEY (`ProductID`) REFERENCES `Product`(`ProductID`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_order_item_voucher_product`
        FOREIGN KEY (`VoucherID`, `ProductID`) REFERENCES `Voucher`(`VoucherID`, `ProductID`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Order_Item_Material` (
    `OrderItemID`   VARCHAR(50)    NOT NULL,
    `MaterialID`    VARCHAR(50)    NOT NULL,
    `QuantityUsed`  DECIMAL(12,2)  NOT NULL,
    CONSTRAINT `pk_order_item_material` PRIMARY KEY (`OrderItemID`, `MaterialID`),
    CONSTRAINT `chk_oim_quantity_used` CHECK (`QuantityUsed` > 0),
    INDEX `idx_oim_material` (`MaterialID`),
    CONSTRAINT `fk_oim_order_item`
        FOREIGN KEY (`OrderItemID`) REFERENCES `Order_Item`(`OrderItemID`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_oim_material`
        FOREIGN KEY (`MaterialID`) REFERENCES `Material`(`MaterialID`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Redundant `MaterialID` removed from `Customization` because `Order_Item_Material`
-- already models the N:M material allocation per `OrderItemID`.
CREATE TABLE `Customization` (
    `CustomizationID`  VARCHAR(50)    NOT NULL,
    `OrderItemID`      VARCHAR(50)    NOT NULL,
    `Length`           DECIMAL(8,2)   DEFAULT NULL,
    `Width`            DECIMAL(8,2)   DEFAULT NULL,
    `Height`           DECIMAL(8,2)   DEFAULT NULL,
    `ColorFinish`      VARCHAR(100)   DEFAULT NULL,
    `Notes`            VARCHAR(255)   DEFAULT NULL,
    `ExtraCost`        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    CONSTRAINT `pk_customization` PRIMARY KEY (`CustomizationID`),
    CONSTRAINT `uq_customization_order_item` UNIQUE (`OrderItemID`),
    CONSTRAINT `chk_customization_extra_cost` CHECK (`ExtraCost` >= 0),
    CONSTRAINT `fk_customization_order_item`
        FOREIGN KEY (`OrderItemID`) REFERENCES `Order_Item`(`OrderItemID`)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
    `PaymentID`    VARCHAR(50)    NOT NULL,
    `OrderID`      VARCHAR(50)    NOT NULL,
    `PaymentDate`  DATE           NOT NULL,
    `Amount`       DECIMAL(10,2)  NOT NULL,
    CONSTRAINT `pk_payment` PRIMARY KEY (`PaymentID`),
    CONSTRAINT `chk_payment_amount` CHECK (`Amount` > 0),
    INDEX `idx_payment_order` (`OrderID`),
    INDEX `idx_payment_date` (`PaymentDate`),
    CONSTRAINT `fk_payment_order`
        FOREIGN KEY (`OrderID`) REFERENCES `Customer_Order`(`OrderID`)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Unused `EndDate` removed from `Production_Task` because order completion date
-- is tracked authoritatively on `Customer_Order.CompletedAt`.
CREATE TABLE `Production_Task` (
    `TaskID`       VARCHAR(50)  NOT NULL,
    `OrderItemID`  VARCHAR(50)  NOT NULL,
    `StartDate`    DATE         DEFAULT NULL,
    `TaskStatus`   VARCHAR(20)  NOT NULL DEFAULT 'Todo',
    CONSTRAINT `pk_production_task` PRIMARY KEY (`TaskID`),
    CONSTRAINT `chk_production_task_status`
        CHECK (`TaskStatus` IN ('Todo','InProgress','Done','Blocked')),
    INDEX `idx_task_order_item` (`OrderItemID`),
    INDEX `idx_task_status` (`TaskStatus`),
    CONSTRAINT `fk_task_order_item`
        FOREIGN KEY (`OrderItemID`) REFERENCES `Order_Item`(`OrderItemID`)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- INITIAL SEED DATA (12 Tables — Non-Incrementing Code IDs like LR-LV-014)
-- =============================================================================

-- 1. Admin
INSERT INTO `Admin` (`AdminID`, `Email`, `PasswordHash`) VALUES
('ADM-LR-901', 'admin@lilliarowena.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- 2. Category (5 Showroom Categories)
INSERT INTO `Category` (`CategoryID`, `CategoryName`, `Description`) VALUES
('CAT-LV-110', 'Living Room', 'Low-slung architectural silhouettes upholstered in heavyweight Belgian linen and nubby wool bouclé, paired with kiln-dried white oak lounge frames and honed Italian travertine surfaces.'),
('CAT-DN-220', 'Dining Room', 'Heirloom dining tables milled from FAS-grade American black walnut and European white oak slabs, finished with hand-rubbed organic linseed oil and paired with Danish paper-cord chairs.'),
('CAT-BD-330', 'Bedroom', 'Quiet, grounding sleep architecture featuring Belgian flax linen headboards, solid ash timber platform rails, and cantilevered bedside tables with soft-close dovetail drawers.'),
('CAT-OF-440', 'Study/Work Desks', 'Commanding work desks and custom-milled fluted credenzas engineered with concealed cable channels, solid brass hardware, and book-matched walnut veneer interiors.'),
('CAT-KT-550', 'Kitchen', 'Architectural kitchen islands, honed Roman travertine prep surfaces, and sculpted solid oak counter stools crafted for open-plan culinary ateliers.');

-- 3. Customer
INSERT INTO `Customer` (`CustomerID`, `FullName`, `Email`, `PasswordHash`, `PhoneNumber`, `Address`) VALUES
('LR-CUS-301', 'Rowena Vance', 'rowena.vance@vancearchitects.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+1 (212) 555-0148', 'Suite 400, 118 Mercer St, SoHo, New York, NY 10013'),
('LR-CUS-302', 'Julian Mercier', 'j.mercier@mercierstudio.co', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+1 (415) 555-0192', '742 Evergreen Terrace, Pacific Heights, SF'),
('LR-CUS-304', 'Elena Rostova', 'elena@rostovainteriors.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+44 20 7946 0821', '29A Kensington Park Rd, Notting Hill'),
('LR-CUS-308', 'Marcus Sterling', 'm.sterling@sterlingcapital.io', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+1 (312) 555-0164', '880 Lake Shore Drive, Apt 32B, Chicago');

-- 4. Product (11 Showroom Pieces — Explicit Product Code IDs like LR-LV-014)
INSERT INTO `Product` (`ProductID`, `CategoryID`, `ProductName`, `BasePrice`) VALUES
('LR-LV-014', 'CAT-LV-110', 'Rowena Curved Bouclé Lounge Sofa', 4850.00),
('LR-DN-108', 'CAT-DN-220', 'Lillia Monolith Solid Walnut Dining Table', 4200.00),
('LR-BD-204', 'CAT-BD-330', 'Serene Belgian Linen Platform Bed (King)', 3650.00),
('LR-OF-315', 'CAT-OF-440', 'Quarter-Sawn Oak Architect Work Desk', 2150.00),
('LR-OF-302', 'CAT-OF-440', 'Mercier Fluted Walnut Sideboard Credenza', 3890.00),
('LR-LV-029', 'CAT-LV-110', 'Cavana Sculpted White Oak Lounge Chair', 1680.00),
('LR-LV-042', 'CAT-LV-110', 'Verona Honed Travertine Plinth Table', 2350.00),
('LR-DN-115', 'CAT-DN-220', 'Solenne Woven Cord Dining Chair (Set of 2)', 1290.00),
('LR-BD-219', 'CAT-BD-330', 'Cantilevered Ash Bedside Nightstand (Pair)', 1180.00),
('LR-KT-401', 'CAT-KT-550', 'Valen Travertine & Walnut Kitchen Island', 3850.00),
('LR-KT-412', 'CAT-KT-550', 'Soren Sculpted Oak Counter Stools (Set of 2)', 1450.00);

-- 5. Material (8 Workshop Raw Materials — Explicit Material Code IDs)
INSERT INTO `Material` (`MaterialID`, `MaterialName`, `MaterialType`, `Unit`, `UnitCost`, `StockQuantity`) VALUES
('MAT-WAL-01', 'FAS American Black Walnut Slabs', 'Solid Timber', 'bd ft', 28.00, 180.00),
('MAT-OAK-02', 'Quarter-Sawn European White Oak', 'Solid Timber', 'bd ft', 22.00, 145.00),
('MAT-ASH-03', 'Kiln-Dried European Ash Timber', 'Solid Timber', 'bd ft', 19.00, 28.00),
('MAT-BCL-04', 'Heavyweight Belgian Wool Bouclé', 'Upholstery Textile', 'sq m', 68.00, 84.00),
('MAT-LIN-05', 'Unbleached Belgian Flax Linen', 'Upholstery Textile', 'sq m', 54.00, 62.00),
('MAT-TRV-06', 'Honed Roman Travertine Blocks', 'Architectural Stone', 'slabs', 420.00, 6.00),
('MAT-BRS-07', 'Solid Aged Brass Hardware & Butterfly Keys', 'Hardware & Joinery', 'sets', 95.00, 32.00),
('MAT-CRD-08', 'Danish Waxed Paper Cord & Cold-Pressed Linseed Oil', 'Cord & Finishes', 'rolls', 42.00, 24.00);

-- 6. Voucher (Single-Customer, Single-Product Fixed-Amount Vouchers — Consolidated `ExpiresAt`)
INSERT INTO `Voucher` (`VoucherID`, `CustomerID`, `ProductID`, `AdminID`, `Code`, `DiscountValue`, `ExpiresAt`, `Status`) VALUES
('VCH-LR-740', 'LR-CUS-301', 'LR-LV-014', 'ADM-LR-901', 'VCH-ROWENA-SOFA400', 400.00, '2026-12-31 23:59:59', 'Active'),
('VCH-LR-735', 'LR-CUS-301', 'LR-DN-108', 'ADM-LR-901', 'VCH-ROWENA-WALNUT350', 350.00, '2026-12-31 23:59:59', 'Active'),
('VCH-LR-725', 'LR-CUS-302', 'LR-BD-204', 'ADM-LR-901', 'VCH-JULIAN-BED250', 250.00, '2026-12-15 23:59:59', 'Active'),
('VCH-LR-710', 'LR-CUS-304', 'LR-OF-315', 'ADM-LR-901', 'VCH-ELENA-DESK300', 300.00, '2026-12-10 23:59:59', 'Used'),
('VCH-LR-705', 'LR-CUS-308', 'LR-LV-029', 'ADM-LR-901', 'VCH-MARCUS-CHAIR200', 200.00, '2026-10-31 23:59:59', 'Expired'),
('VCH-LR-690', 'LR-CUS-302', 'LR-OF-302', 'ADM-LR-901', 'VCH-JULIAN-CREDENZA150', 150.00, '2026-12-20 23:59:59', 'Revoked');

-- 7. Customer_Order (Explicit Order Code IDs with CompletedAt populated only for Delivered/Completed orders)
INSERT INTO `Customer_Order` (`OrderID`, `CustomerID`, `OrderDate`, `CompletedAt`, `Status`) VALUES
('ORD-2026-8841', 'LR-CUS-301', '2026-10-18', NULL, 'InProduction'),
('ORD-2026-8834', 'LR-CUS-301', '2026-10-04', NULL, 'Ready'),
('ORD-2026-8829', 'LR-CUS-302', '2026-10-11', NULL, 'InProduction'),
('ORD-2026-8815', 'LR-CUS-304', '2026-09-26', '2026-09-29', 'Delivered'),
('ORD-2026-8850', 'LR-CUS-308', '2026-11-08', NULL, 'Pending'),
('ORD-2026-8854', 'LR-CUS-304', '2026-11-04', '2026-11-04', 'Delivered'),
('ORD-2026-8858', 'LR-CUS-301', '2026-11-11', '2026-11-11', 'Delivered'),
('ORD-2026-8862', 'LR-CUS-302', '2026-11-15', NULL, 'InProduction');

-- 8. Order_Item (Explicit OrderItem Code IDs)
INSERT INTO `Order_Item` (`OrderItemID`, `OrderID`, `ProductID`, `VoucherID`, `ItemType`, `Quantity`, `UnitPrice`) VALUES
('ITM-2026-5841', 'ORD-2026-8841', 'LR-DN-108', NULL, 'Custom', 1, 3696.00),
('ITM-2026-5834', 'ORD-2026-8834', 'LR-LV-014', NULL, 'Standard', 1, 4365.00),
('ITM-2026-5829', 'ORD-2026-8829', 'LR-OF-302', NULL, 'Standard', 2, 3307.00),
('ITM-2026-5815', 'ORD-2026-8815', 'LR-BD-204', NULL, 'Standard', 1, 3650.00),
('ITM-2026-5850', 'ORD-2026-8850', 'LR-LV-029', NULL, 'Standard', 2, 1840.00),
('ITM-2026-5854', 'ORD-2026-8854', 'LR-OF-315', 'VCH-LR-710', 'Standard', 1, 1850.00),
('ITM-2026-5858', 'ORD-2026-8858', 'LR-DN-115', NULL, 'Standard', 3, 1290.00),
('ITM-2026-5862', 'ORD-2026-8862', 'LR-OF-315', NULL, 'Standard', 1, 2150.00);

-- 9. Order_Item_Material
INSERT INTO `Order_Item_Material` (`OrderItemID`, `MaterialID`, `QuantityUsed`) VALUES
('ITM-2026-5841', 'MAT-WAL-01', 48.00),
('ITM-2026-5834', 'MAT-BCL-04', 14.00),
('ITM-2026-5829', 'MAT-WAL-01', 64.00),
('ITM-2026-5815', 'MAT-LIN-05', 16.00),
('ITM-2026-5850', 'MAT-OAK-02', 24.00),
('ITM-2026-5854', 'MAT-OAK-02', 18.00),
('ITM-2026-5858', 'MAT-CRD-08', 4.00),
('ITM-2026-5862', 'MAT-OAK-02', 18.00);

-- 10. Customization (Normalized 3NF: Material allocation lives in Order_Item_Material)
INSERT INTO `Customization` (`CustomizationID`, `OrderItemID`, `Length`, `Width`, `Height`, `ColorFinish`, `Notes`, `ExtraCost`) VALUES
('CSM-2026-6841', 'ITM-2026-5841', 260.00, 110.00, 75.00, 'Hand-Rubbed Natural Walnut', 'Book-matched walnut slab approved by client via slab photography.', 0.00);

-- 11. Payment (Explicit Payment Code IDs)
INSERT INTO `Payment` (`PaymentID`, `OrderID`, `PaymentDate`, `Amount`) VALUES
('PAY-2026-9841', 'ORD-2026-8841', '2026-10-18', 1848.00),
('PAY-2026-9834', 'ORD-2026-8834', '2026-10-04', 4365.00),
('PAY-2026-9829', 'ORD-2026-8829', '2026-10-11', 3307.00),
('PAY-2026-9815', 'ORD-2026-8815', '2026-09-26', 3650.00),
('PAY-2026-9854', 'ORD-2026-8854', '2026-11-04', 3165.00),
('PAY-2026-9858', 'ORD-2026-8858', '2026-11-11', 3870.00),
('PAY-2026-9862', 'ORD-2026-8862', '2026-11-15', 2150.00);

-- 12. Production_Task (Normalized 3NF: Completion date lives on Customer_Order.CompletedAt)
INSERT INTO `Production_Task` (`TaskID`, `OrderItemID`, `StartDate`, `TaskStatus`) VALUES
('TSK-2026-2841', 'ITM-2026-5841', '2026-10-18', 'InProgress'),
('TSK-2026-2834', 'ITM-2026-5834', '2026-10-04', 'Done'),
('TSK-2026-2829', 'ITM-2026-5829', '2026-10-11', 'InProgress'),
('TSK-2026-2815', 'ITM-2026-5815', '2026-09-26', 'Done'),
('TSK-2026-2850', 'ITM-2026-5850', '2026-11-08', 'Todo'),
('TSK-2026-2854', 'ITM-2026-5854', '2026-11-04', 'Done'),
('TSK-2026-2858', 'ITM-2026-5858', '2026-11-11', 'Done'),
('TSK-2026-2862', 'ITM-2026-5862', '2026-11-15', 'InProgress');

-- =============================================================================
-- STORED PROCEDURES & TRIGGERS
-- =============================================================================

DELIMITER $$

CREATE PROCEDURE `check_voucher_use`(
    IN p_voucher_id   VARCHAR(50),
    IN p_order_id     VARCHAR(50),
    IN p_check_status BOOLEAN
)
BEGIN
    DECLARE v_customer   VARCHAR(50);
    DECLARE v_product    VARCHAR(50);
    DECLARE v_discount   DECIMAL(10,2);
    DECLARE v_status     VARCHAR(20);
    DECLARE v_expires_at DATETIME;
    DECLARE p_base_price DECIMAL(10,2);
    DECLARE o_customer   VARCHAR(50);

    IF p_voucher_id IS NOT NULL THEN
        SELECT CustomerID, ProductID, DiscountValue, Status, ExpiresAt
          INTO v_customer, v_product, v_discount, v_status, v_expires_at
          FROM Voucher WHERE VoucherID = p_voucher_id;

        SELECT BasePrice INTO p_base_price
          FROM Product WHERE ProductID = v_product;

        SELECT CustomerID INTO o_customer
          FROM Customer_Order WHERE OrderID = p_order_id;

        IF v_customer <> o_customer THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Voucher does not belong to the customer of this order';
        END IF;

        IF v_discount <= 0 OR (p_base_price IS NOT NULL AND v_discount > p_base_price) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Voucher discount amount is invalid or exceeds product price';
        END IF;

        IF p_check_status THEN
            IF v_status NOT IN ('Active', 'Expiring Soon') THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voucher is not active';
            END IF;
            IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voucher has expired';
            END IF;
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_order_item_bi`
BEFORE INSERT ON `Order_Item`
FOR EACH ROW
BEGIN
    CALL check_voucher_use(NEW.VoucherID, NEW.OrderID, TRUE);
END$$

CREATE TRIGGER `trg_order_item_bu`
BEFORE UPDATE ON `Order_Item`
FOR EACH ROW
BEGIN
    CALL check_voucher_use(NEW.VoucherID, NEW.OrderID, NOT (NEW.VoucherID <=> OLD.VoucherID));
END$$

CREATE PROCEDURE `sp_record_stock_movement`(
    IN p_material_id   VARCHAR(50),
    IN p_admin_id      VARCHAR(50),
    IN p_movement_type VARCHAR(20),
    IN p_quantity      DECIMAL(12,2),
    IN p_unit_cost     DECIMAL(10,2),
    IN p_reason        VARCHAR(150)
)
BEGIN
    DECLARE v_prev_stock DECIMAL(12,2);
    DECLARE v_new_stock  DECIMAL(12,2);

    IF p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock movement quantity must be greater than zero';
    END IF;

    START TRANSACTION;

    SELECT StockQuantity INTO v_prev_stock
      FROM Material
     WHERE MaterialID = p_material_id
       FOR UPDATE;

    IF v_prev_stock IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Material not found for stock movement';
    END IF;

    IF p_movement_type = 'Stock In' THEN
        SET v_new_stock = v_prev_stock + p_quantity;
    ELSEIF p_movement_type = 'Stock Out' THEN
        IF v_prev_stock < p_quantity THEN
            ROLLBACK;
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock: cannot deduct more than available quantity';
        END IF;
        SET v_new_stock = v_prev_stock - p_quantity;
    ELSE
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid movement type (must be Stock In or Stock Out)';
    END IF;

    UPDATE Material
       SET StockQuantity = v_new_stock,
           UnitCost      = COALESCE(p_unit_cost, UnitCost)
     WHERE MaterialID = p_material_id;

    COMMIT;
END$$

DELIMITER ;
