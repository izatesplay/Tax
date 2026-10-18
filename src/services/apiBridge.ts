import { KharjYarStorageData } from '../types';

const API_ENDPOINT_STORAGE_KEY = 'kharjyar_mysql_api_url';
const API_MODE_STORAGE_KEY = 'kharjyar_api_mode';

export type ApiMode = 'cloud' | 'cpanel';

export interface ApiStatusResult {
  ok: boolean;
  message: string;
  data?: any;
}

export function getSavedApiMode(): ApiMode {
  try {
    const val = localStorage.getItem(API_MODE_STORAGE_KEY);
    return val === 'cpanel' ? 'cpanel' : 'cloud';
  } catch {
    return 'cloud';
  }
}

export function saveApiMode(mode: ApiMode): void {
  try {
    localStorage.setItem(API_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.error('Failed to save API mode:', e);
  }
}

export function getSavedApiEndpoint(): string {
  try {
    return localStorage.getItem(API_ENDPOINT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveApiEndpoint(url: string): void {
  try {
    localStorage.setItem(API_ENDPOINT_STORAGE_KEY, url.trim());
  } catch (e) {
    console.error('Failed to save API endpoint:', e);
  }
}

function resolveUrls(mode: ApiMode, customUrl: string) {
  if (mode === 'cpanel' && customUrl.trim()) {
    const base = customUrl.trim();
    const sep = base.includes('?') ? '&' : '?';
    return {
      statusUrl: `${base}${sep}action=status`,
      getUrl: `${base}${sep}action=get_all`,
      syncUrl: `${base}${sep}action=sync_all`,
    };
  }

  // Default: Built-in Cloud Database on the app server
  return {
    statusUrl: '/api/status',
    getUrl: '/api/data',
    syncUrl: '/api/sync_all',
  };
}

/**
 * Checks API bridge / database status
 */
export async function checkApiStatus(
  endpointUrl?: string,
  modeOverride?: ApiMode
): Promise<ApiStatusResult> {
  const mode = modeOverride || getSavedApiMode();
  const custom = endpointUrl !== undefined ? endpointUrl : getSavedApiEndpoint();

  if (mode === 'cpanel' && !custom.trim()) {
    return { ok: false, message: 'آدرس اینترنتی api.php روی هاست وارد نشده است.' };
  }

  const { statusUrl } = resolveUrls(mode, custom);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json();
    if (json.status === 'success' || res.ok) {
      return {
        ok: true,
        message: json.message || 'ارتباط با پایگاه داده برقرار است.',
        data: json.data,
      };
    } else {
      return {
        ok: false,
        message: json.message || `خطای سرور: کد وضعیت ${res.status}`,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error.name === 'AbortError'
        ? 'مهلت زمان تست ارتباط پایان یافت.'
        : `عدم برقراری ارتباط با دیتابیس: ${error?.message || 'خطای شبکه یا CORS'}`,
    };
  }
}

/**
 * Synchronizes local data with Database
 */
export async function syncAllToDatabase(
  endpointUrl?: string,
  data?: KharjYarStorageData,
  modeOverride?: ApiMode
): Promise<ApiStatusResult> {
  if (!data) {
    return { ok: false, message: 'اطلاعاتی برای ذخیره‌سازی ارائه نشده است.' };
  }

  const mode = modeOverride || getSavedApiMode();
  const custom = endpointUrl !== undefined ? endpointUrl : getSavedApiEndpoint();

  if (mode === 'cpanel' && !custom.trim()) {
    return { ok: false, message: 'آدرس اینترنتی api.php وارد نشده است.' };
  }

  const { syncUrl } = resolveUrls(mode, custom);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: {
          expenses: data.expenses,
          categories: data.categories,
          pettyCash: data.pettyCash,
          updatedAt: data.updatedAt,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json();
    if (json.status === 'success' || res.ok) {
      return {
        ok: true,
        message: json.message || 'اطلاعات با موفقیت در دیتابیس ذخیره شد ✅',
        data: json.data,
      };
    } else {
      return {
        ok: false,
        message: json.message || `خطای ذخیره‌سازی: کد ${res.status}`,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error.name === 'AbortError'
        ? 'مهلت ارسال اطلاعات به سرور به پایان رسید.'
        : `خطا در ذخیره خودکار روی سرور: ${error?.message || 'مشکل ارتباط شبکه'}`,
    };
  }
}

/**
 * Pulls all data from Database
 */
export async function fetchAllFromDatabase(
  endpointUrl?: string,
  modeOverride?: ApiMode
): Promise<{ ok: boolean; message: string; data?: KharjYarStorageData }> {
  const mode = modeOverride || getSavedApiMode();
  const custom = endpointUrl !== undefined ? endpointUrl : getSavedApiEndpoint();

  if (mode === 'cpanel' && !custom.trim()) {
    return { ok: false, message: 'آدرس اینترنتی api.php وارد نشده است.' };
  }

  const { getUrl } = resolveUrls(mode, custom);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(getUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json();
    const payload = json.data || json;

    if ((json.status === 'success' || res.ok) && payload && Array.isArray(payload.expenses)) {
      return {
        ok: true,
        message: json.message || 'داده‌ها با موفقیت از دیتابیس دریافت شدند.',
        data: payload as KharjYarStorageData,
      };
    } else {
      return {
        ok: false,
        message: json.message || `خطای سرور: کد وضعیت ${res.status}`,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error.name === 'AbortError'
        ? 'مهلت زمان دریافت داده‌ها پایان یافت.'
        : `خطا در دریافت اطلاعات از سرور: ${error?.message || 'مشکل ارتباط شبکه'}`,
    };
  }
}

/**
 * Direct browser download of the api.php file
 */
export function downloadApiPhpScript(): void {
  const a = document.createElement('a');
  a.href = '/api.php';
  a.download = 'api.php';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
