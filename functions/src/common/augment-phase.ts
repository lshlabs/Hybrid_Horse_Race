import { HttpsError } from 'firebase-functions/v2/https'

// 증강 선택 단계에서 room 상태 + setIndex가 맞는지 확인하는 공통 helper
export function assertAugmentSelectionSetContext(params: {
  roomStatus: string
  currentSetIndex: number
  requestedSetIndex: number
  statusMessage: string
}): void {
  // 현재 room이 augmentSelection 상태가 아니면 증강 관련 요청을 받지 않는다.
  if (params.roomStatus !== 'augmentSelection') {
    throw new HttpsError('failed-precondition', params.statusMessage)
  }

  // 클라이언트가 이전/다음 세트 인덱스로 요청한 경우도 막는다.
  if (params.requestedSetIndex !== params.currentSetIndex) {
    throw new HttpsError('failed-precondition', 'Invalid set index for current room state')
  }
}
