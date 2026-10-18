import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

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

// Database storage directory & file
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

// Ensure data folder and database.json exist
function ensureDatabaseFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDbState();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      console.log('Created fresh database.json at', DB_FILE);
    }
  } catch (err) {
    console.error('Error initializing database file:', err);
  }
}

ensureDatabaseFile();

function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      ensureDatabaseFile();
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return getInitialDbState();
  }
}

function writeDatabase(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const safeData = {
      ...data,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    // Atomic write via temp file
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(safeData, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health / Status endpoint
app.get('/api/status', (req, res) => {
  const db = readDatabase();
  const expenses = Array.isArray(db.expenses) ? db.expenses : [];
  const categories = Array.isArray(db.categories) ? db.categories : [];
  const totalAmount = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

  res.json({
    status: 'success',
    message: 'اتصال به پایگاه داده ابری خرجیار برقرار است ✅',
    serverTime: new Date().toISOString(),
    data: {
      expensesCount: expenses.length,
      categoriesCount: categories.length,
      totalExpensesToman: totalAmount,
      pettyCashBalance: db.pettyCash?.initialBalance || 0,
      updatedAt: db.updatedAt || new Date().toISOString(),
    },
  });
});

// Fetch all database records
app.get('/api/data', (req, res) => {
  const db = readDatabase();
  res.json({
    status: 'success',
    message: 'اطلاعات با موفقیت از پایگاه‌داده مرکزی دریافت شد.',
    serverTime: new Date().toISOString(),
    data: db,
  });
});

// Transactional Bulk Sync endpoint (matches both /api/sync_all and api.php?action=sync_all)
app.post(['/api/sync_all', '/api/data'], (req, res) => {
  try {
    const body = req.body;
    const payload = body?.data || body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'فرمت اطلاعات ارسالی نامعتبر است.',
      });
    }

    const currentDb = readDatabase();

    const newCategories = Array.isArray(payload.categories) && payload.categories.length > 0
      ? payload.categories
      : currentDb.categories || DEFAULT_CATEGORIES;

    const newExpenses = Array.isArray(payload.expenses)
      ? payload.expenses
      : currentDb.expenses || [];

    const newPettyCash = payload.pettyCash && typeof payload.pettyCash === 'object'
      ? payload.pettyCash
      : currentDb.pettyCash || { initialBalance: 0, recharges: [], history: [] };

    const toSave = {
      version: 1,
      categories: newCategories,
      expenses: newExpenses,
      pettyCash: newPettyCash,
      updatedAt: new Date().toISOString(),
    };

    const saved = writeDatabase(toSave);
    if (!saved) {
      return res.status(500).json({
        status: 'error',
        message: 'خطا در ثبت اطلاعات روی دیسک سرور رخ داد.',
      });
    }

    res.json({
      status: 'success',
      message: 'همگام‌سازی اطلاعات در پایگاه‌داده با موفقیت انجام شد ✅',
      data: {
        syncedExpenses: newExpenses.length,
        syncedCategories: newCategories.length,
        updatedAt: toSave.updatedAt,
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
app.all('/api.php', (req, res) => {
  const action = req.query.action || 'status';
  if (action === 'status') {
    const db = readDatabase();
    return res.json({
      status: 'success',
      message: 'پل ارتباطی دیتابیس در دسترس است.',
      data: {
        categories: db.categories?.length || 0,
        expenses: db.expenses?.length || 0,
      },
    });
  }
  if (action === 'get_all') {
    const db = readDatabase();
    return res.json({
      status: 'success',
      data: db,
    });
  }
  if (action === 'sync_all' && req.method === 'POST') {
    const body = req.body;
    const payload = body?.data || body;
    writeDatabase(payload);
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
