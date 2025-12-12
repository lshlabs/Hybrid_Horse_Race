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

// 시뮬레이션 시간 단위 (초) - 레이스 시간 조정을 위해 느리게 설정
const SIM_DT = 0.02 // 0.05에서 0.02로 변경하여 시뮬레이션 속도 감소 (레이스 시간 증가)

export default class RaceScene extends Phaser.Scene {
  // 트랙 관련
  private readonly segmentCount = 5
  private raceDistance = 0
  private finished = false
  private startXOnScreen = 0 // 시작선 화면 X 좌표
  private finishXOnScreen = 0 // 결승선 화면 X 좌표 (시뮬레이션 500m 위치)

  // 레이스 상태
  private raceStarted = false

  // UI
  private startButton?: Phaser.GameObjects.Text

  // 게임 영역 / HUD 높이
  private readonly HUD_HEIGHT = 160
  private gameAreaHeight = 0

  // 모듈화된 관리자들
  private mapManager!: MapManager
  private horseManager!: HorseManager
  private hud!: RaceHUD

  // 시뮬레이션 관련
  private simTime: number = 0
  private readonly TRACK_REAL_M = TRACK_REAL_M // 500m

  // 플레이어 말 인덱스 (0 = 1번 말, 1 = 2번 말, ...)
  private readonly playerHorseIndex = 0

  constructor() {
    super('RaceScene')
  }

  preload() {
    // 배경
    this.load.image('map2', mapImageUrl)

    // 말 스프라이트 시트: 64x64 그리드
    this.load.spritesheet('horse1', horse1Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse2', horse2Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse3', horse3Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse4', horse4Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse5', horse5Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse6', horse6Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse7', horse7Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse8', horse8Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

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
    this.mapManager = new MapManager({
      scene: this,
      segmentCount: this.segmentCount,
      gameWidth,
      gameHeight,
      mapTextureKey: 'map2',
      fenceTextureKey: 'fenceBottom',
      // margin은 MapManager 내부에서 totalMapWidth 기준으로 계산됨
    })

    // finishXOnScreen: 출발점 ~ 도착점 사이의 화면상 거리 (시뮬레이션 500m에 해당)
    this.finishXOnScreen = this.mapManager.getFinishXOnScreen()

    // startXOnScreen: 출발점의 월드 X 좌표 (raceDistance=0일 때 화면상 위치)
    this.startXOnScreen = this.mapManager.getStartWorldX()

    // ===== 말 생성 =====
    this.horseManager = new HorseManager({
      scene: this,
      gameHeight,
      startXOnScreen: this.startXOnScreen,
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
  }

  private handleStart() {
    if (this.raceStarted) return

    this.raceStarted = true
    this.simTime = 0 // 시뮬레이션 시간 초기화
    this.startButton?.setVisible(false)

    // 플레이어 표시 숨기기 (레이스 시작 시)
    this.horseManager.hidePlayerIndicator()

    // 모든 말에 대해 달리기 시작
    this.horseManager.startAllHorses()
  }

  update() {
    if (!this.mapManager) return

    if (this.raceStarted) {
      const allFinished = this.updateSimulation()
      this.updateTrackScroll()
      this.updateHorsePositions()
      this.updateHUD()
      if (allFinished && !this.finished) {
        this.finished = true
      }
    }

    this.mapManager.updateStripePositions(this.raceDistance)
  }

  // 시뮬레이션 업데이트
  private updateSimulation(): boolean {
    const simHorses = this.horseManager.getSimHorses()
    let allFinished = true
    for (const simHorse of simHorses) {
      if (!simHorse.finished) {
        simHorse.step(SIM_DT, this.simTime)
      }
      if (!simHorse.finished) {
        allFinished = false
      }
    }
    this.simTime += SIM_DT
    return allFinished
  }

  // 트랙 스크롤 업데이트
  private updateTrackScroll() {
    const simHorses = this.horseManager.getSimHorses()
    const maxPosition = Math.max(...simHorses.map((h) => h.position))
    const maxProgress = maxPosition / this.TRACK_REAL_M
    this.raceDistance = Math.min(maxProgress * this.finishXOnScreen, this.finishXOnScreen)

    this.mapManager.updateScroll(this.raceDistance)
  }

  // 말 위치 업데이트
  private updateHorsePositions() {
    const simHorses = this.horseManager.getSimHorses()
    const screenXArray: number[] = []

    for (const simHorse of simHorses) {
      if (this.simTime < simHorse.raceStartTime) {
        // 출발 전: 출발점에 고정 (트랙 스크롤 고려)
        const startWorldX = this.mapManager.getStartWorldX()
        screenXArray.push(startWorldX - this.raceDistance)
      } else {
        const screenX = this.calculateHorseScreenX(simHorse)
        screenXArray.push(screenX)
      }
    }

    this.horseManager.updateHorsePositions(screenXArray)
  }

  // 말의 화면 X 좌표 계산
  private calculateHorseScreenX(simHorse: Horse): number {
    let progress = simHorse.position / this.TRACK_REAL_M

    if (simHorse.finished && progress >= 1.0) {
      const timeSinceFinish = this.simTime - (simHorse.finishTime || this.simTime)
      const additionalProgress = (timeSinceFinish * 15) / this.TRACK_REAL_M
      progress = 1.0 + additionalProgress
    }

    // 시뮬레이션 거리를 화면 거리로 변환
    const horseScreenDistance = progress * this.finishXOnScreen

    // 출발점의 월드 좌표
    const startWorldX = this.mapManager.getStartWorldX()

    // 말의 월드 좌표 = 출발점 + 화면상 거리
    const horseWorldX = startWorldX + horseScreenDistance

    // 화면 좌표 = 월드 좌표 - raceDistance (트랙 스크롤)
    return horseWorldX - this.raceDistance
  }

  // HUD 업데이트
  private updateHUD() {
    const simHorses = this.horseManager.getSimHorses()
    const horseData = simHorses.map((h) => ({
      name: h.name,
      position: h.position,
      finished: h.finished,
    }))
    this.hud.updateRanking(horseData)
  }
}
