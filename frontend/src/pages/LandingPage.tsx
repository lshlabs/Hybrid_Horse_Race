import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const MIN_SET_COUNT = 1
const MAX_SET_COUNT = 5

const MIN_PARTICIPANT_COUNT = 2
const MAX_PARTICIPANT_COUNT = 8

const MIN_REROLL_COUNT = 0
const MAX_REROLL_COUNT = 5

const inviteCode = 'A4B1C9'

export function LandingPage() {
  const { t } = useTranslation()
  const [setCount, setSetCount] = useState(3)
  const [participantCount, setParticipantCount] = useState(4)
  const [rerollCount, setRerollCount] = useState(2)

  const inviteUrl = useMemo(() => `https://hybrid-horse-race.io/lobby/${inviteCode}`, [])
  const lobbyLink = useMemo(() => {
    const params = new URLSearchParams({
      participants: participantCount.toString(),
      sets: setCount.toString(),
      reroll: rerollCount.toString(),
    })
    return `/lobby?${params.toString()}`
  }, [participantCount, rerollCount, setCount])

  const decrease = () => setSetCount((prev) => Math.max(prev - 1, MIN_SET_COUNT))
  const increase = () => setSetCount((prev) => Math.min(prev + 1, MAX_SET_COUNT))
  const decreaseParticipants = () =>
    setParticipantCount((prev) => Math.max(prev - 1, MIN_PARTICIPANT_COUNT))
  const increaseParticipants = () =>
    setParticipantCount((prev) => Math.min(prev + 1, MAX_PARTICIPANT_COUNT))
  const decreaseReroll = () => setRerollCount((prev) => Math.max(prev - 1, MIN_REROLL_COUNT))
  const increaseReroll = () => setRerollCount((prev) => Math.min(prev + 1, MAX_REROLL_COUNT))

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch (error) {
      console.error('초대 링크 복사에 실패했습니다.', error)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-8 shadow-surface backdrop-blur-lg">
        <header className="text-center">
          <p className="text-sm uppercase tracking-[0.45em] text-primary/70">{t('appTitle')}</p>
          <h1 className="mt-3 text-3xl font-display text-neutral-50">{t('appTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t('appDescription')}</p>
        </header>

        <section className="mt-10 space-y-6">
          <div className="flex items-center justify-between rounded-2xl bg-surface-muted/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl text-primary">
                👥
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-100">
                  {t('controls.participants.label')}
                </p>
                <p className="text-xs text-neutral-400">
                  {t('controls.participants.helper', { count: MAX_PARTICIPANT_COUNT })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white"
                onClick={decreaseParticipants}
                aria-label="참가자 수 감소"
              >
                –
              </button>
              <span className="min-w-[2rem] text-center text-xl font-bold text-neutral-50">
                {participantCount}
              </span>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white"
                onClick={increaseParticipants}
                aria-label="참가자 수 증가"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-surface-muted/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl text-primary">
                ↻
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-100">{t('controls.sets.label')}</p>
                <p className="text-xs text-neutral-400">
                  {t('controls.sets.helper', { count: MAX_SET_COUNT })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white"
                onClick={decrease}
                aria-label="세트 수 감소"
              >
                –
              </button>
              <span className="min-w-[2rem] text-center text-xl font-bold text-neutral-50">
                {setCount}
              </span>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white"
                onClick={increase}
                aria-label="세트 수 증가"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-surface-muted/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl text-primary">
                ♻️
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-100">
                  {t('controls.reroll.label')}
                </p>
                <p className="text-xs text-neutral-400">{t('controls.reroll.helper')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white"
                onClick={decreaseReroll}
                aria-label="증강 새로고침 감소"
              >
                –
              </button>
              <span className="min-w-[2rem] text-center text-xl font-bold text-neutral-50">
                {rerollCount}
              </span>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white"
                onClick={increaseReroll}
                aria-label="증강 새로고침 증가"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">
              {t('invite.title')}
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
        </section>

        <Link
          to={lobbyLink}
          className="mt-10 block rounded-full bg-primary px-8 py-3 text-center text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80"
        >
          {t('navigation.toLobby')}
        </Link>
      </div>
    </div>
  )
}
