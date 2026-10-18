import React from 'react';
import { Plus, Wallet, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { SyncStatus } from '../types';

interface HeaderProps {
  onOpenAddExpense: () => void;
  syncStatus?: SyncStatus;
  onManualSync?: () => void;
  onOpenDatabaseSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddExpense,
  syncStatus,
  onManualSync,
  onOpenDatabaseSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#071A14]/90 backdrop-blur-md border-b border-[#183D30]/80">
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#102A21] border border-[#183D30] text-[#45D69B] flex items-center justify-center shrink-0 shadow-sm shadow-[#45D69B]/10">
            <Wallet size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#F4F7F5] truncate">
                خرجیار
              </h1>
              {syncStatus && (
                <button
                  type="button"
                  onClick={onOpenDatabaseSettings || onManualSync}
                  title="وضعیت دیتابیس MySQL (کلیک جهت تنظیمات و همگام‌سازی)"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                    syncStatus.isSyncing
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      : syncStatus.error
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-[#45D69B]/10 text-[#45D69B] border-[#45D69B]/30 hover:bg-[#45D69B]/20'
                  }`}
                >
                  {syncStatus.isSyncing ? (
                    <>
                      <RefreshCw size={11} className="animate-spin text-blue-400" />
                      <span>ذخیره در MySQL...</span>
                    </>
                  ) : syncStatus.error ? (
                    <>
                      <AlertCircle size={11} className="text-amber-400" />
                      <span>خطای اتصال</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#45D69B] animate-pulse" />
                      <Database size={11} className="text-[#45D69B]" />
                      <span>دیتابیس MySQL</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-[#A8B8AF] truncate">
              خرجهات رو راحت‌تر دنبال کن
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onOpenAddExpense}
          className="min-h-[44px] px-3.5 sm:px-5 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#45D69B]/20 active:scale-[0.98] shrink-0"
        >
          <Plus size={18} strokeWidth={2.8} />
          <span>ثبت هزینه</span>
        </button>
      </div>
    </header>
  );
};
