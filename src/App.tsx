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
} from './services/storage';
import {
  fetchAllFromDatabase,
  syncAllToDatabase,
  getSavedApiMode,
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

export default function App() {
  const [data, setData] = useState<KharjYarStorageData>(() => loadStorageData());
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Cloud & Database Sync Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
    mode: getSavedApiMode(),
  });

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Petty Cash modal state
  const [isPettyCashModalOpen, setIsPettyCashModalOpen] = useState(false);
  const [pettyCashModalMode, setPettyCashModalMode] = useState<'set_balance' | 'recharge'>('set_balance');

  // Delete modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isSyncingRef = useRef(false);
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

  // Sync to database backend
  const pushToRemote = useCallback(
    async (payload: KharjYarStorageData) => {
      isSyncingRef.current = true;
      setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

      try {
        const result = await syncAllToDatabase(undefined, payload);
        if (result.ok) {
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
            mode: getSavedApiMode(),
          }));
        } else {
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            error: result.message,
            mode: getSavedApiMode(),
          }));
        }
      } catch (err: any) {
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          error: err?.message || 'خطا در ارتباط با دیتابیس',
          mode: getSavedApiMode(),
        }));
      } finally {
        isSyncingRef.current = false;
      }
    },
    []
  );

  // Persist data locally and automatically sync to remote database
  const updateData = useCallback(
    (newData: KharjYarStorageData, shouldPushToRemote = true) => {
      setData(newData);
      saveStorageData(newData);

      if (shouldPushToRemote) {
        pushToRemote(newData);
      }
    },
    [pushToRemote]
  );

  // Fetch latest data from database
  const pullFromRemote = useCallback(
    async (quiet = false) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

      try {
        const res = await fetchAllFromDatabase();
        if (res.ok && res.data) {
          const remoteData = res.data;
          const currentLocal = latestDataRef.current;

          // If remote has expenses or remote was updated more recently
          const remoteExpenses = Array.isArray(remoteData.expenses) ? remoteData.expenses : [];
          const localExpenses = Array.isArray(currentLocal.expenses) ? currentLocal.expenses : [];

          // Case 1: Remote has data and local is empty -> adopt remote
          if (remoteExpenses.length > 0 && localExpenses.length === 0) {
            setData(remoteData);
            saveStorageData(remoteData);
            if (!quiet) {
              showToast('اطلاعات با موفقیت از دیتابیس همگام‌سازی شد ☁️', 'info');
            }
          }
          // Case 2: Local has data but remote is empty (first migration) -> push to remote
          else if (localExpenses.length > 0 && remoteExpenses.length === 0) {
            await syncAllToDatabase(undefined, currentLocal);
          }
          // Case 3: Compare updatedAt timestamps
          else {
            const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
            const localTime = currentLocal.updatedAt ? new Date(currentLocal.updatedAt).getTime() : 0;

            if (remoteTime > localTime) {
              setData(remoteData);
              saveStorageData(remoteData);
            }
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
            mode: getSavedApiMode(),
          }));
        } else {
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            error: res.message,
            mode: getSavedApiMode(),
          }));
        }
      } catch (err: any) {
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          error: err?.message || 'خطا در بارگذاری از دیتابیس',
          mode: getSavedApiMode(),
        }));
      } finally {
        isSyncingRef.current = false;
      }
    },
    [showToast]
  );

  // Initial pull on mount & periodic polling for multi-device sync
  useEffect(() => {
    // Initial fetch from database
    pullFromRemote(true);

    // Online/offline handlers
    const handleOnline = () => {
      setSyncStatus((prev) => ({ ...prev, isOnline: true }));
      pullFromRemote(true);
    };
    const handleOffline = () => {
      setSyncStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Background sync on tab focus or visibility change (e.g. mobile unlock)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pullFromRemote(true);
      }
    };
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic polling every 12 seconds so all devices stay updated in real-time
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !isSyncingRef.current) {
        pullFromRemote(true);
      }
    }, 12000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [pullFromRemote]);

  // Open add modal
  const handleOpenAddExpense = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsExpenseModalOpen(true);
  };

  // Save Expense (both Add and Edit)
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
      showToast('هزینه با موفقیت ویرایش شد ✅', 'success');
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
      showToast('هزینه‌ات ثبت شد ✅', 'success');
    }
  };

  // Delete Request
  const handleRequestDelete = (expense: Expense) => {
    setExpenseToDelete(expense);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!expenseToDelete) return;
    const remaining = data.expenses.filter((e) => e.id !== expenseToDelete.id);
    updateData({
      ...data,
      expenses: remaining,
      updatedAt: new Date().toISOString(),
    });
    setExpenseToDelete(null);
    showToast('هزینه با موفقیت حذف شد 🗑️', 'success');
  };

  // Petty cash handlers
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
    showToast('موجودی تنخواه با موفقیت به‌روزرسانی شد ✅', 'success');
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

      {/* Top Header with live sync status */}
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
