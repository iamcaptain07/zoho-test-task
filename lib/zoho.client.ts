import axios, { AxiosError } from 'axios';

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedAccessToken: CachedToken | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('Missing ZOHO_REFRESH_TOKEN');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('client_id', process.env.ZOHO_CLIENT_ID!);
  params.append('client_secret', process.env.ZOHO_CLIENT_SECRET!);

  const resp = await axios.post(ZOHO_TOKEN_URL, params);
  const data = resp.data;
  const accessToken = data.access_token as string;
  const expiresIn = data.expires_in as number;

  cachedAccessToken = {
    token: accessToken,
    expiresAt: Date.now() + (expiresIn - 30) * 1000,
  };

  return accessToken;
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }
  return refreshAccessToken();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  payload?: any,
  retryCount = 0
): Promise<T> {
  const token = await getAccessToken();
  const maxRetries = 5;
  const baseDelay = 1000;

  try {
    const url = `${API_DOMAIN}/crm/v2${path}`;
    const headers: any = {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    };

    const r = await axios.request<T>({
      url,
      method,
      data: payload,
      headers,
      timeout: 30000,
    });

    return r.data;
  } catch (err: any) {
    const axiosError = err as AxiosError;
    const status = axiosError.response?.status;

    if ((status === 401 || status === 403) && retryCount < 1) {
      await refreshAccessToken();
      return apiRequest(method, path, payload, retryCount + 1);
    }

    if (
      (status && status >= 500) ||
      status === 429 ||
      (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')
    ) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 100;
        await sleep(delay);
        return apiRequest(method, path, payload, retryCount + 1);
      }
    }

    throw err;
  }
}

export async function searchRecords(module: string, criteria: string) {
  try {
    const resp = await apiRequest<any>(
      'get',
      `/${module}/search?criteria=${encodeURIComponent(criteria)}`
    );
    return resp;
  } catch (error: any) {
    const errorDetails = error.response?.data || error.message;
    console.error(`Zoho search error for ${module}:`, {
      criteria,
      error: errorDetails,
      status: error.response?.status,
    });
    throw error;
  }
}

export async function createRecords(module: string, records: any[]) {
  return apiRequest<any>('post', `/${module}`, { data: records });
}

export async function updateRecord(module: string, recordId: string, fields: any) {
  return apiRequest<any>('put', `/${module}/${recordId}`, { data: [fields] });
}

export async function getAllRecords(module: string, page = 1, perPage = 200) {
  const resp = await apiRequest<any>(
    'get',
    `/${module}?page=${page}&per_page=${perPage}`
  );
  return resp;
}

export async function getAllRecordsPaginated(module: string) {
  const allRecords: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await getAllRecords(module, page, 200);
    if (response.data && response.data.length > 0) {
      allRecords.push(...response.data);
      hasMore = response.info?.more_records === true;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

