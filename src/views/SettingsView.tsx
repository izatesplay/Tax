import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Plus,
  AlertTriangle,
  Check,
  Shield,
  Layers,
  Database,
  Info,
  X,
  Wallet,
  PlusCircle,
  RotateCcw,
  Server,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  FileCode,
} from 'lucide-react';
import { Category, Expense, KharjYarStorageData, PettyCashRecharge, PettyCashEvent } from '../types';
import { CategoryIcon, AVAILABLE_ICONS } from '../components/CategoryIcon';
import {
  exportBackupJson,
  validateBackupJson,
  exportExpensesCsv,
  generateUniqueId,
  calculatePettyCashSummary,
} from '../services/storage';
import { toPersianDigits, formatToman } from '../utils/formatters';
import { formatJalaliDateShort, getTehranToday } from '../utils/jalali';
import {
  getSavedApiEndpoint,
  saveApiEndpoint,
  checkApiStatus,
  syncAllToDatabase,
  fetchAllFromDatabase,
  downloadApiPhpScript,
  ApiStatusResult,
} from '../services/apiBridge';

interface SettingsViewProps {
  data: KharjYarStorageData;
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateAllData: (newData: KharjYarStorageData) => void;
  onClearAllData: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenPettyCashModal: (mode: 'set_balance' | 'recharge') => void;
}

const CATEGORY_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#64748B', // Slate
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  onUpdateCategories,
  onUpdateAllData,
  onClearAllData,
  onShowToast,
  onOpenPettyCashModal,
}) => {
  const pettySummary = calculatePettyCashSummary(data.pettyCash, data.expenses);

  // Delete a specific recharge
  const handleDeleteRecharge = (id: string) => {
    const remaining = (data.pettyCash.recharges || []).filter((r) => r.id !== id);
    const remainingHistory = (data.pettyCash.history || []).filter((h) => h.id !== id);
    onUpdateAllData({
      ...data,
      pettyCash: {
        ...data.pettyCash,
        recharges: remaining,
        history: remainingHistory,
        updatedAt: new Date().toISOString(),
      },
    });
    onShowToast('شارژ مورد نظر با موفقیت حذف شد', 'info');
  };

  // Reset petty cash
  const handleResetPettyCash = () => {
    const todayIso = getTehranToday().iso;
    const nowIso = new Date().toISOString();
    const resetEvent: PettyCashEvent = {
      id: generateUniqueId('pevt'),
      type: 'reset',
      amount: 0,
      previousBalance: data.pettyCash.initialBalance,
      newBalance: 0,
      date: todayIso,
      note: 'صفر کردن و بازنشانی موجودی تنخواه',
      createdAt: nowIso,
    };

    onUpdateAllData({
      ...data,
      pettyCash: {
        initialBalance: 0,
        recharges: [],
        history: [resetEvent, ...(data.pettyCash.history || [])],
        updatedAt: nowIso,
      },
    });
    onShowToast('موجودی تنخواه بازنشانی و صفر شد', 'info');
  };

  // MySQL API Bridge state
  const [apiEndpoint, setApiEndpoint] = useState<string>(() => getSavedApiEndpoint() || '/api.php');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [isPullingApi, setIsPullingApi] = useState(false);
  const [apiStatusResult, setApiStatusResult] = useState<ApiStatusResult | null>(null);
  const [showCpanelGuide, setShowCpanelGuide] = useState(false);

  const handleEndpointChange = (val: string) => {
    setApiEndpoint(val);
    saveApiEndpoint(val);
    setApiStatusResult(null);
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setApiStatusResult(null);
    try {
      const result = await checkApiStatus(apiEndpoint);
      setApiStatusResult(result);
      if (result.ok) {
        onShowToast(result.message, 'success');
      } else {
        onShowToast(result.message, 'error');
      }
    } finally {
      setIsTestingApi(false);
    }
  };

  const handlePushSync = async () => {
    setIsSyncingApi(true);
    try {
      const result = await syncAllToDatabase(apiEndpoint, data);
      if (result.ok) {
        onShowToast(result.message, 'success');
        // refresh status
        const statusRes = await checkApiStatus(apiEndpoint);
        setApiStatusResult(statusRes);
      } else {
        onShowToast(result.message, 'error');
      }
    } finally {
      setIsSyncingApi(false);
    }
  };

  const handlePullSync = async () => {
    if (!confirm('آیا مطمئن هستید؟ اطلاعات موجود روی مرورگر با اطلاعات دریافتی از سرور MySQL جایگزین خواهد شد.')) {
      return;
    }
    setIsPullingApi(true);
    try {
      const result = await fetchAllFromDatabase(apiEndpoint);
      if (result.ok && result.data) {
        onUpdateAllData(result.data);
        onShowToast('اطلاعات با موفقیت از سرور دریافت و جایگزین شد ✅', 'success');
      } else {
        onShowToast(result.message, 'error');
      }
    } finally {
      setIsPullingApi(false);
    }
  };

  // Modal states
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const [catError, setCatError] = useState('');

  // Delete category with replacement state
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [replacementCatId, setReplacementCatId] = useState<string>('');

  // Import JSON backup preview modal
  const [importPendingData, setImportPendingData] = useState<{
    data: KharjYarStorageData;
    expenseCount: number;
    categoryCount: number;
  } | null>(null);

  // Clear all data confirmation modal
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate expense count per category
  const expenseCountPerCat = React.useMemo(() => {
    const map = new Map<string, number>();
    data.expenses.forEach((e) => {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + 1);
    });
    return map;
  }, [data.expenses]);

  // Handle Add Category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) {
      setCatError('نام دسته‌بندی نمی‌تواند خالی باشد.');
      return;
    }

    const isDuplicate = data.categories.some(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      setCatError('دسته‌بندی با این نام از قبل وجود دارد.');
      return;
    }

    const newCat: Category = {
      id: generateUniqueId('cat'),
      name: cleanName,
      icon: newCatIcon,
      color: newCatColor,
      isDefault: false,
    };

    onUpdateCategories([...data.categories, newCat]);
    setIsAddCatOpen(false);
    setNewCatName('');
    setCatError('');
    onShowToast(`دسته‌بندی «${cleanName}» اضافه شد ✅`, 'success');
  };

  // Open Delete Category Modal
  const handleInitiateDeleteCat = (cat: Category) => {
    const count = expenseCountPerCat.get(cat.id) || 0;
    const remainingCats = data.categories.filter((c) => c.id !== cat.id);

    if (remainingCats.length === 0) {
      onShowToast('حداقل یک دسته‌بندی باید در برنامه باقی بماند.', 'error');
      return;
    }

    setCatToDelete(cat);
    setReplacementCatId(remainingCats[0]?.id || '');
  };

  // Confirm Delete Category
  const handleConfirmDeleteCat = () => {
    if (!catToDelete) return;

    const count = expenseCountPerCat.get(catToDelete.id) || 0;
    if (count > 0 && !replacementCatId) {
      onShowToast('لطفاً دسته‌بندی جایگزین را برای هزینه‌ها انتخاب کنید.', 'error');
      return;
    }

    // Update expenses if any
    let updatedExpenses = data.expenses;
    if (count > 0 && replacementCatId) {
      updatedExpenses = data.expenses.map((exp) =>
        exp.categoryId === catToDelete.id
          ? { ...exp, categoryId: replacementCatId, updatedAt: new Date().toISOString() }
          : exp
      );
    }

    const updatedCategories = data.categories.filter((c) => c.id !== catToDelete.id);

    onUpdateAllData({
      ...data,
      categories: updatedCategories,
      expenses: updatedExpenses,
    });

    onShowToast(`دسته‌بندی «${catToDelete.name}» حذف شد`, 'success');
    setCatToDelete(null);
  };

  // JSON Export
  const handleExportJson = () => {
    try {
      exportBackupJson(data);
      onShowToast('فایل پشتیبان JSON با موفقیت دریافت شد ✅', 'success');
    } catch {
      onShowToast('خطا در دریافت پشتیبان رخ داد.', 'error');
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    try {
      if (data.expenses.length === 0) {
        onShowToast('هیچ هزینه‌ای برای صدور فایل اکسل وجود ندارد.', 'info');
        return;
      }
      exportExpensesCsv(data.expenses, data.categories);
      onShowToast('فایل اکسل هزینه‌ها با موفقیت دانلود شد ✅', 'success');
    } catch {
      onShowToast('خطا در تولید فایل اکسل رخ داد.', 'error');
    }
  };

  // JSON Import File Selection
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = validateBackupJson(content);

      if (!validation.isValid || !validation.parsedData) {
        onShowToast(validation.error || 'فایل پشتیبان نامعتبر است.', 'error');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setImportPendingData({
        data: validation.parsedData,
        expenseCount: validation.expenseCount,
        categoryCount: validation.categoryCount,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      onShowToast('خطا در خواندن فایل انتخاب‌شده رخ داد.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // Confirm JSON restore
  const handleConfirmImport = () => {
    if (!importPendingData) return;
    onUpdateAllData(importPendingData.data);
    onShowToast(
      `پشتیبان با موفقیت بازیابی شد (${toPersianDigits(importPendingData.expenseCount)} هزینه) ✅`,
      'success'
    );
    setImportPendingData(null);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Storage & Privacy Note Banner */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center shrink-0 mt-0.5">
          <Shield size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#F4F7F5] mb-1">
            حریم خصوصی و ذخیره‌سازی داده‌ها
          </h3>
          <p className="text-xs text-[#A8B8AF] leading-relaxed">
            اطلاعات روی همین مرورگر ذخیره می‌شوند. برای نگه‌داشتن نسخهٔ پشتیبان، خروجی بگیر. هیچ داده‌ای به سرور خارجی ارسال نمی‌شود.
          </p>
        </div>
      </div>

      {/* Petty Cash Settings Section */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-[#45D69B]" />
            <h3 className="text-sm font-bold text-[#F4F7F5]">
              تنظیمات موجودی تنخواه
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPettyCashModal('set_balance')}
              className="min-h-[38px] px-3 bg-[#183D30] hover:bg-[#224e3e] text-[#F4F7F5] font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>تنظیم پایه</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPettyCashModal('recharge')}
              className="min-h-[38px] px-3 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>شارژ تنخواه</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Box */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[#071A14] border border-[#183D30] rounded-2xl mb-4 text-xs">
          <div>
            <span className="text-[#A8B8AF] text-[11px] block mb-0.5">
              موجودی پایه:
            </span>
            <span className="font-bold text-[#F4F7F5] tabular-nums">
              {formatToman(pettySummary.initial)}
            </span>
          </div>
          <div>
            <span className="text-[#A8B8AF] text-[11px] block mb-0.5">
              مجموع شارژها:
            </span>
            <span className="font-bold text-[#45D69B] tabular-nums">
              {formatToman(pettySummary.totalRecharged)}
            </span>
          </div>
          <div>
            <span className="text-[#A8B8AF] text-[11px] block mb-0.5">
              کل خرج‌شده:
            </span>
            <span className="font-bold text-red-400 tabular-nums">
              {formatToman(pettySummary.totalSpent)}
            </span>
          </div>
          <div>
            <span className="text-[#A8B8AF] text-[11px] block mb-0.5">
              باقیمانده فعلی:
            </span>
            <span
              className={`font-black tabular-nums ${
                pettySummary.isDeficit ? 'text-red-400' : 'text-[#45D69B]'
              }`}
            >
              {formatToman(pettySummary.remainingBalance)}
            </span>
          </div>
        </div>

        {/* Recharges List if any */}
        {(data.pettyCash.recharges || []).length > 0 && (
          <div className="space-y-2 mb-3">
            <span className="text-xs font-semibold text-[#A8B8AF] block mb-1">
              تاریخچه شارژهای تنخواه ({toPersianDigits(data.pettyCash.recharges.length)} مورد):
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.pettyCash.recharges.map((rech) => (
                <div
                  key={rech.id}
                  className="flex items-center justify-between p-2.5 bg-[#071A14]/70 border border-[#183D30] rounded-xl text-xs"
                >
                  <div className="truncate">
                    <span className="font-bold text-[#45D69B] tabular-nums ml-2">
                      +{formatToman(rech.amount)}
                    </span>
                    <span className="text-[#A8B8AF] ml-2">
                      {formatJalaliDateShort(rech.date)}
                    </span>
                    {rech.note && (
                      <span className="text-[#F4F7F5] text-[11px] truncate">
                        ({rech.note})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecharge(rech.id)}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="حذف این شارژ"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pettySummary.isConfigured && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetPettyCash}
              className="text-[11px] text-red-400/80 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw size={12} />
              <span>صفر کردن و بازنشانی تنخواه</span>
            </button>
          </div>
        )}
      </div>

      {/* Category Management */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#45D69B]" />
            <h3 className="text-sm font-bold text-[#F4F7F5]">
              مدیریت دسته‌بندی‌ها
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setCatError('');
              setIsAddCatOpen(true);
            }}
            className="min-h-[40px] px-3.5 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>دسته‌بندی جدید</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {data.categories.map((cat) => {
            const count = expenseCountPerCat.get(cat.id) || 0;
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 bg-[#071A14] border border-[#183D30] rounded-2xl group"
              >
                <div className="flex items-center gap-3 truncate">
                  <CategoryIcon
                    iconName={cat.icon}
                    color={cat.color}
                    className="w-9 h-9"
                    size={17}
                  />
                  <div className="truncate">
                    <span className="text-sm font-medium text-[#F4F7F5] truncate block">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-[#A8B8AF]">
                      {toPersianDigits(count)} هزینه ثبت‌شده
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInitiateDeleteCat(cat)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                  title="حذف دسته‌بندی"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backup & Export / Import */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[#45D69B]" />
          <h3 className="text-sm font-bold text-[#F4F7F5]">
            پشتیبان‌گیری و انتقال داده‌ها
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[48px] p-3 bg-[#071A14] hover:bg-[#183D30]/60 border border-[#183D30] hover:border-[#45D69B]/40 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
          >
            <Download size={20} className="text-[#45D69B] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#F4F7F5]">
              دریافت پشتیبان JSON
            </span>
            <span className="text-[10px] text-[#A8B8AF] mt-0.5">
              خروجی کامل هزینه‌ها و دسته‌ها
            </span>
          </button>

          {/* Import JSON */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[48px] p-3 bg-[#071A14] hover:bg-[#183D30]/60 border border-[#183D30] hover:border-[#45D69B]/40 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
          >
            <Upload size={20} className="text-[#45D69B] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#F4F7F5]">
              بازیابی پشتیبان JSON
            </span>
            <span className="text-[10px] text-[#A8B8AF] mt-0.5">
              ورود فایل با اعتبارسنجی خودکار
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            className="hidden"
          />

          {/* Export CSV with BOM */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[48px] p-3 bg-[#071A14] hover:bg-[#183D30]/60 border border-[#183D30] hover:border-[#45D69B]/40 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
          >
            <FileSpreadsheet size={20} className="text-[#45D69B] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#F4F7F5]">
              خروجی فایل اکسل (CSV)
            </span>
            <span className="text-[10px] text-[#A8B8AF] mt-0.5">
              پشتیبانی از زبان فارسی با UTF-8 BOM
            </span>
          </button>
        </div>
      </div>

      {/* MySQL & cPanel Bridge Section */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center shrink-0">
              <Server size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F7F5]">
                اتصال و همگام‌سازی پایگاه‌داده MySQL (cPanel / phpMyAdmin)
              </h3>
              <p className="text-[11px] text-[#A8B8AF]">
                اتصال مستقیم کلاینت به هاست cPanel از طریق اسکریپت خودکفای api.php با ساخت خودکار جداول
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={downloadApiPhpScript}
            className="min-h-[38px] px-3 bg-[#183D30] hover:bg-[#204a3c] text-[#45D69B] border border-[#45D69B]/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="دانلود فایل api.php برای آپلود در هاست"
          >
            <FileCode size={16} />
            <span className="hidden sm:inline">دانلود اسکریپت</span>
            <span>api.php</span>
          </button>
        </div>

        {/* Endpoint Input */}
        <div>
          <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
            آدرس کامل فایل api.php روی هاست:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={apiEndpoint}
              onChange={(e) => handleEndpointChange(e.target.value)}
              placeholder="مثلاً: https://your-domain.ir/api.php یا /api.php"
              className="flex-1 min-h-[44px] px-3.5 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-xs sm:text-sm text-[#F4F7F5] outline-none tabular-nums"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleTestApi}
              disabled={isTestingApi}
              className="min-h-[44px] px-4 bg-[#183D30] hover:bg-[#224e3e] disabled:opacity-50 text-[#F4F7F5] font-semibold text-xs rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={isTestingApi ? 'animate-spin text-[#45D69B]' : ''} />
              <span>{isTestingApi ? 'در حال تست...' : 'تست اتصال'}</span>
            </button>
          </div>
        </div>

        {/* Status result badge */}
        {apiStatusResult && (
          <div
            className={`p-3 rounded-2xl text-xs leading-relaxed border ${
              apiStatusResult.ok
                ? 'bg-[#071A14] border-[#45D69B]/40 text-[#45D69B]'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {apiStatusResult.ok ? (
                <Check size={16} className="text-[#45D69B] shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
              )}
              <span>{apiStatusResult.message}</span>
            </div>
            {apiStatusResult.data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#183D30] text-[11px] text-[#A8B8AF]">
                <div>
                  نام دیتابیس: <span className="font-bold text-[#F4F7F5]">{apiStatusResult.data.database}</span>
                </div>
                <div>
                  تعداد هزینه‌ها در دیتابیس: <span className="font-bold text-[#F4F7F5]">{toPersianDigits(apiStatusResult.data.tables?.expenses || 0)}</span>
                </div>
                <div>
                  دسته‌ها در دیتابیس: <span className="font-bold text-[#F4F7F5]">{toPersianDigits(apiStatusResult.data.tables?.categories || 0)}</span>
                </div>
                <div>
                  نسخه PHP سرور: <span className="font-bold text-[#F4F7F5]">{apiStatusResult.data.phpVersion || '—'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Push Sync */}
          <button
            type="button"
            onClick={handlePushSync}
            disabled={isSyncingApi}
            className="min-h-[44px] px-4 bg-[#45D69B] hover:bg-[#3ec48d] disabled:opacity-50 text-[#071A14] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Upload size={16} />
            <span>{isSyncingApi ? 'در حال ارسال و همگام‌سازی...' : 'ارسال اطلاعات محلی به دیتابیس (Push Sync)'}</span>
          </button>

          {/* Pull Sync */}
          <button
            type="button"
            onClick={handlePullSync}
            disabled={isPullingApi}
            className="min-h-[44px] px-4 bg-[#183D30] hover:bg-[#204a3c] disabled:opacity-50 text-[#F4F7F5] font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download size={16} className="text-[#45D69B]" />
            <span>{isPullingApi ? 'در حال دریافت...' : 'دریافت اطلاعات از سرور MySQL (Pull Sync)'}</span>
          </button>
        </div>

        {/* Collapsible cPanel Setup Guide */}
        <div className="pt-2 border-t border-[#183D30]">
          <button
            type="button"
            onClick={() => setShowCpanelGuide(!showCpanelGuide)}
            className="w-full flex items-center justify-between text-xs text-[#A8B8AF] hover:text-[#F4F7F5] py-1 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-medium">
              <Info size={14} className="text-[#45D69B]" />
              <span>راهنمای راه‌اندازی سریع در هاست cPanel و phpMyAdmin</span>
            </div>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${showCpanelGuide ? 'rotate-180' : ''}`}
            />
          </button>

          {showCpanelGuide && (
            <div className="mt-3 p-3.5 bg-[#071A14] border border-[#183D30] rounded-2xl text-xs space-y-2 text-[#A8B8AF] leading-relaxed animate-in fade-in">
              <p className="text-[#F4F7F5] font-semibold">مراحل نصب بدون نیاز به نوشتن کوئری SQL:</p>
              <ol className="list-decimal list-inside space-y-1.5 pr-1">
                <li>
                  روی دکمهٔ <strong className="text-[#45D69B]">«دانلود اسکریپت api.php»</strong> در بالا کلیک کنید.
                </li>
                <li>
                  وارد cPanel شوید و در بخش <strong className="text-[#F4F7F5]">File Manager</strong> فایل <code className="text-[#45D69B]">api.php</code> را در پوشهٔ سایت (مثلاً <code className="text-[#45D69B]">public_html</code>) آپلود کنید.
                </li>
                <li>
                  در cPanel وارد بخش <strong className="text-[#F4F7F5]">MySQL® Database Wizard</strong> شوید؛ یک دیتابیس و یک نام کاربری بسازید، دسترسی‌ها را تیک بزنید، و مقادیر <code className="text-[#45D69B]">DB_USER</code>، <code className="text-[#45D69B]">DB_PASS</code> و <code className="text-[#45D69B]">DB_NAME</code> را در سطرهای اولیه فایل <code className="text-[#45D69B]">api.php</code> وارد کنید.
                </li>
                <li>
                  آدرس اینترنتی فایل را در کادر بالا بنویسید (مثلاً: <code className="text-[#45D69B]">https://yoursite.com/api.php</code>) و دکمهٔ «تست اتصال» را بزنید. تمام جداول به‌طور خودکار ساخته می‌شوند!
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone: Clear All Data */}
      <div className="bg-[#102A21] border border-red-500/20 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-red-400 mb-1">
              منطقهٔ حساس: پاک‌سازی تمام داده‌ها
            </h4>
            <p className="text-xs text-[#A8B8AF]">
              همه هزینه‌ها و دسته‌بندی‌های شخصی حذف می‌شوند و برنامه به حالت اولیه بازمی‌گردد.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsClearDataOpen(true)}
            className="min-h-[44px] px-4 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
          >
            پاک‌کردن همه اطلاعات
          </button>
        </div>
      </div>

      {/* App Info Footer */}
      <div className="text-center text-xs text-[#A8B8AF]/60 pt-2">
        <span>خرجیار • نسخه ۱.۰.۰ • ذخیره‌سازی محلی و امن</span>
      </div>

      {/* MODAL: Add Category */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-sm bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#183D30]">
              <h3 className="text-sm font-bold text-[#F4F7F5]">
                افزودن دسته‌بندی جدید
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCatOpen(false)}
                className="text-[#A8B8AF] hover:text-[#F4F7F5] min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              {catError && (
                <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs">
                  {catError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
                  نام دسته‌بندی <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setCatError('');
                  }}
                  placeholder="مثلاً: هدایا، بیمه، تعمیرات..."
                  className="w-full min-h-[44px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-sm text-[#F4F7F5] outline-none"
                  autoFocus
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
                  انتخاب آیکون
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 bg-[#071A14] rounded-xl border border-[#183D30]">
                  {AVAILABLE_ICONS.map((item) => {
                    const isSelected = newCatIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setNewCatIcon(item.name)}
                        className={`min-h-[40px] flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#45D69B] text-[#071A14]'
                            : 'text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30]'
                        }`}
                        title={item.label}
                      >
                        <CategoryIcon
                          iconName={item.name}
                          color={isSelected ? '#071A14' : newCatColor}
                          className="w-8 h-8"
                          size={18}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
                  رنگ دسته‌بندی
                </label>
                <div className="flex items-center gap-2 overflow-x-auto p-1">
                  {CATEGORY_COLORS.map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setNewCatColor(clr)}
                      className={`w-7 h-7 rounded-full shrink-0 transition-transform cursor-pointer ${
                        newCatColor === clr ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#102A21]' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: clr }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  افزودن دسته‌بندی
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCatOpen(false)}
                  className="min-h-[44px] px-4 bg-[#183D30] text-[#F4F7F5] font-medium text-xs rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Category with Replacement */}
      {catToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="w-full max-w-sm bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-sm font-bold text-[#F4F7F5] text-center mb-1">
              حذف دسته‌بندی «{catToDelete.name}»
            </h3>

            {/* Check expense count */}
            {(expenseCountPerCat.get(catToDelete.id) || 0) > 0 ? (
              <div className="my-3 space-y-3">
                <p className="text-xs text-[#A8B8AF] text-center leading-relaxed">
                  تعداد{' '}
                  <span className="font-bold text-[#45D69B]">
                    {toPersianDigits(expenseCountPerCat.get(catToDelete.id) || 0)}
                  </span>{' '}
                  هزینه در این دسته ثبت شده است. برای حذف این دسته، باید دسته‌بندی جایگزینی برای این هزینه‌ها انتخاب کنید:
                </p>

                <div>
                  <label className="block text-xs font-medium text-[#A8B8AF] mb-1">
                    دسته‌بندی جایگزین:
                  </label>
                  <select
                    value={replacementCatId}
                    onChange={(e) => setReplacementCatId(e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-sm text-[#F4F7F5] outline-none"
                  >
                    {data.categories
                      .filter((c) => c.id !== catToDelete.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#A8B8AF] text-center my-3 leading-relaxed">
                هیچ هزینه‌ای با این دسته ثبت نشده است. آیا از حذف این دسته‌بندی مطمئن هستید؟
              </p>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmDeleteCat}
                className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                تأیید و حذف
              </button>
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                className="min-h-[44px] px-4 bg-[#183D30] text-[#F4F7F5] font-medium text-xs rounded-xl cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Import JSON Confirmation & Current Backup offer */}
      {importPendingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="w-full max-w-md bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#45D69B]/10 border border-[#45D69B]/20 text-[#45D69B] flex items-center justify-center mx-auto mb-3">
              <Upload size={24} />
            </div>

            <h3 className="text-base font-bold text-[#F4F7F5] text-center mb-2">
              تأیید بازیابی فایل پشتیبان
            </h3>

            <div className="p-3 bg-[#071A14] border border-[#183D30] rounded-2xl my-3 text-xs space-y-1.5">
              <div className="flex justify-between text-[#A8B8AF]">
                <span>تعداد هزینه‌ها در فایل:</span>
                <span className="font-bold text-[#45D69B]">
                  {toPersianDigits(importPendingData.expenseCount)} مورد
                </span>
              </div>
              <div className="flex justify-between text-[#A8B8AF]">
                <span>تعداد دسته‌بندی‌ها:</span>
                <span className="font-bold text-[#F4F7F5]">
                  {toPersianDigits(importPendingData.categoryCount)} دسته
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A8B8AF] text-center mb-4 leading-relaxed">
              با بازیابی این فایل، داده‌های فعلی شما با محتوای پشتیبان جایگزین خواهند شد. توصیه می‌کنیم ابتدا نسخه پشتیبان داده‌های فعلی را ذخیره کنید.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full min-h-[44px] px-4 bg-[#183D30] hover:bg-[#204a3c] text-[#45D69B] font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download size={16} />
                <span>دانلود پشتیبان از اطلاعات فعلی (پیشنهادی)</span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex-1 min-h-[44px] bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  تأیید و جایگزینی داده‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setImportPendingData(null)}
                  className="min-h-[44px] px-4 bg-[#183D30] text-[#F4F7F5] font-medium text-xs rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Clear All Data Confirmation */}
      {isClearDataOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-sm bg-[#102A21] border border-red-500/30 rounded-3xl p-5 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-bold text-[#F4F7F5] mb-2">
              پاک‌کردن تمام اطلاعات
            </h3>

            <p className="text-xs text-[#A8B8AF] leading-relaxed mb-5">
              آیا کاملاً مطمئن هستید؟ تمام هزینه‌های ثبت‌شده و دسته‌بندی‌های شخصی شما برای همیشه حذف خواهند شد و قابل بازیابی نخواهند بود.
            </p>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setIsClearDataOpen(false);
                }}
                className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-lg shadow-red-500/20"
              >
                بله، تمام اطلاعات پاک شوند
              </button>
              <button
                type="button"
                onClick={() => setIsClearDataOpen(false)}
                className="flex-1 min-h-[44px] bg-[#183D30] hover:bg-[#204a3c] text-[#F4F7F5] font-medium text-xs rounded-xl cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
