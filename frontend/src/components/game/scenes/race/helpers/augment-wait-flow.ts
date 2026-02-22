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

export function buildNextSetSyncRequestContext(params: {
  roomId?: string
  playerId?: string
  sessionToken?: string
  roomJoinToken?: string | null
  room?: Room
}): NextSetSyncRequestContext | null {
  // 다음 라운드 동기화 요청은 roomId/playerId/session/joinToken이 다 있어야 보낼 수 있다.
  const { roomId, playerId, sessionToken, roomJoinToken, room } = params
  if (!roomId || !playerId || !sessionToken || !roomJoinToken || !room) {
    return null
  }

  return {
    roomId,
    playerId,
    sessionToken,
    joinToken: roomJoinToken,
  }
}

export function resolveRoomStatusNextSetAction(
  roomStatus?: Room['status'],
): NextSetTransitionAction {
  // room 상태만 보고 할 수 있는 최소 전이 판단
  if (roomStatus === 'augmentSelection') {
    return { type: 'startNewSet' }
  }
  if (roomStatus === 'finished') {
    return { type: 'finalResult' }
  }
  return { type: 'none' }
}

export function resolveReadyNextSetResponseAction(
  data: ReadyNextSetResponseData,
): NextSetTransitionAction {
  // readyNextSet 응답은 "힌트" 성격이고, 최종 복구는 room 상태도 같이 본다.
  if (data.allReady && data.nextStatus === 'augmentSelection') {
    return { type: 'startNewSet', currentSet: data.currentSet }
  }

  if (data.nextStatus === 'finished') {
    return { type: 'finalResult' }
  }

  return { type: 'none' }
}

export function shouldResumeAfterAugmentSelectionWait(params: {
  isWaitingForOtherAugmentSelections: boolean
  roomStatus?: Room['status']
}): boolean {
  // 다른 사람 증강 선택 대기 중이었는데 room이 racing으로 돌아오면 레이스 재개 가능
  return params.isWaitingForOtherAugmentSelections && params.roomStatus === 'racing'
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
    params.roomStatus === 'augmentSelection' &&
    (params.roomCurrentSet ?? params.previousSet) >= params.previousSet
  ) {
    return { type: 'startNewSet' }
  }

  if (params.roomStatus === 'finished') {
    return { type: 'finalResult' }
  }

  return { type: 'none' }
}
