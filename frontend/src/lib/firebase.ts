import { initializeApp, type FirebaseApp } from 'firebase/app'
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

function getFirebaseConfig(): FirebaseConfig {
  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  }

  Object.entries(config).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`Missing Firebase config value for ${key}`)
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

    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      connectFirestoreEmulator(firestoreInstance, '127.0.0.1', 8080)
    }
  }
  return firestoreInstance
}
