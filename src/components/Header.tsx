import React from 'react';
import { Plus, Wallet } from 'lucide-react';

interface HeaderProps {
  onOpenAddExpense: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddExpense }) => {
  return (
    <header className="sticky top-0 z-30 bg-[#071A14]/90 backdrop-blur-md border-b border-[#183D30]/80">
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#102A21] border border-[#183D30] text-[#45D69B] flex items-center justify-center shrink-0 shadow-sm shadow-[#45D69B]/10">
            <Wallet size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#F4F7F5]">
              خرجیار
            </h1>
            <p className="text-xs text-[#A8B8AF]">
              خرجهات رو راحت‌تر دنبال کن
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onOpenAddExpense}
          className="min-h-[44px] px-4 sm:px-5 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#45D69B]/20 active:scale-[0.98] shrink-0"
        >
          <Plus size={18} strokeWidth={2.8} />
          <span>ثبت هزینه</span>
        </button>
      </div>
    </header>
  );
};
