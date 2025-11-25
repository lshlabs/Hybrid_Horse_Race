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
let isFirestoreEmulatorConnected = false

function getFirebaseConfig(): FirebaseConfig {
  // 개발 환경에서 Emulator 사용 시 기본값 사용
  const useEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
  
  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulator ? 'demo-api-key' : ''),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (useEmulator ? 'demo-hybrid-horse-race.firebaseapp.com' : ''),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulator ? 'demo-hybrid-horse-race' : ''),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (useEmulator ? 'demo-hybrid-horse-race.appspot.com' : ''),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (useEmulator ? '123456789' : ''),
    appId: import.meta.env.VITE_FIREBASE_APP_ID || (useEmulator ? '1:123456789:web:abcdef' : ''),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  }

  // measurementId는 선택사항이므로 제외하고 검증
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const
  requiredFields.forEach((key) => {
    if (!config[key]) {
      console.error(`Missing Firebase config value for ${key}`)
      if (!useEmulator) {
        throw new Error(`Missing Firebase config value for ${key}. Please set VITE_FIREBASE_${key.toUpperCase().replace(/[A-Z]/g, (m) => '_' + m)} in .env file`)
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

    // 개발 환경에서 Emulator 사용
    const useEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
    
    if (useEmulator && !isFirestoreEmulatorConnected) {
      try {
        // Emulator 연결 (중복 연결 방지)
        connectFirestoreEmulator(firestoreInstance, '127.0.0.1', 8081)
        isFirestoreEmulatorConnected = true
        console.log('✅ Connected to Firestore Emulator at 127.0.0.1:8081')
      } catch (error: any) {
        // 이미 연결된 경우 에러 무시
        if (error?.message?.includes('already connected') || error?.code === 'already-initialized') {
          isFirestoreEmulatorConnected = true
          console.log('✅ Firestore Emulator already connected')
        } else {
          console.warn('⚠️ Firestore Emulator connection error:', error)
        }
      }
    }
  }
  return firestoreInstance
}
