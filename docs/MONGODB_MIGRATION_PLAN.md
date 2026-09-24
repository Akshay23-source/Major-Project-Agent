# Agri Agent — Supabase → MongoDB Atlas migration plan

Status: **DONE (2026-09-24).** Decisions taken:
- Agent-owned business data (farmers, buyers, products, payments, commissions, settlements, employees) is **kept**
  as Agri-owned `agri_*` collections (option 1.8c). Marketplace jobs still carry no money and no account copies.
- Auth: own JWT accounts (agents: email + password; drivers: phone + password, activated after the agent registers them).
  SMS OTP, Google/Facebook sign-in and emailed password resets were Supabase Auth features and are removed.
- No data copied from Supabase (start fresh).
- Field names stay **snake_case** (`pickup_address`, `logistics_status`, …) so the screens needed minimal changes;
  related records are attached under the same keys the screens already read (`order.farmers`, `order.buyers`).
- Live GPS uses polling (5 s) instead of Supabase Realtime.
- Collections not in the original list were added where features needed them: `agri_pickups`, `agri_counters`,
  plus the agent-owned collections above.

Everything below is the original plan, kept for reference.

Goal: Agri Agent runs on its own Node/Express + Mongoose backend (`backend/`), using the
**same Atlas database as Farm Marketplace (`farm_marketplace`)**, with zero Supabase code,
packages, env vars, SQL, Edge Functions, auth, realtime or RPC left in the repo.

---

## 1. Supabase inventory (everything that must go)

### 1.1 Package / config
| Item | Where |
|---|---|
| `@supabase/supabase-js` ^2.112.2 | `package.json`, `package-lock.json` |
| `react-native-url-polyfill` (only needed by supabase-js) | `package.json`, `src/lib/supabase.ts` |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env.example`, `src/lib/supabase.ts` |
| Edge Function secrets (`SUPABASE_SERVICE_ROLE_KEY`, `MARKETPLACE_*`, `OPENAI_API_KEY`, `SARVAM_API_KEY`) | `supabase/functions/.env.example` |
| Supabase client singleton | `src/lib/supabase.ts` |
| `tsconfig.json` exclude of `supabase/` | `tsconfig.json` |
| Docs | `README.md`, `docs/MARKETPLACE_INTEGRATION.md` |

### 1.2 `supabase/` folder — deleted in full (27 files)
- `functions/` — `ingest-marketplace-order`, `marketplace-callback-worker`, `agri-ai`, `_shared/marketplaceIntake.ts`, `_shared/marketplaceCallbackService.ts`, `tests/marketplace_test.ts`, `.env.example`
- `migrations/` — `000`–`015` + `verify_logistics_deployment.sql`
- `sql/` — `marketplace_callback_cron.sql`, `diagnose_marketplace_schema.sql`
- `tests/marketplace_integration_test.sql`, `verify_schema.sql`

### 1.3 Supabase Auth (14 files)
`signInWithPassword`, `signUp`, `signInWithOtp`, `verifyOtp`, `resend`, `signInWithOAuth` (Google),
`resetPasswordForEmail`, `updateUser`, `getSession`, `onAuthStateChange`, `getUser`, `signOut`.
Files: `app/(auth)/login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx`,
`app/(agent)/settings.tsx`, `src/components/ui/Sidebar.tsx`, `src/providers/AuthProvider.tsx`,
`src/services/agent.ts`, `buyers.ts`, `employees.ts`, `farmers.ts`, `notifications.ts`,
`orders.ts`, `products.ts`, `driver/auth.ts`.

### 1.4 Realtime (`postgres_changes` channels)
`src/services/tracking.ts`, `src/services/logistics/location.ts` (live driver GPS).

### 1.5 RPC / Edge Function calls
| Call | File | Replacement |
|---|---|---|
| `rpc('link_driver_account')` | `src/services/driver/auth.ts` | `POST /api/auth/driver/link` |
| `rpc('retry_marketplace_sync')` | `src/services/integration/marketplaceSync.ts` | `POST /api/orders/:id/sync/retry` |
| `functions.invoke('marketplace-callback-worker')` | `marketplaceSync.ts` | in-process sync worker (no call needed) |
| `functions.invoke('agri-ai')` | `app/(agent)/voice/index.tsx`, `src/services/voice/SpeechRecognitionService.ts` | `POST /api/ai/voice` |

### 1.6 Postgres-specific logic that must be re-implemented in the backend
All of migration 014: intake RPC (idempotent on `externalOrderId`, advisory lock), status
ranking + "never go backwards", callback outbox with triggers on delivery events / order
status / GPS (throttled), exponential back-off + dead-letter, cancel-from-marketplace
(frees driver + vehicle), RLS agent isolation, driver state machine (013).

### 1.7 Table usage by file (29 app/src files)
| File | Supabase tables |
|---|---|
| `app/(agent)/dashboard.tsx` | orders, deliveries, delivery_partners |
| `app/(agent)/deliveries/add.tsx` | orders |
| `app/(agent)/deliveries/[id].tsx` | orders, deliveries, delivery_events |
| `app/(agent)/delivery-partners/index.tsx` | delivery_partners |
| `app/(agent)/fleet/index.tsx` | vehicles |
| `app/(agent)/logistics/map.tsx` | driver_locations |
| `app/(agent)/settings.tsx`, `voice/index.tsx` | auth, functions |
| `app/(auth)/*` (4 files) | auth |
| `src/components/ui/Sidebar.tsx`, `src/providers/AuthProvider.tsx` | auth |
| `src/services/agent.ts` | agents |
| `src/services/analytics.ts` | orders, deliveries, buyers, farmers, products, payments, farmer_settlements |
| `src/services/buyers.ts` | buyers, orders |
| `src/services/deliveries.ts` | deliveries |
| `src/services/driver/auth.ts` | delivery_partners, rpc |
| `src/services/driver/deliveries.ts` | deliveries, delivery_events, delivery_partners |
| `src/services/driver/locationTracking.ts` | driver_locations |
| `src/services/employees.ts` | employees |
| `src/services/farmers.ts` | farmers |
| `src/services/finance.ts` | payments, commissions, farmer_settlements |
| `src/services/integration/marketplaceOrders.ts` | orders, deliveries, delivery_partners, vehicles |
| `src/services/integration/marketplaceSync.ts` | marketplace_callback_logs, rpc, functions |
| `src/services/logistics.ts` | deliveries, delivery_events, delivery_partners, pickups, vehicles |
| `src/services/logistics/location.ts`, `src/services/tracking.ts` | driver_locations (realtime) |
| `src/services/notifications.ts` | notifications |
| `src/services/orders.ts` | orders |
| `src/services/products.ts` | products, inventory_history |
| `src/services/voice/SpeechRecognitionService.ts` | functions |

### 1.8 Features that conflict with the new data boundary (req. 10) **[DECIDE]**
These store data the Marketplace owns and cannot move to MongoDB as-is:
farmers, buyers, products + inventory_history, payments, commissions, farmer_settlements,
earnings, product/revenue analytics, "create order" (agent-entered orders with prices).
Screens: `farmers/*`, `add-farmer.tsx`, `buyers/*`, `products/*`, `payments/*`
(incl. settlements), `earnings/`, `orders/create.tsx`, `reports.tsx` (revenue parts),
`disputes/` (placeholder). Services: `farmers.ts`, `buyers.ts`, `products.ts`,
`finance.ts`, parts of `analytics.ts` and `orders.ts`.
Options: (a) remove them; (b) replace with read-only views of Marketplace collections;
(c) keep them as Agri-owned data (breaks req. 10).

`employees/*` (the agent's own staff) is logistics data and can stay.

---

## 2. Target architecture

```
Farm Marketplace backend ──POST /api/integrations/marketplace/orders (x-api-key)──▶ Agri Agent backend (Express)
          ▲                                                                              │  Mongoose
          └────────── status / event / location callbacks (outbox worker) ◀─────────────┤
                                                                                         ▼
Expo app (agent + driver) ──HTTPS + JWT──▶ Agri Agent backend ─────────▶ MongoDB Atlas  farm_marketplace
                                                                         (agri_* collections only)
```
- The two apps **share one database but not collections.** Agri Agent writes only `agri_*`
  collections, so nothing clashes with the Marketplace's `orders`, `users`,
  `notifications`, etc. Recommended: a separate Atlas DB user for Agri Agent with a custom
  role limited to `agri_*` (plus read-only on Marketplace collections if option 1.8b is chosen).
- The intake contract (payload, `x-api-key`, responses 201/200/400/401) and the callback
  contract stay the same, so the only Marketplace change is its **intake URL**.
- Realtime GPS: the app polls `/api/tracking/...` every 5 s (Socket.IO is an optional later upgrade).
- Background sync worker runs in the same Node process (`setInterval`), which replaces pg_cron + the Edge Function.

### 2.1 Collections / Mongoose models
| Model (file) | Collection | Key fields | Indexes |
|---|---|---|---|
| `Order` | `agri_orders` | externalOrderId, orderNumber, trackingId, source (MARKETPLACE/AGENT), agentId, pickup{address, contactName, contactPhone, location}, drop{address, city, state, pincode, country, contactName, contactPhone}, package{summary, items[{name, quantity, unit, category}], totalQuantity, unit, isPerishable, isFragile}, priority, estimatedDelivery, logisticsStatus, intakeStatus, cancellationReason, notes, sync{status, lastSyncedAt, lastError} | externalOrderId unique (partial), trackingId unique, {agentId, logisticsStatus, createdAt} |
| `DeliveryJob` | `agri_delivery_jobs` | orderId, deliveryNumber, agentId, driverId, vehicleId, status (driver state machine), pickupLocation, dropLocation, distanceKm, etaMinutes, assignedAt, pickedUpAt, deliveredAt, cancellationReason | orderId, {driverId, status} |
| `Driver` | `agri_drivers` | agentId, name, phone (unique), passwordHash, status (OFFLINE/ONLINE/BUSY/ON_DELIVERY), licenseNumber, lastLocation (GeoJSON) | phone unique, {agentId, status}, lastLocation 2dsphere |
| `Vehicle` | `agri_vehicles` | agentId, vehicleNumber (unique), vehicleType, capacityKg, availabilityStatus | vehicleNumber unique, {agentId, availabilityStatus} |
| `DeliveryEvent` | `agri_delivery_events` | deliveryJobId, orderId, agentId, eventType, description, location, actor{type, id}, createdAt | {deliveryJobId, createdAt}, {orderId, createdAt} |
| `TrackingHistory` | `agri_tracking_history` | driverId, deliveryJobId, location (GeoJSON Point), accuracy, speed, heading, recordedAt | {deliveryJobId, recordedAt:-1}, {driverId, recordedAt:-1}, location 2dsphere |
| `Agent` (needed for login) | `agri_agents` | name, email (unique), passwordHash, role, phone, settings | email unique |
| `Notification` (req. 7) | `agri_notifications` | agentId, type, title, message, related{id, type}, read | {agentId, read, createdAt} |
| `SyncJob` + `SyncLog` (retry sync, req. 7) | `agri_sync_queue`, `agri_sync_logs` | same fields as 014's queue/log (kind, status, attempts, nextAttemptAt, lockedAt, lastError, httpStatus…) | {status, nextAttemptAt}, {orderId, createdAt} |

No payment, escrow, price, inventory or customer-account fields exist in any model.

### 2.2 Postgres behaviour → MongoDB
| Postgres (014 / 013) | MongoDB replacement |
|---|---|
| `ingest_marketplace_order` + advisory lock | `findOneAndUpdate({externalOrderId}, …, {upsert})` on the unique index; E11000 on a race is retried as an update |
| Triggers that enqueue callbacks | `sync.service.enqueue()` called from the service layer on every status change, event and GPS ping (GPS throttled to 1 per 30 s per job) |
| `claim_marketplace_callbacks` (SKIP LOCKED) | `findOneAndUpdate({status: PENDING/FAILED, nextAttemptAt ≤ now}, {status: PROCESSING, lockedAt})` loop |
| Back-off / dead-letter | Same schedule: 30 s × 2ⁿ capped at 1 h, DEAD after 10 attempts |
| Multi-row updates (cancel frees driver + vehicle) | Mongoose transaction (`session.withTransaction`); Atlas replica set supports it |
| RLS agent isolation | Every query scoped by `req.user.agentId` in the service layer; drivers scoped by `driverId` |
| Driver state machine (013) | `status.service.js` transition table, validated server-side |

---

## 3. New folder structure
```
Major-Project-Agent/
├─ backend/                        NEW
│  ├─ package.json
│  ├─ .env                         MONGODB_URI etc. (git-ignored; existing `.env` rule covers it)
│  ├─ .env.example
│  ├─ src/
│  │  ├─ server.js                 boots DB, HTTP, sync worker
│  │  ├─ app.js                    express, helmet, cors, rate-limit, routes, error handler
│  │  ├─ config/env.js             reads + validates env (fails fast, never logs secrets)
│  │  ├─ config/db.js              MongoDB connection service (Mongoose, retry, graceful shutdown)
│  │  ├─ models/                   Order, DeliveryJob, Driver, Vehicle, DeliveryEvent,
│  │  │                            TrackingHistory, Agent, Notification, SyncJob, SyncLog
│  │  ├─ services/                 auth, intake, order, assignment, deliveryStatus (state machine),
│  │  │                            tracking, timeline, metrics, sync (outbox + worker),
│  │  │                            marketplaceClient (callbacks), notification, ai
│  │  ├─ controllers/              one per route group
│  │  ├─ routes/                   auth, integrations, orders, deliveries, drivers, vehicles,
│  │  │                            tracking, metrics, notifications, ai
│  │  ├─ middleware/               requireAuth (JWT), requireRole, marketplaceApiKey,
│  │  │                            validate (zod), errorHandler
│  │  └─ jobs/syncWorker.js
│  └─ tests/                       jest + supertest + mongodb-memory-server
├─ app/                            Expo screens (Supabase calls replaced)
├─ src/
│  ├─ lib/api.ts                   NEW fetch wrapper (base URL, JWT, errors) — replaces lib/supabase.ts
│  ├─ providers/AuthProvider.tsx   JWT session in expo-secure-store
│  └─ services/…                   rewritten to call the API
├─ docs/MARKETPLACE_INTEGRATION.md rewritten for the new endpoints
└─ supabase/                       DELETED
```

### 3.1 API routes
| Method & path | Auth | Replaces |
|---|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/password` | public / JWT | Supabase Auth (agent) |
| `POST /api/auth/driver/login` | public | driver auth + `link_driver_account` |
| `POST /api/integrations/marketplace/orders` | `x-api-key` | Edge Function `ingest-marketplace-order` |
| `GET /api/orders?filter=`, `GET /api/orders/:id` | agent | marketplaceOrders.ts, orders.ts |
| `POST /api/orders/:id/accept`, `/reject`, `/fail`, `/return` | agent | marketplaceOrders.ts |
| `POST /api/orders/:id/assign` {driverId, vehicleId} | agent | deliveries/[id].tsx, logistics.ts |
| `GET/POST/PATCH /api/drivers`, `/api/vehicles` | agent | delivery-partners, fleet |
| `GET /api/deliveries/:id`, `GET /api/deliveries/:id/timeline` | agent/driver | deliveries.ts, logistics.ts |
| `GET /api/driver/deliveries`, `PATCH /api/deliveries/:id/status` | driver | driver/deliveries.ts |
| `POST /api/tracking/location` | driver | driver/locationTracking.ts |
| `GET /api/tracking/deliveries/:id/latest`, `GET /api/tracking/live` | agent | realtime channels (map, tracking) |
| `GET /api/metrics/dashboard` | agent | dashboard.tsx, analytics.ts (logistics parts) |
| `POST /api/orders/:id/sync/retry`, `GET /api/orders/:id/sync/logs` | agent | `retry_marketplace_sync`, callback logs |
| `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all` | agent | notifications.ts |
| `POST /api/ai/voice` | agent | Edge Function `agri-ai` |

---

## 4. File-by-file change list

**Delete**
- `supabase/` (whole folder, 27 files)
- `src/lib/supabase.ts`
- Depends on 1.8: `src/services/farmers.ts`, `buyers.ts`, `products.ts`, `finance.ts`,
  `src/services/integration/orders.ts` (already disabled), and screens `farmers/*`,
  `add-farmer.tsx`, `buyers/*`, `products/*`, `payments/**`, `earnings/`, `orders/create.tsx`, `disputes/`

**Create** — everything under `backend/` (section 3), plus `src/lib/api.ts`

**Rewrite (Supabase → API)**
- Auth: `src/providers/AuthProvider.tsx`, `app/(auth)/login.tsx`, `signup.tsx`,
  `forgot-password.tsx`, `reset-password.tsx`, `app/(agent)/settings.tsx`,
  `src/components/ui/Sidebar.tsx`, `src/services/agent.ts`, `src/services/driver/auth.ts`
- Logistics: `src/services/integration/marketplaceOrders.ts`, `marketplaceSync.ts`,
  `src/services/logistics.ts`, `src/services/deliveries.ts`, `src/services/orders.ts`,
  `src/services/driver/deliveries.ts`, `src/services/driver/locationTracking.ts`,
  `src/services/logistics/location.ts`, `src/services/tracking.ts`,
  `src/services/notifications.ts`, `src/services/employees.ts`, `src/services/analytics.ts`
- Screens with inline queries: `app/(agent)/dashboard.tsx`, `deliveries/[id].tsx`,
  `deliveries/add.tsx`, `delivery-partners/index.tsx`, `fleet/index.tsx`, `logistics/map.tsx`,
  `logistics/workspace/[id].tsx`, `marketplace/index.tsx`, `orders/index.tsx`,
  `reports.tsx`, `voice/index.tsx`, `src/services/voice/SpeechRecognitionService.ts`
- Field renames in screens: snake_case Postgres columns → camelCase model fields
  (e.g. `pickup_address` → `pickup.address`, `logistics_status` → `logisticsStatus`)
- Config: `package.json` (remove supabase-js and url-polyfill, add expo-secure-store),
  `.env.example` (`EXPO_PUBLIC_API_URL` only), `tsconfig.json`, `README.md`,
  `docs/MARKETPLACE_INTEGRATION.md`

**Farm Marketplace repo (outside this project)**: change the intake URL env var to
`<agri-backend>/api/integrations/marketplace/orders`. No other change is needed.

---

## 5. npm packages
**backend/**: `express`, `mongoose`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `zod`, `cors`,
`helmet`, `express-rate-limit`, `morgan`
dev: `nodemon`, `jest`, `supertest`, `mongodb-memory-server`

**Expo app**: add `expo-secure-store`; remove `@supabase/supabase-js`, `react-native-url-polyfill`

---

## 6. Migration sequence
1. Backend skeleton: env loading, DB connection service, health route (`GET /api/health` pings Atlas).
2. Models + indexes (`syncIndexes` on boot).
3. Auth (agents, drivers) and JWT middleware.
4. Intake endpoint (same contract as today) and the intake tests ported from `marketplace_integration_test.sql`.
5. Orders, assignment, delivery status state machine, events/timeline, tracking, metrics, notifications.
6. Sync outbox + worker + retry and logs; callback client ported from `marketplaceCallbackService.ts`.
7. Voice AI route (port of `agri-ai`).
8. Expo: `lib/api.ts`, AuthProvider, then every service and screen in section 4.
9. Delete `supabase/`, `src/lib/supabase.ts`, packages and env vars; `grep -ri supabase` must return nothing.
10. Point the Marketplace intake URL at the new backend and run end-to-end tests.

Data: the Supabase `orders` table is empty. **[DECIDE]** whether any drivers or vehicles
in Supabase need copying, or you start fresh (recommended).

---

## 7. Testing checklist
**Automated (backend, in-memory MongoDB)**
- [ ] intake: 401 without / with a wrong key; 400 on an invalid payload; 201 on create; 200 on a re-send (idempotent); concurrent duplicate sends create 1 order
- [ ] intake stores no price, payment, escrow, product-id or customer-account fields
- [ ] marketplace cancel frees driver + vehicle and queues no echo callback
- [ ] accept / reject / fail / return flows and their callbacks
- [ ] assign driver → PICKUP_ASSIGNED; driver can't be double-assigned
- [ ] state machine rejects illegal transitions; status never moves backwards
- [ ] GPS: 3 pings inside 30 s → 1 location callback
- [ ] sync worker back-off timings; DEAD after 10 attempts; retry re-queues; logs written
- [ ] agent A can't read or modify agent B's orders, drivers or vehicles; driver sees only own jobs
- [ ] metrics counts match the fixture data

**Manual (Expo app)**
- [ ] agent sign-up / login / logout / session restore; driver login
- [ ] Marketplace Orders screen loads (the original bug)
- [ ] a real order from Farm Marketplace appears within seconds
- [ ] order details, driver assignment, Logistics Workspace, timeline
- [ ] driver app: deliveries list, status transitions, GPS updates while moving
- [ ] live map shows the driver moving (polling)
- [ ] dashboard metrics, notifications, retry sync button, sync log
- [ ] voice assistant
- [ ] `grep -ri supabase` over the repo (excluding node_modules) returns nothing

---

## 8. Security notes
- The Atlas password was shared in chat. **Rotate it after migration** and update `backend/.env`.
- `backend/.env` is git-ignored by the existing `.env` rule; only `.env.example` (no secrets) is committed.
- The Expo app never sees `MONGODB_URI`; it talks to the backend only.
- Atlas Network Access must allow the backend host's IP.
