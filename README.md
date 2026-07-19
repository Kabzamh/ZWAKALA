# Zwakala API — backend skeleton

NestJS + Prisma + PostgreSQL implementation of the MVP described in `openapi.yaml` /
`api-design-notes.md` and the `schema.prisma` ER diagram from earlier in this thread.
Implements the full passenger loop end to end: OTP auth → fare estimate → request a
ride → simulated dispatch/matching → driver accept/arrive/start/complete → payment →
rating. Fleet management, dispatch console, and admin endpoints are out of scope, same
as the schema and OpenAPI spec.

## Run it

```bash
npm install
cp .env.example .env        # point DATABASE_URL at a real Postgres instance
npx prisma migrate dev      # creates tables
npx prisma db seed          # demo passenger, driver, ride types
npm run start:dev
```

API at `http://localhost:3000/v1`, interactive docs at `http://localhost:3000/docs`.

**To actually test the full loop end to end**, open two more terminals:

```bash
# Terminal 2 — plays the seeded driver, auto-accepting/arriving/starting/completing rides
npm run driver:bot
```

Then open `prototype/index.html` (or `zwakala-ride-app-prototype.html` if you have it
standalone) in a browser — it's a real client now, not a mock:

1. Sign in with the pre-filled seeded passenger number (`+27820000001`). Tap
   **"Reveal code (dev)"** instead of digging through server logs for the OTP.
2. Pick a ride type, confirm.
3. Watch `driver-bot`'s terminal — within ~2s it accepts the offer, and the prototype's
   "searching" screen flips to "matched" the moment the real `ride.driver_assigned`
   WebSocket event arrives.
4. The bot calls `/arrived` → `/start` → `/complete` on its own timers; the app's screen
   transitions and final fare are driven by the real `ride.status_changed` events and a
   real `GET /rides/:id`, not by local timers pretending to be a backend.
5. Rate the trip — that's a real `POST /rides/:id/rating` call.

The dev-only `GET /auth/otp/dev-peek` endpoint (used by both the bot and the "Reveal
code" button) is disabled automatically when `NODE_ENV=production`.

**Try the full loop against Swagger/Postman instead, if you'd rather not use the UI:**
1. `POST /v1/auth/otp/request` with `{"phone": "+27820000001"}` (the seeded passenger).
2. `GET /v1/auth/otp/dev-peek?otpId=...` to grab the code without checking logs.
3. `POST /v1/auth/otp/verify` → bearer token.
4. `POST /v1/rides/estimate`, then `POST /v1/rides` to request one.
5. Run `npm run driver:bot` in another terminal to have it matched and driven automatically, or drive the seeded driver's token through `/accept` → `/arrived` → `/start` → `/complete` by hand.

## What's genuinely done vs. stubbed

**Real, working logic:**
- OTP auth (dev-mode: code goes to the server log, not SMS) with JWT access/refresh tokens
- Fare + ETA calculation (haversine distance × road-network fudge factor — swap for Google Directions/Mapbox when ready)
- Offer-based dispatch: one driver holds an offer at a time, 15s expiry auto-advances to the next candidate, matches the WebSocket event table in the API design notes
- Full ride state machine matching `Ride.status` in the Prisma schema, with authorization checks (only the assigned driver can advance a ride, only a party to the ride can view/cancel/rate it)
- Wallet debit/credit with balance checks, bidirectional ratings with running average recompute, promo code validation + redemption + single-use enforcement
- Global error shape (`{ error: { code, message, details } }`), global JWT guard with `@Public()` opt-out, request validation via DTOs on every endpoint

**Deliberately mocked, with a comment at each site pointing to the real implementation:**
- Payment provider (`PaymentsService.chargeCard`) — always succeeds, no real Stripe call
- OTP delivery — console.log instead of Twilio/etc.
- Driver matching — nearest *online* driver, not a real geo-index query
- OTP store and offer state are in-memory (fine for one instance; move to Redis before running >1 replica)

## A note on this build

`npm install` completed clean (482 packages). This sandbox's network allowlist doesn't
reach `binaries.prisma.sh`, so `prisma generate` couldn't download the real query engine
or produce fully-typed Prisma Client output here — it fell back to a loose `any`-typed
stub. That means the code compiled with zero TypeScript errors, which confirms every
import, decorator, module wire-up, and DTO in the ~40 files is structurally correct —
but it does **not** confirm every Prisma field name matches the schema with full type
safety, since that check was effectively bypassed. Run `npx prisma generate` on your own
machine (normal, unrestricted network) as the first step — it'll surface anything I got
wrong immediately as a type error pointing at the exact line.

## Layout

```
prisma/schema.prisma   — same schema from the ER diagram
prisma/seed.ts         — demo data
scripts/driver-bot.js  — plays the seeded driver against the real API, for end-to-end testing
src/auth/               OTP request/verify, JWT issue+refresh, dev-only OTP peek
src/users/               profile, saved addresses, payment methods
src/ride-types/          Econo/Comfort/XL/Lux catalogue
src/rides/               estimate, create, cancel, driver lifecycle, promo, ratings
  ├─ pricing.service.ts   distance + fare math
  └─ matching.service.ts  offer/accept/decline/timeout dispatch
src/driver/               online status, location heartbeat, own-profile lookup
src/payments/             mock charge, retry endpoint
src/wallet/                balance, topup, debit/credit ledger
src/promo/                 code validation
src/realtime/              Socket.IO gateway — ride.*, driver.* events
src/health/                 public health check, for the frontend to detect the backend
src/common/                 global error filter, pagination DTO
```
