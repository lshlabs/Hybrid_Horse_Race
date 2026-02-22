/**
 * 레이스 페이지
 * room/player/query/localStorage 데이터를 모아서 PhaserGame에 넘기는 페이지 역할을 한다.
 */

/* eslint-disable */

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PhaserGame } from '../components/game/PhaserGame'
import { useRoom, type Room, type Player } from '../hooks/useRoom'
import type { Stats } from '../engine/race/types'
import { formatNickname, type NicknameData } from '../utils/nickname-generator'
import { getGuestSession } from '../lib/user-id'
import { getRoomJoinToken } from '../lib/room-join-token'

interface SavedHorseData {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

interface RaceFinalResultDetail {
  roundResults: Array<
    Array<{
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: unknown[]
    }>
  >
  playerCount: number
  roomId?: string
  playerId?: string
  playerName?: string
}

export function RacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('roomId')
  const playerId =
    searchParams.get('playerId') || localStorage.getItem('dev_player_id') || 'player-0'
  const [sessionToken, setSessionToken] = useState('')
  const [roomJoinToken, setRoomJoinToken] = useState<string | null>(
    roomId ? getRoomJoinToken(roomId) : null,
  )
  const { room, players, loading } = useRoom(roomId)

  const navigateWithRoomAndPlayer = (pathname: '/lobby' | '/horse-selection' | '/race-result') => {
    // roomId/playerId를 유지해서 페이지 이동 후에도 같은 세션 흐름을 이어가게 한다.
    if (!roomId || !playerId) return
    const params = new URLSearchParams({ roomId, playerId })
    navigate(`${pathname}?${params.toString()}`, { replace: true })
  }

  const handleRoomStatusRedirect = (status: string) => {
    // room.status를 기준으로 잘못 들어온 페이지를 다시 맞는 화면으로 보낸다.
    if (status === 'waiting') {
      navigateWithRoomAndPlayer('/lobby')
      return
    }

    if (status === 'horseSelection') {
      navigateWithRoomAndPlayer('/horse-selection')
      return
    }

    if (status === 'finished') {
      navigateWithRoomAndPlayer('/race-result')
    }
  }

  const buildRaceResultNavigationState = (detail: RaceFinalResultDetail) => {
    // 결과 페이지가 필요한 값만 한 번에 넘기려고 state 객체를 여기서 정리한다.
    return {
      roundResults: detail.roundResults,
      playerCount: detail.playerCount,
      roomId: detail.roomId || roomId || '',
      playerId: detail.playerId || playerId,
      playerName: detail.playerName,
    }
  }

  useEffect(() => {
    void getGuestSession().then((session) => {
      setSessionToken(session.sessionToken)
    })
  }, [])

  useEffect(() => {
    setRoomJoinToken(roomId ? getRoomJoinToken(roomId) : null)
  }, [roomId])

  // 로비에서 저장한 게임 설정을 읽어오고, 없으면 기본값을 사용한다.
  const roomConfig = (() => {
    try {
      const saved = localStorage.getItem('dev_room_config')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (err) {
      console.warn('[RacePageTest] Failed to load room config from localStorage:', err)
    }
    // 저장된 값이 없을 때 기본값
    return {
      playerCount: 4,
      roundCount: 3,
      rerollLimit: 2,
    }
  })()

  const playerCount = players.length || roomConfig.playerCount
  const roundCount = room?.roundCount ?? roomConfig.roundCount
  const rerollLimit = room?.rerollLimit ?? roomConfig.rerollLimit

  const [selectedHorse, setSelectedHorse] = useState<SavedHorseData | null>(null)

  // RaceScene에서 보내는 최종 결과 커스텀 이벤트를 받아 결과 페이지로 이동한다.
  useEffect(() => {
    const handleFinalResult = (event: Event) => {
      const customEvent = event as CustomEvent<RaceFinalResultDetail>
      navigate('/race-result', {
        // 라운드 결과만 전달하고 최종 순위 계산은 결과 페이지에서 다시 한다.
        state: buildRaceResultNavigationState(customEvent.detail),
      })
    }

    window.addEventListener('race-final-result', handleFinalResult)

    return () => {
      window.removeEventListener('race-final-result', handleFinalResult)
    }
  }, [navigate, roomId, playerId])

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
    handleRoomStatusRedirect(room.status)
  }, [navigate, playerId, room, roomId])

  // 개발용 테스트 분기 자리(지금은 실제 분기 없이 자리만 남겨둠)
  useEffect(() => {
    if (!true) return
  }, [roomId, playerId])

  // localStorage에 저장된 내 말 선택 결과를 읽어서 PhaserGame 초기값으로 사용한다.
  useEffect(() => {
    if (!true || !playerId) return

    const loadHorseData = () => {
      try {
        const saved = localStorage.getItem('dev_selected_horses')
        if (saved) {
          const horsesData = JSON.parse(saved) as Record<string, SavedHorseData>
          const horseData = horsesData[playerId]
          if (horseData) {
            // 같은 값이면 상태를 다시 안 바꿔서 불필요한 렌더를 줄인다.
            setSelectedHorse((prev) => {
              if (
                prev &&
                prev.name === horseData.name &&
                prev.selectedAt === horseData.selectedAt
              ) {
                return prev // 변경 없으면 이전 값 유지
              }
              return horseData
            })
          }
        }
      } catch (err) {
        console.warn('[RacePageTest] Failed to read from localStorage:', err)
      }
    }

    // 첫 진입 시 1회 로드
    loadHorseData()

    // 다른 탭에서 localStorage가 바뀐 경우도 반영
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dev_selected_horses') {
        loadHorseData()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 같은 탭 변경은 storage 이벤트가 안 오므로 주기적으로도 확인한다.
    // 너무 자주 돌면 부담이라 2초 간격으로 둔다.
    const interval = setInterval(loadHorseData, 2000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [playerId])

  useEffect(() => {
    if (!playerId || players.length === 0) return
    const currentPlayer = players.find((p) => p.id === playerId)
    if (!currentPlayer?.horseStats) return

    const totalStats =
      currentPlayer.horseStats.Speed +
      currentPlayer.horseStats.Stamina +
      currentPlayer.horseStats.Power +
      currentPlayer.horseStats.Guts +
      currentPlayer.horseStats.Start +
      currentPlayer.horseStats.Luck

    setSelectedHorse({
      name: currentPlayer.name,
      stats: currentPlayer.horseStats,
      totalStats,
      selectedAt: new Date().toISOString(),
    })
  }, [playerId, players])

  // 실시간 room 데이터가 아직 없을 때도 PhaserGame을 띄우기 위한 기본 room 객체
  const mockRoom: Room = room ?? {
    title: `테스트 룸 (${roomId || 'test-room-123'})`,
    maxPlayers: playerCount,
    roundCount,
    rerollLimit,
    rerollUsed: 0,
    status: 'racing',
    currentSet: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // 닉네임 포맷이 언어 영향을 받을 수 있어서 language 변경도 본다.
  const { i18n } = useTranslation()

  // 개발용 mock 플레이어 목록을 localStorage에서 읽는 공통 함수
  // (마운트/언어변경에서 같은 로직을 재사용)
  const loadMockPlayersFromStorage = (): Player[] => {
    try {
      const playerIds: string[] = JSON.parse(localStorage.getItem('dev_player_ids') || '[]')
      const nicknameDataMap: Record<string, NicknameData> = JSON.parse(
        localStorage.getItem('dev_player_nickname_data') || '{}',
      )
      const customNames: Record<string, string> = JSON.parse(
        localStorage.getItem('dev_player_custom_names') || '{}',
      )
      const selectedHorses = JSON.parse(localStorage.getItem('dev_selected_horses') || '{}')

      if (playerIds.length === 0) {
        return []
      }

      return playerIds.map((id, index): Player => ({
        id,
        name:
          customNames[id] ||
          (nicknameDataMap[id] ? formatNickname(nicknameDataMap[id]) : `플레이어 ${index + 1}`),
        isHost: index === 0,
        isReady: true,
        selectedAugments: [] as Player['selectedAugments'],
        horseStats: selectedHorses[id]?.stats || undefined,
        joinedAt: new Date(),
      }))
    } catch (err) {
      console.warn('[RacePageTest] Failed to load players from localStorage:', err)
      return []
    }
  }

  const [mockPlayers, setMockPlayers] = useState<Player[]>([])

  // 첫 진입 때 로비에서 바꿔둔 이름/플레이어 목록을 바로 반영한다.
  useEffect(() => {
    if (!true) return
    setMockPlayers(loadMockPlayersFromStorage())
  }, [])

  // 언어 변경 시 자동 닉네임만 다시 포맷팅해서 화면에 반영
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

          if (customNames[player.id]) {
            return { ...player, name: customNames[player.id] }
          }

          if (nicknameDataMap[player.id]) {
            return { ...player, name: formatNickname(nicknameDataMap[player.id]) }
          }

          return player
        }),
      )
    } catch (err) {
      console.warn('[RacePageTest] Failed to update player names on language change:', err)
    }
  }, [i18n.language])

  const finalMockPlayers = players.length > 0 ? players : mockPlayers

  // 이 페이지는 개발용 테스트 성격이라 일반 배포 동선에서는 막아둔다.
  const isDev = true

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
    <div className="flex w-full flex-1 items-center justify-center overflow-hidden">
      {/* 실제 레이스 화면(Phaser) */}
      <div className="flex w-full flex-1 items-center justify-center overflow-hidden">
        <div className="max-w-full">
          <PhaserGame
            aspectRatioWidth={1280}
            aspectRatioHeight={720}
            roomId={roomId || undefined}
            playerId={playerId}
            sessionToken={sessionToken}
            roomJoinToken={roomJoinToken}
            room={mockRoom}
            players={finalMockPlayers}
            selectedHorse={selectedHorse || undefined}
          />
        </div>
      </div>
    </div>
  )
}
