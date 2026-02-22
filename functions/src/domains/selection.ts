import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { Augment, AugmentRarity, Player } from '../types'

// 말 선택 / 증강 선택 단계에서 쓰는 callable 모음
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

const selectHorseSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
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
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
  augmentId: z.string().min(1, 'augmentId is required'),
})

const getAugmentSelectionSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})

const rerollAugmentsSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})

export function createSelectionCallables(deps: SelectionDeps) {
  const selectHorse = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 1) 입력 검증 + 세션/토큰 확인
        const parseResult = selectHorseSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        // 2) horseSelection phase인지 확인
        const { roomId, playerId, sessionToken, joinToken, horseStats } = parseResult.data
        await deps.verifyGuestSession(playerId, sessionToken)
        await deps.verifyRoomJoinToken(roomId, playerId, joinToken)

        const room = await deps.getRoom(roomId)
        if (room.status !== 'horseSelection') {
          throw new HttpsError(
            'failed-precondition',
            'Horse can only be selected during horseSelection phase',
          )
        }

        // 같은 플레이어가 중복으로 고르는 걸 막기 위해 player 문서를 다시 확인한다.
        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        const playerDoc = await playerRef.get()
        if (!playerDoc.exists) throw new HttpsError('not-found', 'Player not found in room')

        const player = playerDoc.data() as Player
        if (player.horseStats) {
          throw new HttpsError('failed-precondition', 'Horse has already been selected for this player')
        }

        // 3) 말을 저장하고, 전원이 끝났으면 augmentSelection으로 넘긴다.
        await playerRef.update({
          horseStats,
          currentSetLuckBonus: 0,
          updatedAt: Timestamp.now(),
        })

        // 전원이 말을 골랐는지 확인해서 다음 phase 전환 여부를 결정한다.
        const playersSnapshot = await deps.db.collection('rooms').doc(roomId).collection('players').get()
        const allSelected = playersSnapshot.docs.every((doc) => (doc.data() as Player).horseStats !== undefined)

        if (allSelected) {
          await deps.updateRoomStatus(roomId, 'augmentSelection')
          deps.logger.info('All players selected horse, moving to augment selection', {
            roomId,
            playerCount: playersSnapshot.size,
          })
        }

        deps.logger.info('Horse selected', { roomId, playerId, horseStats })
        return {
          success: true,
          allPlayersSelected: allSelected,
          nextStatus: allSelected ? 'augmentSelection' : 'horseSelection',
        }
      } catch (error) {
        deps.logger.error('selectHorse error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to select horse')
      }
    },
  )

  const getAugmentSelection = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 증강 선택 화면 진입 시 호출
        // set 문서가 없으면 여기서 rarity/선택지 목록을 처음 만든다.
        const parseResult = getAugmentSelectionSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        await deps.assertAugmentSelectionRequestContext({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          setIndex,
          statusMessage: 'Augment can only be requested during augmentSelection phase',
        })
        // 증강 선택 컨텍스트 검증 뒤에도 room 참가 여부를 한 번 더 확인
        if (!(await deps.isPlayerInRoom(roomId, playerId))) {
          throw new HttpsError('not-found', 'Player not found in room')
        }

        const playersSnapshot = await deps.db.collection('rooms').doc(roomId).collection('players').get()
        const playerIds = playersSnapshot.docs.map((doc) => doc.id).sort()
        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)

        // 같은 set에서 여러 플레이어가 동시에 들어와도 중복 생성이 덜 생기도록 트랜잭션 사용
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

          // rarity는 세트 단위 seed로 고정해서 모든 플레이어가 같은 희귀도를 공유하게 한다.
          const raritySeedKey = `augment-rarity|room:${roomId}|set:${setIndex}`
          const rarityRng = deps.createSeededRandom(raritySeedKey)
          const rarity = deps.pickRandomSeeded(deps.augmentRarities, rarityRng)
          const availableAugmentsByPlayer: Record<string, Augment[]> = {}

          // 선택지 목록은 플레이어별 seed로 만들어서 플레이어마다 다를 수 있다.
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
            status: 'augmentSelection',
            updatedAt: Timestamp.now(),
          }
          tx.set(setDocRef, nextDoc, { merge: true })
          return nextDoc
        })

        // 응답은 요청한 플레이어 기준 선택지만 내려준다.
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
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to get augment selection')
      }
    },
  )

  const selectAugment = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 플레이어가 고른 증강 1개를 확정하고, 전원이 고르면 racing 단계로 넘긴다.
        const parseResult = selectAugmentSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex, augmentId } = parseResult.data
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

        // 플레이어 문서에는 "이번 세트에 무슨 증강을 골랐는지" 이력 형태로 저장
        await playerRef.update({
          selectedAugments: FieldValue.arrayUnion({ setIndex, augmentId }),
          updatedAt: Timestamp.now(),
        })

        // 세트 문서에는 이번 세트 확정 선택 결과를 playerId -> augmentId 형태로 저장
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
          // 전원이 증강 선택을 끝냈을 때만 최종 스탯(행운 보너스 포함)을 계산해서 반영한다.
          const availableAugmentsByPlayer = setData?.availableAugmentsByPlayer ?? {}
          const batch = deps.db.batch()

          playersSnapshot.docs.forEach((doc) => {
            const playerData = doc.data() as Player
            const selectedId = nextSelections[doc.id]
            const augment = availableAugmentsByPlayer[doc.id]?.find((entry) => entry.id === selectedId)
            const persistentStats = deps.applyAugmentToHorseStats(playerData.horseStats, augment)
            if (!persistentStats) return

            // Luck 기반 보너스는 이 세트에서만 적용되도록 currentSetLuckBonus로 따로 저장
            const luckBonus = deps.calculateLuckBonus(persistentStats.Luck)
            const nextHorseStats = deps.applyLuckBonusToHorseStats(persistentStats, luckBonus)
            batch.update(doc.ref, {
              horseStats: nextHorseStats,
              currentSetLuckBonus: luckBonus,
              updatedAt: Timestamp.now(),
            })
          })

          await batch.commit()
          // 스탯 반영이 끝난 뒤에만 room 상태를 racing으로 바꾼다.
          await deps.updateRoomStatus(roomId, 'racing')
        }

        deps.logger.info('Augment selected', { roomId, playerId, setIndex, augmentId, allSelected })
        return { success: true }
      } catch (error) {
        deps.logger.error('selectAugment error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to select augment')
      }
    },
  )

  const rerollAugments = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 리롤 제한/현재 세트 컨텍스트를 확인한 뒤 선택지만 다시 만든다.
        const parseResult = rerollAugmentsSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        const room = await deps.assertAugmentSelectionRequestContext({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          setIndex,
          statusMessage: 'Augments can only be rerolled during augmentSelection phase',
        })
        if (!(await deps.isPlayerInRoom(roomId, playerId))) {
          throw new HttpsError('not-found', 'Player not found in room')
        }

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
        // 이미 선택을 확정한 뒤에는 리롤을 막는다.
        if (selections[playerId]) {
          throw new HttpsError('failed-precondition', 'Cannot reroll after augment is already selected')
        }

        const rerollUsed = playerData.rerollUsed ?? 0
        if (rerollUsed >= room.rerollLimit) {
          throw new HttpsError('resource-exhausted', 'No rerolls remaining for this player')
        }

        // rerollIndex를 seed에 포함해서 리롤 횟수마다 다른 결과가 나오게 한다.
        const rerollIndex = rerollUsed + 1
        const seedKey = `augment|room:${roomId}|set:${setIndex}|player:${playerId}|reroll:${rerollIndex}`
        const rng = deps.createSeededRandom(seedKey)
        const rarity = setData?.rarity ?? deps.pickRandomSeeded(deps.augmentRarities, rng)
        const newAugments = deps.generateServerAugmentChoices(rarity, rng, seedKey)

        // 플레이어 개인 리롤 횟수 + room 전체 리롤 횟수를 둘 다 올린다.
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
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to reroll augments')
      }
    },
  )

  return { selectHorse, getAugmentSelection, selectAugment, rerollAugments }
}
