import { DatabaseSettings, KharjYarStorageData } from '../types';

const DB_SETTINGS_KEY = 'kharjyar_db_settings_v1';

export const DEFAULT_DB_SETTINGS: DatabaseSettings = {
  mode: 'cloud',
  cpanelApiUrl: '',
  autoSync: true,
};

export function getDatabaseSettings(): DatabaseSettings {
  try {
    const raw = localStorage.getItem(DB_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DB_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === 'cpanel' ? 'cpanel' : 'cloud',
      cpanelApiUrl: typeof parsed.cpanelApiUrl === 'string' ? parsed.cpanelApiUrl.trim() : '',
      autoSync: parsed.autoSync !== false,
      lastSyncedAt: parsed.lastSyncedAt || undefined,
    };
  } catch {
    return { ...DEFAULT_DB_SETTINGS };
  }
}

export function saveDatabaseSettings(settings: DatabaseSettings): void {
  try {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving db settings:', e);
  }
}

/**
 * Fetch all data from the remote database (cloud backend or cPanel api.php)
 */
export async function fetchRemoteData(
  settings: DatabaseSettings = getDatabaseSettings()
): Promise<{ success: boolean; data?: KharjYarStorageData; error?: string }> {
  try {
    let url = '/api/data';
    if (settings.mode === 'cpanel') {
      if (!settings.cpanelApiUrl) {
        return { success: false, error: 'آدرس پل API cPanel تنظیم نشده است.' };
      }
      url = settings.cpanelApiUrl.includes('?')
        ? `${settings.cpanelApiUrl}&action=get_all`
        : `${settings.cpanelApiUrl}?action=get_all`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`خطای سرور: کد وضعیت ${res.status}`);
    }

    const json = await res.json();
    const payload = json.data || json;

    if (!payload || !Array.isArray(payload.expenses) || !Array.isArray(payload.categories)) {
      throw new Error('فرمت پاسخ دیتابیس معتبر نیست.');
    }

    return {
      success: true,
      data: payload as KharjYarStorageData,
    };
  } catch (error: any) {
    const errMsg = error.name === 'AbortError' ? 'مهلت زمان اتصال به سرور پایان یافت.' : error.message;
    return {
      success: false,
      error: errMsg || 'خطا در ارتباط با سرور دیتابیس',
    };
  }
}

/**
 * Sync entire local data to the remote database
 */
export async function syncDataToRemote(
  data: KharjYarStorageData,
  settings: DatabaseSettings = getDatabaseSettings()
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    let url = '/api/sync_all';
    if (settings.mode === 'cpanel') {
      if (!settings.cpanelApiUrl) {
        return { success: false, error: 'آدرس پل cPanel وارد نشده است.' };
      }
      url = settings.cpanelApiUrl.includes('?')
        ? `${settings.cpanelApiUrl}&action=sync_all`
        : `${settings.cpanelApiUrl}?action=sync_all`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`پاسخ سرور ناموفق بود (${res.status})`);
    }

    const json = await res.json();
    if (json.status === 'error') {
      throw new Error(json.message || 'خطا در ذخیره‌سازی روی دیتابیس');
    }

    // Update last sync time
    const nowIso = new Date().toISOString();
    saveDatabaseSettings({ ...settings, lastSyncedAt: nowIso });

    return {
      success: true,
      message: json.message || 'اطلاعات با موفقیت ذخیره شد.',
    };
  } catch (error: any) {
    const errMsg = error.name === 'AbortError' ? 'مهلت زمان ارسال اطلاعات به پایان رسید.' : error.message;
    return {
      success: false,
      error: errMsg || 'خطا در همگام‌سازی با پایگاه‌داده',
    };
  }
}

/**
 * Test connectivity and get health status
 */
export async function testConnection(
  settings: DatabaseSettings
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    let url = '/api/status';
    if (settings.mode === 'cpanel') {
      if (!settings.cpanelApiUrl) {
        return { success: false, message: 'لطفاً آدرس api.php را وارد نمایید.' };
      }
      url = settings.cpanelApiUrl.includes('?')
        ? `${settings.cpanelApiUrl}&action=status`
        : `${settings.cpanelApiUrl}?action=status`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`کد خطای HTTP: ${res.status}`);
    }

    const json = await res.json();
    return {
      success: json.status === 'success' || res.ok,
      message: json.message || 'ارتباط با موفقیت برقرار شد.',
      details: json.data || json,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.name === 'AbortError' ? 'مهلت زمان تست ارتباط پایان یافت.' : error.message,
    };
  }
}
