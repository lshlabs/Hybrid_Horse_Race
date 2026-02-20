/**
 * 개발용 말 선택 테스트 페이지
 * Firebase 없이도 말 선택 기능을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /horse-selection 접근
 * 3. 말 선택 기능 테스트
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Info, ArrowLeftRight } from 'lucide-react'
import clsx from 'clsx'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts'
import { NeonCard } from '../components/ui/NeonCard'
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card'
import { Dialog, DialogContent } from '../components/ui/dialog'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../components/ui/chart'
import { generateRandomStats, normalizeStatNonLinear } from '../engine/race/stat-system'
import { DEFAULT_MAX_STAT, DEFAULT_SATURATION_RATE } from '../engine/race/constants'
import type { Stats } from '../engine/race/types'
import { formatNickname, type NicknameData } from '../utils/nickname-generator'

// 말 이름 키 풀 (랜덤 선택용)
const HORSE_NAME_KEYS = [
  'whirlwind',
  'mir',
  'afterglow',
  'wing',
  'gale',
  'blueCloud',
  'lightning',
  'morningStar',
  'whiteSnow',
  'summit',
  'galaxy',
  'soar',
  'sun',
  'torrent',
  'thunder',
]

interface HorseCandidate {
  id: string
  nameKey: string // 번역 키 저장
  stats: Stats
}

const MAX_REROLLS = 3

interface SavedHorseData {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

/**
 * 새로운 말 후보 3마리 생성
 */
function createNewCandidates(): HorseCandidate[] {
  const newCandidates: HorseCandidate[] = []
  const usedNameKeys = new Set<string>()

  for (let i = 0; i < 3; i++) {
    const stats = generateRandomStats()

    // 중복되지 않는 이름 키 선택
    let nameKey: string
    let attempts = 0
    do {
      const nameIndex = Math.floor(Math.random() * HORSE_NAME_KEYS.length)
      nameKey = HORSE_NAME_KEYS[nameIndex]
      attempts++
    } while (usedNameKeys.has(nameKey) && attempts < 10)

    usedNameKeys.add(nameKey)

    newCandidates.push({
      id: `horse-${Date.now()}-${i}`,
      nameKey, // 번역 키만 저장
      stats,
    })
  }

  return newCandidates
}

export function HorseSelectionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDev = true

  const roomId = searchParams.get('roomId')
  const playerId = searchParams.get('playerId') || localStorage.getItem('dev_player_id') || ''

  // 게임 설정을 localStorage에서 가져오기 (개선 사항 3)
  const roomConfig = (() => {
    try {
      const saved = localStorage.getItem('dev_room_config')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (err) {
      console.warn('[HorseSelectionPageTest] Failed to load room config from localStorage:', err)
    }
    // 기본값
    return {
      playerCount: 2,
      roundCount: 3,
      rerollLimit: 2,
    }
  })()

  const playerCount = roomConfig.playerCount
  const roundCount = roomConfig.roundCount
  const rerollLimit = roomConfig.rerollLimit

  const [candidates, setCandidates] = useState<HorseCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rerollsUsed, setRerollsUsed] = useState(0)
  const [selectedHorse, setSelectedHorse] = useState<SavedHorseData | null>(null)
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true)
  const [isStatChartDialogOpen, setIsStatChartDialogOpen] = useState(false)
  const [useRadarChart, setUseRadarChart] = useState(true) // true: RadarChart, false: Grid with bars

  useEffect(() => {
    if (!isDev) {
      navigate('/')
    }
  }, [isDev, navigate])

  // LobbyPageTest에서 전달된 데이터 확인 및 로그 출력
  useEffect(() => {
    if (!isDev) return

    // 데이터가 없으면 경고
    if (!roomId) {
      console.warn('[HorseSelectionPageTest] No roomId received from LobbyPageTest')
    }
  }, [isDev, roomId, playerId])

  // 초기 말 후보 생성
  useEffect(() => {
    if (candidates.length === 0) {
      setCandidates(createNewCandidates())
    }
  }, [candidates.length])

  // localStorage에서 선택한 말 데이터 확인 (개선 사항 4: playerId 기준 구조)
  useEffect(() => {
    if (!isDev || !playerId) return

    const checkSavedHorse = () => {
      try {
        const saved = localStorage.getItem('dev_selected_horses')
        if (saved) {
          const horsesData = JSON.parse(saved) as Record<string, SavedHorseData>
          if (horsesData[playerId]) {
            setSelectedHorse(horsesData[playerId])
          }
        }
      } catch (err) {
        console.warn('[HorseSelectionPageTest] Failed to read from localStorage:', err)
      }
    }

    checkSavedHorse()

    // localStorage 변경 감지
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dev_selected_horses') {
        checkSavedHorse()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 주기적으로 확인 (같은 탭에서 변경된 경우)
    const interval = setInterval(checkSavedHorse, 500)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [isDev, playerId])

  // 리롤 처리
  const handleReroll = () => {
    if (rerollsUsed >= MAX_REROLLS) {
      setError(t('horseSelection.rerollMaxError', { count: MAX_REROLLS }))
      return
    }

    setCandidates(createNewCandidates())
    setSelectedIndex(null)
    setRerollsUsed((prev) => prev + 1)
    setError(null)
  }

  // 스탯 총합 계산
  const getTotalStats = (stats: Stats): number => {
    return stats.Speed + stats.Stamina + stats.Power + stats.Guts + stats.Start + stats.Luck
  }

  // RadarChart 데이터 생성
  const getRadarChartData = (stats: Stats) => {
    return [
      { stat: t('statsShort.speed'), value: stats.Speed },
      { stat: t('statsShort.stamina'), value: stats.Stamina },
      { stat: t('statsShort.power'), value: stats.Power },
      { stat: t('statsShort.guts'), value: stats.Guts },
      { stat: t('statsShort.start'), value: stats.Start },
      { stat: t('statsShort.luck'), value: stats.Luck },
    ]
  }

  // RadarChart 설정
  const getStatChartConfig = () => {
    return {
      value: {
        label: '',
        color: 'hsl(217 91% 60%)', // Tailwind Blue
      },
    } satisfies ChartConfig
  }

  // 능력치 수치에 따른 색상 반환 (GUIManager.ts와 동일한 로직)
  const getStatColor = (value: number): string => {
    if (value < 11) {
      return '#9ca3af' // 회색 (낮음: 0~10)
    } else if (value < 14) {
      return '#10b981' // 초록색 (보통: 11~13)
    } else if (value < 18) {
      return '#eab308' // 노란색 (좋음: 14~17)
    } else {
      return '#f87171' // 빨간색 (높음: 18~20)
    }
  }

  // 비선형 정규화 차트 데이터 생성
  const getStatChartData = () => {
    const data: Array<{ stat: number; normalized: number; linear: number }> = []
    for (let stat = 0; stat <= DEFAULT_MAX_STAT; stat += 1) {
      const normalized = normalizeStatNonLinear(stat, DEFAULT_MAX_STAT, DEFAULT_SATURATION_RATE)
      const linear = stat / DEFAULT_MAX_STAT // 선형 비교용
      data.push({ stat, normalized, linear })
    }
    return data
  }

  const chartConfig = {
    normalized: {
      label: '비선형 정규화',
      color: 'hsl(var(--chart-1))',
    },
    linear: {
      label: '선형 정규화',
      color: 'hsl(var(--muted-foreground))',
    },
  } satisfies ChartConfig

  // 확인 처리 (Mock)
  const handleConfirm = async () => {
    if (selectedIndex == null || isSubmitting) return

    if (!roomId) {
      setError(t('horseSelection.roomIdMissing'))
      return
    }

    if (!playerId) {
      setError('playerId가 필요합니다.')
      return
    }

    const selectedHorseCandidate = candidates[selectedIndex]
    setError(null)
    setIsSubmitting(true)

    // Mock: 약간의 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      const totalStats = getTotalStats(selectedHorseCandidate.stats)
      const horseData: SavedHorseData = {
        name: t(`horseNames.${selectedHorseCandidate.nameKey}`), // 번역된 이름 저장
        stats: selectedHorseCandidate.stats,
        totalStats,
        selectedAt: new Date().toISOString(),
      }

      // localStorage에 저장 (개선 사항 4: playerId 기준 구조)
      try {
        const saved = localStorage.getItem('dev_selected_horses')
        const horsesData = saved ? JSON.parse(saved) : {}
        horsesData[playerId] = horseData

        // 모든 플레이어의 능력치 생성 (다른 플레이어들은 랜덤 생성)
        const playerIds: string[] = JSON.parse(localStorage.getItem('dev_player_ids') || '[]')
        const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
          localStorage.getItem('dev_player_nickname_data') || '{}',
        )
        const customNames: Record<string, string> = JSON.parse(
          localStorage.getItem('dev_player_custom_names') || '{}',
        )

        playerIds.forEach((id) => {
          if (id !== playerId && !horsesData[id]) {
            // 다른 플레이어의 이름 가져오기 (커스텀 이름 우선)
            const playerName =
              customNames[id] ||
              (nicknameDataMap[id] ? formatNickname(nicknameDataMap[id]) : `플레이어 ${id}`)

            // 다른 플레이어의 능력치는 랜덤 생성
            const randomStats = generateRandomStats()
            const randomTotalStats = Object.values(randomStats).reduce((sum, val) => sum + val, 0)
            horsesData[id] = {
              name: playerName,
              stats: randomStats,
              totalStats: randomTotalStats,
              selectedAt: new Date().toISOString(),
            }
          }
        })

        localStorage.setItem('dev_selected_horses', JSON.stringify(horsesData))
      } catch (err) {
        console.warn('[HorseSelectionPageTest] Failed to save horse data:', err)
      }

      setSelectedHorse(horseData)

      // 성공하면 자동으로 다음 페이지로 이동 (roomId와 playerId만 전달)
      const params = new URLSearchParams({ roomId, playerId })
      navigate(`/race?${params.toString()}`)
    } catch (err) {
      console.error('Failed to select horse:', err)
      const errorMessage = err instanceof Error ? err.message : t('horseSelection.selectFailed')
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

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
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      {/* 개발용 안내 */}
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
              <h2 className="text-lg font-bold">🧪 말 선택 테스트 모드</h2>
              <button
                onClick={() => setIsBannerCollapsed(true)}
                className="ml-4 rounded bg-gray-700/50 px-3 py-1 text-sm transition hover:bg-gray-700/70"
                aria-label="배너 접기"
              >
                ▲
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              {roomId && (
                <div>
                  <span className="text-gray-400">Room ID: </span>
                  <span className="font-mono">{roomId}</span>
                </div>
              )}
              {playerId && (
                <div>
                  <span className="text-gray-400">Player ID: </span>
                  <span className="font-mono">{playerId}</span>
                </div>
              )}
              <div>
                <span className="text-gray-400">설정: </span>
                <span className="font-mono">
                  {playerCount}명 / {roundCount}라운드 / 리롤 {rerollLimit}회
                </span>
              </div>
              {!roomId && (
                <div className="rounded bg-yellow-600/20 px-3 py-1 border border-yellow-500/40">
                  <span className="text-yellow-400">⚠️ roomId가 전달되지 않았습니다.</span>
                </div>
              )}
              {selectedHorse && (
                <div className="flex items-center gap-2 rounded bg-green-600/20 px-3 py-1 border border-green-500/40">
                  <span className="text-green-400">✓ 선택됨:</span>
                  <span className="font-mono text-green-300">{selectedHorse.name}</span>
                </div>
              )}
              <button
                onClick={() => navigate('/')}
                className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
              >
                🔄 처음부터 다시 테스트
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 독립적으로 구현한 말 선택 UI */}
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="w-full max-w-6xl rounded-3xl border border-white/10 bg-surface/80 p-8 shadow-surface backdrop-blur-lg">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.45em] text-primary/70">
              {t('horseSelection.title')}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-display text-foreground">
                  {t('horseSelection.headline')}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsStatChartDialogOpen(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="능력치 비선형 차트 보기"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setUseRadarChart((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
                aria-label="UI 스타일 전환"
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {useRadarChart ? '그리드 보기' : '차트 보기'}
                </span>
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t('horseSelection.subtitle', { count: MAX_REROLLS })}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* 말 선택 카드 (3개) */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate, index) => {
              const isSelected = selectedIndex === index

              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  disabled={isSubmitting}
                  className={clsx(
                    'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]',
                    isSubmitting && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <NeonCard
                    accent={index === 0 ? 'primary' : index === 1 ? 'accent' : 'success'}
                    title={t(`horseNames.${candidate.nameKey}`)}
                    className={clsx(
                      'border border-white/10 relative',
                      isSelected ? 'ring-2 ring-primary' : 'ring-1 ring-white/10',
                    )}
                  >
                    {/* 구분선 */}
                    <div className="border-t border-border/50" />

                    {/* 카드 플립 컨테이너 */}
                    <div
                      className="relative w-full flex-1 flex items-center justify-center"
                      style={{ perspective: '1000px' }}
                    >
                      <div
                        className="relative w-full h-full transition-transform duration-500"
                        style={{
                          transformStyle: 'preserve-3d',
                          transform: useRadarChart ? 'rotateY(0deg)' : 'rotateY(180deg)',
                        }}
                      >
                        {/* 앞면: RadarChart */}
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(0deg)',
                          }}
                        >
                          <ChartContainer
                            config={getStatChartConfig()}
                            className="mx-auto aspect-[4/3] w-full h-full"
                          >
                            <RadarChart data={getRadarChartData(candidate.stats)}>
                              <ChartTooltip
                                cursor={false}
                                content={
                                  <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name, props) => {
                                      const statName = props.payload?.stat || name
                                      return (
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">{statName}</span>
                                          <span className="font-mono font-medium tabular-nums text-foreground">
                                            {value}
                                          </span>
                                        </div>
                                      )
                                    }}
                                  />
                                }
                              />
                              <PolarAngleAxis dataKey="stat" />
                              <PolarGrid />
                              <PolarRadiusAxis domain={[0, 20]} tick={false} axisLine={false} />
                              <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.6} />
                            </RadarChart>
                          </ChartContainer>
                        </div>

                        {/* 뒷면: 2열 3행 그리드 */}
                        <div
                          className="absolute inset-0 w-full flex items-center justify-center"
                          style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                          }}
                        >
                          <div className="grid grid-cols-2 gap-4 w-full mx-auto">
                            {[
                              {
                                key: 'Speed',
                                label: t('stats.speed'),
                                value: candidate.stats.Speed,
                              },
                              {
                                key: 'Stamina',
                                label: t('stats.stamina'),
                                value: candidate.stats.Stamina,
                              },
                              {
                                key: 'Power',
                                label: t('stats.power'),
                                value: candidate.stats.Power,
                              },
                              {
                                key: 'Guts',
                                label: t('stats.guts'),
                                value: candidate.stats.Guts,
                              },
                              {
                                key: 'Start',
                                label: t('stats.start'),
                                value: candidate.stats.Start,
                              },
                              {
                                key: 'Luck',
                                label: t('stats.luck'),
                                value: candidate.stats.Luck,
                              },
                            ].map((stat) => {
                              const statColor = getStatColor(stat.value)
                              const maxStat = 20
                              const percentage = Math.min((stat.value / maxStat) * 100, 100)

                              return (
                                <div key={stat.key} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="text-muted-foreground">{stat.label}</span>
                                    <span
                                      className="font-mono font-medium tabular-nums"
                                      style={{ color: statColor }}
                                    >
                                      {Math.round(stat.value)}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full transition-all duration-300"
                                      style={{
                                        width: `${percentage}%`,
                                        backgroundColor: statColor,
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </NeonCard>
                </button>
              )
            })}
          </div>

          {/* 리롤 및 확인 버튼 */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReroll}
              disabled={rerollsUsed >= MAX_REROLLS || isSubmitting}
              className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('horseSelection.rerollCount', { used: rerollsUsed, max: MAX_REROLLS })}
            </button>
            <button
              type="button"
              disabled={selectedIndex == null || isSubmitting}
              onClick={handleConfirm}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted-foreground"
            >
              {isSubmitting ? t('horseSelection.processing') : t('horseSelection.confirm')}
            </button>
          </div>
        </div>
      </div>

      {/* 능력치 비선형 차트 다이얼로그 */}
      <Dialog open={isStatChartDialogOpen} onOpenChange={setIsStatChartDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border-none bg-surface [&>button]:hidden">
          <Card className="border-none bg-surface">
            <CardHeader>
              <CardDescription className="text-center">
                능력치는 로그스케일로 정규화됩니다. 초반에는 급격히 증가하고, 후반에는 완만하게
                증가합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-surface">
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={getStatChartData()}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="stat"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    ticks={[0, 10, 20, 30, 40]}
                    tickFormatter={(value) => value.toString()}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="normalized"
                    type="natural"
                    fill="var(--color-normalized)"
                    fillOpacity={0.4}
                    stroke="var(--color-normalized)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
            <CardContent>
              <p className="text-xs text-muted-foreground text-center">
                <strong className="text-foreground">
                  능력치는 수치가 높아질수록 효율이 감소합니다. 여러 능력치를 골고루 배분하는 것이
                  승리에 도움이 됩니다.
                </strong>
              </p>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  )
}
