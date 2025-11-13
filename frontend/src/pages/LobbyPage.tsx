import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { RunStyleId } from '../data/runStyles'

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

export function LobbyPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const participantTarget = (() => {
    const param = parseInt(searchParams.get('participants') ?? '', 10)
    if (Number.isNaN(param)) {
      return DEFAULT_PARTICIPANTS
    }

    return Math.min(Math.max(param, 1), MAX_PLAYERS)
  })()

  const inviteUrl = useMemo(() => `https://hybrid-horse-race.io/lobby/${inviteCode}`, [])
  const runStyleParam = searchParams.get('runStyle') as RunStyleId | null
  const selectedHorse = searchParams.get('horse')
  const runStyleLabel = runStyleParam
    ? t(`runStyle.options.${runStyleParam}.name`, { defaultValue: runStyleParam })
    : null

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
    } catch (error) {
      console.error('invite link copy failed', error)
    }
  }

  const getPlayerName = (player: Player) => t('lobby.playerName', { index: player.index })

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
        <div className="mb-4 flex justify-start">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-100 transition hover:border-primary/50 hover:text-primary"
          >
            ← {t('lobby.backToLanding')}
          </Link>
        </div>
        <header className="mb-6 text-center">
          <p className="text-sm uppercase tracking-[0.45em] text-primary/70">{t('lobby.title')}</p>
          <h1 className="mt-2 text-2xl font-display text-neutral-50">{t('lobby.title')}</h1>
          <p className="mt-2 text-xs text-neutral-400">{t('lobby.subtitle')}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {selectedHorse ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-100">
                {t('lobby.selectedHorse', { horseName: selectedHorse })}
              </span>
            ) : null}
            {runStyleLabel ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">
                {t('lobby.selectedRunStyle', { runStyle: runStyleLabel })}
              </span>
            ) : null}
          </div>
        </header>

        <ul className="space-y-3">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-2xl bg-surface-muted/80 px-4 py-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-lg text-neutral-300">
                {getPlayerName(player).slice(-1)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-100">{getPlayerName(player)}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
                  {player.role === 'host' ? (
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary">
                      {t('lobby.host')}
                    </span>
                  ) : null}
                  <span
                    className={
                      player.status === 'ready'
                        ? 'inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success'
                        : 'inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning'
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {player.status === 'ready'
                      ? t('lobby.status.ready')
                      : t('lobby.status.waiting')}
                  </span>
                </div>
              </div>
            </li>
          ))}

          {emptySlots.map((_, index) => (
            <li
              key={`empty-${index}`}
              className="flex items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-neutral-400"
            >
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/40 border-t-transparent" />
                {t('lobby.emptySlot')}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-500">
                {t('lobby.emptySlotStatus')}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">
            {t('lobby.invite')}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-background/80 px-4 py-3 text-sm text-neutral-200">
              <span className="block truncate">{inviteUrl}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/80"
            >
              {t('invite.copy')}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={!isAllReady}
            onClick={handleStart}
            className="w-full rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-400"
          >
            {t('lobby.startGame')}
          </button>
          {!isAllReady ? (
            <p className="text-center text-xs text-neutral-400">{t('lobby.startWaiting')}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
