import type { Room } from '../../../../../hooks/useRoom'

// RaceScene에서 "다음 라운드 대기/증강 선택 대기" 관련 분기 판단만 분리한 helper
export type NextSetSyncRequestContext = {
  roomId: string
  playerId: string
  sessionToken: string
  joinToken: string
}

export type ReadyNextSetResponseData = {
  allReady?: boolean
  nextStatus?: string
  currentSet?: number
}

export type NextSetTransitionAction =
  | { type: 'none' }
  | { type: 'startNewSet'; currentSet?: number }
  | { type: 'finalResult' }

const START_NEW_SET_STATUS: Room['status'] = 'augmentSelection'
const FINAL_RESULT_STATUS: Room['status'] = 'finished'
const RESUME_RACE_STATUS: Room['status'] = 'racing'
const NEXT_STATUS_START_NEW_SET = 'augmentSelection'
const NEXT_STATUS_FINAL_RESULT = 'finished'

function hasNextSetSyncContext(params: {
  roomId?: string
  playerId?: string
  sessionToken?: string
  roomJoinToken?: string | null
  room?: Room
}): params is {
  roomId: string
  playerId: string
  sessionToken: string
  roomJoinToken: string
  room: Room
} {
  return !!(
    params.roomId &&
    params.playerId &&
    params.sessionToken &&
    params.roomJoinToken &&
    params.room
  )
}

export function buildNextSetSyncRequestContext(params: {
  roomId?: string
  playerId?: string
  sessionToken?: string
  roomJoinToken?: string | null
  room?: Room
}): NextSetSyncRequestContext | null {
  if (!hasNextSetSyncContext(params)) {
    return null
  }

  return {
    roomId: params.roomId,
    playerId: params.playerId,
    sessionToken: params.sessionToken,
    joinToken: params.roomJoinToken,
  }
}

export function resolveRoomStatusNextSetAction(
  roomStatus?: Room['status'],
): NextSetTransitionAction {
  if (roomStatus === START_NEW_SET_STATUS) {
    return { type: 'startNewSet' }
  }
  if (roomStatus === FINAL_RESULT_STATUS) {
    return { type: 'finalResult' }
  }
  return { type: 'none' }
}

export function resolveReadyNextSetResponseAction(
  data: ReadyNextSetResponseData,
): NextSetTransitionAction {
  // readyNextSet 응답은 "힌트" 성격이고, 최종 복구는 room 상태도 같이 본다.
  if (data.allReady && data.nextStatus === NEXT_STATUS_START_NEW_SET) {
    return { type: 'startNewSet', currentSet: data.currentSet }
  }

  if (data.nextStatus === NEXT_STATUS_FINAL_RESULT) {
    return { type: 'finalResult' }
  }

  return { type: 'none' }
}

export function shouldResumeAfterAugmentSelectionWait(params: {
  isWaitingForOtherAugmentSelections: boolean
  roomStatus?: Room['status']
}): boolean {
  return params.isWaitingForOtherAugmentSelections && params.roomStatus === RESUME_RACE_STATUS
}

export function resolveWaitingNextSetRoomUpdateAction(params: {
  isWaitingForNextSetTransition: boolean
  roomStatus?: Room['status']
  roomCurrentSet?: number
  previousSet: number
}): NextSetTransitionAction {
  // next-set 대기 중에는 room snapshot 업데이트만으로도 다음 라운드 전환을 복구할 수 있다.
  if (!params.isWaitingForNextSetTransition) {
    return { type: 'none' }
  }

  if (
    params.roomStatus === START_NEW_SET_STATUS &&
    (params.roomCurrentSet ?? params.previousSet) >= params.previousSet
  ) {
    return { type: 'startNewSet' }
  }

  if (params.roomStatus === FINAL_RESULT_STATUS) {
    return { type: 'finalResult' }
  }

  return { type: 'none' }
}
