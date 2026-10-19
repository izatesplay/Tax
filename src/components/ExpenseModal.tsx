import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Category, Expense } from '../types';
import { JalaliDatePicker } from './JalaliDatePicker';
import { CategoryIcon } from './CategoryIcon';
import {
  formatToman,
  parsePositiveInteger,
  toPersianDigits,
  parseToEnglishDigits,
} from '../utils/formatters';
import { getTehranToday } from '../utils/jalali';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expenseData: {
    title: string;
    amount: number;
    categoryId: string;
    date: string;
    note?: string;
  }) => void;
  categories: Category[];
  initialExpense?: Expense | null;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  initialExpense,
}) => {
  const [title, setTitle] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEditing = Boolean(initialExpense);

  const prevIsOpenRef = React.useRef(false);
  const prevExpenseIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const isOpening = !prevIsOpenRef.current && isOpen;
    const isDifferentExpense = (initialExpense?.id || null) !== prevExpenseIdRef.current;

    if (isOpen && (isOpening || isDifferentExpense)) {
      setErrorMsg('');
      setIsSubmitting(false);
      if (initialExpense) {
        setTitle(initialExpense.title);
        setAmountRaw(initialExpense.amount.toString());
        setCategoryId(initialExpense.categoryId);
        setDate(initialExpense.date);
        setNote(initialExpense.note || '');
      } else {
        const today = getTehranToday();
        setTitle('');
        setAmountRaw('');
        setCategoryId(categories[0]?.id || 'cat_food');
        setDate(today.iso);
        setNote('');
      }
    }

    prevIsOpenRef.current = isOpen;
    prevExpenseIdRef.current = initialExpense?.id || null;
  }, [isOpen, initialExpense, categories]);

  if (!isOpen) return null;

  // Realtime parsed integer amount
  const parsedAmount = parsePositiveInteger(amountRaw);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow user to type freely, but keep clean
    setAmountRaw(val);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation 1: Title
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg('لطفاً عنوان هزینه را وارد کنید.');
      return;
    }

    // Validation 2: Amount
    const amount = parsePositiveInteger(amountRaw);
    if (!amount) {
      setErrorMsg('مبلغ نامعتبر است. لطفاً یک عدد صحیح مثبت به تومان وارد کنید.');
      return;
    }

    // Validation 3: Category
    if (!categoryId) {
      setErrorMsg('لطفاً دسته‌بندی را انتخاب کنید.');
      return;
    }

    // Validation 4: Date
    if (!date) {
      setErrorMsg('لطفاً تاریخ را مشخص کنید.');
      return;
    }

    setIsSubmitting(true);

    try {
      onSave({
        title: trimmedTitle,
        amount,
        categoryId,
        date,
        note: note.trim() || undefined,
      });
    } finally {
      // Form closes via parent onClose, but reset submitting state just in case
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md max-h-[92vh] flex flex-col bg-[#102A21] border border-[#183D30] rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#183D30] shrink-0">
          <h2 className="text-base font-bold text-[#F4F7F5]">
            {isEditing ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] rounded-xl hover:bg-[#183D30] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
              عنوان هزینه <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrorMsg('');
              }}
              placeholder="مثلاً: خرید نان، کرایه تاکسی، قهوه..."
              className="w-full min-h-[44px] px-3.5 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] focus:ring-1 focus:ring-[#45D69B] rounded-xl text-[#F4F7F5] placeholder-[#A8B8AF]/40 text-sm outline-none transition-all"
              autoFocus
            />
          </div>

          {/* Amount in Tomans */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#A8B8AF]">
                مبلغ (تومان) <span className="text-red-400">*</span>
              </label>
              {parsedAmount && (
                <span className="text-xs font-bold text-[#45D69B] animate-in fade-in">
                  {formatToman(parsedAmount)}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amountRaw}
                onChange={handleAmountChange}
                placeholder="مثلاً: ۸۰,۰۰۰ یا 80000"
                className="w-full min-h-[44px] px-3.5 pl-14 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] focus:ring-1 focus:ring-[#45D69B] rounded-xl text-[#F4F7F5] placeholder-[#A8B8AF]/40 text-sm outline-none transition-all tabular-nums"
                dir="ltr"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#A8B8AF] pointer-events-none">
                تومان
              </span>
            </div>
            <p className="text-[11px] text-[#A8B8AF]/80 mt-1">
              پذیرش ارقام فارسی و انگلیسی؛ مبالغ مستقیماً به تومان است.
            </p>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
              دسته‌بندی <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(cat.id);
                      setErrorMsg('');
                    }}
                    className={`min-h-[44px] p-2 flex items-center gap-2 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#45D69B]/15 border-[#45D69B] text-[#45D69B] font-semibold'
                        : 'bg-[#071A14] border-[#183D30] text-[#F4F7F5] hover:border-[#183D30]/80 hover:bg-[#183D30]/30'
                    }`}
                  >
                    <CategoryIcon
                      iconName={cat.icon}
                      color={isSelected ? '#45D69B' : cat.color}
                      className="w-7 h-7"
                      size={15}
                    />
                    <span className="text-xs truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shamsi Date */}
          <div>
            <JalaliDatePicker
              label="تاریخ (شمسی)"
              value={date}
              onChange={(newDate) => setDate(newDate)}
            />
          </div>

          {/* Note (optional) */}
          <div>
            <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
              یادداشت (اختیاری)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="توضیح بیشتر در صورت نیاز..."
              className="w-full p-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] focus:ring-1 focus:ring-[#45D69B] rounded-xl text-[#F4F7F5] placeholder-[#A8B8AF]/40 text-sm outline-none transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[46px] bg-[#45D69B] hover:bg-[#3ec48d] disabled:opacity-50 disabled:cursor-not-allowed text-[#071A14] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#45D69B]/15 active:scale-[0.98]"
            >
              <Check size={18} strokeWidth={2.5} />
              <span>{isEditing ? 'ذخیره تغییرات' : 'ثبت هزینه'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[46px] px-5 bg-[#183D30] hover:bg-[#204a3c] text-[#F4F7F5] font-medium text-sm rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
