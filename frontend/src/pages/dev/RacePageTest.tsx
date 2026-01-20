/**
 * 개발용 테스트 페이지
 * Firebase 없이도 PhaserGame과의 통신을 테스트할 수 있습니다.
 *
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 브라우저에서 /race-test 접근
 * 3. 브라우저 콘솔에서 데이터 확인
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhaserGame } from '../../components/game/PhaserGame'
import { getUserId } from '../../lib/user-id'
import type { Room, Player } from '../../hooks/useRoom'
import type { Stats } from '../../engine/race/types'

// 테스트용 Mock 데이터 생성 함수
function createMockRoom(roomId: string): Room {
  return {
    hostId: 'test-host-id',
    title: `테스트 룸 (${roomId})`,
    setCount: 3,
    rerollLimit: 2,
    rerollUsed: 0,
    status: 'racing',
    currentSet: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createMockPlayers(count: number = 4): Player[] {
  const players: Player[] = []
  for (let i = 0; i < count; i++) {
    players.push({
      id: `player-${i}`,
      name: `플레이어 ${i + 1}`,
      isHost: i === 0,
      isReady: true,
      selectedAugments: [],
      horseStats: {
        speed: 70 + Math.random() * 20,
        stamina: 70 + Math.random() * 20,
        condition: 70 + Math.random() * 20,
        jockeySkill: 70 + Math.random() * 20,
      },
      joinedAt: new Date(),
    })
  }
  return players
}

interface SavedHorseData {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

export function RacePageTest() {
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('roomId') || 'test-room-123'
  const playerId = searchParams.get('playerId') || 'player-0'
  const userId = getUserId()
  const participantCount = Number.parseInt(searchParams.get('participantCount') || '4', 10)
  const setCount = Number.parseInt(searchParams.get('setCount') || '3', 10)
  const rerollLimit = Number.parseInt(searchParams.get('rerollLimit') || '2', 10)
  const [playerCount, setPlayerCount] = useState(participantCount)
  const [selectedHorse, setSelectedHorse] = useState<SavedHorseData | null>(null)

  // participantCount가 변경되면 playerCount 업데이트
  useEffect(() => {
    setPlayerCount(participantCount)
  }, [participantCount])

  // HorseSelectionPageTest에서 전달된 데이터 확인 및 로그 출력
  useEffect(() => {
    if (!import.meta.env.DEV) return

    console.log('[RacePageTest] Received data from HorseSelectionPageTest:', {
      roomId,
      playerId,
      hasRoomId: !!roomId,
      hasPlayerId: !!playerId,
    })
  }, [roomId, playerId])

  // localStorage에서 선택한 말 데이터 읽기
  useEffect(() => {
    if (!import.meta.env.DEV) return

    const loadHorseData = () => {
      try {
        const saved = localStorage.getItem('dev_selected_horse')
        if (saved) {
          const horseData = JSON.parse(saved) as SavedHorseData
          setSelectedHorse(horseData)
          console.log('[RacePageTest] Loaded horse data from localStorage:', horseData)
        }
      } catch (err) {
        console.warn('[RacePageTest] Failed to read from localStorage:', err)
      }
    }

    loadHorseData()

    // localStorage 변경 감지 (다른 탭에서 변경된 경우)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dev_selected_horse') {
        loadHorseData()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 주기적으로 확인 (같은 탭에서 변경된 경우)
    const interval = setInterval(loadHorseData, 500)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Mock 데이터 생성 (URL 파라미터에서 가져온 정보 사용)
  const mockRoom = {
    ...createMockRoom(roomId),
    setCount,
    rerollLimit,
  }

  // 선택한 말이 있으면 해당 스탯을 사용하여 플레이어 생성
  const mockPlayers = (() => {
    const players = createMockPlayers(playerCount)

    // 선택한 말이 있으면 첫 번째 플레이어(호스트)에 적용
    if (selectedHorse && players.length > 0) {
      players[0] = {
        ...players[0],
        name: selectedHorse.name,
        // horseStats는 기존 구조와 다르므로, 나중에 RaceScene에서 직접 사용
        // 여기서는 players 배열에 추가 정보로 포함
      }
    }

    return players
  })()

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
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: '#1a1a2e' }}
    >
      {/* 개발용 컨트롤 패널 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 p-4 text-white">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-2 text-lg font-bold">🧪 개발 테스트 모드</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <label className="mr-2">플레이어 수:</label>
              <input
                type="number"
                min="2"
                max="8"
                value={playerCount}
                onChange={(e) => setPlayerCount(Number.parseInt(e.target.value, 10))}
                className="w-16 rounded bg-gray-700 px-2 py-1 text-white"
              />
            </div>
            <div>
              <span className="text-gray-400">Room ID: </span>
              <span className="font-mono">{roomId}</span>
            </div>
            <div>
              <span className="text-gray-400">User ID: </span>
              <span className="font-mono">{userId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Player ID: </span>
              <span className="font-mono">{playerId}</span>
            </div>
            <div>
              <span className="text-gray-400">Room Status: </span>
              <span className="font-mono">{mockRoom.status}</span>
            </div>
            <div>
              <span className="text-gray-400">Players: </span>
              <span className="font-mono">{mockPlayers.length}명</span>
            </div>
            {selectedHorse && (
              <div className="flex items-center gap-2 rounded bg-green-600/20 px-3 py-1 border border-green-500/40">
                <span className="text-green-400">말:</span>
                <span className="font-mono text-green-300">{selectedHorse.name}</span>
                <span className="text-green-400">(총 능력치: {selectedHorse.totalStats})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PhaserGame 컴포넌트 */}
      <div className="flex flex-1 items-center justify-center pt-20">
        <PhaserGame
          aspectRatioWidth={1280}
          aspectRatioHeight={720}
          roomId={roomId}
          playerId={playerId}
          room={mockRoom}
          players={mockPlayers}
          userId={userId}
          selectedHorse={selectedHorse || undefined}
        />
      </div>
    </div>
  )
}
