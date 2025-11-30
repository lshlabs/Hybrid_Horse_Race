# Phaser 3 게임 구현 튜토리얼 (초심자용)

이 튜토리얼은 `frontend/src/components/game` 디렉터리에 Phaser 3 게임을 처음부터 단계별로 구현하는 가이드입니다.

**⚠️ 중요: 각 단계를 완료한 후 반드시 테스트해보세요!**

---

## 목차

1. [Phaser 3 기본 개념 이해하기](#1-phaser-3-기본-개념-이해하기)
2. [React와 Phaser 통합하기](#2-react와-phaser-통합하기)
3. [첫 번째 씬 만들기](#3-첫-번째-씬-만들기)
4. [게임 객체 추가하기](#4-게임-객체-추가하기)
5. [애니메이션과 상호작용](#5-애니메이션과-상호작용)

---

## 1. Phaser 3 기본 개념 이해하기

### 핵심 개념 (이해만 하면 됩니다)

- **Game**: Phaser 게임의 최상위 객체. 게임 전체를 관리합니다.
- **Scene**: 게임의 화면/단계 (예: 메뉴 화면, 레이스 화면, 결과 화면)
- **GameObject**: 화면에 표시되는 모든 것 (스프라이트, 텍스트, 그래픽 등)
- **Physics**: 물리 엔진 (중력, 충돌 등)

### Phaser의 기본 흐름

```
Game 생성 → Scene 생성 → create() 메서드 실행 → 게임 객체 표시
```

---

## 2. React와 Phaser 통합하기

### 단계 1: PhaserGame 컴포넌트 파일 생성

**파일 경로:** `frontend/src/components/game/PhaserGame.tsx`

**작업:** 새 파일을 만들고 아래 코드를 **전체** 복사해서 붙여넣으세요.

```typescript
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'

// PhaserGame 컴포넌트의 props 타입 정의
interface PhaserGameProps {
  width?: number
  height?: number
}

export function PhaserGame({ width = 1200, height = 600 }: PhaserGameProps) {
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
      width: width, // 게임 화면 너비
      height: height, // 게임 화면 높이
      parent: containerRef.current, // 게임이 렌더링될 부모 요소
      backgroundColor: '#1a1a2e', // 배경색 (어두운 파란색)
      // scene은 나중에 추가할 예정이므로 일단 빈 배열
      scene: [],
    }

    // Phaser Game 인스턴스 생성
    gameRef.current = new Phaser.Game(config)

    // 컴포넌트가 언마운트될 때 게임 정리
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true) // 게임 완전히 제거
        gameRef.current = null
      }
    }
  }, [width, height]) // width나 height가 변경되면 재생성

  // 게임이 렌더링될 div 반환
  return <div ref={containerRef} className="w-full h-full" />
}
```

**설명:**

- `useRef`: React에서 DOM 요소나 값을 저장할 때 사용
- `useEffect`: 컴포넌트가 마운트될 때 한 번 실행
- `game.destroy(true)`: 게임을 완전히 제거 (메모리 누수 방지)

### 단계 2: RacePage에서 테스트하기

**파일 경로:** `frontend/src/pages/RacePage.tsx`

**작업:** 파일을 열고 아래처럼 수정하세요.

```typescript
import { useTranslation } from 'react-i18next'
import { PhaserGame } from '../components/game/PhaserGame'

export function RacePage() {
  const { t } = useTranslation()

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1">
        {/* PhaserGame 컴포넌트 추가 */}
        <PhaserGame width={1200} height={600} />
      </div>
    </div>
  )
}
```

**확인사항:**

1. 개발 서버 실행: `npm run dev` (frontend 디렉터리에서)
2. 브라우저에서 `/race` 경로로 이동
3. **예상 결과:** 어두운 파란색 배경의 빈 화면이 보여야 합니다
4. 에러가 없다면 성공! 다음 단계로 진행하세요.

---

## 3. 첫 번째 씬 만들기

### 단계 1: RaceScene 파일 생성

**파일 경로:** `frontend/src/components/game/scenes/RaceScene.ts`

**작업:** 새 파일을 만들고 아래 코드를 **전체** 복사해서 붙여넣으세요.

```typescript
import Phaser from 'phaser'

// RaceScene 클래스: Phaser.Scene을 상속받음
export class RaceScene extends Phaser.Scene {
  // 생성자: 씬의 고유 키를 설정
  constructor() {
    super({ key: 'RaceScene' })
  }

  // create() 메서드: 씬이 생성될 때 한 번 실행됨
  create() {
    // 화면 중앙에 텍스트 추가
    // this.scale.width: 화면 너비
    // this.scale.height: 화면 높이
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    // 텍스트 객체 생성
    this.add
      .text(centerX, centerY, 'Hello Phaser!', {
        fontSize: '48px',
        color: '#ffffff', // 흰색
        fontFamily: 'Arial',
      })
      .setOrigin(0.5) // 텍스트의 중심점을 기준으로 정렬
  }
}
```

**설명:**

- `extends Phaser.Scene`: Phaser의 Scene 클래스를 상속
- `create()`: 씬이 생성될 때 실행되는 메서드
- `this.add.text()`: 텍스트 게임 객체를 추가
- `setOrigin(0.5)`: 텍스트의 중심점을 기준으로 정렬 (0.5 = 중앙)

### 단계 2: PhaserGame에 RaceScene 연결하기

**파일 경로:** `frontend/src/components/game/PhaserGame.tsx`

**작업:** 파일을 열고 아래처럼 수정하세요.

```typescript
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { RaceScene } from './scenes/RaceScene' // RaceScene import 추가

interface PhaserGameProps {
  width?: number
  height?: number
}

export function PhaserGame({ width = 1200, height = 600 }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: width,
      height: height,
      parent: containerRef.current,
      backgroundColor: '#1a1a2e',
      scene: [RaceScene], // 빈 배열 대신 RaceScene 추가
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [width, height])

  return <div ref={containerRef} className="w-full h-full" />
}
```

**변경사항:**

1. `import { RaceScene } from './scenes/RaceScene'` 추가
2. `scene: []` → `scene: [RaceScene]` 변경

**확인사항:**

1. 브라우저를 새로고침하세요
2. **예상 결과:** 화면 중앙에 "Hello Phaser!" 텍스트가 보여야 합니다
3. 에러가 없다면 성공! 다음 단계로 진행하세요.

### 단계 3: 트랙 그리기

**파일 경로:** `frontend/src/components/game/scenes/RaceScene.ts`

**작업:** `create()` 메서드를 아래처럼 수정하세요.

```typescript
create() {
  // 화면 크기 계산
  const centerX = this.scale.width / 2
  const centerY = this.scale.height / 2

  // 트랙 크기 설정
  const trackWidth = this.scale.width * 0.8 // 화면 너비의 80%
  const trackHeight = 60 // 트랙 높이
  const startX = this.scale.width * 0.1 // 시작 X 위치 (화면 왼쪽에서 10%)
  const startY = centerY // 시작 Y 위치 (화면 중앙)

  // Graphics 객체 생성 (그리기 도구)
  const graphics = this.add.graphics()

  // 트랙 배경 그리기 (잔디색)
  graphics.fillStyle(0x2d5016, 1) // 색상: 0x2d5016 (어두운 초록색), 투명도: 1
  graphics.fillRect(startX, startY, trackWidth, trackHeight)

  // 트랙 경계선 그리기 (흰색)
  graphics.lineStyle(2, 0xffffff, 1) // 두께: 2, 색상: 흰색, 투명도: 1
  graphics.strokeRect(startX, startY, trackWidth, trackHeight)

  // 결승선 그리기 (빨간색)
  graphics.lineStyle(4, 0xff0000, 1) // 두께: 4, 색상: 빨간색
  graphics.beginPath() // 경로 시작
  graphics.moveTo(startX + trackWidth, startY) // 시작점
  graphics.lineTo(startX + trackWidth, startY + trackHeight) // 끝점
  graphics.strokePath() // 경로 그리기

  // 시작선 그리기 (초록색)
  graphics.lineStyle(2, 0x00ff00, 1) // 두께: 2, 색상: 초록색
  graphics.beginPath()
  graphics.moveTo(startX, startY)
  graphics.lineTo(startX, startY + trackHeight)
  graphics.strokePath()

  // 디버깅용 텍스트 (나중에 제거 가능)
  this.add.text(centerX, 50, '트랙이 그려졌습니다!', {
    fontSize: '24px',
    color: '#ffffff',
  }).setOrigin(0.5)
}
```

**설명:**

- `this.add.graphics()`: 그래픽을 그릴 수 있는 객체 생성
- `fillStyle(색상, 투명도)`: 채우기 색상 설정
- `fillRect(x, y, width, height)`: 사각형 채우기
- `lineStyle(두께, 색상, 투명도)`: 선 스타일 설정
- `strokeRect()`: 사각형 테두리 그리기
- `beginPath()`, `moveTo()`, `lineTo()`, `strokePath()`: 선 그리기

**확인사항:**

1. 브라우저를 새로고침하세요
2. **예상 결과:**
   - 화면 중앙에 초록색 트랙이 보여야 합니다
   - 왼쪽에 초록색 시작선, 오른쪽에 빨간색 결승선이 보여야 합니다
3. 에러가 없다면 성공! 다음 단계로 진행하세요.

---

## 4. 게임 객체 추가하기

### 단계 1: Horse 엔티티 파일 생성

**파일 경로:** `frontend/src/components/game/entities/Horse.ts`

**작업:** 새 파일을 만들고 아래 코드를 **전체** 복사해서 붙여넣으세요.

```typescript
import Phaser from 'phaser'

// Horse 클래스: 여러 게임 객체를 하나로 묶는 Container 사용
export class Horse extends Phaser.GameObjects.Container {
  // 말의 정보를 저장할 속성들
  public playerId: string
  public playerName: string

  constructor(
    scene: Phaser.Scene, // Phaser 씬 객체
    x: number, // X 좌표
    y: number, // Y 좌표
    playerId: string, // 플레이어 ID
    playerName: string, // 플레이어 이름
  ) {
    // 부모 클래스(Container)의 생성자 호출
    super(scene, x, y)

    // 속성 저장
    this.playerId = playerId
    this.playerName = playerName

    // 말을 나타내는 원형 스프라이트 생성
    // scene.add.circle(x, y, 반지름, 색상)
    // Container 내부에서는 (0, 0)을 기준으로 배치
    const horseCircle = scene.add.circle(0, 0, 12, 0x8b4513) // 갈색 원
    this.add(horseCircle) // Container에 추가

    // 플레이어 이름을 표시할 텍스트 생성
    const nameText = scene.add.text(0, -25, playerName, {
      fontSize: '12px',
      color: '#ffffff', // 흰색
      backgroundColor: '#000000', // 검은 배경
      padding: { x: 4, y: 2 }, // 패딩
    })
    nameText.setOrigin(0.5) // 텍스트 중앙 정렬
    this.add(nameText) // Container에 추가

    // 씬에 이 Container를 등록 (중요!)
    scene.add.existing(this)
  }
}
```

**설명:**

- `Phaser.GameObjects.Container`: 여러 게임 객체를 하나로 묶는 컨테이너
- `super(scene, x, y)`: 부모 클래스 생성자 호출
- `scene.add.circle()`: 원형 게임 객체 생성
- `this.add()`: Container에 자식 객체 추가
- `scene.add.existing(this)`: 씬에 이 객체를 등록 (필수!)

### 단계 2: RaceScene에서 말 생성하기

**파일 경로:** `frontend/src/components/game/scenes/RaceScene.ts`

**작업:** 파일을 열고 아래처럼 수정하세요.

```typescript
import Phaser from 'phaser'
import { Horse } from '../entities/Horse' // Horse import 추가

export class RaceScene extends Phaser.Scene {
  // 말들을 저장할 배열
  private horses: Horse[] = []

  constructor() {
    super({ key: 'RaceScene' })
  }

  create() {
    // 화면 크기 계산
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    // 트랙 그리기 (이전 단계 코드)
    const trackWidth = this.scale.width * 0.8
    const trackHeight = 60
    const startX = this.scale.width * 0.1
    const startY = centerY

    const graphics = this.add.graphics()
    graphics.fillStyle(0x2d5016, 1)
    graphics.fillRect(startX, startY, trackWidth, trackHeight)
    graphics.lineStyle(2, 0xffffff, 1)
    graphics.strokeRect(startX, startY, trackWidth, trackHeight)
    graphics.lineStyle(4, 0xff0000, 1)
    graphics.beginPath()
    graphics.moveTo(startX + trackWidth, startY)
    graphics.lineTo(startX + trackWidth, startY + trackHeight)
    graphics.strokePath()
    graphics.lineStyle(2, 0x00ff00, 1)
    graphics.beginPath()
    graphics.moveTo(startX, startY)
    graphics.lineTo(startX, startY + trackHeight)
    graphics.strokePath()

    // 말 4마리 생성
    const horseNames = ['번개', '질풍', '그림자', '폭풍']
    const horseSpacing = trackHeight / (horseNames.length + 1) // 말들 사이 간격

    horseNames.forEach((name, index) => {
      // 각 말의 Y 위치 계산 (트랙 내부에 균등하게 배치)
      const horseY = startY + horseSpacing * (index + 1)

      // Horse 객체 생성
      const horse = new Horse(
        this, // 씬 객체
        startX, // 시작 X 위치 (트랙 왼쪽)
        horseY, // Y 위치
        `player-${index + 1}`, // 플레이어 ID
        name, // 말 이름
      )

      // 배열에 추가
      this.horses.push(horse)
    })
  }
}
```

**설명:**

- `private horses: Horse[]`: 말들을 저장할 배열
- `forEach()`: 배열의 각 요소에 대해 함수 실행
- `horseSpacing`: 말들 사이의 간격 계산
- `new Horse()`: Horse 객체 생성

**확인사항:**

1. 브라우저를 새로고침하세요
2. **예상 결과:**
   - 트랙 왼쪽에 4마리의 말(갈색 원)이 세로로 배치되어 있어야 합니다
   - 각 말 위에 이름이 표시되어야 합니다
3. 에러가 없다면 성공! 다음 단계로 진행하세요.

---

## 5. 애니메이션과 상호작용

### 단계 1: 말이 움직이게 만들기 (간단한 방법)

**파일 경로:** `frontend/src/components/game/scenes/RaceScene.ts`

**작업:** `create()` 메서드 끝에 아래 코드를 추가하세요.

```typescript
create() {
  // ... 기존 코드 (트랙 그리기, 말 생성) ...

  // 말들이 움직이도록 하는 이벤트 추가
  // 16ms마다 실행 (약 60 FPS)
  this.time.addEvent({
    delay: 16, // 16밀리초마다 실행
    callback: this.moveHorses, // 실행할 함수
    callbackScope: this, // this 컨텍스트 유지
    loop: true, // 무한 반복
  })
}

// 말들을 움직이는 메서드
private moveHorses() {
  const trackWidth = this.scale.width * 0.8
  const startX = this.scale.width * 0.1

  // 각 말을 조금씩 오른쪽으로 이동
  this.horses.forEach((horse) => {
    // 말의 현재 X 위치에 1픽셀씩 더하기
    horse.x += 1

    // 트랙 끝에 도달하면 멈춤
    if (horse.x >= startX + trackWidth) {
      horse.x = startX + trackWidth
    }
  })
}
```

**설명:**

- `this.time.addEvent()`: 시간 기반 이벤트 생성
- `delay: 16`: 16밀리초마다 실행 (약 60 FPS)
- `callback`: 실행할 함수 지정
- `callbackScope: this`: 함수 내부에서 `this`가 씬을 가리키도록 설정
- `loop: true`: 무한 반복

**확인사항:**

1. 브라우저를 새로고침하세요
2. **예상 결과:**
   - 말들이 오른쪽으로 천천히 이동해야 합니다
   - 결승선에 도달하면 멈춰야 합니다
3. 에러가 없다면 성공! 🎉

### 단계 2: 더 현실적인 움직임 만들기 (선택사항)

말들이 각각 다른 속도로 움직이도록 개선할 수 있습니다.

**파일 경로:** `frontend/src/components/game/scenes/RaceScene.ts`

**작업:** `moveHorses()` 메서드를 아래처럼 수정하세요.

```typescript
private moveHorses() {
  const trackWidth = this.scale.width * 0.8
  const startX = this.scale.width * 0.1

  // 각 말마다 다른 속도 설정
  const speeds = [1.5, 1.2, 1.0, 0.8] // 각 말의 속도

  this.horses.forEach((horse, index) => {
    // 각 말의 속도에 따라 이동
    horse.x += speeds[index] || 1

    // 트랙 끝에 도달하면 멈춤
    if (horse.x >= startX + trackWidth) {
      horse.x = startX + trackWidth
    }
  })
}
```

**확인사항:**

1. 브라우저를 새로고침하세요
2. **예상 결과:**
   - 말들이 서로 다른 속도로 움직여야 합니다
   - 첫 번째 말이 가장 빨리 결승선에 도달해야 합니다

---

## 다음 단계 (자유롭게 시도해보세요)

기본 구조가 완성되었습니다! 이제 다음 기능들을 추가해볼 수 있습니다:

### 1. 시뮬레이션 시스템 만들기

- `frontend/src/components/game/systems/RaceSimulator.ts` 파일 생성
- 말의 속도, 지구력, 컨디션 관리
- 주행 습성에 따른 전략 구현

### 2. UI 개선

- 실시간 순위 표시
- 진행률 표시
- 레이스 시간 표시

### 3. 이미지 에셋 추가

- 말 스프라이트 이미지
- 트랙 배경 이미지
- 애니메이션 추가

### 4. 레이스 종료 처리

- 승자 결정
- 결과 화면 표시
- 이벤트 발생

---

## 문제 해결

### 에러가 발생했을 때

1. **TypeScript 에러**
   - 파일 경로가 정확한지 확인
   - import 문이 올바른지 확인
   - 타입이 맞는지 확인

2. **화면에 아무것도 안 보일 때**
   - 브라우저 콘솔(F12)에서 에러 확인
   - 개발 서버가 실행 중인지 확인
   - 파일이 저장되었는지 확인

3. **말이 안 움직일 때**
   - `moveHorses()` 메서드가 제대로 추가되었는지 확인
   - `time.addEvent()`가 `create()` 메서드 안에 있는지 확인

### 유용한 디버깅 팁

```typescript
// 콘솔에 로그 출력
console.log('말 개수:', this.horses.length)

// 게임 객체 정보 확인
console.log('말 위치:', horse.x, horse.y)
```

---

## 유용한 리소스

- [Phaser 3 공식 문서](https://photonstorm.github.io/phaser3-docs/)
- [Phaser 3 예제](https://labs.phaser.io/)
- [Phaser 3 TypeScript 가이드](https://blog.ourcade.co/posts/2020/phaser-3-react-typescript/)

---

## 완료 체크리스트

각 단계를 완료했는지 확인하세요:

- [ ] PhaserGame.tsx 파일 생성 및 테스트
- [ ] RaceScene.ts 파일 생성 및 "Hello Phaser!" 표시
- [ ] 트랙 그리기 완료
- [ ] Horse.ts 파일 생성 및 말 4마리 표시
- [ ] 말들이 움직이기 시작

**모든 체크리스트를 완료했다면 축하합니다! 🎉**

이제 자유롭게 기능을 추가하고 개선해보세요!
