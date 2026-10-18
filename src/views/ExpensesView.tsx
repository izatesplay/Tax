import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  Calendar,
  Tag,
  ArrowUpDown,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react';
import { Category, Expense } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { JalaliDatePicker } from '../components/JalaliDatePicker';
import {
  formatToman,
  toPersianDigits,
  parseToEnglishDigits,
} from '../utils/formatters';
import {
  formatJalaliDateFull,
  formatJalaliDateShort,
  isDateInCurrentShamsiMonth,
  isDateInCurrentShamsiWeek,
} from '../utils/jalali';

interface ExpensesViewProps {
  expenses: Expense[];
  categories: Category[];
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onRequestDelete: (expense: Expense) => void;
}

type DatePreset = 'all' | 'this_month' | 'this_week' | 'custom';

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  categories,
  onOpenAddExpense,
  onEditExpense,
  onRequestDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Check if any filter is active
  const isFiltered =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'all' ||
    datePreset !== 'all' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    // 1. Sort newest date first; if equal date, newest createdAt first
    const sorted = [...expenses].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

    return sorted.filter((exp) => {
      // Search query (matches title or note, case-insensitive, digits normalized)
      if (searchQuery.trim()) {
        const queryNorm = parseToEnglishDigits(searchQuery.trim().toLowerCase());
        const titleNorm = parseToEnglishDigits(exp.title.toLowerCase());
        const noteNorm = parseToEnglishDigits((exp.note || '').toLowerCase());
        if (!titleNorm.includes(queryNorm) && !noteNorm.includes(queryNorm)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && exp.categoryId !== selectedCategory) {
        return false;
      }

      // Date filter
      if (datePreset === 'this_month') {
        if (!isDateInCurrentShamsiMonth(exp.date)) return false;
      } else if (datePreset === 'this_week') {
        if (!isDateInCurrentShamsiWeek(exp.date)) return false;
      } else if (datePreset === 'custom') {
        if (customStartDate && exp.date < customStartDate) return false;
        if (customEndDate && exp.date > customEndDate) return false;
      }

      return true;
    });
  }, [
    expenses,
    searchQuery,
    selectedCategory,
    datePreset,
    customStartDate,
    customEndDate,
  ]);

  // Total amount of filtered results
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Search & Filter Bar */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-4 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8B8AF]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جست‌وجو در عنوان و یادداشت..."
              className="w-full min-h-[44px] pr-10 pl-10 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] focus:ring-1 focus:ring-[#45D69B] rounded-2xl text-sm text-[#F4F7F5] placeholder-[#A8B8AF]/50 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Toggle Filter Panel Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`min-h-[44px] px-3.5 flex items-center gap-1.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              isFiltered || showFilters
                ? 'bg-[#45D69B]/15 border-[#45D69B] text-[#45D69B]'
                : 'bg-[#071A14] border-[#183D30] text-[#A8B8AF] hover:text-[#F4F7F5]'
            }`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline">فیلترها</span>
            {isFiltered && (
              <span className="w-2 h-2 rounded-full bg-[#45D69B]" />
            )}
          </button>
        </div>

        {/* Collapsible / Expandable Filter Options */}
        {(showFilters || isFiltered) && (
          <div className="pt-3 border-t border-[#183D30] space-y-3 animate-in fade-in duration-150">
            {/* Category Filter Chips */}
            <div>
              <span className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
                دسته‌بندی:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    selectedCategory === 'all'
                      ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                      : 'bg-[#071A14] border border-[#183D30] text-[#A8B8AF] hover:text-[#F4F7F5]'
                  }`}
                >
                  همه دسته‌ها
                </button>
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[36px] px-3 flex items-center gap-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                          : 'bg-[#071A14] border border-[#183D30] text-[#A8B8AF] hover:text-[#F4F7F5]'
                      }`}
                    >
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Preset Filter */}
            <div>
              <span className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
                بازه زمانی:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'all', label: 'همه زمان‌ها' },
                  { id: 'this_month', label: 'ماه جاری' },
                  { id: 'this_week', label: 'هفته جاری' },
                  { id: 'custom', label: 'بازه دلخواه' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDatePreset(preset.id as DatePreset)}
                    className={`min-h-[38px] px-2 rounded-xl text-xs font-medium text-center transition-colors cursor-pointer truncate ${
                      datePreset === preset.id
                        ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                        : 'bg-[#071A14] border border-[#183D30] text-[#A8B8AF] hover:text-[#F4F7F5]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Pickers */}
            {datePreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#183D30]/60">
                <JalaliDatePicker
                  label="از تاریخ"
                  value={customStartDate}
                  onChange={(d) => setCustomStartDate(d)}
                />
                <JalaliDatePicker
                  label="تا تاریخ"
                  value={customEndDate}
                  onChange={(d) => setCustomEndDate(d)}
                />
              </div>
            )}

            {/* Clear All Filters Button */}
            {isFiltered && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="min-h-[36px] px-3 flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={14} />
                  <span>پاک‌کردن همه فیلترها</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Summary Banner */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#102A21]/60 border border-[#183D30] rounded-2xl text-xs">
        <div className="text-[#A8B8AF]">
          مجموع نتایج:
          <span className="font-bold text-[#45D69B] mr-1.5 tabular-nums">
            {formatToman(filteredTotal)}
          </span>
        </div>
        <div className="text-[#A8B8AF] font-medium tabular-nums">
          {toPersianDigits(filteredExpenses.length)} هزینه
        </div>
      </div>

      {/* Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-8 text-center my-4">
          <div className="w-12 h-12 rounded-2xl bg-[#183D30] text-[#A8B8AF] flex items-center justify-center mx-auto mb-3">
            <Search size={22} />
          </div>
          <h4 className="text-sm font-bold text-[#F4F7F5] mb-1">
            {expenses.length === 0
              ? 'هنوز هیچ هزینه‌ای ثبت نشده است'
              : 'هیچ هزینه‌ای با این مشخصات یافت نشد'}
          </h4>
          <p className="text-xs text-[#A8B8AF] max-w-xs mx-auto mb-4">
            {expenses.length === 0
              ? 'اولین هزینه خود را با دکمه زیر ثبت کنید.'
              : 'فیلترها را تغییر دهید یا دکمه پاک‌کردن فیلترها را بزنید.'}
          </p>
          {expenses.length === 0 ? (
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="min-h-[44px] px-5 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus size={16} />
              <span>ثبت هزینه</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClearFilters}
              className="min-h-[44px] px-4 bg-[#183D30] hover:bg-[#204a3c] text-[#F4F7F5] font-medium text-xs rounded-xl cursor-pointer"
            >
              پاک‌کردن فیلترها
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => {
            const cat = categoryMap.get(expense.categoryId) || {
              id: expense.categoryId,
              name: 'سایر',
              icon: 'MoreHorizontal',
              color: '#64748B',
            };

            return (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3.5 bg-[#102A21] border border-[#183D30] rounded-2xl hover:border-[#45D69B]/40 transition-colors group"
              >
                {/* Left (Category Icon + Info) */}
                <div className="flex items-center gap-3 truncate">
                  <CategoryIcon
                    iconName={cat.icon}
                    color={cat.color}
                    className="w-11 h-11"
                    size={20}
                  />
                  <div className="truncate">
                    <p className="text-sm font-bold text-[#F4F7F5] truncate mb-0.5">
                      {expense.title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[#A8B8AF]">
                      <span>{cat.name}</span>
                      <span>•</span>
                      <span>{formatJalaliDateFull(expense.date)}</span>
                    </div>
                    {expense.note && (
                      <p className="text-[11px] text-[#A8B8AF]/80 truncate max-w-xs mt-1">
                        {expense.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right (Amount + Action Buttons) */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-[#45D69B] tabular-nums">
                    {formatToman(expense.amount)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onEditExpense(expense)}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30] rounded-xl transition-colors cursor-pointer"
                    title="ویرایش"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDelete(expense)}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
