import Phaser from 'phaser'
import type { Room, Player } from '../../../../hooks/useRoom'

// 플레이어 표시 화살표
import rightArrowUrl from '../../../../assets/images/etc/right-arrow.png'
// 하단 HUD 카드 배경 (능력치/현재상태 카드)
import hudPanelBgUrl from '../../../../assets/images/etc/race_hud.png'

// 시뮬레이션 시스템
import type { Stats } from '../../../../engine/race/types'

// 관리자 클래스들
import TileMapManager from '../../managers/TileMapManager'
import HorseManager from '../../managers/HorseManager'
import GUIManager from '../../managers/GUIManager'
import ProgressBarManager from '../../managers/ProgressBarManager'
import CameraScrollManager from '../../managers/CameraScrollManager'
import CountdownManager from '../../managers/CountdownManager'
import { tileMapAssetLoaders } from '../../assets/tilemaps/tileMapAssets'
import { horseSpriteSheetUrls } from '../../assets/horses/horseSpritesheets'
import { applyPixelArtFilter } from '../../assets/filters/pixelArtFilter'
import { playFinishSequence } from '../../effects/FinishSequence'

// 증강 시스템
import type { Augment, AugmentRarity } from '../../../../engine/race'
import { generateRandomRarity } from '../../../../engine/race'
import { computeRoundRankings } from '../../../../utils/raceRanking'
import { createFireworks } from '../../../../utils/fireworks'
import type { RoundRankingEntry } from '../../../../utils/raceRanking'
import AugmentSelectionScene from '../augment/AugmentSelectionScene'
import RaceResultScene from '../result/RaceResultScene'
import RaceDataSync, { type RaceGameData } from './controllers/RaceDataSync'
import RaceRuntimeController, { type RaceRuntimeState } from './controllers/RaceRuntimeController'
import RaceFlowUI from './controllers/RaceFlowUI'

/** 물리 시뮬레이션 스텝(초, 고정) - 레이스 기록에 영향 없음. 변경 시 수치 적분 결과가 달라짐 */
const PHYSICS_DT_SEC = 0.02

export default class RaceScene extends Phaser.Scene {
  /** 씬 전환 사이 공통 대기 오버레이 노출 시간 */
  private static readonly WAITING_DURATION_MS = 3000

  // ─── 레이스 상태 ─────────────────────────────────────────────
  private isRaceFinished = false
  private isRaceStarted = false
  private isCountdownActive = false

  // 시뮬레이션 누적 시간(초). fixed-step을 돌리기 위해 프레임마다 누적한다.
  private simTimeAccumulatorSec = 0
  // 레이스 진행 속도 스케일(1 = 정상). 슬로모는 이 값만 조절한다.
  private simPlaybackScale = 1
  // 슬로모 적용/복귀 상태 플래그
  private simSlowmoActive = false
  // 슬로모 시작한 프레임에는 horse-crossed 무시 (같은 프레임에 바로 복귀 방지)
  private simSlowmoStartedThisFrame = false
  // 슬로모 복귀 트윈 길이(ms). 시뮬레이션 속도를 1로 되돌리는 데 사용.
  private simSlowmoRestoreMs = 300

  // ─── 레이스 종료 연출 ───────────────────────────────────────
  private isResultSceneShown = false
  private isFinishSequenceTriggered = false
  /** FINISH 배너·파티클 연출이 끝났는지. 결과 집계 오버레이는 이 후에 표시 */
  private finishSequenceDone = false
  // ─── 게임 영역 (전체 화면, HUD는 오버레이) ────────────────────
  private gameAreaHeight = 0

  private mapManager!: TileMapManager
  private horseManager!: HorseManager
  private hud!: GUIManager
  private progressBarManager!: ProgressBarManager
  private cameraScrollManager!: CameraScrollManager
  private countdownManager!: CountdownManager

  /** 증강 선택 시 레이스 씬에 그리는 반투명 오버레이 (뎁스는 하단 HUD 카드 아래) */
  private augmentDimOverlay?: Phaser.GameObjects.Rectangle

  // ─── 시뮬레이션 ──────────────────────────────────────────────
  // 시뮬레이션 경과 시간(초). 말의 step/finishTime 계산에 사용.
  private simElapsedSec = 0
  // 실제(벽시계) 시작 시각(ms). HUD 표시용 경과시간 계산에만 사용.
  private raceStartTimestampMs = 0

  // 플레이어 말 인덱스 (0 = 1번 말, 1 = 2번 말, ...)
  private playerHorseIndex = 0

  // 세트 관련
  private currentSet = 1 // 현재 세트 (1부터 시작)
  private roundResults: RoundRankingEntry[][] = []

  // 증강 관련
  private selectedAugments: Augment[] = []
  private remainingRerolls = 3 // 남은 리롤 횟수 (세트 간 공유, room.rerollLimit에서 읽음)
  private augmentSelectionActive = false

  // Firebase 데이터 저장
  private roomId?: string
  private playerId?: string
  private room?: Room
  private players?: Player[]

  // 개발 모드: 선택한 말 데이터
  private selectedHorse?: {
    name: string
    stats: Stats
    totalStats: number
    selectedAt: string
  }
  private dataSync!: RaceDataSync
  private runtimeController!: RaceRuntimeController
  private flowUI!: RaceFlowUI

  private readonly handleFinishSequenceSlowmo = (scale: number, restoreMs: number) => {
    this.simPlaybackScale = scale
    this.simSlowmoActive = true
    this.simSlowmoStartedThisFrame = true
    this.simSlowmoRestoreMs = restoreMs
    this.hud.setAugmentSelectionHUD('hidden', { fadeOut: true })
    this.progressBarManager.setVisibleWithFadeOut(280)
  }

  private readonly handleFinishSequenceSlowmoRestore = () => {
    this.hud.setAugmentSelectionHUD('full', { fadeIn: true })
    this.progressBarManager.setVisibleWithFadeIn(320)
  }

  constructor() {
    super('RaceScene')
    this.dataSync = new RaceDataSync({
      scene: this,
      onDataApplied: (data) => this.applyGameData(data),
      onDataUpdated: () => this.onGameDataUpdated(),
    })
    this.runtimeController = new RaceRuntimeController()
    this.flowUI = new RaceFlowUI()
  }

  /**
   * Scene 초기화 시 데이터 받기
   */
  init(data?: {
    roomId?: string
    playerId?: string
    room?: Room
    players?: Player[]
    selectedHorse?: {
      name: string
      stats: Stats
      totalStats: number
      selectedAt: string
    }
  }) {
    this.dataSync.applyInitData(data)
  }

  preload() {
    // 배경 (타일맵 에셋)
    tileMapAssetLoaders.forEach(({ key, url }) => this.load.image(key, url))

    // 말 1~8번 신규 에셋 (44x44): 대기 ready1/ready2/ready3(8프레임), 달리기 run
    const frame44 = { frameWidth: 44, frameHeight: 44 }
    horseSpriteSheetUrls.forEach((urls, i) => {
      const n = i + 1
      this.load.spritesheet(`horse${n}_ready1`, urls.ready1, frame44)
      this.load.spritesheet(`horse${n}_ready2`, urls.ready2, frame44)
      this.load.spritesheet(`horse${n}_ready3`, urls.ready3, frame44)
      this.load.spritesheet(`horse${n}_run`, urls.run, frame44)
    })

    // 플레이어 표시 화살표
    this.load.image('arrow', rightArrowUrl)
    // 하단 HUD 카드 배경
    this.load.image('hud_panel_bg', hudPanelBgUrl)
    // 카운트다운 연출 사운드
    this.load.audio('countdown', '/sounds/countdown.wav')
  }

  create() {
    // PhaserGame -> Scene data 채널로 들어온 최신 room/player 데이터를 먼저 동기화한다.
    this.dataSync.loadFromSceneData()
    this.dataSync.subscribe()
    this.setupGameArea()
    this.initializeFromGameData()
    this.createManagers()
    this.createHorsesAndHUD()
    this.setupAugmentSelection()
    this.events.on('finish-sequence-slowmo', this.handleFinishSequenceSlowmo)
    this.events.on('finish-sequence-slowmo-restore', this.handleFinishSequenceSlowmoRestore)
    // create() 재호출/씬 재진입 시 리스너 누적을 막기 위해 shutdown/destroy에서 정리한다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleSceneDestroy, this)
  }

  /** 게임 영역 = 전체 화면 (HUD는 하단 HUD 카드/아이콘만 오버레이) */
  private setupGameArea() {
    this.gameAreaHeight = this.scale.height
    applyPixelArtFilter(this)
  }

  /** 맵, 카메라 스크롤, 진행바 매니저 생성 */
  private createManagers() {
    const gameWidth = this.scale.width
    const gameHeight = this.gameAreaHeight

    this.mapManager = new TileMapManager({
      scene: this,
      gameWidth,
      gameHeight,
      preTiles: 3,
      raceTiles: 30,
      postTiles: 5,
    })

    this.cameraScrollManager = new CameraScrollManager({
      scene: this,
      mapManager: this.mapManager,
    })

    this.progressBarManager = new ProgressBarManager({
      scene: this,
      gameAreaHeight: this.gameAreaHeight,
      getTrackLengthM: () => this.mapManager.getTrackLengthM(),
      playerHorseIndex: this.playerHorseIndex,
    })
  }

  /** 말, HUD, 진행바 생성 및 초기 HUD 업데이트 */
  private createHorsesAndHUD() {
    const gameHeight = this.gameAreaHeight
    const playerCount = this.players?.length || 8
    const playersFromData = this.data.get('players') as Player[] | undefined
    const playerNames =
      playersFromData?.map((p, index) => p.name || `Horse_${index + 1}`) ||
      this.players?.map((p, index) => p.name || `Horse_${index + 1}`) ||
      undefined

    this.horseManager = new HorseManager({
      scene: this,
      gameHeight,
      getTrackStartWorldXPx: () => this.mapManager.getTrackStartWorldXPx(),
      getTrackLengthM: () => this.mapManager.getTrackLengthM(),
      getFinishLineOffsetM: () => this.mapManager.getFinishLineOffsetM(),
      playerHorseIndex: this.playerHorseIndex,
      arrowTextureKey: 'arrow',
      playerCount,
      playerNames,
    })

    if (this.selectedHorse && this.horseManager) {
      const simHorses = this.horseManager.getSimHorses()
      if (simHorses[this.playerHorseIndex]) {
        const playerHorse = simHorses[this.playerHorseIndex]
        playerHorse.baseStats = this.selectedHorse.stats
        // 행운 보너스는 증강 선택 직후(applyAugmentsToAllHorses 또는 onCancel→prepareAllHorsesForRace)에서만 적용
      }
    }

    this.hud = new GUIManager(this, this.scale.height, playerCount)
    this.hud.createHUD()
    this.hud.createRankingPanel()
    this.progressBarManager.create()
    this.updateHUDInitial()

    this.countdownManager = new CountdownManager({
      scene: this,
      centerX: this.scale.width / 2,
      centerY: this.gameAreaHeight / 2,
    })
  }

  /** 게임 시작 전 증강 선택 표시 */
  private setupAugmentSelection() {
    this.showAugmentSelection(generateRandomRarity())
  }

  private handleStart() {
    const wasStarted = this.isRaceStarted
    const nextState = this.runtimeController.startRace(this.getRuntimeState())
    this.applyRuntimeState(nextState)

    if (!this.isRaceStarted || wasStarted) return
    this.horseManager.hidePlayerIndicator()
    this.horseManager.startAllHorses()
  }

  /**
   * 게임 데이터로 게임 초기화
   * PhaserGame에서 전달받은 room/player 기준으로 플레이어 인덱스, 세트, 리롤 상태를 맞춘다.
   */
  private initializeFromGameData() {
    // 세트 수 설정
    this.currentSet = this.room?.currentSet || 1

    // 리롤 횟수 설정
    this.remainingRerolls = this.room?.rerollLimit || 3

    // 플레이어 말 인덱스 찾기 (playerId 기준)
    if (this.players && this.playerId) {
      const currentPlayerIndex = this.players.findIndex((p) => p.id === this.playerId)
      if (currentPlayerIndex >= 0) {
        this.playerHorseIndex = currentPlayerIndex
      }
    }
  }

  private startCountdown() {
    if (this.isCountdownActive) return
    this.isCountdownActive = true
    // 카운트다운 직전에 내 말 인디케이터(우상단 화살표) 표시 보장
    this.horseManager.showPlayerIndicator()
    if (this.cache.audio.exists('countdown')) {
      this.sound.play('countdown', { volume: 0.8 })
    }
    this.countdownManager.start(() => {
      this.isCountdownActive = false
      this.handleStart()
    })
  }

  /** 증강 선택 반투명 오버레이 뎁스 (하단 HUD 카드 CARD_DEPTH+0.5 보다 아래) */
  private static readonly AUGMENT_DIM_DEPTH = 30

  private showAugmentSelection(rarity: AugmentRarity) {
    this.augmentSelectionActive = true
    this.horseManager.hidePlayerIndicator()
    this.hud.setAugmentSelectionHUD('hidden')
    this.hud.setHudCardFace(true) // 증강 선택 중에는 하단 GUI 기본 = 능력치
    this.updateHUDInitial()

    const { width, height } = this.scale
    this.augmentDimOverlay?.destroy()
    this.augmentDimOverlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(RaceScene.AUGMENT_DIM_DEPTH)
      .setScrollFactor(0)
      .setInteractive()

    const scenePlugin = this.scene
    if (scenePlugin.isActive('AugmentSelectionScene')) {
      scenePlugin.stop('AugmentSelectionScene')
    }

    const totalRerollLimit = this.room?.rerollLimit ?? 3
    const sceneData = {
      rarity,
      maxRerolls: totalRerollLimit,
      remainingRerolls: this.remainingRerolls,
      showTapToStart: this.currentSet === 1,
      onSelect: (augment: Augment, usedRerolls: number) =>
        this.onAugmentSelected(augment, usedRerolls),
      onCancel: () => {
        this.removeAugmentDimOverlay()
        this.augmentSelectionActive = false
        this.hud.setAugmentSelectionHUD('full')
        this.hud.setHudCardFace(false) // 레이스로 돌아가면 하단 GUI 기본 = 속도/체력 등
        this.horseManager.prepareAllHorsesForRace(
          () => this.mapManager.getTrackLengthM(),
          () => this.mapManager.getFinishLineOffsetM(),
        )
        this.updateHUDInitial()
        this.horseManager.showPlayerIndicator()
        this.startCountdown()
      },
      onPreview: (augment: Augment | null) => {
        this.hud.setAugmentPreview(augment)
        this.updateHUDInitial()
      },
      onCardsShown: () => this.hud.setAugmentSelectionHUD('bottomOnly'),
    }

    if (!scenePlugin.get('AugmentSelectionScene')) {
      scenePlugin.add('AugmentSelectionScene', AugmentSelectionScene as typeof Phaser.Scene, false)
    }
    scenePlugin.launch('AugmentSelectionScene', sceneData)
  }

  private removeAugmentDimOverlay() {
    this.augmentDimOverlay?.destroy()
    this.augmentDimOverlay = undefined
  }

  private onAugmentSelected(augment: Augment, usedRerolls: number) {
    this.selectedAugments.push(augment)
    this.augmentSelectionActive = false
    this.remainingRerolls -= usedRerolls
    this.removeAugmentDimOverlay()
    this.hud.setAugmentSelectionHUD('full')

    const lastSelected = this.selectedAugments[this.selectedAugments.length - 1]
    if (lastSelected) {
      this.horseManager.assignAugmentsToAllHorses(
        augment.rarity,
        lastSelected,
        this.playerHorseIndex,
      )
    }
    this.horseManager.applyAugmentsToAllHorses(
      () => this.mapManager.getTrackLengthM(),
      () => this.mapManager.getFinishLineOffsetM(),
    )

    this.updateHUDInitial()

    // 증강 씬이 사라진 뒤(다음 프레임) 대기 연출 → 말 대기, 카운트다운 (연출과 연출 사이)
    // 주의: 여기서 show 하면 다음 틱에 hideGUIForWaitingOverlay가 인디케이터를 숨기므로 호출하지 않음.
    this.time.delayedCall(0, () => {
      // 다른 플레이어 기다리는 연출 시작 시 HUD 미리보기 해제 (대기 중에는 노란색 미리보기 비표시)
      this.hud.setAugmentPreview(null)
      this.flowUI.hideGUIForWaitingOverlay({
        hud: this.hud,
        progressBarManager: this.progressBarManager,
        horseManager: this.horseManager,
      })
      this.flowUI.showWaiting(this, {
        messageKey: 'game.waitingAfterAugment',
        onComplete: () => {
          this.hud.setHudCardFace(false) // 레이스 시작 시 하단 GUI 기본 = 속도/체력 등
          this.flowUI.showGUIAfterWaitingOverlay({
            hud: this.hud,
            horseManager: this.horseManager,
          })
          this.startCountdown()
        },
        durationMs: RaceScene.WAITING_DURATION_MS,
      })
    })
  }

  update(_time: number, delta: number) {
    if (!this.mapManager) return

    if (this.isRaceStarted) {
      const allFinished = this.updateSimulation(delta)

      // 말이 출발했는지 확인하고 진행바 표시
      const simHorses = this.horseManager.getSimHorses()
      const anyHorseStarted = simHorses.some((horse) => horse.position > 0)
      if (anyHorseStarted) {
        this.progressBarManager.show()
      }

      // 트랙 길이·결승 직전 N미터. 연출은 선두 말 기준으로 트리거(플레이어 기준이면 1등이 이미 결승해 슬로모가 바로 끝나는 문제 방지)
      const trackLengthM = this.mapManager.getTrackLengthM()
      const finishTriggerM = Math.max(0, trackLengthM - 15)
      const leadingHorse = simHorses.reduce((a, b) => (a.position >= b.position ? a : b))
      const leadingPosition = leadingHorse?.position ?? 0
      if (
        leadingPosition >= finishTriggerM &&
        !leadingHorse?.finished &&
        !this.isFinishSequenceTriggered
      ) {
        const leadingIndex = simHorses.indexOf(leadingHorse)
        this.triggerFinishSequence(leadingIndex >= 0 ? leadingIndex : this.playerHorseIndex)
      }

      // 슬로모 시작한 프레임이 아니고, 1등이 결승선 통과했을 때만 슬로모 복귀 시작
      if (leadingHorse?.finished && this.simSlowmoActive && !this.simSlowmoStartedThisFrame) {
        this.simSlowmoActive = false
        this.events.emit('finish-sequence-horse-crossed')
        this.tweens.add({
          targets: this,
          simPlaybackScale: 1,
          duration: this.simSlowmoRestoreMs,
          ease: 'Sine.Out',
          onComplete: () => {
            this.simPlaybackScale = 1
            this.events.emit('finish-sequence-slowmo-restore')
          },
        })
      }

      if (allFinished && !this.isRaceFinished) {
        this.isRaceFinished = true
        const showGatheringOverlay = () => {
          this.flowUI.hideGUIForWaitingOverlay({
            hud: this.hud,
            progressBarManager: this.progressBarManager,
            horseManager: this.horseManager,
          })
          this.flowUI.showWaiting(this, {
            messageKey: 'game.gatheringResults',
            onComplete: () => this.showRaceResult(),
            durationMs: RaceScene.WAITING_DURATION_MS,
          })
        }
        if (this.finishSequenceDone || !this.isFinishSequenceTriggered) {
          showGatheringOverlay()
        } else {
          this.events.once('finish-sequence-done', showGatheringOverlay)
        }
      }

      this.cameraScrollManager.update(simHorses, this.isRaceFinished)
      this.updateHorsePositions()
      this.updateHUD()
      this.mapManager.updateStripePositions(this.cameraScrollManager.getCameraScrollPx())
      this.progressBarManager.update(simHorses)

      this.simSlowmoStartedThisFrame = false
    }
  }

  private updateSimulation(deltaMs: number): boolean {
    const result = this.runtimeController.updateSimulation({
      simHorses: this.horseManager.getSimHorses(),
      state: {
        simTimeAccumulatorSec: this.simTimeAccumulatorSec,
        simElapsedSec: this.simElapsedSec,
      },
      deltaMs,
      physicsDtSec: PHYSICS_DT_SEC,
      simPlaybackScale: this.simPlaybackScale,
    })

    this.simTimeAccumulatorSec = result.simTimeAccumulatorSec
    this.simElapsedSec = result.simElapsedSec
    return result.allFinished
  }

  // 말 위치 업데이트
  private updateHorsePositions() {
    const simHorses = this.horseManager.getSimHorses()
    const worldXArray: number[] = []

    for (const simHorse of simHorses) {
      const worldX = this.cameraScrollManager.getHorseWorldX(simHorse, this.simElapsedSec)
      worldXArray.push(worldX)
    }

    this.horseManager.updateHorsePositions(worldXArray)
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
    this.hud.updateRanking(horseData, this.playerHorseIndex)
    this.hud.updateTopRight(0)

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
    const displayTime = (performance.now() - this.raceStartTimestampMs) / 1000

    const horseData = simHorses.map((h) => ({
      name: h.name,
      position: h.position,
      finished: h.finished,
      finishTime: h.finishTime,
      currentTime: displayTime,
    }))
    this.hud.updateRanking(horseData, this.playerHorseIndex)

    // 우상단: 순위표 '기록'과 동일한 시간 (완주 시 finishTime, 미완주 시 currentTime)
    const playerHorseForTime = simHorses[this.playerHorseIndex]
    const recordTime =
      playerHorseForTime?.finished && playerHorseForTime.finishTime != null
        ? playerHorseForTime.finishTime
        : displayTime
    this.hud.updateTopRight(recordTime)

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

  private triggerFinishSequence(leadingHorseIndex?: number) {
    if (this.isFinishSequenceTriggered) return
    this.isFinishSequenceTriggered = true

    const targetIndex = leadingHorseIndex ?? this.playerHorseIndex
    const target = this.horseManager?.getHorseSprite(targetIndex)
    playFinishSequence(this, target, {
      onComplete: () => {
        this.finishSequenceDone = true
        this.events.emit('finish-sequence-done')
      },
    })
  }

  private showRaceResult() {
    if (this.isResultSceneShown) return
    this.isResultSceneShown = true

    this.progressBarManager.hide()
    createFireworks(this)

    const simHorses = this.horseManager.getSimHorses()
    const playersFromData = this.data.get('players') as Player[] | undefined
    const playersToUse = this.players ?? playersFromData

    const rankings = computeRoundRankings(
      simHorses.map((h) => ({
        position: h.position,
        finished: h.finished,
        finishTime: h.finishTime ?? null,
        name: h.name,
      })),
      {
        horseAugmentsByIndex: (i) => this.horseManager.getAccumulatedAugments()[i] ?? [],
        playerNameByIndex: (i) => playersToUse?.[i]?.name ?? '',
        currentTime: this.simElapsedSec,
      },
    )

    this.roundResults.push(rankings)

    const scenePlugin = this.scene
    // 결과창을 즉시 띄워, 집계 오버레이가 제거되기 전에 어두운 결과 배경이 보이도록 한다.
    // 1초 지연 시 그 사이에 맵이 비쳐 부자연스러운 연출이 됨.
    if (!scenePlugin.get('RaceResultScene')) {
      scenePlugin.add('RaceResultScene', RaceResultScene as typeof Phaser.Scene, false)
    }

    const playerCount = this.players?.length ?? 8
    const roundCount = this.room?.roundCount ?? 3
    const isLastRound = this.currentSet >= roundCount

    scenePlugin.launch('RaceResultScene', {
      rankings,
      playerHorseIndex: this.playerHorseIndex,
      playerCount,
      currentSet: this.currentSet,
      totalRounds: roundCount,
      onNextSet: () => this.startNewSet(),
      onFinalResult: isLastRound ? () => this.handleFinalResult() : undefined,
    })
  }

  private handleFinalResult() {
    if (this.roundResults.length === 0) return

    const playerCount = this.players?.length ?? 4
    if (typeof window !== 'undefined') {
      const playersFromData = this.data.get('players') as Player[] | undefined
      const playersToUse = this.players ?? playersFromData
      const currentPlayerName = playersToUse?.find((p) => p.id === this.playerId)?.name

      window.dispatchEvent(
        new CustomEvent('race-final-result', {
          detail: {
            roundResults: this.roundResults,
            playerCount,
            roomId: this.roomId,
            playerId: this.playerId,
            playerName: currentPlayerName,
          },
        }),
      )
    }
    this.scene.stop('RaceResultScene')
  }

  private startNewSet() {
    const nextState = this.runtimeController.resetForNextSet({
      state: this.getRuntimeState(),
      horseManager: this.horseManager,
      cameraScrollManager: this.cameraScrollManager,
      progressBarManager: this.progressBarManager,
      mapManager: this.mapManager,
    })
    this.applyRuntimeState(nextState)
    this.updateHUDInitial()
    this.showAugmentSelection(generateRandomRarity())
  }

  /**
   * 게임 데이터 업데이트 시 호출
   * PhaserGame에서 데이터가 변경되어 이벤트가 발생했을 때 호출됨
   */
  private onGameDataUpdated() {
    if (import.meta.env.DEV) {
      console.log('[RaceScene] Game data updated (from PhaserGame):', {
        roomId: this.roomId,
        playerId: this.playerId,
        hasRoom: !!this.room,
        playersCount: this.players?.length || 0,
        roomStatus: this.room?.status,
        hasSelectedHorse: !!this.selectedHorse,
        selectedHorseName: this.selectedHorse?.name,
      })
    }

    // 디버깅에 필요한 상세 payload는 DEV에서만 노출
    if (import.meta.env.DEV) {
      console.log('[RaceScene] Updated room:', this.room)
      console.log('[RaceScene] Updated players:', this.players)
      if (this.selectedHorse) {
        console.log('[RaceScene] Updated Selected Horse:', this.selectedHorse)
        console.log('[RaceScene] Updated Horse Stats:', this.selectedHorse.stats)
      }
    }

    // HorseManager가 이미 생성된 경우, 표시 이름을 room의 플레이어 이름으로 동기화한다.
    if (this.horseManager) {
      // 우선순위: 1) this.players, 2) this.data.get('players')
      const playersFromData = this.data.get('players') as Player[] | undefined
      const playersToUse = this.players || playersFromData

      if (playersToUse && playersToUse.length > 0) {
        const simHorses = this.horseManager.getSimHorses()
        const playerNames = playersToUse.map((p, index) => p.name || `Horse_${index + 1}`)

        simHorses.forEach((horse, index) => {
          if (playerNames[index]) {
            horse.name = playerNames[index]
          }
        })
      }
    }

    // room 업데이트가 오면 세트/리롤/플레이어 인덱스를 런타임 상태에 반영한다.
    if (this.room) {
      // roundCount는 필요한 지점에서 this.room?.roundCount로 직접 사용한다.
      if (this.room.rerollLimit !== undefined) {
        this.remainingRerolls = this.room.rerollLimit
      }

      // 현재 세트 업데이트
      if (this.room.currentSet) {
        this.currentSet = this.room.currentSet
      }

      // 현재 플레이어의 말 인덱스 찾기 (playerId 기준)
      if (this.players && this.playerId) {
        const currentPlayerIndex = this.players.findIndex((p) => p.id === this.playerId)
        if (currentPlayerIndex >= 0) {
          this.playerHorseIndex = currentPlayerIndex
          this.progressBarManager?.setPlayerHorseIndex(this.playerHorseIndex)
        }
      }
    }
  }

  private handleSceneShutdown() {
    // RaceScene 재시작 시 중복 구독/오브젝트 잔존을 막기 위한 정리 루틴.
    this.dataSync.unsubscribe()
    this.events.off('finish-sequence-slowmo', this.handleFinishSequenceSlowmo)
    this.events.off('finish-sequence-slowmo-restore', this.handleFinishSequenceSlowmoRestore)
    this.augmentDimOverlay?.destroy()
    this.augmentDimOverlay = undefined
    this.hud?.destroy()
    this.horseManager?.destroy()
  }

  private handleSceneDestroy() {
    // destroy 경로도 같은 정리 루틴을 사용한다.
    this.handleSceneShutdown()
  }

  private applyGameData(data: RaceGameData) {
    this.roomId = data.roomId
    this.playerId = data.playerId
    this.room = data.room
    this.players = data.players
    this.selectedHorse = data.selectedHorse
  }

  private getRuntimeState(): RaceRuntimeState {
    return {
      isRaceStarted: this.isRaceStarted,
      isCountdownActive: this.isCountdownActive,
      augmentSelectionActive: this.augmentSelectionActive,
      isRaceFinished: this.isRaceFinished,
      isResultSceneShown: this.isResultSceneShown,
      isFinishSequenceTriggered: this.isFinishSequenceTriggered,
      finishSequenceDone: this.finishSequenceDone,
      simTimeAccumulatorSec: this.simTimeAccumulatorSec,
      simElapsedSec: this.simElapsedSec,
      raceStartTimestampMs: this.raceStartTimestampMs,
      currentSet: this.currentSet,
    }
  }

  private applyRuntimeState(state: RaceRuntimeState) {
    this.isRaceStarted = state.isRaceStarted
    this.isCountdownActive = state.isCountdownActive
    this.augmentSelectionActive = state.augmentSelectionActive
    this.isRaceFinished = state.isRaceFinished
    this.isResultSceneShown = state.isResultSceneShown
    this.isFinishSequenceTriggered = state.isFinishSequenceTriggered
    this.finishSequenceDone = state.finishSequenceDone
    this.simTimeAccumulatorSec = state.simTimeAccumulatorSec
    this.simElapsedSec = state.simElapsedSec
    this.raceStartTimestampMs = state.raceStartTimestampMs
    this.currentSet = state.currentSet
  }
}
