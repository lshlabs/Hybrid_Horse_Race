/**
 * 랜딩 페이지
 * 실서비스 Firebase 호출을 우선 쓰고, 개발 설정일 때만 mock fallback을 허용한다.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Flag, RefreshCw, Plus, Minus } from 'lucide-react'
import { withGuestSessionRetry } from '../lib/user-id'
import { createRoom as createRoomCallable } from '../lib/firebase-functions'
import { setRoomJoinToken } from '../lib/room-join-token'
import { resolvePlayerDisplayName } from '../lib/player-name'

const MIN_ROUND_COUNT = 1
const MAX_ROUND_COUNT = 3

const MIN_PLAYER_COUNT = 2
const MAX_PLAYER_COUNT = 8

const MIN_REROLL_COUNT = 0
const MAX_REROLL_COUNT = 5
const ENABLE_MOCK_ROOM_FALLBACK =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_ROOM_FALLBACK === 'true'

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDev = true

  const [playerCount, setPlayerCount] = useState(4)
  const [roundCount, setRoundCount] = useState(3)
  const [rerollCount, setRerollCount] = useState(3)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // 룸 생성은 Firebase callable을 먼저 시도하고, 개발 설정일 때만 mock으로 넘어간다.
  const handleCreateRoom = async () => {
    if (isCreating) return

    setIsCreating(true)
    setError(null)

    try {
      let playerId = ''
      const newRoomId = await withGuestSessionRetry(async (session) => {
        playerId = session.guestId
        try {
          const response = await createRoomCallable({
            playerId: session.guestId,
            sessionToken: session.sessionToken,
            hostName: resolvePlayerDisplayName(session.guestId),
            title: `Hybrid Horse Race (${Date.now()})`,
            maxPlayers: playerCount,
            roundCount,
            rerollLimit: rerollCount,
          })
          setRoomJoinToken(
            response.data.roomId,
            response.data.joinToken,
            response.data.joinTokenExpiresAtMillis,
          )
          return response.data.roomId
        } catch (callableError) {
          if (!ENABLE_MOCK_ROOM_FALLBACK) {
            throw callableError
          }
          console.warn(
            '[LandingPage] createRoom callable failed, fallback to mock room:',
            callableError,
          )
          await new Promise((resolve) => setTimeout(resolve, 500))
          return `test-room-${Date.now()}`
        }
      })

      // 다음 페이지에서도 같은 설정을 쓰려고 localStorage에 저장해 둔다.
      const roomConfig = {
        playerCount,
        roundCount,
        rerollLimit: rerollCount,
      }
      localStorage.setItem('dev_room_config', JSON.stringify(roomConfig))

      // 현재 게스트 playerId도 저장해 둔다.
      localStorage.setItem('dev_player_id', playerId)

      // 로비 페이지로 이동할 때 roomId/playerId를 같이 넘긴다.
      const params = new URLSearchParams({
        roomId: newRoomId,
        playerId, // playerId 전달 추가
      })
      navigate(`/lobby?${params.toString()}`)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : t('navigation.createFailed')
      console.error('Failed to create room:', {
        err,
        playerCount,
        roundCount,
        rerollCount,
      })
      setError(message)
    } finally {
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
      {/* 랜딩 페이지 메인 UI */}
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
