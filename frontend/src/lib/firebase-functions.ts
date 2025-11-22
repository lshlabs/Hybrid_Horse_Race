/**
 * Firebase Cloud Functions 호출 유틸리티
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator, type HttpsCallable } from 'firebase/functions'
import { getFirebaseApp } from './firebase'

let functionsInstance: ReturnType<typeof getFunctions> | null = null
let isEmulatorConnected = false

function getFunctionsInstance() {
  if (!functionsInstance) {
    try {
      const app = getFirebaseApp()
      console.log('Initializing Firebase Functions with app:', app.options.projectId)
      
      // 개발 환경에서 Emulator 사용
      const useEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
      console.log('Functions Emulator enabled:', useEmulator)
      
      // Emulator와 프로덕션 모두 'asia-northeast3' region 사용
      // Emulator도 region을 인식하므로 명시적으로 지정해야 함
      functionsInstance = getFunctions(app, 'asia-northeast3')
      
      if (useEmulator) {
        if (!isEmulatorConnected) {
          try {
            // Emulator 연결
            connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001)
            isEmulatorConnected = true
            console.log('✅ Connected to Functions Emulator at 127.0.0.1:5001 (region: asia-northeast3)')
          } catch (error: any) {
            // 이미 연결된 경우 에러 무시
            if (error?.message?.includes('already connected') || error?.code === 'functions/already-initialized') {
              isEmulatorConnected = true
              console.log('✅ Functions Emulator already connected')
            } else {
              console.warn('⚠️ Functions Emulator connection error:', error)
            }
          }
        } else {
          console.log('✅ Functions Emulator already connected')
        }
      } else {
        console.log('✅ Using Firebase Functions in production mode (region: asia-northeast3)')
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Functions:', error)
      throw error
    }
  }
  return functionsInstance
}

/**
 * 타입 안전한 Function 호출 헬퍼
 */
function createCallable<TRequest, TResponse>(
  name: string,
): HttpsCallable<TRequest, TResponse> {
  const functions = getFunctionsInstance()
  const callable = httpsCallable<TRequest, TResponse>(functions, name)
  
  // Emulator 사용 시 디버깅 로그
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    console.log(`Created callable function: ${name}`)
  }
  
  return callable
}

// 룸 관리 Functions
export const createRoom = createCallable<
  { hostId: string; title: string; setCount: number; rerollLimit: number },
  { roomId: string; status: string }
>('createRoom')

export const joinRoom = createCallable<
  { roomId: string; playerName: string },
  { playerId: string; success: boolean }
>('joinRoom')

export const leaveRoom = createCallable<
  { roomId: string; playerId: string },
  { success: boolean }
>('leaveRoom')

export const updateRoomSettings = createCallable<
  { roomId: string; playerId: string; setCount?: number; rerollLimit?: number },
  { success: boolean }
>('updateRoomSettings')

export const startGame = createCallable<
  { roomId: string; playerId: string },
  { success: boolean; status: string }
>('startGame')

// 게임 진행 Functions
export const selectRunStyle = createCallable<
  { roomId: string; playerId: string; runStyle: string },
  { success: boolean; allPlayersSelected: boolean; nextStatus: string }
>('selectRunStyle')

export const selectAugment = createCallable<
  { roomId: string; playerId: string; setIndex: number; augmentId: string },
  { success: boolean }
>('selectAugment')

export const rerollAugments = createCallable<
  { roomId: string; playerId: string; setIndex: number },
  { success: boolean; newAugments: unknown[] }
>('rerollAugments')

export const startRace = createCallable<
  { roomId: string; setIndex: number },
  { success: boolean; raceResult: unknown }
>('startRace')

export const skipSet = createCallable<
  { roomId: string; setIndex: number },
  { success: boolean }
>('skipSet')

// 상태 관리 Functions
export const setPlayerReady = createCallable<
  { roomId: string; playerId: string; isReady: boolean },
  { success: boolean }
>('setPlayerReady')


