# Farm Marketplace ⇄ Agri Agent Integration

Agri Agent is the **logistics system**: delivery partners (drivers), vehicles, deliveries,
pickups, GPS and delivery events. Farm Marketplace is the **commerce system of record**:
customers, farmers, products, inventory, prices, payments, escrow and reviews.

Both apps use the **same MongoDB Atlas database** (`farm_marketplace`), but Agri Agent only
ever reads and writes its own collections, all prefixed **`agri_`**. The apps exchange data
**only over HTTPS with a shared API key**: the Marketplace POSTs orders to the Agri Agent
backend, and the backend POSTs status callbacks back. Neither app reads the other's collections.

## Data ownership: what Agri Agent keeps and what it never copies

```
 Farm Marketplace collections (SYSTEM OF RECORD)        Agri Agent · agri_* collections (LOGISTICS COPY)
 ──────────────────────────────────────────────         ──────────────────────────────────────────────
 customer accounts        ✗ never copied                agri_orders (source MARKETPLACE):
 farmer accounts          ✗ never copied                  external_order_id (the only link), tracking_id,
 products / inventory     ✗ never copied                  pickup + drop address, handover contact name + phone,
 prices, totals           ✗ never copied                  package summary + items, priority / perishable, ETA
 payments, escrow         ✗ never copied                agri_delivery_jobs      driver + vehicle assignment
 reviews, analytics       ✗ never copied                agri_tracking_history   GPS points
                                                        agri_delivery_events    delivery timeline
                                                        agri_sync_queue / agri_sync_logs   callbacks
```

- A marketplace order becomes **one logistics job** in `agri_orders` with `source: "MARKETPLACE"`.
  No farmer, buyer, product, payment, commission or settlement records are created, and the model
  strips every money field (`price`, `total_amount`, …) from marketplace jobs.
- The intake **ignores** `buyerId`, `farmerId`, `productId`, item prices, `totalAmount`, `paymentStatus`,
  `paymentMethod` and anything else logistics doesn't need. The raw payload isn't stored.
- Contact names and phone numbers are kept **only because a driver needs them at pickup and drop-off**.
- Everything that happens in logistics goes back to the marketplace through the callback API. The
  marketplace decides what it means for the order, payment or escrow (e.g. release escrow on `DELIVERED`).
- The agent's own business records (their farmers, buyers, produce stock, cash payments, commissions,
  settlements) are separate `agri_*` collections and are **never** linked to marketplace jobs.
- Agent orders still require a farmer (`farmer_id`); only marketplace jobs may leave it empty.

## Sequence

```
 Farm Marketplace                     Agri Agent backend (Express + Mongoose)          Expo app
 (Express + MongoDB)                  agri_* collections in the same Atlas DB        (agent / driver)
      │                                                                                  │
      │ 1. buyer places order                                                            │
      │── POST /api/integrations/marketplace/orders ──▶ verify x-api-key                 │
      │   x-api-key: SHARED_KEY                          intake (idempotent on           │
      │                                                  externalOrderId, unique index)  │
      │◀──────────────── 201 { trackingId: "AGRI-…" } ── agri_orders, NEW                │
      │                                                  + agent notification ──────────▶│ 2. Marketplace Orders
      │                                                                                  │    Accept / Reject
      │                                                                                  │    Assign driver+vehicle
      │                                   dispatch / status / driver transitions ◀───────│ 3. JWT-authenticated
      │                                   GPS ◀──────────────────────────────────────────│    API calls
      │                                     │ deliveryService: timeline event,           │
      │                                     │ forward-only order status                  │
      │                                     ▼                                            │
      │                               agri_sync_queue (outbox)                           │
      │                                     │  sent immediately + swept every 15 s       │
      │                                     ▼                                            │
      │◀── POST /api/integration/order-status ── syncService (retry w/ back-off,         │
      │    x-api-key: SHARED_KEY                  dead-letter, agri_sync_logs)           │
      │── 200 ─────────────────────────────────▶ job SENT, order SYNCED                  │
      │                                                                                  │
      │ 4. buyer cancels → re-POST same order with orderStatus:"cancelled"               │
      │────────────────────────────────────────▶ order/delivery/pickup CANCELLED,        │
      │                                          driver + vehicle freed, agent           │
      │                                          notified (no echo callback)             │
```

The marketplace API key lives only in `backend/.env`. It is never shipped in the Expo bundle.

## Setup

1. **Agri Agent backend** (`backend/.env`, see `backend/.env.example`):
   - `MONGODB_URI`: the Farm Marketplace Atlas URI (same database).
   - `JWT_SECRET`: a long random string.
   - `MARKETPLACE_API_KEY`: the shared secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `MARKETPLACE_DEFAULT_AGENT_EMAIL`: the email of the Agri Agent account that receives marketplace orders.
     Sign up in the app first, then set it.
   - `MARKETPLACE_API_URL`: the Farm Marketplace backend base URL for callbacks (e.g. `http://192.168.1.20:5000`).
2. **Farm Marketplace backend** (`backend/.env`):
   - `AGRI_AGENT_API_KEY` = the same value as `MARKETPLACE_API_KEY` above.
   - The Agri intake URL = `http://<agri-backend-host>:4000/api/integrations/marketplace/orders`
     (whichever variable the marketplace uses for the Agri Agent URL, e.g. `AGRI_AGENT_API_URL`).
3. **Atlas → Network Access**: allow the IP of the machine running the Agri Agent backend.
4. Start the backend: `cd backend && npm install && npm start`. Check it with `GET /api/health`.

## Callback payloads (Agri Agent → Marketplace)

`POST {MARKETPLACE_API_URL}/api/integration/order-status` with header `x-api-key: <shared key>`

**Driver assigned** (status change):
```json
{
  "externalOrderId": "665f1c2b9a1e4b0012345678",
  "logisticsStatus": "PICKUP_ASSIGNED",
  "trackingId": "AGRI-3F2A9C1B7D",
  "driver":  { "id": "66f2…a1", "name": "Manjunath K", "phone": "9845012345" },
  "vehicle": { "id": "66f2…b2", "number": "KA-09-AB-1234", "type": "Tata Ace" },
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

The driver state machine is enforced by the backend (`backend/src/services/logisticsRules.js`); the app mirrors it only to show valid buttons.
Status only ever moves forward on both sides, so late or duplicate events are harmless.

## Retry and failure handling

- Back-off: 30 s, 60 s, 2 min, 4 min … capped at 1 h. **Dead-lettered after 10 attempts**, or immediately on 400/404/410/422.
- If a callback for an order fails, later callbacks for that order wait behind it, so ordering is preserved.
- `marketplace_sync_status` / `marketplace_last_synced_at` / `marketplace_last_error` are shown on each Marketplace Orders card.
- The **Retry Sync** button calls `POST /api/marketplace/orders/:id/sync/retry`, which re-queues FAILED and DEAD callbacks for that order.
- While `MARKETPLACE_API_URL` is unset, callbacks stay queued (PENDING). Nothing is lost.
- Debugging: `GET /api/marketplace/orders/:id/sync/logs`, or in Atlas: `db.agri_sync_logs.find({ success: false }).sort({ created_at: -1 })`.

## Common pitfalls

0. ❌ Reading or writing Marketplace collections (`users`, `products`, `orders`, …) from Agri Agent. ✅ Only `agri_*`. Ask the marketplace API for anything else.
1. ❌ Putting `MARKETPLACE_API_KEY` or `MONGODB_URI` in the app `.env` / `EXPO_PUBLIC_*`. ✅ `backend/.env` only.
2. ❌ Different keys on the two sides. ✅ `MARKETPLACE_API_KEY` (Agri) == `AGRI_AGENT_API_KEY` (Marketplace).
3. ❌ `MARKETPLACE_DEFAULT_AGENT_EMAIL` left empty or mistyped, so every intake returns 503. ✅ Use the exact email of an existing Agri Agent account.
4. ❌ `EXPO_PUBLIC_API_URL=http://localhost:4000` on a phone. ✅ Use the computer's LAN IP.
5. ❌ Atlas Network Access not allowing the backend's IP, so the backend fails to start with a server-selection timeout. ✅ Add the IP (or 0.0.0.0/0 for development only).

## Testing

```bash
cd backend
npm test          # 48 tests: intake, dispatch, driver flow, GPS throttling, callbacks, retries, auth, isolation
```
The tests need a MongoDB server: they use `MONGODB_TEST_URI` (default `mongodb://127.0.0.1:27017`) and
create and drop their own `agri_test_*` databases. **Never point them at Atlas production.**

### Manual checklist
- [ ] Place an order on the marketplace. It appears under **Marketplace Orders** as NEW, the agent gets a notification, and the marketplace order shows `trackingId AGRI-…`.
- [ ] In Atlas, check that the only new documents are in `agri_*` collections, and that the `agri_orders` document has no `price` / `total_amount`.
- [ ] POST to the intake with a wrong key and get 401. POST with no `externalOrderId` and get 400.
- [ ] **Accept**. The marketplace timeline shows "Order accepted by the logistics partner…".
- [ ] **Assign Driver & Vehicle** → Confirm Dispatch. The marketplace shows *Driver Assigned*, the driver name/phone and the vehicle number.
- [ ] Driver app: Accept → En route → Arrived at farm → Picked up → In transit. The marketplace moves accepted → packed → shipped, and GPS updates.
- [ ] Stop the marketplace backend and advance a status. The card shows *Sync failed*. Restart it and tap **Retry Sync**; the card returns to *Synced*.
- [ ] Deliver. The marketplace shows delivered.
- [ ] Cancel a different order on the marketplace while a driver is assigned. In Agri, the order, delivery and pickup show CANCELLED, the driver goes back ONLINE and the vehicle to AVAILABLE.
- [ ] **Reject** a NEW order with a reason. The marketplace cancels it with that reason.
- [ ] **Mark Failed**, then **Mark Returned**. The marketplace shows *Delivery Failed* and then *Returned*.
