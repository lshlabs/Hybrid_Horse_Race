import { createGuestSession } from './firebase-functions'
import { ensureAnonymousAuth } from './firebase'

const GUEST_SESSION_KEY = 'hybrid-horse-race-guest-session'

interface GuestSession {
  authUid: string
  guestId: string
  sessionToken: string
  expiresAtMillis: number
}

let bootstrapPromise: Promise<GuestSession> | null = null

function readStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore storage write failures (private mode/quota)
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore storage remove failures (private mode/quota)
  }
}

function parseGuestSession(raw: string): GuestSession | null {
  const parsed = JSON.parse(raw) as Partial<GuestSession>
  if (
    typeof parsed.authUid !== 'string' ||
    parsed.authUid.length === 0 ||
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
    authUid: parsed.authUid,
    guestId: parsed.guestId,
    sessionToken: parsed.sessionToken,
    expiresAtMillis: parsed.expiresAtMillis,
  }
}

function readCachedSession(): GuestSession | null {
  const raw = readStorageItem(GUEST_SESSION_KEY)
  if (!raw) return null

  try {
    return parseGuestSession(raw)
  } catch {
    return null
  }
}

function isSessionValid(session: GuestSession): boolean {
  return session.expiresAtMillis > Date.now() + 60_000
}

function cacheSession(session: GuestSession): void {
  writeStorageItem(GUEST_SESSION_KEY, JSON.stringify(session))
}

function shouldRefreshSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { code?: string; message?: string }
  if (maybe.code === 'functions/unauthenticated' || maybe.code === 'functions/not-found') {
    return true
  }
  return typeof maybe.message === 'string' && maybe.message.includes('Guest session')
}

async function requestSession(existingGuestId?: string): Promise<GuestSession> {
  const response = await createGuestSession({ guestId: existingGuestId })
  const nextSession: GuestSession = {
    authUid: response.data.authUid,
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
    const authUser = await ensureAnonymousAuth()
    const cached = readCachedSession()
    if (cached && cached.authUid === authUser.uid && isSessionValid(cached)) {
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
  removeStorageItem(GUEST_SESSION_KEY)
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
