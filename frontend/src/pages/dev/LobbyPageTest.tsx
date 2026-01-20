/**
 * 개발용 로비 페이지 테스트
 * Firebase 없이도 로비 기능을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /lobby-test?roomId=test-room 접근
 * 3. 로비 기능 테스트 (Mock 데이터 사용)
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getUserId } from '../../lib/user-id'
import type { Room, Player, RoomStatus } from '../../hooks/useRoom'

// Mock 데이터 생성 함수
function createMockRoom(roomId: string, userId: string): Room {
  return {
    hostId: userId || 'test-host-id',
    title: `테스트 룸 (${roomId})`,
    setCount: 3,
    rerollLimit: 2,
    rerollUsed: 0,
    status: 'waiting' as RoomStatus,
    currentSet: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createMockPlayers(count: number = 2, userId: string): Player[] {
  const players: Player[] = []
  for (let i = 0; i < count; i++) {
    players.push({
      id: i === 0 ? userId || 'test-host-id' : `player-${i}`,
      name: i === 0 ? '테스트 호스트' : `플레이어 ${i}`,
      isHost: i === 0,
      isReady: i === 0, // 호스트는 기본적으로 준비됨
      selectedAugments: [],
      joinedAt: new Date(),
    })
  }
  return players
}

export function LobbyPageTest() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isDev = import.meta.env.DEV

  const roomId = searchParams.get('roomId') || 'test-room-123'
  const urlPlayerId = searchParams.get('playerId')
  const userId = getUserId()

  // URL에서 룸 설정 정보 가져오기
  const participantCount = Number.parseInt(searchParams.get('participantCount') || '2', 10)
  const setCount = Number.parseInt(searchParams.get('setCount') || '3', 10)
  const rerollLimit = Number.parseInt(searchParams.get('rerollLimit') || '2', 10)

  // Mock 데이터 (URL 파라미터에서 가져온 정보 사용)
  const mockRoom = useMemo(
    () => ({
      ...createMockRoom(roomId, userId || ''),
      setCount,
      rerollLimit,
    }),
    [roomId, userId, setCount, rerollLimit],
  )
  const [mockPlayers, setMockPlayers] = useState<Player[]>(() =>
    createMockPlayers(participantCount, userId || ''),
  )

  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playerId] = useState<string | null>(urlPlayerId || null)
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlVisible, setIsUrlVisible] = useState(false)

  useEffect(() => {
    if (!isDev) {
      navigate('/')
    }
  }, [isDev, navigate])

  // participantCount가 변경되면 mockPlayers 업데이트
  useEffect(() => {
    setMockPlayers(createMockPlayers(participantCount, userId || ''))
  }, [participantCount, userId])

  // 테스트 페이지에서 실제 페이지의 navigate를 가로채서 테스트 페이지로 리다이렉트
  useEffect(() => {
    if (!isDev) return

    const currentPath = location.pathname
    const searchParams = new URLSearchParams(location.search)
    const roomIdParam = searchParams.get('roomId')
    const playerIdParam = searchParams.get('playerId')

    // /horse-selection로 이동하려고 할 때 /horse-selection-test로 리다이렉트
    if (currentPath === '/horse-selection') {
      console.log(
        '[LobbyPageTest] Intercepting navigation to /horse-selection, redirecting to /horse-selection-test',
      )
      const params = new URLSearchParams()
      if (roomIdParam) params.set('roomId', roomIdParam)
      if (playerIdParam) params.set('playerId', playerIdParam)
      navigate(`/horse-selection-test?${params.toString()}`, { replace: true })
    }
  }, [isDev, navigate, location.pathname, location.search])

  // 현재 플레이어 찾기
  const currentPlayer = useMemo(() => {
    if (!userId) return null
    return mockPlayers.find(
      (p) => (p.isHost && mockRoom.hostId === userId) || (!p.isHost && p.id === playerId),
    )
  }, [mockPlayers, mockRoom.hostId, userId, playerId])

  const isCurrentUserHost = mockRoom.hostId === userId

  // 모든 플레이어가 준비되었는지 확인
  const isAllReady = useMemo(() => {
    if (mockPlayers.length < 2) return false
    return mockPlayers.every((p) => p.isReady)
  }, [mockPlayers])

  // 초대 URL 생성
  const inviteUrl = useMemo(() => {
    if (!roomId) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/lobby-test?roomId=${roomId}`
  }, [roomId])

  // 준비 상태 토글 (Mock)
  const handleToggleReady = useCallback(async () => {
    if (!currentPlayer || isTogglingReady) return

    setIsTogglingReady(true)
    setErrorMessage(null)

    // Mock: 약간의 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 300))

    try {
      setMockPlayers((prev) =>
        prev.map((p) => (p.id === currentPlayer.id ? { ...p, isReady: !p.isReady } : p)),
      )
    } catch (err) {
      console.error('Failed to toggle ready status:', err)
      setErrorMessage('준비 상태 변경에 실패했습니다.')
    } finally {
      setIsTogglingReady(false)
    }
  }, [currentPlayer, isTogglingReady])

  // 게임 시작 (Mock)
  const handleStart = useCallback(async () => {
    if (!roomId || !userId || isStarting || !isAllReady) return

    setIsStarting(true)
    setErrorMessage(null)

    // Mock: 약간의 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      console.log('[LobbyPageTest] Starting game (mock)')
      // Mock: 룸 상태를 runStyleSelection으로 변경
      // 실제로는 테스트 페이지로 이동
      const params = new URLSearchParams({ roomId })
      if (playerId) params.set('playerId', playerId)
      // participantCount도 전달 (RacePageTest에서 사용)
      params.set('participantCount', participantCount.toString())
      params.set('setCount', setCount.toString())
      params.set('rerollLimit', rerollLimit.toString())
      navigate(`/horse-selection-test?${params.toString()}`)
    } catch (err) {
      console.error('Failed to start game:', err)
      setErrorMessage('게임 시작에 실패했습니다.')
      setIsStarting(false)
    }
  }, [
    roomId,
    userId,
    isStarting,
    isAllReady,
    playerId,
    navigate,
    participantCount,
    setCount,
    rerollLimit,
  ])

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

  // 플레이어 추가 (테스트용)
  const handleAddPlayer = () => {
    if (mockPlayers.length >= participantCount) return
    setMockPlayers((prev) => [
      ...prev,
      {
        id: `player-${prev.length}`,
        name: `플레이어 ${prev.length}`,
        isHost: false,
        isReady: false,
        selectedAugments: [],
        joinedAt: new Date(),
      },
    ])
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
          <h2 className="mb-2 text-lg font-bold">🧪 로비 페이지 테스트 모드</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <p className="text-gray-300">
              개발 모드에서는 Firebase 연결 없이도 로비 기능을 테스트할 수 있습니다.
            </p>
            <div>
              <span className="text-gray-400">Room ID: </span>
              <span className="font-mono">{roomId}</span>
            </div>
            <div>
              <span className="text-gray-400">User ID: </span>
              <span className="font-mono">{userId || 'N/A'}</span>
            </div>
            <button
              onClick={() => {
                // 모든 플레이어를 준비 완료 상태로 변경
                setMockPlayers((prev) => prev.map((p) => ({ ...p, isReady: true })))
                console.log('[LobbyPageTest] 모든 플레이어를 준비 완료 상태로 변경했습니다.')
              }}
              className="rounded bg-green-600 px-3 py-1 hover:bg-green-700"
            >
              모든 플레이어 준비 완료
            </button>
          </div>
        </div>
      </div>

      {/* 독립적으로 구현한 로비 UI */}
      <div className="flex min-h-full items-start justify-center pt-24 pb-8">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-surface backdrop-blur-lg">
          <header className="mb-6 text-center">
            <h1 className="mt-2 text-2xl font-display text-neutral-50">{t('lobby.title')}</h1>
            <p className="mt-2 text-xs text-neutral-400">{t('lobby.subtitle')}</p>
            {mockRoom?.title && <p className="mt-1 text-xs text-neutral-500">{mockRoom.title}</p>}
          </header>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <ul className="space-y-3">
            {mockPlayers.map((player, index) => {
              const isCurrentUser = player.isHost
                ? mockRoom?.hostId === userId
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
            {mockPlayers.length < participantCount &&
              Array.from({ length: participantCount - mockPlayers.length }).map((_, index) => {
                const emptySlotIndex = mockPlayers.length + index + 1
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

          {/* 테스트용: 플레이어 추가 버튼 */}
          {mockPlayers.length < participantCount && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAddPlayer}
                className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/10"
              >
                + 플레이어 추가 (테스트용)
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
                {isTogglingReady ? '처리 중...' : currentPlayer.isReady ? '준비 취소' : '준비하기'}
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
                disabled={!isAllReady || isStarting || mockPlayers.length < 2}
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
    </div>
  )
}
