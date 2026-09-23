import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// === SAFE DIAGNOSTIC CHECKS ===
if (!supabaseUrl || supabaseUrl.trim() === "") {
  console.error("❌ CRITICAL ERROR: EXPO_PUBLIC_SUPABASE_URL is missing or empty. Please check your .env file.");
  throw new Error("EXPO_PUBLIC_SUPABASE_URL is not defined.");
}

if (!supabaseUrl.startsWith("http")) {
  console.error("❌ CRITICAL ERROR: EXPO_PUBLIC_SUPABASE_URL is not a valid URL. It must start with http/https.");
  throw new Error("EXPO_PUBLIC_SUPABASE_URL is syntactically invalid.");
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === "") {
  console.error("❌ CRITICAL ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or empty. Please check your .env file.");
  throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined.");
}

// === TEMPORARY CONNECTIVITY TEST ===
export const testSupabaseConnectivity = async () => {
  try {
    console.log(`[Diagnostic] Pinging Supabase URL: ${supabaseUrl}`);
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey
      },
      // Short timeout can be implemented if needed
    });

    if (response.ok) {
      console.log("✅ Supabase Connectivity Test: SUCCESS (Service is reachable)");
      return true;
    } else {
      console.warn(`⚠️ Supabase Connectivity Test: FAILED (Status: ${response.status})`);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Supabase Connectivity Test: NETWORK REQUEST FAILED", error.message);
    console.error("This usually means you have no internet connection or the URL is unreachable from this device.");
    return false;
  }
};

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Run connectivity test on initialization (dev only)
if (__DEV__) {
  testSupabaseConnectivity();
}
