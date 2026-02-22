/**
 * 개발용 로비 페이지 테스트
 * Firebase 없이도 로비 기능을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /lobby?roomId=test-room 접근
 * 3. 로비 기능 테스트 (Mock 데이터 사용)
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Copy, Check, Crown, SquarePen } from 'lucide-react'
import clsx from 'clsx'
import { withGuestSessionRetry } from '../lib/user-id'
import { useRoom, type Room, type Player, type RoomStatus } from '../hooks/useRoom'
import { getFirebaseApp } from '../lib/firebase'
import {
  joinRoom as joinRoomCallable,
  leaveRoom as leaveRoomCallable,
  setPlayerReady as setPlayerReadyCallable,
  startGame as startGameCallable,
  updatePlayerName as updatePlayerNameCallable,
} from '../lib/firebase-functions'
import { getRoomJoinToken, setRoomJoinToken } from '../lib/room-join-token'
import {
  generateNicknameData,
  formatNickname,
  type NicknameData,
} from '../utils/nickname-generator'
import { resolvePlayerDisplayName } from '../lib/player-name'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

// Mock 데이터 생성 함수
function createMockRoom(roomId: string): Room {
  return {
    title: `테스트 룸 (${roomId})`,
    maxPlayers: 2,
    roundCount: 3,
    rerollLimit: 2,
    rerollUsed: 0,
    status: 'waiting' as RoomStatus,
    currentSet: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createMockPlayers(playerId: string): Player[] {
  // 처음 로비 생성 시 호스트만 생성 (다른 플레이어들은 연결 중 상태)
  const players: Player[] = []
  // 호스트 기본 닉네임은 실제 경로와 동일하게 playerId 기반으로 고정한다.
  players.push({
    id: playerId || 'test-host-id',
    name: resolvePlayerDisplayName(playerId || 'test-host-id'),
    isHost: true,
    isReady: true, // 호스트는 기본적으로 준비됨
    selectedAugments: [],
    joinedAt: new Date(),
  })
  return players
}

function registerWaitingRoomExitLeaveHandlers(onLeave: () => void): () => void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      onLeave()
    }
  }

  window.addEventListener('pagehide', onLeave)
  window.addEventListener('beforeunload', onLeave)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.removeEventListener('pagehide', onLeave)
    window.removeEventListener('beforeunload', onLeave)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

export function LobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isDev = true

  const roomId = searchParams.get('roomId')
  const { room, players, loading, error: roomError } = useRoom(roomId)
  const hasRealtimeData = room !== null && players.length > 0
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string>(
    localStorage.getItem('dev_player_id') || '',
  )
  const [sessionToken, setSessionToken] = useState<string>('')
  const [roomJoinToken, setRoomJoinTokenState] = useState<string | null>(
    roomId ? getRoomJoinToken(roomId) : null,
  )
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)
  const [joinAttemptCount, setJoinAttemptCount] = useState(0)
  const RELOAD_REDIRECT_KEY = 'lobby.reload.redirect'
  const RELOAD_REDIRECT_WINDOW_MS = 10000
  const hasLeaveSentRef = useRef(false)
  const roomIdRef = useRef<string | null>(null)
  const playerIdRef = useRef<string>('')
  const sessionTokenRef = useRef<string>('')
  const roomJoinTokenRef = useRef<string | null>(null)
  const roomStatusRef = useRef<RoomStatus | null>(null)

  useEffect(() => {
    const navigationEntry = performance
      .getEntriesByType('navigation')
      .find(
        (entry): entry is PerformanceNavigationTiming =>
          entry instanceof PerformanceNavigationTiming,
      )

    if (navigationEntry?.type !== 'reload') return
    const raw = sessionStorage.getItem(RELOAD_REDIRECT_KEY)
    if (!raw) return
    sessionStorage.removeItem(RELOAD_REDIRECT_KEY)
    try {
      const parsed = JSON.parse(raw) as { roomId?: string; at?: number }
      const isRecent =
        typeof parsed.at === 'number' && Date.now() - parsed.at <= RELOAD_REDIRECT_WINDOW_MS
      const isSameRoom =
        typeof parsed.roomId === 'string' && parsed.roomId.length > 0 && parsed.roomId === roomId
      if (isRecent && isSameRoom) {
        navigate('/', { replace: true })
      }
    } catch {
      // ignore malformed redirect flag
    }
  }, [navigate, roomId])

  // 현재 브라우저 세션의 게스트 식별자를 사용
  useEffect(() => {
    void withGuestSessionRetry(async (session) => {
      setResolvedPlayerId(session.guestId)
      setSessionToken(session.sessionToken)
      return null
    })
  }, [])

  useEffect(() => {
    setRoomJoinTokenState(roomId ? getRoomJoinToken(roomId) : null)
  }, [roomId])

  useEffect(() => {
    setJoinAttemptCount(0)
  }, [roomId, resolvedPlayerId])

  const playerId = resolvedPlayerId

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    playerIdRef.current = playerId
  }, [playerId])

  useEffect(() => {
    sessionTokenRef.current = sessionToken
  }, [sessionToken])

  useEffect(() => {
    roomJoinTokenRef.current = roomJoinToken
  }, [roomJoinToken])

  useEffect(() => {
    roomStatusRef.current = room?.status ?? null
  }, [room?.status])

  const getLeaveRoomUrl = (): string | null => {
    const projectId = getFirebaseApp().options.projectId
    if (!projectId) return null
    const region = 'asia-northeast3'
    const useEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
    if (useEmulator) {
      const emulatorHost = import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1'
      const emulatorPort = Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001)
      return `http://${emulatorHost}:${emulatorPort}/${projectId}/${region}/leaveRoomOnUnload`
    }
    return `https://${region}-${projectId}.cloudfunctions.net/leaveRoomOnUnload`
  }

  const postLeaveKeepalive = (payload: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
  }): void => {
    const url = getLeaveRoomUrl()
    if (!url) return
    const body = JSON.stringify(payload)

    // unload 상황에서는 preflight까지 기다리기 어려워서 text/plain 형태로 보낸다.
    if (typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(url, body)
      if (sent) return
    }

    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      mode: 'no-cors',
    }).catch(() => {
      // 페이지 종료 직전 실패는 다시 처리하기 어려워서 무시한다.
    })
  }

  const getWaitingRoomLeavePayload = (): {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
  } | null => {
    if (roomStatusRef.current !== 'waiting') return null

    const rid = roomIdRef.current
    const pid = playerIdRef.current
    const st = sessionTokenRef.current
    const jt = roomJoinTokenRef.current
    if (!rid || !pid || !st || !jt) return null

    return {
      roomId: rid,
      playerId: pid,
      sessionToken: st,
      joinToken: jt,
    }
  }

  const tryLeaveRoomOnExit = (): void => {
    if (hasLeaveSentRef.current) return
    const payload = getWaitingRoomLeavePayload()
    if (!payload) return
    hasLeaveSentRef.current = true
    sessionStorage.setItem(
      RELOAD_REDIRECT_KEY,
      JSON.stringify({ roomId: payload.roomId, at: Date.now() }),
    )
    postLeaveKeepalive(payload)
  }

  // 현재 브라우저 playerId를 저장해 두면 다음 화면/재접속에서 재사용하기 쉽다.
  useEffect(() => {
    if (!playerId) return
    localStorage.setItem('dev_player_id', playerId)
  }, [playerId])

  // 탭 종료/새로고침 때 waiting 상태 참가자를 서버에서 정리하려고 이벤트를 등록한다.
  useEffect(() => {
    return registerWaitingRoomExitLeaveHandlers(tryLeaveRoomOnExit)
  }, [])

  // 외부 링크로 나갈 때는 unload 전에 먼저 leave를 보내 보려고 클릭 캡처를 사용한다.
  useEffect(() => {
    const handleDocumentClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      try {
        const destination = new URL(anchor.href, window.location.href)
        if (destination.origin !== window.location.origin) {
          tryLeaveRoomOnExit()
        }
      } catch {
        // 잘못된 URL이면 그냥 무시
      }
    }

    document.addEventListener('click', handleDocumentClickCapture, true)
    return () => {
      document.removeEventListener('click', handleDocumentClickCapture, true)
    }
  }, [])

  // TODO(multiplayer):
  // 네트워크 끊김은 unload만으로 못 잡을 수 있어서 나중에 heartbeat + TTL 정리가 필요하다.

  // SPA 내부 이동으로 컴포넌트가 사라질 때도 waiting 상태면 leaveRoom을 한 번 더 시도한다.
  useEffect(() => {
    return () => {
      if (hasLeaveSentRef.current) return
      const payload = getWaitingRoomLeavePayload()
      if (!payload) return
      hasLeaveSentRef.current = true
      void leaveRoomCallable(payload).catch(() => {
        // 언마운트 중 실패는 복구하기 어려워서 무시
      })
    }
  }, [])

  const shouldAutoJoinRoom = (): boolean => {
    if (!roomId || !room || isJoiningRoom) return false
    if (room.status !== 'waiting') return false
    if (joinAttemptCount >= 2) return false
    return true
  }

  const handleAutoJoinRoomFailure = (error: unknown) => {
    setJoinAttemptCount((count) => count + 1)
    setErrorMessage(t('navigation.createFailed'))
    console.warn('[LobbyPage] joinRoom callable failed:', error)
  }

  const reportLobbyActionError = (logMessage: string, error: unknown, messageKey: string) => {
    console.error(logMessage, error)
    setErrorMessage(t(messageKey))
  }

  const requireRealtimeRoomActionRoomId = (): string => {
    if (!hasRealtimeData || !roomId) {
      throw new Error('Room is not ready for realtime actions')
    }
    return roomId
  }

  const requireSessionToken = (): string => {
    if (!sessionToken) {
      throw new Error('Missing session/join token')
    }
    return sessionToken
  }

  const runAutoJoinRoom = async () => {
    if (!roomId) return

    await withGuestSessionRetry(async (session) => {
      const activePlayerId = session.guestId

      if (resolvedPlayerId !== activePlayerId) {
        setResolvedPlayerId(activePlayerId)
      }
      if (sessionToken !== session.sessionToken) {
        setSessionToken(session.sessionToken)
      }

      const isAlreadyInRoom = players.some((player) => player.id === activePlayerId)
      if (isAlreadyInRoom && roomJoinToken) {
        return null
      }

      const playerName = resolvePlayerDisplayName(activePlayerId)
      const response = await joinRoomCallable({
        roomId,
        playerId: activePlayerId,
        sessionToken: session.sessionToken,
        playerName,
      })

      setRoomJoinToken(roomId, response.data.joinToken, response.data.joinTokenExpiresAtMillis)
      setRoomJoinTokenState(response.data.joinToken)
      setJoinAttemptCount(0)
      return null
    })
  }

  // 룸 링크로 진입한 플레이어를 자동 참가 처리
  useEffect(() => {
    if (!shouldAutoJoinRoom()) return

    setIsJoiningRoom(true)

    void runAutoJoinRoom()
      .catch(handleAutoJoinRoomFailure)
      .finally(() => {
        setIsJoiningRoom(false)
      })
  }, [
    roomId,
    room,
    players,
    resolvedPlayerId,
    sessionToken,
    isJoiningRoom,
    roomJoinToken,
    joinAttemptCount,
    t,
  ])

  // 게임 설정을 localStorage에서 가져오기 (개선 사항 3)
  const roomConfig = (() => {
    try {
      const saved = localStorage.getItem('dev_room_config')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (err) {
      console.warn('[LobbyPageTest] Failed to load room config from localStorage:', err)
    }
    // 기본값
    return {
      playerCount: 2,
      roundCount: 3,
      rerollLimit: 2,
    }
  })()

  const playerCount = roomConfig.playerCount
  const roundCount = room?.roundCount ?? roomConfig.roundCount
  const rerollLimit = room?.rerollLimit ?? roomConfig.rerollLimit

  // Mock 데이터 (localStorage에서 가져온 정보 사용)
  const mockRoom = {
    ...createMockRoom(roomId || 'test-room-123'),
    maxPlayers: playerCount,
    roundCount,
    rerollLimit,
  }
  const effectiveMaxPlayers = room?.maxPlayers ?? playerCount
  const [mockPlayers, setMockPlayers] = useState<Player[]>(() => {
    const fresh = createMockPlayers(playerId || 'test-host-id')
    try {
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )
      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
        localStorage.getItem('dev_player_nickname_data') || '{}',
      )
      return fresh.map((p) => {
        if (!p.id) return p
        if (customNames[p.id]) return { ...p, name: customNames[p.id] }
        if (nicknameDataMap[p.id]) return { ...p, name: formatNickname(nicknameDataMap[p.id]) }
        return p
      })
    } catch {
      return fresh
    }
  })

  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlVisible, setIsUrlVisible] = useState(false)
  const [isNameEditDialogOpen, setIsNameEditDialogOpen] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [isComposing, setIsComposing] = useState(false)

  const shouldRefreshJoinToken = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const maybe = error as { code?: string; message?: string }
    if (maybe.code !== 'functions/permission-denied') return false
    return typeof maybe.message === 'string' && maybe.message.includes('Room join token')
  }

  const resolveRejoinPlayerName = (): string => {
    const currentName = players.find((p) => p.id === playerId)?.name
    if (currentName && currentName.trim().length > 0) {
      return currentName
    }
    return resolvePlayerDisplayName(playerId)
  }

  const withJoinTokenRetry = async <T,>(
    operation: (joinToken: string) => Promise<T>,
  ): Promise<T> => {
    if (!roomId || !playerId || !sessionToken) {
      throw new Error('Missing room join context')
    }
    if (!roomJoinToken) {
      throw new Error('Missing room join token')
    }
    try {
      return await operation(roomJoinToken)
    } catch (error) {
      if (!shouldRefreshJoinToken(error)) {
        throw error
      }
      const rejoinResponse = await joinRoomCallable({
        roomId,
        playerId,
        sessionToken,
        playerName: resolveRejoinPlayerName(),
      })
      setRoomJoinToken(
        roomId,
        rejoinResponse.data.joinToken,
        rejoinResponse.data.joinTokenExpiresAtMillis,
      )
      setRoomJoinTokenState(rejoinResponse.data.joinToken)
      return operation(rejoinResponse.data.joinToken)
    }
  }

  useEffect(() => {
    if (roomError) setErrorMessage(t('navigation.createFailed'))
  }, [t, roomError])

  useEffect(() => {
    if (!roomId) {
      navigate('/', { replace: true })
      return
    }
    if (!loading && !room) {
      navigate('/', { replace: true })
    }
  }, [loading, navigate, room, roomId])

  useEffect(() => {
    if (!roomId || !room || !playerId) return

    if (room.status === 'horseSelection') {
      const params = new URLSearchParams({ roomId, playerId })
      navigate(`/horse-selection?${params.toString()}`, { replace: true })
      return
    }

    if (
      room.status === 'augmentSelection' ||
      room.status === 'racing' ||
      room.status === 'setResult'
    ) {
      const params = new URLSearchParams({ roomId, playerId })
      navigate(`/race?${params.toString()}`, { replace: true })
      return
    }

    if (room.status === 'finished') {
      const params = new URLSearchParams({ roomId, playerId })
      navigate(`/race-result?${params.toString()}`, { replace: true })
    }
  }, [navigate, playerId, room, roomId])

  // 입력값 검증: 숫자, 영어, 한글, 공백만 허용, 2-12자
  const isValidName = (name: string): boolean => {
    if (name.length < 2 || name.length > 12) return false
    return /^[a-zA-Z0-9가-힣\s]+$/.test(name)
  }

  const nameError = newPlayerName.trim()
    ? isValidName(newPlayerName.trim())
      ? null
      : newPlayerName.trim().length < 2
        ? '이름은 최소 2자 이상이어야 합니다.'
        : newPlayerName.trim().length > 12
          ? '이름은 최대 12자까지 입력할 수 있습니다.'
          : '숫자, 영어, 한글, 공백만 사용할 수 있습니다.'
    : null
  const [selectedPlayerSlot] = useState<string>('host')

  // 언어 변경 감지
  const { i18n } = useTranslation()

  // 언어 변경 시 플레이어 이름 업데이트
  useEffect(() => {
    try {
      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
        localStorage.getItem('dev_player_nickname_data') || '{}',
      )
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )

      setMockPlayers((prev) =>
        prev.map((player) => {
          if (!player.id) return player

          // 커스텀 이름이 있으면 우선 사용
          if (customNames[player.id]) {
            return { ...player, name: customNames[player.id] }
          }

          // 닉네임 데이터로 현재 언어로 포맷
          if (nicknameDataMap[player.id]) {
            return { ...player, name: formatNickname(nicknameDataMap[player.id]) }
          }

          return player
        }),
      )
    } catch (err) {
      console.warn('[LobbyPageTest] Failed to update player names on language change:', err)
    }
  }, [i18n.language])

  useEffect(() => {
    if (!isDev) {
      navigate('/')
    }
  }, [isDev, navigate])

  // playerCount가 변경되면 mockPlayers 업데이트 (기존 저장 이름은 localStorage에서 복원)
  useEffect(() => {
    const fresh = createMockPlayers(playerId)
    try {
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )
      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
        localStorage.getItem('dev_player_nickname_data') || '{}',
      )
      setMockPlayers(
        fresh.map((p) => {
          if (!p.id) return p
          if (customNames[p.id]) return { ...p, name: customNames[p.id] }
          if (nicknameDataMap[p.id]) return { ...p, name: formatNickname(nicknameDataMap[p.id]) }
          return p
        }),
      )
    } catch {
      setMockPlayers(fresh)
    }
  }, [playerCount, playerId])

  // mockPlayers가 변경될 때마다 닉네임 데이터를 localStorage에 저장
  useEffect(() => {
    try {
      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
        localStorage.getItem('dev_player_nickname_data') || '{}',
      )

      // 모든 플레이어의 닉네임 데이터를 저장
      mockPlayers.forEach((player) => {
        if (player.id && !nicknameDataMap[player.id]) {
          // 새로운 플레이어는 닉네임 데이터 생성
          nicknameDataMap[player.id] = generateNicknameData()
        }
      })

      localStorage.setItem('dev_player_nickname_data', JSON.stringify(nicknameDataMap))

      // 실제 참여한 플레이어 ID 목록도 저장 (RacePageTest에서 사용)
      const playerIds = mockPlayers.map((p) => p.id).filter((id): id is string => !!id)
      localStorage.setItem('dev_player_ids', JSON.stringify(playerIds))
    } catch (err) {
      console.warn('[LobbyPageTest] Failed to save nickname data to localStorage:', err)
    }
  }, [mockPlayers, playerId])

  // 테스트 페이지에서 실제 페이지의 navigate를 가로채서 테스트 페이지로 리다이렉트
  useEffect(() => {
    if (!isDev) return

    const currentPath = location.pathname
    const searchParams = new URLSearchParams(location.search)
    const roomIdParam = searchParams.get('roomId')
    const playerIdParam = searchParams.get('playerId')

    // /horse-selection로 이동하려고 할 때 /horse-selection로 리다이렉트
    if (currentPath === '/horse-selection') {
      const params = new URLSearchParams()
      if (roomIdParam) params.set('roomId', roomIdParam)
      if (playerIdParam) params.set('playerId', playerIdParam)
      navigate(`/horse-selection?${params.toString()}`, { replace: true })
    }
  }, [isDev, navigate, location.pathname, location.search])

  // 선택된 슬롯에 따라 현재 플레이어 찾기
  const displayRoom = room ?? mockRoom
  const lobbyDataMode = hasRealtimeData ? 'realtime' : 'mock'
  const isRealtimeLobbyMode = lobbyDataMode === 'realtime'
  const displayPlayers = isRealtimeLobbyMode ? players : mockPlayers
  const realtimeCurrentPlayer = players.find((p) => p.id === playerId) ?? null
  const displayGuestPlayers = displayPlayers.filter((p) => !p.isHost)

  const currentPlayer = isRealtimeLobbyMode
    ? realtimeCurrentPlayer
    : selectedPlayerSlot === 'host'
      ? mockPlayers.find((p) => p.isHost) || null
      : selectedPlayerSlot.startsWith('player-')
        ? mockPlayers.find(
            (p) => !p.isHost && p.id === selectedPlayerSlot.replace('player-', ''),
          ) || null
        : null

  const isCurrentUserHost = isRealtimeLobbyMode
    ? !!realtimeCurrentPlayer?.isHost
    : selectedPlayerSlot === 'host'

  const isPlayerCurrentUser = (player: Player | undefined, mockSlotValue: string): boolean => {
    if (isRealtimeLobbyMode) {
      return !!player && player.id === playerId
    }
    return selectedPlayerSlot === mockSlotValue
  }

  // 호스트 제외 전원이 준비되어야 시작 가능
  const guestPlayers = displayPlayers.filter((p) => !p.isHost)
  const isAllGuestsReady = guestPlayers.length >= 1 && guestPlayers.every((p) => p.isReady)

  // 초대 URL 생성
  const inviteUrl = roomId ? `${window.location.origin}/lobby?roomId=${roomId}` : ''

  // 준비 상태 토글 (Realtime 우선, 실패 시 Mock fallback)
  const handleToggleReady = async () => {
    if (!currentPlayer || isTogglingReady) return

    const targetPlayerId = currentPlayer.id
    if (!targetPlayerId) return

    setIsTogglingReady(true)
    setErrorMessage(null)

    try {
      const activeRoomId = requireRealtimeRoomActionRoomId()
      await withJoinTokenRetry(async (joinToken) => {
        await setPlayerReadyCallable({
          roomId: activeRoomId,
          playerId: targetPlayerId,
          sessionToken,
          joinToken,
          isReady: !currentPlayer.isReady,
        })
      })
    } catch (err) {
      reportLobbyActionError('Failed to toggle ready status:', err, 'lobby.readyToggleFailed')
    } finally {
      setIsTogglingReady(false)
    }
  }

  // 게임 시작 (Realtime 우선, 실패 시 Mock fallback)
  const handleStart = async () => {
    if (!roomId || !playerId || !sessionToken || !roomJoinToken || isStarting || !isAllGuestsReady)
      return

    setIsStarting(true)
    setErrorMessage(null)

    try {
      requireRealtimeRoomActionRoomId()
      await withJoinTokenRetry(async (joinToken) => {
        await startGameCallable({ roomId, playerId, sessionToken, joinToken })
      })

      // room.status 구독으로 전원 페이지 전환을 동기화한다.
    } catch (err) {
      reportLobbyActionError('Failed to start game:', err, 'lobby.startFailed')
      setIsStarting(false)
    }
  }

  const showCopiedState = () => {
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const tryCopyWithClipboardApi = async (text: string): Promise<boolean> => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error)
      return false
    }
  }

  const tryCopyWithExecCommand = (text: string): boolean => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-999999px'
    textarea.style.top = '-999999px'

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
      return document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const showInviteUrlAndSelectText = () => {
    setIsUrlVisible(true)

    const urlElement = document.querySelector('[data-invite-url]') as HTMLSpanElement | null
    if (!urlElement) return

    const range = document.createRange()
    range.selectNodeContents(urlElement)
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const handleCopy = async () => {
    if (!inviteUrl) return

    const copiedWithClipboardApi = await tryCopyWithClipboardApi(inviteUrl)
    if (copiedWithClipboardApi) {
      showCopiedState()
      return
    }

    try {
      const copiedWithExecCommand = tryCopyWithExecCommand(inviteUrl)
      if (!copiedWithExecCommand) throw new Error('execCommand failed')
      showCopiedState()
    } catch (error) {
      console.error('All copy methods failed:', error)
      showInviteUrlAndSelectText()
    }
  }

  const handleOpenNameEdit = (player: Player) => {
    setEditingPlayerId(player.id ?? null)
    setNewPlayerName(player.name ?? '')
    setIsComposing(false)
    setIsNameEditDialogOpen(true)
  }

  const getValidatedEditedPlayerName = (): { playerId: string; trimmedName: string } | null => {
    if (!editingPlayerId) return null

    const trimmedName = newPlayerName.trim()
    if (!trimmedName) return null
    if (!isValidName(trimmedName)) return null

    return { playerId: editingPlayerId, trimmedName }
  }

  const updateMockPlayerName = (targetPlayerId: string, trimmedName: string) => {
    setMockPlayers((prev) =>
      prev.map((player) =>
        player.id === targetPlayerId ? { ...player, name: trimmedName } : player,
      ),
    )
  }

  const persistMockPlayerCustomName = (targetPlayerId: string, trimmedName: string) => {
    try {
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )
      customNames[targetPlayerId] = trimmedName
      localStorage.setItem('dev_player_custom_names', JSON.stringify(customNames))
    } catch (err) {
      console.warn('[LobbyPageTest] Failed to save custom name to localStorage:', err)
    }
  }

  const saveRealtimePlayerName = async (targetPlayerId: string, trimmedName: string) => {
    const activeRoomId = requireRealtimeRoomActionRoomId()
    const activeSessionToken = requireSessionToken()

    await withJoinTokenRetry(async (joinToken) => {
      await updatePlayerNameCallable({
        roomId: activeRoomId,
        playerId: targetPlayerId,
        sessionToken: activeSessionToken,
        joinToken,
        name: trimmedName,
      })
    })
  }

  const saveMockPlayerName = (targetPlayerId: string, trimmedName: string) => {
    updateMockPlayerName(targetPlayerId, trimmedName)
    persistMockPlayerCustomName(targetPlayerId, trimmedName)
  }

  const closeNameEditDialog = () => {
    setIsNameEditDialogOpen(false)
    setEditingPlayerId(null)
    setNewPlayerName('')
  }

  const handleSaveName = async () => {
    const nameEditInput = getValidatedEditedPlayerName()
    if (!nameEditInput) return

    const { playerId: targetPlayerId, trimmedName } = nameEditInput

    try {
      if (hasRealtimeData && roomId) {
        await saveRealtimePlayerName(targetPlayerId, trimmedName)
      } else {
        saveMockPlayerName(targetPlayerId, trimmedName)
      }
    } catch (err) {
      reportLobbyActionError('Failed to update player name:', err, 'navigation.createFailed')
      return
    }

    closeNameEditDialog()
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
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-surface backdrop-blur-lg">
          <header className="mb-6 text-center">
            <h1 className="mt-2 text-2xl font-display text-foreground">{t('lobby.title')}</h1>
            <p className="mt-2 text-xs text-muted-foreground">{t('lobby.subtitle')}</p>
            {displayRoom?.title && (
              <p className="mt-1 text-xs text-foreground0">{displayRoom.title}</p>
            )}
          </header>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <ul className="space-y-3">
            {/* 호스트는 항상 표시 */}
            {(() => {
              const host = displayPlayers.find((p) => p.isHost)
              if (!host) return null

              const isCurrentUser = isPlayerCurrentUser(host, 'host')

              return (
                <li
                  key="host"
                  className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-surface-muted/80 px-3 sm:px-4 py-3"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg text-muted-foreground">
                    1
                  </div>
                  <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                    <span className="flex items-center justify-center flex-shrink-0">
                      <Crown className="h-4 w-4 text-yellow-400" />
                    </span>
                    <div className="flex flex-1 min-w-0 items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {host.name || 'Host'}
                      </p>
                      {isCurrentUser && (editingPlayerId !== host.id || !isNameEditDialogOpen) && (
                        <button
                          type="button"
                          onClick={() => handleOpenNameEdit(host)}
                          className="flex-shrink-0 text-muted-foreground transition hover:text-foreground"
                          aria-label={t('lobby.editName', { defaultValue: '이름 수정' })}
                        >
                          <SquarePen className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })()}

            {/* 일반 플레이어 슬롯 (maxPlayers - 1개) */}
            {Array.from({ length: effectiveMaxPlayers - 1 }).map((_, idx) => {
              const player = displayGuestPlayers[idx]
              const isConnected = player !== undefined
              const slotPlayerId = player?.id ?? `player-${idx + 1}`
              const isCurrentUser = isPlayerCurrentUser(player, `player-${slotPlayerId}`)

              return (
                <li
                  key={`slot-${idx}`}
                  className={`flex items-center gap-2 sm:gap-3 rounded-2xl px-3 sm:px-4 py-3 ${
                    isConnected
                      ? 'bg-surface-muted/80'
                      : 'bg-surface-muted/40 border-2 border-dashed border-border'
                  }`}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg text-muted-foreground">
                    {idx + 2}
                  </div>
                  <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                    {isCurrentUser && isConnected && (
                      <Badge
                        variant="outline"
                        className="border-primary/50 bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary flex-shrink-0"
                      >
                        {t('lobby.me', { defaultValue: '나' })}
                      </Badge>
                    )}
                    <div className="flex flex-1 min-w-0 items-center gap-2">
                      {isConnected ? (
                        <>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {player.name || `Player ${idx + 2}`}
                          </p>
                          {isCurrentUser &&
                            !player.isReady &&
                            (editingPlayerId !== player.id || !isNameEditDialogOpen) && (
                              <button
                                type="button"
                                onClick={() => handleOpenNameEdit(player)}
                                className="flex-shrink-0 text-muted-foreground transition hover:text-foreground"
                                aria-label={t('lobby.editName', { defaultValue: '이름 수정' })}
                              >
                                <SquarePen className="h-3.5 w-3.5" />
                              </button>
                            )}
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-muted-foreground truncate">
                          {/* 빈칸 */}
                        </p>
                      )}
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge
                      variant="outline"
                      className={
                        player.isReady
                          ? 'inline-flex items-center gap-1 border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success flex-shrink-0'
                          : 'inline-flex items-center gap-1 border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning flex-shrink-0'
                      }
                    >
                      {player.isReady ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      ) : (
                        <Spinner className="text-warning" size={12} />
                      )}
                      {player.isReady ? t('lobby.status.ready') : t('lobby.status.preparing')}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="inline-flex items-center gap-1 border-muted-foreground/40 bg-muted-foreground/10 px-2 py-0.5 text-[10px] text-muted-foreground flex-shrink-0"
                    >
                      연결 중
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>

          {/* 초대 링크 */}
          <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              {t('lobby.invite')}
            </p>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-background/80 px-4 py-3 text-sm text-foreground">
                <span
                  data-invite-url
                  className="block flex-1 whitespace-nowrap select-text overflow-x-auto scrollbar-hide"
                >
                  {isUrlVisible ? inviteUrl : '••••••••••••••••••••••••••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsUrlVisible(!isUrlVisible)}
                  className="flex-shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label={isUrlVisible ? t('lobby.urlHide') : t('lobby.urlShow')}
                >
                  {isUrlVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/80"
                aria-label={t('lobby.copy')}
              >
                {isCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* 준비 버튼 (참가 유저만) */}
          {currentPlayer && !isCurrentUserHost && (
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
                  ? t('lobby.processing')
                  : currentPlayer.isReady
                    ? t('lobby.readyCancel')
                    : t('lobby.readyToggle')}
              </button>
            </div>
          )}

          {/* 게임 시작 버튼 (호스트만) */}
          {isCurrentUserHost && (
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={!isAllGuestsReady || isStarting || guestPlayers.length < 1}
                className="w-full rounded-full border border-transparent bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-muted-foreground"
              >
                {isStarting ? t('lobby.starting') : t('lobby.startGame')}
              </button>
              {!isAllGuestsReady && (
                <p className="text-center text-xs text-muted-foreground">
                  {t('lobby.startWaiting')}
                </p>
              )}
            </div>
          )}
        </div>

      {/* 이름 수정 다이얼로그 */}
      <Dialog open={isNameEditDialogOpen} onOpenChange={setIsNameEditDialogOpen}>
        <DialogContent className="max-w-md w-[90%] rounded-3xl border-none bg-surface [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>{t('lobby.editName', { defaultValue: '이름 수정' })}</DialogTitle>
            <DialogDescription>
              {t('lobby.editNameDescription', {
                defaultValue: '플레이어 이름을 변경할 수 있습니다.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative">
              <Input
                value={newPlayerName}
                onChange={(e) => {
                  const value = e.target.value
                  // 조합 중이면 필터링하지 않고 그대로 설정
                  if (isComposing) {
                    setNewPlayerName(value)
                    return
                  }
                  // 조합 완료 후에도 입력은 자유롭게 허용 (검증은 별도로)
                  // 최대 12자 제한만 적용
                  if (value.length <= 12) {
                    setNewPlayerName(value)
                  } else {
                    setNewPlayerName(value.slice(0, 12))
                  }
                }}
                onCompositionStart={() => {
                  setIsComposing(true)
                }}
                onCompositionEnd={() => {
                  setIsComposing(false)
                }}
                placeholder={t('lobby.playerNamePlaceholder', {
                  defaultValue: '플레이어 이름',
                })}
                maxLength={12}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveName()
                  }
                }}
                autoFocus
                className={clsx(
                  'pr-12',
                  nameError && 'border-destructive focus-visible:ring-destructive',
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {Math.min(newPlayerName.length, 12)}/12
              </span>
            </div>
            {nameError && <p className="mt-2 text-sm text-destructive">{nameError}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              숫자, 영어, 한글, 공백만 사용 가능합니다. (2-12자)
            </p>
          </div>
          <DialogFooter className="!flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsNameEditDialogOpen(false)
                setEditingPlayerId(null)
                setNewPlayerName('')
              }}
            >
              {t('common.cancel', { defaultValue: '취소' })}
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={!newPlayerName.trim() || !isValidName(newPlayerName.trim())}
            >
              {t('common.save', { defaultValue: '저장' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
