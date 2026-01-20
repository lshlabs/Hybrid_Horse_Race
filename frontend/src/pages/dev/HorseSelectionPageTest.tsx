/**
 * 개발용 말 선택 테스트 페이지
 * Firebase 없이도 말 선택 기능을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /horse-selection-test 접근
 * 3. 말 선택 기능 테스트
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { NeonCard } from '../../components/ui/NeonCard'
import { generateRandomStats } from '../../engine/race/stat-system'
import type { Stats, StatName } from '../../engine/race/types'

// 스탯 이름 한글 매핑
const STAT_NAMES_KO: Record<StatName, string> = {
  Speed: '최고속도',
  Stamina: '지구력',
  Power: '가속',
  Guts: '근성',
  Start: '출발',
  Consistency: '일관성',
}

// 말 이름 풀 (랜덤 선택용)
const HORSE_NAMES = [
  '천둥',
  '번개',
  '폭풍',
  '질주',
  '바람',
  '번개',
  '별',
  '달',
  '태양',
  '구름',
  '폭풍우',
  '천둥번개',
  '질풍',
  '순풍',
  '돌풍',
]

interface HorseCandidate {
  id: string
  name: string
  stats: Stats
}

const MAX_REROLLS = 3

interface SavedHorseData {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

export function HorseSelectionPageTest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDev = import.meta.env.DEV

  const roomId = searchParams.get('roomId')
  const playerId = searchParams.get('playerId')
  const participantCount = searchParams.get('participantCount')
  const setCount = searchParams.get('setCount')
  const rerollLimit = searchParams.get('rerollLimit')

  const [candidates, setCandidates] = useState<HorseCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rerollsUsed, setRerollsUsed] = useState(0)
  const [selectedHorse, setSelectedHorse] = useState<SavedHorseData | null>(null)

  useEffect(() => {
    if (!isDev) {
      navigate('/')
    }
  }, [isDev, navigate])

  // LobbyPageTest에서 전달된 데이터 확인 및 로그 출력
  useEffect(() => {
    if (!isDev) return

    console.log('[HorseSelectionPageTest] Received data from LobbyPageTest:', {
      roomId,
      playerId,
      hasRoomId: !!roomId,
      hasPlayerId: !!playerId,
    })

    // 데이터가 없으면 경고
    if (!roomId) {
      console.warn('[HorseSelectionPageTest] No roomId received from LobbyPageTest')
    }
  }, [isDev, roomId, playerId])

  // 새로운 후보 생성 함수
  const generateNewCandidates = () => {
    const newCandidates: HorseCandidate[] = []
    const usedNames = new Set<string>()

    for (let i = 0; i < 3; i++) {
      const stats = generateRandomStats()

      // 중복되지 않는 이름 선택
      let name: string
      let attempts = 0
      do {
        const nameIndex = Math.floor(Math.random() * HORSE_NAMES.length)
        name = `${HORSE_NAMES[nameIndex]}${i + 1}호`
        attempts++
      } while (usedNames.has(name) && attempts < 10)

      usedNames.add(name)

      newCandidates.push({
        id: `horse-${Date.now()}-${i}`,
        name,
        stats,
      })
    }

    setCandidates(newCandidates)
  }

  // 초기 말 후보 생성
  useEffect(() => {
    if (candidates.length === 0) {
      generateNewCandidates()
    }
  }, [candidates.length])

  // localStorage에서 선택한 말 데이터 확인
  useEffect(() => {
    if (!isDev) return

    const checkSavedHorse = () => {
      try {
        const saved = localStorage.getItem('dev_selected_horse')
        if (saved) {
          const horseData = JSON.parse(saved) as SavedHorseData
          setSelectedHorse(horseData)
        }
      } catch (err) {
        console.warn('[HorseSelectionPageTest] Failed to read from localStorage:', err)
      }
    }

    checkSavedHorse()

    // localStorage 변경 감지
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dev_selected_horse') {
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
  }, [isDev])

  // 리롤 처리
  const handleReroll = () => {
    if (rerollsUsed >= MAX_REROLLS) {
      setError(`리롤은 최대 ${MAX_REROLLS}번까지 가능합니다.`)
      return
    }

    generateNewCandidates()
    setSelectedIndex(null)
    setRerollsUsed((prev) => prev + 1)
    setError(null)
  }

  // 스탯 총합 계산
  const getTotalStats = (stats: Stats): number => {
    return stats.Speed + stats.Stamina + stats.Power + stats.Guts + stats.Start + stats.Consistency
  }

  // 확인 처리 (Mock)
  const handleConfirm = async () => {
    if (selectedIndex == null || isSubmitting) return

    if (!roomId) {
      setError('룸 ID가 없습니다.')
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
        name: selectedHorseCandidate.name,
        stats: selectedHorseCandidate.stats,
        totalStats,
        selectedAt: new Date().toISOString(),
      }

      // localStorage에 저장 (RacePageTest에서 사용)
      localStorage.setItem('dev_selected_horse', JSON.stringify(horseData))
      setSelectedHorse(horseData)

      console.log('[HorseSelectionPageTest] Selected horse:', horseData)

      // 성공하면 자동으로 다음 페이지로 이동 (roomId, playerId, participantCount 등 전달)
      const params = new URLSearchParams({ roomId })
      if (playerId) params.set('playerId', playerId)
      if (participantCount) params.set('participantCount', participantCount)
      if (setCount) params.set('setCount', setCount)
      if (rerollLimit) params.set('rerollLimit', rerollLimit)
      navigate(`/race-test?${params.toString()}`)
    } catch (err) {
      console.error('Failed to select horse:', err)
      const errorMessage = err instanceof Error ? err.message : '말 선택에 실패했습니다.'
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
    <div
      className="flex h-screen w-screen flex-col overflow-auto"
      style={{ backgroundColor: '#1a1a2e' }}
    >
      {/* 개발용 안내 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 p-4 text-white">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-2 text-lg font-bold">🧪 말 선택 테스트 모드</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <p className="text-gray-300">
              개발 모드에서는 Firebase 연결 없이도 말 선택 기능을 테스트할 수 있습니다.
            </p>
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
            {!roomId && (
              <div className="rounded bg-yellow-600/20 px-3 py-1 border border-yellow-500/40">
                <span className="text-yellow-400">⚠️ roomId가 전달되지 않았습니다.</span>
              </div>
            )}
            {selectedHorse && (
              <div className="flex items-center gap-2 rounded bg-green-600/20 px-3 py-1 border border-green-500/40">
                <span className="text-green-400">✓ 선택됨:</span>
                <span className="font-mono text-green-300">{selectedHorse.name}</span>
                <span className="text-green-400">(총 능력치: {selectedHorse.totalStats})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 독립적으로 구현한 말 선택 UI */}
      <div className="flex min-h-full items-start justify-center pt-24 pb-8">
        <div className="w-full max-w-6xl rounded-3xl border border-white/10 bg-surface/80 p-8 shadow-surface backdrop-blur-lg">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.45em] text-primary/70">말 선택</p>
            <h1 className="mt-3 text-3xl font-display text-neutral-50">말을 선택하세요</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              3마리의 말 중 하나를 선택하세요. 리롤은 최대 {MAX_REROLLS}번까지 가능합니다.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* 리롤 정보 및 버튼 */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-neutral-400">
              리롤 사용: {rerollsUsed} / {MAX_REROLLS}
            </div>
            <button
              type="button"
              onClick={handleReroll}
              disabled={rerollsUsed >= MAX_REROLLS || isSubmitting}
              className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              리롤 ({rerollsUsed}/{MAX_REROLLS})
            </button>
          </div>

          {/* 말 선택 카드 (3개) */}
          <div className="grid gap-6 md:grid-cols-3">
            {candidates.map((candidate, index) => {
              const isSelected = selectedIndex === index
              const totalStats = getTotalStats(candidate.stats)

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
                    title={candidate.name}
                    description={`총 능력치: ${totalStats}`}
                    className={clsx(
                      'h-full border border-white/10',
                      isSelected ? 'ring-2 ring-primary' : 'ring-1 ring-white/10',
                    )}
                  >
                    {/* 스탯 표시 (2열 3행) */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {(Object.keys(candidate.stats) as StatName[]).map((statName) => {
                        const statValue = candidate.stats[statName]
                        const maxStat = 20 // 최대 스탯 값 (시각화용)
                        const percentage = Math.min((statValue / maxStat) * 100, 100)

                        return (
                          <div
                            key={statName}
                            className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-neutral-300">
                                {STAT_NAMES_KO[statName]}
                              </span>
                              <span className="text-sm font-bold text-primary">{statValue}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </NeonCard>
                </button>
              )
            })}
          </div>

          {/* 확인 버튼 */}
          <div className="mt-8 flex items-center justify-end">
            <button
              type="button"
              disabled={selectedIndex == null || isSubmitting}
              onClick={handleConfirm}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-400"
            >
              {isSubmitting ? '처리 중...' : '확인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
