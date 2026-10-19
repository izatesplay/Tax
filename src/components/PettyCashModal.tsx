import React, { useState, useEffect } from 'react';
import { X, Check, Wallet, PlusCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { PettyCashConfig, PettyCashRecharge, PettyCashEvent } from '../types';
import { JalaliDatePicker } from './JalaliDatePicker';
import {
  formatToman,
  parsePositiveInteger,
  toPersianDigits,
} from '../utils/formatters';
import { getTehranToday } from '../utils/jalali';
import { generateUniqueId } from '../services/storage';

interface PettyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  pettyCash: PettyCashConfig;
  onSaveConfig: (updatedConfig: PettyCashConfig) => void;
  defaultMode?: 'set_balance' | 'recharge';
}

export const PettyCashModal: React.FC<PettyCashModalProps> = ({
  isOpen,
  onClose,
  pettyCash,
  onSaveConfig,
  defaultMode = 'set_balance',
}) => {
  const [mode, setMode] = useState<'set_balance' | 'recharge'>(defaultMode);

  // Set Balance Form
  const [balanceRaw, setBalanceRaw] = useState('');

  // Recharge Form
  const [rechargeRaw, setRechargeRaw] = useState('');
  const [rechargeDate, setRechargeDate] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    const isOpening = !prevIsOpenRef.current && isOpen;
    if (isOpen && isOpening) {
      setMode(defaultMode);
      setErrorMsg('');
      setIsSubmitting(false);
      setBalanceRaw(pettyCash.initialBalance > 0 ? pettyCash.initialBalance.toString() : '');
      setRechargeRaw('');
      setRechargeDate(getTehranToday().iso);
      setRechargeNote('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultMode, pettyCash]);

  if (!isOpen) return null;

  const parsedBalance = parsePositiveInteger(balanceRaw);
  const parsedRecharge = parsePositiveInteger(rechargeRaw);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (mode === 'set_balance') {
      const amount = parsePositiveInteger(balanceRaw);
      if (amount === null && balanceRaw.trim() !== '0') {
        setErrorMsg('لطفاً مبلغ معتبری به تومان وارد کنید.');
        return;
      }

      setIsSubmitting(true);
      const newAmount = amount !== null ? amount : 0;
      const todayIso = getTehranToday().iso;

      const newEvent: PettyCashEvent = {
        id: generateUniqueId('pevt'),
        type: pettyCash.initialBalance === 0 ? 'initial' : 'set_balance',
        amount: newAmount,
        previousBalance: pettyCash.initialBalance,
        newBalance: newAmount,
        date: todayIso,
        note: pettyCash.initialBalance === 0 ? 'ثبت موجودی اولیه تنخواه' : 'تنظیم مجدد موجودی پایه',
        createdAt: new Date().toISOString(),
      };

      onSaveConfig({
        ...pettyCash,
        initialBalance: newAmount,
        history: [newEvent, ...(pettyCash.history || [])],
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } else {
      // Recharge
      const amount = parsePositiveInteger(rechargeRaw);
      if (!amount) {
        setErrorMsg('لطفاً مبلغ شارژ را به تومان و عدد صحیح مثبت وارد کنید.');
        return;
      }
      if (!rechargeDate) {
        setErrorMsg('لطفاً تاریخ شارژ را مشخص کنید.');
        return;
      }

      setIsSubmitting(true);
      const nowIso = new Date().toISOString();
      const newRecharge: PettyCashRecharge = {
        id: generateUniqueId('rech'),
        amount,
        date: rechargeDate,
        note: rechargeNote.trim() || undefined,
        createdAt: nowIso,
      };

      const newEvent: PettyCashEvent = {
        id: generateUniqueId('pevt'),
        type: 'recharge',
        amount,
        date: rechargeDate,
        note: rechargeNote.trim() || undefined,
        createdAt: nowIso,
      };

      onSaveConfig({
        ...pettyCash,
        recharges: [newRecharge, ...(pettyCash.recharges || [])],
        history: [newEvent, ...(pettyCash.history || [])],
        updatedAt: nowIso,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md max-h-[92vh] flex flex-col bg-[#102A21] border border-[#183D30] rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#183D30] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <h2 className="text-base font-bold text-[#F4F7F5]">
              مدیریت موجودی تنخواه
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] rounded-xl hover:bg-[#183D30] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="p-4 pb-0 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-[#071A14] border border-[#183D30] rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('set_balance');
                setErrorMsg('');
              }}
              className={`min-h-[40px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'set_balance'
                  ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                  : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
              }`}
            >
              <Wallet size={15} />
              <span>تنظیم موجودی پایه</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('recharge');
                setErrorMsg('');
              }}
              className={`min-h-[40px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'recharge'
                  ? 'bg-[#45D69B] text-[#071A14] font-bold shadow-sm'
                  : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
              }`}
            >
              <PlusCircle size={15} />
              <span>شارژ تنخواه (+)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs leading-relaxed flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'set_balance' ? (
            /* Mode 1: Set Base Balance */
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#A8B8AF]">
                    مبلغ موجودی پایه تنخواه (تومان) <span className="text-red-400">*</span>
                  </label>
                  {parsedBalance !== null && (
                    <span className="text-xs font-bold text-[#45D69B]">
                      {formatToman(parsedBalance)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={balanceRaw}
                    onChange={(e) => {
                      setBalanceRaw(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="مثلاً: ۵,۰۰۰,۰۰۰ یا 5000000"
                    className="w-full min-h-[44px] px-3.5 pl-14 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] focus:ring-1 focus:ring-[#45D69B] rounded-xl text-[#F4F7F5] placeholder-[#A8B8AF]/40 text-sm outline-none transition-all tabular-nums"
                    dir="ltr"
                    autoFocus
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#A8B8AF] pointer-events-none">
                    تومان
                  </span>
                </div>
                <p className="text-[11px] text-[#A8B8AF]/80 mt-1.5 leading-relaxed">
                  موجودی کل یا اولیه تنخواهی که در اختیار دارید. تمام هزینه‌های ثبت‌شده خودکار از این موجودی کسر می‌شوند.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-[#A8B8AF]">مبالغ پیشنهادی:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[1000000, 2000000, 5000000, 10000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBalanceRaw(amt.toString())}
                      className="min-h-[32px] px-2.5 bg-[#071A14] hover:bg-[#183D30] border border-[#183D30] rounded-lg text-xs text-[#F4F7F5] transition-colors cursor-pointer tabular-nums"
                    >
                      {formatToman(amt)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Recharge */
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#A8B8AF]">
                    مبلغ شارژ تنخواه (تومان) <span className="text-red-400">*</span>
                  </label>
                  {parsedRecharge !== null && (
                    <span className="text-xs font-bold text-[#45D69B]">
                      {formatToman(parsedRecharge)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={rechargeRaw}
                    onChange={(e) => {
                      setRechargeRaw(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="مثلاً: ۱,۰۰۰,۰۰۰ یا 1000000"
                    className="w-full min-h-[44px] px-3.5 pl-14 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] focus:ring-1 focus:ring-[#45D69B] rounded-xl text-[#F4F7F5] placeholder-[#A8B8AF]/40 text-sm outline-none transition-all tabular-nums"
                    dir="ltr"
                    autoFocus
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#A8B8AF] pointer-events-none">
                    تومان
                  </span>
                </div>
              </div>

              <div>
                <JalaliDatePicker
                  label="تاریخ شارژ"
                  value={rechargeDate}
                  onChange={(d) => setRechargeDate(d)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8B8AF] mb-1.5">
                  توضیح یا یادداشت شارژ (اختیاری)
                </label>
                <input
                  type="text"
                  value={rechargeNote}
                  onChange={(e) => setRechargeNote(e.target.value)}
                  placeholder="مثلاً: واریز تنخواه جدید، شارژ هفتگی..."
                  className="w-full min-h-[44px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-sm text-[#F4F7F5] placeholder-[#A8B8AF]/40 outline-none"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[46px] bg-[#45D69B] hover:bg-[#3ec48d] disabled:opacity-50 text-[#071A14] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#45D69B]/15 active:scale-[0.98]"
            >
              <Check size={18} strokeWidth={2.5} />
              <span>
                {mode === 'set_balance' ? 'ثبت و ذخیره موجودی' : 'افزودن شارژ'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
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
