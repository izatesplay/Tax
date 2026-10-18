import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Database,
  Check,
  AlertTriangle,
  RefreshCw,
  FileCode,
  Download,
  Key,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import {
  getSavedApiMode,
  saveApiMode,
  getSavedApiEndpoint,
  saveApiEndpoint,
  checkApiStatus,
  fetchServerMysqlConfig,
  saveServerMysqlConfig,
  testServerMysqlConnection,
  downloadApiPhpScript,
  ApiMode,
} from '../services/apiBridge';
import { toPersianDigits } from '../utils/formatters';

interface MysqlConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onTriggerSync: () => void;
}

export const MysqlConfigModal: React.FC<MysqlConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onTriggerSync,
}) => {
  const [activeTab, setActiveTab] = useState<'server' | 'cpanel'>('server');

  // Server MySQL connection state
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('3306');
  const [user, setUser] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('kharjyar_db');
  const [isServerMysqlEnabled, setIsServerMysqlEnabled] = useState(false);

  // cPanel api.php state
  const [cpanelUrl, setCpanelUrl] = useState(() => getSavedApiEndpoint() || '');

  // Testing & Status
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; details?: any } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      const mode = getSavedApiMode();
      setActiveTab(mode === 'cpanel' ? 'cpanel' : 'server');
      setCpanelUrl(getSavedApiEndpoint() || '');

      // Load server mysql config
      fetchServerMysqlConfig().then((cfg) => {
        if (cfg) {
          setHost(cfg.host || 'localhost');
          setPort(String(cfg.port || 3306));
          setUser(cfg.user || 'root');
          setDatabase(cfg.database || 'kharjyar_db');
          setIsServerMysqlEnabled(Boolean(cfg.enabled));
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Test Server MySQL
  const handleTestServerMysql = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testServerMysqlConnection({
        host,
        port: parseInt(port, 10) || 3306,
        user,
        password,
        database,
      });
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  // Save Server MySQL Config
  const handleSaveServerMysql = async () => {
    setIsSaving(true);
    try {
      const res = await saveServerMysqlConfig({
        enabled: true,
        host,
        port: parseInt(port, 10) || 3306,
        user,
        password,
        database,
      });

      if (res.ok) {
        saveApiMode('cloud');
        onSuccess('تنظیمات پایگاه‌داده MySQL ذخیره و فعال شد ✅');
        onTriggerSync();
        onClose();
      } else {
        setTestResult({ ok: false, message: res.message });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Test cPanel api.php
  const handleTestCpanel = async () => {
    if (!cpanelUrl.trim()) {
      setTestResult({ ok: false, message: 'لطفاً آدرس اینترنتی api.php را وارد نمایید.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await checkApiStatus(cpanelUrl.trim(), 'cpanel');
      setTestResult({
        ok: res.ok,
        message: res.message,
        details: res.data,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save cPanel api.php
  const handleSaveCpanel = () => {
    if (!cpanelUrl.trim()) {
      setTestResult({ ok: false, message: 'لطفاً آدرس اینترنتی api.php را وارد نمایید.' });
      return;
    }
    saveApiEndpoint(cpanelUrl.trim());
    saveApiMode('cpanel');
    onSuccess('پل اتصال به هاست cPanel فعال شد ✅');
    onTriggerSync();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#102A21] border border-[#183D30] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#183D30]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#45D69B]/10 text-[#45D69B] flex items-center justify-center shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F4F7F5]">
                تنظیمات پایگاه‌داده MySQL
              </h2>
              <p className="text-xs text-[#A8B8AF]">
                همگام‌سازی مستقیم و بلادرنگ تمام هزینه‌ها و اطلاعات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#A8B8AF] hover:text-[#F4F7F5] rounded-xl hover:bg-[#183D30] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-1 bg-[#071A14] border border-[#183D30] rounded-2xl flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('server');
              setTestResult(null);
            }}
            className={`flex-1 min-h-[38px] px-3 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'server'
                ? 'bg-[#45D69B] text-[#071A14] shadow-sm'
                : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
            }`}
          >
            <Server size={14} />
            <span>اتصال مستقیم سرور به MySQL</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('cpanel');
              setTestResult(null);
            }}
            className={`flex-1 min-h-[38px] px-3 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'cpanel'
                ? 'bg-[#45D69B] text-[#071A14] shadow-sm'
                : 'text-[#A8B8AF] hover:text-[#F4F7F5]'
            }`}
          >
            <Globe size={14} />
            <span>پل cPanel / هاست شخصی (api.php)</span>
          </button>
        </div>

        {/* Tab 1: Direct Server MySQL */}
        {activeTab === 'server' && (
          <div className="space-y-3.5 animate-in fade-in text-xs">
            <p className="text-[#A8B8AF] leading-relaxed">
              مشخصات اتصال به پایگاه‌داده MySQL سرور خود را وارد کنید. جداول لازم به صورت خودکار ساخته شده و تمام عملیات مستقیماً در MySQL ذخیره و خوانده می‌شوند:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#A8B8AF] mb-1 font-medium">
                  آدرس هاست MySQL (Host) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="مثلاً: localhost یا 127.0.0.1 یا IP سرور"
                  className="w-full min-h-[42px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-[#F4F7F5] outline-none tabular-nums"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[#A8B8AF] mb-1 font-medium">
                  پورت (Port)
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3306"
                  className="w-full min-h-[42px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-[#F4F7F5] outline-none tabular-nums"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[#A8B8AF] mb-1 font-medium">
                  نام کاربری (Database User) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="root"
                  className="w-full min-h-[42px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-[#F4F7F5] outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[#A8B8AF] mb-1 font-medium">
                  رمز عبور (Password)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور دیتابیس"
                  className="w-full min-h-[42px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-[#F4F7F5] outline-none"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[#A8B8AF] mb-1 font-medium">
                  نام پایگاه‌داده (Database Name) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="kharjyar_db"
                  className="w-full min-h-[42px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-[#F4F7F5] outline-none"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestServerMysql}
                disabled={isTesting}
                className="min-h-[42px] px-4 bg-[#183D30] hover:bg-[#204a3c] text-[#F4F7F5] font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} className={isTesting ? 'animate-spin text-[#45D69B]' : ''} />
                <span>{isTesting ? 'در حال تست...' : 'تست اتصال'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveServerMysql}
                disabled={isSaving}
                className="flex-1 min-h-[42px] px-4 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Check size={16} />
                <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره و فعال‌سازی MySQL'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: cPanel api.php */}
        {activeTab === 'cpanel' && (
          <div className="space-y-3.5 animate-in fade-in text-xs">
            <div className="p-3 bg-[#071A14] border border-[#183D30] rounded-2xl flex items-center justify-between gap-3">
              <div>
                <strong className="text-[#F4F7F5] block mb-0.5">اسکریپت خودکفای PHP + MySQL:</strong>
                <span className="text-[#A8B8AF]">
                  فایل api.php بدون هیچ وابستگی، جداول را در phpMyAdmin به صورت خودکار ایجاد می‌کند.
                </span>
              </div>
              <button
                type="button"
                onClick={downloadApiPhpScript}
                className="min-h-[38px] px-3 bg-[#183D30] hover:bg-[#204a3c] text-[#45D69B] border border-[#45D69B]/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download size={14} />
                <span>دانلود api.php</span>
              </button>
            </div>

            <div>
              <label className="block text-[#A8B8AF] mb-1 font-medium">
                آدرس اینترنتی فایل api.php روی هاست: <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                value={cpanelUrl}
                onChange={(e) => setCpanelUrl(e.target.value)}
                placeholder="مثلاً: https://your-domain.ir/api.php"
                className="w-full min-h-[42px] px-3 bg-[#071A14] border border-[#183D30] focus:border-[#45D69B] rounded-xl text-[#F4F7F5] outline-none tabular-nums"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestCpanel}
                disabled={isTesting}
                className="min-h-[42px] px-4 bg-[#183D30] hover:bg-[#204a3c] text-[#F4F7F5] font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} className={isTesting ? 'animate-spin text-[#45D69B]' : ''} />
                <span>{isTesting ? 'در حال تست...' : 'تست پل cPanel'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCpanel}
                className="flex-1 min-h-[42px] px-4 bg-[#45D69B] hover:bg-[#3ec48d] text-[#071A14] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Check size={16} />
                <span>اتصال به پل cPanel</span>
              </button>
            </div>
          </div>
        )}

        {/* Test Result Message Box */}
        {testResult && (
          <div
            className={`p-3 rounded-2xl text-xs leading-relaxed border animate-in fade-in ${
              testResult.ok
                ? 'bg-[#071A14] border-[#45D69B]/40 text-[#45D69B]'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {testResult.ok ? (
                <CheckCircle2 size={16} className="text-[#45D69B] shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
