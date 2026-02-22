import { initializeApp } from 'firebase/app'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore'

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_CONFIG?.match(/\"projectId\":\"([^\"]+)\"/)?.[1] ||
  'demo-hybrid-horse-race'
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  appId: '1:123456789:web:abcdef',
  messagingSenderId: '123456789',
}

function horseStats(base) {
  return {
    Speed: base,
    Stamina: base,
    Power: base,
    Guts: base,
    Start: base,
    Luck: base,
  }
}

async function flushFirestore() {
  const url = `http://127.0.0.1:8081/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`Failed to flush firestore emulator: ${res.status} ${await res.text()}`)
  }
}

function hasCode(error, code) {
  const maybeCode = error && typeof error === 'object' ? error.code : undefined
  if (typeof maybeCode === 'string' && maybeCode.includes(code)) {
    return true
  }
  return String(error).includes(code)
}

async function getRoomSnapshot(firestore, roomId) {
  const snapshot = await getDoc(doc(firestore, 'rooms', roomId))
  if (!snapshot.exists()) return null
  return snapshot.data()
}

function pickFirstAugmentId(result) {
  const list = result?.data?.availableAugments ?? []
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No augment choices returned')
  }
  return list[0].id
}

async function main() {
  await flushFirestore()

  const app = initializeApp(firebaseConfig)
  const functions = getFunctions(app, 'asia-northeast3')
  const firestore = getFirestore(app)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectFirestoreEmulator(firestore, '127.0.0.1', 8081)

  const createGuestSession = httpsCallable(functions, 'createGuestSession')
  const createRoom = httpsCallable(functions, 'createRoom')
  const joinRoom = httpsCallable(functions, 'joinRoom')
  const setPlayerReady = httpsCallable(functions, 'setPlayerReady')
  const startGame = httpsCallable(functions, 'startGame')
  const selectHorse = httpsCallable(functions, 'selectHorse')
  const leaveRoom = httpsCallable(functions, 'leaveRoom')
  const updateRoomSettings = httpsCallable(functions, 'updateRoomSettings')
  const updatePlayerName = httpsCallable(functions, 'updatePlayerName')
  const getAugmentSelection = httpsCallable(functions, 'getAugmentSelection')
  const selectAugment = httpsCallable(functions, 'selectAugment')
  const prepareRace = httpsCallable(functions, 'prepareRace')
  const startRace = httpsCallable(functions, 'startRace')
  const readyNextSet = httpsCallable(functions, 'readyNextSet')
  const getSetResult = httpsCallable(functions, 'getSetResult')

  const results = []

  // Scenario A: lifecycle, host migration, empty-room delete
  const host = (await createGuestSession({})).data
  const guest1 = (await createGuestSession({})).data
  const guest2 = (await createGuestSession({})).data
  const guest3 = (await createGuestSession({})).data

  const roomA = (
    await createRoom({
      playerId: host.guestId,
      sessionToken: host.sessionToken,
      hostName: 'Host One',
      title: 'MPC07-Lifecycle',
      maxPlayers: 3,
      roundCount: 3,
      rerollLimit: 2,
    })
  ).data

  const join1 = (
    await joinRoom({
      roomId: roomA.roomId,
      playerId: guest1.guestId,
      sessionToken: guest1.sessionToken,
      playerName: 'Guest1',
    })
  ).data

  const join2 = (
    await joinRoom({
      roomId: roomA.roomId,
      playerId: guest2.guestId,
      sessionToken: guest2.sessionToken,
      playerName: 'Guest2',
    })
  ).data

  results.push({
    contract: 1,
    passed: !!roomA.roomId,
    detail: 'Host can create a room',
  })

  results.push({
    contract: 2,
    passed: !!join1.joinToken && !!join2.joinToken,
    detail: 'Guests can join via room code/link path (roomId)',
  })

  let joinBlockedByMaxPlayers = false
  try {
    await joinRoom({
      roomId: roomA.roomId,
      playerId: guest3.guestId,
      sessionToken: guest3.sessionToken,
      playerName: 'Guest3',
    })
  } catch (error) {
    joinBlockedByMaxPlayers = hasCode(error, 'resource-exhausted')
  }

  results.push({
    contract: 'GAP-maxPlayers',
    passed: joinBlockedByMaxPlayers,
    detail: 'maxPlayers is enforced server-side',
  })

  await leaveRoom({
    roomId: roomA.roomId,
    playerId: host.guestId,
    sessionToken: host.sessionToken,
    joinToken: roomA.joinToken,
  })

  let guest1HostActionAllowed = false
  let guest2HostActionDenied = false

  try {
    await updateRoomSettings({
      roomId: roomA.roomId,
      playerId: guest1.guestId,
      sessionToken: guest1.sessionToken,
      joinToken: join1.joinToken,
      roundCount: 2,
    })
    guest1HostActionAllowed = true
  } catch {
    guest1HostActionAllowed = false
  }

  try {
    await updateRoomSettings({
      roomId: roomA.roomId,
      playerId: guest2.guestId,
      sessionToken: guest2.sessionToken,
      joinToken: join2.joinToken,
      roundCount: 2,
    })
  } catch (error) {
    guest2HostActionDenied = hasCode(error, 'permission-denied')
  }

  results.push({
    contract: 3,
    passed: guest1HostActionAllowed && guest2HostActionDenied,
    detail: 'Host left -> earliest joined guest became host',
  })

  await leaveRoom({
    roomId: roomA.roomId,
    playerId: guest1.guestId,
    sessionToken: guest1.sessionToken,
    joinToken: join1.joinToken,
  })

  let roomSurvivedWithOnePlayer = false
  try {
    await setPlayerReady({
      roomId: roomA.roomId,
      playerId: guest2.guestId,
      sessionToken: guest2.sessionToken,
      joinToken: join2.joinToken,
      isReady: true,
    })
    roomSurvivedWithOnePlayer = true
  } catch {
    roomSurvivedWithOnePlayer = false
  }

  await leaveRoom({
    roomId: roomA.roomId,
    playerId: guest2.guestId,
    sessionToken: guest2.sessionToken,
    joinToken: join2.joinToken,
  })

  let deletedWhenEmpty = false
  try {
    await joinRoom({
      roomId: roomA.roomId,
      playerId: guest1.guestId,
      sessionToken: guest1.sessionToken,
      playerName: 'Guest1',
    })
  } catch (error) {
    deletedWhenEmpty = hasCode(error, 'not-found')
  }

  results.push({
    contract: 4,
    passed: roomSurvivedWithOnePlayer && deletedWhenEmpty,
    detail: 'Room survives with players, deletes when empty',
  })

  results.push({
    contract: 5,
    passed: deletedWhenEmpty,
    detail: 'Deleted room access yields not-found (frontend uses this to redirect Landing)',
  })

  // Scenario B: synchronized shared pipeline
  const hostB = (await createGuestSession({})).data
  const guestB = (await createGuestSession({})).data

  const roomB = (
    await createRoom({
      playerId: hostB.guestId,
      sessionToken: hostB.sessionToken,
      hostName: 'Host Two',
      title: 'MPC07-Pipeline',
      maxPlayers: 4,
      roundCount: 3,
      rerollLimit: 2,
    })
  ).data

  const joinBFirst = (
    await joinRoom({
      roomId: roomB.roomId,
      playerId: guestB.guestId,
      sessionToken: guestB.sessionToken,
      playerName: 'GuestB',
    })
  ).data

  const joinBSecond = (
    await joinRoom({
      roomId: roomB.roomId,
      playerId: guestB.guestId,
      sessionToken: guestB.sessionToken,
      playerName: 'GuestB',
    })
  ).data

  let staleJoinTokenRejected = false
  try {
    await setPlayerReady({
      roomId: roomB.roomId,
      playerId: guestB.guestId,
      sessionToken: guestB.sessionToken,
      joinToken: joinBFirst.joinToken,
      isReady: true,
    })
  } catch (error) {
    staleJoinTokenRejected = hasCode(error, 'permission-denied')
  }

  await setPlayerReady({
    roomId: roomB.roomId,
    playerId: guestB.guestId,
    sessionToken: guestB.sessionToken,
    joinToken: joinBSecond.joinToken,
    isReady: true,
  })

  results.push({
    contract: 'GAP-rejoin-token',
    passed: staleJoinTokenRejected,
    detail: 'Rejoin rotates join token and invalidates stale token',
  })

  await updatePlayerName({
    roomId: roomB.roomId,
    playerId: guestB.guestId,
    sessionToken: guestB.sessionToken,
    joinToken: joinBSecond.joinToken,
    name: '테스트 01',
  })

  const playerDoc = await getDoc(doc(firestore, 'rooms', roomB.roomId, 'players', guestB.guestId))
  const storedName = playerDoc.exists() ? playerDoc.data().name : null

  results.push({
    contract: 'GAP-name-sync',
    passed: storedName === '테스트 01',
    detail: 'Player name update is persisted server-side',
  })

  await setPlayerReady({
    roomId: roomB.roomId,
    playerId: hostB.guestId,
    sessionToken: hostB.sessionToken,
    joinToken: roomB.joinToken,
    isReady: true,
  })
  await setPlayerReady({
    roomId: roomB.roomId,
    playerId: guestB.guestId,
    sessionToken: guestB.sessionToken,
    joinToken: joinBSecond.joinToken,
    isReady: true,
  })

  const startGameRes = (
    await startGame({
      roomId: roomB.roomId,
      playerId: hostB.guestId,
      sessionToken: hostB.sessionToken,
      joinToken: roomB.joinToken,
    })
  ).data

  const hostSelectRes = (
    await selectHorse({
      roomId: roomB.roomId,
      playerId: hostB.guestId,
      sessionToken: hostB.sessionToken,
      joinToken: roomB.joinToken,
      horseStats: horseStats(12),
    })
  ).data

  const guestSelectRes = (
    await selectHorse({
      roomId: roomB.roomId,
      playerId: guestB.guestId,
      sessionToken: guestB.sessionToken,
      joinToken: joinBSecond.joinToken,
      horseStats: horseStats(13),
    })
  ).data

  const pipelinePass =
    startGameRes.status === 'horseSelection' &&
    hostSelectRes.nextStatus === 'horseSelection' &&
    guestSelectRes.nextStatus === 'augmentSelection'

  results.push({
    contract: 6,
    passed: pipelinePass,
    detail: 'All players follow same callable/realtime phase progression',
  })

  // Scenario C: readyNextSet multi-client sync + round result completeness
  const hostC = (await createGuestSession({})).data
  const guestC1 = (await createGuestSession({})).data
  const guestC2 = (await createGuestSession({})).data

  const roomC = (
    await createRoom({
      playerId: hostC.guestId,
      sessionToken: hostC.sessionToken,
      hostName: 'Host Three',
      title: 'MPC07-ReadyNextSet',
      maxPlayers: 3,
      roundCount: 2,
      rerollLimit: 2,
    })
  ).data

  const joinC1 = (
    await joinRoom({
      roomId: roomC.roomId,
      playerId: guestC1.guestId,
      sessionToken: guestC1.sessionToken,
      playerName: 'GuestC1',
    })
  ).data
  const joinC2 = (
    await joinRoom({
      roomId: roomC.roomId,
      playerId: guestC2.guestId,
      sessionToken: guestC2.sessionToken,
      playerName: 'GuestC2',
    })
  ).data

  await setPlayerReady({
    roomId: roomC.roomId,
    playerId: guestC1.guestId,
    sessionToken: guestC1.sessionToken,
    joinToken: joinC1.joinToken,
    isReady: true,
  })
  await setPlayerReady({
    roomId: roomC.roomId,
    playerId: guestC2.guestId,
    sessionToken: guestC2.sessionToken,
    joinToken: joinC2.joinToken,
    isReady: true,
  })
  await startGame({
    roomId: roomC.roomId,
    playerId: hostC.guestId,
    sessionToken: hostC.sessionToken,
    joinToken: roomC.joinToken,
  })

  const playersC = [
    { ...hostC, joinToken: roomC.joinToken, horseBase: 12 },
    { ...guestC1, joinToken: joinC1.joinToken, horseBase: 13 },
    { ...guestC2, joinToken: joinC2.joinToken, horseBase: 14 },
  ]

  const runRound = async (setIndex) => {
    if (setIndex === 1) {
      for (const participant of playersC) {
        await selectHorse({
          roomId: roomC.roomId,
          playerId: participant.guestId,
          sessionToken: participant.sessionToken,
          joinToken: participant.joinToken,
          horseStats: horseStats(participant.horseBase + setIndex),
        })
      }
    }

    const choices = new Map()
    for (const participant of playersC) {
      const res = await getAugmentSelection({
        roomId: roomC.roomId,
        playerId: participant.guestId,
        sessionToken: participant.sessionToken,
        joinToken: participant.joinToken,
        setIndex,
      })
      choices.set(participant.guestId, pickFirstAugmentId(res))
    }

    for (const participant of playersC) {
      await selectAugment({
        roomId: roomC.roomId,
        playerId: participant.guestId,
        sessionToken: participant.sessionToken,
        joinToken: participant.joinToken,
        setIndex,
        augmentId: choices.get(participant.guestId),
      })
    }

    await prepareRace({
      roomId: roomC.roomId,
      playerId: hostC.guestId,
      sessionToken: hostC.sessionToken,
      joinToken: roomC.joinToken,
      setIndex,
    })

    await startRace({
      roomId: roomC.roomId,
      playerId: hostC.guestId,
      sessionToken: hostC.sessionToken,
      joinToken: roomC.joinToken,
      setIndex,
    })
  }

  await runRound(1)

  // 마지막 플레이어 ready 전까지는 setResult 유지되어야 함
  await readyNextSet({
    roomId: roomC.roomId,
    playerId: hostC.guestId,
    sessionToken: hostC.sessionToken,
    joinToken: roomC.joinToken,
    setIndex: 1,
  })
  await readyNextSet({
    roomId: roomC.roomId,
    playerId: guestC1.guestId,
    sessionToken: guestC1.sessionToken,
    joinToken: joinC1.joinToken,
    setIndex: 1,
  })
  const roomAfterTwoReady = await getRoomSnapshot(firestore, roomC.roomId)
  const stillWaitingLastReady =
    roomAfterTwoReady?.status === 'setResult' && roomAfterTwoReady?.currentSet === 1

  const finalReady = (
    await readyNextSet({
      roomId: roomC.roomId,
      playerId: guestC2.guestId,
      sessionToken: guestC2.sessionToken,
      joinToken: joinC2.joinToken,
      setIndex: 1,
    })
  ).data
  const roomAfterAllReady = await getRoomSnapshot(firestore, roomC.roomId)
  const advancedWhenAllReady =
    finalReady.allReady === true &&
    roomAfterAllReady?.status === 'augmentSelection' &&
    roomAfterAllReady?.currentSet === 2

  results.push({
    contract: 'REG-ready-next-set-sync',
    passed: stillWaitingLastReady && advancedWhenAllReady,
    detail: 'readyNextSet advances only after all players are ready, and advances everyone together',
  })

  await runRound(2)

  // 마지막 라운드는 finished 로 종료
  await readyNextSet({
    roomId: roomC.roomId,
    playerId: hostC.guestId,
    sessionToken: hostC.sessionToken,
    joinToken: roomC.joinToken,
    setIndex: 2,
  })
  await readyNextSet({
    roomId: roomC.roomId,
    playerId: guestC1.guestId,
    sessionToken: guestC1.sessionToken,
    joinToken: joinC1.joinToken,
    setIndex: 2,
  })
  await readyNextSet({
    roomId: roomC.roomId,
    playerId: guestC2.guestId,
    sessionToken: guestC2.sessionToken,
    joinToken: joinC2.joinToken,
    setIndex: 2,
  })

  const set1 = (
    await getSetResult({
      roomId: roomC.roomId,
      playerId: hostC.guestId,
      sessionToken: hostC.sessionToken,
      joinToken: roomC.joinToken,
      setIndex: 1,
    })
  ).data
  const set2 = (
    await getSetResult({
      roomId: roomC.roomId,
      playerId: hostC.guestId,
      sessionToken: hostC.sessionToken,
      joinToken: roomC.joinToken,
      setIndex: 2,
    })
  ).data

  const expectedPlayers = playersC.length
  const hasAllRoundResults =
    set1.hasResult === true &&
    set2.hasResult === true &&
    Array.isArray(set1.rankings) &&
    Array.isArray(set2.rankings) &&
    set1.rankings.length === expectedPlayers &&
    set2.rankings.length === expectedPlayers

  results.push({
    contract: 'REG-round-result-completeness',
    passed: hasAllRoundResults,
    detail: 'All round results are persisted and retrievable without missing rankings',
  })

  const passCount = results.filter((r) => r.passed).length
  const totalCount = results.length

  console.log('\nMPC-07 Contract Results')
  console.log('=======================')
  for (const row of results) {
    console.log(`${row.passed ? 'PASS' : 'FAIL'} | Contract-${row.contract} | ${row.detail}`)
  }
  console.log(`Summary: ${passCount}/${totalCount} passed`)

  if (passCount !== totalCount) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
