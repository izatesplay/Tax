<?php
/**
 * پل ارتباطی پایگاه‌داده MySQL و cPanel برای اپلیکیشن مدیریت مالی «خرجیار»
 * KharjYar - Self-Contained PHP & MySQL API Bridge for cPanel / phpMyAdmin
 *
 * ویژگی‌های این اسکریپت:
 * ۱. کاملاً مستقل و خودکفا بدون هیچ‌گونه نیاز به کتابخانه یا وابستگی خارجی (Pure PHP + MySQLi).
 * ۲. ساخت خودکار دیتابیس و تمامی جداول مورد نیاز برنامه در نخستین اجرا (Auto Schema Migration).
 * ۳. پشتیبانی کامل از زبان فارسی و کاراکترهای یونیکد (utf8mb4).
 * ۴. پشتیبانی بومی از CORS و ضد کش (No-Cache) برای همگام‌سازی آنی و دقیق در تمام مرورگرها.
 * ۵. تراکنش‌های اتمیک (ACID Transaction) جهت حذف و ذخیره‌سازی دقیق هزینه‌ها و واریزی‌های تنخواه.
 * ۶. بدون چاپ هیچ‌گونه خروجی HTML یا اخطار؛ همواره پاسخ معتبر استاندارد JSON برمی‌گرداند.
 */

// -------------------------------------------------------------
// ۱. هدرهای CORS، ضد کش (No-Cache) و فرمت خروجی JSON
// -------------------------------------------------------------
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: 0");
header("Content-Type: application/json; charset=utf-8");

// پاسخ سریع به درخواست‌های مقدماتی (Preflight OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'success', 'message' => 'CORS preflight OK'], JSON_UNESCAPED_UNICODE);
    exit;
}

// غیرفعال‌سازی نمایش خطاهای خام PHP به صورت HTML که ساختار JSON را خراب می‌کنند
error_reporting(0);
ini_set('display_errors', '0');
mysqli_report(MYSQLI_REPORT_OFF);

// توابع کمکی تاریخ ایمن برای سازگاری کامل با PHP 8+
function safeMysqlDateTime($val) {
    if (empty($val) || !is_string($val)) {
        return date('Y-m-d H:i:s');
    }
    $ts = strtotime($val);
    return ($ts !== false && $ts > 0) ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');
}

function safeIsoDate($val) {
    if (empty($val) || !is_string($val)) {
        return date('c');
    }
    $ts = strtotime($val);
    return ($ts !== false && $ts > 0) ? date('c', $ts) : date('c');
}

// تابع ارسال پاسخ استاندارد JSON
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
// ۲. تنظیمات اتصال به دیتابیس MySQL در cPanel
// -------------------------------------------------------------
/*
 * ==============================================================
 * راهنمای تنظیم سریع برای کاربران cPanel / phpMyAdmin:
 * ==============================================================
 * ۱. در کنترل‌پنل cPanel خود به بخش "MySQL® Databases" بروید.
 * ۲. یک دیتابیس و یک کاربر دیتابیس بسازید و تمام دسترسی‌ها (ALL PRIVILEGES) را بدهید.
 * ۳. مقادیر ۴ خط زیر را با اطلاعات هاست خود پر کنید:
 * ==============================================================
 */
$DB_HOST = getenv('DB_HOST') ?: 'localhost';
$DB_USER = getenv('DB_USER') ?: 'root';             // نام کاربری دیتابیس در cPanel
$DB_PASS = getenv('DB_PASS') ?: '';                 // رمز عبور دیتابیس در cPanel
$DB_NAME = getenv('DB_NAME') ?: 'kharjyar_db';      // نام پایگاه‌داده در cPanel
$DB_PORT = (int)(getenv('DB_PORT') ?: 3306);

// -------------------------------------------------------------
// ۳. اتصال به MySQL
// -------------------------------------------------------------
try {
    $mysqli = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, $DB_PORT);

    if ($mysqli->connect_errno) {
        // در صورت عدم وجود دیتابیس، تلاش برای اتصال عمومی و ایجاد خودکار آن
        $mysqliInit = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, '', $DB_PORT);
        if ($mysqliInit->connect_errno) {
            sendResponse('error', 'خطا در اتصال به پایگاه‌داده MySQL: ' . $mysqliInit->connect_error, [
                'hint' => 'لطفاً نام کاربری، رمز عبور و نام دیتابیس را در فایل api.php بررسی کنید.',
                'code' => $mysqliInit->connect_errno,
            ], 200);
        }

        $safeDb = preg_replace('/[^a-zA-Z0-9_]/', '', $DB_NAME);
        @$mysqliInit->query("CREATE DATABASE IF NOT EXISTS `{$safeDb}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $mysqliInit->close();

        // اتصال مجدد پس از ساخت دیتابیس
        $mysqli = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, $DB_PORT);
        if ($mysqli->connect_errno) {
            sendResponse('error', 'دیتابیس ساخته نشد یا دسترسی وجود ندارد: ' . $mysqli->connect_error, [
                'hint' => 'دیتابیس را از داخل cPanel بسازید و نام آن را در api.php قرار دهید.',
            ], 200);
        }
    }

    // تنظیم کاراکترست utf8mb4 برای پشتیبانی بی‌نقص از زبان فارسی، نیم‌فاصله و اموجی‌ها
    $mysqli->set_charset("utf8mb4");

} catch (Throwable $e) {
    sendResponse('error', 'خطای سرور در اتصال به پایگاه‌داده: ' . $e->getMessage(), null, 200);
}

// -------------------------------------------------------------
// ۴. ساخت خودکار جداول مورد نیاز برنامه (Auto Schema Generator)
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

    @$mysqli->query($sqlCategories);
    @$mysqli->query($sqlExpenses);
    @$mysqli->query($sqlPettyCash);
    @$mysqli->query($sqlPettyCashHistory);

    // اطمینان از وجود ستون‌ها در صورت استفاده از نسخه‌های قبلی جدول
    @$mysqli->query("ALTER TABLE `kharjyar_petty_cash_history` ADD COLUMN `previous_balance` BIGINT DEFAULT 0");
    @$mysqli->query("ALTER TABLE `kharjyar_petty_cash_history` ADD COLUMN `new_balance` BIGINT DEFAULT 0");

    // افزودن ردیف پیش‌فرض تنخواه در صورت عدم وجود
    $checkPetty = @$mysqli->query("SELECT COUNT(*) AS total FROM `kharjyar_petty_cash` WHERE `id` = 1");
    $pettyRow = $checkPetty ? $checkPetty->fetch_assoc() : null;
    if (!$pettyRow || (int)$pettyRow['total'] === 0) {
        $now = date('Y-m-d H:i:s');
        @$mysqli->query("INSERT INTO `kharjyar_petty_cash` (`id`, `initial_balance`, `updated_at`) VALUES (1, 0, '{$now}')");
    }

    // افزودن دسته‌بندی‌های پیش‌فرض در اولین اجرا
    $checkCat = @$mysqli->query("SELECT COUNT(*) AS total FROM `kharjyar_categories`");
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

        $stmt = @$mysqli->prepare("INSERT INTO `kharjyar_categories` (`id`, `name`, `icon`, `color`, `is_default`) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            foreach ($defaults as $item) {
                $stmt->bind_param("ssssi", $item[0], $item[1], $item[2], $item[3], $item[4]);
                $stmt->execute();
            }
            $stmt->close();
        }
    }
}

initializeDatabaseTables($mysqli);

// -------------------------------------------------------------
// ۵. روت‌ها و مدیریت عملیات‌ها
// -------------------------------------------------------------
$action = isset($_GET['action']) ? trim($_GET['action']) : (isset($_POST['action']) ? trim($_POST['action']) : 'status');

switch ($action) {

    // بررسی سلامت اتصال و آمار پایگاه‌داده
    case 'status':
    case 'ping':
    case 'health':
        $expCountRes = @$mysqli->query("SELECT COUNT(*) AS total, COALESCE(SUM(`amount`), 0) AS sum_amount FROM `kharjyar_expenses`");
        $expData = $expCountRes ? $expCountRes->fetch_assoc() : ['total' => 0, 'sum_amount' => 0];

        $catCountRes = @$mysqli->query("SELECT COUNT(*) AS total FROM `kharjyar_categories`");
        $catData = $catCountRes ? $catCountRes->fetch_assoc() : ['total' => 0];

        $pettyRes = @$mysqli->query("SELECT `initial_balance` FROM `kharjyar_petty_cash` WHERE `id` = 1");
        $pettyData = $pettyRes ? $pettyRes->fetch_assoc() : ['initial_balance' => 0];

        sendResponse('success', 'اتصال به پایگاه‌داده MySQL خرجیار در cPanel برقرار است ✅', [
            'database' => $DB_NAME,
            'tables' => [
                'categories' => (int)($catData['total'] ?? 0),
                'expenses' => (int)($expData['total'] ?? 0),
                'expenses_sum_toman' => (int)($expData['sum_amount'] ?? 0),
                'petty_cash_balance' => (int)($pettyData['initial_balance'] ?? 0),
            ],
            'phpVersion' => phpversion(),
            'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'cPanel / Apache / Web Server',
        ]);
        break;

    // دریافت تمامی منابع و اطلاعات ذخیره شده
    case 'get_all':
        // دریافت دسته‌بندی‌ها
        $categories = [];
        $catRes = @$mysqli->query("SELECT `id`, `name`, `icon`, `color`, `is_default` FROM `kharjyar_categories` ORDER BY `is_default` DESC, `name` ASC");
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
        $expRes = @$mysqli->query("SELECT `id`, `title`, `amount`, `category_id`, `date`, `note`, `created_at`, `updated_at` FROM `kharjyar_expenses` ORDER BY `date` DESC, `created_at` DESC");
        if ($expRes) {
            while ($row = $expRes->fetch_assoc()) {
                $expenses[] = [
                    'id' => $row['id'],
                    'title' => $row['title'],
                    'amount' => (int)$row['amount'],
                    'categoryId' => $row['category_id'],
                    'date' => $row['date'],
                    'note' => $row['note'] !== null ? $row['note'] : null,
                    'createdAt' => safeIsoDate($row['created_at']),
                    'updatedAt' => safeIsoDate($row['updated_at']),
                ];
            }
        }

        // دریافت وضعیت تنخواه
        $initialBalance = 0;
        $pettyUpdatedAt = date('c');
        $pettyRes = @$mysqli->query("SELECT `initial_balance`, `updated_at` FROM `kharjyar_petty_cash` WHERE `id` = 1");
        if ($pettyRes && $row = $pettyRes->fetch_assoc()) {
            $initialBalance = (int)$row['initial_balance'];
            $pettyUpdatedAt = safeIsoDate($row['updated_at']);
        }

        // دریافت تاریخچه و واریزی‌های تنخواه
        $history = [];
        $recharges = [];
        $histRes = @$mysqli->query("SELECT `id`, `type`, `amount`, `previous_balance`, `new_balance`, `date`, `note`, `created_at` FROM `kharjyar_petty_cash_history` ORDER BY `date` DESC, `created_at` DESC");
        if ($histRes) {
            while ($row = $histRes->fetch_assoc()) {
                $historyItem = [
                    'id' => $row['id'],
                    'type' => $row['type'],
                    'amount' => (int)$row['amount'],
                    'previousBalance' => $row['previous_balance'] !== null ? (int)$row['previous_balance'] : null,
                    'newBalance' => $row['new_balance'] !== null ? (int)$row['new_balance'] : null,
                    'date' => $row['date'],
                    'note' => $row['note'] !== null ? $row['note'] : null,
                    'createdAt' => safeIsoDate($row['created_at']),
                ];
                $history[] = $historyItem;

                if ($row['type'] === 'recharge') {
                    $recharges[] = [
                        'id' => $row['id'],
                        'amount' => (int)$row['amount'],
                        'date' => $row['date'],
                        'note' => $row['note'] !== null ? $row['note'] : null,
                        'createdAt' => safeIsoDate($row['created_at']),
                    ];
                }
            }
        }

        sendResponse('success', 'اطلاعات با موفقیت از دیتابیس MySQL دریافت شد.', [
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

    // همگام‌سازی، حذف و ذخیره‌سازی داده‌ها با تراکنش ایمن
    case 'sync_all':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendResponse('error', 'برای همگام‌سازی، متد POST الزامی است.', null, 200);
        }

        $inputRaw = file_get_contents('php://input');
        $payload = json_decode($inputRaw, true);

        if (!$payload || !is_array($payload)) {
            sendResponse('error', 'داده‌های ارسال‌شده معتبر نیستند (فرمت JSON مورد نیاز است).', null, 200);
        }

        $content = isset($payload['data']) ? $payload['data'] : $payload;

        $categories = isset($content['categories']) && is_array($content['categories']) ? $content['categories'] : [];
        $expenses = isset($content['expenses']) && is_array($content['expenses']) ? $content['expenses'] : [];
        $pettyCash = isset($content['pettyCash']) && is_array($content['pettyCash']) ? $content['pettyCash'] : [];

        // غیرفعال کردن محدودیت‌های SQL_SAFE_UPDATES تا عملیات DELETE به طور کامل در تمام هاست‌ها اجرا شود
        @$mysqli->query("SET SQL_SAFE_UPDATES = 0");
        @$mysqli->query("SET FOREIGN_KEY_CHECKS = 0");

        // آغاز تراکنش امن
        $mysqli->begin_transaction();

        try {
            // ۱. بروزرسانی دسته‌بندی‌ها در صورت وجود
            if (!empty($categories)) {
                $mysqli->query("DELETE FROM `kharjyar_categories` WHERE `id` <> ''");
                $mysqli->query("DELETE FROM `kharjyar_categories`");
                $catStmt = $mysqli->prepare("REPLACE INTO `kharjyar_categories` (`id`, `name`, `icon`, `color`, `is_default`) VALUES (?, ?, ?, ?, ?)");
                if ($catStmt) {
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
            }

            // ۲. حذف کامل هزینه‌های پاک‌شده و درج لیست جدید هزینه‌ها
            $mysqli->query("DELETE FROM `kharjyar_expenses` WHERE `id` <> ''");
            $mysqli->query("DELETE FROM `kharjyar_expenses`");
            if (!empty($expenses)) {
                $expStmt = $mysqli->prepare("REPLACE INTO `kharjyar_expenses` (`id`, `title`, `amount`, `category_id`, `date`, `note`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                if ($expStmt) {
                    foreach ($expenses as $exp) {
                        $eId = (string)($exp['id'] ?? '');
                        $eTitle = (string)($exp['title'] ?? '');
                        $eAmount = (int)($exp['amount'] ?? 0);
                        $eCatId = (string)($exp['categoryId'] ?? 'cat_other');
                        $eDate = (string)($exp['date'] ?? date('Y-m-d'));
                        $eNote = isset($exp['note']) && $exp['note'] !== '' ? (string)$exp['note'] : null;
                        $eCreatedAt = safeMysqlDateTime($exp['createdAt'] ?? null);
                        $eUpdatedAt = safeMysqlDateTime($exp['updatedAt'] ?? null);

                        if ($eId && $eTitle && $eAmount > 0) {
                            $expStmt->bind_param("ssisssss", $eId, $eTitle, $eAmount, $eCatId, $eDate, $eNote, $eCreatedAt, $eUpdatedAt);
                            $expStmt->execute();
                        }
                    }
                    $expStmt->close();
                }
            }

            // ۳. بروزرسانی موجودی پایه تنخواه
            $initialBalance = (int)($pettyCash['initialBalance'] ?? 0);
            $pettyNow = date('Y-m-d H:i:s');
            $mysqli->query("REPLACE INTO `kharjyar_petty_cash` (`id`, `initial_balance`, `updated_at`) VALUES (1, {$initialBalance}, '{$pettyNow}')");

            // ۴. بروزرسانی دقیق تاریخچه و شارژهای تنخواه (حذف قطعی واریزی‌های پاک‌شده)
            $rawHistory = isset($pettyCash['history']) && is_array($pettyCash['history']) ? $pettyCash['history'] : [];
            $hasRechargesArray = isset($pettyCash['recharges']) && is_array($pettyCash['recharges']);
            $rechargesList = $hasRechargesArray ? $pettyCash['recharges'] : [];

            $historyItems = [];
            if ($hasRechargesArray) {
                // فقط رویدادهای غیرشارژ را از تاریخچه نگه می‌داریم و لیست شارژهای فعال را مستقیماً از recharges می‌سازیم
                foreach ($rawHistory as $h) {
                    if (isset($h['type']) && $h['type'] !== 'recharge') {
                        $historyItems[] = $h;
                    }
                }
                foreach ($rechargesList as $r) {
                    $historyItems[] = [
                        'id' => $r['id'] ?? uniqid('rech_'),
                        'type' => 'recharge',
                        'amount' => $r['amount'] ?? 0,
                        'previousBalance' => null,
                        'newBalance' => null,
                        'date' => $r['date'] ?? date('Y-m-d'),
                        'note' => $r['note'] ?? null,
                        'createdAt' => $r['createdAt'] ?? date('c'),
                    ];
                }
            } else {
                $historyItems = $rawHistory;
            }

            $mysqli->query("DELETE FROM `kharjyar_petty_cash_history` WHERE `id` <> ''");
            $mysqli->query("DELETE FROM `kharjyar_petty_cash_history`");
            if (!empty($historyItems)) {
                $histStmt = $mysqli->prepare("REPLACE INTO `kharjyar_petty_cash_history` (`id`, `type`, `amount`, `previous_balance`, `new_balance`, `date`, `note`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                if ($histStmt) {
                    foreach ($historyItems as $h) {
                        $hId = (string)($h['id'] ?? uniqid('pevt_'));
                        $hType = (string)($h['type'] ?? 'recharge');
                        $hAmount = (int)($h['amount'] ?? 0);
                        $hPrev = isset($h['previousBalance']) ? (int)$h['previousBalance'] : null;
                        $hNew = isset($h['newBalance']) ? (int)$h['newBalance'] : null;
                        $hDate = (string)($h['date'] ?? date('Y-m-d'));
                        $hNote = isset($h['note']) && $h['note'] !== '' ? (string)$h['note'] : null;
                        $hCreatedAt = safeMysqlDateTime($h['createdAt'] ?? null);

                        $histStmt->bind_param("ssiiisss", $hId, $hType, $hAmount, $hPrev, $hNew, $hDate, $hNote, $hCreatedAt);
                        $histStmt->execute();
                    }
                    $histStmt->close();
                }
            }

            // ثبت قطعی تراکنش
            $mysqli->commit();

            sendResponse('success', 'اطلاعات با موفقیت در دیتابیس MySQL هاست ذخیره گردید ✅', [
                'syncedExpenses' => count($expenses),
                'syncedCategories' => count($categories),
                'syncedHistory' => count($historyItems),
                'pettyCashBalance' => $initialBalance,
                'syncedAt' => date('c'),
            ]);

        } catch (Throwable $e) {
            $mysqli->rollback();
            sendResponse('error', 'خطا در ذخیره‌سازی داده‌ها: ' . $e->getMessage(), null, 200);
        }
        break;

    default:
        sendResponse('error', 'عملیات نامعتبر است: ' . htmlspecialchars($action), [
            'available_actions' => ['status', 'get_all', 'sync_all']
        ], 200);
        break;
}
