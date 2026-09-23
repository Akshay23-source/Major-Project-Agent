# Farm Marketplace ⇄ Agri Agent Integration

Agri Agent (Supabase) is the **logistics system of record**: delivery partners, drivers,
vehicles, deliveries, pickups, GPS and delivery events.
Farm Marketplace (MongoDB Atlas) is the **commerce system of record**: farmers, buyers,
products, inventory, orders and payments.

The two talk **only over HTTPS with a shared API key**. There is no shared database or shared code.

## Data ownership: what Agri Agent keeps and what it never copies

```
 Farm Marketplace · MongoDB Atlas (SYSTEM OF RECORD)     Agri Agent · Supabase (LOGISTICS COPY ONLY)
 ──────────────────────────────────────────────────     ──────────────────────────────────────────
 customer accounts        ✗ never copied                externalOrderId  (the only link)
 farmer accounts          ✗ never copied                delivery info:   pickup + drop address,
 products / inventory     ✗ never copied                                 handover contact name + phone,
 prices, totals           ✗ never copied                                 package summary ("Tomato (5 kg)"),
 payments, escrow         ✗ never copied                                 priority / perishable, ETA,
 reviews, analytics       ✗ never copied                                 delivery instructions
 marketplace logic        ✗ never copied                driver assignment, vehicle
                                                        GPS (driver_locations)
                                                        delivery events, logistics status
```

- A marketplace order becomes **one logistics job**: a row in `orders` with `source = 'MARKETPLACE'`.
  No rows are created in `buyers`, `farmers` or `products`, and `price` / `total_amount` are stored as `0`.
- The intake **ignores** `buyerId`, `farmerId`, `productId`, item prices, `totalAmount`, `paymentStatus`,
  `paymentMethod` and anything else it doesn't need, even if the marketplace sends them. The raw payload isn't stored.
- Contact names and phone numbers are kept **only because a driver needs them at pickup and drop-off**.
- Everything that happens in logistics goes back to the marketplace through the callback API. The
  marketplace decides what it means for the order, payment or escrow (e.g. release escrow on `DELIVERED`).
- Validation isn't weakened for the agent's own orders: `farmer_id` is still required there,
  enforced by a `CHECK` on `orders` and a trigger on `pickups`. Only marketplace jobs may leave it empty.

## Sequence

```
 Farm Marketplace                    Agri Agent (Supabase)                         Apps
 (Express + MongoDB)                                                           (agent / driver)
      │                                                                              │
      │ 1. buyer places order                                                        │
      │── POST /functions/v1/ingest-marketplace-order ──▶ Edge Fn: verify API key    │
      │   x-api-key: SHARED_KEY                           → ingest_marketplace_order()│
      │                                                     (atomic, idempotent)     │
      │◀──────────────── 201 { trackingId: "AGRI-…" } ────  orders row, NEW          │
      │                                                     + agent notification ───▶│ 2. Marketplace Orders
      │                                                                              │    Accept / Reject
      │                                                                              │    Assign driver+vehicle
      │                                       delivery_events INSERT ◀───────────────│ 3. dispatch / driver
      │                                       driver_locations INSERT ◀──────────────│    transitions / GPS
      │                                         │ trigger (SECURITY DEFINER)         │
      │                                         ▼                                    │
      │                                   marketplace_sync_queue  (outbox)           │
      │                                         │                                    │
      │                                         │  nudge: functions.invoke ◀─────────│
      │                                         │  sweep: pg_cron every minute       │
      │                                         ▼                                    │
      │◀── POST /api/integration/order-status ── Edge Fn: marketplace-callback-worker│
      │    x-api-key: SHARED_KEY                  (marketplaceCallbackService)       │
      │    { externalOrderId, logisticsStatus,    retry w/ backoff, dead-letter,     │
      │      driver, vehicle, trackingEvents,     marketplace_callback_logs          │
      │      currentLocation, timestamp }                                            │
      │── 200 ─────────────────────────────────▶ queue item SENT, order SYNCED       │
      │                                                                              │
      │ 4. buyer cancels → re-POST same order with orderStatus:"cancelled"           │
      │────────────────────────────────────────▶ order/delivery/pickup CANCELLED,    │
      │                                          driver + vehicle freed, agent       │
      │                                          notified (no echo callback)         │
```

Why an outbox and not a direct HTTP call from the app: the marketplace API key must **never**
ship inside the Expo bundle. Using triggers also means that every status change is captured,
whichever app or screen made it, including the driver app, which has no access to `orders`.

## What was added

### Database: `supabase/migrations/014_marketplace_integration.sql` (idempotent)

| Object | Purpose |
|---|---|
| `orders.*` logistics columns | `external_order_id`, `source`, `tracking_id`, `marketplace_intake_status` (NEW/ACCEPTED/REJECTED), `pickup_address`, `pickup_contact_name/phone`, `drop_address`, `drop_contact_name/phone`, `estimated_delivery`, `priority`, `is_perishable` |
| `orders.*` sync columns | `marketplace_sync_status` (PENDING/SYNCED/FAILED), `marketplace_last_synced_at`, `marketplace_last_error` |
| `orders.farmer_id`, `pickups.farmer_id` | optional **only** for marketplace jobs (CHECK constraint + trigger keep it required for agent orders) |
| `marketplace_sync_queue` | outbox + retry queue (`attempts`, `next_attempt_at`, `status`) |
| `marketplace_callback_logs` | every callback attempt, including failed ones, with request and response |
| trigger `delivery_events_marketplace_sync` | every delivery event → callback; also moves `orders.logistics_status` forward |
| trigger `orders_marketplace_sync` | order-level Accept / Reject / direct status edits → callback |
| trigger `driver_locations_marketplace_sync` | GPS → location callback, max 1/min per order |
| `ingest_marketplace_order(jsonb, uuid)` | intake: creates or updates one logistics job, idempotent on `externalOrderId` (service role only) |
| `marketplace_cancel_order(uuid, text)` | marketplace-initiated cancel; frees the driver and vehicle |
| `claim_/finish_/release_marketplace_callbacks` | queue mechanics for the worker (service role only) |
| `retry_marketplace_sync(uuid)` | agent-callable "Retry Sync" (own orders only) |

RLS: agents can **read** their own queue and log rows. No app user can write to them.

### Edge Functions

| Function | Auth | Purpose |
|---|---|---|
| `ingest-marketplace-order` | shared API key (`--no-verify-jwt`) | order intake |
| `marketplace-callback-worker` | Supabase JWT (default) | drains the queue; contains `marketplaceCallbackService` |

### App

- **Marketplace Orders** screen (`app/(agent)/marketplace`): order number, pickup contact and address,
  drop contact and address, priority, current status and sync state (no prices or payment status). Filters: Pending / Pickup Assigned / In Transit / Delivered.
  Actions: Accept, Reject (with reason), Assign Driver & Vehicle (opens the existing Logistics
  Workspace), Timeline, Mark Failed, Mark Returned, Retry Sync.
- **Dashboard**: New Orders, Assigned, Awaiting Pickup, In Transit, Delivered, Sync Failed.
- Driver app, Logistics Workspace and Dispatch screen nudge the worker after each change.

## Setup

1. **Migration.** Run `014_marketplace_integration.sql`, either with `supabase db push` or by pasting it into the SQL editor.
2. **Secrets** (see `supabase/functions/.env.example`):
   ```bash
   supabase secrets set MARKETPLACE_API_URL=https://api.your-marketplace.com \
                        MARKETPLACE_API_KEY=<shared key> \
                        MARKETPLACE_DEFAULT_AGENT_ID=<agents.id>
   ```
3. **Deploy:**
   ```bash
   supabase functions deploy ingest-marketplace-order --no-verify-jwt
   supabase functions deploy marketplace-callback-worker
   ```
4. **Cron sweep** (retries): fill in the placeholders and run `supabase/sql/marketplace_callback_cron.sql` once.
5. **Farm Marketplace `backend/.env`:**
   ```env
   AGRI_AGENT_API_URL=https://<PROJECT_REF>.supabase.co
   AGRI_AGENT_ORDER_PATH=/functions/v1/ingest-marketplace-order
   AGRI_AGENT_API_KEY=<same shared key>
   ```

## Callback payloads (Agri Agent → Marketplace)

`POST {MARKETPLACE_API_URL}/api/integration/order-status` with header `x-api-key: <shared key>`

**Driver assigned** (status change):
```json
{
  "externalOrderId": "665f1c2b9a1e4b0012345678",
  "logisticsStatus": "PICKUP_ASSIGNED",
  "trackingId": "AGRI-3F2A9C1B7D",
  "driver":  { "id": "2222…0001", "name": "Manjunath K", "phone": "9845012345" },
  "vehicle": { "id": "3333…0001", "number": "KA-09-AB-1234", "type": "Tata Ace" },
  "trackingEvents": [
    { "status": "ASSIGNED", "message": "Manjunath K has been assigned to pick up your order.",
      "timestamp": "2026-09-24T09:00:00.000Z" }
  ],
  "currentLocation": { "latitude": 12.3052, "longitude": 76.6552, "updatedAt": "2026-09-24T09:00:00.000Z" },
  "eta": "2026-09-24T12:30:00.000Z",
  "timestamp": "2026-09-24T09:00:00.000Z",
  "source": "agri-agent"
}
```

**Driver arrived at farm** (informational event, so no `logisticsStatus`):
```json
{
  "externalOrderId": "665f1c2b9a1e4b0012345678",
  "driver": { "…": "…" }, "vehicle": { "…": "…" },
  "trackingEvents": [
    { "status": "ARRIVED_AT_FARM", "message": "The driver has arrived at the farm for pickup.",
      "timestamp": "2026-09-24T09:35:00.000Z", "latitude": 12.2958, "longitude": 76.6394 }
  ],
  "currentLocation": { "latitude": 12.2958, "longitude": 76.6394, "updatedAt": "2026-09-24T09:35:02.000Z" },
  "timestamp": "2026-09-24T09:35:00.000Z", "source": "agri-agent"
}
```

**GPS ping** (at most one per minute per order): `trackingEvents: []` plus `currentLocation`.

**Failed delivery:**
```json
{ "externalOrderId": "665f1c2b9a1e4b0012345678", "logisticsStatus": "FAILED_DELIVERY",
  "reason": "Buyer not reachable after 3 attempts",
  "trackingEvents": [{ "status": "FAILED_DELIVERY", "message": "Buyer not reachable after 3 attempts", "timestamp": "…" }],
  "timestamp": "…", "source": "agri-agent" }
```

## Status mapping

| Source in Agri Agent | Sent as `logisticsStatus` | Marketplace order |
|---|---|---|
| Accept (agent) | none (event `ORDER_ACCEPTED`) | unchanged |
| `ASSIGNED` event (dispatch) | `PICKUP_ASSIGNED` | accepted |
| driver `ACCEPTED` | `ACCEPTED` | accepted |
| driver `DRIVER_EN_ROUTE`, `ARRIVED_AT_FARM`, `ARRIVED_AT_DESTINATION`, `VEHICLE_ASSIGNED` | none (timeline event) | unchanged |
| driver `PICKED_UP` | `PICKED_UP` | packed |
| driver `IN_TRANSIT` | `IN_TRANSIT` | shipped |
| driver `OUT_FOR_DELIVERY` | `OUT_FOR_DELIVERY` | shipped |
| driver `DELIVERED` | `DELIVERED` | delivered |
| Reject (agent) | `CANCELLED` + reason | cancelled |
| Mark Failed / Mark Returned | `FAILED_DELIVERY` / `RETURNED` | cancelled |

The driver state machine (`VALID_TRANSITIONS` in `src/services/driver/deliveries.ts`) is unchanged.
Status only ever moves forward on both sides, so late or duplicate events are harmless.

## Retry and failure handling

- Backoff: 30 s, 60 s, 2 min, 4 min … capped at 1 h. **Dead-lettered after 10 attempts**, or immediately on 400/404/410/422.
- After one callback for an order fails, later callbacks for that order wait, so ordering is preserved.
- `orders.marketplace_sync_status` / `marketplace_last_synced_at` / `marketplace_last_error` are shown on each card.
- **Retry Sync** button → `retry_marketplace_sync(order_id)` re-queues FAILED and DEAD items.
- Debugging: `SELECT * FROM marketplace_callback_logs WHERE NOT success ORDER BY created_at DESC;`

## Common pitfalls

0. ❌ Adding marketplace data to Agri "for convenience" (buyer accounts, prices, payment status). ✅ Ask the marketplace API, or have it send what logistics needs.
1. ❌ Putting `MARKETPLACE_API_KEY` in `.env` / `EXPO_PUBLIC_*`. ✅ It's an Edge Function secret only.
2. ❌ Deploying `ingest-marketplace-order` with JWT verification on, which makes every marketplace call return 401. ✅ `--no-verify-jwt`.
3. ❌ Different keys on the two sides. ✅ `MARKETPLACE_API_KEY` (Agri) == `AGRI_AGENT_API_KEY` (Marketplace).
4. ❌ `MARKETPLACE_DEFAULT_AGENT_ID` set to an auth user id. ✅ It's `agents.id`.
5. ❌ Skipping the cron file means retries only happen when someone next uses the app. ✅ Run `marketplace_callback_cron.sql`.

## Testing

```bash
# SQL behaviour (throwaway DB or a Supabase branch, NEVER production — the script rolls back)
psql "$DB_URL" -f supabase/tests/marketplace_integration_test.sql

# Edge Function logic (no Supabase needed)
deno test --allow-net supabase/functions/tests/
```

### Manual checklist
- [ ] Place an order on the marketplace. It appears under **Marketplace Orders** as NEW, the agent gets a notification, and the marketplace order shows `trackingId AGRI-…`.
- [ ] In Supabase, check that **no** new rows exist in `buyers` / `farmers` / `products`, and that the job's `price` and `total_amount` are 0.
- [ ] POST to the intake with a wrong key and get 401. POST with no `externalOrderId` and get 400.
- [ ] **Accept**. The marketplace timeline shows "Order accepted by the logistics partner…".
- [ ] **Assign Driver & Vehicle** → Confirm Dispatch. Marketplace shows *Driver Assigned*, driver name/phone and vehicle number, and a push reaches buyer and farmer.
- [ ] Driver app: Accept → En route → Arrived at farm → Picked up → In transit. The marketplace moves accepted → packed → shipped, and GPS coordinates update.
- [ ] Stop the marketplace backend and advance a status. The card shows *Sync failed*. Restart the backend and tap **Retry Sync**; the card returns to *Synced*.
- [ ] Deliver. Marketplace shows delivered (and marks a cash order paid).
- [ ] Cancel a different order on the marketplace while a driver is assigned. In Agri, the order, delivery and pickup show CANCELLED, the driver goes back ONLINE and the vehicle to AVAILABLE, and the agent gets a notification.
- [ ] **Reject** a NEW order with a reason. The marketplace cancels it with that reason.
- [ ] **Mark Failed**, then **Mark Returned**. The marketplace shows *Delivery Failed* and then *Returned*.
