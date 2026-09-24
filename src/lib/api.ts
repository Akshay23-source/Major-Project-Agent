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

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e: any) {
    throw new ApiError(0, `Cannot reach the Agri Agent server at ${API_URL}. Check your connection.`);
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
// Auth endpoints — real authentication is DISABLED.
// Anyone can sign in as the demo agent (agent@gmail.com / 789969) or as the
// demo driver (driver@gmail.com / 789969). Sessions are created locally and
// the backend is never contacted for login.
// ─────────────────────────────────────────────

const DEMO = {
  agent: { email: "agent@gmail.com", password: "789969", name: "Demo Agent" },
  driver: { email: "driver@gmail.com", password: "789969", name: "Demo Driver" },
} as const;

const makeDemoSession = (role: Role, name: string, email: string): Session => ({
  token: `demo-${role}-token`,
  role,
  user: { id: role === "agent" ? "demo-agent" : "demo-driver", name, email, role },
});

export const authApi = {
  /** Agent demo sign-in: agent@gmail.com / 789969 */
  agentLogin: async (email: string, password: string) => {
    if (email.trim().toLowerCase() === DEMO.agent.email && password === DEMO.agent.password) {
      const s = makeDemoSession("agent", DEMO.agent.name, DEMO.agent.email);
      await setSession(s);
      return s;
    }
    throw new ApiError(401, "Invalid email or password.");
  },

  /** Driver demo sign-in: driver@gmail.com / 789969 */
  driverLogin: async (email: string, password: string) => {
    if (email.trim().toLowerCase() === DEMO.driver.email && password === DEMO.driver.password) {
      const s = makeDemoSession("driver", DEMO.driver.name, DEMO.driver.email);
      await setSession(s);
      return s;
    }
    throw new ApiError(401, "Invalid email or password.");
  },

  changePassword: (current_password: string, new_password: string) =>
    api.post<{ success: boolean }>("/auth/password", { current_password, new_password }),
};
