import React from 'react';
import { Home, ReceiptText, PieChart, Settings } from 'lucide-react';
import { TabType } from '../types';

interface NavbarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'home' as TabType, label: 'خانه', icon: Home },
    { id: 'expenses' as TabType, label: 'هزینه‌ها', icon: ReceiptText },
    { id: 'reports' as TabType, label: 'گزارش', icon: PieChart },
    { id: 'settings' as TabType, label: 'تنظیمات', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#102A21]/95 backdrop-blur-md border-t border-[#183D30]">
      <div className="max-w-md mx-auto grid grid-cols-4 items-center h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? 'text-[#45D69B]'
                  : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className="transition-transform duration-150"
              />
              <span className="text-[11px] font-medium tracking-tight">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#45D69B]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
