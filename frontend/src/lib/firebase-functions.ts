/**
 * Firebase Cloud Functions 호출 유틸리티
 */

import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions'
import { getFirebaseApp } from './firebase'

let functionsInstance: ReturnType<typeof getFunctions> | null = null

function getFunctionsInstance() {
  if (!functionsInstance) {
    const app = getFirebaseApp()
    functionsInstance = getFunctions(app)

    // 개발 환경에서 Emulator 사용
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      // Functions Emulator는 자동으로 localhost:5001을 사용
      // connectFunctionsEmulator는 필요시 사용
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
  return httpsCallable<TRequest, TResponse>(functions, name)
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

export const startGame = createCallable<
  { roomId: string },
  { success: boolean }
>('startGame')

// 게임 진행 Functions
export const selectRunStyle = createCallable<
  { roomId: string; playerId: string; runStyle: string },
  { success: boolean }
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


