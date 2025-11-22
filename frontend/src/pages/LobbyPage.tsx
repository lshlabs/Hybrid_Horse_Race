import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoom } from '../hooks/useRoom'
import { joinRoom, setPlayerReady, startGame, leaveRoom } from '../lib/firebase-functions'
import { getUserId } from '../lib/user-id'
import type { RoomStatus } from '../hooks/useRoom'

const MAX_PLAYERS = 8

export function LobbyPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const roomId = searchParams.get('roomId')
  const urlPlayerId = searchParams.get('playerId') // URL에서 playerId 가져오기
  const userId = getUserId()
  
  const { room, players, loading, error } = useRoom(roomId)
  const [isJoining, setIsJoining] = useState(false)
  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlVisible, setIsUrlVisible] = useState(false)

  // URL에서 playerId 가져오기 (HorseSelectionPage에서 리다이렉트된 경우)
  useEffect(() => {
    if (urlPlayerId && !playerId) {
      console.log('[LobbyPage] Setting playerId from URL:', urlPlayerId)
      setPlayerId(urlPlayerId)
    }
  }, [urlPlayerId, playerId])

  // 룸이 없으면 랜딩 페이지로 리다이렉트
  useEffect(() => {
    if (!roomId) {
      navigate('/')
      return
    }
  }, [roomId, navigate])

  // 플레이어가 룸에 참가했는지 확인
  useEffect(() => {
    if (!roomId || !userId || loading) return

    // 호스트인 경우
    if (room?.hostId === userId) {
      const hostPlayer = players.find((p) => p.isHost)
      if (hostPlayer && !playerId) {
        setPlayerId(userId) // 호스트의 playerId는 userId와 동일
      }
      return
    }

    // 일반 플레이어인 경우
    // 1. URL에서 playerId 가져온 경우 (이미 참가한 플레이어)
    if (urlPlayerId) {
      const existingPlayer = players.find((p) => !p.isHost && p.id === urlPlayerId)
      if (existingPlayer && !playerId) {
        console.log('[LobbyPage] Setting playerId from URL:', urlPlayerId)
        setPlayerId(urlPlayerId)
        return
      }
    }

    // 2. 상태에 playerId가 있는 경우 확인
    if (playerId) {
      const existingPlayer = players.find((p) => !p.isHost && p.id === playerId)
      if (existingPlayer) {
        // 이미 참가한 플레이어
        return
      }
    }

    // 3. players 배열에서 일반 플레이어 찾기 (이미 참가한 플레이어)
    const foundPlayer = players.find((p) => !p.isHost)
    if (foundPlayer && foundPlayer.id && !playerId) {
      // 이미 참가한 플레이어 - playerId를 설정
      console.log('[LobbyPage] Found existing player, setting playerId:', foundPlayer.id)
      setPlayerId(foundPlayer.id)
      return
    }

    // 4. 방 상태가 waiting이고, 아직 참가하지 않은 경우 joinRoom 호출
    if (room?.status === 'waiting' && !isJoining && !playerId) {
      const existingPlayer = players.find((p) => !p.isHost)
      if (!existingPlayer) {
        // 일반 플레이어가 없으면 참가 시도
        console.log('[LobbyPage] Calling joinRoom - no existing player found')
        handleJoinRoom()
      }
    }
  }, [roomId, userId, players, room, loading, isJoining, playerId, urlPlayerId])

  // 현재 사용자 찾기
  const currentPlayer = useMemo(() => {
    if (!room || !userId) return null
    
    // 호스트인 경우
    if (room.hostId === userId) {
      return players.find((p) => p.isHost) || null
    }
    
    // 일반 플레이어인 경우 (playerId로 찾기)
    // playerId는 Firestore 문서 ID이므로 id 필드와 비교
    if (playerId) {
      return players.find((p) => p.id === playerId) || null
    }
    
    return null
  }, [room, userId, players, playerId])

  const isCurrentUserHost = room?.hostId === userId

  // 룸 상태에 따라 자동 리다이렉트
  useEffect(() => {
    if (!room || !roomId || loading) return

    const status = room.status as RoomStatus
    if (status === 'runStyleSelection') {
      const isHost = room.hostId === userId
      
      // 호스트인 경우 즉시 리다이렉트
      if (isHost) {
        const params = new URLSearchParams({ roomId })
        navigate(`/horse-selection?${params.toString()}`)
        return
      }
      
      // 일반 플레이어인 경우 playerId가 있어야 함
      // playerId가 없으면 players 배열에서 찾기
      let actualPlayerId = playerId
      
      if (!actualPlayerId) {
        // players 배열에서 일반 플레이어 찾기
        const foundPlayer = players.find((p) => !p.isHost)
        if (foundPlayer && foundPlayer.id) {
          actualPlayerId = foundPlayer.id
          // playerId 설정 (다음 렌더링을 위해)
          setPlayerId(foundPlayer.id)
          console.log('[LobbyPage] Setting playerId before redirect:', actualPlayerId)
        }
      }
      
      // playerId가 있으면 리다이렉트
      if (actualPlayerId) {
        const params = new URLSearchParams({ roomId })
        params.set('playerId', actualPlayerId)
        console.log('[LobbyPage] Redirecting to HorseSelectionPage with playerId:', actualPlayerId)
        navigate(`/horse-selection?${params.toString()}`)
      } else {
        console.warn('[LobbyPage] Cannot redirect: playerId not found', {
          playerId,
          playersCount: players.length,
          players: players.map(p => ({ id: p.id, isHost: p.isHost })),
        })
      }
    }
  }, [room, roomId, playerId, userId, players, loading, navigate])

  // 페이지 종료 시 자동으로 leaveRoom 호출
  // 주의: 페이지 이동 시에는 호출하지 않음 (cleanup에서 호출하지 않음)
  useEffect(() => {
    if (!room || !roomId || !userId) return
    
    const isHost = room.hostId === userId
    
    // 호스트는 나가기 처리 안 함
    if (isHost) {
      return
    }
    
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (!roomId || !playerId || !userId) return
      
      // 일반 플레이어만 나가기 처리
      // beforeunload 이벤트는 탭을 닫거나 페이지를 떠날 때만 발생
      // 페이지 이동 시에는 발생하지 않음
      
      // 비동기 작업이지만 beforeunload에서는 완료를 보장할 수 없음
      e.preventDefault()
      e.returnValue = ''
      
      // leaveRoom 호출 (완료를 보장할 수 없지만 시도)
      // sendBeacon API를 사용하면 더 안전하지만, 여기서는 일반 fetch 사용
      try {
        await leaveRoom({
          roomId,
          playerId,
        })
        console.log('[LobbyPage] Player left room on page unload:', playerId)
      } catch (error) {
        console.error('[LobbyPage] Failed to leave room on page unload:', error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // 컴포넌트 언마운트 시에는 leaveRoom을 호출하지 않음
      // 페이지 이동 시 cleanup이 실행되지만, 실제로 탭을 닫는 것이 아니므로
      // leaveRoom을 호출하면 안 됨
    }
  }, [roomId, playerId, userId, room])

  // 모든 플레이어가 준비되었는지 확인
  const isAllReady = useMemo(() => {
    if (!players || players.length < 2) return false
    return players.every((p) => p.isReady)
  }, [players])

  // 초대 URL 생성
  const inviteUrl = useMemo(() => {
    if (!roomId) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/lobby?roomId=${roomId}`
  }, [roomId])

  // 플레이어 참가
  const handleJoinRoom = async () => {
    if (!roomId || isJoining) return

    setIsJoining(true)
    setErrorMessage(null)

    try {
      const playerName = `Player ${Date.now() % 10000}`
      const result = await joinRoom({
        roomId,
        playerName,
      })

      setPlayerId(result.data.playerId)
    } catch (err: any) {
      console.error('Failed to join room:', err)
      setErrorMessage(err.message || '룸 참가에 실패했습니다.')
      setIsJoining(false)
    }
  }

  // 준비 상태 토글
  const handleToggleReady = async () => {
    if (!roomId || isTogglingReady) return
    
    // playerId가 없으면 currentPlayer에서 가져오기
    const actualPlayerId = playerId || currentPlayer?.id || (isCurrentUserHost ? userId : null)
    if (!actualPlayerId) {
      setErrorMessage('플레이어 정보를 찾을 수 없습니다.')
      return
    }

    setIsTogglingReady(true)
    setErrorMessage(null)

    try {
      const currentReady = currentPlayer?.isReady ?? false
      await setPlayerReady({
        roomId,
        playerId: actualPlayerId, // 호스트는 userId, 일반 플레이어는 playerId (Firestore 문서 ID)
        isReady: !currentReady,
      })
    } catch (err: any) {
      console.error('Failed to toggle ready status:', err)
      setErrorMessage(err.message || '준비 상태 변경에 실패했습니다.')
    } finally {
      setIsTogglingReady(false)
    }
  }

  // 게임 시작
  const handleStart = async () => {
    if (!roomId || !userId || isStarting || !isAllReady) return

    setIsStarting(true)
    setErrorMessage(null)

    try {
      await startGame({
        roomId,
        playerId: userId,
      })
      // 성공하면 자동으로 HorseSelectionPage로 리다이렉트됨 (useEffect에서 처리)
    } catch (err: any) {
      console.error('Failed to start game:', err)
      setErrorMessage(err.message || '게임 시작에 실패했습니다.')
      setIsStarting(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('invite link copy failed', error)
    }
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-neutral-200">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 에러
  if (error || !room) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-lg text-red-400">
            {error?.message || '룸을 찾을 수 없습니다.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-surface backdrop-blur-lg">
        <header className="mb-6 text-center">
          <h1 className="mt-2 text-2xl font-display text-neutral-50">{t('lobby.title')}</h1>
          <p className="mt-2 text-xs text-neutral-400">{t('lobby.subtitle')}</p>
          {room.title && <p className="mt-1 text-xs text-neutral-500">{room.title}</p>}
        </header>

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <ul className="space-y-3">
          {players.map((player, index) => {
            const isCurrentUser = player.isHost
              ? room.hostId === userId
              : player.id === playerId || player.id === currentPlayer?.id

            return (
              <li
                key={player.isHost ? 'host' : `player-${index}`}
                className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-surface-muted/80 px-3 sm:px-4 py-3"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg text-neutral-300">
                  {index + 1}
                </div>
                <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                  {player.isHost && (
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary flex-shrink-0">
                      {t('lobby.host')}
                    </span>
                  )}
                  {isCurrentUser && (
                    <span className="rounded-full border border-accent/50 bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent flex-shrink-0">
                      {t('lobby.me', { defaultValue: '나' })}
                    </span>
                  )}
                  <div className="flex flex-1 min-w-0 items-center">
                    <p className="text-sm font-semibold text-neutral-100 truncate">
                      {player.name || (player.isHost ? 'Host' : `Player ${index}`)}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    player.isReady
                      ? 'inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success flex-shrink-0'
                      : 'inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning flex-shrink-0'
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {player.isReady ? t('lobby.status.ready') : t('lobby.status.waiting')}
                </span>
              </li>
            )
          })}

          {/* 빈 슬롯 */}
          {players.length < MAX_PLAYERS &&
            Array.from({ length: MAX_PLAYERS - players.length }).map((_, index) => {
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

        {/* 현재 사용자가 아직 참가하지 않은 경우 */}
        {!currentPlayer && !isJoining && roomId && (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleJoinRoom}
              className="w-full rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80"
            >
              룸 참가하기
            </button>
          </div>
        )}

        {/* 준비 버튼 */}
        {currentPlayer && (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleToggleReady}
              disabled={isTogglingReady}
              className={`w-full rounded-full px-8 py-3 text-base font-semibold transition ${
                currentPlayer.isReady
                  ? 'border border-success/40 bg-success/10 text-success hover:bg-success/20'
                  : 'border border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isTogglingReady
                ? '처리 중...'
                : currentPlayer.isReady
                  ? '준비 취소'
                  : '준비하기'}
            </button>
          </div>
        )}

        {/* 초대 링크 */}
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
                {isUrlVisible ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/80"
              aria-label="복사"
            >
              {isCopied ? '✓' : '📋'}
            </button>
          </div>
        </div>

        {/* 게임 시작 버튼 */}
        <div className="mt-6 flex flex-col gap-2">
          {isCurrentUserHost && (
            <button
              type="button"
              onClick={handleStart}
              disabled={!isAllReady || isStarting || players.length < 2}
              className="w-full rounded-full border border-transparent bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-neutral-400"
            >
              {isStarting ? '게임 시작 중...' : t('lobby.startGame')}
            </button>
          )}
          {!isAllReady && (
            <p className="text-center text-xs text-neutral-400">{t('lobby.startWaiting')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
