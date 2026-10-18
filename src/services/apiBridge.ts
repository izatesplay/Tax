import { KharjYarStorageData } from '../types';

const API_ENDPOINT_STORAGE_KEY = 'kharjyar_mysql_api_url';

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

export interface ApiStatusResult {
  ok: boolean;
  message: string;
  data?: any;
}

/**
 * Checks MySQL API bridge status via ?action=status
 */
export async function checkApiStatus(endpointUrl: string): Promise<ApiStatusResult> {
  const url = endpointUrl.trim();
  if (!url) {
    return { ok: false, message: 'آدرس اینترنتی api.php وارد نشده است.' };
  }

  const queryUrl = url.includes('?') ? `${url}&action=status` : `${url}?action=status`;

  try {
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache',
    });

    const json = await res.json();
    if (json.status === 'success' || res.ok) {
      return {
        ok: true,
        message: json.message || 'ارتباط با MySQL با موفقیت برقرار شد.',
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
      message: `عدم برقراری ارتباط با سرور: ${error?.message || 'آدرس نامعتبر است یا CORS مسدود است'}`,
    };
  }
}

/**
 * Synchronizes local data with MySQL via ?action=sync_all (POST)
 */
export async function syncAllToDatabase(
  endpointUrl: string,
  data: KharjYarStorageData
): Promise<ApiStatusResult> {
  const url = endpointUrl.trim();
  if (!url) {
    return { ok: false, message: 'آدرس اینترنتی api.php وارد نشده است.' };
  }

  const queryUrl = url.includes('?') ? `${url}&action=sync_all` : `${url}?action=sync_all`;

  try {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        data: {
          expenses: data.expenses,
          categories: data.categories,
          pettyCash: data.pettyCash,
          updatedAt: data.updatedAt,
        },
      }),
    });

    const json = await res.json();
    if (json.status === 'success' || res.ok) {
      return {
        ok: true,
        message: json.message || 'اطلاعات با موفقیت در دیتابیس MySQL ذخیره شد.',
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
      message: `خطا در ارسال اطلاعات به سرور: ${error?.message || 'مشکل ارتباط شبکه'}`,
    };
  }
}

/**
 * Pulls all data from MySQL via ?action=get_all
 */
export async function fetchAllFromDatabase(
  endpointUrl: string
): Promise<{ ok: boolean; message: string; data?: KharjYarStorageData }> {
  const url = endpointUrl.trim();
  if (!url) {
    return { ok: false, message: 'آدرس اینترنتی api.php وارد نشده است.' };
  }

  const queryUrl = url.includes('?') ? `${url}&action=get_all` : `${url}?action=get_all`;

  try {
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache',
    });

    const json = await res.json();
    if (json.status === 'success' && json.data) {
      return {
        ok: true,
        message: json.message || 'داده‌ها با موفقیت از دیتابیس دریافت شدند.',
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
      message: `خطا در دریافت اطلاعات: ${error?.message || 'مشکل ارتباط شبکه'}`,
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
