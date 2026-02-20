/**
 * 개발용 레이스 최종 결과 페이지 테스트
 * Firebase 없이도 최종 결과 페이지를 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /race-result-test 접근
 * 3. 최종 결과 페이지 테스트 (Mock 데이터 사용)
 */

import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy, Home } from 'lucide-react'
import { NeonCard } from '../../components/ui/NeonCard'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { generateNickname } from '../../utils/nickname-generator'
import { clearDevTestStorage } from '../../lib/dev-storage'
import clsx from 'clsx'

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
  finalRankings?: FinalRanking[] // fallback용 (이전 버전 호환)
  roomId?: string
  playerId?: string
  playerName?: string
}

/**
 * 라운드 결과로부터 최종 순위 계산
 */
function calculateFinalRankings(
  roundResults: Array<Array<RoundResult>>,
  playerCount: number,
): FinalRanking[] {
  // 플레이어별 총 점수 계산
  // 점수 체계: N명이 뛰면 1등=N점, 2등=N-1점, ..., 꼴찌=1점
  const playerScores: Record<string, number> = {}
  const playerRankCounts: Record<string, Record<number, number>> = {} // 각 플레이어의 순위별 횟수

  roundResults.forEach((round) => {
    round.forEach((result) => {
      if (!playerScores[result.name]) {
        playerScores[result.name] = 0
        playerRankCounts[result.name] = {}
      }

      // 순위에 따른 점수 부여: 1등=playerCount점, 2등=playerCount-1점, ..., 꼴찌=1점
      const score = playerCount - result.rank + 1
      playerScores[result.name] += score

      // 순위별 횟수 카운트
      if (!playerRankCounts[result.name][result.rank]) {
        playerRankCounts[result.name][result.rank] = 0
      }
      playerRankCounts[result.name][result.rank]++
    })
  })

  // 최종 순위 계산
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
      // 1. 총 점수 높은 순
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore

      // 2. 동점이면 1등 횟수 비교
      const aFirstCount = a.rankCounts[1] || 0
      const bFirstCount = b.rankCounts[1] || 0
      if (bFirstCount !== aFirstCount) return bFirstCount - aFirstCount

      // 3. 같으면 2등 횟수, 그다음 3등 횟수... (더 높은 순위를 더 많이 한 쪽)
      for (let rank = 2; rank <= playerCount; rank++) {
        const aCount = a.rankCounts[rank] || 0
        const bCount = b.rankCounts[rank] || 0
        if (bCount !== aCount) return bCount - aCount
      }

      // 4. 그래도 같으면 마지막 세트 순위가 더 높은 사람
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
 * Mock 라운드 결과 데이터 생성 (nickname-generator 사용)
 */
function createMockRoundResults(
  playerCount: number = 4,
  roundCount: number = 3,
): Array<Array<RoundResult>> {
  // 랜덤 닉네임 생성
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

export function RaceResultPageTest() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isDev = import.meta.env.DEV

  // location.state에서 전달된 데이터 확인 (RacePageTest에서 전달된 경우)
  const state = location.state as LocationState | null
  const roundResultsFromState = state?.roundResults
  const playerCountFromState = state?.playerCount
  const currentPlayerName = state?.playerName // 하이라이트용
  const roomId = state?.roomId || searchParams.get('roomId') || 'test-room-123'

  // 게임 설정을 localStorage에서 가져오기
  const roomConfig = (() => {
    try {
      const saved = localStorage.getItem('dev_room_config')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (err) {
      console.warn('[RaceResultPageTest] Failed to load room config from localStorage:', err)
    }
    // 기본값
    return {
      playerCount: 4,
      roundCount: 3,
      rerollLimit: 2,
    }
  })()

  const playerCount = playerCountFromState || roomConfig.playerCount
  const roundCount = roomConfig.roundCount

  // 최종 순위 계산 (라운드 결과로부터)
  const [finalRankings] = useState<FinalRanking[]>(() => {
    // 1. roundResults가 있으면 최종 순위 계산
    if (roundResultsFromState && roundResultsFromState.length > 0) {
      return calculateFinalRankings(roundResultsFromState, playerCount)
    }

    // 2. fallback: 이전 버전 호환 (finalRankings 직접 전달)
    if (state?.finalRankings && state.finalRankings.length > 0) {
      return state.finalRankings
    }

    // 3. Mock 데이터 생성 (직접 접근 또는 테스트 목적)
    console.warn('[RaceResultPageTest] No roundResults in location.state, using mock data')
    const mockRoundResults = createMockRoundResults(playerCount, roundCount)
    return calculateFinalRankings(mockRoundResults, playerCount)
  })
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true)

  // Mock 데이터 사용 여부 표시
  const isUsingMockData = !roundResultsFromState && !state?.finalRankings

  // 개발 모드 확인
  if (!isDev) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-xl">이 페이지는 개발 모드에서만 사용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  // 순위 색상
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-amber-600'
    return 'text-foreground'
  }

  return (
    <div className="container mx-auto min-h-screen px-0 sm:px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* 개발용 컨트롤 패널 */}
        {isBannerCollapsed ? (
          /* 접었을 때: 펼치기 버튼만 표시 */
          <button
            onClick={() => setIsBannerCollapsed(false)}
            className="fixed top-2 left-2 z-50 rounded-lg bg-black/80 px-3 py-2 text-white backdrop-blur-sm transition hover:bg-black/90 shadow-lg"
            aria-label="배너 펼치기"
          >
            <span className="text-sm">▼ 개발 배너</span>
          </button>
        ) : (
          /* 펼쳤을 때: 전체 배너 표시 */
          <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 p-4 text-white">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">🧪 최종 결과 페이지 테스트 모드</h2>
                <button
                  onClick={() => setIsBannerCollapsed(true)}
                  className="ml-4 rounded bg-gray-700/50 px-3 py-1 text-sm transition hover:bg-gray-700/70"
                  aria-label="배너 접기"
                >
                  ▲
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-400">플레이어 수: </span>
                  <span className="font-mono">{playerCount}명</span>
                </div>
                <div>
                  <span className="text-gray-400">라운드 수: </span>
                  <span className="font-mono">{roundCount}</span>
                </div>
                <div>
                  <span className="text-gray-400">Room ID: </span>
                  <span className="font-mono">{roomId}</span>
                </div>
                {isUsingMockData && (
                  <div className="rounded bg-yellow-600/20 px-3 py-1 border border-yellow-500/40">
                    <span className="text-yellow-400">⚠️ Mock 데이터 사용 중</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    window.location.reload()
                  }}
                  className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
                >
                  🔄 데이터 새로고침
                </button>
                <button
                  onClick={() => {
                    clearDevTestStorage()
                    navigate('/landing-test')
                  }}
                  className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
                >
                  🔄 처음부터 다시 테스트
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 */}
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

        {/* 상세 결과 테이블 */}
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

        {/* 액션 버튼 */}
        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate('/landing-test')} variant="outline" size="lg">
            <Home className="mr-2 h-4 w-4" />
            {t('raceResult.backToHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
