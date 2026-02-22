# MPC-08 Observability Hardening

Date: `2026-02-21`

## 1. Objective

Provide structured lifecycle/security logs and an operator checklist for multiplayer room incidents.

## 2. Structured Event Keys

Implemented in `functions/src/index.ts`:

- Session/Auth
  - `session.guest.created`
  - `auth.guestSession.notFound`
  - `auth.guestSession.invalid`
  - `auth.guestSession.expired`
  - `auth.joinToken.notFound`
  - `auth.joinToken.invalid`
  - `auth.joinToken.expired`
  - `auth.joinToken.revoked`

- Room lifecycle
  - `room.create.success`
  - `room.join.success`
  - `room.join.rejoin`
  - `room.join.denied.full`
  - `room.join.denied.status`
  - `room.leave.success`
  - `room.host.transferred`
  - `room.delete.emptyAfterHostLeave`
  - `room.delete.lastPlayerLeft`

## 3. Required Context Fields

Event payloads include combinations of:
- `roomId`
- `playerId` / `hostPlayerId` / `newHostId`
- `status`
- `remainingPlayers`
- `reason`

## 4. Troubleshooting Checklist

1. `createGuestSession` fails:
- Check for `auth.guestSession.*` warnings.
- Verify emulator port `5001` is listening.
- Verify malformed cached `guest-session` data is cleared.

2. Join denied:
- `room.join.denied.full` => max capacity reached.
- `room.join.denied.status` => room is not in `waiting`.

3. Host migration issues:
- Confirm `room.host.transferred` fired with expected `newHostId`.
- Confirm follow-up `room.leave.success` includes remaining player count.

4. Unexpected room deletion:
- Check `room.delete.*` event key.
- Cross-check preceding `room.leave.success` and `remainingPlayers`.

5. Token/auth errors during gameplay:
- Look for `auth.joinToken.*` and `auth.guestSession.*` events.
- Validate client sent `{ playerId, sessionToken, joinToken }` for callable.

## 5. Recommended Ops Practice

- Filter logs by `roomId` first, then timeline by event key.
- On incident report, capture:
  - failing callable name
  - first auth warning event
  - first room lifecycle deviation event
- Preserve emulator/production log snippets for reproducible regression checks.
