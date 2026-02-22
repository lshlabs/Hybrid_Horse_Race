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

export function hasAuthoritativeRoundResultContext(params: {
  roomId?: string
  playerId?: string
  sessionToken?: string
  roomJoinToken?: string | null
  hasRoom: boolean
}): boolean {
  // 최종 결과 backfill 호출에 필요한 최소 컨텍스트가 있는지 확인
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
  // 서버 결과(position/time)를 결과 화면에서 쓰는 RoundRankingEntry 형태로 변환
  return params.rankings
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((entry) => {
      const horseIndex = params.players.findIndex((player) => player.id === entry.playerId)
      return {
        rank: entry.position,
        name: entry.name,
        time: entry.time,
        finished: true,
        augments: entry.selectedAugments ?? [],
        horseIndex: horseIndex >= 0 ? horseIndex : entry.position - 1,
      }
    })
}

export function getMissingRoundResultIndexes(params: {
  roundResults: RoundRankingEntry[][]
  roundCount: number
}): number[] {
  // 라운드 수 기준으로 비어있는 결과 세트 인덱스를 찾는다.
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
  // 누락 라운드가 있으면 retry 횟수 안에서 재시도하고,
  // 끝까지 못 채우면 불완전 결과로라도 진행한다.
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
  // 결과 씬/페이지로 넘기는 이벤트 payload 공통 형태
  const playerCount = params.players.length || 4
  const currentPlayerName = params.players.find((p) => p.id === params.playerId)?.name

  return {
    roundResults: params.roundResults,
    playerCount,
    roomId: params.roomId,
    playerId: params.playerId,
    playerName: currentPlayerName,
  }
}
