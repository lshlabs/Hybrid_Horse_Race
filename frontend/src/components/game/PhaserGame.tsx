import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import RaceScene from './scenes/RaceScene'
import AugmentSelectionScene from './scenes/AugmentSelectionScene'
import RaceResultScene from './scenes/RaceResultScene'
import type { Room, Player } from '../../hooks/useRoom'

// 개발 모드: 선택한 말 데이터 타입
interface SelectedHorseData {
  name: string
  stats: {
    Speed: number
    Stamina: number
    Power: number
    Guts: number
    Start: number
    Consistency: number
  }
  totalStats: number
  selectedAt: string
}

// PhaserGame 컴포넌트의 props 타입 정의
interface PhaserGameProps {
  aspectRatioWidth?: number // 게임 너비 (고정 크기, 기본값: 1280)
  aspectRatioHeight?: number // 게임 높이 (고정 크기, 기본값: 720)
  roomId?: string // Firebase 룸 ID
  playerId?: string // 플레이어 ID
  room?: Room // Firebase 룸 데이터
  players?: Player[] // 플레이어 목록
  userId?: string // 현재 사용자 ID
  selectedHorse?: SelectedHorseData // 개발 모드: 선택한 말 데이터
}

export function PhaserGame({
  aspectRatioWidth = 1280,
  aspectRatioHeight = 720,
  roomId,
  playerId,
  room,
  players = [],
  userId,
  selectedHorse,
}: PhaserGameProps) {
  // Phaser Game 인스턴스를 저장할 ref
  const gameRef = useRef<Phaser.Game | null>(null)
  // 게임이 렌더링될 HTML div 요소를 저장할 ref
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // containerRef가 없거나 이미 게임이 생성되어 있으면 실행하지 않음
    if (!containerRef.current || gameRef.current) return

    // Phaser Game 설정 객체 (test-phaser.html 설정 반영)
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS, // Canvas 렌더러 강제 (WebGL은 antialias로 인해 배경이 흐릿해질 수 있음)
      width: aspectRatioWidth, // Phaser 초기 너비 (고정 크기)
      height: aspectRatioHeight, // Phaser 초기 높이 (고정 크기)
      parent: containerRef.current, // 게임이 렌더링될 부모 요소
      backgroundColor: '#000000', // 배경색 (test-phaser.html과 동일)
      scene: [RaceScene, AugmentSelectionScene, RaceResultScene], // RaceScene, AugmentSelectionScene, RaceResultScene 추가
      render: {
        pixelArt: false, // 텍스트 선명도를 위해 false (배경은 개별적으로 NEAREST 필터 적용)
        antialias: true, // 텍스트 안티앨리어싱
        roundPixels: true, // 정수 픽셀 위치 강제
      },
      scale: {
        mode: Phaser.Scale.NONE, // 고정 크기 (test-phaser.html과 동일)
      },
    }

    // Phaser Game 인스턴스 생성
    gameRef.current = new Phaser.Game(config)

    // 개발 모드에서 전역 변수로 접근 가능하도록 설정 (디버깅용)
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__phaserGame = gameRef.current
      console.log('[PhaserGame] Game instance created. Access via window.__phaserGame')
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
        // 개발 모드에서 전역 변수 정리
        if (import.meta.env.DEV && '__phaserGame' in window) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const win = window as any
          delete win.__phaserGame
        }
      }
    }
  }, [aspectRatioWidth, aspectRatioHeight]) // 의존성 배열

  // roomId, playerId, room, players가 변경되면 RaceScene에 데이터 전달
  useEffect(() => {
    if (!gameRef.current) return

    const raceScene = gameRef.current.scene.getScene('RaceScene') as RaceScene | null
    if (raceScene) {
      // Phaser Scene의 data 객체를 통해 데이터 전달
      raceScene.data.set('roomId', roomId)
      raceScene.data.set('playerId', playerId)
      raceScene.data.set('room', room)
      raceScene.data.set('players', players)
      raceScene.data.set('userId', userId)

      // 개발 모드: 선택한 말 데이터 전달
      if (selectedHorse) {
        raceScene.data.set('selectedHorse', selectedHorse)
      }

      // 커스텀 이벤트로도 전달 (RaceScene에서 구독 가능)
      raceScene.events.emit('room-data-updated', {
        roomId,
        playerId,
        room,
        players,
        userId,
        selectedHorse,
      })

      // 개발 모드에서 로그 출력
      if (import.meta.env.DEV) {
        console.log('[PhaserGame] Data sent to RaceScene:', {
          roomId,
          playerId,
          hasRoom: !!room,
          playersCount: players.length,
          userId,
          hasSelectedHorse: !!selectedHorse,
          selectedHorseName: selectedHorse?.name,
        })
      }
    } else if (import.meta.env.DEV) {
      console.warn('[PhaserGame] RaceScene not found. Scene may not be initialized yet.')
    }
  }, [roomId, playerId, room, players, userId, selectedHorse])

  // 게임이 렌더링될 div 반환 (고정 크기, test-phaser.html과 동일)
  return (
    <div
      ref={containerRef}
      style={{ width: `${aspectRatioWidth}px`, height: `${aspectRatioHeight}px` }}
    />
  )
}
