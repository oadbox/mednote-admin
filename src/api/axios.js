import axios from 'axios';
import toast from 'react-hot-toast';

const RAW_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7007/api/v1';
// Strip the /api/v1 suffix when present so we can hit /auth/refresh-token on
// the same origin without double-prefixing. baseURL keeps /api/v1.
const API_ORIGIN = RAW_BASE.replace(/\/api\/v\d+\/?$/, '');

// Mirrors hms/src/api/axios.js — see that file for the rationale on the
// retry knobs. Override via VITE_API_TIMEOUT_MS / VITE_API_RETRIES.
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30_000;
const RETRIES           = Math.max(0, Number(import.meta.env.VITE_API_RETRIES) ?? 2);
const RETRY_BASE_MS     = 300;
const RETRYABLE_STATUSES = new Set([408, 502, 503, 504]);

const api = axios.create({
  baseURL: RAW_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
  // Required so the httpOnly refreshToken cookie set by the backend gets
  // sent along with our requests (especially POST /platform/auth/refresh-token).
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function isTransient(error) {
  if (!error.response) return true; // network err / timeout / CORS / refused
  return RETRYABLE_STATUSES.has(error.response.status);
}
function isSafeToRetry(config) {
  const method = (config?.method || 'get').toLowerCase();
  if (method === 'get' || method === 'head' || method === 'options') return true;
  return config?.retryWrites === true;
}
function shouldAnnounceRetry(url) {
  return !/\/auth\/(login|forgot-password|reset-password|refresh-token)/.test(url || '');
}
const announcedRetries = new Set();

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hms_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Single in-flight refresh promise — see comments in hms/src/api/axios.js
// for the rationale (avoids N concurrent refresh calls on N stale-token
// requests that race each other after token expiry).
let refreshPromise = null;

async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_ORIGIN}/api/v1/platform/auth/refresh-token`, {}, { withCredentials: true })
      .then((r) => {
        const newToken = r.data?.data?.accessToken;
        if (newToken) localStorage.setItem('hms_admin_token', newToken);
        return newToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// Platform-admin IP allowlist (backend middleware/adminIpGate.js): a 403 with
// errors[0].code === 'IP_NOT_ALLOWED' means this network isn't allowlisted.
// Returns the IP the server saw ('' if not given), or null for any other error.
export function blockedIpOf(error) {
  const first = error?.response?.data?.errors?.[0];
  if (error?.response?.status === 403 && first?.code === 'IP_NOT_ALLOWED') return first.ip || '';
  return null;
}

// Session is unusable from this network — drop it and show the login page with
// a "not available from this network" notice (Login.jsx reads ?blocked=).
let blockedRedirect = false;
export function forceBlockedLogout(ip) {
  if (blockedRedirect) return;
  blockedRedirect = true;
  try {
    localStorage.removeItem('hms_admin_token');
    localStorage.removeItem('hms_admin_user');
  } catch (_) { /* private mode etc. */ }
  if (window.location.pathname !== '/login') {
    window.location.replace(`/login?blocked=${encodeURIComponent(ip || '')}`);
  } else {
    blockedRedirect = false;
  }
}

// Centralizes the "your session is over, go to login" flow so every code
// path leads to the same place. Idempotent — calling it twice in the same
// tick is safe; only the first one navigates.
let loggingOut = false;
export function forceLogout(reason = 'Session expired. Please login again.') {
  if (loggingOut) return;
  loggingOut = true;
  try {
    localStorage.removeItem('hms_admin_token');
    localStorage.removeItem('hms_admin_user');
  } catch (_) { /* private mode etc. */ }
  if (window.location.pathname !== '/login') {
    if (reason) toast.error(reason);
    window.location.replace('/login');
  }
}

api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    announcedRetries.delete(url);
    toast.dismiss(`retry-${url}`);
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const original = error.config;
    const url = original?.url || '';

    // Not allowed from this network — no retry/refresh can fix that. On the
    // login page itself the form shows the message instead.
    const blockedIp = blockedIpOf(error);
    if (blockedIp !== null) {
      forceBlockedLogout(blockedIp);
      return Promise.reject(error);
    }

    // ── Transient-failure retry (network/timeout/5xx) ──────────────────
    if (original && isTransient(error) && isSafeToRetry(original)) {
      const attempt = (original._retryAttempt || 0) + 1;
      if (attempt <= RETRIES) {
        original._retryAttempt = attempt;
        if (attempt === 1 && shouldAnnounceRetry(url) && !announcedRetries.has(url)) {
          announcedRetries.add(url);
          toast.loading('Slow connection — retrying…', {
            id: `retry-${url}`,
            duration: 2500,
          });
        }
        const delay = RETRY_BASE_MS * Math.pow(3, attempt - 1)
                    + Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay));
        return api(original);
      }
      announcedRetries.delete(url);
      if (shouldAnnounceRetry(url) && !error.response) {
        toast.error(
          navigator.onLine
            ? "Couldn't reach the server. Please try again in a moment."
            : "You appear to be offline. We'll resume when you're back online.",
          { id: `offline-${url}` }
        );
      }
    }

    // /auth/me used to be in this list, but excluding it meant a page reload
    // after the access-token expired bounced to /login even though the
    // refresh-cookie was still valid. /me now refreshes-and-retries like any
    // other call; the `_retried` guard below still prevents loops.
    const isAuthEndpoint = /\/auth\/(login|forgot-password|reset-password|refresh-token)/.test(url);

    if (status === 401 && !isAuthEndpoint && !original._retried) {
      try {
        original._retried = true;
        const newToken = await tryRefresh();
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch (refreshError) {
        const refreshBlockedIp = blockedIpOf(refreshError);
        if (refreshBlockedIp !== null) {
          forceBlockedLogout(refreshBlockedIp);
          return Promise.reject(error);
        }
        /* otherwise fall through to forceLogout */
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      forceLogout();
    }

    // Self-heal an invalid platform session: a 403 "Platform admin access
    // required" means the stored token isn't a platform token at all (e.g. a
    // tenant login on the shared localhost cookie clobbered this app's token).
    // Refresh can't fix that — force a clean re-login. We DON'T log out on a
    // "Super admin access required" 403, which is a legitimate permission deny
    // for the support role.
    if (status === 403 && !isAuthEndpoint) {
      const msg = error.response?.data?.message || '';
      if (/platform admin access required/i.test(msg)) {
        forceLogout('Your session is no longer valid — please sign in again.');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
