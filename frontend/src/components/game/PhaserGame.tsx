import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import RaceScene from './scenes/RaceScene'
import AugmentSelectionScene from './scenes/AugmentSelectionScene'
import RaceResultScene from './scenes/RaceResultScene'

// PhaserGame 컴포넌트의 props 타입 정의
interface PhaserGameProps {
  aspectRatioWidth?: number // 게임 종횡비 너비 (비율 계산용, 실제 크기와 무관, 기본값: 1200)
  aspectRatioHeight?: number // 게임 종횡비 높이 (비율 계산용, 실제 크기와 무관, 기본값: 800)
  maintainAspectRatio?: boolean // 비율 유지 여부 (기본값: true)
}

export function PhaserGame({
  aspectRatioWidth = 1200,
  aspectRatioHeight = 800,
  maintainAspectRatio = true,
}: PhaserGameProps) {
  // Phaser Game 인스턴스를 저장할 ref
  const gameRef = useRef<Phaser.Game | null>(null)
  // 게임이 렌더링될 HTML div 요소를 저장할 ref
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // containerRef가 없거나 이미 게임이 생성되어 있으면 실행하지 않음
    if (!containerRef.current || gameRef.current) return

    // Phaser Game 설정 객체
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO, // WebGL 또는 Canvas 자동 선택
      width: aspectRatioWidth, // Phaser 초기 너비 (실제 크기는 컨테이너에 맞춰 리사이즈됨)
      height: aspectRatioHeight, // Phaser 초기 높이 (실제 크기는 컨테이너에 맞춰 리사이즈됨)
      parent: containerRef.current, // 게임이 렌더링될 부모 요소
      backgroundColor: '#1a1a2e', // 배경색 (어두운 파란색)
      scene: [RaceScene, AugmentSelectionScene, RaceResultScene], // RaceScene, AugmentSelectionScene, RaceResultScene 추가
      render: {
        pixelArt: true, // 도트 느낌 유지 (이미지용)
        antialias: true, // 텍스트 선명도를 위해 안티앨리어싱 활성화
        roundPixels: false, // 텍스트 선명도를 위해 픽셀 반올림 비활성화
      },
      scale: {
        mode: Phaser.Scale.RESIZE, // 부모 컨테이너 크기에 맞춰 리사이즈
        autoCenter: Phaser.Scale.CENTER_BOTH, // 중앙 정렬
        width: aspectRatioWidth, // 비율 계산용
        height: aspectRatioHeight, // 비율 계산용
      },
    }

    // Phaser Game 인스턴스 생성
    gameRef.current = new Phaser.Game(config)

    // 게임 크기 조정 함수
    const resizeGame = () => {
      if (!gameRef.current || !containerRef.current) return

      const container = containerRef.current
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      if (maintainAspectRatio) {
        // 비율 유지하면서 컨테이너에 맞춤 (모든 화면 크기에서)
        const gameAspectRatio = aspectRatioWidth / aspectRatioHeight
        const containerAspectRatio = containerWidth / containerHeight

        let newWidth: number
        let newHeight: number

        if (containerAspectRatio > gameAspectRatio) {
          // 컨테이너가 더 넓으면 높이 기준
          newHeight = containerHeight
          newWidth = newHeight * gameAspectRatio
        } else {
          // 컨테이너가 더 높거나 같으면 너비 기준
          newWidth = containerWidth
          newHeight = newWidth / gameAspectRatio
        }

        gameRef.current.scale.resize(newWidth, newHeight)
      } else {
        // 비율 무시하고 컨테이너에 맞춤 (모든 화면 크기에서)
        gameRef.current.scale.resize(containerWidth, containerHeight)
      }
    }

    // 초기 크기 설정
    resizeGame()

    // ResizeObserver로 컨테이너 크기 변경 감지 (더 정확함)
    const resizeObserver = new ResizeObserver(() => {
      resizeGame()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // window resize 이벤트도 함께 사용 (fallback)
    window.addEventListener('resize', resizeGame)

    // 컴포넌트가 언마운트될 때 게임 정리
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resizeGame)
      if (gameRef.current) {
        gameRef.current.destroy(true) // 게임 완전히 제거
        gameRef.current = null
      }
    }
  }, [aspectRatioWidth, aspectRatioHeight, maintainAspectRatio]) // 의존성 배열

  // 게임이 렌더링될 div 반환 (반응형)
  return (
    <div className="flex items-center justify-center w-full h-full min-h-0">
      <div
        ref={containerRef}
        className="w-full h-full min-h-0"
        // CSS 제한 제거 - 크기는 JavaScript에서 완전히 제어
      />
    </div>
  )
}
