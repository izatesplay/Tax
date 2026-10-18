import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import {
  isoToJalali,
  jalaliToIso,
  getTehranToday,
  formatJalaliDateFull,
  JALALI_MONTH_NAMES,
  getDaysInJalaliMonth,
} from '../utils/jalali';
import { toPersianDigits } from '../utils/formatters';

interface JalaliDatePickerProps {
  value: string; // ISO date YYYY-MM-DD
  onChange: (isoDate: string) => void;
  label?: string;
  className?: string;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  label,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const today = getTehranToday();

  // If value is missing or invalid, fallback to today's ISO
  const safeIso = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today.iso;
  const currentJalali = isoToJalali(safeIso);

  const [viewYear, setViewYear] = useState(currentJalali.jy);
  const [viewMonth, setViewMonth] = useState(currentJalali.jm);

  const daysInCurrentMonth = getDaysInJalaliMonth(viewYear, viewMonth);

  const handleSelectDay = (day: number) => {
    const newIso = jalaliToIso(viewYear, viewMonth, day);
    onChange(newIso);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    onChange(today.iso);
    setViewYear(today.jalali.jy);
    setViewMonth(today.jalali.jm);
    setIsOpen(false);
  };

  const handlePrevDay = () => {
    let { jy, jm, jd } = currentJalali;
    jd -= 1;
    if (jd < 1) {
      jm -= 1;
      if (jm < 1) {
        jm = 12;
        jy -= 1;
      }
      jd = getDaysInJalaliMonth(jy, jm);
    }
    onChange(jalaliToIso(jy, jm, jd));
    setViewYear(jy);
    setViewMonth(jm);
  };

  const handleNextDay = () => {
    let { jy, jm, jd } = currentJalali;
    const maxDays = getDaysInJalaliMonth(jy, jm);
    jd += 1;
    if (jd > maxDays) {
      jd = 1;
      jm += 1;
      if (jm > 12) {
        jm = 1;
        jy += 1;
      }
    }
    onChange(jalaliToIso(jy, jm, jd));
    setViewYear(jy);
    setViewMonth(jm);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isSelectedToday = safeIso === today.iso;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
          {label}
        </label>
      )}

      {/* Main trigger container */}
      <div className="flex items-center gap-1.5 bg-[#102A21] border border-[#183D30] rounded-xl p-1 focus-within:border-[#45D69B] transition-colors">
        <button
          type="button"
          onClick={handleNextDay}
          title="روز بعد"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#A8B8AF] hover:text-[#45D69B] hover:bg-[#183D30]/60 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>

        <button
          type="button"
          onClick={() => {
            setViewYear(currentJalali.jy);
            setViewMonth(currentJalali.jm);
            setIsOpen(!isOpen);
          }}
          className="flex-1 min-h-[44px] px-2 flex items-center justify-between text-right cursor-pointer hover:bg-[#183D30]/40 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <Calendar size={18} className="text-[#45D69B] shrink-0" />
            <span className="text-sm font-medium text-[#F4F7F5] truncate">
              {formatJalaliDateFull(safeIso)}
            </span>
            {isSelectedToday && (
              <span className="text-[11px] text-[#45D69B] font-medium bg-[#45D69B]/10 px-2 py-0.5 rounded-full">
                امروز
              </span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-[#A8B8AF] transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={handlePrevDay}
          title="روز قبل"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#A8B8AF] hover:text-[#45D69B] hover:bg-[#183D30]/60 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Dropdown Calendar Picker */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#102A21] border border-[#183D30] rounded-2xl p-4 shadow-2xl backdrop-blur-md">
            {/* Year & Month Controller */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#183D30]">
              <button
                type="button"
                onClick={handleNextMonth}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30] rounded-lg transition-colors cursor-pointer"
                title="ماه بعد"
              >
                <ChevronRight size={18} />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#F4F7F5]">
                  {JALALI_MONTH_NAMES[viewMonth - 1]}
                </span>
                <span className="text-sm font-semibold text-[#45D69B]">
                  {toPersianDigits(viewYear)}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePrevMonth}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30] rounded-lg transition-colors cursor-pointer"
                title="ماه قبل"
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            {/* Months Selector Bar (Horizontal scroll if needed) */}
            <div className="grid grid-cols-4 gap-1.5 mb-3 text-xs">
              {JALALI_MONTH_NAMES.map((mName, idx) => {
                const mNum = idx + 1;
                const isCurrentViewMonth = viewMonth === mNum;
                return (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => setViewMonth(mNum)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-colors font-medium truncate cursor-pointer ${
                      isCurrentViewMonth
                        ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                        : 'text-[#A8B8AF] hover:text-[#F4F7F5] hover:bg-[#183D30]'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map(
                (day) => {
                  const isDaySelected =
                    currentJalali.jy === viewYear &&
                    currentJalali.jm === viewMonth &&
                    currentJalali.jd === day;

                  const isDayToday =
                    today.jalali.jy === viewYear &&
                    today.jalali.jm === viewMonth &&
                    today.jalali.jd === day;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`min-h-[38px] flex items-center justify-center rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        isDaySelected
                          ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-md shadow-[#45D69B]/20 scale-105'
                          : isDayToday
                          ? 'border border-[#45D69B] text-[#45D69B] hover:bg-[#183D30]'
                          : 'text-[#F4F7F5] hover:bg-[#183D30] hover:text-white'
                      }`}
                    >
                      {toPersianDigits(day)}
                    </button>
                  );
                }
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[#183D30]">
              <button
                type="button"
                onClick={handleSetToday}
                className="min-h-[40px] px-3 flex items-center gap-1.5 text-xs font-semibold text-[#45D69B] hover:bg-[#45D69B]/10 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                برو به امروز
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[40px] px-3 text-xs text-[#A8B8AF] hover:text-[#F4F7F5] rounded-lg transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
