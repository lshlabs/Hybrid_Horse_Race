/**
 * 개발용 최종 결과 페이지
 * 서버에서 넘어온 결과가 없을 때도 화면과 점수 계산을 확인할 수 있게 만든다.
 */

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
  finalRankings?: FinalRanking[] // 예전 전달 방식도 잠깐 같이 받기 위한 fallback
  roomId?: string
  playerId?: string
  playerName?: string
}

/**
 * 라운드 결과로 최종 순위를 계산한다.
 * 총점이 같으면 순위 횟수(1등 횟수, 2등 횟수...)로 다시 비교한다.
 */
function calculateFinalRankings(
  roundResults: Array<Array<RoundResult>>,
  playerCount: number,
): FinalRanking[] {
  // 플레이어별 총점과 순위 횟수를 같이 모아둔다.
  // 점수는 인원수 기준이라 1등이 가장 높은 점수를 받는다.
  const playerScores: Record<string, number> = {}
  const playerRankCounts: Record<string, Record<number, number>> = {} // 동점 비교할 때 사용

  roundResults.forEach((round) => {
    round.forEach((result) => {
      if (!playerScores[result.name]) {
        playerScores[result.name] = 0
        playerRankCounts[result.name] = {}
      }

      // 순위 점수 계산
      const score = playerCount - result.rank + 1
      playerScores[result.name] += score

      // 동점 처리용으로 순위 횟수도 같이 카운트한다.
      if (!playerRankCounts[result.name][result.rank]) {
        playerRankCounts[result.name][result.rank] = 0
      }
      playerRankCounts[result.name][result.rank]++
    })
  })

  // 최종 순위 정렬
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
      // 1) 총점 높은 순
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore

      // 2) 동점이면 1등 횟수 비교
      const aFirstCount = a.rankCounts[1] || 0
      const bFirstCount = b.rankCounts[1] || 0
      if (bFirstCount !== aFirstCount) return bFirstCount - aFirstCount

      // 3) 그래도 같으면 2등, 3등... 순서대로 많이 한 쪽 우선
      for (let rank = 2; rank <= playerCount; rank++) {
        const aCount = a.rankCounts[rank] || 0
        const bCount = b.rankCounts[rank] || 0
        if (bCount !== aCount) return bCount - aCount
      }

      // 4) 끝까지 같으면 마지막 세트 성적 비교
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

/**
 * Mock 라운드 결과 생성
 * 개발용으로 state 데이터가 없을 때도 결과 화면을 볼 수 있게 한다.
 */
function createMockRoundResults(
  playerCount: number = 4,
  roundCount: number = 3,
): Array<Array<RoundResult>> {
  // 이름은 먼저 만들고, 라운드마다 순위만 섞는다.
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

export function RaceResultPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isDev = true

  // RacePage에서 넘겨준 결과 데이터가 있으면 그걸 먼저 사용한다.
  const state = location.state as LocationState | null
  const roundResultsFromState = state?.roundResults
  const playerCountFromState = state?.playerCount
  const currentPlayerName = state?.playerName // 내 결과 행 강조용
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
    return room?.status === 'setResult' && hasFinalResultPayload
  }

  const handleRoomStatusRedirect = () => {
    if (!room) return

    if (room.status === 'waiting') {
      navigateWithRoomAndPlayer('/lobby')
      return
    }

    if (room.status === 'horseSelection') {
      navigateWithRoomAndPlayer('/horse-selection')
      return
    }

    if (shouldStayOnResultPageForSetResult()) {
      return
    }

    if (
      room.status === 'augmentSelection' ||
      room.status === 'racing' ||
      room.status === 'setResult'
    ) {
      navigateWithRoomAndPlayer('/race')
    }
  }

  // 개발용 페이지라 room 설정이 없을 때를 대비해서 localStorage 기본값도 같이 본다.
  const roomConfig = (() => {
    try {
      const saved = localStorage.getItem('dev_room_config')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (err) {
      console.warn('[RaceResultPageTest] Failed to load room config from localStorage:', err)
    }
    // 저장된 값이 없거나 읽기 실패하면 기본값 사용
    return {
      playerCount: 4,
      roundCount: 3,
      rerollLimit: 2,
    }
  })()

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

    console.warn('[RaceResultPageTest] No roundResults in location.state, using mock data')
    const mockRoundResults = createMockRoundResults(playerCount, roundCount)
    return calculateFinalRankings(mockRoundResults, playerCount)
  }

  // 최종 순위는 첫 렌더에서 한 번만 계산해서 고정한다.
  const [finalRankings] = useState<FinalRanking[]>(buildInitialFinalRankings)

  // 개발용 페이지라서 일반 동선에서는 막아둔다.
  if (!isDev) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-xl">이 페이지는 개발 모드에서만 사용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  // 순위 숫자 색상만 간단히 분리
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-amber-600'
    return 'text-foreground'
  }

  return (
    <div className="container mx-auto min-h-screen px-0 sm:px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* 결과 헤더 */}
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

        {/* 최종 순위 + 라운드별 기록 테이블 */}
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
                        <span className={clsx('font-bold', getRankColor(ranking.rank))}>
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
                                className={clsx(
                                  'font-bold',
                                  roundResult.rank === 1
                                    ? 'text-yellow-400'
                                    : roundResult.rank === 2
                                      ? 'text-gray-300'
                                      : roundResult.rank === 3
                                        ? 'text-amber-600'
                                        : 'text-foreground',
                                )}
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

        {/* 홈으로 돌아가기 버튼 */}
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
