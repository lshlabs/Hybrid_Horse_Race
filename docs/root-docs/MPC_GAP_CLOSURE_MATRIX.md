# MPC Gap Closure Matrix

## 기준일
- 2026-02-21

## 1) 룸 설정 단일 소스
| 항목 | 서버 저장 필드 | 클라이언트 표시 소스 | 강제 주체 |
|---|---|---|---|
| 최대 인원 | `rooms/{roomId}.maxPlayers` | `room.maxPlayers` 우선 | `joinRoom` + `isRoomFull` |
| 라운드 수 | `rooms/{roomId}.roundCount` | `room.roundCount` | `createRoom/updateRoomSettings` |
| 리롤 수 | `rooms/{roomId}.rerollLimit` | `room.rerollLimit` | `createRoom/updateRoomSettings` |

## 2) 참여자 식별/권한
| 요소 | 발급 주체 | 저장 위치 | 용도 |
|---|---|---|---|
| `playerId(guestId)` | `createGuestSession` | `guestSessions/{guestId}` + 클라이언트 세션 | 플레이어 식별 |
| `sessionToken` | `createGuestSession` | `guestSessions/{guestId}` + 클라이언트 세션 | 게스트 세션 검증 |
| `joinToken` | `createRoom/joinRoom` | `rooms/{roomId}/participantAuth/{playerId}`(hash) + 클라이언트 room-scope | 룸 참가 권한 검증 |
| `isHost` | 서버 | `rooms/{roomId}/players/{playerId}.isHost` | 호스트 권한 분기 |

## 3) 링크/토큰 수명 정책
- 링크(`.../lobby?roomId=...`)
  - 룸이 존재하고 상태가 `waiting`일 때 신규 join 허용.
  - 룸 삭제 시 `not-found` -> 프론트 랜딩 리다이렉트.
- `joinToken`
  - TTL: 6시간.
  - `joinRoom` 재호출(rejoin) 시 새 토큰 발급 + 이전 토큰 무효화.
  - 보호 액션에서 토큰 실패 시 1회 rejoin 후 재시도.

## 4) 로비 액션 권한 매트릭스
| 액션 | 게스트 | 호스트 | 서버 검증 |
|---|---|---|---|
| 닉네임 변경 | 가능(본인만) | 가능(본인만) | `verifyGuestSession` + `verifyRoomJoinToken` + 본인 doc update |
| 준비/취소 | 가능(본인만) | 가능(본인만) | waiting 상태 + 본인 플레이어 존재 |
| 게임 시작 | 불가 | 가능 | `isHost=true` + 모든 플레이어 ready |

## 5) 실시간 동기화 보장
- 데이터 소스: Firestore `rooms` 문서 + `players` 서브컬렉션 `onSnapshot`.
- 준비 상태/닉네임 변경은 서버 write 후 모든 참여자 화면에 반영.
- 플레이어 목록은 `joinedAt asc` 정렬로 일관 표시.

## 6) Mock 경로 운영 원칙
- 기본값: `VITE_ENABLE_MOCK_ROOM_FALLBACK=false`.
- 실연동 경로(`LandingPage`, `LobbyPage`)에서 callable 실패를 성공처럼 처리하지 않음.
- 실험용 mock 동작은 `frontend/src/pages/dev/*`로 한정.

## 7) 검증 체크리스트
1. `maxPlayers` 초과 참가 시 `resource-exhausted`.
2. 닉네임 변경 callable 성공 후 Firestore 플레이어 문서 name 변경.
3. rejoin 후 이전 `joinToken`으로 보호 액션 실패, 새 토큰으로 성공.
4. 호스트 이탈 시 earliest guest 호스트 승격.
5. 마지막 플레이어 이탈 시 룸 삭제.
6. 삭제된 룸 접근 시 랜딩 리다이렉트.
