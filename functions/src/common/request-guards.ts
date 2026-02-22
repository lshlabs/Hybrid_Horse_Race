import { HttpsError } from 'firebase-functions/v2/https'
import { assertAugmentSelectionSetContext } from './augment-phase'

// 여러 callable에서 반복되는 "세션/토큰/room 참가자/host" 검증을 묶어둔 helper
type JoinedRoomRequestParams = {
  roomId: string
  playerId: string
  sessionToken: string
  joinToken: string
}

type JoinedRoomHostRequestParams = JoinedRoomRequestParams & {
  hostErrorMessage?: string
}

type HostWaitingRoomActionRequestParams = JoinedRoomRequestParams & {
  hostErrorMessage: string
  waitingStatusMessage: string
}

type AugmentSelectionRequestContextParams = JoinedRoomRequestParams & {
  setIndex: number
  statusMessage: string
}

type RequestGuardDeps<TRoom extends { status: string; currentSet: number }> = {
  verifyGuestSession: (playerId: string, sessionToken: string) => Promise<void>
  verifyRoomJoinToken: (roomId: string, playerId: string, joinToken: string) => Promise<void>
  isPlayerInRoom: (roomId: string, playerId: string) => Promise<boolean>
  isHost: (roomId: string, playerId: string) => Promise<boolean>
  getRoom: (roomId: string) => Promise<TRoom>
}

export function createRequestGuards<TRoom extends { status: string; currentSet: number }>(
  deps: RequestGuardDeps<TRoom>,
) {
  async function assertJoinedRoomPlayerRequest(params: JoinedRoomRequestParams): Promise<void> {
    const { roomId, playerId, sessionToken, joinToken } = params
    await deps.verifyGuestSession(playerId, sessionToken)
    await deps.verifyRoomJoinToken(roomId, playerId, joinToken)

    // 세션/토큰은 맞아도 room에서 이미 빠진 플레이어일 수 있어서 room 참가 여부를 한 번 더 본다.
    if (await deps.isPlayerInRoom(roomId, playerId)) {
      return
    }

    throw new HttpsError('not-found', 'Player not found in room')
  }

  async function assertJoinedRoomHostRequest(params: JoinedRoomHostRequestParams): Promise<void> {
    const { roomId, playerId, hostErrorMessage } = params
    await assertJoinedRoomPlayerRequest(params)

    if (await deps.isHost(roomId, playerId)) {
      return
    }

    throw new HttpsError(
      'permission-denied',
      hostErrorMessage ?? 'Only host can perform this action',
    )
  }

  async function assertHostWaitingRoomActionRequest(
    params: HostWaitingRoomActionRequestParams,
  ): Promise<TRoom> {
    // room 상태를 먼저 읽고, 그 다음 host 권한까지 같이 확인해서
    // "waiting 상태에서 host만 가능한 액션" 공통 로직으로 사용한다.
    const room = await deps.getRoom(params.roomId)

    await assertJoinedRoomHostRequest({
      roomId: params.roomId,
      playerId: params.playerId,
      sessionToken: params.sessionToken,
      joinToken: params.joinToken,
      hostErrorMessage: params.hostErrorMessage,
    })

    if (room.status === 'waiting') {
      return room
    }

    throw new HttpsError('failed-precondition', params.waitingStatusMessage)
  }

  async function assertAugmentSelectionRequestContext(
    params: AugmentSelectionRequestContextParams,
  ): Promise<TRoom> {
    const { roomId, playerId, sessionToken, joinToken, setIndex, statusMessage } = params
    await deps.verifyGuestSession(playerId, sessionToken)
    await deps.verifyRoomJoinToken(roomId, playerId, joinToken)

    // 증강 선택은 room.status와 currentSet 둘 다 맞아야 해서 별도 helper를 사용한다.
    const room = await deps.getRoom(roomId)
    assertAugmentSelectionSetContext({
      roomStatus: room.status,
      currentSetIndex: room.currentSet,
      requestedSetIndex: setIndex,
      statusMessage,
    })

    return room
  }

  return {
    assertJoinedRoomPlayerRequest,
    assertJoinedRoomHostRequest,
    assertHostWaitingRoomActionRequest,
    assertAugmentSelectionRequestContext,
  }
}
