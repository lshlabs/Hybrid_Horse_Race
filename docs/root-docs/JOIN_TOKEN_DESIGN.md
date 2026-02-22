# Join Token Design (MPC-05)

## 1. Purpose

Define a room-scoped join token model that satisfies:

1. Host creates room.
2. Guest joins via room code/link.
3. Host leaves -> earliest joined guest becomes host (room survives if players remain).
4. Room deleted only when zero players remain.
5. Deleted room access redirects to Landing.
6. Host and guests share same synchronized pipeline.

## 2. Design Principles

- No external login required.
- Keep existing `guestId + sessionToken` as device/session identity proof.
- Add room-scoped `joinToken` as participation proof.
- `joinToken` is one-time issued per successful join handshake and short-lived/rotatable.
- All gameplay callables require both:
  - global identity proof (`playerId + sessionToken`)
  - room membership proof (`joinToken`)

## 3. Data Model

### 3.1 Room participant auth doc

Path: `rooms/{roomId}/participantAuth/{playerId}`

Fields:
- `tokenHash: string` (SHA-256 of joinToken)
- `tokenVersion: number` (increment on reissue)
- `issuedAt: Timestamp`
- `expiresAt: Timestamp`
- `revokedAt?: Timestamp`
- `lastSeenAt: Timestamp`
- `status: 'active' | 'revoked'`

### 3.2 Existing players doc (unchanged ownership)

Path: `rooms/{roomId}/players/{playerId}`

Use existing fields (`isHost`, `joinedAt`, etc.) as source of gameplay participant state.

## 4. API Contract

## 4.1 `joinRoom` (integrated issuance)

Request:
- `roomId`
- `playerId`
- `sessionToken`
- `playerName`

Response:
- `success: boolean`
- `playerId: string`
- `joinToken: string`
- `joinTokenExpiresAtMillis: number`
- `rejoined: boolean`

Server behavior:
- Validate room exists and is joinable (`waiting`).
- Validate guest session (`playerId + sessionToken`).
- If player already in room: treat as rejoin/idempotent and reissue joinToken.
- If new player: add player, then issue joinToken.

## 4.2 `refreshJoinToken` (optional but recommended)

Request:
- `roomId`
- `playerId`
- `sessionToken`
- `currentJoinToken`

Response:
- `joinToken`
- `joinTokenExpiresAtMillis`

Server behavior:
- Validate guest session.
- Validate current joinToken active.
- Rotate token (increment `tokenVersion`, overwrite hash).

## 4.3 Existing gameplay callables (validation expansion)

All gameplay actions add `joinToken` in request and validate room membership token:
- `setPlayerReady`
- `updateRoomSettings`
- `startGame`
- `selectHorse`
- `selectAugment`
- `rerollAugments`
- `startRace`
- `skipSet`
- `submitFinalRaceResult`
- `leaveRoom`

Validation order:
1. `verifyGuestSession(playerId, sessionToken)`
2. `verifyRoomJoinToken(roomId, playerId, joinToken)`
3. Existing role/phase checks (`isHost`, `room.status`, etc.)

## 5. Token Semantics

- Issuance: on successful join (or rejoin).
- Uniqueness: each issuance invalidates previous token for that `(roomId, playerId)`.
- TTL: default 6 hours (configurable).
- Revocation:
  - on `leaveRoom` for that player
  - on room deletion
- Storage: client localStorage (room-scoped key), never in URL.

## 6. Duplicate Join / Rejoin Policy

### Duplicate join (same player already in room)
- Keep existing player slot.
- Reissue joinToken.
- Do not duplicate player doc.

### Rejoin after temporary disconnect
- Same `playerId + sessionToken` can request new joinToken.
- Progress state remains from existing player doc.

### Rejoin after explicit leave
- Treated as new join (new joinedAt timestamp).
- host election remains based on current `joinedAt` order.

## 7. Security/Abuse Notes

- Compare hashed token only (`tokenHash`), not plaintext storage.
- Log invalid token attempts with `roomId/playerId/ip(if available)`.
- Apply callable rate limiting guidance for repeated failed attempts.
- Keep error responses generic enough to avoid room enumeration leakage.

## 8. Frontend Integration Rules

- On lobby entry:
  - ensure guest session
  - call `joinRoom`
  - store returned `joinToken` under `roomId` scope
- On gameplay callable:
  - attach `roomId, playerId, sessionToken, joinToken`
- On token-expired error:
  - call `joinRoom` rejoin flow (or `refreshJoinToken`) and retry once
- On room missing/not-found:
  - redirect to Landing

## 9. Migration Plan (MPC-06 input)

1. Backend:
- add `issueRoomJoinToken`, `verifyRoomJoinToken` helpers
- extend `joinRoom` response schema
- add joinToken validation to gameplay callables

2. Frontend:
- add room-scoped joinToken store helper
- update `joinRoom` call site to save token
- update callable payloads to include joinToken

3. Verification:
- host create -> guest join -> token issued
- duplicate join/rejoin -> token rotated, player doc deduped
- invalid token -> permission denied
- host leave migration still works

## 10. Completion Criteria for MPC-05

- This document is approved as implementation contract.
- MPC-06 can proceed without policy ambiguity on issuance/consumption/rejoin.
