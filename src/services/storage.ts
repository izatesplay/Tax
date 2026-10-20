import { Category, Expense, KharjYarStorageData, PettyCashConfig, PettyCashEvent } from '../types';
import { formatJalaliDateFull, formatJalaliDateShort, isoToJalali } from '../utils/jalali';
import { formatThousandsPersian } from '../utils/formatters';

const STORAGE_KEY = 'kharjyar_data_v1';
const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'خوراک', icon: 'Utensils', color: '#10B981', isDefault: true },
  { id: 'cat_transport', name: 'رفت‌وآمد', icon: 'Car', color: '#3B82F6', isDefault: true },
  { id: 'cat_shopping', name: 'خرید', icon: 'ShoppingBag', color: '#EC4899', isDefault: true },
  { id: 'cat_bills', name: 'خانه و قبوض', icon: 'Home', color: '#F59E0B', isDefault: true },
  { id: 'cat_health', name: 'سلامت', icon: 'HeartPulse', color: '#EF4444', isDefault: true },
  { id: 'cat_entertainment', name: 'تفریح', icon: 'Sparkles', color: '#8B5CF6', isDefault: true },
  { id: 'cat_education', name: 'آموزش', icon: 'GraduationCap', color: '#06B6D4', isDefault: true },
  { id: 'cat_other', name: 'سایر', icon: 'MoreHorizontal', color: '#64748B', isDefault: true },
];

export const DEFAULT_PETTY_CASH: PettyCashConfig = {
  initialBalance: 0,
  recharges: [],
  history: [],
  updatedAt: new Date().toISOString(),
};

/**
 * Generates a unique ID
 */
export function generateUniqueId(prefix = 'exp'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Keeps pettyCash.recharges and pettyCash.history strictly synchronized
 * so deleted recharges never remain orphaned in history or reappear after refresh.
 */
export function normalizePettyCash(rawPettyCash?: Partial<PettyCashConfig> | null): PettyCashConfig {
  if (!rawPettyCash || typeof rawPettyCash !== 'object') {
    return { ...DEFAULT_PETTY_CASH, updatedAt: new Date().toISOString() };
  }

  const initialBalance =
    typeof rawPettyCash.initialBalance === 'number' && rawPettyCash.initialBalance >= 0
      ? rawPettyCash.initialBalance
      : 0;

  const recharges = Array.isArray(rawPettyCash.recharges)
    ? rawPettyCash.recharges.map((r: any) => ({
        id: r.id || generateUniqueId('rech'),
        amount: Number(r.amount) || 0,
        date: r.date || new Date().toISOString().slice(0, 10),
        note: r.note || undefined,
        createdAt: r.createdAt || new Date().toISOString(),
      }))
    : [];

  // Keep only non-recharge events from history, and rebuild recharge events from active recharges
  const rawHistory = Array.isArray(rawPettyCash.history) ? rawPettyCash.history : [];
  const nonRechargeEvents: PettyCashEvent[] = rawHistory.filter(
    (h: any) => h && h.type && h.type !== 'recharge'
  );

  const rechargeEvents: PettyCashEvent[] = recharges.map((r) => ({
    id: r.id,
    type: 'recharge' as const,
    amount: r.amount,
    date: r.date,
    note: r.note,
    createdAt: r.createdAt,
  }));

  const mergedHistory = [...rechargeEvents, ...nonRechargeEvents].sort((a, b) => {
    if (a.date !== b.date) {
      return (b.date || '').localeCompare(a.date || '');
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  return {
    initialBalance,
    recharges,
    history: mergedHistory,
    updatedAt: rawPettyCash.updatedAt || new Date().toISOString(),
  };
}

/**
 * Loads data safely from localStorage
 */
export function loadStorageData(): KharjYarStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First run: Empty expenses, default categories, zero petty cash
      const initialData: KharjYarStorageData = {
        version: CURRENT_SCHEMA_VERSION,
        expenses: [],
        categories: [...DEFAULT_CATEGORIES],
        pettyCash: { ...DEFAULT_PETTY_CASH },
        updatedAt: new Date().toISOString(),
      };
      saveStorageData(initialData);
      return initialData;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('ساختار اطلاعات ذخیره‌شده نامعتبر است.');
    }

    // Ensure categories exists and has at least defaults if empty
    const categories: Category[] = Array.isArray(parsed.categories) && parsed.categories.length > 0
      ? parsed.categories
      : [...DEFAULT_CATEGORIES];

    // Ensure expenses is array
    const expenses: Expense[] = Array.isArray(parsed.expenses) ? parsed.expenses : [];

    // Ensure pettyCash is normalized so recharges and history match 1-to-1
    const pettyCash: PettyCashConfig = normalizePettyCash(parsed.pettyCash);

    return {
      version: parsed.version || CURRENT_SCHEMA_VERSION,
      expenses,
      categories,
      pettyCash,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    // Return empty fallback without overwriting existing broken state blindly
    return {
      version: CURRENT_SCHEMA_VERSION,
      expenses: [],
      categories: [...DEFAULT_CATEGORIES],
      pettyCash: { ...DEFAULT_PETTY_CASH },
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Saves data safely to localStorage
 */
export function saveStorageData(data: KharjYarStorageData): { success: boolean; error?: string } {
  try {
    const toSave: KharjYarStorageData = {
      ...data,
      pettyCash: normalizePettyCash(data.pettyCash),
      version: CURRENT_SCHEMA_VERSION,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
    const serialized = JSON.stringify(toSave);
    localStorage.setItem(STORAGE_KEY, serialized);
    return { success: true };
  } catch (error: any) {
    console.error('Error saving data to localStorage:', error);
    if (error?.name === 'QuotaExceededError' || error?.code === 22) {
      return { success: false, error: 'حافظه مرورگر پر شده است. لطفاً فضای ذخیره‌سازی را خالی کنید.' };
    }
    return { success: false, error: 'خطا در ذخیره‌سازی اطلاعات روی مرورگر رخ داد.' };
  }
}

/**
 * Export JSON backup file
 */
export function exportBackupJson(data: KharjYarStorageData): void {
  const exportPayload = {
    appName: 'KharjYar',
    exportDate: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: {
      expenses: data.expenses,
      categories: data.categories,
      pettyCash: data.pettyCash,
      updatedAt: data.updatedAt,
    },
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kharjyar_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validation result for backup JSON import
 */
export interface ImportValidationResult {
  isValid: boolean;
  error?: string;
  expenseCount: number;
  categoryCount: number;
  parsedData?: KharjYarStorageData;
}

/**
 * Validates JSON structure before restoring
 */
export function validateBackupJson(jsonString: string): ImportValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'فایل انتخابی یک JSON معتبر نیست.', expenseCount: 0, categoryCount: 0 };
    }

    // Determine payload structure (support direct structure or wrapped under .data)
    const payload = parsed.data || parsed;

    if (!payload || typeof payload !== 'object') {
      return { isValid: false, error: 'محتوای پشتیبان ناقص است.', expenseCount: 0, categoryCount: 0 };
    }

    if (!Array.isArray(payload.expenses)) {
      return { isValid: false, error: 'فهرست هزینه‌ها در فایل پشتیبان یافت نشد.', expenseCount: 0, categoryCount: 0 };
    }

    if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
      return { isValid: false, error: 'دسته‌بندی‌ها در فایل پشتیبان یافت نشدند.', expenseCount: 0, categoryCount: 0 };
    }

    // Validate categories
    const categoryIds = new Set<string>();
    for (const cat of payload.categories) {
      if (!cat.id || !cat.name || typeof cat.name !== 'string' || cat.name.trim().length === 0) {
        return { isValid: false, error: 'یکی از دسته‌بندی‌های فایل پشتیبان دارای نام نامعتبر است.', expenseCount: 0, categoryCount: 0 };
      }
      categoryIds.add(cat.id);
    }

    // Validate expenses
    for (const exp of payload.expenses) {
      if (!exp.id || typeof exp.id !== 'string') {
        return { isValid: false, error: 'شناسه یکی از هزینه‌ها نامعتبر است.', expenseCount: 0, categoryCount: 0 };
      }
      if (!exp.title || typeof exp.title !== 'string' || exp.title.trim().length === 0) {
        return { isValid: false, error: 'عنوان یکی از هزینه‌ها خالی است.', expenseCount: 0, categoryCount: 0 };
      }
      if (typeof exp.amount !== 'number' || exp.amount <= 0 || !Number.isSafeInteger(exp.amount)) {
        return { isValid: false, error: 'مبلغ یکی از هزینه‌ها نامعتبر است (باید عدد صحیح مثبت باشد).', expenseCount: 0, categoryCount: 0 };
      }
      if (!exp.date || typeof exp.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(exp.date)) {
        return { isValid: false, error: 'تاریخ یکی از هزینه‌ها نامعتبر است (باید با فرمت استاندارد YYYY-MM-DD باشد).', expenseCount: 0, categoryCount: 0 };
      }
      // If categoryId doesn't exist, we can fallback to 'cat_other'
      if (!categoryIds.has(exp.categoryId)) {
        exp.categoryId = 'cat_other';
      }
    }

    // Validate petty cash if exists
    let pettyCashHistory: PettyCashEvent[] = [];
    if (payload.pettyCash && Array.isArray(payload.pettyCash.history)) {
      pettyCashHistory = payload.pettyCash.history;
    } else if (payload.pettyCash && Array.isArray(payload.pettyCash.recharges)) {
      pettyCashHistory = payload.pettyCash.recharges.map((r: any) => ({
        id: r.id || generateUniqueId('pevt'),
        type: 'recharge' as const,
        amount: r.amount,
        date: r.date,
        note: r.note,
        createdAt: r.createdAt || new Date().toISOString(),
      }));
    }

    const pettyCash: PettyCashConfig = payload.pettyCash && typeof payload.pettyCash === 'object'
      ? {
          initialBalance: typeof payload.pettyCash.initialBalance === 'number' && payload.pettyCash.initialBalance >= 0 ? payload.pettyCash.initialBalance : 0,
          recharges: Array.isArray(payload.pettyCash.recharges) ? payload.pettyCash.recharges : [],
          history: pettyCashHistory,
          updatedAt: payload.pettyCash.updatedAt || new Date().toISOString(),
        }
      : { ...DEFAULT_PETTY_CASH };

    const validatedData: KharjYarStorageData = {
      version: CURRENT_SCHEMA_VERSION,
      expenses: payload.expenses,
      categories: payload.categories,
      pettyCash,
      updatedAt: new Date().toISOString(),
    };

    return {
      isValid: true,
      expenseCount: payload.expenses.length,
      categoryCount: payload.categories.length,
      parsedData: validatedData,
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `خطا در خواندن فایل: ${error?.message || 'فرمت فایل معتبر نیست'}`,
      expenseCount: 0,
      categoryCount: 0,
    };
  }
}

/**
 * Calculates current petty cash overview
 */
export function calculatePettyCashSummary(
  pettyCash: KharjYarStorageData['pettyCash'],
  expenses: Expense[]
) {
  const initial = pettyCash.initialBalance || 0;
  const recharges = pettyCash.recharges || [];
  const totalRecharged = recharges.reduce((sum, r) => sum + r.amount, 0);
  const totalAllocated = initial + totalRecharged;
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = totalAllocated - totalSpent;
  const isConfigured = totalAllocated > 0;
  const spentPercentage = totalAllocated > 0 ? Math.min((totalSpent / totalAllocated) * 100, 100) : 0;
  const isDeficit = remainingBalance < 0;

  return {
    initial,
    recharges,
    totalRecharged,
    totalAllocated,
    totalSpent,
    remainingBalance,
    isConfigured,
    spentPercentage,
    isDeficit,
  };
}

/**
 * Export CSV file with UTF-8 BOM for Persian Excel support
 */
export function exportExpensesCsv(expenses: Expense[], categories: Category[]): void {
  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name);
  }

  // UTF-8 BOM
  const BOM = '\uFEFF';

  // Headers in Persian
  const headers = [
    'شناسه',
    'عنوان',
    'مبلغ (تومان)',
    'دسته‌بندی',
    'تاریخ شمسی',
    'تاریخ میلادی',
    'یادداشت',
    'زمان ثبت',
  ];

  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = expenses.map((exp) => {
    const categoryName = categoryMap.get(exp.categoryId) || 'نامشخص';
    const shamsiDate = formatJalaliDateShort(exp.date);
    return [
      escapeCsv(exp.id),
      escapeCsv(exp.title),
      escapeCsv(exp.amount),
      escapeCsv(categoryName),
      escapeCsv(shamsiDate),
      escapeCsv(exp.date),
      escapeCsv(exp.note || ''),
      escapeCsv(exp.createdAt),
    ].join(',');
  });

  const csvContent = BOM + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kharjyar_expenses_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
