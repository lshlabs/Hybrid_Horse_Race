import { createGuestSession } from './firebase-functions'

const GUEST_SESSION_KEY = 'hybrid-horse-race-guest-session'

interface GuestSession {
  guestId: string
  sessionToken: string
  expiresAtMillis: number
}

let bootstrapPromise: Promise<GuestSession> | null = null

function readCachedSession(): GuestSession | null {
  const raw = localStorage.getItem(GUEST_SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<GuestSession>
    if (
      typeof parsed.guestId !== 'string' ||
      parsed.guestId.length === 0 ||
      typeof parsed.sessionToken !== 'string' ||
      parsed.sessionToken.length === 0 ||
      typeof parsed.expiresAtMillis !== 'number' ||
      !Number.isFinite(parsed.expiresAtMillis)
    ) {
      return null
    }
    return {
      guestId: parsed.guestId,
      sessionToken: parsed.sessionToken,
      expiresAtMillis: parsed.expiresAtMillis,
    }
  } catch {
    return null
  }
}

function isSessionValid(session: GuestSession): boolean {
  return session.expiresAtMillis > Date.now() + 60_000
}

function cacheSession(session: GuestSession): void {
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
}

function shouldRefreshSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { code?: string; message?: string }
  if (maybe.code === 'functions/unauthenticated' || maybe.code === 'functions/not-found') {
    return true
  }
  if (typeof maybe.message === 'string' && maybe.message.includes('Guest session')) {
    return true
  }
  return false
}

async function requestSession(existingGuestId?: string): Promise<GuestSession> {
  const response = await createGuestSession({ guestId: existingGuestId })
  const nextSession: GuestSession = {
    guestId: response.data.guestId,
    sessionToken: response.data.sessionToken,
    expiresAtMillis: response.data.expiresAtMillis,
  }
  cacheSession(nextSession)
  return nextSession
}

export async function ensureUserSession(): Promise<GuestSession> {
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    const cached = readCachedSession()
    if (cached && isSessionValid(cached)) {
      return cached
    }
    return requestSession(cached?.guestId)
  })()

  try {
    return await bootstrapPromise
  } finally {
    bootstrapPromise = null
  }
}

export async function getUserId(): Promise<string> {
  const session = await ensureUserSession()
  return session.guestId
}

export async function getSessionToken(): Promise<string> {
  const session = await ensureUserSession()
  return session.sessionToken
}

export async function getGuestSession(): Promise<GuestSession> {
  return ensureUserSession()
}

export async function clearUserId(): Promise<void> {
  localStorage.removeItem(GUEST_SESSION_KEY)
}

export async function withGuestSessionRetry<T>(
  operation: (session: GuestSession) => Promise<T>,
): Promise<T> {
  const currentSession = await ensureUserSession()
  try {
    return await operation(currentSession)
  } catch (error) {
    if (!shouldRefreshSession(error)) {
      throw error
    }
    await clearUserId()
    const freshSession = await ensureUserSession()
    return operation(freshSession)
  }
}
