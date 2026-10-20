/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Category,
  Expense,
  KharjYarStorageData,
  TabType,
  SyncStatus,
  PettyCashConfig,
} from './types';
import {
  loadStorageData,
  saveStorageData,
  generateUniqueId,
  DEFAULT_CATEGORIES,
  DEFAULT_PETTY_CASH,
  normalizePettyCash,
} from './services/storage';
import {
  fetchAllFromDatabase,
  syncAllToDatabase,
} from './services/apiBridge';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { ExpenseModal } from './components/ExpenseModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { PettyCashModal } from './components/PettyCashModal';
import { Toast, ToastMessage } from './components/Toast';
import { HomeView } from './views/HomeView';
import { ExpensesView } from './views/ExpensesView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';

const PENDING_SYNC_STORAGE_KEY = 'kharjyar_pending_sync';

export default function App() {
  const [data, setData] = useState<KharjYarStorageData>(() => loadStorageData());
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Cloud & MySQL Database Sync Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
    mode: 'cpanel',
  });

  // Modal states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const [isPettyCashModalOpen, setIsPettyCashModalOpen] = useState(false);
  const [pettyCashModalMode, setPettyCashModalMode] = useState<'set_balance' | 'recharge'>('set_balance');

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isPushingRef = useRef(false);
  const pendingPushPayloadRef = useRef<KharjYarStorageData | null>(null);
  const mutationVersionRef = useRef(0);
  const latestDataRef = useRef(data);
  latestDataRef.current = data;

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = Date.now().toString() + Math.random().toString();
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Save changes to database immediately (Serialized queue so rapid deletes never overlap)
  const pushToRemote = useCallback(
    async (payload: KharjYarStorageData) => {
      pendingPushPayloadRef.current = payload;
      if (isPushingRef.current) {
        return;
      }

      isPushingRef.current = true;
      setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

      try {
        while (pendingPushPayloadRef.current) {
          const currentPayload = pendingPushPayloadRef.current;
          pendingPushPayloadRef.current = null;

          const result = await syncAllToDatabase(undefined, currentPayload);
          if (result.ok) {
            if (!pendingPushPayloadRef.current) {
              try {
                localStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
              } catch {}
            }
            const nowTime = new Date().toLocaleTimeString('fa-IR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            setSyncStatus((prev) => ({
              ...prev,
              isSyncing: Boolean(pendingPushPayloadRef.current),
              isOnline: true,
              lastSyncedAt: nowTime,
              error: null,
              mode: 'cpanel',
            }));
          } else {
            setSyncStatus((prev) => ({
              ...prev,
              isSyncing: false,
              error: result.message,
              mode: 'cpanel',
            }));
          }
        }
      } catch (err: any) {
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          error: err?.message || 'خطا در ارتباط با دیتابیس MySQL',
          mode: 'cpanel',
        }));
      } finally {
        isPushingRef.current = false;
      }
    },
    []
  );

  // Persist data locally and immediately push to MySQL database
  const updateData = useCallback(
    (newData: KharjYarStorageData, shouldPushToRemote = true) => {
      const normalizedData: KharjYarStorageData = {
        ...newData,
        pettyCash: normalizePettyCash(newData.pettyCash),
        updatedAt: new Date().toISOString(),
      };

      mutationVersionRef.current += 1;
      latestDataRef.current = normalizedData;
      setData(normalizedData);
      saveStorageData(normalizedData);

      if (shouldPushToRemote) {
        try {
          localStorage.setItem(PENDING_SYNC_STORAGE_KEY, 'true');
        } catch {}
        pushToRemote(normalizedData);
      }
    },
    [pushToRemote]
  );

  // Fetch freshest data directly from MySQL database
  const pullFromRemote = useCallback(
    async (quiet = false) => {
      if (isPushingRef.current) return;
      const pullStartMutation = mutationVersionRef.current;
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

      try {
        // If a previous delete/edit was interrupted by an immediate refresh before reaching DB, push it first
        let hasPendingLocalMutation = false;
        try {
          hasPendingLocalMutation = localStorage.getItem(PENDING_SYNC_STORAGE_KEY) === 'true';
        } catch {}

        if (hasPendingLocalMutation) {
          const pushRes = await syncAllToDatabase(undefined, latestDataRef.current);
          if (pushRes.ok) {
            try {
              localStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
            } catch {}
          }
        }

        const res = await fetchAllFromDatabase();

        // Abort applying remote data if the user triggered a new delete/add while fetch was in flight
        if (mutationVersionRef.current !== pullStartMutation || isPushingRef.current) {
          return;
        }

        if (res.ok && res.data) {
          const remoteData: KharjYarStorageData = {
            ...res.data,
            expenses: Array.isArray(res.data.expenses) ? res.data.expenses : [],
            categories:
              Array.isArray(res.data.categories) && res.data.categories.length > 0
                ? res.data.categories
                : [...DEFAULT_CATEGORIES],
            pettyCash: normalizePettyCash(res.data.pettyCash),
            updatedAt: res.data.updatedAt || new Date().toISOString(),
          };

          latestDataRef.current = remoteData;
          setData(remoteData);
          saveStorageData(remoteData);

          if (!quiet) {
            showToast('اطلاعات با موفقیت از دیتابیس MySQL همگام‌سازی شد 🗄️', 'info');
          }

          const nowTime = new Date().toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            isOnline: true,
            lastSyncedAt: nowTime,
            error: null,
            mode: 'cpanel',
          }));
        } else {
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            error: res.message,
            mode: 'cpanel',
          }));
        }
      } catch (err: any) {
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          error: err?.message || 'خطا در بارگذاری از دیتابیس MySQL',
          mode: 'cpanel',
        }));
      }
    },
    [showToast]
  );

  // Initial data load on mount (no automatic recurring polling so user input never resets while typing)
  useEffect(() => {
    // Read from MySQL database once on startup
    pullFromRemote(true);

    const handleOnline = () => {
      setSyncStatus((prev) => ({ ...prev, isOnline: true }));
    };
    const handleOffline = () => {
      setSyncStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pullFromRemote]);

  // Open add expense modal
  const handleOpenAddExpense = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  // Open edit expense modal
  const handleOpenEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsExpenseModalOpen(true);
  };

  // Save Expense (both Add and Edit) - Instant save to MySQL
  const handleSaveExpense = (expenseData: {
    title: string;
    amount: number;
    categoryId: string;
    date: string;
    note?: string;
  }) => {
    const nowIso = new Date().toISOString();

    if (expenseToEdit) {
      // Edit existing expense
      const updatedExpenses = data.expenses.map((item) =>
        item.id === expenseToEdit.id
          ? {
              ...item,
              title: expenseData.title,
              amount: expenseData.amount,
              categoryId: expenseData.categoryId,
              date: expenseData.date,
              note: expenseData.note,
              updatedAt: nowIso,
            }
          : item
      );

      updateData({
        ...data,
        expenses: updatedExpenses,
        updatedAt: nowIso,
      });

      setIsExpenseModalOpen(false);
      setExpenseToEdit(null);
      showToast('هزینه با موفقیت ویرایش و در دیتابیس ذخیره شد ✅', 'success');
    } else {
      // Add new expense
      const newExpense: Expense = {
        id: generateUniqueId('exp'),
        title: expenseData.title,
        amount: expenseData.amount,
        categoryId: expenseData.categoryId,
        date: expenseData.date,
        note: expenseData.note,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      updateData({
        ...data,
        expenses: [newExpense, ...data.expenses],
        updatedAt: nowIso,
      });

      setIsExpenseModalOpen(false);
      showToast('هزینه‌ات در دیتابیس ثبت شد ✅', 'success');
    }
  };

  // Delete Request
  const handleRequestDelete = (expense: Expense) => {
    setExpenseToDelete(expense);
  };

  // Confirm Delete - Instant save to MySQL
  const handleConfirmDelete = () => {
    if (!expenseToDelete) return;
    const remaining = data.expenses.filter((e) => e.id !== expenseToDelete.id);
    updateData({
      ...data,
      expenses: remaining,
      updatedAt: new Date().toISOString(),
    });
    setExpenseToDelete(null);
    showToast('هزینه با موفقیت حذف و از دیتابیس پاک شد 🗑️', 'success');
  };

  // Petty cash handlers - Instant save to MySQL
  const handleOpenPettyCashModal = (mode: 'set_balance' | 'recharge' = 'set_balance') => {
    setPettyCashModalMode(mode);
    setIsPettyCashModalOpen(true);
  };

  const handleSavePettyCash = (updatedConfig: PettyCashConfig) => {
    updateData({
      ...data,
      pettyCash: updatedConfig,
      updatedAt: new Date().toISOString(),
    });
    showToast('موجودی تنخواه در دیتابیس به‌روزرسانی شد ✅', 'success');
  };

  // Clear all data
  const handleClearAllData = () => {
    const emptyData: KharjYarStorageData = {
      version: 1,
      expenses: [],
      categories: [...DEFAULT_CATEGORIES],
      pettyCash: { ...DEFAULT_PETTY_CASH },
      updatedAt: new Date().toISOString(),
    };
    updateData(emptyData);
    showToast('تمام اطلاعات با موفقیت پاک شد', 'info');
  };

  return (
    <div className="min-h-screen bg-[#071A14] text-[#F4F7F5] flex flex-col font-sans select-none antialiased">
      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header with live MySQL sync status */}
      <Header
        onOpenAddExpense={handleOpenAddExpense}
        syncStatus={syncStatus}
        onManualSync={() => pullFromRemote(false)}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        {activeTab === 'home' && (
          <HomeView
            expenses={data.expenses}
            categories={data.categories}
            pettyCash={data.pettyCash}
            onOpenAddExpense={handleOpenAddExpense}
            onEditExpense={handleOpenEditExpense}
            onRequestDelete={handleRequestDelete}
            onNavigateToExpenses={() => setActiveTab('expenses')}
            onOpenPettyCashModal={handleOpenPettyCashModal}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView
            expenses={data.expenses}
            categories={data.categories}
            onOpenAddExpense={handleOpenAddExpense}
            onEditExpense={handleOpenEditExpense}
            onRequestDelete={handleRequestDelete}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            expenses={data.expenses}
            categories={data.categories}
            pettyCash={data.pettyCash}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            data={data}
            onUpdateCategories={(newCats) =>
              updateData({ ...data, categories: newCats, updatedAt: new Date().toISOString() })
            }
            onUpdateAllData={(newData) => updateData(newData)}
            onClearAllData={handleClearAllData}
            onShowToast={showToast}
            onOpenPettyCashModal={handleOpenPettyCashModal}
            syncStatus={syncStatus}
            onManualSync={() => pullFromRemote(false)}
          />
        )}
      </main>

      {/* Bottom Sticky Tab Navigation */}
      <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Add / Edit Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseToEdit(null);
        }}
        onSave={handleSaveExpense}
        categories={data.categories}
        initialExpense={expenseToEdit}
      />

      {/* Petty Cash Modal */}
      <PettyCashModal
        isOpen={isPettyCashModalOpen}
        onClose={() => setIsPettyCashModalOpen(false)}
        pettyCash={data.pettyCash}
        onSaveConfig={handleSavePettyCash}
        defaultMode={pettyCashModalMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(expenseToDelete)}
        expense={expenseToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
}
