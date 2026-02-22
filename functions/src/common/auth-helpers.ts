import { createHash, randomUUID } from 'crypto'
import { HttpsError } from 'firebase-functions/v2/https'

// 게스트 세션 토큰 / room 참가 토큰 발급 + 검증 helper
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

function createJoinToken(): string {
  // 길이를 충분히 늘려서 예측/충돌 가능성을 낮춘다.
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}

function hashToken(token: string): string {
  // 원문 토큰을 그대로 저장하지 않기 위해 해시만 저장한다.
  return createHash('sha256').update(token).digest('hex')
}

export function createAuthHelpers(deps: AuthHelperDeps) {
  function createGuestId(): string {
    // UI/로그에서 guest 구분이 쉬우도록 prefix를 붙인다.
    return `guest_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  }

  function createSessionToken(): string {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  }

  async function issueRoomJoinToken(
    roomId: string,
    playerId: string,
  ): Promise<{ joinToken: string; expiresAtMillis: number }> {
    // 기존 토큰이 있어도 새 토큰을 발급하고 version을 올린다.
    const joinToken = createJoinToken()
    const now = deps.timestamp.now()
    const expiresAt = deps.timestamp.fromMillis(
      now.toMillis() + deps.joinTokenTtlHours * 60 * 60 * 1000,
    )
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
    // room 참가 API는 guest session + joinToken 둘 다 맞아야 통과한다.
    const authRef = deps.db.collection('rooms').doc(roomId).collection('participantAuth').doc(playerId)
    const authDoc = await authRef.get()

    if (!authDoc.exists) {
      deps.logWarn('auth.joinToken.notFound', { roomId, playerId })
      throw new HttpsError('permission-denied', 'Room join token not found')
    }

    const authData = authDoc.data() as {
      tokenHash: string
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
    if (authData.expiresAt && authData.expiresAt.toMillis() <= now.toMillis()) {
      deps.logWarn('auth.joinToken.expired', { roomId, playerId })
      throw new HttpsError('permission-denied', 'Room join token expired')
    }

    // 마지막 사용 시각은 갱신해두면 나중에 정리/디버깅할 때 도움이 된다.
    await authRef.update({ lastSeenAt: now })
  }

  async function verifyGuestSession(playerId: string, sessionToken: string): Promise<void> {
    // guest session은 브라우저 단위 인증 느낌으로 사용한다.
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
    if (session.expiresAt && session.expiresAt.toMillis() <= now.toMillis()) {
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
