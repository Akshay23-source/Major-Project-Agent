# Agri Agent 🌾

Agri Agent is a robust, production-ready React Native application tailored for agricultural agents to seamlessly manage farmers, orders, and operations in the field. Built with Expo, Supabase, and AI integrations.

## 🌟 Key Features

*   **🔒 Secure Authentication:** OTP phone login and strict session management.
*   **📊 Agent Dashboard & Analytics:** Real-time metrics on order status, crop demands, and top-performing farmers.
*   **🧑‍🌾 Farmer Management:** Complete CRUD operations with secure, isolated data per agent.
*   **📦 Order Management:** Track order transitions (Pending → Confirmed → Processing → Delivered) with strict validations.
*   **🤖 AI Agricultural Assistant:** Uses a secure Supabase Edge Function to provide context-aware insights, order risk assessments, and staged transactional tools.
*   **🎙️ Voice Commands:** Interact with the dashboard and stage orders purely via speech.
*   **📄 Reports & Export:** Generate localized CSV reports filtered by timeframe.

---

## 🏗️ Architecture & Tech Stack

*   **Frontend Framework:** React Native / Expo SDK 54 (Expo Router)
*   **Language:** TypeScript
*   **Backend & Auth:** Supabase (PostgreSQL, Supabase Auth, Row Level Security)
*   **AI Engine:** OpenAI via Supabase Edge Functions (Deno)
*   **Data Visualization:** React Native Chart Kit & SVG
*   **Deployment & Build:** EAS (Expo Application Services)

---

## 🛡️ Security Posture (Production Hardened)

1.  **Strict Row Level Security (RLS):** All tables (`farmers`, `orders`, `notifications`) are restricted to the authenticated agent's ID via `auth.uid()`. Data leakage between agents is impossible at the database level.
2.  **No Leaked Secrets:** The mobile client bundle only contains public Supabase URL and Anon Keys. Private AI API keys and Service Roles are strictly confined to the server (Edge Functions).
3.  **Action Chips:** AI cannot execute database queries directly. It stages actions (like creating an order) as structured UI components that require explicit human interaction (`[Confirm Order]`).
4.  **Error Boundaries:** The application gracefully handles network timeouts, Supabase connection failures, and AI unavailability without crashing.

---

## 🚀 Environment Setup

1.  **Clone the Repository** and navigate to the root directory.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    Create a `.env` file in the root directory and populate it from `.env.example`:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
    ```
    *(Note: `.env` is explicitly git-ignored for security).*

---

## 🛠️ Edge Function & AI Setup

To activate the AI Agricultural Assistant, you must configure the backend:

1.  Ensure you have the Supabase CLI installed.
2.  Set your AI API Key securely in Supabase Secrets:
    ```bash
    npx supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
    ```
3.  Deploy the Edge Function:
    ```bash
    npx supabase functions deploy agri-ai
    ```

---

## 📱 Running the Application

### Development (Expo Go)
For standard UI and logic development:
```bash
npx expo start -c
```
*(If you need remote testing over a different network, add the `--tunnel` flag).*

### Production Preview Build (Android)
If you require testing native modules (like native voice recognition), run an EAS internal build:
```bash
eas build --profile preview --platform android
```

---

## 📦 Android Production Build

When you are ready to publish to the Google Play Store, the `eas.json` configuration is prepared.

1.  **Build the Production Bundle (AAB):**
    ```bash
    eas build --profile production --platform android
    ```
2.  **Submit to Play Store:**
    ```bash
    eas submit --platform android
    ```

---

## 🧪 QA & Troubleshooting

*   **Unmatched Route/404:** Ensure Expo Router's standard layout (`_layout.tsx`) is handling the navigation state. Protected routes redirect to `/login` if unauthenticated.
*   **Data Not Appearing:** Verify that your Supabase Auth session is active and that your user ID matches the `agent_id` in the `farmers`/`orders` table.
*   **AI Responding "Not Configured":** Your Edge Function is missing the `OPENAI_API_KEY` secret, or the function has not been deployed successfully.

## 📅 Recent Updates
*   Integrated Text-to-Speech (TTS) Voice services.
*   Added dynamic routing for farmers, orders, and payments.
*   Initial database schema migration setup.

---
*Developed for Agri Agent - Securing Agricultural Operations.*
