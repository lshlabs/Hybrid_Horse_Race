# Hybrid_Horse_Race 핵심기능 코드 + 포트폴리오 문장

아래 6개는 실제 코드 기준으로 선별한 핵심 기능입니다.  
각 항목은 `문제/해결`, `핵심 코드`, `이력서/포트폴리오 문장`으로 정리했습니다.

## 1) Cloud Functions 입력 검증 + 표준 에러 응답

**코드 위치**  
- `functions/src/index.ts:23`  
- `functions/src/index.ts:37`

**문제/해결**  
- 문제: 멀티플레이 룸 생성/참가 API에서 잘못된 요청이 들어오면 서버 상태가 깨질 수 있음.  
- 해결: `zod` 스키마로 요청을 검증하고, 실패 시 `HttpsError`로 클라이언트가 처리 가능한 에러 코드를 반환.

**핵심 코드**
```ts
const createRoomSchema = z.object({
  playerId: z.string().min(1),
  title: z.string().min(1).max(48),
  roundCount: z.number().int().min(1).max(9),
  rerollLimit: z.number().int().min(0).max(5),
})

const parseResult = createRoomSchema.safeParse(request.data)
if (!parseResult.success) {
  throw new HttpsError('invalid-argument', 'Invalid arguments', {
    errors: parseResult.error.flatten().fieldErrors,
  })
}
```

**이력서/포트폴리오 문장**  
- Firebase Callable API에 스키마 검증(`zod`)을 적용해 잘못된 입력을 서버 진입 단계에서 차단했습니다.  
- 에러를 `HttpsError` 규격으로 통일해 프론트에서 일관된 예외 처리가 가능하도록 구성했습니다.

## 2) 게임 시작 조건 검증 + 상태 전이 제어

**코드 위치**  
- `functions/src/index.ts:376`  
- `functions/src/index.ts:400`  
- `functions/src/index.ts:430`

**문제/해결**  
- 문제: 아무나 게임을 시작하거나 준비되지 않은 상태에서 시작하면 룸 상태가 꼬일 수 있음.  
- 해결: 호스트 권한, 최소 인원, 전체 준비 상태를 모두 검증한 뒤에만 `waiting -> horseSelection`으로 전이.

**핵심 코드**
```ts
if (!(await isHost(roomId, playerId))) {
  throw new HttpsError('permission-denied', 'Only host can start the game')
}

if (playerCount < 2) {
  throw new HttpsError('failed-precondition', 'At least 2 players are required')
}

if (!(await areAllPlayersReady(roomId))) {
  throw new HttpsError('failed-precondition', 'All players must be ready')
}

await updateRoomStatus(roomId, 'horseSelection')
```

**이력서/포트폴리오 문장**  
- 게임 시작 API에 권한/인원/준비 상태 검증을 추가해 비정상 시작 케이스를 방지했습니다.  
- 서버에서 상태 전이를 통제해 멀티플레이 진행 플로우의 안정성을 높였습니다.

## 3) 룸 이탈 시 호스트 위임 + 빈 룸 자동 정리

**코드 위치**  
- `functions/src/index.ts:208`  
- `functions/src/index.ts:252`  
- `functions/src/index.ts:277`

**문제/해결**  
- 문제: 호스트가 나가면 룸이 고아 상태가 되거나, 빈 룸이 남아 데이터가 누적될 수 있음.  
- 해결: 호스트 이탈 시 새 호스트를 위임하고, 남은 플레이어가 0명이면 룸 문서를 삭제.

**핵심 코드**
```ts
await playerRef.delete()
const remainingPlayers = await db.collection('rooms').doc(roomId).collection('players').get()

if (player.isHost) {
  if (remainingPlayers.size === 0) {
    await db.collection('rooms').doc(roomId).delete()
  } else {
    const newHostId = remainingPlayers.docs[0].id
    await db.collection('rooms').doc(roomId).collection('players').doc(newHostId).update({ isHost: true })
  }
}

if (!player.isHost && remainingPlayers.size === 0) {
  await db.collection('rooms').doc(roomId).delete()
}
```

**이력서/포트폴리오 문장**  
- 플레이어 이탈 로직에 호스트 위임 규칙을 구현해 게임 세션 중단 가능성을 줄였습니다.  
- 마지막 플레이어 이탈 시 룸 자동 삭제를 적용해 불필요한 룸 데이터 잔존을 방지했습니다.

## 4) 말 선택 완료 감지 + 다음 단계 자동 전환

**코드 위치**  
- `functions/src/index.ts:462`  
- `functions/src/index.ts:512`  
- `functions/src/index.ts:526`

**문제/해결**  
- 문제: 말 선택 단계에서 중복 선택/미완료 상태를 정확히 관리하지 않으면 진행이 멈출 수 있음.  
- 해결: 이미 선택한 플레이어를 차단하고, 전체 플레이어 선택 완료 시 자동으로 `augmentSelection` 단계로 전환.

**핵심 코드**
```ts
if (player.horseStats) {
  throw new HttpsError('failed-precondition', 'Horse has already been selected')
}

await playerRef.update({ horseStats, updatedAt: Timestamp.now() })

const allSelected = playersSnapshot.docs.every((doc) => {
  const p = doc.data() as Player
  return p.horseStats !== undefined
})

if (allSelected) {
  await updateRoomStatus(roomId, 'augmentSelection')
}
```

**이력서/포트폴리오 문장**  
- 플레이어별 말 선택을 1회로 제한해 중복 제출 케이스를 방지했습니다.  
- 모든 플레이어 선택 완료를 서버에서 판정해 다음 페이즈 전환을 자동화했습니다.

## 5) 레이스 시뮬레이션 엔진(고정 스텝 + 완주/미완주 정렬)

**코드 위치**  
- `frontend/src/engine/race/simulator.ts:41`  
- `frontend/src/engine/race/simulator.ts:66`  
- `frontend/src/engine/race/simulator.ts:92`

**문제/해결**  
- 문제: 레이스 계산을 프레임 의존으로 처리하면 결과 재현성이 떨어질 수 있음.  
- 해결: 고정 시뮬레이션 스텝(`SIM_STEP_SEC`)으로 업데이트하고, 완주 시간/진행 거리 기준 정렬 규칙을 분리.

**핵심 코드**
```ts
while (time < MAX_SIM_TIME_SEC) {
  let allFinished = true
  for (const h of horses) {
    if (!h.finished) h.step(SIM_STEP_SEC, time)
    if (!h.finished) allFinished = false
  }
  if (allFinished) break
  time += SIM_STEP_SEC
}

const results = horses
  .map((h) => ({ finishTime: h.finishTime ?? Infinity, position: h.position }))
  .sort((a, b) => {
    if (a.finishTime !== Infinity && b.finishTime !== Infinity) return a.finishTime - b.finishTime
    if (a.finishTime !== Infinity) return -1
    if (b.finishTime !== Infinity) return 1
    return b.position - a.position
  })
```

**이력서/포트폴리오 문장**  
- 레이스 로직을 고정 스텝 기반으로 구현해 실행 환경에 덜 흔들리는 시뮬레이션 구조를 만들었습니다.  
- 완주/미완주 정렬 규칙을 분리해 경기 종료 시 순위 산출 일관성을 확보했습니다.

## 6) React-Phaser 브리지(씬 데이터 동기화 + 반응형 캔버스)

**코드 위치**  
- `frontend/src/components/game/PhaserGame.tsx:62`  
- `frontend/src/components/game/PhaserGame.tsx:124`  
- `frontend/src/components/game/PhaserGame.tsx:154`

**문제/해결**  
- 문제: React 상태(room/player/선택 말)와 Phaser Scene 상태가 분리되어 동기화 누락이 발생할 수 있음.  
- 해결: Scene `data.set` + `events.emit` 이중 경로로 동기화하고, 리사이즈 시 비율 유지 스케일링과 세로 모드 안내를 제공.

**핵심 코드**
```tsx
const raceScene = gameRef.current.scene.getScene('RaceScene') as RaceScene | null
if (raceScene) {
  raceScene.data.set('roomId', roomId)
  raceScene.data.set('players', players)
  raceScene.events.emit('room-data-updated', { roomId, playerId, room, players, selectedHorse })
}

const scaleX = availableWidth / aspectRatioWidth
const scaleY = availableHeight / aspectRatioHeight
setScale(Math.min(scaleX, scaleY, 1))
```

**이력서/포트폴리오 문장**  
- React와 Phaser 간 데이터 전달을 Scene 데이터 저장소와 이벤트 채널로 분리해 런타임 동기화 안정성을 높였습니다.  
- 고정 해상도 캔버스를 비율 유지 방식으로 스케일링해 다양한 화면 크기에서 UI 깨짐을 줄였습니다.

