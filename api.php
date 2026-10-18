<?php
/**
 * پل ارتباطی پایگاه‌داده MySQL و cPanel برای اپلیکیشن خرجیار
 * KharjYar - Self-Contained PHP & MySQL API Bridge for cPanel / phpMyAdmin
 *
 * بدون هیچ وابستگی خارجی (Pure PHP + MySQLi)
 * دارای ساخت خودکار جداول (Auto Schema Generator) و پشتیبانی کامل از کاراکترهای فارسی (utf8mb4)
 */

// -------------------------------------------------------------
// ۱. تنظیمات CORS و هدرهای خروجی JSON با پشتیبانی از فارسی
// -------------------------------------------------------------
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=utf-8");

// مدیریت درخواست‌های Preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// جلوگیری از نمایش خطاهای خام پیش‌فرض به شکل HTML که خروجی JSON را خراب می‌کنند
mysqli_report(MYSQLI_REPORT_OFF);
error_reporting(0);

// -------------------------------------------------------------
// ۲. تنظیمات اتصال به دیتابیس MySQL در cPanel
// -------------------------------------------------------------
/*
 * راهنمای ویرایش برای هاست cPanel:
 * ==============================================================
 * ۱. در cPanel به بخش "MySQL® Database Wizard" بروید.
 * ۲. یک دیتابیس جدید بسازید (نام کامل معمولاً به شکل username_dbname است).
 * ۳. یک کاربر جدید با رمز عبور قوی بسازید و تمام دسترسی‌ها (ALL PRIVILEGES) را بدهید.
 * ۴. مقادیر زیر را با اطلاعات هاست خود جایگزین کنید:
 * ==============================================================
 */
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_USER', getenv('DB_USER') ?: 'root');            // نام کاربری دیتابیس در cPanel
define('DB_PASS', getenv('DB_PASS') ?: '');                // رمز عبور دیتابیس در cPanel
define('DB_NAME', getenv('DB_NAME') ?: 'kharjyar_db');     // نام دیتابیس در cPanel
define('DB_PORT', (int)(getenv('DB_PORT') ?: 3306));

// تابع پاسخگویی استاندارد JSON
function sendResponse($status, $message, $data = null, $httpCode = 200) {
    http_response_code($httpCode);
    $payload = [
        'status' => $status,
        'message' => $message,
        'serverTime' => date('c'),
    ];
    if ($data !== null) {
        $payload['data'] = $data;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// -------------------------------------------------------------
// ۳. برقراری اتصال به MySQL و ساخت خودکار دیتابیس
// -------------------------------------------------------------
try {
    // تلاش برای اتصال اولیه (برای ساخت خودکار دیتابیس در صورت امکان)
    $mysqli = @new mysqli(DB_HOST, DB_USER, DB_PASS, '', DB_PORT);

    if ($mysqli->connect_errno) {
        // تلاش مستقیم برای اتصال به دیتابیس تعیین‌شده (در هاست‌های اشتراکی با دسترسی محدود)
        $mysqli = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        if ($mysqli->connect_errno) {
            sendResponse('error', 'خطا در اتصال به پایگاه‌داده MySQL: ' . $mysqli->connect_error, [
                'hint' => 'لطفاً نام کاربری، رمز عبور و نام دیتابیس را در فایل api.php بررسی کنید.'
            ], 500);
        }
    } else {
        // ساخت دیتابیس در صورت وجود دسترسی
        $dbNameEscaped = preg_replace('/[^a-zA-Z0-9_]/', '', DB_NAME);
        @$mysqli->query("CREATE DATABASE IF NOT EXISTS `{$dbNameEscaped}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        if (!$mysqli->select_db(DB_NAME)) {
            sendResponse('error', 'دیتابیس مورد نظر یافت نشد و امکان ایجاد خودکار آن وجود نداشت: ' . DB_NAME, null, 500);
        }
    }

    // تنظیم کاراکترست utf8mb4 برای پشتیبانی بی‌نقص از زبان فارسی و اموجی‌ها
    $mysqli->set_charset("utf8mb4");

} catch (Exception $e) {
    sendResponse('error', 'خطای سرور در اتصال به دیتابیس: ' . $e->getMessage(), null, 500);
}

// -------------------------------------------------------------
// ۴. ساخت خودکار جداول دیتابیس (Auto Schema Migration)
// -------------------------------------------------------------
function initializeDatabaseTables($mysqli) {
    // جدول دسته‌بندی‌ها
    $sqlCategories = "CREATE TABLE IF NOT EXISTS `kharjyar_categories` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL,
        `icon` VARCHAR(50) NOT NULL DEFAULT 'Tag',
        `color` VARCHAR(30) NOT NULL DEFAULT '#10B981',
        `is_default` TINYINT(1) NOT NULL DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    // جدول هزینه‌ها
    $sqlExpenses = "CREATE TABLE IF NOT EXISTS `kharjyar_expenses` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `title` VARCHAR(255) NOT NULL,
        `amount` BIGINT UNSIGNED NOT NULL,
        `category_id` VARCHAR(64) NOT NULL,
        `date` DATE NOT NULL,
        `note` TEXT NULL,
        `created_at` DATETIME NOT NULL,
        `updated_at` DATETIME NOT NULL,
        INDEX `idx_date` (`date`),
        INDEX `idx_category` (`category_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    // جدول تنظیمات تنخواه
    $sqlPettyCash = "CREATE TABLE IF NOT EXISTS `kharjyar_petty_cash` (
        `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
        `initial_balance` BIGINT UNSIGNED NOT NULL DEFAULT 0,
        `updated_at` DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    // جدول تاریخچه تغییرات و شارژهای تنخواه
    $sqlPettyCashHistory = "CREATE TABLE IF NOT EXISTS `kharjyar_petty_cash_history` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `type` VARCHAR(32) NOT NULL DEFAULT 'recharge',
        `amount` BIGINT NOT NULL DEFAULT 0,
        `previous_balance` BIGINT DEFAULT 0,
        `new_balance` BIGINT DEFAULT 0,
        `date` DATE NOT NULL,
        `note` TEXT NULL,
        `created_at` DATETIME NOT NULL,
        INDEX `idx_history_date` (`date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $mysqli->query($sqlCategories);
    $mysqli->query($sqlExpenses);
    $mysqli->query($sqlPettyCash);
    $mysqli->query($sqlPettyCashHistory);

    // افزودن ردیف پیش‌فرض تنخواه در صورت عدم وجود
    $checkPetty = $mysqli->query("SELECT COUNT(*) AS total FROM `kharjyar_petty_cash` WHERE `id` = 1");
    $pettyRow = $checkPetty ? $checkPetty->fetch_assoc() : null;
    if (!$pettyRow || (int)$pettyRow['total'] === 0) {
        $now = date('Y-m-d H:i:s');
        $mysqli->query("INSERT INTO `kharjyar_petty_cash` (`id`, `initial_balance`, `updated_at`) VALUES (1, 0, '{$now}')");
    }

    // افزودن دسته‌بندی‌های پیش‌فرض در اولین اجرا
    $checkCat = $mysqli->query("SELECT COUNT(*) AS total FROM `kharjyar_categories`");
    $catRow = $checkCat ? $checkCat->fetch_assoc() : null;
    if ($catRow && (int)$catRow['total'] === 0) {
        $defaults = [
            ['cat_food', 'خوراک', 'Utensils', '#10B981', 1],
            ['cat_transport', 'رفت‌وآمد', 'Car', '#3B82F6', 1],
            ['cat_shopping', 'خرید', 'ShoppingBag', '#EC4899', 1],
            ['cat_bills', 'خانه و قبوض', 'Home', '#F59E0B', 1],
            ['cat_health', 'سلامت', 'HeartPulse', '#EF4444', 1],
            ['cat_entertainment', 'تفریح', 'Sparkles', '#8B5CF6', 1],
            ['cat_education', 'آموزش', 'GraduationCap', '#06B6D4', 1],
            ['cat_other', 'سایر', 'MoreHorizontal', '#64748B', 1],
        ];

        $stmt = $mysqli->prepare("INSERT INTO `kharjyar_categories` (`id`, `name`, `icon`, `color`, `is_default`) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            foreach ($defaults as $item) {
                $stmt->bind_param("ssssi", $item[0], $item[1], $item[2], $item[3], $item[4]);
                $stmt->execute();
            }
            $stmt->close();
        }
    }
}

// ساخت جداول
initializeDatabaseTables($mysqli);

// -------------------------------------------------------------
// ۵. موتور درخواست‌ها و عملیات‌ها (Router & Handlers)
// -------------------------------------------------------------
$action = isset($_GET['action']) ? trim($_GET['action']) : 'status';

switch ($action) {

    // بررسی وضعیت اتصال و سلامت API
    case 'status':
    case 'ping':
        $expensesCountRes = $mysqli->query("SELECT COUNT(*) AS total, COALESCE(SUM(`amount`), 0) AS sum_amount FROM `kharjyar_expenses`");
        $expData = $expensesCountRes ? $expensesCountRes->fetch_assoc() : ['total' => 0, 'sum_amount' => 0];

        $catCountRes = $mysqli->query("SELECT COUNT(*) AS total FROM `kharjyar_categories`");
        $catData = $catCountRes ? $catCountRes->fetch_assoc() : ['total' => 0];

        $pettyRes = $mysqli->query("SELECT `initial_balance`, `updated_at` FROM `kharjyar_petty_cash` WHERE `id` = 1");
        $pettyData = $pettyRes ? $pettyRes->fetch_assoc() : ['initial_balance' => 0];

        sendResponse('success', 'اتصال به پایگاه‌داده MySQL خرجیار در هاست برقرار است ✅', [
            'database' => DB_NAME,
            'tables' => [
                'categories' => (int)$catData['total'],
                'expenses' => (int)$expData['total'],
                'expenses_sum_toman' => (int)$expData['sum_amount'],
                'petty_cash_balance' => (int)$pettyData['initial_balance'],
            ],
            'phpVersion' => phpversion(),
            'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'cPanel / Web Server',
        ]);
        break;

    // دریافت تمام اطلاعات برنامه (Get All Resources)
    case 'get_all':
        // دریافت دسته‌بندی‌ها
        $categories = [];
        $catRes = $mysqli->query("SELECT `id`, `name`, `icon`, `color`, `is_default` FROM `kharjyar_categories` ORDER BY `is_default` DESC, `name` ASC");
        if ($catRes) {
            while ($row = $catRes->fetch_assoc()) {
                $categories[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'icon' => $row['icon'],
                    'color' => $row['color'],
                    'isDefault' => (bool)$row['is_default'],
                ];
            }
        }

        // دریافت هزینه‌ها
        $expenses = [];
        $expRes = $mysqli->query("SELECT `id`, `title`, `amount`, `category_id`, `date`, `note`, `created_at`, `updated_at` FROM `kharjyar_expenses` ORDER BY `date` DESC, `created_at` DESC");
        if ($expRes) {
            while ($row = $expRes->fetch_assoc()) {
                $expenses[] = [
                    'id' => $row['id'],
                    'title' => $row['title'],
                    'amount' => (int)$row['amount'],
                    'categoryId' => $row['category_id'],
                    'date' => $row['date'],
                    'note' => $row['note'] !== null ? $row['note'] : undefined,
                    'createdAt' => date('c', strtotime($row['created_at'])),
                    'updatedAt' => date('c', strtotime($row['updated_at'])),
                ];
            }
        }

        // دریافت وضعیت تنخواه
        $initialBalance = 0;
        $pettyUpdatedAt = date('c');
        $pettyRes = $mysqli->query("SELECT `initial_balance`, `updated_at` FROM `kharjyar_petty_cash` WHERE `id` = 1");
        if ($pettyRes && $row = $pettyRes->fetch_assoc()) {
            $initialBalance = (int)$row['initial_balance'];
            $pettyUpdatedAt = date('c', strtotime($row['updated_at']));
        }

        // دریافت تاریخچه تغییرات تنخواه
        $history = [];
        $recharges = [];
        $histRes = $mysqli->query("SELECT `id`, `type`, `amount`, `previous_balance`, `new_balance`, `date`, `note`, `created_at` FROM `kharjyar_petty_cash_history` ORDER BY `date` DESC, `created_at` DESC");
        if ($histRes) {
            while ($row = $histRes->fetch_assoc()) {
                $historyItem = [
                    'id' => $row['id'],
                    'type' => $row['type'],
                    'amount' => (int)$row['amount'],
                    'previousBalance' => $row['previous_balance'] !== null ? (int)$row['previous_balance'] : null,
                    'newBalance' => $row['new_balance'] !== null ? (int)$row['new_balance'] : null,
                    'date' => $row['date'],
                    'note' => $row['note'],
                    'createdAt' => date('c', strtotime($row['created_at'])),
                ];
                $history[] = $historyItem;

                if ($row['type'] === 'recharge') {
                    $recharges[] = [
                        'id' => $row['id'],
                        'amount' => (int)$row['amount'],
                        'date' => $row['date'],
                        'note' => $row['note'],
                        'createdAt' => date('c', strtotime($row['created_at'])),
                    ];
                }
            }
        }

        sendResponse('success', 'اطلاعات با موفقیت از پایگاه‌داده دریافت شد.', [
            'version' => 1,
            'categories' => $categories,
            'expenses' => $expenses,
            'pettyCash' => [
                'initialBalance' => $initialBalance,
                'recharges' => $recharges,
                'history' => $history,
                'updatedAt' => $pettyUpdatedAt,
            ],
            'updatedAt' => date('c'),
        ]);
        break;

    // همگام‌سازی و بازنویسی جامع تراکنش‌محور (Transactional Bulk Sync)
    case 'sync_all':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendResponse('error', 'برای همگام‌سازی کلی، متد POST الزامی است.', null, 405);
        }

        $inputRaw = file_get_contents('php://input');
        $payload = json_decode($inputRaw, true);

        if (!$payload || !is_array($payload)) {
            sendResponse('error', 'فرمت داده‌های ارسالی نامعتبر است (JSON مورد نیاز است).', null, 400);
        }

        // پشتیبانی از ساختارهای مستقیم یا بسته‌بندی شده در فیلد data
        $content = isset($payload['data']) ? $payload['data'] : $payload;

        $categories = isset($content['categories']) && is_array($content['categories']) ? $content['categories'] : [];
        $expenses = isset($content['expenses']) && is_array($content['expenses']) ? $content['expenses'] : [];
        $pettyCash = isset($content['pettyCash']) && is_array($content['pettyCash']) ? $content['pettyCash'] : [];

        // آغاز تراکنش دیتابیس برای تضمین یکپارچگی و امنیت داده‌ها (ACID)
        $mysqli->begin_transaction();

        try {
            // ۱. بروزرسانی دسته‌بندی‌ها
            if (!empty($categories)) {
                $mysqli->query("DELETE FROM `kharjyar_categories`");
                $catStmt = $mysqli->prepare("INSERT INTO `kharjyar_categories` (`id`, `name`, `icon`, `color`, `is_default`) VALUES (?, ?, ?, ?, ?)");
                foreach ($categories as $cat) {
                    $cId = (string)($cat['id'] ?? '');
                    $cName = (string)($cat['name'] ?? '');
                    $cIcon = (string)($cat['icon'] ?? 'Tag');
                    $cColor = (string)($cat['color'] ?? '#10B981');
                    $cDef = !empty($cat['isDefault']) ? 1 : 0;
                    if ($cId && $cName) {
                        $catStmt->bind_param("ssssi", $cId, $cName, $cIcon, $cColor, $cDef);
                        $catStmt->execute();
                    }
                }
                $catStmt->close();
            }

            // ۲. بروزرسانی هزینه‌ها
            $mysqli->query("DELETE FROM `kharjyar_expenses`");
            if (!empty($expenses)) {
                $expStmt = $mysqli->prepare("INSERT INTO `kharjyar_expenses` (`id`, `title`, `amount`, `category_id`, `date`, `note`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($expenses as $exp) {
                    $eId = (string)($exp['id'] ?? '');
                    $eTitle = (string)($exp['title'] ?? '');
                    $eAmount = (int)($exp['amount'] ?? 0);
                    $eCatId = (string)($exp['categoryId'] ?? 'cat_other');
                    $eDate = (string)($exp['date'] ?? date('Y-m-d'));
                    $eNote = isset($exp['note']) ? (string)$exp['note'] : null;
                    $eCreatedAt = isset($exp['createdAt']) ? date('Y-m-d H:i:s', strtotime($exp['createdAt'])) : date('Y-m-d H:i:s');
                    $eUpdatedAt = isset($exp['updatedAt']) ? date('Y-m-d H:i:s', strtotime($exp['updatedAt'])) : date('Y-m-d H:i:s');

                    if ($eId && $eTitle && $eAmount > 0) {
                        $expStmt->bind_param("ssisssss", $eId, $eTitle, $eAmount, $eCatId, $eDate, $eNote, $eCreatedAt, $eUpdatedAt);
                        $expStmt->execute();
                    }
                }
                $expStmt->close();
            }

            // ۳. بروزرسانی تنخواه
            $initialBalance = (int)($pettyCash['initialBalance'] ?? 0);
            $pettyNow = date('Y-m-d H:i:s');
            $mysqli->query("REPLACE INTO `kharjyar_petty_cash` (`id`, `initial_balance`, `updated_at`) VALUES (1, {$initialBalance}, '{$pettyNow}')");

            // ۴. بروزرسانی تاریخچه و شارژهای تنخواه
            $historyItems = isset($pettyCash['history']) && is_array($pettyCash['history']) ? $pettyCash['history'] : [];
            // در صورتی که تاریخچه ارسال نشده ولی شارژها موجود باشند:
            if (empty($historyItems) && isset($pettyCash['recharges']) && is_array($pettyCash['recharges'])) {
                foreach ($pettyCash['recharges'] as $r) {
                    $historyItems[] = [
                        'id' => $r['id'] ?? uniqid('pevt_'),
                        'type' => 'recharge',
                        'amount' => $r['amount'] ?? 0,
                        'date' => $r['date'] ?? date('Y-m-d'),
                        'note' => $r['note'] ?? null,
                        'createdAt' => $r['createdAt'] ?? date('c'),
                    ];
                }
            }

            $mysqli->query("DELETE FROM `kharjyar_petty_cash_history`");
            if (!empty($historyItems)) {
                $histStmt = $mysqli->prepare("INSERT INTO `kharjyar_petty_cash_history` (`id`, `type`, `amount`, `previous_balance`, `new_balance`, `date`, `note`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($historyItems as $h) {
                    $hId = (string)($h['id'] ?? uniqid('pevt_'));
                    $hType = (string)($h['type'] ?? 'recharge');
                    $hAmount = (int)($h['amount'] ?? 0);
                    $hPrev = isset($h['previousBalance']) ? (int)$h['previousBalance'] : null;
                    $hNew = isset($h['newBalance']) ? (int)$h['newBalance'] : null;
                    $hDate = (string)($h['date'] ?? date('Y-m-d'));
                    $hNote = isset($h['note']) ? (string)$h['note'] : null;
                    $hCreatedAt = isset($h['createdAt']) ? date('Y-m-d H:i:s', strtotime($h['createdAt'])) : date('Y-m-d H:i:s');

                    $histStmt->bind_param("ssiiisss", $hId, $hType, $hAmount, $hPrev, $hNew, $hDate, $hNote, $hCreatedAt);
                    $histStmt->execute();
                }
                $histStmt->close();
            }

            // ثبت قطعی تراکنش (Commit)
            $mysqli->commit();

            sendResponse('success', 'همگام‌سازی اطلاعات در پایگاه‌داده با موفقیت انجام شد ✅', [
                'syncedExpenses' => count($expenses),
                'syncedCategories' => count($categories),
                'syncedHistory' => count($historyItems),
                'pettyCashBalance' => $initialBalance,
                'syncedAt' => date('c'),
            ]);

        } catch (Exception $e) {
            // بازگردانی تغییرات در صورت بروز هرگونه خطا (Rollback)
            $mysqli->rollback();
            sendResponse('error', 'خطا در عملیات همگام‌سازی، تغییرات بازگردانده شد: ' . $e->getMessage(), null, 500);
        }
        break;

    default:
        sendResponse('error', 'اکشن نامعتبر است: ' . htmlspecialchars($action), [
            'available_actions' => ['status', 'get_all', 'sync_all']
        ], 404);
        break;
}
