# Zwakala API — Design Notes

Companion to `openapi.yaml`. Covers the things a REST spec doesn't capture: auth flow, realtime events, and shared conventions.

## Base URL & versioning

`https://api.zwakala.app/v1` — version is in the path so breaking changes ship as `/v2` without forcing every client to upgrade at once.

## Authentication

Phone-first, OTP-based (matches the passenger app prototype — no password screen in the happy path):

1. `POST /auth/otp/request` — client sends phone number, gets back an `otpId`.
2. `POST /auth/otp/verify` — client sends the 6-digit code, gets back `accessToken` (short-lived, ~1hr) and `refreshToken` (long-lived, ~30 days).
3. Every other request sends `Authorization: Bearer <accessToken>`.
4. `POST /auth/refresh` when the access token expires. Refresh tokens are single-use and rotate on each call, so a leaked one only works once.

Email/social login can be added later as alternate paths into the same token exchange — they don't change anything downstream.

## Realtime events (WebSocket / Socket.IO)

REST handles state changes; a socket connection handles everything that needs to update the screen *without* the user refreshing — this is what drives the "searching → matched" transition and the live car marker in the prototype.

Client connects to `wss://api.zwakala.app/v1/realtime` with the access token, and joins a room scoped to their active ride (`ride:{rideId}`) once one exists.

| Event | Direction | Payload | Drives |
|---|---|---|---|
| `ride.driver_assigned` | server → passenger | `{ rideId, driver, vehicle, etaSeconds }` | searching screen → matched screen |
| `ride.no_drivers_found` | server → passenger | `{ rideId }` | matching timeout, offer retry |
| `ride.status_changed` | server → both | `{ rideId, status, timestamp }` | ARRIVED / IN_PROGRESS / COMPLETED transitions |
| `driver.location_updated` | server → passenger | `{ rideId, lat, lng, heading }` | live car marker on map |
| `ride.request_offer` | server → nearby driver | `{ rideId, pickup, dropoff, estimatedFare, expiresInSeconds }` | incoming request screen on driver app |
| `ride.offer_expired` | server → driver | `{ rideId }` | offer times out, routed to next driver |
| `chat.message` | both directions | `{ rideId, senderId, body, sentAt }` | in-trip messaging |

Offers expire server-side (~15s) if a driver doesn't respond — the matching service then re-broadcasts to the next-nearest available driver rather than waiting on a client timeout.

## Conventions

- **Errors**: always `{ "error": { "code", "message", "details" } }` with a matching HTTP status. `code` is a stable machine-readable string (`VALIDATION_ERROR`, `RIDE_ALREADY_ACCEPTED`, `PAYMENT_DECLINED`, …) — clients should switch on `code`, never on `message` text.
- **Money**: always a decimal number in the response, in the account's currency (`ZAR` for MVP). Never floats client-side for anything that gets summed — round only for display.
- **Timestamps**: ISO 8601 UTC everywhere.
- **Pagination**: `page` / `pageSize` query params, response includes `page` and `totalPages`. Default page size 20, max 100.
- **Idempotency**: `POST /rides` and `POST /rides/{id}/pay` accept an `Idempotency-Key` header — a client that retries after a timeout won't double-book a ride or double-charge a card.
- **One active ride per passenger**: `POST /rides` returns `409` if the passenger already has a ride in `REQUESTED`, `ACCEPTED`, `ARRIVED`, or `IN_PROGRESS`. Simplifies MVP state management; multi-ride-in-flight (e.g. booking for someone else) is a later feature.

## Request lifecycle, endpoint by endpoint

Maps directly onto the prototype's screens and the `Ride.status` enum in the schema:

```
home screen            → GET /ride-types, POST /rides/estimate
ride select + confirm  → POST /rides                      [REQUESTED]
searching               ← ride.driver_assigned | ride.no_drivers_found
matched screen          ← driver.location_updated (repeated)
                        → POST /rides/{id}/cancel (optional, passenger-initiated)
driver arrives          ← ride.status_changed → ARRIVED
trip screen             ← ride.status_changed → IN_PROGRESS
                         ← driver.location_updated (repeated, drives the meter)
trip complete            ← ride.status_changed → COMPLETED
                        → POST /rides/{id}/pay (auto-triggered server-side on completion for card/wallet; this endpoint is the retry path)
rating                 → POST /rides/{id}/rating
```

## Not in this version

Deliberately excluded from the MVP spec, matching the schema's scope: fleet/dispatch endpoints, admin dashboard endpoints, corporate accounts, multi-stop rides, and scheduled (future-dated) rides. Each is additive — none require changing the shapes already defined here.
