/**
 * 개발용 랜딩 페이지 테스트
 * Firebase 없이도 룸 생성 기능을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 / 접근
 * 3. 룸 생성 기능 테스트 (Mock 데이터 사용)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Flag, RefreshCw, Plus, Minus } from 'lucide-react'
import { getUserId } from '../lib/user-id'

const MIN_ROUND_COUNT = 1
const MAX_ROUND_COUNT = 3

const MIN_PLAYER_COUNT = 2
const MAX_PLAYER_COUNT = 8

const MIN_REROLL_COUNT = 0
const MAX_REROLL_COUNT = 5

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDev = true

  const [playerCount, setPlayerCount] = useState(4)
  const [roundCount, setRoundCount] = useState(3)
  const [rerollCount, setRerollCount] = useState(3)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true)

  useEffect(() => {
    if (!isDev) {
      navigate('/')
    }
  }, [isDev, navigate])

  const decreaseRounds = () => setRoundCount((prev) => Math.max(prev - 1, MIN_ROUND_COUNT))
  const increaseRounds = () => setRoundCount((prev) => Math.min(prev + 1, MAX_ROUND_COUNT))
  const decreasePlayers = () => setPlayerCount((prev) => Math.max(prev - 1, MIN_PLAYER_COUNT))
  const increasePlayers = () => setPlayerCount((prev) => Math.min(prev + 1, MAX_PLAYER_COUNT))
  const decreaseReroll = () => setRerollCount((prev) => Math.max(prev - 1, MIN_REROLL_COUNT))
  const increaseReroll = () => setRerollCount((prev) => Math.min(prev + 1, MAX_REROLL_COUNT))

  // Mock 룸 생성 (Firebase 호출 없이)
  const handleCreateRoom = async () => {
    if (isCreating) return

    setIsCreating(true)
    setError(null)

    // Mock: 약간의 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      const playerId = getUserId()
      // Mock roomId 생성
      const newRoomId = `test-room-${Date.now()}`

      // 게임 설정을 localStorage에 저장 (개선 사항 3)
      const roomConfig = {
        playerCount,
        roundCount,
        rerollLimit: rerollCount,
      }
      localStorage.setItem('dev_room_config', JSON.stringify(roomConfig))

      // playerId를 localStorage에 저장 (개선 사항 7)
      localStorage.setItem('dev_player_id', playerId)

      // 테스트 페이지로 이동 (roomId와 playerId만 전달)
      const params = new URLSearchParams({
        roomId: newRoomId,
        playerId, // playerId 전달 추가
      })
      navigate(`/lobby?${params.toString()}`)
    } catch (err) {
      console.error('Failed to create room:', err)
      setError(t('navigation.createFailed'))
      setIsCreating(false)
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
        >
          <span className="text-sm">▼ 개발 배너</span>
        </button>
      ) : (
        /* 펼쳤을 때: 전체 배너 표시 */
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 p-4 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🧪 랜딩 페이지 테스트 모드</h2>
              <button
                onClick={() => setIsBannerCollapsed(true)}
                className="ml-4 rounded bg-gray-700/50 px-3 py-1 text-sm transition hover:bg-gray-700/70"
              >
                ▲
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
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

      {/* 실제 LandingPage UI (독립적으로 구현) */}
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-4 sm:p-8 shadow-surface backdrop-blur-lg">
          <header className="text-center">
            <h1 className="mt-3 text-3xl font-display text-foreground">{t('appTitle')}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t('appDescription')}
            </p>
          </header>

          <section className="mt-10 space-y-6">
            <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-surface-muted/70 px-3 sm:px-5 py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t('controls.participants.label')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <button
                  type="button"
                  disabled={playerCount <= MIN_PLAYER_COUNT}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-foreground transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-foreground"
                  onClick={decreasePlayers}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[2rem] text-center text-xl font-bold text-foreground">
                  {playerCount}
                </span>
                <button
                  type="button"
                  disabled={playerCount >= MAX_PLAYER_COUNT}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-foreground transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-foreground"
                  onClick={increasePlayers}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-surface-muted/70 px-3 sm:px-5 py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary">
                  <Flag className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t('controls.sets.label')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <button
                  type="button"
                  disabled={roundCount <= MIN_ROUND_COUNT}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-foreground transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-foreground"
                  onClick={decreaseRounds}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[2rem] text-center text-xl font-bold text-foreground">
                  {roundCount}
                </span>
                <button
                  type="button"
                  disabled={roundCount >= MAX_ROUND_COUNT}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-foreground transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-foreground"
                  onClick={increaseRounds}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-surface-muted/70 px-3 sm:px-5 py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary">
                  <RefreshCw className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t('controls.reroll.label')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <button
                  type="button"
                  disabled={rerollCount <= MIN_REROLL_COUNT}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-foreground transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-foreground"
                  onClick={decreaseReroll}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[2rem] text-center text-xl font-bold text-foreground">
                  {rerollCount}
                </span>
                <button
                  type="button"
                  disabled={rerollCount >= MAX_REROLL_COUNT}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-foreground transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-foreground"
                  onClick={increaseReroll}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </section>

          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="mt-10 w-full rounded-full bg-primary px-8 py-3 text-center text-base font-semibold text-white shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? t('navigation.creating') : t('navigation.toLobby')}
          </button>
        </div>
      </div>
    </div>
  )
}
