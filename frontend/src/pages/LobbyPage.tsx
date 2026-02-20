/**
 * 개발용 로비 페이지 테스트
 * Firebase 없이도 로비 기능을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /lobby?roomId=test-room 접근
 * 3. 로비 기능 테스트 (Mock 데이터 사용)
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Copy, Check, Crown, SquarePen } from 'lucide-react'
import clsx from 'clsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { getUserId } from '../lib/user-id'
import type { Room, Player, RoomStatus } from '../hooks/useRoom'
import {
  generateNicknameData,
  formatNickname,
  type NicknameData,
} from '../utils/nickname-generator'
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
  // 호스트만 생성 (닉네임 데이터 생성)
  const hostNicknameData = generateNicknameData()
  players.push({
    id: playerId || 'test-host-id',
    name: formatNickname(hostNicknameData),
    isHost: true,
    isReady: true, // 호스트는 기본적으로 준비됨
    selectedAugments: [],
    joinedAt: new Date(),
  })
  return players
}

export function LobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isDev = true

  const roomId = searchParams.get('roomId') || 'test-room-123'
  const urlPlayerId = searchParams.get('playerId')

  // playerId 생성 책임 (개선 사항 1)
  // URL에 playerId가 없으면 신규 플레이어로 간주하고 생성
  const playerId = urlPlayerId || getUserId()

  // playerId를 localStorage에 저장 (개선 사항 7)
  useEffect(() => {
    localStorage.setItem('dev_player_id', playerId)
  }, [playerId])

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
  const roundCount = roomConfig.roundCount
  const rerollLimit = roomConfig.rerollLimit

  // Mock 데이터 (localStorage에서 가져온 정보 사용)
  const mockRoom = {
    ...createMockRoom(roomId),
    roundCount,
    rerollLimit,
  }
  const [mockPlayers, setMockPlayers] = useState<Player[]>(() => {
    const fresh = createMockPlayers(playerId)
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
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true)

  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlVisible, setIsUrlVisible] = useState(false)
  const [isNameEditDialogOpen, setIsNameEditDialogOpen] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [isComposing, setIsComposing] = useState(false)

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
  const [selectedPlayerSlot, setSelectedPlayerSlot] = useState<string>('host')

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
  const currentPlayer =
    selectedPlayerSlot === 'host'
      ? mockPlayers.find((p) => p.isHost)
      : selectedPlayerSlot.startsWith('player-')
        ? mockPlayers.find((p) => !p.isHost && p.id === selectedPlayerSlot.replace('player-', ''))
        : null

  const isCurrentUserHost = selectedPlayerSlot === 'host'

  // 모든 플레이어가 준비되었는지 확인
  const isAllReady = mockPlayers.length >= 2 && mockPlayers.every((p) => p.isReady)

  // 초대 URL 생성
  const inviteUrl = roomId ? `${window.location.origin}/lobby?roomId=${roomId}` : ''

  // 준비 상태 토글 (Mock)
  const handleToggleReady = async () => {
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
      setErrorMessage(t('lobby.readyToggleFailed'))
    } finally {
      setIsTogglingReady(false)
    }
  }

  // 게임 시작 (Mock)
  const handleStart = async () => {
    if (!roomId || !playerId || isStarting || !isAllReady) return

    setIsStarting(true)
    setErrorMessage(null)

    // Mock: 약간의 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      // Mock: 룸 상태를 horseSelection으로 변경
      // 실제로는 테스트 페이지로 이동 (roomId와 playerId만 전달, 설정은 localStorage에서)
      const params = new URLSearchParams({ roomId, playerId })
      navigate(`/horse-selection?${params.toString()}`)
    } catch (err) {
      console.error('Failed to start game:', err)
      setErrorMessage(t('lobby.startFailed'))
      setIsStarting(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return

    try {
      // 최신 Clipboard API 시도
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
        return
      }
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error)
    }

    // 폴백: document.execCommand 사용
    try {
      // 임시 textarea 생성
      const textarea = document.createElement('textarea')
      textarea.value = inviteUrl
      textarea.style.position = 'fixed'
      textarea.style.left = '-999999px'
      textarea.style.top = '-999999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()

      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (successful) {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      } else {
        // 모바일에서도 실패한 경우: 텍스트 선택 유도
        throw new Error('execCommand failed')
      }
    } catch (error) {
      console.error('All copy methods failed:', error)
      // 마지막 대안: URL을 보여주고 수동 선택 유도
      setIsUrlVisible(true)
      // URL 입력 필드를 선택 가능하게 만들기
      const urlElement = document.querySelector('[data-invite-url]') as HTMLSpanElement
      if (urlElement) {
        const range = document.createRange()
        range.selectNodeContents(urlElement)
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }
  }

  const handleOpenNameEdit = (player: Player) => {
    setEditingPlayerId(player.id ?? null)
    setNewPlayerName(player.name ?? '')
    setIsComposing(false)
    setIsNameEditDialogOpen(true)
  }

  const handleSaveName = () => {
    if (!editingPlayerId || !newPlayerName.trim()) return

    // 검증 실패 시 저장하지 않음
    if (!isValidName(newPlayerName.trim())) return

    const trimmedName = newPlayerName.trim()
    setMockPlayers((prev) =>
      prev.map((p) => (p.id === editingPlayerId ? { ...p, name: trimmedName } : p)),
    )

    // 커스텀 이름을 별도 저장소에 저장 (다음 페이지로 전달)
    try {
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )
      customNames[editingPlayerId] = trimmedName
      localStorage.setItem('dev_player_custom_names', JSON.stringify(customNames))
    } catch (err) {
      console.warn('[LobbyPageTest] Failed to save custom name to localStorage:', err)
    }

    setIsNameEditDialogOpen(false)
    setEditingPlayerId(null)
    setNewPlayerName('')
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
          aria-label="배너 펼치기"
        >
          <span className="text-sm">▼ 개발 배너</span>
        </button>
      ) : (
        /* 펼쳤을 때: 전체 배너 표시 */
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 p-4 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🧪 로비 페이지 테스트 모드</h2>
              <button
                onClick={() => setIsBannerCollapsed(true)}
                className="ml-4 rounded bg-gray-700/50 px-3 py-1 text-sm transition hover:bg-gray-700/70"
                aria-label="배너 접기"
              >
                ▲
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-gray-400">Room ID: </span>
                <span className="font-mono">{roomId}</span>
              </div>
              <div>
                <span className="text-gray-400">Player ID: </span>
                <span className="font-mono">{playerId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">설정: </span>
                <span className="font-mono">
                  {playerCount}명 / {roundCount}라운드 / 리롤 {rerollLimit}회
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">내 슬롯: </span>
                <Select value={selectedPlayerSlot} onValueChange={setSelectedPlayerSlot}>
                  <SelectTrigger className="h-8 w-32 bg-gray-700/50 text-white border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="host">호스트</SelectItem>
                    {mockPlayers
                      .filter((p) => !p.isHost)
                      .map((p, idx) => (
                        <SelectItem key={p.id} value={`player-${p.id}`}>
                          플레이어 {idx + 1}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-400">플레이어 상태:</span>
                {Array.from({ length: playerCount - 1 }).map((_, idx) => {
                  // 플레이어 인덱스는 1부터 시작 (0은 호스트이므로 제외)
                  const playerId = `player-${idx + 1}`
                  const player = mockPlayers.find((p) => !p.isHost && p.id === playerId)
                  const isConnected = player !== undefined

                  return (
                    <div key={`slot-${idx}`} className="flex items-center gap-1">
                      <span className="text-gray-300">P{idx + 1}:</span>
                      <Select
                        value={
                          !isConnected ? 'disconnected' : player.isReady ? 'ready' : 'preparing'
                        }
                        onValueChange={(value) => {
                          if (value === 'disconnected') {
                            // 플레이어 제거 (연결 중 상태)
                            setMockPlayers((prev) => prev.filter((p) => p.id !== playerId))
                          } else if (value === 'preparing' || value === 'ready') {
                            if (!isConnected) {
                              // 플레이어 추가 (연결) - 세션 참여 시 닉네임 데이터 생성
                              const nicknameData = generateNicknameData()

                              // 닉네임 데이터 저장
                              try {
                                const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
                                  localStorage.getItem('dev_player_nickname_data') || '{}',
                                )
                                nicknameDataMap[playerId] = nicknameData
                                localStorage.setItem(
                                  'dev_player_nickname_data',
                                  JSON.stringify(nicknameDataMap),
                                )
                              } catch (err) {
                                console.warn('[LobbyPageTest] Failed to save nickname data:', err)
                              }

                              const newPlayer: Player = {
                                id: playerId,
                                name: formatNickname(nicknameData),
                                isHost: false,
                                isReady: value === 'ready',
                                selectedAugments: [],
                                joinedAt: new Date(),
                              }
                              setMockPlayers((prev) => [...prev, newPlayer])
                            } else {
                              // 상태 변경
                              setMockPlayers((prev) =>
                                prev.map((p) =>
                                  p.id === playerId ? { ...p, isReady: value === 'ready' } : p,
                                ),
                              )
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 w-28 bg-gray-700/50 text-white border-gray-600 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="disconnected">연결 중</SelectItem>
                          <SelectItem value="preparing">준비 중</SelectItem>
                          <SelectItem value="ready">준비 완료</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
                <button
                  onClick={() => {
                    // 모든 플레이어를 준비 완료로
                    setMockPlayers((prev) => prev.map((p) => ({ ...p, isReady: true })))
                  }}
                  className="rounded bg-green-600 px-2 py-1 text-xs hover:bg-green-700"
                >
                  모두 준비완료
                </button>
                <button
                  onClick={() => {
                    // 모든 플레이어를 참여 상태로 만들고 준비 중으로 설정
                    setMockPlayers((prev) => {
                      const updated = prev.map((p) => ({ ...p, isReady: false }))

                      // 연결 중 상태인 플레이어들도 모두 참여 상태로 추가
                      const existingPlayerIds = new Set(updated.map((p) => p.id))
                      const newPlayers: Player[] = []
                      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
                        localStorage.getItem('dev_player_nickname_data') || '{}',
                      )

                      for (let i = 1; i < playerCount; i++) {
                        const playerId = `player-${i}`
                        if (!existingPlayerIds.has(playerId)) {
                          const nicknameData = generateNicknameData()
                          nicknameDataMap[playerId] = nicknameData

                          newPlayers.push({
                            id: playerId,
                            name: formatNickname(nicknameData),
                            isHost: false,
                            isReady: false,
                            selectedAugments: [],
                            joinedAt: new Date(),
                          })
                        }
                      }

                      // 닉네임 데이터 일괄 저장
                      try {
                        localStorage.setItem(
                          'dev_player_nickname_data',
                          JSON.stringify(nicknameDataMap),
                        )
                      } catch (err) {
                        console.warn('[LobbyPageTest] Failed to save nickname data:', err)
                      }

                      return [...updated, ...newPlayers]
                    })
                  }}
                  className="rounded bg-yellow-600 px-2 py-1 text-xs hover:bg-yellow-700"
                >
                  모두 준비중
                </button>
              </div>
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

      {/* 독립적으로 구현한 로비 UI */}
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-surface backdrop-blur-lg">
          <header className="mb-6 text-center">
            <h1 className="mt-2 text-2xl font-display text-foreground">{t('lobby.title')}</h1>
            <p className="mt-2 text-xs text-muted-foreground">{t('lobby.subtitle')}</p>
            {mockRoom?.title && <p className="mt-1 text-xs text-foreground0">{mockRoom.title}</p>}
          </header>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <ul className="space-y-3">
            {/* 호스트는 항상 표시 */}
            {(() => {
              const host = mockPlayers.find((p) => p.isHost)
              if (!host) return null

              const isCurrentUser = selectedPlayerSlot === 'host'

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

            {/* 일반 플레이어 슬롯 (playerCount - 1개) */}
            {Array.from({ length: playerCount - 1 }).map((_, idx) => {
              const playerId = `player-${idx + 1}`
              const player = mockPlayers.find((p) => !p.isHost && p.id === playerId)
              const isConnected = player !== undefined
              const isCurrentUser = selectedPlayerSlot === `player-${playerId}`

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
                            {player.name || `Player ${idx + 1}`}
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
                disabled={!isAllReady || isStarting || mockPlayers.length < 2}
                className="w-full rounded-full border border-transparent bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-muted-foreground"
              >
                {isStarting ? t('lobby.starting') : t('lobby.startGame')}
              </button>
              {!isAllReady && (
                <p className="text-center text-xs text-muted-foreground">
                  {t('lobby.startWaiting')}
                </p>
              )}
            </div>
          )}
        </div>
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
