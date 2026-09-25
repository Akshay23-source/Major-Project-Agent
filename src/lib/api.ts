/**
 * Agri Agent API client — the app's only way to reach data.
 *
 * All data lives in MongoDB Atlas behind the Agri Agent backend (backend/).
 * The app never sees database credentials: it holds a JWT from /api/auth/*,
 * stored in the device keychain (expo-secure-store; AsyncStorage on web).
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const RAW_URL = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

if (!RAW_URL) {
  console.error("❌ EXPO_PUBLIC_API_URL is missing. Add it to .env (e.g. http://192.168.1.10:4000) and restart Expo.");
}

export const API_URL = RAW_URL;

/** A request that gets no answer (wrong IP, firewall, backend down) fails after this instead of hanging forever. */
const REQUEST_TIMEOUT_MS = 15000;

console.log(`[api] base URL: ${API_URL || "(missing)"}`);

export type Role = "agent" | "driver";

export interface Session {
  token: string;
  role: Role;
  user: { id: string; name: string; email?: string; phone?: string; role: Role };
}

export class ApiError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ─────────────────────────────────────────────
// Session storage
// ─────────────────────────────────────────────
const SESSION_KEY = "agri_agent_session";

const storage = {
  get: async (): Promise<string | null> =>
    Platform.OS === "web" ? AsyncStorage.getItem(SESSION_KEY) : SecureStore.getItemAsync(SESSION_KEY),
  set: async (value: string) =>
    Platform.OS === "web" ? AsyncStorage.setItem(SESSION_KEY, value) : SecureStore.setItemAsync(SESSION_KEY, value),
  remove: async () =>
    Platform.OS === "web" ? AsyncStorage.removeItem(SESSION_KEY) : SecureStore.deleteItemAsync(SESSION_KEY),
};

let session: Session | null = null;
let loaded = false;
type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l(session));

export const loadSession = async (): Promise<Session | null> => {
  if (loaded) return session;
  try {
    const raw = await storage.get();
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }
  loaded = true;
  return session;
};

export const getSession = () => session;

export const setSession = async (next: Session | null) => {
  session = next;
  loaded = true;
  try {
    if (next) await storage.set(JSON.stringify(next));
    else await storage.remove();
  } catch (e) {
    console.warn("Could not persist session:", e);
  }
  emit();
};

/** Notified on sign-in, sign-out and expired sessions. Returns an unsubscribe function. */
export const onSessionChange = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const signOut = () => setSession(null);

// ─────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────
type Query = Record<string, string | number | boolean | undefined | null>;

const buildUrl = (path: string, query?: Query) => {
  const url = `${API_URL}/api${path}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${url}?${qs}` : url;
};

const request = async <T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> => {
  if (!API_URL) throw new ApiError(0, "App is not configured: EXPO_PUBLIC_API_URL is missing.");
  await loadSession();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const url = buildUrl(path, query);
  const started = Date.now();
  console.log(`[api] → ${method} ${url} (auth: ${session?.token ? "yes" : "no"})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    const timedOut = e?.name === "AbortError";
    console.error(`[api] ✗ ${method} ${path} ${timedOut ? `timed out after ${REQUEST_TIMEOUT_MS}ms` : `network error: ${e?.message}`}`);
    throw new ApiError(
      0,
      timedOut
        ? `The Agri Agent server at ${API_URL} did not respond in ${REQUEST_TIMEOUT_MS / 1000}s. Check the IP, that the backend is running, and the firewall.`
        : `Cannot reach the Agri Agent server at ${API_URL}. Check your connection.`
    );
  } finally {
    clearTimeout(timer);
  }
  console.log(`[api] ← ${res.status} ${method} ${path} (${Date.now() - started}ms)`);

  // Invalid or expired token (e.g. an old demo session): sign out so the app returns to login.
  if (res.status === 401 && session?.token && !path.startsWith("/auth/")) {
    console.warn("[api] 401 with a stored session — signing out");
    await signOut();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.message || `Request failed (${res.status})`, data?.errors);
  }
  return data as T;
};

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

/** Human-readable message for Alerts. */
export const errorMessage = (e: unknown, fallback = "Something went wrong. Please try again.") => {
  if (e instanceof ApiError) return e.details?.length ? `${e.message}\n${e.details.join("\n")}` : e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
};

// ─────────────────────────────────────────────
// Auth endpoints — real JWTs from the Agri Agent backend (/api/auth/*).
// ─────────────────────────────────────────────

export const authApi = {
  /** Agent sign-in: POST /api/auth/agent/login → { token, role, user } */
  agentLogin: async (email: string, password: string) => {
    const s = await api.post<Session>("/auth/agent/login", { email: email.trim().toLowerCase(), password });
    await setSession(s);
    console.log(`[auth] agent signed in: ${s.user.email} (${s.user.id})`);
    return s;
  },

  /** Driver sign-in: POST /api/auth/driver/login with the phone registered by the agent. */
  driverLogin: async (phone: string, password: string) => {
    const s = await api.post<Session>("/auth/driver/login", { phone: phone.trim(), password });
    await setSession(s);
    console.log(`[auth] driver signed in: ${s.user.phone} (${s.user.id})`);
    return s;
  },

  /**
   * Agent sign-up: POST /api/auth/agent/signup → { token, role, user }.
   * Returns the session without saving it, so the screen can show its success state first;
   * call setSession() to sign in.
   */
  agentSignup: (data: { name: string; email: string; password: string; phone?: string }) =>
    api.post<Session>("/auth/agent/signup", { ...data, email: data.email.trim().toLowerCase() }),

  /**
   * Driver first-time activation: POST /api/auth/driver/activate. The phone must already be
   * registered by an agent. Returns the session without saving it (see agentSignup).
   */
  driverActivate: (phone: string, password: string) =>
    api.post<Session>("/auth/driver/activate", { phone: phone.trim(), password }),

  changePassword: (current_password: string, new_password: string) =>
    api.post<{ success: boolean }>("/auth/password", { current_password, new_password }),
};
