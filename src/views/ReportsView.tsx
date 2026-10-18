import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Award,
  Hash,
  BarChart2,
  PieChart,
  Calendar,
  AlertCircle,
  Wallet,
  History,
  PlusCircle,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';
import { Category, Expense, PettyCashConfig, PettyCashEvent } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import {
  formatToman,
  toPersianDigits,
  formatThousandsPersian,
} from '../utils/formatters';
import {
  getTehranToday,
  JALALI_MONTH_NAMES,
  getDaysInJalaliMonth,
  jalaliToIso,
  isoToJalali,
  getJalaliMonthIsoRange,
  getPersianWeekday,
  formatJalaliDateFull,
  formatJalaliDateShort,
} from '../utils/jalali';

interface ReportsViewProps {
  expenses: Expense[];
  categories: Category[];
  pettyCash: PettyCashConfig;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  expenses,
  categories,
  pettyCash,
}) => {
  const [pettyHistoryFilter, setPettyHistoryFilter] = useState<'all' | 'selected_month'>('all');
  const today = getTehranToday();
  const [selectedYear, setSelectedYear] = useState<number>(today.jalali.jy);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.jalali.jm);
  const [activeDayHover, setActiveDayHover] = useState<{
    day: number;
    amount: number;
    count: number;
  } | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setActiveDayHover(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setActiveDayHover(null);
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(today.jalali.jy);
    setSelectedMonth(today.jalali.jm);
    setActiveDayHover(null);
  };

  // Filter expenses for selected Shamsi month
  const { startIso, endIso } = useMemo(() => {
    return getJalaliMonthIsoRange(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const monthExpenses = useMemo(() => {
    return expenses.filter(
      (exp) => exp.date >= startIso && exp.date <= endIso
    );
  }, [expenses, startIso, endIso]);

  // Total amount & count
  const monthTotal = useMemo(() => {
    return monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthExpenses]);

  const monthCount = monthExpenses.length;

  // Category distribution
  const categoryStats = useMemo(() => {
    if (monthExpenses.length === 0) return [];
    const totals = new Map<string, { amount: number; count: number }>();

    monthExpenses.forEach((exp) => {
      const current = totals.get(exp.categoryId) || { amount: 0, count: 0 };
      totals.set(exp.categoryId, {
        amount: current.amount + exp.amount,
        count: current.count + 1,
      });
    });

    return Array.from(totals.entries())
      .map(([catId, stat]) => {
        const cat = categoryMap.get(catId) || {
          id: catId,
          name: 'سایر',
          icon: 'MoreHorizontal',
          color: '#64748B',
        };
        const percentage = monthTotal > 0 ? (stat.amount / monthTotal) * 100 : 0;
        return {
          category: cat,
          amount: stat.amount,
          count: stat.count,
          percentage,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, monthTotal, categoryMap]);

  // Top spending category
  const topCategory = categoryStats[0] || null;

  // Daily distribution (Days 1 to daysInMonth)
  const daysInMonth = getDaysInJalaliMonth(selectedYear, selectedMonth);

  const dailyStats = useMemo(() => {
    const dailyMap = new Map<number, { amount: number; count: number }>();
    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap.set(d, { amount: 0, count: 0 });
    }

    monthExpenses.forEach((exp) => {
      const jalali = isoToJalali(exp.date);
      if (jalali.jy === selectedYear && jalali.jm === selectedMonth) {
        const current = dailyMap.get(jalali.jd) || { amount: 0, count: 0 };
        dailyMap.set(jalali.jd, {
          amount: current.amount + exp.amount,
          count: current.count + 1,
        });
      }
    });

    const list: { day: number; amount: number; count: number }[] = [];
    let maxAmount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const stat = dailyMap.get(d) || { amount: 0, count: 0 };
      if (stat.amount > maxAmount) maxAmount = stat.amount;
      list.push({ day: d, amount: stat.amount, count: stat.count });
    }

    return { list, maxAmount };
  }, [monthExpenses, daysInMonth, selectedYear, selectedMonth]);

  const isCurrentMonthSelected =
    selectedYear === today.jalali.jy && selectedMonth === today.jalali.jm;

  // Filtered petty cash history
  const pettyCashHistory = useMemo(() => {
    const list = pettyCash.history || [];
    if (pettyHistoryFilter === 'selected_month') {
      return list.filter((evt) => evt.date >= startIso && evt.date <= endIso);
    }
    return list;
  }, [pettyCash.history, pettyHistoryFilter, startIso, endIso]);

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-200">
      {/* Month Selector Bar */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNextMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#A8B8AF] hover:text-[#45D69B] hover:bg-[#183D30] rounded-xl transition-colors cursor-pointer"
            title="ماه بعد"
          >
            <ChevronRight size={20} />
          </button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black text-[#F4F7F5]">
                {JALALI_MONTH_NAMES[selectedMonth - 1]}
              </span>
              <span className="text-base sm:text-lg font-bold text-[#45D69B]">
                {toPersianDigits(selectedYear)}
              </span>
            </div>
            {!isCurrentMonthSelected ? (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="text-[11px] font-semibold text-[#45D69B] hover:underline mt-0.5 cursor-pointer"
              >
                بازگشت به ماه جاری
              </button>
            ) : (
              <span className="text-[11px] text-[#A8B8AF] mt-0.5">
                (ماه جاری)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrevMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#A8B8AF] hover:text-[#45D69B] hover:bg-[#183D30] rounded-xl transition-colors cursor-pointer"
            title="ماه قبل"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {/* Month KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Expense */}
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#A8B8AF] mb-1.5">
            <span>مجموع هزینه ماه</span>
            <TrendingDown size={16} className="text-[#45D69B]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#F4F7F5] tabular-nums">
            {formatToman(monthTotal)}
          </div>
        </div>

        {/* Count of transactions */}
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#A8B8AF] mb-1.5">
            <span>تعداد هزینه‌ها</span>
            <Hash size={16} className="text-[#45D69B]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#F4F7F5] tabular-nums">
            {toPersianDigits(monthCount)}{' '}
            <span className="text-xs font-normal text-[#A8B8AF]">مورد</span>
          </div>
        </div>

        {/* Top Category */}
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#A8B8AF] mb-1.5">
            <span>پرهزینه‌ترین دسته</span>
            <Award size={16} className="text-[#45D69B]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#F4F7F5] truncate">
            {topCategory ? topCategory.category.name : '—'}
          </div>
          {topCategory && (
            <div className="text-xs text-[#45D69B] mt-0.5 tabular-nums">
              {formatToman(topCategory.amount)} ({toPersianDigits(Math.round(topCategory.percentage))}٪)
            </div>
          )}
        </div>
      </div>

      {/* Empty State for Months with Zero Data */}
      {monthCount === 0 ? (
        <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-8 text-center my-4">
          <div className="w-12 h-12 rounded-2xl bg-[#183D30] text-[#A8B8AF] flex items-center justify-center mx-auto mb-3">
            <Calendar size={22} />
          </div>
          <h4 className="text-sm font-bold text-[#F4F7F5] mb-1">
            در این ماه هیچ هزینه‌ای ثبت نشده است
          </h4>
          <p className="text-xs text-[#A8B8AF] max-w-xs mx-auto">
            برای مشاهده آمار و نمودارها، ابتدا برای این ماه یا ماه‌های دیگر هزینه ثبت کنید.
          </p>
        </div>
      ) : (
        <>
          {/* Daily Expenses Bar Chart */}
          <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-[#45D69B]" />
                <h3 className="text-sm font-bold text-[#F4F7F5]">
                  نمودار هزینه‌های روزانه
                </h3>
              </div>
              <span className="text-[11px] text-[#A8B8AF]">
                روزهای ۱ تا {toPersianDigits(daysInMonth)}
              </span>
            </div>

            {/* Active Day Inspection Banner */}
            <div className="min-h-[32px] mb-3 px-3 py-1.5 bg-[#071A14] border border-[#183D30] rounded-xl flex items-center justify-between text-xs">
              {activeDayHover ? (
                <>
                  <span className="text-[#F4F7F5]">
                    روز {toPersianDigits(activeDayHover.day)}{' '}
                    {JALALI_MONTH_NAMES[selectedMonth - 1]}:
                  </span>
                  <span className="font-bold text-[#45D69B] tabular-nums">
                    {formatToman(activeDayHover.amount)} (
                    {toPersianDigits(activeDayHover.count)} هزینه)
                  </span>
                </>
              ) : (
                <span className="text-[#A8B8AF] text-[11px]">
                  برای مشاهده جزئیات، روی هر ستون ضربه بزنید یا ماوس را روی آن ببرید.
                </span>
              )}
            </div>

            {/* Visual Bar Chart */}
            <div className="pt-4 pb-2 overflow-x-auto no-scrollbar">
              <div className="flex items-end gap-1.5 h-44 min-w-[580px] px-1 border-b border-[#183D30]">
                {dailyStats.list.map((item) => {
                  const max = dailyStats.maxAmount > 0 ? dailyStats.maxAmount : 1;
                  const heightPercent =
                    item.amount > 0 ? Math.max((item.amount / max) * 100, 6) : 0;
                  const isZero = item.amount === 0;
                  const isHovered = activeDayHover?.day === item.day;

                  return (
                    <div
                      key={item.day}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                      onMouseEnter={() => setActiveDayHover(item)}
                      onClick={() => setActiveDayHover(item)}
                    >
                      {/* Bar */}
                      <div className="w-full flex justify-center items-end h-full">
                        <div
                          className={`w-full max-w-[14px] rounded-t-md transition-all duration-200 ${
                            isZero
                              ? 'h-[2px] bg-[#183D30]'
                              : isHovered
                              ? 'bg-[#45D69B] shadow-lg shadow-[#45D69B]/40 scale-x-110'
                              : 'bg-[#45D69B]/75 hover:bg-[#45D69B]'
                          }`}
                          style={{
                            height: isZero ? '2px' : `${heightPercent}%`,
                          }}
                        />
                      </div>

                      {/* Day Label */}
                      <span
                        className={`text-[10px] mt-2 transition-colors tabular-nums ${
                          isHovered
                            ? 'text-[#45D69B] font-bold'
                            : 'text-[#A8B8AF]'
                        }`}
                      >
                        {toPersianDigits(item.day)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#A8B8AF] mt-2 px-1">
              <span>ابتدای ماه (۱)</span>
              <span>روزهای بدون هزینه مقدار صفر دارند</span>
              <span>پایان ماه ({toPersianDigits(daysInMonth)})</span>
            </div>
          </div>

          {/* Category Share Chart & Detailed Table */}
          <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={18} className="text-[#45D69B]" />
              <h3 className="text-sm font-bold text-[#F4F7F5]">
                سهم و آمار دسته‌بندی‌ها
              </h3>
            </div>

            {/* Multi-color Progress Distribution */}
            <div className="w-full h-4 bg-[#071A14] rounded-full overflow-hidden flex mb-5 border border-[#183D30]">
              {categoryStats.map((item) => (
                <div
                  key={item.category.id}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.category.color || '#45D69B',
                  }}
                  title={`${item.category.name}: ${formatToman(item.amount)}`}
                />
              ))}
            </div>

            {/* Detailed Category Table */}
            <div className="space-y-2.5">
              {categoryStats.map((item) => (
                <div
                  key={item.category.id}
                  className="flex items-center justify-between p-3 bg-[#071A14] border border-[#183D30] rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon
                      iconName={item.category.icon}
                      color={item.category.color}
                      className="w-9 h-9"
                      size={18}
                    />
                    <div>
                      <div className="text-sm font-bold text-[#F4F7F5]">
                        {item.category.name}
                      </div>
                      <div className="text-[11px] text-[#A8B8AF]">
                        {toPersianDigits(item.count)} تراکنش
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="text-sm font-bold text-[#F4F7F5] tabular-nums">
                      {formatToman(item.amount)}
                    </div>
                    <div className="text-xs font-semibold text-[#45D69B] tabular-nums">
                      {toPersianDigits(item.percentage.toFixed(1))}٪ از کل ماه
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* HISTORY OF PETTY CASH CHANGES SECTION (تاریخچه تغییرات موجودی تنخواه) */}
      <div className="bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#183D30]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center shrink-0">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F7F5]">
                تاریخچه تغییرات موجودی تنخواه
              </h3>
              <p className="text-[11px] text-[#A8B8AF]">
                گزارش شارژها، واریزی‌ها و تنظیمات مجدد سقف تنخواه با تاریخ شمسی
              </p>
            </div>
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-1 p-1 bg-[#071A14] border border-[#183D30] rounded-xl self-start sm:self-auto text-xs font-medium">
            <button
              type="button"
              onClick={() => setPettyHistoryFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                pettyHistoryFilter === 'all'
                  ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                  : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
              }`}
            >
              همه تغییرات
            </button>
            <button
              type="button"
              onClick={() => setPettyHistoryFilter('selected_month')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                pettyHistoryFilter === 'selected_month'
                  ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                  : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
              }`}
            >
              ماه {JALALI_MONTH_NAMES[selectedMonth - 1]}
            </button>
          </div>
        </div>

        {/* History Items */}
        {pettyCashHistory.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#A8B8AF] bg-[#071A14]/60 rounded-2xl border border-[#183D30]/60">
            <Wallet size={24} className="mx-auto mb-2 text-[#A8B8AF]/60" />
            <p>
              {pettyHistoryFilter === 'selected_month'
                ? `در ماه ${JALALI_MONTH_NAMES[selectedMonth - 1]} هیچ تغییر یا شارژی در تنخواه ثبت نشده است.`
                : 'هنوز هیچ تغییری (شارژ یا تنظیم مجدد) برای موجودی تنخواه ثبت نشده است.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pettyCashHistory.map((item) => {
              const isRecharge = item.type === 'recharge';
              const isReset = item.type === 'reset';

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-[#071A14] border border-[#183D30] rounded-2xl hover:border-[#45D69B]/30 transition-colors"
                >
                  {/* Left (Icon & Info) */}
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isRecharge
                          ? 'bg-[#45D69B]/15 text-[#45D69B]'
                          : isReset
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-blue-500/15 text-blue-400'
                      }`}
                    >
                      {isRecharge ? (
                        <PlusCircle size={18} />
                      ) : isReset ? (
                        <RotateCcw size={18} />
                      ) : (
                        <Wallet size={18} />
                      )}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F4F7F5]">
                          {isRecharge
                            ? 'شارژ تنخواه'
                            : isReset
                            ? 'بازنشانی و صفر کردن'
                            : item.type === 'initial'
                            ? 'تعیین موجودی اولیه'
                            : 'تنظیم مجدد سقف تنخواه'}
                        </span>
                        <span className="text-[11px] text-[#A8B8AF]">
                          • {formatJalaliDateFull(item.date)}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-[11px] text-[#A8B8AF]/80 truncate mt-0.5">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right (Amount) */}
                  <div className="text-left shrink-0">
                    {isRecharge ? (
                      <span className="text-sm font-bold text-[#45D69B] tabular-nums">
                        +{formatToman(item.amount)}
                      </span>
                    ) : isReset ? (
                      <span className="text-xs font-semibold text-red-400">
                        صفر شد (تسویه)
                      </span>
                    ) : (
                      <div className="text-left">
                        <span className="text-[10px] text-[#A8B8AF] block">سقف جدید:</span>
                        <span className="text-sm font-bold text-blue-400 tabular-nums">
                          {formatToman(item.amount)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
