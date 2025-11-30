import { PhaserGame } from '../components/game/PhaserGame'

export function RacePage() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <div className="flex-1 min-h-0">
        {/* PhaserGame 컴포넌트 추가 (내부에서 중앙 정렬됨) */}
        <PhaserGame aspectRatioWidth={1200} aspectRatioHeight={800} />
      </div>
    </div>
  )
}
