import { useSearchParams } from 'react-router-dom'
import { PhaserGame } from '../components/game/PhaserGame'
import { useRoom } from '../hooks/useRoom'
import { getUserId } from '../lib/user-id'

export function RacePage() {
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('roomId')
  const playerId = searchParams.get('playerId')
  const userId = getUserId()

  // Firebase에서 룸 데이터 구독
  const { room, players, loading, error } = useRoom(roomId)

  // 로딩 중이거나 에러가 있으면 표시
  if (loading) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        <div className="text-center">
          <p className="text-lg text-neutral-200">게임 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error || (roomId && !room)) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        <div className="text-center">
          <p className="text-lg text-red-400">{error?.message || '룸을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-screen w-screen items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#1a1a2e' }}
    >
      {/* PhaserGame 컴포넌트 추가 (test-phaser.html 설정 반영: 1280x720 고정 크기) */}
      <PhaserGame
        aspectRatioWidth={1280}
        aspectRatioHeight={720}
        roomId={roomId || undefined}
        playerId={playerId || undefined}
        room={room || undefined}
        players={players}
        userId={userId || undefined}
      />
    </div>
  )
}
