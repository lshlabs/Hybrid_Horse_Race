import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpsError } from 'firebase-functions/v2/https'
import { createAuthHelpers } from '../src/common/auth-helpers'

type SessionData = {
  sessionTokenHash?: string
  sessionToken?: string
  expiresAt?: FirebaseFirestore.Timestamp
  lastSeenAt?: FirebaseFirestore.Timestamp
}

type ParticipantAuthData = {
  tokenHash?: string
  expiresAt?: FirebaseFirestore.Timestamp
  lastSeenAt?: FirebaseFirestore.Timestamp
  status?: 'active' | 'revoked'
}

function createTimestamp(millis: number): FirebaseFirestore.Timestamp {
  return { toMillis: () => millis } as FirebaseFirestore.Timestamp
}

function createAuthStore(params: {
  guestSessions: Record<string, SessionData>
  participantAuth: Record<string, ParticipantAuthData>
}) {
  const guestSessionStore = new Map<string, SessionData>(Object.entries(params.guestSessions))
  const participantAuthStore = new Map<string, ParticipantAuthData>(Object.entries(params.participantAuth))

  const guestSessionCollectionRef = {
    doc(id: string) {
      return {
        async get() {
          const current = guestSessionStore.get(id)
          return {
            exists: current !== undefined,
            data: () => current,
          }
        },
        async update(patch: Record<string, unknown>) {
          const current = guestSessionStore.get(id)
          if (!current) {
            throw new Error(`missing session: ${id}`)
          }
          guestSessionStore.set(id, { ...current, ...(patch as SessionData) })
        },
      }
    },
  }

  const participantAuthCollectionRef = (roomId: string) => ({
    doc(playerId: string) {
      const key = `${roomId}/${playerId}`
      return {
        async get() {
          const current = participantAuthStore.get(key)
          return {
            exists: current !== undefined,
            data: () => current,
          }
        },
        async update(patch: Record<string, unknown>) {
          const current = participantAuthStore.get(key)
          if (!current) {
            throw new Error(`missing participant auth: ${key}`)
          }
          participantAuthStore.set(key, { ...current, ...(patch as ParticipantAuthData) })
        },
      }
    },
  })

  const db = {
    collection(name: string) {
      if (name === 'guestSessions') {
        return guestSessionCollectionRef
      }
      if (name === 'rooms') {
        return {
          doc(roomId: string) {
            return {
              collection(subName: string) {
                if (subName !== 'participantAuth') {
                  throw new Error(`Unsupported room sub-collection in test: ${subName}`)
                }
                return participantAuthCollectionRef(roomId)
              },
            }
          },
        }
      }
      throw new Error(`Unsupported collection in test: ${name}`)
    },
  } as unknown as FirebaseFirestore.Firestore

  return {
    db,
    readGuestSession(id: string) {
      return guestSessionStore.get(id)
    },
    readParticipantAuth(roomId: string, playerId: string) {
      return participantAuthStore.get(`${roomId}/${playerId}`)
    },
  }
}

function createSut(params: {
  nowMillis: number
  initialSessions: Record<string, SessionData>
  initialParticipantAuth?: Record<string, ParticipantAuthData>
}) {
  const warnings: Array<{ event: string; payload: Record<string, unknown> }> = []
  const { db, readGuestSession, readParticipantAuth } = createAuthStore({
    guestSessions: params.initialSessions,
    participantAuth: params.initialParticipantAuth ?? {},
  })
  const timestampApi = {
    now: () => createTimestamp(params.nowMillis),
    fromMillis: (millis: number) => createTimestamp(millis),
  }
  const auth = createAuthHelpers({
    db,
    timestamp: timestampApi,
    joinTokenTtlHours: 6,
    logWarn: (event, payload) => warnings.push({ event, payload }),
  })

  return {
    ...auth,
    readSession: readGuestSession,
    readParticipantAuth,
    warnings,
  }
}

test('verifyGuestSession accepts hash-based token and updates lastSeenAt', async () => {
  const nowMillis = 1_700_000_000_000
  const sut = createSut({
    nowMillis,
    initialSessions: {
      playerA: {
        sessionTokenHash: createAuthHelpers({
          db: {} as FirebaseFirestore.Firestore,
          timestamp: { now: () => createTimestamp(nowMillis), fromMillis: createTimestamp },
          joinTokenTtlHours: 6,
          logWarn: () => {},
        }).hashSessionToken('valid-token'),
        expiresAt: createTimestamp(nowMillis + 60_000),
      },
    },
  })

  await sut.verifyGuestSession('playerA', 'valid-token')
  const saved = sut.readSession('playerA')
  assert.ok(saved?.lastSeenAt)
  assert.equal(saved?.sessionTokenHash?.length, 64)
  assert.equal(sut.warnings.length, 0)
})

test('verifyGuestSession migrates legacy plaintext token to hash field', async () => {
  const nowMillis = 1_700_000_000_000
  const sut = createSut({
    nowMillis,
    initialSessions: {
      playerB: {
        sessionToken: 'legacy-token',
        expiresAt: createTimestamp(nowMillis + 60_000),
      },
    },
  })

  await sut.verifyGuestSession('playerB', 'legacy-token')
  const saved = sut.readSession('playerB')
  assert.ok(saved?.sessionTokenHash)
  assert.equal(saved?.sessionTokenHash?.length, 64)
  assert.notEqual(saved?.sessionToken, 'legacy-token')
  assert.ok(saved?.lastSeenAt)
  assert.equal(sut.warnings.length, 0)
})

test('verifyGuestSession rejects invalid token with permission-denied', async () => {
  const nowMillis = 1_700_000_000_000
  const tokenHash = createAuthHelpers({
    db: {} as FirebaseFirestore.Firestore,
    timestamp: { now: () => createTimestamp(nowMillis), fromMillis: createTimestamp },
    joinTokenTtlHours: 6,
    logWarn: () => {},
  }).hashSessionToken('expected-token')
  const sut = createSut({
    nowMillis,
    initialSessions: {
      playerC: {
        sessionTokenHash: tokenHash,
        expiresAt: createTimestamp(nowMillis + 60_000),
      },
    },
  })

  await assert.rejects(
    async () => sut.verifyGuestSession('playerC', 'wrong-token'),
    (error: unknown) => error instanceof HttpsError && error.code === 'permission-denied',
  )
})

test('verifyGuestSession rejects expired token with unauthenticated', async () => {
  const nowMillis = 1_700_000_000_000
  const tokenHash = createAuthHelpers({
    db: {} as FirebaseFirestore.Firestore,
    timestamp: { now: () => createTimestamp(nowMillis), fromMillis: createTimestamp },
    joinTokenTtlHours: 6,
    logWarn: () => {},
  }).hashSessionToken('expired-token')
  const sut = createSut({
    nowMillis,
    initialSessions: {
      playerD: {
        sessionTokenHash: tokenHash,
        expiresAt: createTimestamp(nowMillis - 1),
      },
    },
  })

  await assert.rejects(
    async () => sut.verifyGuestSession('playerD', 'expired-token'),
    (error: unknown) => error instanceof HttpsError && error.code === 'unauthenticated',
  )
})

test('verifyRoomJoinToken accepts valid token and updates lastSeenAt', async () => {
  const nowMillis = 1_700_000_000_000
  const roomId = 'room-a'
  const playerId = 'player-a'
  const joinToken = 'join-valid-token'
  const tokenHash = createAuthHelpers({
    db: {} as FirebaseFirestore.Firestore,
    timestamp: { now: () => createTimestamp(nowMillis), fromMillis: createTimestamp },
    joinTokenTtlHours: 6,
    logWarn: () => {},
  }).hashSessionToken(joinToken)
  const sut = createSut({
    nowMillis,
    initialSessions: {},
    initialParticipantAuth: {
      [`${roomId}/${playerId}`]: {
        tokenHash,
        status: 'active',
        expiresAt: createTimestamp(nowMillis + 60_000),
      },
    },
  })

  await sut.verifyRoomJoinToken(roomId, playerId, joinToken)

  const saved = sut.readParticipantAuth(roomId, playerId)
  assert.ok(saved?.lastSeenAt)
  assert.equal(sut.warnings.length, 0)
})

test('verifyRoomJoinToken rejects invalid token with permission-denied', async () => {
  const nowMillis = 1_700_000_000_000
  const roomId = 'room-b'
  const playerId = 'player-b'
  const tokenHash = createAuthHelpers({
    db: {} as FirebaseFirestore.Firestore,
    timestamp: { now: () => createTimestamp(nowMillis), fromMillis: createTimestamp },
    joinTokenTtlHours: 6,
    logWarn: () => {},
  }).hashSessionToken('expected-join-token')
  const sut = createSut({
    nowMillis,
    initialSessions: {},
    initialParticipantAuth: {
      [`${roomId}/${playerId}`]: {
        tokenHash,
        status: 'active',
        expiresAt: createTimestamp(nowMillis + 60_000),
      },
    },
  })

  await assert.rejects(
    async () => sut.verifyRoomJoinToken(roomId, playerId, 'unexpected-join-token'),
    (error: unknown) => error instanceof HttpsError && error.code === 'permission-denied',
  )
  assert.equal(sut.warnings[0]?.event, 'auth.joinToken.invalid')
})
