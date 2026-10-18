export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault?: boolean;
}

export interface Expense {
  id: string;
  title: string;
  amount: number; // in Tomans (positive integer)
  categoryId: string;
  date: string; // ISO format: YYYY-MM-DD
  note?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface PettyCashRecharge {
  id: string;
  amount: number; // in Tomans (positive integer)
  date: string; // ISO format: YYYY-MM-DD
  note?: string;
  createdAt: string; // ISO string
}

export type PettyCashEventType = 'initial' | 'recharge' | 'set_balance' | 'reset';

export interface PettyCashEvent {
  id: string;
  type: PettyCashEventType;
  amount: number; // in Tomans
  previousBalance?: number;
  newBalance?: number;
  date: string; // ISO format: YYYY-MM-DD
  note?: string;
  createdAt: string; // ISO string
}

export interface PettyCashConfig {
  initialBalance: number; // in Tomans
  recharges: PettyCashRecharge[];
  history: PettyCashEvent[];
  updatedAt?: string;
}

export interface KharjYarStorageData {
  version: number;
  expenses: Expense[];
  categories: Category[];
  pettyCash: PettyCashConfig;
  updatedAt: string;
}

export type TabType = 'home' | 'expenses' | 'reports' | 'settings';

export interface DateFilter {
  type: 'all' | 'this_month' | 'this_week' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface ExpenseFilters {
  searchQuery: string;
  categoryId: string; // 'all' or category id
  dateFilter: DateFilter;
}

export interface JalaliDate {
  jy: number; // Jalali year (e.g. 1405)
  jm: number; // Jalali month (1-12)
  jd: number; // Jalali day (1-31)
}

export type DatabaseMode = 'cloud' | 'cpanel';

export interface DatabaseSettings {
  mode: DatabaseMode;
  cpanelApiUrl: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  mode: DatabaseMode;
}

