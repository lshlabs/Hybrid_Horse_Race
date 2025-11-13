import { onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'

initializeApp()

const db = getFirestore()

const createRoomSchema = z.object({
  hostId: z.string().min(1, 'hostId is required'),
  title: z.string().min(1).max(48),
  setCount: z.number().int().min(1).max(9),
  rerollLimit: z.number().int().min(0).max(5),
})

export const createRoom = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    const parseResult = createRoomSchema.safeParse(request.data)
    if (!parseResult.success) {
      logger.warn('Invalid createRoom payload', parseResult.error.flatten().fieldErrors)
      throw new Error('Invalid arguments')
    }

    const { hostId, title, setCount, rerollLimit } = parseResult.data
    const roomRef = db.collection('rooms').doc()

    await roomRef.set({
      hostId,
      title,
      setCount,
      rerollLimit,
      status: 'waiting',
      currentSet: 1,
      createdAt: Timestamp.now(),
    })

    logger.info('Created room', { roomId: roomRef.id, hostId })

    return {
      roomId: roomRef.id,
      status: 'waiting',
    }
  },
)

