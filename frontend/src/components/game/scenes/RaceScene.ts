// RaceScene.ts
import Phaser from 'phaser'

// 배경 이미지
import mapImageUrl from '../../../assets/images/map/map2.png'

// 말 스프라이트 시트 (색만 다른 1, 2, 3, 4, 5, 6, 7, 8번)
import horse1Url from '../../../assets/images/horses/1.png'
import horse2Url from '../../../assets/images/horses/2.png'
import horse3Url from '../../../assets/images/horses/3.png'
import horse4Url from '../../../assets/images/horses/4.png'
import horse5Url from '../../../assets/images/horses/5.png'
import horse6Url from '../../../assets/images/horses/6.png'
import horse7Url from '../../../assets/images/horses/7.png'
import horse8Url from '../../../assets/images/horses/8.png'

// 아래 펜스만 따로 잘라낸 288x8 이미지
import fenceUrl from '../../../assets/images/map/fence.png'

// 증강 카드 잠금 아이콘
import lock3Url from '../../../assets/images/etc/lock3.png'

// 플레이어 표시 화살표
import arrowUrl from '../../../assets/images/etc/arrow.png'

// HUD / 순위표 전담 클래스
import RaceHUD from './RaceHUD'

// 시뮬레이션 시스템
import { Horse, TRACK_REAL_M } from '../../../lib/race-sim'

// 모듈화된 관리자들
import MapManager from './MapManager'
import HorseManager from './HorseManager'

// 증강 시스템
import type { Augment, AugmentRarity } from '../../../types/augment'
import { applyAugmentsToStats, generateRandomRarity } from '../../../data/augments'
import AugmentSelectionScene from './AugmentSelectionScene'
import RaceResultScene from './RaceResultScene'

// 시뮬레이션 시간 단위 (초) - 레이스 시간 조정을 위해 느리게 설정
const SIM_DT = 0.02 // 0.05에서 0.02로 변경하여 시뮬레이션 속도 감소 (레이스 시간 증가)

export default class RaceScene extends Phaser.Scene {
  // 트랙 관련
  private readonly segmentCount = 5
  private raceDistance = 0
  private finished = false
  private startWorldX = 0 // 시작점의 월드 X 좌표
  private finishXOnScreen = 0 // 출발점부터 도착점까지의 거리 (시뮬레이션 500m에 해당)
  private shouldStartScrolling = false // 말이 캔버스 중앙에 도달했는지 여부
  private initialRaceDistance = 0 // 스크롤 시작 시점의 raceDistance 기준점
  private initialMaxPosition = 0 // 스크롤 시작 시점의 말의 최대 position

  // 레이스 상태
  private raceStarted = false

  // UI
  private startButton?: Phaser.GameObjects.Text

  // 미니맵 진행 바
  private progressBarBg?: Phaser.GameObjects.Rectangle
  private progressBarStartMarker?: Phaser.GameObjects.Rectangle
  private progressBarFinishMarker?: Phaser.GameObjects.Rectangle
  private progressBarIndicator?: Phaser.GameObjects.Rectangle

  // 레이스 종료 관련
  private celebrationEffectShown = false

  // 게임 영역 / HUD 높이
  private readonly HUD_HEIGHT = 160
  private gameAreaHeight = 0

  // 모듈화된 관리자들
  private mapManager!: MapManager
  private horseManager!: HorseManager
  private hud!: RaceHUD

  // 시뮬레이션 관련
  private simTime: number = 0

  // 플레이어 말 인덱스 (0 = 1번 말, 1 = 2번 말, ...)
  private readonly playerHorseIndex = 0

  // 증강 관련
  private selectedAugments: Augment[] = []
  private readonly maxRerolls = 3 // 최대 리롤 횟수
  private augmentSelectionActive = false

  constructor() {
    super('RaceScene')
  }

  preload() {
    // 배경
    this.load.image('map2', mapImageUrl)

    // 폭죽 효과용 파티클 (간단한 원형)
    this.load.image(
      'particle',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    )

    // 말 스프라이트 시트: 64x64 그리드
    const horseUrls = [
      horse1Url,
      horse2Url,
      horse3Url,
      horse4Url,
      horse5Url,
      horse6Url,
      horse7Url,
      horse8Url,
    ]
    const spriteSize = { frameWidth: 64, frameHeight: 64 }

    for (let i = 0; i < horseUrls.length; i++) {
      this.load.spritesheet(`horse${i + 1}`, horseUrls[i], spriteSize)
    }

    // 아래 펜스 이미지(288x8)
    this.load.image('fenceBottom', fenceUrl)

    // 증강 카드 잠금 아이콘
    this.load.image('lock3', lock3Url)

    // 플레이어 표시 화살표
    this.load.image('arrow', arrowUrl)
  }

  create() {
    const gameWidth = this.scale.width
    const fullHeight = this.scale.height

    // 아래 HUD 영역만큼 게임 영역 높이 줄이기
    this.gameAreaHeight = fullHeight - this.HUD_HEIGHT
    const gameHeight = this.gameAreaHeight

    // ===== 맵 생성 =====
    // 시작 위치와 도착 위치를 픽셀로 명확히 정의
    const startPositionPixels = 150 // 시작 위치 (픽셀)
    const finishPositionPixels = 6500 // 도착 위치 (픽셀) - 깃발 위치와 시뮬레이션 종료 위치가 동일

    // 출발점부터 도착점까지의 거리 (시뮬레이션 500m에 해당)
    const raceDistancePixels = finishPositionPixels - startPositionPixels // 6500 - 150 = 6350픽셀

    this.mapManager = new MapManager({
      scene: this,
      segmentCount: this.segmentCount,
      gameWidth,
      gameHeight,
      mapTextureKey: 'map2',
      fenceTextureKey: 'fenceBottom',
      startMargin: startPositionPixels, // 시작 위치
      raceDistance: raceDistancePixels, // 출발점부터 도착점까지의 거리
    })

    // finishXOnScreen: 출발점 ~ 도착점 사이의 화면상 거리 (시뮬레이션 500m에 해당)
    this.finishXOnScreen = this.mapManager.getFinishXOnScreen()

    // startWorldX: 출발점의 월드 X 좌표
    this.startWorldX = this.mapManager.getStartWorldX()

    // ===== 말 생성 =====
    this.horseManager = new HorseManager({
      scene: this,
      gameHeight,
      startXOnScreen: this.startWorldX,
      playerHorseIndex: this.playerHorseIndex,
      arrowTextureKey: 'arrow',
    })

    // ===== START 버튼 =====
    this.startButton = this.add
      .text(gameWidth / 2, gameHeight * 0.15, 'START', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000',
      })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setDepth(20)
      .setInteractive({ useHandCursor: true })

    this.startButton.on('pointerdown', () => this.handleStart())

    // ===== HUD & 순위표 UI (분리된 클래스 사용) =====
    this.hud = new RaceHUD(this, this.gameAreaHeight, this.HUD_HEIGHT)
    this.hud.createHUD()
    this.hud.createRankingPanel()

    // 초기 능력치 표시 (레이스 시작 전에도 표시)
    this.updateHUDInitial()

    // ===== 미니맵 진행 바 생성 =====
    this.createProgressBar(gameWidth, gameHeight)

    // ===== 증강 선택 =====
    // 게임 시작 전 증강 선택 (랜덤 등급)
    const randomRarity = generateRandomRarity()
    this.showAugmentSelection(randomRarity)
  }

  private handleStart() {
    if (this.raceStarted || this.augmentSelectionActive) return

    this.raceStarted = true
    this.simTime = 0 // 시뮬레이션 시간 초기화
    this.startButton?.setVisible(false)

    // 플레이어 표시 숨기기 (레이스 시작 시)
    this.horseManager.hidePlayerIndicator()

    // 모든 말에 대해 달리기 시작
    this.horseManager.startAllHorses()
  }

  // 증강 선택 화면 표시
  private showAugmentSelection(rarity: AugmentRarity) {
    console.log('showAugmentSelection 호출됨', { rarity, maxRerolls: this.maxRerolls })
    this.augmentSelectionActive = true
    this.startButton?.setVisible(false) // START 버튼 숨기기

    // Scene이 이미 실행 중이면 중지
    if (this.scene.isActive('AugmentSelectionScene')) {
      this.scene.stop('AugmentSelectionScene')
    }

    // Scene 실행 데이터 준비
    const sceneData = {
      rarity,
      maxRerolls: this.maxRerolls,
      onSelect: (augment: Augment) => {
        this.onAugmentSelected(augment)
      },
      onCancel: () => {
        // 취소 시 기본 증강 없이 진행
        this.augmentSelectionActive = false
        this.startButton?.setVisible(true)
      },
    }

    // Scene이 등록되어 있는지 확인
    const augmentScene = this.scene.get('AugmentSelectionScene')
    if (!augmentScene) {
      console.error('AugmentSelectionScene이 등록되지 않았습니다.')
      // Scene을 직접 추가
      this.scene.add('AugmentSelectionScene', AugmentSelectionScene as typeof Phaser.Scene, false)
    }

    // Scene 실행
    this.scene.launch('AugmentSelectionScene', sceneData)
  }

  // 증강 선택 완료 처리
  private onAugmentSelected(augment: Augment) {
    this.selectedAugments.push(augment)
    this.augmentSelectionActive = false

    // 플레이어 말의 능력치에 증강 적용
    this.applyAugmentsToPlayerHorse()

    // START 버튼 다시 표시
    this.startButton?.setVisible(true)

    // HUD 업데이트 (증강 적용 후 능력치 반영)
    this.updateHUDInitial()

    // 증강 카드 업데이트
    this.hud.updateAugments(this.selectedAugments)
  }

  // 플레이어 말에 증강 적용
  private applyAugmentsToPlayerHorse() {
    const simHorses = this.horseManager.getSimHorses()
    const playerHorse = simHorses[this.playerHorseIndex]

    if (playerHorse && this.selectedAugments.length > 0) {
      // 증강을 baseStats에 적용
      const augmentedStats = applyAugmentsToStats(playerHorse.baseStats, this.selectedAugments)

      // baseStats 업데이트
      playerHorse.baseStats = augmentedStats

      // prepareForRace를 다시 호출하여 effStats 재계산
      playerHorse.prepareForRace()
    }
  }

  update() {
    if (!this.mapManager) return

    if (this.raceStarted) {
      const allFinished = this.updateSimulation()

      // 레이스 종료 체크를 먼저 수행하여 finished 상태를 설정
      if (allFinished && !this.finished) {
        this.finished = true
        this.showRaceResult()
      }

      this.updateTrackScroll()
      this.updateHorsePositions()
      this.updateHUD()
      this.mapManager.updateStripePositions(this.raceDistance)
      this.updateProgressBar()
    }
  }

  // 시뮬레이션 업데이트
  private updateSimulation(): boolean {
    const simHorses = this.horseManager.getSimHorses()
    let allFinished = true
    for (const simHorse of simHorses) {
      if (!simHorse.finished) {
        simHorse.step(SIM_DT, this.simTime)
        allFinished = false
      }
    }
    this.simTime += SIM_DT
    return allFinished
  }

  // 트랙 스크롤 업데이트
  private updateTrackScroll() {
    const simHorses = this.horseManager.getSimHorses()
    const gameWidth = this.scale.width
    const centerX = gameWidth / 2

    // 말이 캔버스 중앙에 도달했는지 확인
    if (!this.shouldStartScrolling) {
      for (const simHorse of simHorses) {
        // 말의 화면 위치 계산
        const progress = simHorse.position / TRACK_REAL_M
        const horseScreenDistance = progress * this.finishXOnScreen
        const horseWorldX = this.startWorldX + horseScreenDistance
        const horseScreenX = horseWorldX - this.raceDistance

        if (horseScreenX >= centerX) {
          this.shouldStartScrolling = true
          // 스크롤 시작 시점에 말이 중앙에 있도록 raceDistance 초기화
          this.initialRaceDistance = horseWorldX - centerX
          this.raceDistance = this.initialRaceDistance
          // 스크롤 시작 시점의 말의 최대 position 저장
          this.initialMaxPosition = Math.max(...simHorses.map((h) => h.position))
          // 초기 raceDistance 설정 후 바로 return하여 같은 프레임에서 덮어씌워지지 않도록 함
          this.updateTilePositionX()
          return
        }
      }
    }

    // 스크롤이 시작되어야 할 때만 raceDistance 업데이트
    if (this.shouldStartScrolling) {
      const maxPosition = Math.max(...simHorses.map((h) => h.position))
      // 스크롤 시작 시점의 기준점에서 증가한 거리만큼만 raceDistance 증가
      this.raceDistance =
        this.initialRaceDistance +
        ((maxPosition - this.initialMaxPosition) / TRACK_REAL_M) * this.finishXOnScreen

      // 레이스가 종료되지 않았을 때만 tilePositionX 업데이트
      if (!this.finished) {
        this.updateTilePositionX()
      }
    }
  }

  // tilePositionX 업데이트 헬퍼 메서드
  private updateTilePositionX() {
    const scaleFactor = this.mapManager.getScaleFactor()
    const logicalX = this.raceDistance / scaleFactor
    this.mapManager.setTilePositionX(Math.round(logicalX))
  }

  // 말 위치 업데이트
  private updateHorsePositions() {
    const simHorses = this.horseManager.getSimHorses()
    const screenXArray: number[] = []

    for (const simHorse of simHorses) {
      if (this.simTime < simHorse.raceStartTime) {
        // 출발 전: 출발점에 고정 (트랙 스크롤 고려)
        screenXArray.push(this.startWorldX - this.raceDistance)
      } else {
        const screenX = this.calculateHorseScreenX(simHorse)
        screenXArray.push(screenX)
      }
    }

    this.horseManager.updateHorsePositions(screenXArray)
  }

  // 말의 화면 X 좌표 계산
  private calculateHorseScreenX(simHorse: Horse): number {
    let progress = simHorse.position / TRACK_REAL_M

    if (simHorse.finished && progress >= 1.0) {
      const timeSinceFinish = this.simTime - (simHorse.finishTime || this.simTime)
      const additionalProgress = (timeSinceFinish * 15) / TRACK_REAL_M
      progress = 1.0 + additionalProgress
    }

    // 시뮬레이션 거리를 화면 거리로 변환
    const horseScreenDistance = progress * this.finishXOnScreen
    const horseWorldX = this.startWorldX + horseScreenDistance

    // 화면 좌표 = 월드 좌표 - raceDistance (트랙 스크롤)
    return horseWorldX - this.raceDistance
  }

  // 초기 HUD 업데이트 (레이스 시작 전)
  private updateHUDInitial() {
    const simHorses = this.horseManager.getSimHorses()
    const horseData = simHorses.map((h) => ({
      name: h.name,
      position: h.position,
      finished: h.finished,
      finishTime: h.finishTime,
      currentTime: 0, // 초기 시간
    }))
    this.hud.updateRanking(horseData)

    // 플레이어 말의 능력치 업데이트 (레이스 시작 전에도 표시)
    if (simHorses[this.playerHorseIndex]) {
      const playerHorse = simHorses[this.playerHorseIndex]
      this.hud.updateStats({
        currentSpeed: 0, // 레이스 시작 전이므로 0
        maxSpeed_ms: playerHorse.maxSpeed_ms,
        stamina: playerHorse.stamina,
        maxStamina: playerHorse.maxStamina,
        conditionRoll: playerHorse.conditionRoll,
        baseStats: playerHorse.baseStats,
        effStats: playerHorse.effStats,
      })
    }
  }

  // HUD 업데이트
  private updateHUD() {
    const simHorses = this.horseManager.getSimHorses()
    const horseData = simHorses.map((h) => ({
      name: h.name,
      position: h.position,
      finished: h.finished,
      finishTime: h.finishTime,
      currentTime: this.simTime, // 시뮬레이션 시간을 currentTime으로 전달
    }))
    this.hud.updateRanking(horseData)

    // 플레이어 말의 능력치 업데이트
    if (simHorses[this.playerHorseIndex]) {
      const playerHorse = simHorses[this.playerHorseIndex]
      this.hud.updateStats({
        currentSpeed: playerHorse.currentSpeed,
        maxSpeed_ms: playerHorse.maxSpeed_ms,
        stamina: playerHorse.stamina,
        maxStamina: playerHorse.maxStamina,
        conditionRoll: playerHorse.conditionRoll,
        baseStats: playerHorse.baseStats,
        effStats: playerHorse.effStats,
      })
    }
  }

  // 미니맵 진행 바 생성
  private createProgressBar(gameWidth: number, gameHeight: number) {
    const barHeight = 4 // 얇은 막대
    const barY = gameHeight * 0.1 // 맵 상단 (하늘 부분)
    const barWidth = (gameWidth - 80) / 2 // 원래 길이의 반
    const barX = gameWidth / 2 // 화면 가운데

    // 진행 바 배경
    this.progressBarBg = this.add
      .rectangle(barX, barY, barWidth, barHeight, 0xffffff, 0.3)
      .setOrigin(0.5)
      .setDepth(25)

    // 시작점 마커
    const markerWidth = 3
    const markerHeight = 8
    const startX = barX - barWidth / 2
    this.progressBarStartMarker = this.add
      .rectangle(startX, barY, markerWidth, markerHeight, 0x00ff00, 1)
      .setOrigin(0.5)
      .setDepth(26)

    // 도착점 마커
    const finishX = barX + barWidth / 2
    this.progressBarFinishMarker = this.add
      .rectangle(finishX, barY, markerWidth, markerHeight, 0xff0000, 1)
      .setOrigin(0.5)
      .setDepth(26)

    // 현재 위치 인디케이터
    const indicatorWidth = 6
    const indicatorHeight = 12
    this.progressBarIndicator = this.add
      .rectangle(startX, barY, indicatorWidth, indicatorHeight, 0xffff00, 1)
      .setOrigin(0.5)
      .setDepth(27)
  }

  // 미니맵 진행 바 업데이트
  private updateProgressBar() {
    if (!this.progressBarIndicator || !this.progressBarBg) return

    const simHorses = this.horseManager.getSimHorses()
    const playerHorse = simHorses[this.playerHorseIndex]

    if (!playerHorse) return

    // 플레이어 말의 진행률 계산 (0 ~ 1)
    const progress = Math.min(1, Math.max(0, playerHorse.position / TRACK_REAL_M))

    // 진행 바 위치 계산 (가운데 정렬)
    const gameWidth = this.scale.width
    const barWidth = (gameWidth - 80) / 2 // 원래 길이의 반
    const barX = gameWidth / 2 // 화면 가운데
    const startX = barX - barWidth / 2
    const indicatorX = startX + progress * barWidth

    // 인디케이터 위치 업데이트
    this.progressBarIndicator.setX(indicatorX)
  }

  // 레이스 결과 표시
  private showRaceResult() {
    if (this.celebrationEffectShown) return
    this.celebrationEffectShown = true

    // 폭죽 효과 생성
    this.createFireworks()

    // 최종 순위 계산
    const simHorses = this.horseManager.getSimHorses()
    const rankings = simHorses
      .map((horse, index) => ({
        horse,
        index,
        position: horse.position,
        finished: horse.finished,
        finishTime: horse.finishTime ?? null,
        currentTime: this.simTime,
      }))
      .sort((a, b) => {
        // 완주한 말이 우선
        if (a.finished && !b.finished) return -1
        if (!a.finished && b.finished) return 1
        // 둘 다 완주했으면 finishTime 기준 (빠른 순)
        if (a.finished && b.finished) {
          const aTime = a.finishTime ?? Infinity
          const bTime = b.finishTime ?? Infinity
          return aTime - bTime
        }
        // 둘 다 미완주면 position 기준
        return b.position - a.position
      })
      .map((result, rankIndex) => {
        // 증강 정보 추가 (1번 말은 실제 선택한 증강, 나머지는 하드코딩)
        let augments: Augment[] = []
        if (result.index === this.playerHorseIndex) {
          // 플레이어 말 (1번 말)은 실제 선택한 증강 사용
          augments = this.selectedAugments
        } else {
          // 2~8번 말은 하드코딩된 증강 (예시)
          // 각 말마다 다른 증강 부여
          const mockAugments: Augment[][] = [
            // 2번 말
            [
              {
                id: 'mock1',
                name: '가속 증강',
                rarity: 'common',
                statType: 'Power',
                statValue: 2,
              },
            ],
            // 3번 말
            [
              {
                id: 'mock2',
                name: '스테미나 증강',
                rarity: 'rare',
                statType: 'Stamina',
                statValue: 3,
              },
            ],
            // 4번 말
            [
              {
                id: 'mock3',
                name: '근성 증강',
                rarity: 'common',
                statType: 'Guts',
                statValue: 1,
              },
            ],
            // 5번 말
            [
              {
                id: 'mock4',
                name: '최고속도 증강',
                rarity: 'rare',
                statType: 'Speed',
                statValue: 3,
              },
            ],
            // 6번 말
            [
              {
                id: 'mock5',
                name: '출발 증강',
                rarity: 'common',
                statType: 'Start',
                statValue: 2,
              },
            ],
            // 7번 말
            [
              {
                id: 'mock6',
                name: '안정성 증강',
                rarity: 'rare',
                statType: 'Consistency',
                statValue: 2,
              },
            ],
            // 8번 말
            [
              {
                id: 'mock7',
                name: '가속 증강',
                rarity: 'common',
                statType: 'Power',
                statValue: 1,
              },
            ],
          ]
          augments = mockAugments[result.index - 1] || []
        }

        return {
          rank: rankIndex + 1,
          name: result.horse.name,
          time: result.finished && result.finishTime ? result.finishTime : result.currentTime,
          finished: result.finished,
          augments,
        }
      })

    // 결과 Scene 표시 (약간의 딜레이 후)
    this.time.delayedCall(1000, () => {
      // Scene이 등록되어 있는지 확인
      const resultScene = this.scene.get('RaceResultScene')
      if (!resultScene) {
        this.scene.add('RaceResultScene', RaceResultScene as typeof Phaser.Scene, false)
      }

      // Scene 실행
      this.scene.launch('RaceResultScene', {
        rankings,
        playerHorseIndex: this.playerHorseIndex,
        onClose: () => {
          // 닫기 버튼 클릭 시 처리 (필요시)
        },
      })
    })
  }

  // 폭죽 효과 생성
  private createFireworks() {
    const width = this.scale.width
    const height = this.scale.height

    // 여러 위치에서 폭죽 발사
    const fireworkPositions = [
      { x: width * 0.2, y: height * 0.3 },
      { x: width * 0.5, y: height * 0.2 },
      { x: width * 0.8, y: height * 0.3 },
    ]

    fireworkPositions.forEach((pos, index) => {
      this.time.delayedCall(index * 300, () => {
        // 각 위치에서 폭죽 발사
        for (let i = 0; i < 20; i++) {
          const angle = (Math.PI * 2 * i) / 20
          const speed = 150 + Math.random() * 100
          const vx = Math.cos(angle) * speed
          const vy = Math.sin(angle) * speed

          const particle = this.add.circle(pos.x, pos.y, 4, 0xffffff, 1)
          particle.setDepth(1999)

          // 랜덤 색상 적용
          const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]
          const color = colors[Math.floor(Math.random() * colors.length)]
          particle.setFillStyle(color)

          this.tweens.add({
            targets: particle,
            x: pos.x + vx * 0.5,
            y: pos.y + vy * 0.5,
            alpha: 0,
            scale: 0,
            duration: 1000 + Math.random() * 500,
            ease: 'Power2',
            onComplete: () => {
              particle.destroy()
            },
          })
        }
      })
    })
  }
}
