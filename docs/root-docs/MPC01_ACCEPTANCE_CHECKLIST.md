# MPC-01 Acceptance Checklist

Date: `2026-02-21`

## Scope

`MPC-01`: Room-code/link canonical entry flow.

Done criteria:
- All joins use room code/link entry
- Server validates room existence and join eligibility

## Checklist

- [x] Host creates room and receives `roomId`
- [x] Guests join via shared `roomId` (link equivalent)
- [x] Server rejects join for missing/deleted room (`not-found`)
- [x] Server rejects join for non-`waiting` room state
- [x] Server rejects join for full room
- [x] Rejoin path is idempotent (`room.join.rejoin`)

## Evidence

- `MPC07_CONTRACT_REPORT.md` (contract scenario pass: 6/6)
- `frontend/scripts/mpc07-contract-check.mjs` (emulator scenario script)
- `functions/src/index.ts` (`joinRoom` checks for room existence/status/full/rejoin)

## Conclusion

`MPC-01` is satisfied and can be marked `DONE`.
