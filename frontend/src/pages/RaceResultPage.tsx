import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy, Home } from 'lucide-react'
import { NeonCard } from '../components/ui/NeonCard'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { generateNickname } from '../utils/nickname-generator'
import clsx from 'clsx'
import { useRoom } from '../hooks/useRoom'

interface RoundResult {
  rank: number
  name: string
  time: number
  finished: boolean
  augments?: unknown[]
}

interface FinalRanking {
  rank: number
  name: string
  totalScore: number
  roundResults: Array<RoundResult | null>
}

interface LocationState {
  roundResults?: Array<Array<RoundResult>>
  playerCount?: number
  finalRankings?: FinalRanking[]
  roomId?: string
  playerId?: string
  playerName?: string
}

type DevRoomConfig = {
  playerCount: number
  roundCount: number
}

const DEFAULT_ROOM_CONFIG: DevRoomConfig = {
  playerCount: 4,
  roundCount: 3,
}
const ROOM_STATUS_WAITING = 'waiting'
const ROOM_STATUS_HORSE_SELECTION = 'horseSelection'
const ROOM_STATUS_AUGMENT_SELECTION = 'augmentSelection'
const ROOM_STATUS_RACING = 'racing'
const ROOM_STATUS_SET_RESULT = 'setResult'
const RANK_COLOR_CLASS_MAP: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
}

function getRankColorClass(rank: number): string {
  return RANK_COLOR_CLASS_MAP[rank] ?? 'text-foreground'
}

function calculateFinalRankings(
  roundResults: Array<Array<RoundResult>>,
  playerCount: number,
): FinalRanking[] {
  const playerScores: Record<string, number> = {}
  const playerRankCounts: Record<string, Record<number, number>> = {}

  roundResults.forEach((round) => {
    round.forEach((result) => {
      if (!playerScores[result.name]) {
        playerScores[result.name] = 0
        playerRankCounts[result.name] = {}
      }

      const score = playerCount - result.rank + 1
      playerScores[result.name] += score

      if (!playerRankCounts[result.name][result.rank]) {
        playerRankCounts[result.name][result.rank] = 0
      }
      playerRankCounts[result.name][result.rank]++
    })
  })

  const finalRankings = Object.keys(playerScores)
    .map((name) => {
      const lastRoundRank =
        roundResults[roundResults.length - 1]?.find((r) => r.name === name)?.rank || 999
      return {
        name,
        totalScore: playerScores[name],
        rankCounts: playerRankCounts[name],
        lastRoundRank,
      }
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore

      const aFirstCount = a.rankCounts[1] || 0
      const bFirstCount = b.rankCounts[1] || 0
      if (bFirstCount !== aFirstCount) return bFirstCount - aFirstCount

      for (let rank = 2; rank <= playerCount; rank++) {
        const aCount = a.rankCounts[rank] || 0
        const bCount = b.rankCounts[rank] || 0
        if (bCount !== aCount) return bCount - aCount
      }

      return a.lastRoundRank - b.lastRoundRank
    })
    .map((result, index) => ({
      rank: index + 1,
      name: result.name,
      totalScore: result.totalScore,
      roundResults: roundResults.map((round) => round.find((r) => r.name === result.name) || null),
    }))

  return finalRankings
}

function createMockRoundResults(
  playerCount: number = 4,
  roundCount: number = 3,
): Array<Array<RoundResult>> {
  const playerNames = Array.from({ length: playerCount }, () => generateNickname())
  const roundResults: Array<Array<RoundResult>> = []

  for (let round = 0; round < roundCount; round++) {
    const roundRankings: RoundResult[] = []
    const shuffledNames = [...playerNames].sort(() => Math.random() - 0.5)

    for (let i = 0; i < playerCount; i++) {
      roundRankings.push({
        rank: i + 1,
        name: shuffledNames[i],
        time: 10 + Math.random() * 5,
        finished: true,
      })
    }
    roundResults.push(roundRankings)
  }

  return roundResults
}

function readRoomConfig(): DevRoomConfig {
  try {
    const saved = localStorage.getItem('dev_room_config')
    if (!saved) return DEFAULT_ROOM_CONFIG
    const parsed = JSON.parse(saved) as Partial<DevRoomConfig>
    return {
      playerCount:
        typeof parsed.playerCount === 'number'
          ? parsed.playerCount
          : DEFAULT_ROOM_CONFIG.playerCount,
      roundCount:
        typeof parsed.roundCount === 'number' ? parsed.roundCount : DEFAULT_ROOM_CONFIG.roundCount,
    }
  } catch {
    return DEFAULT_ROOM_CONFIG
  }
}

export function RaceResultPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isDev = import.meta.env.DEV

  const state = location.state as LocationState | null
  const roundResultsFromState = state?.roundResults
  const playerCountFromState = state?.playerCount
  const currentPlayerName = state?.playerName
  const roomId = state?.roomId ?? searchParams.get('roomId') ?? null
  const playerId =
    state?.playerId ?? searchParams.get('playerId') ?? localStorage.getItem('dev_player_id') ?? ''
  const { room, loading } = useRoom(roomId)
  const hasFinalResultPayload =
    !!(state?.roundResults && state.roundResults.length > 0) ||
    !!(state?.finalRankings && state.finalRankings.length > 0)

  const navigateWithRoomAndPlayer = (pathname: '/lobby' | '/horse-selection' | '/race') => {
    const params = new URLSearchParams({ roomId: roomId ?? '', playerId })
    navigate(`${pathname}?${params.toString()}`, { replace: true })
  }

  const shouldStayOnResultPageForSetResult = (): boolean => {
    return room?.status === ROOM_STATUS_SET_RESULT && hasFinalResultPayload
  }

  const handleRoomStatusRedirect = () => {
    if (!room) return

    if (room.status === ROOM_STATUS_WAITING) {
      navigateWithRoomAndPlayer('/lobby')
      return
    }

    if (room.status === ROOM_STATUS_HORSE_SELECTION) {
      navigateWithRoomAndPlayer('/horse-selection')
      return
    }

    if (shouldStayOnResultPageForSetResult()) {
      return
    }

    if (
      room.status === ROOM_STATUS_AUGMENT_SELECTION ||
      room.status === ROOM_STATUS_RACING ||
      room.status === ROOM_STATUS_SET_RESULT
    ) {
      navigateWithRoomAndPlayer('/race')
    }
  }

  const roomConfig = readRoomConfig()

  const playerCount = playerCountFromState || roomConfig.playerCount
  const roundCount = room?.roundCount ?? roomConfig.roundCount

  useEffect(() => {
    if (!roomId) {
      navigate('/', { replace: true })
      return
    }
    if (!loading && !room) {
      navigate('/', { replace: true })
      return
    }
    handleRoomStatusRedirect()
  }, [hasFinalResultPayload, loading, navigate, playerId, room, roomId])

  const buildInitialFinalRankings = (): FinalRanking[] => {
    if (roundResultsFromState && roundResultsFromState.length > 0) {
      return calculateFinalRankings(roundResultsFromState, playerCount)
    }

    if (state?.finalRankings && state.finalRankings.length > 0) {
      return state.finalRankings
    }

    const mockRoundResults = createMockRoundResults(playerCount, roundCount)
    return calculateFinalRankings(mockRoundResults, playerCount)
  }

  const [finalRankings] = useState<FinalRanking[]>(buildInitialFinalRankings)

  if (!isDev) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-xl">이 페이지는 개발 모드에서만 사용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto min-h-screen px-0 sm:px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <Trophy className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-400" />
          </div>
          <h1 className="mb-2 text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            {t('raceResult.title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('raceResult.subtitle', { count: roundCount })}
          </p>
        </div>

        <NeonCard accent="primary" className="mb-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-[10px] sm:text-sm md:text-base">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-left font-semibold text-muted-foreground">
                    {t('raceResult.rank')}
                  </th>
                  <th className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-left font-semibold text-muted-foreground">
                    {t('raceResult.name')}
                  </th>
                  <th className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-center font-semibold text-muted-foreground">
                    {t('raceResult.totalScore')}
                  </th>
                  {Array.from({ length: roundCount }).map((_, index) => (
                    <th
                      key={index}
                      className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-center font-semibold text-muted-foreground"
                    >
                      {t('raceResult.round', { number: index + 1 })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {finalRankings.map((ranking) => {
                  const isCurrentPlayer = currentPlayerName && currentPlayerName === ranking.name
                  return (
                    <tr
                      key={ranking.name}
                      className={clsx(
                        'border-b border-border/50 transition-colors hover:bg-muted/30',
                        isCurrentPlayer && 'bg-primary/10 ring-2 ring-primary ring-inset',
                      )}
                    >
                      <td className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3">
                        <span className={clsx('font-bold', getRankColorClass(ranking.rank))}>
                          #{ranking.rank}
                        </span>
                      </td>
                      <td className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 font-semibold text-foreground">
                        <span className="block max-w-[60px] sm:max-w-[100px] md:max-w-none truncate">
                          {ranking.name}
                        </span>
                      </td>
                      <td className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-center">
                        <Badge
                          variant="secondary"
                          className="text-[9px] sm:text-xs md:text-sm px-1 sm:px-1.5 md:px-2"
                        >
                          {t('raceResult.points', { score: ranking.totalScore })}
                        </Badge>
                      </td>
                      {ranking.roundResults.map((roundResult, roundIndex) => (
                        <td
                          key={roundIndex}
                          className="px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-center"
                        >
                          {roundResult ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={clsx('font-bold', getRankColorClass(roundResult.rank))}
                              >
                                #{roundResult.rank}
                              </span>
                              <span className="text-[9px] sm:text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                                {roundResult.finished
                                  ? t('raceResult.seconds', { time: roundResult.time.toFixed(2) })
                                  : t('raceResult.dnf')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </NeonCard>

        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate('/')} variant="outline" size="lg">
            <Home className="mr-2 h-4 w-4" />
            {t('raceResult.backToHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
