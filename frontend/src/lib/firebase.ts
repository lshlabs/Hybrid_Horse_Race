import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

let appInstance: FirebaseApp | null = null
let firestoreInstance: Firestore | null = null
let authInstance: Auth | null = null
let isFirestoreEmulatorConnected = false
let isAuthEmulatorConnected = false
let anonymousAuthPromise: Promise<User> | null = null
const DEFAULT_FIRESTORE_EMULATOR_HOST = '127.0.0.1'
const DEFAULT_FIRESTORE_EMULATOR_PORT = 8081
const DEFAULT_AUTH_EMULATOR_PORT = 9099
const USE_FIREBASE_EMULATOR =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
const REQUIRED_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const

function resolveEmulatorHost(envHost?: string): string {
  if (envHost && envHost.trim().length > 0) return envHost.trim()
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname
  }
  return DEFAULT_FIRESTORE_EMULATOR_HOST
}

function isAlreadyConnectedFirestoreError(error: unknown): boolean {
  const err = error as { message?: string; code?: string }
  return err?.message?.includes('already connected') === true || err?.code === 'already-initialized'
}

function resolveFirestoreEmulatorPort(rawPort?: string): number {
  const parsedPort = Number(rawPort || DEFAULT_FIRESTORE_EMULATOR_PORT)
  return Number.isFinite(parsedPort) ? parsedPort : DEFAULT_FIRESTORE_EMULATOR_PORT
}

function resolveAuthEmulatorPort(rawPort?: string): number {
  const parsedPort = Number(rawPort || DEFAULT_AUTH_EMULATOR_PORT)
  return Number.isFinite(parsedPort) ? parsedPort : DEFAULT_AUTH_EMULATOR_PORT
}

function getFirebaseConfig(): FirebaseConfig {
  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (USE_FIREBASE_EMULATOR ? 'demo-api-key' : ''),
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
      (USE_FIREBASE_EMULATOR ? 'demo-hybrid-horse-race.firebaseapp.com' : ''),
    projectId:
      import.meta.env.VITE_FIREBASE_PROJECT_ID ||
      (USE_FIREBASE_EMULATOR ? 'demo-hybrid-horse-race' : ''),
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      (USE_FIREBASE_EMULATOR ? 'demo-hybrid-horse-race.appspot.com' : ''),
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      (USE_FIREBASE_EMULATOR ? '123456789' : ''),
    appId:
      import.meta.env.VITE_FIREBASE_APP_ID ||
      (USE_FIREBASE_EMULATOR ? '1:123456789:web:abcdef' : ''),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  }

  REQUIRED_CONFIG_KEYS.forEach((key) => {
    if (!config[key]) {
      console.error(`Missing Firebase config value for ${key}`)
      if (!USE_FIREBASE_EMULATOR) {
        throw new Error(
          `Missing Firebase config value for ${key}. Please set VITE_FIREBASE_${key.toUpperCase().replace(/[A-Z]/g, (m) => '_' + m)} in .env file`,
        )
      }
    }
  })

  return config
}

export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = initializeApp(getFirebaseConfig())
  }
  return appInstance
}

export function getFirebaseDb(): Firestore {
  if (!firestoreInstance) {
    const app = getFirebaseApp()
    firestoreInstance = getFirestore(app)

    if (USE_FIREBASE_EMULATOR && !isFirestoreEmulatorConnected) {
      try {
        const emulatorHost = resolveEmulatorHost(
          import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ||
            import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST,
        )
        const emulatorPort = resolveFirestoreEmulatorPort(
          import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT,
        )
        connectFirestoreEmulator(firestoreInstance, emulatorHost, emulatorPort)
        isFirestoreEmulatorConnected = true
        console.info(`Connected to Firestore Emulator at ${emulatorHost}:${emulatorPort}`)
      } catch (error: unknown) {
        if (isAlreadyConnectedFirestoreError(error)) {
          isFirestoreEmulatorConnected = true
          console.info('Firestore Emulator already connected')
        } else {
          console.warn('Firestore Emulator connection error:', error)
        }
      }
    }
  }
  return firestoreInstance
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    const app = getFirebaseApp()
    authInstance = getAuth(app)

    if (USE_FIREBASE_EMULATOR && !isAuthEmulatorConnected) {
      try {
        const emulatorHost = resolveEmulatorHost(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST)
        const emulatorPort = resolveAuthEmulatorPort(
          import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT,
        )
        connectAuthEmulator(authInstance, `http://${emulatorHost}:${emulatorPort}`, {
          disableWarnings: true,
        })
        isAuthEmulatorConnected = true
        console.info(`Connected to Auth Emulator at ${emulatorHost}:${emulatorPort}`)
      } catch (error: unknown) {
        if (isAlreadyConnectedFirestoreError(error)) {
          isAuthEmulatorConnected = true
          console.info('Auth Emulator already connected')
        } else {
          console.warn('Auth Emulator connection error:', error)
        }
      }
    }
  }
  return authInstance
}

export async function ensureAnonymousAuth(): Promise<User> {
  const auth = getFirebaseAuth()
  if (auth.currentUser) {
    return auth.currentUser
  }
  if (anonymousAuthPromise) {
    return anonymousAuthPromise
  }

  anonymousAuthPromise = signInAnonymously(auth)
    .then((credential) => credential.user)
    .finally(() => {
      anonymousAuthPromise = null
    })

  return anonymousAuthPromise
}
