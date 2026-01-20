// RaceScene.ts
import Phaser from 'phaser'
import type { Room, Player } from '../../../hooks/useRoom'

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
import lockUrl from '../../../assets/images/etc/lock.png'

// 플레이어 표시 화살표
import arrowUrl from '../../../assets/images/etc/arrow.png'

// 시뮬레이션 시스템
import { Horse, TRACK_REAL_M } from '../../../engine/race'
import type { Stats } from '../../../engine/race/types'

// 관리자 클래스들
import MapManager from '../managers/MapManager'
import HorseManager from '../managers/HorseManager'
import RaceHUD from '../managers/RaceHUD'

// 증강 시스템
import type { Augment, AugmentRarity } from '../../../engine/race'
import {
  applyAugmentsToStats,
  generateRandomRarity,
  generateAugmentChoices,
  createLastSpurtAugment,
  createOvertakeAugment,
  createEscapeCrisisAugment,
} from '../../../engine/race'
import AugmentSelectionScene from './AugmentSelectionScene'
import RaceResultScene from './RaceResultScene'
import GameSetupScene from './GameSetupScene'

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
  private countdownActive = false

  // 미니맵 진행 바
  private progressBarContainer?: Phaser.GameObjects.Container
  private progressBarBg?: Phaser.GameObjects.Graphics
  private progressBarFill?: Phaser.GameObjects.Graphics
  private progressBarIndicator?: Phaser.GameObjects.Container
  private finishMarker?: Phaser.GameObjects.Container
  private progressBarShown = false // 진행바 표시 여부

  // 레이스 종료 관련
  private celebrationEffectShown = false
  private dramaticFinishTriggered = false // 극적인 피니시 연출 트리거 여부
  private currentSimDt = SIM_DT // 현재 시뮬레이션 속도
  private cameraYBeforeDramaticFinish = 0 // 줌인 전 카메라 Y 위치 저장
  private slowMotionStartTime = 0 // 슬로우모션 시작 시점 (실제 시간)
  private timeBeforeSlowMotion = 0 // 슬로우모션 시작 전 경과 시간

  // 게임 영역 / HUD 높이
  private readonly HUD_HEIGHT = 160
  private gameAreaHeight = 0

  // 모듈화된 관리자들
  private mapManager!: MapManager
  private horseManager!: HorseManager
  private hud!: RaceHUD

  // 시뮬레이션 관련
  private simTime: number = 0
  private raceStartTime: number = 0 // 레이스 시작 시각 (performance.now())

  // 플레이어 말 인덱스 (0 = 1번 말, 1 = 2번 말, ...)
  private playerHorseIndex = 0

  // 게임 설정 (개발용)
  private gameSettings: {
    playerCount: number
    setCount: number
    playerHorseIndex: number
  } = { playerCount: 8, setCount: 3, playerHorseIndex: 0 }

  // 세트 관련
  private currentSet = 1 // 현재 세트 (1부터 시작)

  // 증강 관련
  private selectedAugments: Augment[] = []
  private remainingRerolls = 3 // 남은 리롤 횟수 (세트 간 공유, 초기값: 3)
  private augmentSelectionActive = false
  private horseAugments: Augment[][] = [] // 각 말의 증강 저장 (인덱스 = 말 번호 - 1)

  // Firebase 데이터 저장
  private roomId?: string
  private playerId?: string
  private room?: Room
  private players?: Player[]
  private userId?: string

  // 개발 모드: 선택한 말 데이터
  private selectedHorse?: {
    name: string
    stats: Stats
    totalStats: number
    selectedAt: string
  }

  constructor() {
    super('RaceScene')
  }

  /**
   * Scene 초기화 시 데이터 받기
   */
  init(data?: {
    roomId?: string
    playerId?: string
    room?: Room
    players?: Player[]
    userId?: string
    selectedHorse?: {
      name: string
      stats: Stats
      totalStats: number
      selectedAt: string
    }
  }) {
    if (data) {
      this.roomId = data.roomId
      this.playerId = data.playerId
      this.room = data.room
      this.players = data.players
      this.userId = data.userId
      this.selectedHorse = data.selectedHorse
    }
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
    this.load.image('lock', lockUrl)

    // 플레이어 표시 화살표
    this.load.image('arrow', arrowUrl)
  }

  create() {
    // Firebase 데이터 읽기 (PhaserGame에서 전달된 데이터)
    this.loadFirebaseData()

    // Firebase 데이터 업데이트 이벤트 구독
    this.events.on(
      'room-data-updated',
      (data: {
        roomId?: string
        playerId?: string
        room?: Room
        players?: Player[]
        userId?: string
        selectedHorse?: {
          name: string
          stats: Stats
          totalStats: number
          selectedAt: string
        }
      }) => {
        this.roomId = data.roomId
        this.playerId = data.playerId
        this.room = data.room
        this.players = data.players
        this.userId = data.userId
        this.selectedHorse = data.selectedHorse
        this.onFirebaseDataUpdated()
      },
    )

    const gameWidth = this.scale.width
    const fullHeight = this.scale.height

    // 아래 HUD 영역만큼 게임 영역 높이 줄이기
    this.gameAreaHeight = fullHeight - this.HUD_HEIGHT
    const gameHeight = this.gameAreaHeight

    // ===== 픽셀 아트 텍스처 필터 일괄 적용 =====
    const pixelArtTextures = [
      'map2',
      'fenceBottom',
      'arrow',
      // lock는 일반 이미지이므로 픽셀 아트 필터 제외
      ...Array.from({ length: 8 }, (_, i) => `horse${i + 1}`), // horse1 ~ horse8
    ]
    pixelArtTextures.forEach((textureKey) => {
      if (this.textures.exists(textureKey)) {
        this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST)
      }
    })

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
      playerCount: this.gameSettings.playerCount,
    })

    // START 버튼 제거 - 카운트다운으로 대체

    // ===== 미니맵 진행 바 생성 =====
    this.createProgressBar(gameWidth, gameHeight)

    // ===== 게임 설정 (개발용) =====
    this.showGameSetup()
  }

  private handleStart() {
    if (this.raceStarted || this.augmentSelectionActive || this.countdownActive) return

    this.raceStarted = true
    this.simTime = 0 // 시뮬레이션 시간 초기화
    this.raceStartTime = performance.now() // 레이스 시작 시각 기록

    // 플레이어 표시 숨기기 (레이스 시작 시)
    this.horseManager.hidePlayerIndicator()

    // 모든 말에 대해 달리기 시작
    this.horseManager.startAllHorses()
  }

  /**
   * 게임 설정 씬 표시 (개발용)
   */
  private showGameSetup() {
    // Scene이 등록되어 있는지 확인
    const setupScene = this.scene.get('GameSetupScene')
    if (!setupScene) {
      this.scene.add('GameSetupScene', GameSetupScene as typeof Phaser.Scene, false)
    }

    // Scene 실행
    this.scene.launch('GameSetupScene', {
      onComplete: (settings: {
        playerCount: number
        setCount: number
        playerHorseIndex: number
      }) => {
        this.onGameSetupComplete(settings)
      },
    })
  }

  /**
   * 게임 설정 완료 처리
   */
  private onGameSetupComplete(settings: {
    playerCount: number
    setCount: number
    playerHorseIndex: number
  }) {
    this.gameSettings = settings
    this.playerHorseIndex = settings.playerHorseIndex

    // 플레이어 수에 맞게 말 매니저 재생성
    this.recreateHorseManager()

    // HUD 재생성 (세트 수에 맞게)
    this.recreateHUD()

    // ===== 증강 선택 =====
    // 게임 시작 전 증강 선택 (랜덤 등급)
    const randomRarity = generateRandomRarity()
    this.showAugmentSelection(randomRarity)
  }

  /**
   * 말 매니저 재생성 (플레이어 수 변경 시)
   */
  private recreateHorseManager() {
    // 기존 말 매니저 정리
    if (this.horseManager) {
      // 기존 말들 제거 (시뮬레이션 말들은 유지하되 시각적 요소만 정리)
      this.horseManager.getHorses().forEach((horse) => {
        horse.destroy()
      })
      // 기존 인디케이터 제거
      this.horseManager.destroy()
    }

    // 새로운 말 매니저 생성
    this.horseManager = new HorseManager({
      scene: this,
      gameHeight: this.gameAreaHeight,
      startXOnScreen: this.startWorldX,
      playerHorseIndex: this.playerHorseIndex,
      arrowTextureKey: 'arrow',
      playerCount: this.gameSettings.playerCount,
    })
  }

  /**
   * HUD 재생성 (세트 수 변경 시)
   */
  private recreateHUD() {
    // 기존 HUD 정리
    if (this.hud) {
      this.hud.destroy()
    }

    // 새로운 HUD 생성
    this.hud = new RaceHUD(
      this,
      this.gameAreaHeight,
      this.HUD_HEIGHT,
      this.gameSettings.setCount,
      this.gameSettings.playerCount,
    )
    this.hud.createHUD()
    this.hud.createRankingPanel()
  }

  /**
   * 카운트다운 시작
   */
  private startCountdown() {
    if (this.countdownActive) return
    this.countdownActive = true

    const gameWidth = this.scale.width
    const gameHeight = this.gameAreaHeight

    // 카운트다운 텍스트 생성
    const countdownText = this.add
      .text(gameWidth / 2, gameHeight / 2, '3', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '120px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(3000)
      .setAlpha(0)

    // 카운트다운 시퀀스
    const counts = [3, 2, 1, 'GO!']
    let currentIndex = 0

    const showNextCount = () => {
      if (currentIndex >= counts.length) {
        // 카운트다운 완료
        countdownText.destroy()
        this.countdownActive = false
        this.handleStart()
        return
      }

      const count = counts[currentIndex]
      countdownText.setText(count.toString())

      // 페이드 인 + 스케일 업 애니메이션
      countdownText.setAlpha(0).setScale(0.5)
      this.tweens.add({
        targets: countdownText,
        alpha: 1,
        scale: 1.2,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          // 잠시 유지
          this.time.delayedCall(400, () => {
            // 페이드 아웃
            this.tweens.add({
              targets: countdownText,
              alpha: 0,
              scale: 1.5,
              duration: 300,
              ease: 'Power2',
              onComplete: () => {
                currentIndex++
                showNextCount()
              },
            })
          })
        },
      })
    }

    // 첫 카운트 시작
    showNextCount()
  }

  // 증강 선택 화면 표시
  private showAugmentSelection(rarity: AugmentRarity) {
    this.augmentSelectionActive = true

    // Scene이 이미 실행 중이면 중지
    if (this.scene.isActive('AugmentSelectionScene')) {
      this.scene.stop('AugmentSelectionScene')
    }

    // Scene 실행 데이터 준비
    const sceneData = {
      rarity,
      maxRerolls: this.remainingRerolls, // 남은 리롤 횟수 전달
      onSelect: (augment: Augment, usedRerolls: number) => {
        this.onAugmentSelected(augment, usedRerolls)
      },
      onCancel: () => {
        // 취소 시 기본 증강 없이 진행
        this.augmentSelectionActive = false
        // 카운트다운 시작
        this.startCountdown()
      },
    }

    // Scene이 등록되어 있는지 확인
    const augmentScene = this.scene.get('AugmentSelectionScene')
    if (!augmentScene) {
      this.scene.add('AugmentSelectionScene', AugmentSelectionScene as typeof Phaser.Scene, false)
    }

    // Scene 실행
    this.scene.launch('AugmentSelectionScene', sceneData)
  }

  // 증강 선택 완료 처리
  private onAugmentSelected(augment: Augment, usedRerolls: number) {
    this.selectedAugments.push(augment)
    this.augmentSelectionActive = false

    // 사용한 리롤 횟수만큼 차감
    this.remainingRerolls -= usedRerolls

    // 선택된 증강의 등급 확인
    const selectedRarity = augment.rarity

    // 모든 말에 동일 등급의 랜덤 증강 부여
    this.assignAugmentsToAllHorses(selectedRarity)

    // 모든 말에 증강 적용
    this.applyAugmentsToAllHorses()

    // HUD 업데이트 (증강 적용 후 능력치 반영)
    this.updateHUDInitial()

    // 증강 카드 업데이트
    this.hud.updateAugments(this.selectedAugments)

    // 카운트다운 시작
    this.startCountdown()
  }

  // 모든 말에 동일 등급의 랜덤 증강 부여
  private assignAugmentsToAllHorses(rarity: AugmentRarity) {
    const simHorses = this.horseManager.getSimHorses()
    this.horseAugments = []

    for (let i = 0; i < simHorses.length; i++) {
      let randomAugment: Augment

      if (i === this.playerHorseIndex) {
        // 플레이어 말(1번 말)은 선택한 증강 사용
        randomAugment = this.selectedAugments[this.selectedAugments.length - 1]
      } else {
        // 다른 말들은 랜덤 증강 부여
        if (rarity === 'hidden') {
          // 플레이어가 히든 등급을 선택한 경우:
          // 9% 확률로 히든 등급, 91% 확률로 전설 등급 부여
          const roll = Math.random()
          if (roll < 0.09) {
            // 9% 확률: 히든 등급 특수 능력
            const specialAbilities = [
              createLastSpurtAugment(),
              createOvertakeAugment(),
              createEscapeCrisisAugment(),
            ]
            randomAugment = specialAbilities[Math.floor(Math.random() * specialAbilities.length)]
          } else {
            // 91% 확률: 전설 등급
            const choices = generateAugmentChoices('legendary')
            randomAugment = choices[Math.floor(Math.random() * choices.length)]
          }
        } else {
          // 일반 등급은 generateAugmentChoices로 3개 생성 후 랜덤 선택
          const choices = generateAugmentChoices(rarity)
          randomAugment = choices[Math.floor(Math.random() * choices.length)]
        }
      }

      this.horseAugments.push([randomAugment])
    }
  }

  // 모든 말에 증강 적용
  private applyAugmentsToAllHorses() {
    const simHorses = this.horseManager.getSimHorses()

    for (let i = 0; i < simHorses.length; i++) {
      const horse = simHorses[i]
      const augments = this.horseAugments[i] || []

      if (horse && augments.length > 0) {
        // 증강을 baseStats에 적용
        const augmentedStats = applyAugmentsToStats(horse.baseStats, augments)

        // baseStats 업데이트
        horse.baseStats = augmentedStats

        // 특수 능력 적용
        for (const augment of augments) {
          if (augment.specialAbility && augment.specialAbilityValue != null) {
            horse.setSpecialAbility(augment.specialAbility, augment.specialAbilityValue)
          }
        }

        // prepareForRace를 다시 호출하여 effStats 재계산
        horse.prepareForRace()
      }
    }
  }

  update() {
    if (!this.mapManager) return

    if (this.raceStarted) {
      const allFinished = this.updateSimulation()

      // 말이 출발했는지 확인하고 진행바 표시
      if (!this.progressBarShown) {
        const simHorses = this.horseManager.getSimHorses()
        const anyHorseStarted = simHorses.some((horse) => horse.position > 0)
        if (anyHorseStarted) {
          this.showProgressBar()
        }
      }

      // 극적인 피니시 연출 체크 (1등 말이 480m 이상)
      if (!this.dramaticFinishTriggered && !this.finished) {
        this.checkDramaticFinish()
      }

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

    // 현재 순위 계산 (추월 감지 및 위기 탈출 발동용)
    const currentRanking = [...simHorses]
      .filter((h) => !h.finished)
      .sort((a, b) => b.position - a.position)

    // 각 말의 순위 업데이트 (추월 감지)
    for (let i = 0; i < currentRanking.length; i++) {
      const horse = currentRanking[i]
      horse.updateRank(i + 1)
    }

    let allFinished = true
    for (const simHorse of simHorses) {
      if (!simHorse.finished) {
        simHorse.step(this.currentSimDt, this.simTime)
        allFinished = false
      }
    }
    this.simTime += this.currentSimDt
    return allFinished
  }

  /**
   * 극적인 피니시 연출 체크
   */
  private checkDramaticFinish() {
    const simHorses = this.horseManager.getSimHorses()

    // 1등 말 찾기
    const leadingHorse = simHorses.reduce((leader, horse) => {
      return horse.position > leader.position ? horse : leader
    })

    // 1등 말이 480m (종점 20m 전) 이상이면 극적인 연출 트리거
    if (leadingHorse.position >= 480 && leadingHorse.position < TRACK_REAL_M) {
      this.triggerDramaticFinish()
    }
  }

  /**
   * 극적인 피니시 연출 트리거
   */
  private triggerDramaticFinish() {
    this.dramaticFinishTriggered = true

    // 슬로우모션 시작 시점과 시작 전 시간 저장
    this.slowMotionStartTime = performance.now()
    this.timeBeforeSlowMotion = (this.slowMotionStartTime - this.raceStartTime) / 1000

    // 줌인 전 카메라 Y 위치 저장 (월드 좌표 기준)
    this.cameraYBeforeDramaticFinish = this.cameras.main.scrollY + this.cameras.main.height / 2

    // 1등 말 찾기
    const simHorses = this.horseManager.getSimHorses()
    const leadingHorse = simHorses.reduce((leader, horse) => {
      return horse.position > leader.position ? horse : leader
    })

    // 1등 말의 화면 좌표 계산
    const horseScreenX = this.calculateHorseScreenX(leadingHorse)
    const horseScreenY = this.mapManager.getFinishStripeCenterY() // 종점 깃발의 중심 Y 좌표

    // 슬로우모션 (시뮬레이션 속도를 30%로 감소)
    this.currentSimDt = SIM_DT * 0.3

    // 카메라를 1등 말 X 위치, 트랙 중앙 Y 위치로 이동 후 줌인
    this.cameras.main.pan(horseScreenX, horseScreenY, 800, 'Power2')
    this.cameras.main.zoomTo(2, 800, 'Power2')

    // 레이스가 종료되면 원래대로 복구
    this.time.delayedCall(3000, () => {
      // 슬로우모션 해제
      this.currentSimDt = SIM_DT

      // 카메라 원위치로 복구 (X는 화면 중앙, Y는 줌인 전 위치)
      const gameWidth = this.scale.width
      this.cameras.main.pan(gameWidth / 2, this.cameraYBeforeDramaticFinish, 600, 'Power2')
      this.cameras.main.zoomTo(1.0, 600, 'Power2')
    })
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
      // position이 시뮬레이션에서 자연스럽게 증가하므로
      // 단순히 position을 화면 좌표로 변환만 하면 됨
      const screenX = this.calculateHorseScreenX(simHorse)
      screenXArray.push(screenX)
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

    // HorseManager의 START_X_OFFSET(-40)과 동일하게 적용
    const START_X_OFFSET = -40

    // 화면 좌표 = 월드 좌표 + 오프셋 - raceDistance (트랙 스크롤)
    return horseWorldX + START_X_OFFSET - this.raceDistance
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
    // 실시간 시간 계산 (밀리초를 초로 변환)
    const realTime = (performance.now() - this.raceStartTime) / 1000

    // 슬로우모션 중에는 타이머도 느리게 흐르도록 계산
    let displayTime: number
    if (this.dramaticFinishTriggered) {
      // 슬로우모션 시작 전 시간 + 슬로우모션 중 시간 (비율 적용)
      const slowMotionElapsed = (performance.now() - this.slowMotionStartTime) / 1000
      const slowMotionRatio = this.currentSimDt / SIM_DT // 0.3 (30%)
      displayTime = this.timeBeforeSlowMotion + slowMotionElapsed * slowMotionRatio
    } else {
      displayTime = realTime
    }

    const horseData = simHorses.map((h) => ({
      name: h.name,
      position: h.position,
      finished: h.finished,
      finishTime: h.finishTime,
      currentTime: displayTime, // 슬로우모션 비율이 적용된 시간 전달
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
        overtakeBonusActive: playerHorse.overtakeBonusActive,
        overtakeBonusValue: playerHorse.overtakeBonusValue,
        overtakeCount: playerHorse.overtakeCount,
        lastStaminaRecovery: playerHorse.lastStaminaRecovery,
      })
    }
  }

  // 미니맵 진행 바 생성
  private createProgressBar(gameWidth: number, gameHeight: number) {
    const barHeight = 12
    const barY = gameHeight * 0.1
    const barWidth = (gameWidth - 150) / 2
    const barX = gameWidth / 2 // 화면 중앙

    // 컨테이너 생성 (fade in/out을 위해)
    this.progressBarContainer = this.add.container(0, 0).setDepth(25).setAlpha(0)
    // 진행 바 배경 (둥근 모서리)
    this.progressBarBg = this.add.graphics()
    this.progressBarBg.fillStyle(0x1a1a2e, 0.8)
    this.progressBarBg.fillRoundedRect(
      barX - barWidth / 2,
      barY - barHeight / 2,
      barWidth,
      barHeight,
      6,
    )
    this.progressBarBg.lineStyle(2, 0x6366f1, 0.5)
    this.progressBarBg.strokeRoundedRect(
      barX - barWidth / 2,
      barY - barHeight / 2,
      barWidth,
      barHeight,
      6,
    )
    this.progressBarContainer.add(this.progressBarBg)

    // 진행 바 채우기 (그라데이션 효과)
    this.progressBarFill = this.add.graphics()
    this.progressBarContainer.add(this.progressBarFill)

    // 도착 마커 (깃발만)
    const finishX = barX + barWidth / 2
    this.finishMarker = this.createFinishMarker(finishX, barY)
    this.progressBarContainer.add(this.finishMarker)

    // 현재 위치 인디케이터 (발광 효과)
    const startX = barX - barWidth / 2
    this.progressBarIndicator = this.createIndicator(startX, barY)
    this.progressBarContainer.add(this.progressBarIndicator)
  }

  /**
   * 진행바 표시 (말이 출발했을 때)
   */
  private showProgressBar() {
    if (this.progressBarShown || !this.progressBarContainer) return
    this.progressBarShown = true

    this.tweens.add({
      targets: this.progressBarContainer,
      alpha: 1,
      duration: 600,
      ease: 'Power2',
    })
  }

  /**
   * 도착 마커 생성 (깃발만)
   */
  private createFinishMarker(x: number, y: number) {
    const markerContainer = this.add.container(x, y)

    // 깃발 이모지
    const flag = this.add
      .text(0, 0, '🏁', {
        fontSize: '20px',
      })
      .setOrigin(0.5)
    markerContainer.add(flag)

    return markerContainer
  }

  /**
   * 인디케이터 생성 (플레이어 위치)
   */
  private createIndicator(x: number, y: number) {
    const indicatorContainer = this.add.container(x, y)

    // 발광 효과
    const glow = this.add.circle(0, 0, 12, 0xffd700, 0.3)
    indicatorContainer.add(glow)

    // 메인 인디케이터
    const indicator = this.add.graphics()
    indicator.fillStyle(0xffd700, 1)
    indicator.fillCircle(0, 0, 6)
    indicator.lineStyle(2, 0xffffff, 1)
    indicator.strokeCircle(0, 0, 6)
    indicatorContainer.add(indicator)

    // 펄스 애니메이션
    this.tweens.add({
      targets: glow,
      scale: 1.3,
      alpha: 0.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    return indicatorContainer
  }

  // 미니맵 진행 바 업데이트
  private updateProgressBar() {
    if (!this.progressBarIndicator || !this.progressBarFill) return

    const simHorses = this.horseManager.getSimHorses()
    const playerHorse = simHorses[this.playerHorseIndex]

    if (!playerHorse) return

    // 플레이어 말의 진행률 계산 (0 ~ 1)
    const progress = Math.min(1, Math.max(0, playerHorse.position / TRACK_REAL_M))

    // 진행 바 위치 계산 (가운데 정렬)
    const gameWidth = this.scale.width
    const barWidth = (gameWidth - 150) / 2 // createProgressBar와 동일하게
    const barX = gameWidth / 2
    const barHeight = 12
    const barY = this.gameAreaHeight * 0.1
    const startX = barX - barWidth / 2
    const indicatorX = startX + progress * barWidth

    // 진행 바 채우기 업데이트 (그라데이션)
    this.progressBarFill.clear()
    if (progress > 0) {
      const fillWidth = Math.min(progress * barWidth, barWidth - 4) // 배경을 넘지 않도록 제한
      // 그라데이션 색상 (진행도에 따라 변화)
      const fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x6366f1),
        Phaser.Display.Color.ValueToColor(0xffd700),
        100,
        progress * 100,
      )
      const colorValue = Phaser.Display.Color.GetColor(fillColor.r, fillColor.g, fillColor.b)

      this.progressBarFill.fillStyle(colorValue, 0.8)
      this.progressBarFill.fillRoundedRect(
        barX - barWidth / 2 + 2,
        barY - barHeight / 2 + 2,
        fillWidth,
        barHeight - 4,
        4,
      )
    }

    // 인디케이터 위치 업데이트
    this.progressBarIndicator.setX(indicatorX)
  }

  // 레이스 결과 표시
  private showRaceResult() {
    if (this.celebrationEffectShown) return
    this.celebrationEffectShown = true

    // 진행 바 fade out
    if (this.progressBarContainer) {
      this.tweens.add({
        targets: this.progressBarContainer,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
      })
    }

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
        // 증강 정보 추가 (저장된 증강 사용)
        const augments = this.horseAugments[result.index] || []

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
        playerCount: this.gameSettings.playerCount,
        currentSet: this.currentSet,
        totalSets: this.gameSettings.setCount,
        onClose: () => {
          // 닫기 버튼 클릭 시 처리 (필요시)
        },
        onNextSet: () => {
          // 다음 세트 시작
          this.startNewSet()
        },
      })
    })
  }

  /**
   * 다음 세트 시작
   */
  private startNewSet() {
    // 세트 카운트 증가
    this.currentSet++

    // 레이스 상태 초기화
    this.finished = false
    this.raceStarted = false
    this.countdownActive = false
    this.celebrationEffectShown = false
    this.dramaticFinishTriggered = false
    this.currentSimDt = SIM_DT
    this.simTime = 0
    this.raceStartTime = 0 // 레이스 시작 시각 초기화
    this.slowMotionStartTime = 0
    this.timeBeforeSlowMotion = 0
    this.shouldStartScrolling = false
    this.initialRaceDistance = 0
    this.initialMaxPosition = 0
    this.raceDistance = 0
    this.progressBarShown = false

    // 진행바 숨기기
    if (this.progressBarContainer) {
      this.progressBarContainer.setAlpha(0)
    }

    // 맵 위치 초기화
    this.mapManager.setTilePositionX(0)
    // 깃발 위치도 초기화 (raceDistance = 0 기준으로)
    this.mapManager.updateStripePositions(0)

    // 시뮬레이션 말들 초기화 (능력치와 증강은 유지)
    const simHorses = this.horseManager.getSimHorses()
    for (const simHorse of simHorses) {
      simHorse.position = 0
      simHorse.currentSpeed = 0
      simHorse.finished = false
      simHorse.finishTime = null
      simHorse.prepareForRace() // effStats 재계산
    }

    // 말 매니저 재생성 (시각적 위치 초기화)
    this.recreateHorseManager()

    // 플레이어 인디케이터 다시 표시
    this.horseManager.hidePlayerIndicator() // 일단 숨김 (레이스 시작 시 자동으로 숨겨짐)

    // HUD 업데이트
    this.hud.updateCurrentSet(this.currentSet)
    this.updateHUDInitial()

    // 증강 선택 (랜덤 등급)
    const randomRarity = generateRandomRarity()
    this.showAugmentSelection(randomRarity)
  }

  /**
   * Firebase 데이터 로드 (scene.data에서 읽기)
   */
  private loadFirebaseData() {
    this.roomId = this.data.get('roomId')
    this.playerId = this.data.get('playerId')
    this.room = this.data.get('room')
    this.players = this.data.get('players')
    this.userId = this.data.get('userId')
    this.selectedHorse = this.data.get('selectedHorse')

    // 데이터가 있으면 로그 출력 (디버깅용)
    if (this.roomId) {
      console.log('[RaceScene] Firebase data loaded:', {
        roomId: this.roomId,
        playerId: this.playerId,
        hasRoom: !!this.room,
        playersCount: this.players?.length || 0,
        userId: this.userId,
        roomStatus: this.room?.status,
        hasSelectedHorse: !!this.selectedHorse,
        selectedHorseName: this.selectedHorse?.name,
      })

      // 개발 모드에서 상세 정보 출력
      if (import.meta.env.DEV) {
        console.log('[RaceScene] Room details:', this.room)
        console.log('[RaceScene] Players:', this.players)
        if (this.selectedHorse) {
          console.log('[RaceScene] Selected Horse:', this.selectedHorse)
          console.log('[RaceScene] Horse Stats:', this.selectedHorse.stats)
        }
      }
    } else if (import.meta.env.DEV) {
      console.warn('[RaceScene] No roomId found in scene.data')
    }
  }

  /**
   * Firebase 데이터 업데이트 시 호출
   */
  private onFirebaseDataUpdated() {
    console.log('[RaceScene] Firebase data updated:', {
      roomId: this.roomId,
      playerId: this.playerId,
      hasRoom: !!this.room,
      playersCount: this.players?.length || 0,
      roomStatus: this.room?.status,
      hasSelectedHorse: !!this.selectedHorse,
      selectedHorseName: this.selectedHorse?.name,
    })

    // 개발 모드에서 상세 정보 출력
    if (import.meta.env.DEV) {
      console.log('[RaceScene] Updated room:', this.room)
      console.log('[RaceScene] Updated players:', this.players)
      if (this.selectedHorse) {
        console.log('[RaceScene] Updated Selected Horse:', this.selectedHorse)
        console.log('[RaceScene] Updated Horse Stats:', this.selectedHorse.stats)
      }
    }

    // 룸 데이터가 있으면 게임 설정 업데이트
    if (this.room) {
      // 세트 수 업데이트
      if (this.room.setCount) {
        this.gameSettings.setCount = this.room.setCount
      }

      // 플레이어 수 업데이트
      if (this.players && this.players.length > 0) {
        this.gameSettings.playerCount = this.players.length
      }

      // 현재 플레이어의 말 인덱스 찾기
      if (this.players && this.userId) {
        const currentPlayerIndex = this.players.findIndex(
          (p) => (p.isHost && this.room?.hostId === this.userId) || p.id === this.playerId,
        )
        if (currentPlayerIndex >= 0) {
          this.playerHorseIndex = currentPlayerIndex
          this.gameSettings.playerHorseIndex = currentPlayerIndex
        }
      }
    }
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
