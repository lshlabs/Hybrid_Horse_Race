/**
 * 개발용 테스트 페이지
 * Firebase 없이도 PhaserGame과의 통신을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /race-test 접근
 * 3. 브라우저 콘솔에서 데이터 확인
 */

/* eslint-disable */

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { clearDevTestStorage } from '../../lib/dev-storage'
import { useTranslation } from 'react-i18next'
import { PhaserGame } from '../../components/game/PhaserGame'
import type { Room, Player } from '../../hooks/useRoom'
import type { Stats } from '../../engine/race/types'
import { formatNickname, type NicknameData } from '../../utils/nickname-generator'

interface SavedHorseData {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

export function RacePageTest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('roomId') || 'test-room-123'
  const playerId =
    searchParams.get('playerId') || localStorage.getItem('dev_player_id') || 'player-0'

  // 게임 설정을 localStorage에서 가져오기 (개선 사항 3)
  const roomConfig = (() => {
    try {
      const saved = localStorage.getItem('dev_room_config')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (err) {
      console.warn('[RacePageTest] Failed to load room config from localStorage:', err)
    }
    // 기본값
    return {
      playerCount: 4,
      roundCount: 3,
      rerollLimit: 2,
    }
  })()

  const playerCount = roomConfig.playerCount
  const roundCount = roomConfig.roundCount
  const rerollLimit = roomConfig.rerollLimit

  const [selectedHorse, setSelectedHorse] = useState<SavedHorseData | null>(null)
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true)

  // 최종 결과 이벤트 구독 (라운드 결과만 받음)
  useEffect(() => {
    const handleFinalResult = (event: Event) => {
      const customEvent = event as CustomEvent<{
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
      }>

      // 최종 결과 페이지로 이동 (라운드 결과 전달, 최종 순위는 결과 페이지에서 계산)
      navigate('/race-result-test', {
        state: {
          roundResults: customEvent.detail.roundResults,
          playerCount: customEvent.detail.playerCount,
          roomId: customEvent.detail.roomId || roomId,
          playerId: customEvent.detail.playerId || playerId,
          playerName: customEvent.detail.playerName,
        },
      })
    }

    window.addEventListener('race-final-result', handleFinalResult)

    return () => {
      window.removeEventListener('race-final-result', handleFinalResult)
    }
  }, [navigate, roomId, playerId])

  // HorseSelectionPageTest에서 전달된 데이터 확인 및 로그 출력
  useEffect(() => {
    if (!import.meta.env.DEV) return
  }, [roomId, playerId])

  // localStorage에서 선택한 말 데이터 읽기 (개선 사항 4: playerId 기준 구조)
  useEffect(() => {
    if (!import.meta.env.DEV || !playerId) return

    const loadHorseData = () => {
      try {
        const saved = localStorage.getItem('dev_selected_horses')
        if (saved) {
          const horsesData = JSON.parse(saved) as Record<string, SavedHorseData>
          const horseData = horsesData[playerId]
          if (horseData) {
            // 값이 실제로 변경되었을 때만 상태 업데이트 (무한 루프 방지)
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

    // 초기 로드
    loadHorseData()

    // localStorage 변경 감지 (다른 탭에서 변경된 경우)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dev_selected_horses') {
        loadHorseData()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 주기적으로 확인 (같은 탭에서 변경된 경우) - 하지만 값이 변경되었을 때만 업데이트
    const interval = setInterval(loadHorseData, 2000) // 500ms -> 2000ms로 변경하여 빈도 감소

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [playerId])

  // Mock Room 데이터 생성 (localStorage의 설정값 사용)
  const mockRoom: Room = {
    title: `테스트 룸 (${roomId})`,
    roundCount,
    rerollLimit,
    rerollUsed: 0,
    status: 'racing',
    currentSet: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // 언어 감지
  const { i18n } = useTranslation()

  // localStorage에서 플레이어 목록을 읽는 공통 함수 (마운트 시·언어 변경 시 동일 로직)
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

  // 마운트 시 항상 localStorage에서 최신 플레이어/닉네임 로드 (로비에서 바꾼 이름이 반영되도록)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    setMockPlayers(loadMockPlayersFromStorage())
  }, [])

  // 언어 변경 시 플레이어 이름 업데이트 (간단한 방식)
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

  const finalMockPlayers = mockPlayers

  // 개발 모드 확인
  const isDev = import.meta.env.DEV

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
      {/* 개발용 컨트롤 패널 */}
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
              <h2 className="text-lg font-bold">🧪 개발 테스트 모드</h2>
              <button
                onClick={() => setIsBannerCollapsed(true)}
                className="ml-4 rounded bg-gray-700/50 px-3 py-1 text-sm transition hover:bg-gray-700/70"
                aria-label="배너 접기"
              >
                ▲
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-400">Room ID: </span>
                <span className="font-mono">{roomId}</span>
              </div>
              <div>
                <span className="text-gray-400">Player ID: </span>
                <span className="font-mono">{playerId}</span>
              </div>
              <div>
                <span className="text-gray-400">설정: </span>
                <span className="font-mono">
                  {playerCount}명 / {roundCount}라운드 / 리롤 {rerollLimit}회
                </span>
              </div>
              <div>
                <span className="text-gray-400">Room Status: </span>
                <span className="font-mono">{mockRoom.status}</span>
              </div>
              {selectedHorse && (
                <div className="flex items-center gap-2 rounded bg-green-600/20 px-3 py-1 border border-green-500/40">
                  <span className="text-green-400">말:</span>
                  <span className="font-mono text-green-300">{selectedHorse.name}</span>
                </div>
              )}
              <button
                onClick={() => {
                  clearDevTestStorage()
                  navigate('/landing-test')
                }}
                className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
              >
                🔄 처음부터 다시 테스트
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PhaserGame 컴포넌트 */}
      <div className="flex w-full flex-1 items-center justify-center overflow-hidden">
        <div className="max-w-full">
          <PhaserGame
            aspectRatioWidth={1280}
            aspectRatioHeight={720}
            roomId={roomId}
            playerId={playerId}
            room={mockRoom}
            players={finalMockPlayers}
            selectedHorse={selectedHorse || undefined}
          />
        </div>
      </div>
    </div>
  )
}
