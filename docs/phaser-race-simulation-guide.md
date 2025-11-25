# Phaser 3 경마 시뮬레이션 구현 가이드

이 문서는 React + TypeScript 환경에서 Phaser 3를 활용하여 경마 시뮬레이션 게임을 구현하는 방법을 안내합니다.

---

## 목차

1. [설치 및 설정](#1-설치-및-설정)
2. [React와 Phaser 3 통합](#2-react와-phaser-3-통합)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [레이스 씬 구현](#4-레이스-씬-구현)
5. [시뮬레이션 로직](#5-시뮬레이션-로직)
6. [UI 통합](#6-ui-통합)
7. [다음 단계](#7-다음-단계)

---

## 1. 설치 및 설정

### 1.1 Phaser 3 설치

```bash
cd frontend
npm install phaser
```

### 1.2 TypeScript 타입 정의 (선택사항)

Phaser 3는 자체 타입 정의를 포함하고 있지만, 추가 타입이 필요할 수 있습니다:

```bash
npm install --save-dev @types/phaser
```

---

## 2. React와 Phaser 3 통합

### 2.1 기본 원칙

Phaser 3는 자체 게임 루프와 렌더링 시스템을 사용하므로, React 컴포넌트 내에서 Phaser 게임 인스턴스를 관리해야 합니다.

**핵심 패턴:**
- `useRef`로 Phaser 게임 인스턴스 참조 유지
- `useEffect`에서 게임 초기화 및 정리
- React 상태와 Phaser 씬 간 이벤트 기반 통신

### 2.2 기본 컴포넌트 구조

```typescript
// frontend/src/components/game/PhaserGame.tsx
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { RaceScene } from './scenes/RaceScene'

interface PhaserGameProps {
  width?: number
  height?: number
  onGameReady?: (game: Phaser.Game) => void
}

export function PhaserGame({ width = 800, height = 600, onGameReady }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: containerRef.current,
      backgroundColor: '#1a1a2e',
      scene: [RaceScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false, // 개발 중에는 true로 설정
        },
      },
    }

    gameRef.current = new Phaser.Game(config)

    if (onGameReady) {
      onGameReady(gameRef.current)
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [width, height, onGameReady])

  return <div ref={containerRef} className="w-full h-full" />
}
```

---

## 3. 프로젝트 구조

### 3.1 권장 디렉토리 구조

```
frontend/src/
├── components/
│   └── game/
│       ├── PhaserGame.tsx          # Phaser 게임 래퍼 컴포넌트
│       ├── scenes/
│       │   ├── RaceScene.ts        # 메인 레이스 씬
│       │   └── PreloadScene.ts     # 에셋 로딩 씬 (선택사항)
│       ├── entities/
│       │   ├── Horse.ts            # 말 엔티티 클래스
│       │   └── Track.ts             # 트랙 엔티티 클래스
│       ├── systems/
│       │   ├── RaceSimulator.ts    # 레이스 시뮬레이션 로직
│       │   └── PhysicsSystem.ts    # 물리 시스템 (선택사항)
│       └── utils/
│           ├── trackUtils.ts        # 트랙 관련 유틸리티
│           └── horseUtils.ts        # 말 관련 유틸리티
├── pages/
│   └── RacePage.tsx                 # 레이스 페이지 (PhaserGame 사용)
└── types/
    └── race.ts                      # 레이스 관련 타입 정의
```

### 3.2 타입 정의

```typescript
// frontend/src/types/race.ts
export interface HorseStats {
  speed: number
  stamina: number
  condition: number
  jockeySkill: number
  runStyle: 'paceSetter' | 'frontRunner' | 'stalker' | 'closer'
}

export interface HorseData {
  id: string
  playerId: string
  playerName: string
  stats: HorseStats
  position: number // 트랙 상의 위치 (0.0 ~ 1.0)
  rank: number
  speed: number // 현재 속도
  stamina: number // 현재 지구력
}

export interface RaceState {
  horses: HorseData[]
  elapsedTime: number
  raceLength: number // 총 거리 (미터)
  isFinished: boolean
  winner?: string
}

export interface RaceConfig {
  trackLength: number
  playerCount: number
  horses: Array<{
    playerId: string
    playerName: string
    stats: HorseStats
  }>
}
```

---

## 4. 레이스 씬 구현

### 4.1 기본 RaceScene 구조

```typescript
// frontend/src/components/game/scenes/RaceScene.ts
import Phaser from 'phaser'
import { RaceConfig, RaceState, HorseData } from '../../../types/race'
import { RaceSimulator } from '../systems/RaceSimulator'
import { Horse } from '../entities/Horse'

export class RaceScene extends Phaser.Scene {
  private raceConfig!: RaceConfig
  private raceSimulator!: RaceSimulator
  private horses: Horse[] = []
  private trackGraphics!: Phaser.GameObjects.Graphics
  private uiContainer!: Phaser.GameObjects.Container
  private rankTexts: Phaser.GameObjects.Text[] = []

  constructor() {
    super({ key: 'RaceScene' })
  }

  init(data: { config: RaceConfig }) {
    this.raceConfig = data.config
  }

  create() {
    // 트랙 그리기
    this.drawTrack()

    // 말 엔티티 생성
    this.createHorses()

    // UI 생성
    this.createUI()

    // 시뮬레이터 초기화
    this.raceSimulator = new RaceSimulator(this.raceConfig)

    // 게임 루프 시작
    this.time.addEvent({
      delay: 16, // ~60 FPS
      callback: this.updateRace,
      loop: true,
    })
  }

  private drawTrack() {
    // 트랙 그래픽 그리기
    this.trackGraphics = this.add.graphics()
    const trackWidth = this.scale.width * 0.8
    const trackHeight = 40
    const startX = this.scale.width * 0.1
    const startY = this.scale.height * 0.5

    // 트랙 배경
    this.trackGraphics.fillStyle(0x2d5016, 1)
    this.trackGraphics.fillRect(startX, startY, trackWidth, trackHeight)

    // 트랙 경계선
    this.trackGraphics.lineStyle(2, 0xffffff, 1)
    this.trackGraphics.strokeRect(startX, startY, trackWidth, trackHeight)

    // 결승선
    this.trackGraphics.lineStyle(3, 0xff0000, 1)
    this.trackGraphics.beginPath()
    this.trackGraphics.moveTo(startX + trackWidth, startY)
    this.trackGraphics.lineTo(startX + trackWidth, startY + trackHeight)
    this.trackGraphics.strokePath()
  }

  private createHorses() {
    const startX = this.scale.width * 0.1
    const startY = this.scale.height * 0.5
    const trackHeight = 40
    const horseSpacing = trackHeight / (this.raceConfig.horses.length + 1)

    this.raceConfig.horses.forEach((horseData, index) => {
      const horse = new Horse(
        this,
        startX,
        startY + horseSpacing * (index + 1),
        horseData.playerId,
        horseData.playerName,
        horseData.stats,
      )
      this.horses.push(horse)
    })
  }

  private createUI() {
    // 순위 표시 UI
    this.uiContainer = this.add.container(this.scale.width * 0.9, 50)

    this.raceConfig.horses.forEach((horseData, index) => {
      const text = this.add.text(0, index * 30, '', {
        fontSize: '16px',
        color: '#ffffff',
      })
      this.rankTexts.push(text)
      this.uiContainer.add(text)
    })
  }

  private updateRace() {
    if (!this.raceSimulator) return

    // 시뮬레이터 업데이트
    const raceState = this.raceSimulator.update(16) // 16ms = 1 프레임

    // 말 위치 업데이트
    this.updateHorsePositions(raceState)

    // UI 업데이트
    this.updateUI(raceState)

    // 레이스 종료 체크
    if (raceState.isFinished) {
      this.handleRaceFinish(raceState)
    }
  }

  private updateHorsePositions(raceState: RaceState) {
    const trackWidth = this.scale.width * 0.8
    const startX = this.scale.width * 0.1

    raceState.horses.forEach((horseData) => {
      const horse = this.horses.find((h) => h.playerId === horseData.playerId)
      if (horse) {
        const x = startX + trackWidth * horseData.position
        horse.setPosition(x, horse.y)
        horse.updateSpeed(horseData.speed)
      }
    })
  }

  private updateUI(raceState: RaceState) {
    raceState.horses
      .sort((a, b) => a.rank - b.rank)
      .forEach((horseData, index) => {
        if (this.rankTexts[index]) {
          this.rankTexts[index].setText(
            `${horseData.rank}위: ${horseData.playerName} (${(horseData.position * 100).toFixed(1)}%)`,
          )
        }
      })
  }

  private handleRaceFinish(raceState: RaceState) {
    // 레이스 종료 처리
    this.time.removeAllEvents()
    this.events.emit('raceFinished', raceState)
  }
}
```

### 4.2 Horse 엔티티 클래스

```typescript
// frontend/src/components/game/entities/Horse.ts
import Phaser from 'phaser'
import { HorseStats } from '../../../types/race'

export class Horse extends Phaser.GameObjects.Container {
  public playerId: string
  public playerName: string
  public stats: HorseStats
  private horseSprite!: Phaser.GameObjects.Sprite
  private nameText!: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerId: string,
    playerName: string,
    stats: HorseStats,
  ) {
    super(scene, x, y)

    this.playerId = playerId
    this.playerName = playerName
    this.stats = stats

    // 말 스프라이트 (임시로 원형 사용)
    this.horseSprite = scene.add.circle(0, 0, 10, 0x8b4513)
    this.add(this.horseSprite)

    // 플레이어 이름 텍스트
    this.nameText = scene.add.text(0, -20, playerName, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 },
    })
    this.nameText.setOrigin(0.5)
    this.add(this.nameText)

    scene.add.existing(this)
  }

  updateSpeed(currentSpeed: number) {
    // 속도에 따른 시각적 피드백 (선택사항)
    const scale = 1 + currentSpeed / 200
    this.setScale(scale)
  }
}
```

---

## 5. 시뮬레이션 로직

### 5.1 RaceSimulator 클래스

```typescript
// frontend/src/components/game/systems/RaceSimulator.ts
import { RaceConfig, RaceState, HorseData, HorseStats } from '../../../types/race'

export class RaceSimulator {
  private config: RaceConfig
  private state: RaceState
  private readonly TICK_RATE = 1000 / 60 // 60 FPS

  constructor(config: RaceConfig) {
    this.config = config
    this.state = this.initializeRace()
  }

  private initializeRace(): RaceState {
    return {
      horses: this.config.horses.map((horse) => ({
        id: `horse-${horse.playerId}`,
        playerId: horse.playerId,
        playerName: horse.playerName,
        stats: horse.stats,
        position: 0,
        rank: 1,
        speed: 0,
        stamina: horse.stats.stamina,
      })),
      elapsedTime: 0,
      raceLength: this.config.trackLength,
      isFinished: false,
    }
  }

  update(deltaTime: number): RaceState {
    if (this.state.isFinished) {
      return this.state
    }

    this.state.elapsedTime += deltaTime

    // 각 말 업데이트
    this.state.horses.forEach((horse) => {
      this.updateHorse(horse, deltaTime)
    })

    // 순위 계산
    this.updateRanks()

    // 레이스 종료 체크
    this.checkRaceFinish()

    return this.state
  }

  private updateHorse(horse: HorseData, deltaTime: number) {
    const stats = horse.stats

    // 컨디션 보정 계산
    const conditionBonus = this.getConditionBonus(stats.condition)

    // 현재 속도 계산
    const baseSpeed = stats.speed * (1 + conditionBonus)
    const effectiveSpeed = horse.stamina > 0 ? baseSpeed : baseSpeed * 0.5

    // 지구력 감소
    const staminaDrain = effectiveSpeed * 0.1
    horse.stamina = Math.max(0, horse.stamina - staminaDrain * (deltaTime / 1000))

    // 지구력 회복 (감속 상태일 때)
    if (horse.stamina <= 0) {
      const recoveryRate = 10 + stats.jockeySkill * 0.1
      horse.stamina = Math.min(stats.stamina, horse.stamina + recoveryRate * (deltaTime / 1000))
    }

    // 위치 업데이트
    const distance = (effectiveSpeed * deltaTime) / 1000 // 미터 단위
    const positionDelta = distance / this.config.trackLength
    horse.position = Math.min(1.0, horse.position + positionDelta)

    horse.speed = effectiveSpeed
  }

  private getConditionBonus(condition: number): number {
    if (condition >= 80) return 0.1
    if (condition >= 60) return 0.05
    if (condition >= 40) return 0
    if (condition >= 20) return -0.05
    return -0.1
  }

  private updateRanks() {
    this.state.horses.sort((a, b) => b.position - a.position)
    this.state.horses.forEach((horse, index) => {
      horse.rank = index + 1
    })
  }

  private checkRaceFinish() {
    const finishedHorses = this.state.horses.filter((horse) => horse.position >= 1.0)
    if (finishedHorses.length > 0 && !this.state.isFinished) {
      this.state.isFinished = true
      this.state.winner = finishedHorses[0].playerId
    }
  }

  getState(): RaceState {
    return { ...this.state }
  }
}
```

---

## 6. UI 통합

### 6.1 RacePage 컴포넌트

```typescript
// frontend/src/pages/RacePage.tsx
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Phaser from 'phaser'
import { PhaserGame } from '../components/game/PhaserGame'
import { RaceConfig } from '../types/race'

export function RacePage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [raceConfig, setRaceConfig] = useState<RaceConfig | null>(null)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    // URL 파라미터 또는 Firestore에서 레이스 설정 로드
    // 임시 데이터 (실제로는 Firestore에서 가져옴)
    const config: RaceConfig = {
      trackLength: 2000, // 2km
      playerCount: 4,
      horses: [
        {
          playerId: '1',
          playerName: 'Player 1',
          stats: {
            speed: 80,
            stamina: 90,
            condition: 85,
            jockeySkill: 70,
            runStyle: 'paceSetter',
          },
        },
        // ... 더 많은 말들
      ],
    }
    setRaceConfig(config)
  }, [searchParams])

  const handleGameReady = (game: Phaser.Game) => {
    if (!raceConfig) return

    // RaceScene에 설정 전달
    const scene = game.scene.getScene('RaceScene') as Phaser.Scene
    scene.scene.start('RaceScene', { config: raceConfig })

    // 레이스 종료 이벤트 리스너
    scene.events.on('raceFinished', (raceState: any) => {
      setIsFinished(true)
      console.log('Race finished:', raceState)
    })
  }

  const handleSkip = () => {
    // 레이스 스킵 로직
    navigate('/results')
  }

  if (!raceConfig) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1">
        <PhaserGame width={1200} height={600} onGameReady={handleGameReady} />
      </div>
      <div className="flex items-center justify-between border-t border-white/10 bg-surface/80 p-4">
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
        >
          {t('race.skip')}
        </button>
        {isFinished && (
          <button
            type="button"
            onClick={() => navigate('/results')}
            className="rounded-lg bg-primary px-6 py-2 font-semibold text-white"
          >
            {t('race.viewResults')}
          </button>
        )}
      </div>
    </div>
  )
}
```

### 6.2 App.tsx에 라우트 추가

```typescript
// frontend/src/App.tsx에 추가
import { RacePage } from './pages/RacePage'

// Routes 내부에 추가
<Route path="/race" element={<RacePage />} />
```

---

## 7. 다음 단계

### 7.1 개선 사항

1. **에셋 추가**
   - 말 스프라이트 이미지
   - 트랙 배경 이미지
   - 애니메이션 (말 달리기, 승리 연출 등)
   
   **무료 에셋 소스:**
   - [OpenGameArt.org](https://opengameart.org/) - "horse", "race", "top down" 검색
   - [Kenney.nl](https://kenney.nl/) - 무료 게임 에셋 팩 (2D 탑뷰 타일셋 포함)
   - [Itch.io](https://itch.io/game-assets/free) - 무료 게임 에셋 섹션
   - [GameDev Market](https://www.gamedevmarket.net/category/2d/free/) - 무료 2D 에셋
   - [Craftpix.net](https://craftpix.net/freebies/) - 무료 게임 그래픽
   - [Pixabay](https://pixabay.com/) - 무료 이미지 (상업적 사용 가능)
   - [Unsplash](https://unsplash.com/) - 고품질 무료 사진 (배경용)

2. **고급 기능**
   - 주행 습성에 따른 AI 로직 구현
   - 증강 효과 적용
   - 실시간 순위 표시 개선
   - 카메라 추적 (선두 말 따라가기)

3. **Firestore 연동**
   - 레이스 상태를 Firestore에 저장
   - 실시간 동기화 (다중 플레이어)
   - 레이스 결과 저장

4. **성능 최적화**
   - 객체 풀링 (말 엔티티 재사용)
   - 렌더링 최적화
   - 메모리 관리

### 7.2 참고 자료

- [Phaser 3 공식 문서](https://photonstorm.github.io/phaser3-docs/)
- [Phaser 3 예제](https://labs.phaser.io/)
- [React + Phaser 통합 가이드](https://blog.ourcade.co/posts/2020/phaser-3-react-typescript/)

---

## 8. 문제 해결

### 8.1 일반적인 이슈

**문제**: Phaser 게임이 React 컴포넌트 언마운트 후에도 계속 실행됨
**해결**: `useEffect`의 cleanup 함수에서 `game.destroy(true)` 호출

**문제**: React 상태 업데이트가 Phaser 씬에 반영되지 않음
**해결**: Phaser 이벤트 시스템 사용 (`scene.events.emit` / `scene.events.on`)

**문제**: TypeScript 타입 에러
**해결**: Phaser 타입 정의 확인 및 `as` 타입 단언 사용 (필요시)

---

## 9. 무료 에셋 소스 가이드

### 9.1 추천 무료 에셋 사이트

#### 1. **OpenGameArt.org** (가장 추천)
- **URL**: https://opengameart.org/
- **특징**: 
  - 완전 무료, 상업적 사용 가능 (라이선스 확인 필요)
  - 커뮤니티 기반, 다양한 스타일
  - 검색 키워드: "horse", "race", "top down", "sprite"
- **추천 검색어**: "horse sprite", "racing game", "top view"

#### 2. **Kenney.nl**
- **URL**: https://kenney.nl/
- **특징**:
  - 고품질 무료 에셋 팩
  - 일관된 스타일
  - 2D 탑뷰 타일셋 포함
- **추천 팩**: "Racing Pack", "Topdown Shooter", "Tiny Dungeon"

#### 3. **Itch.io**
- **URL**: https://itch.io/game-assets/free
- **특징**:
  - 인디 개발자들이 공유하는 에셋
  - "name-your-price" (무료 가능)
  - 다양한 스타일
- **검색 키워드**: "horse", "racing", "top down", "2D sprite"

#### 4. **GameDev Market**
- **URL**: https://www.gamedevmarket.net/category/2d/free/
- **특징**:
  - 무료 및 유료 에셋 혼합
  - 고품질 에셋
  - 필터로 무료만 검색 가능

#### 5. **Craftpix.net**
- **URL**: https://craftpix.net/freebies/
- **특징**:
  - 정기적으로 무료 에셋 제공
  - 2D 게임 그래픽 전문
  - 이메일 구독 시 추가 무료 에셋

### 9.2 경마 게임에 특화된 검색 키워드

다음 키워드로 검색하면 관련 에셋을 찾을 수 있습니다:

**영어 키워드:**
- `horse sprite`
- `horse racing`
- `top down horse`
- `race track`
- `racing game assets`
- `2D horse animation`
- `isometric horse`
- `pixel art horse`

**한국어 키워드:**
- 일부 사이트에서 한국어 검색 지원
- 주로 영어 키워드 사용 권장

### 9.3 에셋 사용 시 주의사항

1. **라이선스 확인 필수**
   - CC0 (Public Domain): 자유롭게 사용 가능
   - CC BY: 저작자 표시 필요
   - CC BY-SA: 저작자 표시 + 동일 라이선스
   - 상업적 사용 가능 여부 확인

2. **에셋 크기 및 형식**
   - Phaser 3 권장: PNG (투명 배경)
   - 스프라이트 시트: JSON + PNG 조합
   - 해상도: 32x32, 64x64, 128x128 등 (게임 스타일에 맞게)

3. **에셋 최적화**
   - 이미지 압축 (TinyPNG 등)
   - 스프라이트 시트 생성 (TexturePacker 등)
   - 불필요한 메타데이터 제거

### 9.4 직접 제작 도구 (대안)

에셋을 직접 만들고 싶다면:

1. **픽셀 아트 도구**
   - [Piskel](https://www.piskelapp.com/) - 웹 기반 무료 픽셀 아트 에디터
   - [Aseprite](https://www.aseprite.org/) - 유료이지만 강력한 픽셀 아트 도구
   - [GIMP](https://www.gimp.org/) - 무료 이미지 에디터

2. **AI 이미지 생성**
   - [DALL-E](https://openai.com/dall-e-2) - OpenAI의 이미지 생성 AI
   - [Midjourney](https://www.midjourney.com/) - 고품질 이미지 생성
   - [Stable Diffusion](https://stablediffusionweb.com/) - 오픈소스 AI 이미지 생성

### 9.5 프로젝트에 에셋 추가하기

에셋을 다운로드한 후:

1. **디렉토리 구조**
   ```
   frontend/src/assets/
   ├── images/
   │   ├── horses/
   │   │   ├── horse1.png
   │   │   └── horse2.png
   │   ├── track/
   │   │   └── track.png
   │   └── ui/
   └── spritesheets/
       └── horse-animations.json
   ```

2. **Phaser에서 로드**
   ```typescript
   // PreloadScene.ts 또는 RaceScene.ts
   preload() {
     this.load.image('horse', 'assets/images/horses/horse1.png')
     this.load.image('track', 'assets/images/track/track.png')
     this.load.spritesheet('horse-run', 'assets/spritesheets/horse-run.png', {
       frameWidth: 64,
       frameHeight: 64,
     })
   }
   ```

3. **Vite 설정 (필요시)**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     assetsInclude: ['**/*.png', '**/*.jpg', '**/*.json'],
   })
   ```

---

이 가이드를 따라 구현하면 기본적인 경마 시뮬레이션이 동작합니다. 이후 프로젝트 요구사항에 맞게 확장하시면 됩니다.

