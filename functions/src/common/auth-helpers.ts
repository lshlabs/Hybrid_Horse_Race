import { createHash, randomUUID } from 'crypto'
import { HttpsError } from 'firebase-functions/v2/https'

type TimestampApi = {
  now: () => FirebaseFirestore.Timestamp
  fromMillis: (millis: number) => FirebaseFirestore.Timestamp
}

type LogWarnFn = (event: string, payload: Record<string, unknown>) => void

type AuthHelperDeps = {
  db: FirebaseFirestore.Firestore
  timestamp: TimestampApi
  joinTokenTtlHours: number
  logWarn: LogWarnFn
}

const MS_PER_HOUR = 60 * 60 * 1000

function createOpaqueToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function isExpired(expireAt: FirebaseFirestore.Timestamp | undefined, nowMillis: number): boolean {
  return expireAt != null && expireAt.toMillis() <= nowMillis
}

export function createAuthHelpers(deps: AuthHelperDeps) {
  function createGuestId(): string {
    return `guest_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  }

  function createSessionToken(): string {
    return createOpaqueToken()
  }

  async function issueRoomJoinToken(
    roomId: string,
    playerId: string,
  ): Promise<{ joinToken: string; expiresAtMillis: number }> {
    const joinToken = createOpaqueToken()
    const now = deps.timestamp.now()
    const expiresAt = deps.timestamp.fromMillis(now.toMillis() + deps.joinTokenTtlHours * MS_PER_HOUR)
    const authRef = deps.db.collection('rooms').doc(roomId).collection('participantAuth').doc(playerId)
    const current = await authRef.get()
    const currentVersion = (current.data()?.tokenVersion as number | undefined) ?? 0

    await authRef.set({
      tokenHash: hashToken(joinToken),
      tokenVersion: currentVersion + 1,
      issuedAt: now,
      expiresAt,
      lastSeenAt: now,
      status: 'active',
    })

    return {
      joinToken,
      expiresAtMillis: expiresAt.toMillis(),
    }
  }

  async function verifyRoomJoinToken(
    roomId: string,
    playerId: string,
    joinToken: string,
  ): Promise<void> {
    const authRef = deps.db.collection('rooms').doc(roomId).collection('participantAuth').doc(playerId)
    const authDoc = await authRef.get()

    if (!authDoc.exists) {
      deps.logWarn('auth.joinToken.notFound', { roomId, playerId })
      throw new HttpsError('permission-denied', 'Room join token not found')
    }

    const authData = authDoc.data() as {
      tokenHash?: string
      expiresAt?: FirebaseFirestore.Timestamp
      status?: 'active' | 'revoked'
    }

    if (authData.status !== 'active') {
      deps.logWarn('auth.joinToken.revoked', { roomId, playerId, status: authData.status })
      throw new HttpsError('permission-denied', 'Room join token revoked')
    }

    if (authData.tokenHash !== hashToken(joinToken)) {
      deps.logWarn('auth.joinToken.invalid', { roomId, playerId })
      throw new HttpsError('permission-denied', 'Invalid room join token')
    }

    const now = deps.timestamp.now()
    const nowMillis = now.toMillis()
    if (isExpired(authData.expiresAt, nowMillis)) {
      deps.logWarn('auth.joinToken.expired', { roomId, playerId })
      throw new HttpsError('permission-denied', 'Room join token expired')
    }

    await authRef.update({ lastSeenAt: now })
  }

  async function verifyGuestSession(playerId: string, sessionToken: string): Promise<void> {
    const sessionRef = deps.db.collection('guestSessions').doc(playerId)
    const sessionDoc = await sessionRef.get()

    if (!sessionDoc.exists) {
      deps.logWarn('auth.guestSession.notFound', { playerId })
      throw new HttpsError('unauthenticated', 'Guest session not found')
    }

    const session = sessionDoc.data() as {
      sessionToken: string
      expiresAt?: FirebaseFirestore.Timestamp
    }

    if (session.sessionToken !== sessionToken) {
      deps.logWarn('auth.guestSession.invalid', { playerId })
      throw new HttpsError('permission-denied', 'Invalid guest session token')
    }

    const now = deps.timestamp.now()
    if (isExpired(session.expiresAt, now.toMillis())) {
      deps.logWarn('auth.guestSession.expired', { playerId })
      throw new HttpsError('unauthenticated', 'Guest session expired')
    }

    await sessionRef.update({ lastSeenAt: now })
  }

  return {
    createGuestId,
    createSessionToken,
    issueRoomJoinToken,
    verifyRoomJoinToken,
    verifyGuestSession,
  }
}
