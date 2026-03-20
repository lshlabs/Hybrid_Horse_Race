import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { Augment, AugmentRarity, Player } from '../types'

type LoggerLike = {
  info: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, error: unknown) => void
}

type SelectionDeps = {
  db: FirebaseFirestore.Firestore
  logger: LoggerLike
  getRoom: (roomId: string) => Promise<{ status: string }>
  updateRoomStatus: (roomId: string, status: 'horseSelection' | 'augmentSelection' | 'racing') => Promise<void>
  isPlayerInRoom: (roomId: string, playerId: string) => Promise<boolean>
  verifyGuestSession: (playerId: string, sessionToken: string) => Promise<void>
  verifyRoomJoinToken: (roomId: string, playerId: string, joinToken: string) => Promise<void>
  assertAugmentSelectionRequestContext: (params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    setIndex: number
    statusMessage: string
  }) => Promise<{ rerollLimit: number }>
  createSeededRandom: (seed: string) => () => number
  pickRandomSeeded: <T>(items: T[], rng: () => number) => T
  generateServerAugmentChoices: (
    rarity: Exclude<AugmentRarity, 'hidden'>,
    rng: () => number,
    seedKey: string,
  ) => Augment[]
  augmentRarities: Array<Exclude<AugmentRarity, 'hidden'>>
  applyAugmentToHorseStats: (horseStats: Player['horseStats'], augment?: Augment) => Player['horseStats']
  calculateLuckBonus: (luck: number) => number
  applyLuckBonusToHorseStats: (
    horseStats: Player['horseStats'],
    luckBonus: number,
  ) => Player['horseStats']
}

const authenticatedPlayerRequestSchema = {
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
}

const selectHorseSchema = z.object({
  ...authenticatedPlayerRequestSchema,
  horseStats: z.object({
    Speed: z.number().min(0),
    Stamina: z.number().min(0),
    Power: z.number().min(0),
    Guts: z.number().min(0),
    Start: z.number().min(0),
    Luck: z.number().min(0),
  }),
})

const selectAugmentSchema = z.object({
  ...authenticatedPlayerRequestSchema,
  setIndex: z.number().int().min(1),
  augmentId: z.string().min(1, 'augmentId is required'),
})

const getAugmentSelectionSchema = z.object({
  ...authenticatedPlayerRequestSchema,
  setIndex: z.number().int().min(1),
})

const rerollAugmentsSchema = z.object({
  ...authenticatedPlayerRequestSchema,
  setIndex: z.number().int().min(1),
})
const CALLABLE_OPTIONS = { region: 'asia-northeast3', cors: true } as const
const STATUS_HORSE_SELECTION = 'horseSelection' as const
const STATUS_AUGMENT_SELECTION = 'augmentSelection' as const
const STATUS_RACING = 'racing' as const

export function createSelectionCallables(deps: SelectionDeps) {
  function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    const parsed = schema.safeParse(data)
    if (parsed.success) {
      return parsed.data
    }
    throw new HttpsError('invalid-argument', 'Invalid arguments', {
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  function rethrowUnexpected(error: unknown, publicMessage: string): never {
    if (error instanceof HttpsError) {
      throw error
    }
    throw new HttpsError('internal', publicMessage)
  }

  const selectHorse = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, horseStats } = parseOrThrow(
          selectHorseSchema,
          request.data,
        )
        await deps.verifyGuestSession(playerId, sessionToken)
        await deps.verifyRoomJoinToken(roomId, playerId, joinToken)

        const room = await deps.getRoom(roomId)
        if (room.status !== STATUS_HORSE_SELECTION) {
          throw new HttpsError(
            'failed-precondition',
            'Horse can only be selected during horseSelection phase',
          )
        }

        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        const playerDoc = await playerRef.get()
        if (!playerDoc.exists) throw new HttpsError('not-found', 'Player not found in room')

        const player = playerDoc.data() as Player
        if (player.horseStats) {
          throw new HttpsError('failed-precondition', 'Horse has already been selected for this player')
        }

        await playerRef.update({
          horseStats,
          currentSetLuckBonus: 0,
          updatedAt: Timestamp.now(),
        })

        const playersSnapshot = await deps.db.collection('rooms').doc(roomId).collection('players').get()
        const allSelected = playersSnapshot.docs.every((doc) => (doc.data() as Player).horseStats !== undefined)

        if (allSelected) {
          await deps.updateRoomStatus(roomId, STATUS_AUGMENT_SELECTION)
          deps.logger.info('All players selected horse, moving to augment selection', {
            roomId,
            playerCount: playersSnapshot.size,
          })
        }

        deps.logger.info('Horse selected', { roomId, playerId, horseStats })
        return {
          success: true,
          allPlayersSelected: allSelected,
          nextStatus: allSelected ? STATUS_AUGMENT_SELECTION : STATUS_HORSE_SELECTION,
        }
      } catch (error) {
        deps.logger.error('selectHorse error', error)
        rethrowUnexpected(error, 'Failed to select horse')
      }
    },
  )

  const getAugmentSelection = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          getAugmentSelectionSchema,
          request.data,
        )
        await deps.assertAugmentSelectionRequestContext({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          setIndex,
          statusMessage: 'Augment can only be requested during augmentSelection phase',
        })

        const playersSnapshot = await deps.db.collection('rooms').doc(roomId).collection('players').get()
        const playerIds = playersSnapshot.docs.map((doc) => doc.id).sort()
        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)

        const setDoc = await deps.db.runTransaction(async (tx) => {
          const current = await tx.get(setDocRef)
          if (current.exists) {
            const data = current.data() as {
              rarity?: Exclude<AugmentRarity, 'hidden'>
              availableAugmentsByPlayer?: Record<string, Augment[]>
              selections?: Record<string, string>
            }
            if (data.rarity && data.availableAugmentsByPlayer?.[playerId]) return data
          }

          const raritySeedKey = `augment-rarity|room:${roomId}|set:${setIndex}`
          const rarityRng = deps.createSeededRandom(raritySeedKey)
          const rarity = deps.pickRandomSeeded(deps.augmentRarities, rarityRng)
          const availableAugmentsByPlayer: Record<string, Augment[]> = {}

          playerIds.forEach((id) => {
            const seedKey = `augment|room:${roomId}|set:${setIndex}|player:${id}|reroll:0`
            const rng = deps.createSeededRandom(seedKey)
            availableAugmentsByPlayer[id] = deps.generateServerAugmentChoices(rarity, rng, seedKey)
          })

          const nextDoc = {
            setIndex,
            rarity,
            availableAugmentsByPlayer,
            selections: {},
            status: STATUS_AUGMENT_SELECTION,
            updatedAt: Timestamp.now(),
          }
          tx.set(setDocRef, nextDoc, { merge: true })
          return nextDoc
        })

        const availableAugments = setDoc.availableAugmentsByPlayer?.[playerId] ?? []
        const selections = setDoc.selections ?? {}
        const selectedCount = Object.keys(selections).length

        return {
          success: true,
          rarity: setDoc.rarity ?? 'common',
          availableAugments,
          selectedCount,
          totalPlayers: playerIds.length,
        }
      } catch (error) {
        deps.logger.error('getAugmentSelection error', error)
        rethrowUnexpected(error, 'Failed to get augment selection')
      }
    },
  )

  const selectAugment = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex, augmentId } = parseOrThrow(
          selectAugmentSchema,
          request.data,
        )
        await deps.assertAugmentSelectionRequestContext({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          setIndex,
          statusMessage: 'Augment can only be selected during augmentSelection phase',
        })

        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        const playerDoc = await playerRef.get()
        if (!playerDoc.exists) throw new HttpsError('not-found', 'Player not found in room')

        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const setDoc = await setDocRef.get()
        const setData = setDoc.data() as
          | { availableAugmentsByPlayer?: Record<string, Augment[]>; selections?: Record<string, string> }
          | undefined
        const existingSelections = setData?.selections ?? {}
        if (existingSelections[playerId]) {
          throw new HttpsError('failed-precondition', 'Augment already selected for this set')
        }

        const availableChoices = setData?.availableAugmentsByPlayer?.[playerId] ?? []
        const selectedAugment = availableChoices.find((augment) => augment.id === augmentId)
        if (!selectedAugment) {
          throw new HttpsError('failed-precondition', 'Selected augment is not available for player')
        }

        await playerRef.update({
          selectedAugments: FieldValue.arrayUnion({ setIndex, augmentId }),
          updatedAt: Timestamp.now(),
        })

        await setDocRef.set(
          { setIndex, selections: { [playerId]: augmentId }, updatedAt: Timestamp.now() },
          { merge: true },
        )

        const playersSnapshot = await deps.db.collection('rooms').doc(roomId).collection('players').get()
        const nextSelections = { ...existingSelections, [playerId]: augmentId }
        const allSelected =
          playersSnapshot.size > 0 &&
          Object.keys(nextSelections).length >= playersSnapshot.size &&
          playersSnapshot.docs.every((doc) => !!nextSelections[doc.id])

        if (allSelected) {
          const availableAugmentsByPlayer = setData?.availableAugmentsByPlayer ?? {}
          const batch = deps.db.batch()

          playersSnapshot.docs.forEach((doc) => {
            const playerData = doc.data() as Player
            const selectedId = nextSelections[doc.id]
            const augment = availableAugmentsByPlayer[doc.id]?.find((entry) => entry.id === selectedId)
            const persistentStats = deps.applyAugmentToHorseStats(playerData.horseStats, augment)
            if (!persistentStats) return

            const luckBonus = deps.calculateLuckBonus(persistentStats.Luck)
            const nextHorseStats = deps.applyLuckBonusToHorseStats(persistentStats, luckBonus)
            batch.update(doc.ref, {
              horseStats: nextHorseStats,
              currentSetLuckBonus: luckBonus,
              updatedAt: Timestamp.now(),
            })
          })

          await batch.commit()
          await deps.updateRoomStatus(roomId, STATUS_RACING)
        }

        deps.logger.info('Augment selected', { roomId, playerId, setIndex, augmentId, allSelected })
        return { success: true }
      } catch (error) {
        deps.logger.error('selectAugment error', error)
        rethrowUnexpected(error, 'Failed to select augment')
      }
    },
  )

  const rerollAugments = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          rerollAugmentsSchema,
          request.data,
        )
        const room = await deps.assertAugmentSelectionRequestContext({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          setIndex,
          statusMessage: 'Augments can only be rerolled during augmentSelection phase',
        })

        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        const playerDoc = await playerRef.get()
        const playerData = playerDoc.data() as (Player & { rerollUsed?: number }) | undefined
        if (!playerData) throw new HttpsError('not-found', 'Player not found in room')

        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const setDoc = await setDocRef.get()
        const setData = setDoc.data() as
          | {
              rarity?: Exclude<AugmentRarity, 'hidden'>
              availableAugmentsByPlayer?: Record<string, Augment[]>
              selections?: Record<string, string>
            }
          | undefined

        const selections = setData?.selections ?? {}
        if (selections[playerId]) {
          throw new HttpsError('failed-precondition', 'Cannot reroll after augment is already selected')
        }

        const rerollUsed = playerData.rerollUsed ?? 0
        if (rerollUsed >= room.rerollLimit) {
          throw new HttpsError('resource-exhausted', 'No rerolls remaining for this player')
        }

        const rerollIndex = rerollUsed + 1
        const seedKey = `augment|room:${roomId}|set:${setIndex}|player:${playerId}|reroll:${rerollIndex}`
        const rng = deps.createSeededRandom(seedKey)
        const rarity = setData?.rarity ?? deps.pickRandomSeeded(deps.augmentRarities, rng)
        const newAugments = deps.generateServerAugmentChoices(rarity, rng, seedKey)

        await playerRef.update({ rerollUsed: rerollUsed + 1, updatedAt: Timestamp.now() })
        await setDocRef.set(
          {
            setIndex,
            rarity,
            availableAugmentsByPlayer: { [playerId]: newAugments },
            deterministicMeta: { source: 'seeded-rng-v1', seedKey, rarity, rerollIndex },
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        )
        await deps.db.collection('rooms').doc(roomId).update({
          rerollUsed: FieldValue.increment(1),
          updatedAt: Timestamp.now(),
        })

        deps.logger.info('Augments rerolled', {
          roomId,
          playerId,
          setIndex,
          rerollUsed: rerollUsed + 1,
          seedKey,
        })

        return {
          success: true,
          newAugments,
          rerollUsed: rerollUsed + 1,
          remainingRerolls: Math.max(0, room.rerollLimit - (rerollUsed + 1)),
        }
      } catch (error) {
        deps.logger.error('rerollAugments error', error)
        rethrowUnexpected(error, 'Failed to reroll augments')
      }
    },
  )

  return { selectHorse, getAugmentSelection, selectAugment, rerollAugments }
}
