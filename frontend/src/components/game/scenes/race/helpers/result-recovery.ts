import type { Player } from '../../../../../hooks/useRoom'
import type { Augment } from '../../../../../engine/race'
import type { RoundRankingEntry } from '../../../../../utils/raceRanking'

// authoritative 결과를 최종 결과 화면용 구조로 바꾸는 helper 모음
export type AuthoritativeSetRanking = {
  playerId: string
  name: string
  position: number
  time: number
  selectedAugments?: Augment[]
}

const DEFAULT_PLAYER_COUNT = 4

function createPlayerIndexMap(players: Player[]): Map<string, number> {
  return new Map(
    players
      .map((player, index) => (player.id ? [player.id, index] : null))
      .filter((entry): entry is [string, number] => entry !== null),
  )
}

function resolveHorseIndex(params: {
  playerIndexById: Map<string, number>
  playerId: string
  fallbackPosition: number
}): number {
  const horseIndex = params.playerIndexById.get(params.playerId) ?? -1
  return horseIndex >= 0 ? horseIndex : params.fallbackPosition - 1
}

export function hasAuthoritativeRoundResultContext(params: {
  roomId?: string
  playerId?: string
  sessionToken?: string
  roomJoinToken?: string | null
  hasRoom: boolean
}): boolean {
  return !!(
    params.roomId &&
    params.playerId &&
    params.sessionToken &&
    params.roomJoinToken &&
    params.hasRoom
  )
}

export function mapAuthoritativeRankingsToRoundEntries(params: {
  rankings: AuthoritativeSetRanking[]
  players: Player[]
}): RoundRankingEntry[] {
  const playerIndexById = createPlayerIndexMap(params.players)
  return params.rankings
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((entry) => {
      return {
        rank: entry.position,
        name: entry.name,
        time: entry.time,
        finished: true,
        augments: entry.selectedAugments ?? [],
        horseIndex: resolveHorseIndex({
          playerIndexById,
          playerId: entry.playerId,
          fallbackPosition: entry.position,
        }),
      }
    })
}

export function getMissingRoundResultIndexes(params: {
  roundResults: RoundRankingEntry[][]
  roundCount: number
}): number[] {
  const missing: number[] = []
  for (let setIndex = 1; setIndex <= params.roundCount; setIndex++) {
    if (!params.roundResults[setIndex - 1] || params.roundResults[setIndex - 1].length === 0) {
      missing.push(setIndex)
    }
  }
  return missing
}

export function resolveFinalResultBackfillAction(params: {
  missingRoundIndexes: number[]
  retryCount: number
  maxRetries: number
}): { type: 'complete' | 'retry' | 'proceedWithIncomplete' } {
  if (params.missingRoundIndexes.length === 0) {
    return { type: 'complete' }
  }
  if (params.retryCount < params.maxRetries) {
    return { type: 'retry' }
  }
  return { type: 'proceedWithIncomplete' }
}

export function buildRaceFinalResultEventDetail(params: {
  roundResults: RoundRankingEntry[][]
  players: Player[]
  playerId?: string
  roomId?: string
}): {
  roundResults: RoundRankingEntry[][]
  playerCount: number
  roomId?: string
  playerId?: string
  playerName?: string
} {
  const playerCount = params.players.length || DEFAULT_PLAYER_COUNT
  const currentPlayerName = params.players.find((p) => p.id === params.playerId)?.name

  return {
    roundResults: params.roundResults,
    playerCount,
    roomId: params.roomId,
    playerId: params.playerId,
    playerName: currentPlayerName,
  }
}
