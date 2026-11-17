-- =====================================================================
-- PRE-OPTIMIZATION DATABASE BACKUP (`database/backup_before_optimization.sql`)
-- Lillia and Rowena Furniture — Snapshot Prior to 3NF Schema Optimization
-- Database: `lillia_rowena_furniture` (InnoDB, utf8mb4_unicode_ci)
--
-- Contains the pre-optimization schema and seed data before removing:
--   1. `Voucher.ExpiryDate` (`DATE`) — consolidated into `Voucher.ExpiresAt` (`DATETIME`)
--   2. `Customization.MaterialID` (`VARCHAR(50)`) — normalized via `Order_Item_Material`
--   3. `Production_Task.EndDate` (`DATE`) — consolidated into `Customer_Order.CompletedAt`
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `lillia_rowena_furniture`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lillia_rowena_furniture`;

SET FOREIGN_KEY_CHECKS = 0;

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
    `Description`   TEXT,
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

CREATE TABLE `Product` (
    `ProductID`    VARCHAR(50)    NOT NULL,
    `CategoryID`   VARCHAR(50)    NOT NULL,
    `ProductName`  VARCHAR(150)   NOT NULL,
    `BasePrice`    DECIMAL(10,2)  NOT NULL,
    CONSTRAINT `pk_product` PRIMARY KEY (`ProductID`),
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
    CONSTRAINT `pk_material` PRIMARY KEY (`MaterialID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Voucher` (
    `VoucherID`      VARCHAR(50)    NOT NULL,
    `CustomerID`     VARCHAR(50)    NOT NULL,
    `ProductID`      VARCHAR(50)    NOT NULL,
    `AdminID`        VARCHAR(50)    NOT NULL,
    `Code`           VARCHAR(50)    NOT NULL,
    `DiscountValue`  DECIMAL(10,2)  NOT NULL,
    `ExpiryDate`     DATE           DEFAULT NULL,
    `ExpiresAt`      DATETIME       DEFAULT NULL,
    `Status`         VARCHAR(20)    NOT NULL DEFAULT 'Active',
    `IssuedAt`       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `pk_voucher` PRIMARY KEY (`VoucherID`),
    CONSTRAINT `uq_voucher_code` UNIQUE (`Code`),
    CONSTRAINT `uq_voucher_product_pair` UNIQUE (`VoucherID`, `ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Customer_Order` (
    `OrderID`      VARCHAR(50)  NOT NULL,
    `CustomerID`   VARCHAR(50)  NOT NULL,
    `OrderDate`    DATE         NOT NULL,
    `CompletedAt`  DATE         DEFAULT NULL,
    `Status`       VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    CONSTRAINT `pk_customer_order` PRIMARY KEY (`OrderID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Order_Item` (
    `OrderItemID`  VARCHAR(50)    NOT NULL,
    `OrderID`      VARCHAR(50)    NOT NULL,
    `ProductID`    VARCHAR(50)    NOT NULL,
    `VoucherID`    VARCHAR(50)    DEFAULT NULL,
    `ItemType`     VARCHAR(20)    NOT NULL DEFAULT 'Standard',
    `Quantity`     INT            NOT NULL DEFAULT 1,
    `UnitPrice`    DECIMAL(10,2)  NOT NULL,
    CONSTRAINT `pk_order_item` PRIMARY KEY (`OrderItemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Order_Item_Material` (
    `OrderItemID`   VARCHAR(50)    NOT NULL,
    `MaterialID`    VARCHAR(50)    NOT NULL,
    `QuantityUsed`  DECIMAL(12,2)  NOT NULL,
    CONSTRAINT `pk_order_item_material` PRIMARY KEY (`OrderItemID`, `MaterialID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Customization` (
    `CustomizationID`  VARCHAR(50)    NOT NULL,
    `OrderItemID`      VARCHAR(50)    NOT NULL,
    `MaterialID`       VARCHAR(50)    DEFAULT NULL,
    `Length`           DECIMAL(8,2)   DEFAULT NULL,
    `Width`            DECIMAL(8,2)   DEFAULT NULL,
    `Height`           DECIMAL(8,2)   DEFAULT NULL,
    `ColorFinish`      VARCHAR(100)   DEFAULT NULL,
    `Notes`            TEXT,
    `ExtraCost`        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    CONSTRAINT `pk_customization` PRIMARY KEY (`CustomizationID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
    `PaymentID`    VARCHAR(50)    NOT NULL,
    `OrderID`      VARCHAR(50)    NOT NULL,
    `PaymentDate`  DATE           NOT NULL,
    `Amount`       DECIMAL(10,2)  NOT NULL,
    CONSTRAINT `pk_payment` PRIMARY KEY (`PaymentID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Production_Task` (
    `TaskID`       VARCHAR(50)  NOT NULL,
    `OrderItemID`  VARCHAR(50)  NOT NULL,
    `StartDate`    DATE         DEFAULT NULL,
    `EndDate`      DATE         DEFAULT NULL,
    `TaskStatus`   VARCHAR(20)  NOT NULL DEFAULT 'Todo',
    CONSTRAINT `pk_production_task` PRIMARY KEY (`TaskID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Backup Records
INSERT INTO `Admin` (`AdminID`, `Email`, `PasswordHash`) VALUES
('ADM-LR-901', 'admin@lilliarowena.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

INSERT INTO `Category` (`CategoryID`, `CategoryName`, `Description`) VALUES
('CAT-LV-110', 'Living Room', 'Low-slung architectural silhouettes upholstered in heavyweight Belgian linen and nubby wool bouclé, paired with kiln-dried white oak lounge frames and honed Italian travertine surfaces.'),
('CAT-DN-220', 'Dining Room', 'Heirloom dining tables milled from FAS-grade American black walnut and European white oak slabs, finished with hand-rubbed organic linseed oil and paired with Danish paper-cord chairs.'),
('CAT-BD-330', 'Bedroom', 'Quiet, grounding sleep architecture featuring Belgian flax linen headboards, solid ash timber platform rails, and cantilevered bedside tables with soft-close dovetail drawers.'),
('CAT-OF-440', 'Study/Work Desks', 'Commanding work desks and custom-milled fluted credenzas engineered with concealed cable channels, solid brass hardware, and book-matched walnut veneer interiors.'),
('CAT-KT-550', 'Kitchen', 'Architectural kitchen islands, honed Roman travertine prep surfaces, and sculpted solid oak counter stools crafted for open-plan culinary ateliers.');

INSERT INTO `Customer` (`CustomerID`, `FullName`, `Email`, `PasswordHash`, `PhoneNumber`, `Address`) VALUES
('LR-CUS-301', 'Rowena Vance', 'rowena.vance@vancearchitects.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+1 (212) 555-0148', 'Suite 400, 118 Mercer St, SoHo, New York, NY 10013'),
('LR-CUS-302', 'Julian Mercier', 'j.mercier@mercierstudio.co', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+1 (415) 555-0192', '742 Evergreen Terrace, Pacific Heights, SF'),
('LR-CUS-304', 'Elena Rostova', 'elena@rostovainteriors.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+44 20 7946 0821', '29A Kensington Park Rd, Notting Hill'),
('LR-CUS-308', 'Marcus Sterling', 'm.sterling@sterlingcapital.io', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+1 (312) 555-0164', '880 Lake Shore Drive, Apt 32B, Chicago');

INSERT INTO `Product` (`ProductID`, `CategoryID`, `ProductName`, `BasePrice`) VALUES
('LR-LV-014', 'CAT-LV-110', 'Rowena Curved Bouclé Lounge Sofa', 281300.00),
('LR-DN-108', 'CAT-DN-220', 'Lillia Monolith Solid Walnut Dining Table', 243600.00),
('LR-BD-204', 'CAT-BD-330', 'Serene Belgian Linen Platform Bed (King)', 211700.00),
('LR-OF-315', 'CAT-OF-440', 'Quarter-Sawn Oak Architect Work Desk', 124700.00),
('LR-OF-302', 'CAT-OF-440', 'Mercier Fluted Walnut Sideboard Credenza', 225620.00),
('LR-LV-029', 'CAT-LV-110', 'Cavana Sculpted White Oak Lounge Chair', 97440.00),
('LR-LV-042', 'CAT-LV-110', 'Verona Honed Travertine Plinth Table', 136300.00),
('LR-DN-115', 'CAT-DN-220', 'Solenne Woven Cord Dining Chair (Set of 2)', 74820.00),
('LR-BD-219', 'CAT-BD-330', 'Cantilevered Ash Bedside Nightstand (Pair)', 68440.00),
('LR-KT-401', 'CAT-KT-550', 'Valen Travertine & Walnut Kitchen Island', 223300.00),
('LR-KT-412', 'CAT-KT-550', 'Soren Sculpted Oak Counter Stools (Set of 2)', 84100.00);

INSERT INTO `Material` (`MaterialID`, `MaterialName`, `MaterialType`, `Unit`, `UnitCost`, `StockQuantity`) VALUES
('MAT-WAL-01', 'FAS American Black Walnut Slabs', 'Solid Timber', 'bd ft', 1624.00, 180.00),
('MAT-OAK-02', 'Quarter-Sawn European White Oak', 'Solid Timber', 'bd ft', 1276.00, 145.00),
('MAT-ASH-03', 'Kiln-Dried European Ash Timber', 'Solid Timber', 'bd ft', 1102.00, 28.00),
('MAT-BCL-04', 'Heavyweight Belgian Wool Bouclé', 'Upholstery Textile', 'sq m', 3944.00, 84.00),
('MAT-LIN-05', 'Unbleached Belgian Flax Linen', 'Upholstery Textile', 'sq m', 3132.00, 62.00),
('MAT-TRV-06', 'Honed Roman Travertine Blocks', 'Architectural Stone', 'slabs', 24360.00, 6.00),
('MAT-BRS-07', 'Solid Aged Brass Hardware & Butterfly Keys', 'Hardware & Joinery', 'sets', 5510.00, 32.00),
('MAT-CRD-08', 'Danish Waxed Paper Cord & Cold-Pressed Linseed Oil', 'Cord & Finishes', 'rolls', 2436.00, 24.00);

INSERT INTO `Voucher` (`VoucherID`, `CustomerID`, `ProductID`, `AdminID`, `Code`, `DiscountValue`, `ExpiryDate`, `ExpiresAt`, `Status`) VALUES
('VCH-LR-740', 'LR-CUS-301', 'LR-LV-014', 'ADM-LR-901', 'VCH-ROWENA-SOFA400', 23200.00, '2026-12-31', '2026-12-31 23:59:59', 'Active'),
('VCH-LR-735', 'LR-CUS-301', 'LR-DN-108', 'ADM-LR-901', 'VCH-ROWENA-WALNUT350', 20300.00, '2026-12-31', '2026-12-31 23:59:59', 'Active'),
('VCH-LR-725', 'LR-CUS-302', 'LR-BD-204', 'ADM-LR-901', 'VCH-JULIAN-BED250', 14500.00, '2026-12-15', '2026-12-15 23:59:59', 'Active'),
('VCH-LR-710', 'LR-CUS-304', 'LR-OF-315', 'ADM-LR-901', 'VCH-ELENA-DESK300', 17400.00, '2026-12-10', '2026-12-10 23:59:59', 'Used'),
('VCH-LR-705', 'LR-CUS-308', 'LR-LV-029', 'ADM-LR-901', 'VCH-MARCUS-CHAIR200', 11600.00, '2026-10-31', '2026-10-31 23:59:59', 'Expired'),
('VCH-LR-690', 'LR-CUS-302', 'LR-OF-302', 'ADM-LR-901', 'VCH-JULIAN-CREDENZA150', 8700.00, '2026-12-20', '2026-12-20 23:59:59', 'Revoked');

INSERT INTO `Customer_Order` (`OrderID`, `CustomerID`, `OrderDate`, `CompletedAt`, `Status`) VALUES
('ORD-2026-8841', 'LR-CUS-301', '2026-10-18', NULL, 'InProduction'),
('ORD-2026-8834', 'LR-CUS-301', '2026-10-04', NULL, 'Ready'),
('ORD-2026-8829', 'LR-CUS-302', '2026-10-11', NULL, 'InProduction'),
('ORD-2026-8815', 'LR-CUS-304', '2026-09-26', '2026-09-29', 'Delivered'),
('ORD-2026-8850', 'LR-CUS-308', '2026-11-08', NULL, 'Pending'),
('ORD-2026-8854', 'LR-CUS-304', '2026-11-04', '2026-11-04', 'Delivered'),
('ORD-2026-8858', 'LR-CUS-301', '2026-11-11', '2026-11-11', 'Delivered'),
('ORD-2026-8862', 'LR-CUS-302', '2026-11-15', NULL, 'InProduction');

INSERT INTO `Order_Item` (`OrderItemID`, `OrderID`, `ProductID`, `VoucherID`, `ItemType`, `Quantity`, `UnitPrice`) VALUES
('ITM-2026-5841', 'ORD-2026-8841', 'LR-DN-108', NULL, 'Custom', 1, 214368.00),
('ITM-2026-5834', 'ORD-2026-8834', 'LR-LV-014', NULL, 'Standard', 1, 253170.00),
('ITM-2026-5829', 'ORD-2026-8829', 'LR-OF-302', NULL, 'Standard', 2, 191777.00),
('ITM-2026-5815', 'ORD-2026-8815', 'LR-BD-204', NULL, 'Standard', 1, 211700.00),
('ITM-2026-5850', 'ORD-2026-8850', 'LR-LV-029', NULL, 'Standard', 2, 106720.00),
('ITM-2026-5854', 'ORD-2026-8854', 'LR-OF-315', 'VCH-LR-710', 'Standard', 1, 107300.00),
('ITM-2026-5858', 'ORD-2026-8858', 'LR-DN-115', NULL, 'Standard', 3, 74820.00),
('ITM-2026-5862', 'ORD-2026-8862', 'LR-OF-315', NULL, 'Standard', 1, 124700.00);

INSERT INTO `Order_Item_Material` (`OrderItemID`, `MaterialID`, `QuantityUsed`) VALUES
('ITM-2026-5841', 'MAT-WAL-01', 48.00),
('ITM-2026-5834', 'MAT-BCL-04', 14.00),
('ITM-2026-5829', 'MAT-WAL-01', 64.00),
('ITM-2026-5815', 'MAT-LIN-05', 16.00),
('ITM-2026-5850', 'MAT-OAK-02', 24.00),
('ITM-2026-5854', 'MAT-OAK-02', 18.00),
('ITM-2026-5858', 'MAT-CRD-08', 4.00),
('ITM-2026-5862', 'MAT-OAK-02', 18.00);

INSERT INTO `Customization` (`CustomizationID`, `OrderItemID`, `MaterialID`, `Length`, `Width`, `Height`, `ColorFinish`, `Notes`, `ExtraCost`) VALUES
('CSM-2026-6841', 'ITM-2026-5841', 'MAT-WAL-01', 260.00, 110.00, 75.00, 'Hand-Rubbed Natural Walnut', 'Book-matched walnut slab approved by client via slab photography.', 0.00);

INSERT INTO `Payment` (`PaymentID`, `OrderID`, `PaymentDate`, `Amount`) VALUES
('PAY-2026-9841', 'ORD-2026-8841', '2026-10-18', 107184.00),
('PAY-2026-9834', 'ORD-2026-8834', '2026-10-04', 253170.00),
('PAY-2026-9829', 'ORD-2026-8829', '2026-10-11', 191777.00),
('PAY-2026-9815', 'ORD-2026-8815', '2026-09-26', 211700.00),
('PAY-2026-9854', 'ORD-2026-8854', '2026-11-04', 183570.00),
('PAY-2026-9858', 'ORD-2026-8858', '2026-11-11', 224460.00),
('PAY-2026-9862', 'ORD-2026-8862', '2026-11-15', 124700.00);

INSERT INTO `Production_Task` (`TaskID`, `OrderItemID`, `StartDate`, `EndDate`, `TaskStatus`) VALUES
('TSK-2026-2841', 'ITM-2026-5841', '2026-10-18', NULL, 'InProgress'),
('TSK-2026-2834', 'ITM-2026-5834', '2026-10-04', '2026-10-20', 'Done'),
('TSK-2026-2829', 'ITM-2026-5829', '2026-10-11', NULL, 'InProgress'),
('TSK-2026-2815', 'ITM-2026-5815', '2026-09-26', '2026-10-12', 'Done'),
('TSK-2026-2850', 'ITM-2026-5850', '2026-11-08', NULL, 'Todo'),
('TSK-2026-2854', 'ITM-2026-5854', '2026-11-04', '2026-11-10', 'Done'),
('TSK-2026-2858', 'ITM-2026-5858', '2026-11-11', '2026-11-14', 'Done'),
('TSK-2026-2862', 'ITM-2026-5862', '2026-11-15', NULL, 'InProgress');
