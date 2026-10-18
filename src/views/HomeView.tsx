import React from 'react';
import { Plus, ArrowLeft, Calendar, TrendingDown, Clock, Sparkles, Wallet, PlusCircle, Settings2, AlertTriangle } from 'lucide-react';
import { Category, Expense, PettyCashConfig } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import {
  formatToman,
  formatThousandsPersian,
  toPersianDigits,
} from '../utils/formatters';
import {
  isDateInCurrentShamsiMonth,
  isDateToday,
  formatJalaliDateFull,
  formatJalaliDateShort,
  getTehranToday,
  JALALI_MONTH_NAMES,
} from '../utils/jalali';
import { calculatePettyCashSummary } from '../services/storage';

interface HomeViewProps {
  expenses: Expense[];
  categories: Category[];
  pettyCash: PettyCashConfig;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onRequestDelete: (expense: Expense) => void;
  onNavigateToExpenses: () => void;
  onOpenPettyCashModal: (mode: 'set_balance' | 'recharge') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  expenses,
  categories,
  pettyCash,
  onOpenAddExpense,
  onEditExpense,
  onRequestDelete,
  onNavigateToExpenses,
  onOpenPettyCashModal,
}) => {
  const today = getTehranToday();
  const currentMonthName = JALALI_MONTH_NAMES[today.jalali.jm - 1];

  // Petty Cash Summary
  const pettySummary = calculatePettyCashSummary(pettyCash, expenses);

  // Category map for quick lookup
  const categoryMap = new Map<string, Category>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat));

  // Filter current month expenses
  const currentMonthExpenses = expenses.filter((e) =>
    isDateInCurrentShamsiMonth(e.date)
  );

  // Month total
  const monthTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Today total
  const todayExpenses = expenses.filter((e) => isDateToday(e.date));
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Month count
  const monthCount = currentMonthExpenses.length;

  // Sort all expenses: newest date first, then newest createdAt first
  const sortedExpenses = [...expenses].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const recentExpenses = sortedExpenses.slice(0, 5);

  // Category shares for current month
  const categoryTotals = new Map<string, number>();
  currentMonthExpenses.forEach((e) => {
    categoryTotals.set(e.categoryId, (categoryTotals.get(e.categoryId) || 0) + e.amount);
  });

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([catId, amount]) => {
      const category = categoryMap.get(catId) || {
        id: catId,
        name: 'سایر',
        icon: 'MoreHorizontal',
        color: '#64748B',
      };
      const percentage = monthTotal > 0 ? (amount / monthTotal) * 100 : 0;
      return { category, amount, percentage };
    })
    .sort((a, b) => b.amount - a.amount);

  const hasAnyExpense = expenses.length > 0;

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-200">
      {/* Top Welcome / Month Indicator */}
      <div className="flex items-center justify-between text-xs text-[#A8B8AF]">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-[#45D69B]" />
          <span>امروز: {formatJalaliDateFull(today.iso)}</span>
        </div>
        <span className="bg-[#102A21] border border-[#183D30] px-2.5 py-1 rounded-full text-[#45D69B] font-medium">
          ماه {currentMonthName} {toPersianDigits(today.jalali.jy)}
        </span>
      </div>

      {/* PETTY CASH CARD (موجودی تنخواه) */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg relative overflow-hidden">
        {!pettySummary.isConfigured ? (
          // Unconfigured state
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#45D69B]/10 border border-[#45D69B]/20 text-[#45D69B] flex items-center justify-center shrink-0">
                <Wallet size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F4F7F5] mb-0.5">
                  موجودی تنخواه
                </h3>
                <p className="text-xs text-[#A8B8AF] leading-relaxed max-w-sm">
                  موجودی اولیه تنخواه خود را مشخص کنید تا تمام خرج‌ها و هزینه‌ها خودکار از آن کسر شوند.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenPettyCashModal('set_balance')}
              className="min-h-[42px] px-4 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0"
            >
              <PlusCircle size={16} />
              <span>تنظیم موجودی تنخواه</span>
            </button>
          </div>
        ) : (
          // Configured state with live deductions
          <div>
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center shrink-0">
                  <Wallet size={17} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#A8B8AF] block">
                    موجودی باقیمانده تنخواه
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenPettyCashModal('recharge')}
                  className="min-h-[36px] px-3 bg-[#45D69B]/15 hover:bg-[#45D69B]/25 border border-[#45D69B]/30 text-[#45D69B] font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="شارژ موجودی"
                >
                  <PlusCircle size={14} />
                  <span>شارژ تنخواه</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPettyCashModal('set_balance')}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30] rounded-xl transition-colors cursor-pointer"
                  title="تنظیم مجدد موجودی"
                >
                  <Settings2 size={16} />
                </button>
              </div>
            </div>

            {/* Big Balance Number */}
            <div className="flex items-baseline gap-2 mb-3">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                  pettySummary.isDeficit ? 'text-red-400' : 'text-[#45D69B]'
                }`}
              >
                {formatToman(pettySummary.remainingBalance)}
              </span>
              {pettySummary.isDeficit && (
                <span className="text-[11px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle size={12} />
                  کسری تنخواه
                </span>
              )}
            </div>

            {/* Progress Bar (Spent vs Remaining) */}
            <div className="w-full h-2.5 bg-[#071A14] rounded-full overflow-hidden border border-[#183D30] mb-3">
              <div
                className={`h-full transition-all duration-300 ${
                  pettySummary.isDeficit
                    ? 'bg-red-500'
                    : pettySummary.spentPercentage > 80
                    ? 'bg-amber-400'
                    : 'bg-[#45D69B]'
                }`}
                style={{ width: `${pettySummary.spentPercentage}%` }}
              />
            </div>

            {/* Breakdown Sub-metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#183D30]/60 text-xs">
              <div>
                <span className="text-[#A8B8AF] text-[11px] block">
                  کل تنخواه تخصیص‌یافته:
                </span>
                <span className="font-bold text-[#F4F7F5] tabular-nums">
                  {formatToman(pettySummary.totalAllocated)}
                </span>
              </div>
              <div>
                <span className="text-[#A8B8AF] text-[11px] block">
                  کل خرج‌شده:
                </span>
                <span className="font-bold text-red-400 tabular-nums">
                  {formatToman(pettySummary.totalSpent)}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center sm:justify-end">
                <span className="text-[11px] text-[#A8B8AF]">
                  {toPersianDigits(
                    Math.max(0, 100 - Math.round(pettySummary.spentPercentage))
                  )}
                  ٪ از موجودی هنوز باقی مانده
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Month Total Card */}
        <div className="sm:col-span-2 bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#A8B8AF]">
              مجموع هزینه‌های ماه جاری ({currentMonthName})
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#F4F7F5] tracking-tight mb-1 tabular-nums">
            {formatToman(monthTotal)}
          </div>
          <div className="text-xs text-[#A8B8AF] mt-2 flex items-center gap-2">
            <span>تعداد ثبت‌شده در این ماه:</span>
            <span className="font-bold text-[#45D69B]">
              {toPersianDigits(monthCount)} مورد
            </span>
          </div>
        </div>

        {/* Today Total Card */}
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#A8B8AF]">
              مجموع خرج‌های امروز
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#183D30] text-[#45D69B] flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#F4F7F5] tracking-tight tabular-nums">
              {formatToman(todayTotal)}
            </div>
            <div className="text-[11px] text-[#A8B8AF] mt-1.5">
              {toPersianDigits(todayExpenses.length)} هزینه امروز
            </div>
          </div>
        </div>
      </div>

      {/* Empty State when no expenses at all */}
      {!hasAnyExpense && (
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-8 sm:p-10 text-center shadow-lg my-4">
          <div className="w-16 h-16 rounded-3xl bg-[#45D69B]/10 border border-[#45D69B]/20 text-[#45D69B] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={28} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#F4F7F5] mb-2">
            هنوز هزینه‌ای ثبت نکردی؛ اولین خرجت رو اضافه کن 🌱
          </h3>
          <p className="text-xs text-[#A8B8AF] max-w-sm mx-auto mb-6 leading-relaxed">
            کافیه روی دکمهٔ زیر بزنی و عنوان و مبلغ خرجت رو بنویسی تا محاسبات خودکار شروع بشه.
          </p>
          <button
            type="button"
            onClick={onOpenAddExpense}
            className="min-h-[46px] px-6 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-sm rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-[#45D69B]/20 active:scale-[0.98]"
          >
            <Plus size={18} strokeWidth={2.8} />
            <span>ثبت اولین هزینه</span>
          </button>
        </div>
      )}

      {/* Category Breakdown (If there are expenses this month) */}
      {currentMonthExpenses.length > 0 && (
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#F4F7F5]">
              سهم دسته‌بندی‌ها در ماه {currentMonthName}
            </h3>
            <span className="text-xs text-[#A8B8AF]">
              {toPersianDigits(categoryBreakdown.length)} دسته فعال
            </span>
          </div>

          {/* Progress Multi-Bar */}
          <div className="w-full h-3.5 bg-[#071A14] rounded-full overflow-hidden flex mb-4 border border-[#183D30]">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category.id}
                className="h-full transition-all duration-300"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.category.color || '#45D69B',
                }}
                title={`${item.category.name}: ${formatToman(item.amount)} (${toPersianDigits(item.percentage.toFixed(1))}٪)`}
              />
            ))}
          </div>

          {/* Category List Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category.id}
                className="flex items-center justify-between p-2.5 bg-[#071A14]/60 border border-[#183D30]/60 rounded-xl text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.category.color || '#45D69B' }}
                  />
                  <span className="font-medium text-[#F4F7F5] truncate">
                    {item.category.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-[#F4F7F5] tabular-nums">
                    {formatToman(item.amount)}
                  </span>
                  <span className="text-[#A8B8AF] font-medium min-w-[36px] text-left tabular-nums">
                    {toPersianDigits(Math.round(item.percentage))}٪
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5 Recent Expenses */}
      {hasAnyExpense && (
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#F4F7F5]">
              آخرین هزینه‌ها
            </h3>
            <button
              type="button"
              onClick={onNavigateToExpenses}
              className="min-h-[40px] px-2.5 flex items-center gap-1 text-xs font-semibold text-[#45D69B] hover:text-[#3ec48d] transition-colors cursor-pointer"
            >
              <span>مشاهده همه</span>
              <ArrowLeft size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {recentExpenses.map((expense) => {
              const cat = categoryMap.get(expense.categoryId) || {
                id: expense.categoryId,
                name: 'سایر',
                icon: 'MoreHorizontal',
                color: '#64748B',
              };

              return (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 bg-[#071A14] border border-[#183D30] rounded-2xl hover:border-[#45D69B]/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 truncate">
                    <CategoryIcon
                      iconName={cat.icon}
                      color={cat.color}
                      className="w-10 h-10"
                      size={18}
                    />
                    <div className="truncate">
                      <p className="text-sm font-bold text-[#F4F7F5] truncate">
                        {expense.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#A8B8AF] mt-0.5">
                        <span>{cat.name}</span>
                        <span>•</span>
                        <span>{formatJalaliDateShort(expense.date)}</span>
                        {expense.note && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{expense.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-[#45D69B] tabular-nums">
                      {formatToman(expense.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditExpense(expense)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-xs text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30] rounded-lg transition-colors cursor-pointer"
                      title="ویرایش"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDelete(expense)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="حذف"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
