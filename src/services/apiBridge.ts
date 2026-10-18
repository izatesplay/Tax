import { KharjYarStorageData } from '../types';

const API_ENDPOINT_STORAGE_KEY = 'kharjyar_mysql_api_url';
export const DEFAULT_API_ENDPOINT = '/api.php';

export interface ApiStatusResult {
  ok: boolean;
  message: string;
  data?: any;
}

export function getSavedApiEndpoint(): string {
  try {
    const val = localStorage.getItem(API_ENDPOINT_STORAGE_KEY);
    return val && val.trim() ? val.trim() : DEFAULT_API_ENDPOINT;
  } catch {
    return DEFAULT_API_ENDPOINT;
  }
}

export function saveApiEndpoint(url: string): void {
  try {
    const trimmed = url.trim();
    if (!trimmed || trimmed === DEFAULT_API_ENDPOINT) {
      localStorage.removeItem(API_ENDPOINT_STORAGE_KEY);
    } else {
      localStorage.setItem(API_ENDPOINT_STORAGE_KEY, trimmed);
    }
  } catch (e) {
    console.error('Failed to save API endpoint:', e);
  }
}

function buildActionUrl(baseUrl: string, action: string): string {
  const clean = baseUrl.trim() || DEFAULT_API_ENDPOINT;
  const sep = clean.includes('?') ? '&' : '?';
  return `${clean}${sep}action=${action}`;
}

async function safeFetchJson(url: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; json: any; rawText: string }> {
  const res = await fetch(url, options);
  const rawText = await res.text();

  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // Response was not JSON (e.g. HTML error page or 404)
    return {
      ok: false,
      status: res.status,
      json: null,
      rawText: rawText.slice(0, 150),
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    rawText,
  };
}

/**
 * بررسی وضعیت اتصال به فایل api.php و پایگاه‌داده MySQL
 */
export async function checkApiStatus(endpointUrl?: string): Promise<ApiStatusResult> {
  const base = endpointUrl !== undefined ? endpointUrl : getSavedApiEndpoint();
  const targetUrl = buildActionUrl(base, 'status');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const result = await safeFetchJson(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!result.json) {
      return {
        ok: false,
        message: 'سرور به جای JSON خروجی متنی/HTML برگرداند. لطفاً آدرس فایل api.php را بررسی فرمایید.',
      };
    }

    if (result.json.status === 'success') {
      return {
        ok: true,
        message: result.json.message || 'ارتباط با پایگاه‌داده MySQL برقرار است ✅',
        data: result.json.data,
      };
    } else {
      return {
        ok: false,
        message: result.json.message || `خطای دیتابیس در فایل api.php`,
        data: result.json.data,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error.name === 'AbortError'
        ? 'مهلت زمان تست ارتباط پایان یافت (Timeout).'
        : `عدم برقراری ارتباط با api.php: ${error?.message || 'خطای شبکه'}`,
    };
  }
}

/**
 * ذخیره و همگام‌سازی لحظه‌ای تمامی اطلاعات با api.php (Push Sync)
 */
export async function syncAllToDatabase(
  endpointUrl?: string,
  data?: KharjYarStorageData
): Promise<ApiStatusResult> {
  if (!data) {
    return { ok: false, message: 'اطلاعاتی برای ذخیره‌سازی ارائه نشده است.' };
  }

  const base = endpointUrl !== undefined ? endpointUrl : getSavedApiEndpoint();
  const targetUrl = buildActionUrl(base, 'sync_all');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const result = await safeFetchJson(targetUrl, {
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

    if (!result.json) {
      return {
        ok: false,
        message: 'پاسخ سرور در زمان همگام‌سازی معتبر نبود (خطای HTML سرور).',
      };
    }

    if (result.json.status === 'success') {
      return {
        ok: true,
        message: result.json.message || 'اطلاعات با موفقیت در پایگاه‌داده ذخیره شد ✅',
        data: result.json.data,
      };
    } else {
      return {
        ok: false,
        message: result.json.message || 'خطا در ذخیره‌سازی اطلاعات در دیتابیس',
        data: result.json.data,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error.name === 'AbortError'
        ? 'مهلت زمان ذخیره‌سازی پایان یافت.'
        : `خطا در ارتباط با سرور: ${error?.message || 'مشکل ارتباط شبکه'}`,
    };
  }
}

/**
 * دریافت تمامی اطلاعات از دیتابیس MySQL از طریق api.php (Pull Sync)
 */
export async function fetchAllFromDatabase(
  endpointUrl?: string
): Promise<{ ok: boolean; message: string; data?: KharjYarStorageData }> {
  const base = endpointUrl !== undefined ? endpointUrl : getSavedApiEndpoint();
  const targetUrl = buildActionUrl(base, 'get_all');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const result = await safeFetchJson(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!result.json) {
      return {
        ok: false,
        message: 'سرور خروجی JSON معتبری برنگرداند. لطفاً مطمئن شوید فایل api.php در مسیر درست هاست قرار دارد.',
      };
    }

    const payload = result.json.data || result.json;

    if (result.json.status === 'success' && payload && Array.isArray(payload.expenses)) {
      return {
        ok: true,
        message: result.json.message || 'داده‌ها با موفقیت از دیتابیس MySQL دریافت شدند.',
        data: payload as KharjYarStorageData,
      };
    } else {
      return {
        ok: false,
        message: result.json.message || 'پاسخ معتبری از دیتابیس دریافت نشد.',
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error.name === 'AbortError'
        ? 'مهلت زمان دریافت داده‌ها پایان یافت.'
        : `خطا در دریافت اطلاعات: ${error?.message || 'مشکل ارتباط شبکه'}`,
    };
  }
}

/**
 * دانلود مستقیم فایل api.php برای آپلود در cPanel
 */
export function downloadApiPhpScript(): void {
  const a = document.createElement('a');
  a.href = '/api.php';
  a.download = 'api.php';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
