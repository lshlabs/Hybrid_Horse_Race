import { initializeApp } from 'firebase/app'
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  collection,
  getFirestore,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

const PROJECT_ID = 'demo-hybrid-horse-race'
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

async function main() {
  await flushFirestore()

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8081)

  const functions = getFunctions(app, 'asia-northeast3')
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)

  const createGuestSession = httpsCallable(functions, 'createGuestSession')
  const createRoom = httpsCallable(functions, 'createRoom')
  const joinRoom = httpsCallable(functions, 'joinRoom')
  const setPlayerReady = httpsCallable(functions, 'setPlayerReady')
  const startGame = httpsCallable(functions, 'startGame')
  const selectHorse = httpsCallable(functions, 'selectHorse')
  const leaveRoom = httpsCallable(functions, 'leaveRoom')

  const results = []

  const hostSession = (await createGuestSession({})).data
  const guest1Session = (await createGuestSession({})).data
  const guest2Session = (await createGuestSession({})).data

  const created = (
    await createRoom({
      playerId: hostSession.guestId,
      sessionToken: hostSession.sessionToken,
      title: 'MPC07 Room',
      roundCount: 3,
      rerollLimit: 2,
    })
  ).data

  const roomId = created.roomId
  const hostJoinToken = created.joinToken

  results.push({
    contract: 1,
    passed: !!roomId,
    detail: 'Host created room successfully',
  })

  const guest1Join = (
    await joinRoom({
      roomId,
      playerId: guest1Session.guestId,
      sessionToken: guest1Session.sessionToken,
      playerName: 'Guest1',
    })
  ).data

  const guest2Join = (
    await joinRoom({
      roomId,
      playerId: guest2Session.guestId,
      sessionToken: guest2Session.sessionToken,
      playerName: 'Guest2',
    })
  ).data

  results.push({
    contract: 2,
    passed: !!guest1Join.joinToken && !!guest2Join.joinToken,
    detail: 'Guests joined via roomId (share-link equivalent) and received join tokens',
  })

  await setPlayerReady({
    roomId,
    playerId: hostSession.guestId,
    sessionToken: hostSession.sessionToken,
    joinToken: hostJoinToken,
    isReady: true,
  })
  await setPlayerReady({
    roomId,
    playerId: guest1Session.guestId,
    sessionToken: guest1Session.sessionToken,
    joinToken: guest1Join.joinToken,
    isReady: true,
  })
  await setPlayerReady({
    roomId,
    playerId: guest2Session.guestId,
    sessionToken: guest2Session.sessionToken,
    joinToken: guest2Join.joinToken,
    isReady: true,
  })

  await startGame({
    roomId,
    playerId: hostSession.guestId,
    sessionToken: hostSession.sessionToken,
    joinToken: hostJoinToken,
  })

  await selectHorse({
    roomId,
    playerId: hostSession.guestId,
    sessionToken: hostSession.sessionToken,
    joinToken: hostJoinToken,
    horseStats: horseStats(12),
  })
  await selectHorse({
    roomId,
    playerId: guest1Session.guestId,
    sessionToken: guest1Session.sessionToken,
    joinToken: guest1Join.joinToken,
    horseStats: horseStats(13),
  })
  await selectHorse({
    roomId,
    playerId: guest2Session.guestId,
    sessionToken: guest2Session.sessionToken,
    joinToken: guest2Join.joinToken,
    horseStats: horseStats(14),
  })

  const roomDocAfterSelection = await getDoc(doc(db, 'rooms', roomId))
  const statusAfterSelection = roomDocAfterSelection.data()?.status

  results.push({
    contract: 6,
    passed: statusAfterSelection === 'augmentSelection',
    detail: `Shared pipeline progressed to ${statusAfterSelection}`,
  })

  await leaveRoom({
    roomId,
    playerId: hostSession.guestId,
    sessionToken: hostSession.sessionToken,
    joinToken: hostJoinToken,
  })

  const migratedHostDoc = await getDoc(doc(db, 'rooms', roomId, 'players', guest1Session.guestId))
  const migratedHost = migratedHostDoc.data()?.isHost === true

  results.push({
    contract: 3,
    passed: migratedHost,
    detail: 'When host left with guests remaining, earliest joined guest became host',
  })

  await leaveRoom({
    roomId,
    playerId: guest1Session.guestId,
    sessionToken: guest1Session.sessionToken,
    joinToken: guest1Join.joinToken,
  })

  const roomStillExists = (await getDoc(doc(db, 'rooms', roomId))).exists()

  await leaveRoom({
    roomId,
    playerId: guest2Session.guestId,
    sessionToken: guest2Session.sessionToken,
    joinToken: guest2Join.joinToken,
  })

  const roomDeleted = !(await getDoc(doc(db, 'rooms', roomId))).exists()

  results.push({
    contract: 4,
    passed: roomStillExists && roomDeleted,
    detail: 'Room survived with remaining players and deleted only after final player left',
  })

  let notFoundOnDeletedRoom = false
  try {
    await joinRoom({
      roomId,
      playerId: guest1Session.guestId,
      sessionToken: guest1Session.sessionToken,
      playerName: 'Guest1',
    })
  } catch (error) {
    const message = String(error)
    notFoundOnDeletedRoom = message.includes('not-found') || message.includes('Room not found')
  }

  results.push({
    contract: 5,
    passed: notFoundOnDeletedRoom,
    detail: 'Backend returns not-found for deleted room access (frontend redirects on missing room)',
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

  const playerDocs = await getDocs(collection(db, 'rooms'))
  console.log(`Remaining rooms in emulator: ${playerDocs.size}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
