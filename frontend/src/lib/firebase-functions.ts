/** Firebase Cloud Functions callable 호출 모음 */

import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
  type HttpsCallable,
  type Functions,
} from 'firebase/functions'
import { getFirebaseApp } from './firebase'

const FUNCTIONS_REGION = 'asia-northeast3'
const DEFAULT_FUNCTIONS_EMULATOR_HOST = '127.0.0.1'
const DEFAULT_FUNCTIONS_EMULATOR_PORT = 5001

let functionsInstance: ReturnType<typeof getFunctions> | null = null
let isEmulatorConnected = false

function resolveEmulatorHost(envHost?: string): string {
  if (envHost && envHost.trim().length > 0) return envHost.trim()
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname
  }
  return DEFAULT_FUNCTIONS_EMULATOR_HOST
}

function isFunctionsEmulatorEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
}

function resolveEmulatorPort(rawPort?: string): number {
  const parsedPort = Number(rawPort || DEFAULT_FUNCTIONS_EMULATOR_PORT)
  return Number.isFinite(parsedPort) ? parsedPort : DEFAULT_FUNCTIONS_EMULATOR_PORT
}

function isAlreadyConnectedFunctionsError(error: unknown): boolean {
  const err = error as { message?: string; code?: string }
  return (
    err?.message?.includes('already connected') === true ||
    err?.code === 'functions/already-initialized'
  )
}

function connectFunctionsEmulatorIfNeeded(instance: Functions): void {
  if (!isFunctionsEmulatorEnabled()) {
    console.log(`✅ Using Firebase Functions in production mode (region: ${FUNCTIONS_REGION})`)
    return
  }

  console.log('Functions Emulator enabled:', true)

  if (isEmulatorConnected) {
    console.log('✅ Functions Emulator already connected')
    return
  }

  try {
    const emulatorHost = resolveEmulatorHost(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST)
    const emulatorPort = resolveEmulatorPort(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT)
    connectFunctionsEmulator(instance, emulatorHost, emulatorPort)
    isEmulatorConnected = true
    console.log(
      `✅ Connected to Functions Emulator at ${emulatorHost}:${emulatorPort} (region: ${FUNCTIONS_REGION})`,
    )
  } catch (error: unknown) {
    if (isAlreadyConnectedFunctionsError(error)) {
      isEmulatorConnected = true
      console.log('✅ Functions Emulator already connected')
      return
    }

    console.warn('⚠️ Functions Emulator connection error:', error)
  }
}

function createFunctionsInstance(): ReturnType<typeof getFunctions> {
  const app = getFirebaseApp()
  console.log('Initializing Firebase Functions with app:', app.options.projectId)

  const useEmulator = isFunctionsEmulatorEnabled()
  console.log('Functions Emulator enabled:', useEmulator)

  // 에뮬레이터/운영 둘 다 같은 region을 쓰도록 맞춘다.
  const instance = getFunctions(app, FUNCTIONS_REGION)
  connectFunctionsEmulatorIfNeeded(instance)
  return instance
}

function getFunctionsInstance() {
  if (functionsInstance) return functionsInstance

  try {
    functionsInstance = createFunctionsInstance()
    return functionsInstance
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Functions:', error)
    throw error
  }
}

/** 타입 지정해서 callable을 만드는 공통 헬퍼 */
function createCallable<TRequest, TResponse>(name: string): HttpsCallable<TRequest, TResponse> {
  const functions = getFunctionsInstance()
  const callable = httpsCallable<TRequest, TResponse>(functions, name)

  // 에뮬레이터 쓸 때는 어떤 callable을 만들었는지 로그로 확인하기 쉽게 남긴다.
  if (isFunctionsEmulatorEnabled()) {
    console.log(`Created callable function: ${name}`)
  }

  return callable
}

export const createGuestSession = createCallable<
  { guestId?: string },
  { guestId: string; sessionToken: string; expiresAtMillis: number }
>('createGuestSession')

// 룸 관리 callable
export const createRoom = createCallable<
  {
    playerId: string
    sessionToken: string
    hostName: string
    title: string
    maxPlayers: number
    roundCount: number
    rerollLimit: number
  },
  { roomId: string; status: string; joinToken: string; joinTokenExpiresAtMillis: number }
>('createRoom')

export const joinRoom = createCallable<
  { roomId: string; playerId: string; sessionToken: string; playerName: string },
  {
    playerId: string
    success: boolean
    joinToken: string
    joinTokenExpiresAtMillis: number
    rejoined: boolean
  }
>('joinRoom')

export const leaveRoom = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string },
  { success: boolean }
>('leaveRoom')

export const updateRoomSettings = createCallable<
  {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    roundCount?: number
    rerollLimit?: number
  },
  { success: boolean }
>('updateRoomSettings')

export const startGame = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string },
  { success: boolean; status: string }
>('startGame')

// 게임 진행 callable
export const selectHorse = createCallable<
  {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    horseStats: {
      Speed: number
      Stamina: number
      Power: number
      Guts: number
      Start: number
      Luck: number
    }
  },
  { success: boolean; allPlayersSelected: boolean; nextStatus: string }
>('selectHorse')

export const selectAugment = createCallable<
  {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    setIndex: number
    augmentId: string
  },
  { success: boolean }
>('selectAugment')

export const getAugmentSelection = createCallable<
  {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    setIndex: number
  },
  {
    success: boolean
    rarity: 'common' | 'rare' | 'epic' | 'legendary'
    availableAugments: Array<{
      id: string
      name: string
      rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'
      statType?: 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'
      statValue?: number
      specialAbility?: 'lastSpurt' | 'overtake' | 'escapeCrisis'
      specialAbilityValue?: number
      description?: string
    }>
    selectedCount: number
    totalPlayers: number
  }
>('getAugmentSelection')

export const rerollAugments = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  {
    success: boolean
    newAugments: Array<{
      id: string
      name: string
      rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'
      statType?: 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'
      statValue?: number
      specialAbility?: 'lastSpurt' | 'overtake' | 'escapeCrisis'
      specialAbilityValue?: number
      description?: string
    }>
    rerollUsed: number
    remainingRerolls: number
  }
>('rerollAugments')

export const startRace = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  {
    success: boolean
    startedAtMillis: number
    alreadyStarted?: boolean
    scriptVersion: string
    simStepMs: number
    outputFrameMs: number
    tickIntervalMs: number
    raceStateDocVersion: string
  }
>('startRace')

export const prepareRace = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  {
    success: boolean
    prepared: boolean
    alreadyPrepared?: boolean
    scriptVersion: string
    simStepMs: number
    outputFrameMs: number
    tickIntervalMs: number
    raceStateDocVersion: string
    keyframeCount?: number
  }
>('prepareRace')

export const skipSet = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  { success: boolean }
>('skipSet')

export const readyNextSet = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  {
    success: boolean
    allReady: boolean
    nextStatus: 'setResult' | 'augmentSelection' | 'finished'
    currentSet: number
  }
>('readyNextSet')

export const getSetResult = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  {
    success: boolean
    hasResult: boolean
    rankings: Array<{
      playerId: string
      name: string
      position: number
      time: number
      selectedAugments: Array<{
        id: string
        name: string
        rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'
        statType?: 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'
        statValue?: number
        specialAbility?: 'lastSpurt' | 'overtake' | 'escapeCrisis'
        specialAbilityValue?: number
        description?: string
      }>
    }>
    startedAtMillis: number | null
    readyCount: number
  }
>('getSetResult')

export const getRaceState = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; setIndex: number },
  {
    success: boolean
    hasRaceState: boolean
    status?: 'prepared' | 'running' | 'completed'
    setIndex?: number
    scriptVersion?: string
    startedAtMillis?: number | null
    elapsedMs?: number
    authoritativeNowMs?: number
    simStepMs?: number
    outputFrameMs?: number
    tickIntervalMs?: number
    trackLengthM?: number
    raceStateDocVersion?: string
    snapshotHash?: string
    keyframeIndex?: number
    keyframe?: {
      elapsedMs: number
      positions: Record<string, number>
      speeds: Record<string, number>
      stamina: Record<string, number>
      finished: Record<string, boolean>
    }
    nextKeyframe?: {
      elapsedMs: number
      positions: Record<string, number>
      speeds: Record<string, number>
      stamina: Record<string, number>
      finished: Record<string, boolean>
    }
    eventsWindow?: Array<
      | {
          id: string
          type: 'overtake'
          elapsedMs: number
          playerId: string
          fromRank: number
          toRank: number
        }
      | {
          id: string
          type: 'lastSpurt'
          elapsedMs: number
          playerId: string
        }
      | {
          id: string
          type: 'finish'
          elapsedMs: number
          playerId: string
          rank: number
        }
      | {
          id: string
          type: 'slowmoTrigger'
          elapsedMs: number
        }
    >
    slowmoTriggerMs?: number | null
    rankings?: Array<{ playerId: string; time: number; position: number }>
  }
>('getRaceState')

// 최종 결과 Functions
export const submitFinalRaceResult = createCallable<
  {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    finalRankings: Array<{
      rank: number
      name: string
      totalScore: number
      roundResults: Array<{
        rank: number
        name: string
        time: number
        finished: boolean
      } | null>
    }>
  },
  { success: boolean }
>('submitFinalRaceResult')

// 상태 관리 Functions
export const setPlayerReady = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; isReady: boolean },
  { success: boolean }
>('setPlayerReady')

export const updatePlayerName = createCallable<
  { roomId: string; playerId: string; sessionToken: string; joinToken: string; name: string },
  { success: boolean }
>('updatePlayerName')
