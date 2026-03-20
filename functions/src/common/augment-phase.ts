import { HttpsError } from 'firebase-functions/v2/https'

const STATUS_AUGMENT_SELECTION = 'augmentSelection'
const INVALID_SET_INDEX_MESSAGE = 'Invalid set index for current room state'

export function assertAugmentSelectionSetContext(params: {
  roomStatus: string
  currentSetIndex: number
  requestedSetIndex: number
  statusMessage: string
}): void {
  if (params.roomStatus !== STATUS_AUGMENT_SELECTION) {
    throw new HttpsError('failed-precondition', params.statusMessage)
  }

  if (params.requestedSetIndex !== params.currentSetIndex) {
    throw new HttpsError('failed-precondition', INVALID_SET_INDEX_MESSAGE)
  }
}
