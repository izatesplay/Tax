import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Expense } from '../types';
import { formatToman } from '../utils/formatters';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  expense,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-[#102A21] border border-[#183D30] rounded-3xl p-5 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3.5">
          <AlertTriangle size={24} />
        </div>

        <h3 className="text-base font-bold text-[#F4F7F5] mb-2">
          این هزینه حذف بشه؟
        </h3>

        <div className="bg-[#071A14] border border-[#183D30] rounded-2xl p-3 my-3 text-right">
          <p className="text-sm font-semibold text-[#F4F7F5] truncate mb-1">
            {expense.title}
          </p>
          <p className="text-xs text-[#45D69B] font-medium">
            {formatToman(expense.amount)}
          </p>
        </div>

        <p className="text-xs text-[#A8B8AF] mb-5 leading-relaxed">
          این عملیات قابل بازگشت نیست و هزینه از محاسبات حذف خواهد شد.
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-h-[44px] bg-red-500/90 hover:bg-red-500 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-lg shadow-red-500/20 active:scale-[0.98]"
          >
            حذف کن
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] bg-[#183D30] hover:bg-[#204a3c] text-[#F4F7F5] font-medium text-sm rounded-xl transition-all cursor-pointer active:scale-[0.98]"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
};
