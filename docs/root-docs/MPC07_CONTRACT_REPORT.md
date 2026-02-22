# MPC-07 Contract Verification Report

Date: `2026-02-21`

## 1. Verification Command

```bash
npm run build --prefix functions && firebase emulators:exec --only functions,firestore "node frontend/scripts/mpc07-contract-check.mjs"
```

## 2. Scenario Script

- Script: `frontend/scripts/mpc07-contract-check.mjs`
- Scope:
  - Host create room
  - Guest join flow via roomId (share-link equivalent)
  - Host leave -> host migration
  - Empty-room deletion
  - Deleted-room access behavior
  - Shared pipeline progression checks (`waiting -> horseSelection -> augmentSelection`)

## 3. Result Summary

- PASS 6 / 6

Detailed:
- PASS | Contract-1 | Host can create a room
- PASS | Contract-2 | Guests can join via room code/link path (roomId)
- PASS | Contract-3 | Host left -> earliest joined guest became host
- PASS | Contract-4 | Room survives with players, deletes when empty
- PASS | Contract-5 | Deleted room access yields not-found (frontend uses this to redirect Landing)
- PASS | Contract-6 | All players follow same callable/realtime phase progression

## 4. Evidence Notes

- During verification, callable logs confirmed:
  - host change events (`Host changed`) after host leave
  - final room delete event (`Room deleted ...`) when last player leaves
  - not-found errors for deleted room join attempts
  - deterministic phase transition to `augmentSelection` after all players select horse

## 5. Fixes Applied During Verification

- `functions/src/index.ts`
  - Fixed invalid Firestore write in join token issuance path by removing `FieldValue.delete()` from `set()` payload.

## 6. Remaining Work

- Move to `MPC-08` (lifecycle observability hardening) and finalize acceptance checklist for `MPC-01` closure.
