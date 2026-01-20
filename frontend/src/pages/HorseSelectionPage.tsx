import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'

import { NeonCard } from '../components/ui/NeonCard'
import { useRoom } from '../hooks/useRoom'
// TODO: selectRunStyle 대신 selectHorse 함수를 사용해야 함 (백엔드 구현 필요)
import { selectRunStyle } from '../lib/firebase-functions'
import { getUserId } from '../lib/user-id'
import { generateRandomStats } from '../engine/race/stat-system'
import type { Stats, StatName } from '../engine/race/types'

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

export function HorseSelectionPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const roomId = searchParams.get('roomId')
  const playerId = searchParams.get('playerId')
  const userId = getUserId()

  const { room, players, loading } = useRoom(roomId)

  const [candidates, setCandidates] = useState<HorseCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rerollsUsed, setRerollsUsed] = useState(0)

  // 현재 플레이어 찾기
  const currentPlayer = useMemo(() => {
    if (!room || !userId) {
      return null
    }

    if (room.hostId === userId) {
      return players.find((p) => p.isHost) || null
    }

    if (playerId) {
      return players.find((p) => !p.isHost && p.id === playerId) || null
    }

    return null
  }, [room, userId, players, playerId])

  // 초기 말 후보 생성
  useEffect(() => {
    if (currentPlayer && candidates.length === 0) {
      generateNewCandidates()
    }
  }, [currentPlayer, candidates.length])

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

  // 이미 선택한 말이 있는지 확인
  useEffect(() => {
    // TODO: Firebase에서 저장된 스탯과 비교하여 선택된 말 표시
    // if (currentPlayer?.horseStats) {
    //   // 선택된 말이 있으면 해당 인덱스 찾기 (스탯 비교)
    // }
  }, [currentPlayer])

  // 룸이 없으면 홈으로 리다이렉트
  useEffect(() => {
    if (!roomId) {
      navigate('/')
      return
    }
  }, [roomId, navigate])

  // 룸 상태가 말 선택 단계가 아니면 로비로 리다이렉트
  // 참고: 백엔드 상태는 'runStyleSelection'이지만, 프론트엔드에서는 말 선택으로 사용
  useEffect(() => {
    if (room && room.status !== 'runStyleSelection') {
      if (room.status === 'waiting') {
        navigate(`/lobby?roomId=${roomId}`)
      } else if (room.status === 'augmentSelection') {
        // TODO: 증강 선택 페이지로 이동
      }
    }
  }, [room, roomId, navigate])

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

  // 확인 처리
  const handleConfirm = async () => {
    if (selectedIndex == null || isSubmitting) return

    if (!roomId || !currentPlayer) return

    const selectedHorse = candidates[selectedIndex]
    setError(null)
    setIsSubmitting(true)

    try {
      const actualPlayerId = currentPlayer?.id || (room?.hostId === userId ? userId : playerId)

      if (!actualPlayerId) {
        throw new Error('플레이어 정보를 찾을 수 없습니다.')
      }

      // TODO: 백엔드에 selectHorse 함수 구현 필요
      // 현재는 임시로 selectRunStyle을 사용 (백엔드 호환성 유지)
      // 말 스탯 데이터는 백엔드 함수 수정 후 전달 예정
      console.log('[HorseSelectionPage] Selected horse:', {
        name: selectedHorse.name,
        stats: selectedHorse.stats,
      })

      if (!roomId) {
        throw new Error('룸 ID가 없습니다.')
      }

      // 임시: 백엔드 호환성을 위해 selectRunStyle 사용
      // TODO: selectHorse 함수로 교체 필요
      await selectRunStyle({
        roomId,
        playerId: actualPlayerId || '',
        runStyle: 'frontRunner', // 임시 값 (백엔드에서 무시됨)
      })

      // 성공하면 자동으로 다음 페이지로 이동
    } catch (err) {
      console.error('Failed to select horse:', err)
      const errorMessage = err instanceof Error ? err.message : '말 선택에 실패했습니다.'
      setError(errorMessage)
      setIsSubmitting(false)
    }
  }

  // 스탯 총합 계산
  const getTotalStats = (stats: Stats): number => {
    return stats.Speed + stats.Stamina + stats.Power + stats.Guts + stats.Start + stats.Consistency
  }

  // 로딩 중
  if (loading || !room || !currentPlayer) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-neutral-200">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
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
  )
}
