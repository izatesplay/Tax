/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Category,
  Expense,
  KharjYarStorageData,
  TabType,
} from './types';
import {
  loadStorageData,
  saveStorageData,
  generateUniqueId,
  DEFAULT_CATEGORIES,
  DEFAULT_PETTY_CASH,
} from './services/storage';
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
import { PettyCashConfig } from './types';

export default function App() {
  const [data, setData] = useState<KharjYarStorageData>(() => loadStorageData());
  const [activeTab, setActiveTab] = useState<TabType>('home');

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

  // Persist data whenever it changes
  const updateData = useCallback(
    (newData: KharjYarStorageData) => {
      setData(newData);
      const res = saveStorageData(newData);
      if (!res.success) {
        showToast(res.error || 'خطا در ذخیره‌سازی اطلاعات!', 'error');
      }
    },
    [showToast]
  );

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

      {/* Top Header */}
      <Header onOpenAddExpense={handleOpenAddExpense} />

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
              updateData({ ...data, categories: newCats })
            }
            onUpdateAllData={(newData) => updateData(newData)}
            onClearAllData={handleClearAllData}
            onShowToast={showToast}
            onOpenPettyCashModal={handleOpenPettyCashModal}
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
