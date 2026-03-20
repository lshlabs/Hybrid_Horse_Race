import { HttpsError } from 'firebase-functions/v2/https'
import { assertAugmentSelectionSetContext } from './augment-phase'

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
const STATUS_WAITING = 'waiting'

export function createRequestGuards<TRoom extends { status: string; currentSet: number }>(
  deps: RequestGuardDeps<TRoom>,
) {
  async function assertPlayerInRoom(roomId: string, playerId: string): Promise<void> {
    if (await deps.isPlayerInRoom(roomId, playerId)) {
      return
    }
    throw new HttpsError('not-found', 'Player not found in room')
  }

  async function assertJoinedRoomPlayerRequest(params: JoinedRoomRequestParams): Promise<void> {
    const { roomId, playerId, sessionToken, joinToken } = params
    await deps.verifyGuestSession(playerId, sessionToken)
    await deps.verifyRoomJoinToken(roomId, playerId, joinToken)
    await assertPlayerInRoom(roomId, playerId)
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
    const room = await deps.getRoom(params.roomId)

    await assertJoinedRoomHostRequest({
      roomId: params.roomId,
      playerId: params.playerId,
      sessionToken: params.sessionToken,
      joinToken: params.joinToken,
      hostErrorMessage: params.hostErrorMessage,
    })

    if (room.status === STATUS_WAITING) {
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
    await assertPlayerInRoom(roomId, playerId)

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
