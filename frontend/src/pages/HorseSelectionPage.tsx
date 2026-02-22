/**
 * 개발용 말 선택 페이지
 * 서버 호출이 실패해도 local fallback으로 화면 흐름을 테스트할 수 있게 만든다.
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
import { useRoom, type Player } from '../hooks/useRoom'
import { selectHorse as selectHorseCallable } from '../lib/firebase-functions'
import { getGuestSession } from '../lib/user-id'
import { getRoomJoinToken } from '../lib/room-join-token'

// 후보 말 생성 시 사용할 이름 번역 키 목록
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
  nameKey: string // 실제 이름 대신 번역 키를 저장해두고 렌더할 때 번역한다.
  stats: Stats
}

interface SavedHorseData {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

interface HorseConfirmParams {
  roomId: string
  playerId: string
  sessionToken: string
  roomJoinToken: string
}

/**
 * 새로운 말 후보 3마리 생성
 * 이름은 중복되지 않게 뽑고, 능력치는 랜덤 생성 함수를 사용한다.
 */
function createNewCandidates(): HorseCandidate[] {
  const newCandidates: HorseCandidate[] = []
  const usedNameKeys = new Set<string>()

  for (let i = 0; i < 3; i++) {
    const stats = generateRandomStats()

    // 이름이 겹치면 다시 뽑는다. (너무 오래 돌지 않게 시도 횟수 제한)
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
      nameKey, // 언어가 바뀌어도 다시 번역할 수 있게 키만 저장
      stats,
    })
  }

  return newCandidates
}

function readDevSelectedHorseForPlayer(playerId: string): SavedHorseData | null {
  const saved = localStorage.getItem('dev_selected_horses')
  if (!saved) return null

  const horsesData = JSON.parse(saved) as Record<string, SavedHorseData>
  return horsesData[playerId] ?? null
}

function registerDevSelectedHorseSync(params: {
  playerId: string
  onSelectedHorseLoaded: (horse: SavedHorseData) => void
}): () => void {
  const syncSelectedHorse = () => {
    try {
      const horse = readDevSelectedHorseForPlayer(params.playerId)
      if (horse) {
        params.onSelectedHorseLoaded(horse)
      }
    } catch (err) {
      console.warn('[HorseSelectionPageTest] Failed to read from localStorage:', err)
    }
  }

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'dev_selected_horses') {
      syncSelectedHorse()
    }
  }

  syncSelectedHorse()
  window.addEventListener('storage', handleStorageChange)
  const interval = setInterval(syncSelectedHorse, 500)

  return () => {
    window.removeEventListener('storage', handleStorageChange)
    clearInterval(interval)
  }
}

function buildSelectedHorseFromRealtimePlayer(player: Player | undefined): SavedHorseData | null {
  if (!player?.horseStats) return null

  const totalStats =
    player.horseStats.Speed +
    player.horseStats.Stamina +
    player.horseStats.Power +
    player.horseStats.Guts +
    player.horseStats.Start +
    player.horseStats.Luck

  return {
    name: player.name,
    stats: player.horseStats,
    totalStats,
    selectedAt: new Date().toISOString(),
  }
}

export function HorseSelectionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDev = true

  const roomId = searchParams.get('roomId')
  const [playerId, setPlayerId] = useState(localStorage.getItem('dev_player_id') || '')
  const [sessionToken, setSessionToken] = useState('')
  const [roomJoinToken, setRoomJoinToken] = useState<string | null>(
    roomId ? getRoomJoinToken(roomId) : null,
  )
  const { room, players, loading } = useRoom(roomId)

  useEffect(() => {
    void getGuestSession().then((session) => {
      setPlayerId(session.guestId)
      setSessionToken(session.sessionToken)
    })
  }, [])

  useEffect(() => {
    setRoomJoinToken(roomId ? getRoomJoinToken(roomId) : null)
  }, [roomId])

  const [candidates, setCandidates] = useState<HorseCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedHorse, setSelectedHorse] = useState<SavedHorseData | null>(null)
  const [isStatChartDialogOpen, setIsStatChartDialogOpen] = useState(false)
  const [useRadarChart, setUseRadarChart] = useState(true) // true면 레이더 차트, false면 바 보기
  const realtimeCurrentPlayer = players.find((p) => p.id === playerId) ?? null
  const confirmedPlayersCount = players.filter((p) => !!p.horseStats).length
  const totalPlayersCount = players.length
  const isHorseConfirmed = !!realtimeCurrentPlayer?.horseStats || selectedHorse !== null

  const navigateWithRoomAndPlayer = (pathname: '/lobby' | '/race' | '/race-result') => {
    if (!roomId || !playerId) return
    const params = new URLSearchParams({ roomId, playerId })
    navigate(`${pathname}?${params.toString()}`, { replace: true })
  }

  const handleRoomStatusRedirect = (status: string) => {
    if (status === 'waiting') {
      navigateWithRoomAndPlayer('/lobby')
      return
    }

    if (status === 'augmentSelection' || status === 'racing' || status === 'setResult') {
      navigateWithRoomAndPlayer('/race')
      return
    }

    if (status === 'finished') {
      navigateWithRoomAndPlayer('/race-result')
    }
  }

  useEffect(() => {
    if (!isDev) {
      navigate('/')
    }
  }, [isDev, navigate])

  useEffect(() => {
    if (!roomId) {
      navigate('/', { replace: true })
      return
    }
    if (!loading && !room) {
      navigate('/', { replace: true })
    }
  }, [loading, navigate, room, roomId])

  useEffect(() => {
    if (!roomId || !room || !playerId) return
    handleRoomStatusRedirect(room.status)
  }, [navigate, playerId, room, roomId])

  // roomId 없이 들어온 개발 테스트 케이스를 찾기 쉽게 로그를 남긴다.
  useEffect(() => {
    if (!isDev) return

    // roomId가 없으면 로비에서 정상 이동하지 않은 경우일 수 있다.
    if (!roomId) {
      console.warn('[HorseSelectionPageTest] No roomId received from LobbyPageTest')
    }
  }, [isDev, roomId, playerId])

  // 첫 진입 시 후보 3마리를 생성
  useEffect(() => {
    // 단순 초기화(조건 1개 + 상태 설정 1개)라 현재는 helper로 분리하지 않는다.
    if (candidates.length === 0) {
      setCandidates(createNewCandidates())
    }
  }, [candidates.length])

  // 개발용 fallback 경로: localStorage에 저장된 선택 결과도 같이 따라간다.
  useEffect(() => {
    if (!isDev || !playerId) return

    return registerDevSelectedHorseSync({
      playerId,
      onSelectedHorseLoaded: setSelectedHorse,
    })
  }, [isDev, playerId])

  useEffect(() => {
    if (!playerId || players.length === 0) return
    const currentPlayer = players.find((p) => p.id === playerId)
    const nextSelectedHorse = buildSelectedHorseFromRealtimePlayer(currentPlayer)
    if (!nextSelectedHorse) return
    setSelectedHorse(nextSelectedHorse)
  }, [playerId, players])

  // 카드 표시/저장 데이터에서 공통으로 쓰는 총합 계산
  const getTotalStats = (stats: Stats): number => {
    return stats.Speed + stats.Stamina + stats.Power + stats.Guts + stats.Start + stats.Luck
  }

  // 레이더 차트에 바로 넣을 형태로 변환
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

  // 레이더 차트 색상 설정
  const getStatChartConfig = () => {
    return {
      value: {
        label: '',
        color: 'hsl(217 91% 60%)', // 눈에 잘 보이는 파란색
      },
    } satisfies ChartConfig
  }

  // 능력치 숫자 색상 (게임 HUD와 비슷한 기준 사용)
  const getStatColor = (value: number): string => {
    if (value < 11) {
      return '#9ca3af' // 낮은 수치
    } else if (value < 14) {
      return '#10b981' // 보통
    } else if (value < 18) {
      return '#eab308' // 좋은 편
    } else {
      return '#f87171' // 높은 편
    }
  }

  // 비선형 정규화가 어떻게 올라가는지 설명용 차트 데이터
  const getStatChartData = () => {
    const data: Array<{ stat: number; normalized: number; linear: number }> = []
    for (let stat = 0; stat <= DEFAULT_MAX_STAT; stat += 1) {
      const normalized = normalizeStatNonLinear(stat, DEFAULT_MAX_STAT, DEFAULT_SATURATION_RATE)
      const linear = stat / DEFAULT_MAX_STAT // 비교용(선형 기준선)
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

  const getHorseConfirmValidationError = (): string | null => {
    if (selectedIndex == null || isSubmitting || isHorseConfirmed) return 'skip'
    if (!roomId) return t('horseSelection.roomIdMissing')
    if (!playerId) return 'playerId가 필요합니다.'
    if (!sessionToken) return '세션 토큰이 필요합니다.'
    if (!roomJoinToken) return '룸 참가 토큰이 필요합니다. 로비에서 다시 입장해주세요.'
    return null
  }

  const buildSavedHorseData = (candidate: HorseCandidate): SavedHorseData => {
    const totalStats = getTotalStats(candidate.stats)
    return {
      name: t(`horseNames.${candidate.nameKey}`),
      stats: candidate.stats,
      totalStats,
      selectedAt: new Date().toISOString(),
    }
  }

  const trySubmitHorseSelectionRealtime = async (
    candidate: HorseCandidate,
    params: HorseConfirmParams,
  ): Promise<boolean> => {
    try {
      await selectHorseCallable({
        roomId: params.roomId,
        playerId: params.playerId,
        sessionToken: params.sessionToken,
        joinToken: params.roomJoinToken,
        horseStats: candidate.stats,
      })
      return true
    } catch (callableErr) {
      console.warn(
        '[HorseSelectionPage] selectHorse callable failed, fallback to local:',
        callableErr,
      )
      return false
    }
  }

  const saveHorseSelectionToLocalFallback = (
    horseData: SavedHorseData,
    currentPlayerId: string,
  ) => {
    try {
      const saved = localStorage.getItem('dev_selected_horses')
      const horsesData = saved ? JSON.parse(saved) : {}
      horsesData[currentPlayerId] = horseData

      const playerIds: string[] = JSON.parse(localStorage.getItem('dev_player_ids') || '[]')
      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
        localStorage.getItem('dev_player_nickname_data') || '{}',
      )
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )

      playerIds.forEach((id) => {
        if (id !== currentPlayerId && !horsesData[id]) {
          const playerName =
            customNames[id] ||
            (nicknameDataMap[id] ? formatNickname(nicknameDataMap[id]) : `플레이어 ${id}`)

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

      const selectedCount = Object.values(horsesData).filter(
        (entry) => entry && typeof entry === 'object' && 'stats' in entry,
      ).length
      if (selectedCount >= playerIds.length && playerIds.length > 0) {
        navigateWithRoomAndPlayer('/race')
      }
    } catch (err) {
      console.warn('[HorseSelectionPageTest] Failed to save horse data:', err)
    }
  }

  const getSelectedHorseCandidateForConfirm = (): HorseCandidate | null => {
    if (selectedIndex == null) return null
    return candidates[selectedIndex] ?? null
  }

  const buildHorseConfirmParams = (): HorseConfirmParams | null => {
    if (!roomId || !playerId || !sessionToken || !roomJoinToken) return null
    return { roomId, playerId, sessionToken, roomJoinToken }
  }

  const submitHorseSelection = async (
    selectedHorseCandidate: HorseCandidate,
    confirmParams: HorseConfirmParams,
  ): Promise<SavedHorseData> => {
    const horseData = buildSavedHorseData(selectedHorseCandidate)
    const callableSuccess = await trySubmitHorseSelectionRealtime(
      selectedHorseCandidate,
      confirmParams,
    )

    if (!callableSuccess) {
      saveHorseSelectionToLocalFallback(horseData, confirmParams.playerId)
    }

    return horseData
  }

  // 확인 버튼 처리
  // 서버 호출이 실패하면 local fallback으로 최소한 테스트 흐름은 이어간다.
  const handleConfirm = async () => {
    const validationError = getHorseConfirmValidationError()
    if (validationError === 'skip') return
    if (validationError) {
      setError(validationError)
      return
    }

    const selectedHorseCandidate = getSelectedHorseCandidateForConfirm()
    if (!selectedHorseCandidate) {
      setError(t('horseSelection.selectFailed'))
      return
    }
    const confirmParams = buildHorseConfirmParams()
    if (!confirmParams) {
      setError(t('horseSelection.selectFailed'))
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const horseData = await submitHorseSelection(selectedHorseCandidate, confirmParams)
      setSelectedHorse(horseData)
      // 성공 후 이동은 여기서 바로 하지 않고 room.status 구독으로 전원 동기화한다.
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
      {/* 말 선택 화면 본문 */}
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
              {t('horseSelection.subtitleNoReroll')}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* 후보 말 카드 3장 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate, index) => {
              const isSelected = selectedIndex === index

              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  disabled={isSubmitting || isHorseConfirmed}
                  className={clsx(
                    'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]',
                    (isSubmitting || isHorseConfirmed) && 'opacity-50 cursor-not-allowed',
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
                    {/* 카드 헤더/본문 구분선 */}
                    <div className="border-t border-border/50" />

                    {/* 차트 보기/바 보기 전환용 플립 컨테이너 */}
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
                        {/* 앞면: 레이더 차트 */}
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

                        {/* 뒷면: 2열 3행 능력치 바 */}
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

          {/* 말 선택 확정 버튼 */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={selectedIndex == null || isSubmitting || isHorseConfirmed}
              onClick={handleConfirm}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted-foreground"
            >
              {isSubmitting
                ? t('horseSelection.processing')
                : isHorseConfirmed
                  ? t('horseSelection.waitingAfterConfirm')
                  : t('horseSelection.confirm')}
            </button>
          </div>
          {isHorseConfirmed && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              {t('horseSelection.waitingPlayers', {
                current: confirmedPlayersCount,
                total: totalPlayersCount,
              })}
            </p>
          )}
        </div>
      </div>

      {/* 능력치 정규화 설명 다이얼로그 */}
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
