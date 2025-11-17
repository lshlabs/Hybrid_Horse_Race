import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type PlayerStatus = 'ready' | 'waiting'

interface PlayerTemplate {
  id: string
  index: number
  role?: 'host'
  initialStatus: PlayerStatus
}

interface Player {
  id: string
  index: number
  role?: 'host'
  status: PlayerStatus
}

const inviteCode = 'A4B1C9'
const MAX_PLAYERS = 8
const DEFAULT_PARTICIPANTS = 4

const PLAYER_TEMPLATES: PlayerTemplate[] = [
  { id: '1', index: 1, role: 'host', initialStatus: 'ready' },
  { id: '2', index: 2, initialStatus: 'ready' },
  { id: '3', index: 3, initialStatus: 'ready' },
] as const

// 개발 중 임시로 플레이어 2번이 현재 사용자
const CURRENT_USER_INDEX = 2

export function LobbyPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlVisible, setIsUrlVisible] = useState(false)
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({})
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')

  const participantTarget = (() => {
    const param = parseInt(searchParams.get('participants') ?? '', 10)
    if (Number.isNaN(param)) {
      return DEFAULT_PARTICIPANTS
    }

    return Math.min(Math.max(param, 1), MAX_PLAYERS)
  })()

  const inviteUrl = useMemo(() => `https://hybrid-horse-race.io/lobby/${inviteCode}`, [])

  const activeTemplates = useMemo(
    () => PLAYER_TEMPLATES.slice(0, Math.min(participantTarget, PLAYER_TEMPLATES.length)),
    [participantTarget],
  )

  const players = useMemo<Player[]>(
    () =>
      activeTemplates.map((template) => ({
        id: template.id,
        index: template.index,
        role: template.role,
        status: template.initialStatus,
      })),
    [activeTemplates],
  )

  const readyCount = players.filter((player) => player.status === 'ready').length
  const isAllReady = readyCount === players.length && players.length > 0

  const emptySlotCount = Math.max(participantTarget - players.length, 0)
  const emptySlots = Array.from({ length: emptySlotCount })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('invite link copy failed', error)
    }
  }

  const getPlayerName = (player: Player) => {
    if (playerNames[player.id]) {
      return playerNames[player.id]
    }
    return t('lobby.playerName', { index: player.index })
  }

  const isCurrentUser = (player: Player) => player.index === CURRENT_USER_INDEX

  // 현재 사용자가 호스트인지 확인
  // 개발 단계: 플레이어 1번이 호스트이므로, 현재 사용자(플레이어 2번)는 호스트가 아님
  // TODO: 실제 사용자 인증 후 호스트 여부 확인 로직으로 교체 필요
  const isCurrentUserHost = players.some(
    (player) => player.index === CURRENT_USER_INDEX && player.role === 'host',
  )

  // 개발 단계: 모든 사용자에게 '게임 시작' 버튼 표시
  // TODO: 실제 배포 시 아래 변수를 false로 변경하거나 제거
  const DEV_MODE_SHOW_START_BUTTON = true

  const handleEditName = (player: Player) => {
    setEditingPlayerId(player.id)
    setEditNameValue(getPlayerName(player))
  }

  const handleSaveName = (playerId: string) => {
    if (editNameValue.trim()) {
      setPlayerNames((prev) => ({ ...prev, [playerId]: editNameValue.trim() }))
    }
    setEditingPlayerId(null)
    setEditNameValue('')
  }

  const handleCancelEdit = () => {
    setEditingPlayerId(null)
    setEditNameValue('')
  }

  const handleStart = () => {
    if (!isAllReady) return
    const params = new URLSearchParams(searchParams)
    params.delete('runStyle')
    params.delete('horse')
    navigate({
      pathname: '/horse-selection',
      search: `?${params.toString()}`,
    })
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-surface backdrop-blur-lg">
        <header className="mb-6 text-center">
          <h1 className="mt-2 text-2xl font-display text-neutral-50">{t('lobby.title')}</h1>
          <p className="mt-2 text-xs text-neutral-400">{t('lobby.subtitle')}</p>
        </header>

        <ul className="space-y-3">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-surface-muted/80 px-3 sm:px-4 py-3"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg text-neutral-300">
                {player.index}
              </div>
              <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                {editingPlayerId !== player.id && (
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {player.role === 'host' && (
                      <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary">
                        {t('lobby.host')}
                      </span>
                    )}
                    {isCurrentUser(player) && (
                      <span className="rounded-full border border-accent/50 bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent">
                        {t('lobby.me', { defaultValue: '나' })}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-1 min-w-0 items-center">
                  {editingPlayerId === player.id ? (
                    <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveName(player.id)
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-primary/30 bg-background/80 px-2 sm:px-3 py-1.5 text-sm text-neutral-100 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveName(player.id)}
                        className="flex-shrink-0 rounded-lg bg-primary px-2 sm:px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/80"
                        aria-label="저장"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="flex-shrink-0 rounded-lg border border-white/20 bg-white/5 px-2 sm:px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:bg-white/10"
                        aria-label="취소"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center min-w-0">
                      <p className="text-sm font-semibold text-neutral-100 truncate">
                        {getPlayerName(player)}
                      </p>
                      {isCurrentUser(player) && (
                        <button
                          type="button"
                          onClick={() => handleEditName(player)}
                          className="ml-1 flex-shrink-0 text-neutral-400 transition hover:text-primary"
                          aria-label="이름 편집"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="h-5 w-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {editingPlayerId !== player.id && (
                <span
                  className={
                    player.status === 'ready'
                      ? 'inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success flex-shrink-0'
                      : 'inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning flex-shrink-0'
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {player.status === 'ready' ? t('lobby.status.ready') : t('lobby.status.waiting')}
                </span>
              )}
            </li>
          ))}

          {emptySlots.map((_, index) => {
            const emptySlotIndex = players.length + index + 1
            return (
              <li
                key={`empty-${index}`}
                className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-surface-muted/80 px-3 sm:px-4 py-3"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg text-neutral-300">
                  {emptySlotIndex}
                </div>
                <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" />
                  <div className="flex flex-1 min-w-0 items-center">
                    <p className="text-sm font-semibold text-neutral-100 truncate">
                      {t('lobby.playerName', { index: emptySlotIndex })}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-500/40 bg-neutral-500/10 px-2 py-0.5 text-[10px] text-neutral-400 flex-shrink-0">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  {t('lobby.emptySlotStatus')}
                </span>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">
            {t('lobby.invite')}
          </p>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-background/80 px-4 py-3 text-sm text-neutral-200">
              <span className="block flex-1 truncate">
                {isUrlVisible ? inviteUrl : '••••••••••••••••••••••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setIsUrlVisible(!isUrlVisible)}
                className="flex-shrink-0 text-neutral-400 transition hover:text-neutral-200"
                aria-label={isUrlVisible ? 'URL 숨기기' : 'URL 보이기'}
              >
                {isUrlVisible ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 01-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/80"
              aria-label="복사"
            >
              {isCopied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {/* 개발 단계: DEV_MODE_SHOW_START_BUTTON이 true이면 모든 사용자에게 '로비 설정으로 돌아가기' 버튼 표시 */}
          {/* TODO: 실제 배포 시 아래 조건을 isCurrentUserHost로 교체 */}
          {DEV_MODE_SHOW_START_BUTTON || isCurrentUserHost ? (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-semibold text-neutral-100 transition hover:border-white/30 hover:bg-white/10"
            >
              {t('lobby.backToLanding')}
            </button>
          ) : null}
          {/* 개발 단계: DEV_MODE_SHOW_START_BUTTON이 true이면 모든 사용자에게 '게임 시작' 버튼 표시 */}
          {/* TODO: 실제 배포 시 아래 조건을 isCurrentUserHost로 교체 */}
          {DEV_MODE_SHOW_START_BUTTON || isCurrentUserHost ? (
            <button
              type="button"
              disabled={!isAllReady}
              onClick={handleStart}
              className="w-full rounded-full border border-transparent bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-neutral-400"
            >
              {t('lobby.startGame')}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-full bg-white/10 px-8 py-3 text-base font-semibold text-neutral-400"
            >
              {t('lobby.startGameWaiting')}
            </button>
          )}
          {!isAllReady ? (
            <p className="text-center text-xs text-neutral-400">{t('lobby.startWaiting')}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
