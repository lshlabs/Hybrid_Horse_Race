import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createRoom } from '../lib/firebase-functions'
import { getUserId } from '../lib/user-id'

const MIN_SET_COUNT = 1
const MAX_SET_COUNT = 5

const MIN_PARTICIPANT_COUNT = 2
const MAX_PARTICIPANT_COUNT = 8

const MIN_REROLL_COUNT = 0
const MAX_REROLL_COUNT = 5

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [setCount, setSetCount] = useState(3)
  const [participantCount, setParticipantCount] = useState(4)
  const [rerollCount, setRerollCount] = useState(2)
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlVisible, setIsUrlVisible] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inviteUrl = useMemo(() => {
    if (!roomId) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/lobby?roomId=${roomId}`
  }, [roomId])
  
  const lobbyLink = useMemo(() => {
    if (!roomId) return '/lobby'
    return `/lobby?roomId=${roomId}`
  }, [roomId])

  const decrease = () => setSetCount((prev) => Math.max(prev - 1, MIN_SET_COUNT))
  const increase = () => setSetCount((prev) => Math.min(prev + 1, MAX_SET_COUNT))
  const decreaseParticipants = () =>
    setParticipantCount((prev) => Math.max(prev - 1, MIN_PARTICIPANT_COUNT))
  const increaseParticipants = () =>
    setParticipantCount((prev) => Math.min(prev + 1, MAX_PARTICIPANT_COUNT))
  const decreaseReroll = () => setRerollCount((prev) => Math.max(prev - 1, MIN_REROLL_COUNT))
  const increaseReroll = () => setRerollCount((prev) => Math.min(prev + 1, MAX_REROLL_COUNT))

  const handleCreateRoom = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    setError(null)
    
    try {
      const hostId = getUserId()
      const title = `Room ${new Date().toLocaleTimeString()}`
      
      console.log('Creating room with:', { hostId, title, setCount, rerollLimit: rerollCount })
      
      const result = await createRoom({
        hostId,
        title,
        setCount,
        rerollLimit: rerollCount,
      })
      
      console.log('Room created successfully:', result.data)
      
      const newRoomId = result.data.roomId
      setRoomId(newRoomId)
      
      // 룸 생성 후 바로 로비로 이동 (roomId를 직접 사용)
      console.log('Navigating to lobby with roomId:', newRoomId)
      navigate(`/lobby?roomId=${newRoomId}`)
    } catch (err: any) {
      console.error('Failed to create room:', err)
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        details: err.details,
        stack: err.stack,
      })
      
      // 더 자세한 에러 메시지 표시
      let errorMessage = '룸 생성에 실패했습니다.'
      if (err.message) {
        errorMessage += ` (${err.message})`
      } else if (err.code) {
        errorMessage += ` (코드: ${err.code})`
      }
      setError(errorMessage)
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('초대 링크 복사에 실패했습니다.', error)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-4 sm:p-8 shadow-surface backdrop-blur-lg">
        <header className="text-center">
          <h1 className="mt-3 text-3xl font-display text-neutral-50">{t('appTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t('appDescription')}</p>
        </header>

        <section className="mt-10 space-y-6">
          <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-surface-muted/70 px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl text-primary">
                👥
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100 truncate">
                  {t('controls.participants.label')}
                </p>
                <p className="text-xs text-neutral-400 line-clamp-1">
                  {t('controls.participants.helper', { count: MAX_PARTICIPANT_COUNT })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                type="button"
                disabled={participantCount <= MIN_PARTICIPANT_COUNT}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-neutral-200"
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
                disabled={participantCount >= MAX_PARTICIPANT_COUNT}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-neutral-200"
                onClick={increaseParticipants}
                aria-label="참가자 수 증가"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-surface-muted/70 px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl text-primary">
                ↻
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100 truncate">
                  {t('controls.sets.label')}
                </p>
                <p className="text-xs text-neutral-400 line-clamp-1">
                  {t('controls.sets.helper', { count: MAX_SET_COUNT })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                type="button"
                disabled={setCount <= MIN_SET_COUNT}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-neutral-200"
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
                disabled={setCount >= MAX_SET_COUNT}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-neutral-200"
                onClick={increase}
                aria-label="세트 수 증가"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-surface-muted/70 px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl text-primary">
                ♻️
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100 truncate">
                  {t('controls.reroll.label')}
                </p>
                <p className="text-xs text-neutral-400 line-clamp-1">
                  {t('controls.reroll.helper')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                type="button"
                disabled={rerollCount <= MIN_REROLL_COUNT}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-neutral-200"
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
                disabled={rerollCount >= MAX_REROLL_COUNT}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/10 text-lg text-neutral-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-neutral-200"
                onClick={increaseReroll}
                aria-label="증강 새로고침 증가"
              >
                +
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {roomId && (
            <div className="space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">
                {t('invite.title')}
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
          )}
        </section>
        
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="mt-10 w-full rounded-full bg-primary px-8 py-3 text-center text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? '룸 생성 중...' : t('navigation.toLobby')}
        </button>
      </div>
    </div>
  )
}
