import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  loadMysqlConfig,
  saveMysqlConfig,
  getMysqlPool,
  testMysqlConnection,
  initMysqlTables,
  fetchAllFromMysql,
  syncAllToMysql,
} from './src/server/mysqlDb.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable JSON body parsing with large limit for backup/sync
app.use(express.json({ limit: '20mb' }));

// CORS headers for all API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON fallback database storage directory & file
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

const DEFAULT_CATEGORIES = [
  { id: 'cat_food', name: 'خوراک', icon: 'Utensils', color: '#10B981', isDefault: true },
  { id: 'cat_transport', name: 'رفت‌وآمد', icon: 'Car', color: '#3B82F6', isDefault: true },
  { id: 'cat_shopping', name: 'خرید', icon: 'ShoppingBag', color: '#EC4899', isDefault: true },
  { id: 'cat_bills', name: 'خانه و قبوض', icon: 'Home', color: '#F59E0B', isDefault: true },
  { id: 'cat_health', name: 'سلامت', icon: 'HeartPulse', color: '#EF4444', isDefault: true },
  { id: 'cat_entertainment', name: 'تفریح', icon: 'Sparkles', color: '#8B5CF6', isDefault: true },
  { id: 'cat_education', name: 'آموزش', icon: 'GraduationCap', color: '#06B6D4', isDefault: true },
  { id: 'cat_other', name: 'سایر', icon: 'MoreHorizontal', color: '#64748B', isDefault: true },
];

function getInitialDbState() {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    expenses: [],
    pettyCash: {
      initialBalance: 0,
      recharges: [],
      history: [],
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

function ensureDatabaseFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDbState();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error initializing fallback database file:', err);
  }
}

ensureDatabaseFile();

function readFallbackDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      ensureDatabaseFile();
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading fallback database file:', err);
    return getInitialDbState();
  }
}

function writeFallbackDatabase(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const safeData = {
      ...data,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(safeData, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error writing fallback database file:', err);
    return false;
  }
}

// Initialize MySQL if configured
async function checkAndInitMysql() {
  const cfg = loadMysqlConfig();
  if (cfg.enabled) {
    try {
      const pool = getMysqlPool(cfg);
      if (pool) {
        await initMysqlTables(pool);
        console.log(`✅ Connected to MySQL database "${cfg.database}" on ${cfg.host}:${cfg.port}`);
      }
    } catch (err: any) {
      console.warn('⚠️ MySQL enabled but initialization failed, falling back to local store:', err.message);
    }
  }
}

checkAndInitMysql();

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// MySQL Configuration & Test APIs
app.get('/api/mysql/config', (req, res) => {
  const cfg = loadMysqlConfig();
  res.json({
    status: 'success',
    config: {
      enabled: cfg.enabled,
      host: cfg.host,
      user: cfg.user,
      database: cfg.database,
      port: cfg.port,
      hasPassword: Boolean(cfg.password),
    },
  });
});

app.post('/api/mysql/test', async (req, res) => {
  const body = req.body || {};
  const current = loadMysqlConfig();
  const testCfg = {
    enabled: true,
    host: body.host || current.host,
    user: body.user || current.user,
    password: body.password !== undefined ? body.password : current.password,
    database: body.database || current.database,
    port: parseInt(body.port || current.port || 3306, 10),
  };

  const result = await testMysqlConnection(testCfg);
  res.json({
    status: result.ok ? 'success' : 'error',
    message: result.message,
    details: result.details,
  });
});

app.post('/api/mysql/config', async (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveMysqlConfig({
      enabled: body.enabled !== false,
      host: body.host,
      user: body.user,
      password: body.password,
      database: body.database,
      port: body.port ? parseInt(body.port, 10) : 3306,
    });

    // Test and initialize tables
    const pool = getMysqlPool(updated);
    if (pool && updated.enabled) {
      await initMysqlTables(pool);
      // Migrate fallback data to MySQL if MySQL was empty
      const currentDb = readFallbackDatabase();
      if (currentDb.expenses && currentDb.expenses.length > 0) {
        await syncAllToMysql(pool, currentDb);
      }
    }

    res.json({
      status: 'success',
      message: 'تنظیمات دیتابیس MySQL با موفقیت ذخیره و فعال شد ✅',
      config: {
        enabled: updated.enabled,
        host: updated.host,
        user: updated.user,
        database: updated.database,
        port: updated.port,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: `خطا در تنظیم دیتابیس MySQL: ${err.message}`,
    });
  }
});

// Health / Status endpoint
app.get('/api/status', async (req, res) => {
  const mysqlCfg = loadMysqlConfig();
  const pool = getMysqlPool(mysqlCfg);

  if (mysqlCfg.enabled && pool) {
    try {
      const mysqlData = await fetchAllFromMysql(pool);
      const expenses = mysqlData.expenses;
      const totalAmount = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

      return res.json({
        status: 'success',
        engine: 'mysql',
        message: 'اتصال به پایگاه‌داده MySQL خرجیار فعال است ✅',
        serverTime: new Date().toISOString(),
        data: {
          database: mysqlCfg.database,
          host: mysqlCfg.host,
          expensesCount: expenses.length,
          categoriesCount: mysqlData.categories.length,
          totalExpensesToman: totalAmount,
          pettyCashBalance: mysqlData.pettyCash?.initialBalance || 0,
          updatedAt: mysqlData.updatedAt,
        },
      });
    } catch (err: any) {
      console.warn('MySQL status query failed, using fallback:', err.message);
    }
  }

  // Fallback
  const db = readFallbackDatabase();
  const expenses = Array.isArray(db.expenses) ? db.expenses : [];
  const totalAmount = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

  res.json({
    status: 'success',
    engine: 'local_storage',
    message: 'اتصال به پایگاه داده فعال است ✅',
    serverTime: new Date().toISOString(),
    data: {
      expensesCount: expenses.length,
      categoriesCount: db.categories?.length || 0,
      totalExpensesToman: totalAmount,
      pettyCashBalance: db.pettyCash?.initialBalance || 0,
      updatedAt: db.updatedAt || new Date().toISOString(),
    },
  });
});

// Fetch all database records
app.get('/api/data', async (req, res) => {
  const mysqlCfg = loadMysqlConfig();
  const pool = getMysqlPool(mysqlCfg);

  if (mysqlCfg.enabled && pool) {
    try {
      const mysqlData = await fetchAllFromMysql(pool);
      return res.json({
        status: 'success',
        engine: 'mysql',
        message: 'اطلاعات با موفقیت از دیتابیس MySQL دریافت شد.',
        serverTime: new Date().toISOString(),
        data: mysqlData,
      });
    } catch (err: any) {
      console.warn('MySQL fetch failed, using fallback store:', err.message);
    }
  }

  const db = readFallbackDatabase();
  res.json({
    status: 'success',
    engine: 'local_storage',
    message: 'اطلاعات با موفقیت از پایگاه‌داده دریافت شد.',
    serverTime: new Date().toISOString(),
    data: db,
  });
});

// Transactional Bulk Sync endpoint (matches both /api/sync_all and api.php?action=sync_all)
app.post(['/api/sync_all', '/api/data'], async (req, res) => {
  try {
    const body = req.body;
    const payload = body?.data || body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'فرمت اطلاعات ارسالی نامعتبر است.',
      });
    }

    // Always update fallback database for redundancy
    writeFallbackDatabase(payload);

    // If MySQL is enabled, execute atomic transactional sync to MySQL
    const mysqlCfg = loadMysqlConfig();
    const pool = getMysqlPool(mysqlCfg);

    if (mysqlCfg.enabled && pool) {
      try {
        const syncResult = await syncAllToMysql(pool, payload);
        return res.json({
          status: 'success',
          engine: 'mysql',
          message: 'تغییرات با موفقیت روی پایگاه‌داده MySQL ذخیره شد ✅',
          data: {
            ...syncResult,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (err: any) {
        console.error('MySQL sync error:', err);
        return res.status(500).json({
          status: 'error',
          message: `خطا در همگام‌سازی با MySQL: ${err.message}`,
        });
      }
    }

    res.json({
      status: 'success',
      engine: 'local_storage',
      message: 'همگام‌سازی اطلاعات در پایگاه‌داده با موفقیت انجام شد ✅',
      data: {
        syncedExpenses: payload.expenses?.length || 0,
        syncedCategories: payload.categories?.length || 0,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error?.message || 'خطای سرور در همگام‌سازی',
    });
  }
});

// Fallback compatibility route for ?action=...
app.all('/api.php', async (req, res) => {
  const action = req.query.action || 'status';
  const mysqlCfg = loadMysqlConfig();
  const pool = getMysqlPool(mysqlCfg);

  if (action === 'status') {
    if (mysqlCfg.enabled && pool) {
      try {
        const data = await fetchAllFromMysql(pool);
        return res.json({
          status: 'success',
          engine: 'mysql',
          message: 'اتصال به دیتابیس MySQL برقرار است.',
          data: {
            database: mysqlCfg.database,
            categories: data.categories.length,
            expenses: data.expenses.length,
          },
        });
      } catch {}
    }
    const db = readFallbackDatabase();
    return res.json({
      status: 'success',
      engine: 'local_storage',
      message: 'پل ارتباطی دیتابیس در دسترس است.',
      data: {
        categories: db.categories?.length || 0,
        expenses: db.expenses?.length || 0,
      },
    });
  }

  if (action === 'get_all') {
    if (mysqlCfg.enabled && pool) {
      try {
        const data = await fetchAllFromMysql(pool);
        return res.json({
          status: 'success',
          engine: 'mysql',
          data,
        });
      } catch {}
    }
    const db = readFallbackDatabase();
    return res.json({
      status: 'success',
      data: db,
    });
  }

  if (action === 'sync_all' && req.method === 'POST') {
    const body = req.body;
    const payload = body?.data || body;
    writeFallbackDatabase(payload);
    if (mysqlCfg.enabled && pool) {
      try {
        await syncAllToMysql(pool, payload);
      } catch {}
    }
    return res.json({
      status: 'success',
      message: 'همگام‌سازی موفقیت‌آمیز بود.',
    });
  }

  res.status(404).json({ status: 'error', message: 'Action not supported' });
});

// -------------------------------------------------------------
// Vite middleware in dev / Static file serving in prod
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KharjYar Server is running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
