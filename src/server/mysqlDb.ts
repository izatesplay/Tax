import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql, { Pool } from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_FILE = path.resolve(DATA_DIR, 'mysql-config.json');

export interface MysqlConfig {
  enabled: boolean;
  host: string;
  user: string;
  password?: string;
  database: string;
  port: number;
}

const DEFAULT_CONFIG: MysqlConfig = {
  enabled: process.env.MYSQL_ENABLED === 'true' || Boolean(process.env.DB_HOST),
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'kharjyar_db',
  port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10),
};

export function loadMysqlConfig(): MysqlConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Error reading mysql config:', err);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveMysqlConfig(config: Partial<MysqlConfig>): MysqlConfig {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = loadMysqlConfig();
    const updated: MysqlConfig = {
      ...current,
      ...config,
      port: config.port ? Number(config.port) : current.port,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Error saving mysql config:', err);
    throw err;
  }
}

let activePool: Pool | null = null;
let activePoolConfigKey = '';

export function getMysqlPool(config?: MysqlConfig): Pool | null {
  const cfg = config || loadMysqlConfig();
  if (!cfg.enabled) {
    return null;
  }

  const configKey = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.database}:${cfg.password || ''}`;
  if (activePool && activePoolConfigKey === configKey) {
    return activePool;
  }

  try {
    activePool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      connectTimeout: 5000,
    });
    activePoolConfigKey = configKey;
    return activePool;
  } catch (err) {
    console.error('Failed to create MySQL pool:', err);
    return null;
  }
}

export async function testMysqlConnection(config: MysqlConfig): Promise<{ ok: boolean; message: string; details?: any }> {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password || '',
      database: config.database,
      connectTimeout: 5000,
    });

    const [rows] = await conn.query('SELECT 1 + 1 AS solution, VERSION() AS mysqlVersion');
    await conn.end();

    return {
      ok: true,
      message: 'اتصال به پایگاه‌داده MySQL با موفقیت برقرار شد ✅',
      details: rows,
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch {}
    }
    return {
      ok: false,
      message: `خطا در اتصال به MySQL: ${err.message || 'مشکل در برقراری ارتباط'}`,
    };
  }
}

export async function initMysqlTables(pool: Pool) {
  try {
    // Categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`kharjyar_categories\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`icon\` VARCHAR(50) NOT NULL DEFAULT 'Tag',
        \`color\` VARCHAR(30) NOT NULL DEFAULT '#10B981',
        \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`kharjyar_expenses\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`amount\` BIGINT UNSIGNED NOT NULL,
        \`category_id\` VARCHAR(64) NOT NULL,
        \`date\` DATE NOT NULL,
        \`note\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL,
        \`updated_at\` DATETIME NOT NULL,
        INDEX \`idx_date\` (\`date\`),
        INDEX \`idx_category\` (\`category_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Petty cash config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`kharjyar_petty_cash\` (
        \`id\` INT NOT NULL PRIMARY KEY DEFAULT 1,
        \`initial_balance\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
        \`updated_at\` DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Petty cash history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`kharjyar_petty_cash_history\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`type\` VARCHAR(32) NOT NULL DEFAULT 'recharge',
        \`amount\` BIGINT NOT NULL DEFAULT 0,
        \`previous_balance\` BIGINT DEFAULT 0,
        \`new_balance\` BIGINT DEFAULT 0,
        \`date\` DATE NOT NULL,
        \`note\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL,
        INDEX \`idx_history_date\` (\`date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default categories if empty
    const [catRows]: any = await pool.query('SELECT COUNT(*) AS total FROM `kharjyar_categories`');
    if (catRows && catRows[0]?.total === 0) {
      const defaults = [
        ['cat_food', 'خوراک', 'Utensils', '#10B981', 1],
        ['cat_transport', 'رفت‌وآمد', 'Car', '#3B82F6', 1],
        ['cat_shopping', 'خرید', 'ShoppingBag', '#EC4899', 1],
        ['cat_bills', 'خانه و قبوض', 'Home', '#F59E0B', 1],
        ['cat_health', 'سلامت', 'HeartPulse', '#EF4444', 1],
        ['cat_entertainment', 'تفریح', 'Sparkles', '#8B5CF6', 1],
        ['cat_education', 'آموزش', 'GraduationCap', '#06B6D4', 1],
        ['cat_other', 'سایر', 'MoreHorizontal', '#64748B', 1],
      ];
      for (const item of defaults) {
        await pool.query(
          'INSERT INTO `kharjyar_categories` (`id`, `name`, `icon`, `color`, `is_default`) VALUES (?, ?, ?, ?, ?)',
          item
        );
      }
    }

    // Seed petty cash row if empty
    const [pettyRows]: any = await pool.query('SELECT COUNT(*) AS total FROM `kharjyar_petty_cash` WHERE `id` = 1');
    if (pettyRows && pettyRows[0]?.total === 0) {
      await pool.query(
        'INSERT INTO `kharjyar_petty_cash` (`id`, `initial_balance`, `updated_at`) VALUES (1, 0, NOW())'
      );
    }
  } catch (err) {
    console.error('Error creating MySQL tables:', err);
    throw err;
  }
}

export async function fetchAllFromMysql(pool: Pool) {
  // Fetch categories
  const [catRows]: any = await pool.query(
    'SELECT `id`, `name`, `icon`, `color`, `is_default` FROM `kharjyar_categories` ORDER BY `is_default` DESC, `name` ASC'
  );
  const categories = (catRows || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    isDefault: Boolean(row.is_default),
  }));

  // Fetch expenses
  const [expRows]: any = await pool.query(
    'SELECT `id`, `title`, `amount`, `category_id`, DATE_FORMAT(`date`, "%Y-%m-%d") AS `date`, `note`, `created_at`, `updated_at` FROM `kharjyar_expenses` ORDER BY `date` DESC, `created_at` DESC'
  );
  const expenses = (expRows || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    categoryId: row.category_id,
    date: row.date,
    note: row.note || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));

  // Fetch petty cash
  const [pettyRows]: any = await pool.query(
    'SELECT `initial_balance`, `updated_at` FROM `kharjyar_petty_cash` WHERE `id` = 1'
  );
  const pettyRow = pettyRows?.[0] || { initial_balance: 0, updated_at: new Date() };

  // Fetch history
  const [histRows]: any = await pool.query(
    'SELECT `id`, `type`, `amount`, `previous_balance`, `new_balance`, DATE_FORMAT(`date`, "%Y-%m-%d") AS `date`, `note`, `created_at` FROM `kharjyar_petty_cash_history` ORDER BY `date` DESC, `created_at` DESC'
  );

  const history = (histRows || []).map((row: any) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    previousBalance: row.previous_balance !== null ? Number(row.previous_balance) : undefined,
    newBalance: row.new_balance !== null ? Number(row.new_balance) : undefined,
    date: row.date,
    note: row.note || undefined,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  const recharges = history
    .filter((h: any) => h.type === 'recharge')
    .map((h: any) => ({
      id: h.id,
      amount: h.amount,
      date: h.date,
      note: h.note,
      createdAt: h.createdAt,
    }));

  return {
    version: 1,
    categories,
    expenses,
    pettyCash: {
      initialBalance: Number(pettyRow.initial_balance) || 0,
      recharges,
      history,
      updatedAt: new Date(pettyRow.updated_at).toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function syncAllToMysql(pool: Pool, data: any) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const categories = Array.isArray(data.categories) ? data.categories : [];
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const pettyCash = data.pettyCash || {};

    // 1. Categories
    if (categories.length > 0) {
      await conn.query('DELETE FROM `kharjyar_categories`');
      for (const cat of categories) {
        if (cat.id && cat.name) {
          await conn.query(
            'INSERT INTO `kharjyar_categories` (`id`, `name`, `icon`, `color`, `is_default`) VALUES (?, ?, ?, ?, ?)',
            [cat.id, cat.name, cat.icon || 'Tag', cat.color || '#10B981', cat.isDefault ? 1 : 0]
          );
        }
      }
    }

    // 2. Expenses
    await conn.query('DELETE FROM `kharjyar_expenses`');
    for (const exp of expenses) {
      if (exp.id && exp.title && exp.amount > 0) {
        const createdAt = exp.createdAt ? new Date(exp.createdAt) : new Date();
        const updatedAt = exp.updatedAt ? new Date(exp.updatedAt) : new Date();
        await conn.query(
          'INSERT INTO `kharjyar_expenses` (`id`, `title`, `amount`, `category_id`, `date`, `note`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [exp.id, exp.title, exp.amount, exp.categoryId || 'cat_other', exp.date, exp.note || null, createdAt, updatedAt]
        );
      }
    }

    // 3. Petty Cash
    const initialBalance = Number(pettyCash.initialBalance) || 0;
    await conn.query(
      'REPLACE INTO `kharjyar_petty_cash` (`id`, `initial_balance`, `updated_at`) VALUES (1, ?, NOW())',
      [initialBalance]
    );

    // 4. Petty Cash History (strictly sync active recharges from pettyCash.recharges)
    await conn.query('DELETE FROM `kharjyar_petty_cash_history`');
    const rawHistory = Array.isArray(pettyCash.history) ? pettyCash.history : [];
    const hasRecharges = Array.isArray(pettyCash.recharges);
    const historyToSave = hasRecharges
      ? [
          ...rawHistory.filter((h: any) => h && h.type && h.type !== 'recharge'),
          ...pettyCash.recharges.map((r: any) => ({
            id: r.id,
            type: 'recharge',
            amount: r.amount,
            previousBalance: null,
            newBalance: null,
            date: r.date,
            note: r.note,
            createdAt: r.createdAt,
          })),
        ]
      : rawHistory;

    for (const h of historyToSave) {
      if (h.id) {
        const createdAt = h.createdAt ? new Date(h.createdAt) : new Date();
        await conn.query(
          'REPLACE INTO `kharjyar_petty_cash_history` (`id`, `type`, `amount`, `previous_balance`, `new_balance`, `date`, `note`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [h.id, h.type || 'recharge', h.amount || 0, h.previousBalance ?? null, h.newBalance ?? null, h.date, h.note || null, createdAt]
        );
      }
    }

    await conn.commit();
    return {
      syncedExpenses: expenses.length,
      syncedCategories: categories.length,
      syncedHistory: historyToSave.length,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
