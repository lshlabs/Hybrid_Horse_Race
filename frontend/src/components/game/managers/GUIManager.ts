// GUIManager.ts
import Phaser from 'phaser'
import i18next from 'i18next'
import type { Augment, AugmentStatType } from '../../../engine/race'

/** 능력치 테이블 셀 순서 (createAbilityTable / updateStats와 동일) */
const STAT_ORDER: AugmentStatType[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Luck']

/** 영어 서수 접미사만: 1 → st, 2 → nd, 3 → rd, 4+ → th, 11/12/13 → th ... */
function getOrdinalSuffix(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  if (mod10 === 1) return 'st'
  if (mod10 === 2) return 'nd'
  if (mod10 === 3) return 'rd'
  return 'th'
}

export default class GUIManager {
  // HUD 스타일 상수
  private static readonly STATS_BG_COLOR = 0x000000 // 불투명 배경
  private static readonly CARD_DEPTH = 31
  private static readonly TEXT_DEPTH = 32
  private static readonly PANEL_DEPTH = 40
  private static readonly PANEL_TEXT_DEPTH = 41
  // 우하단 HUD 카드 (능력치 ↔ 현재상태)
  private static readonly HUD_CARD_WIDTH = 280
  private static readonly HUD_CARD_HEIGHT = 112

  /** 좌상단 순위표: 반투명 회색 */
  private static readonly RANKING_PANEL_COLOR = '#9ca3af'
  private static readonly RANKING_PANEL_ALPHA = 0.85
  /** 순위표 배경: 바둑판 무늬 (진한/옅은 회색 반투명, border 없음) */
  private static readonly RANKING_BG_DARK = 0x374151
  private static readonly RANKING_BG_DARK_ALPHA = 0.5
  private static readonly RANKING_BG_LIGHT = 0x6b7280
  private static readonly RANKING_BG_LIGHT_ALPHA = 0.3

  // 우상단: 순위, 시간
  private static readonly TOP_RIGHT_OFFSET_X = 24
  private static readonly TOP_RIGHT_OFFSET_Y = 24

  // 좌상단 순위표 (2/6 + 숫자+이름 리스트)
  private static readonly RANKING_LEFT_MARGIN = 24
  private static readonly RANKING_TOP_OFFSET_Y = 24
  private static readonly RANKING_PANEL_WIDTH = 160
  private static readonly RANK_ROW_FONT = 24
  private static readonly RANK_ROW_GAP = 32

  private scene: Phaser.Scene
  private sceneHeight: number // 전체 화면 높이 (HUD 전용 영역 없음)
  private playerCount: number // 플레이어 수
  private abilityCellTexts: Phaser.GameObjects.Text[] = []
  private statsCellTexts: Phaser.GameObjects.Text[] = []
  private rankingRankText?: Phaser.GameObjects.Text // 큰 "2"
  private rankingOrdinalSuffixText?: Phaser.GameObjects.Text // 작은 서수 접미사(st/nd/rd/th)
  private rankingRowTexts: Phaser.GameObjects.Text[] = [] // "1 이름", "2 이름" ...
  private rankingPanelBg?: Phaser.GameObjects.Graphics
  private previousRankings: Map<string, number> = new Map()
  /** 순위 변경 강조 중인 말 이름 → 강조 종료 시각(ms, scene.time.now 기준). 이 시간 전에는 else에서 스타일 덮어쓰지 않음 */
  private rankingHighlightEndAt: Map<string, number> = new Map()

  // 우상단: 순위, 시간
  private timeText?: Phaser.GameObjects.Text

  /** 증강 선택 화면에서 카드 클릭 시 미리보기용 (해당 능력치 셀 강조) */
  private previewAugment: Augment | null = null

  // 중앙 하단 HUD 카드 (능력치 ↔ 현재상태, 슬라이드 전환)
  private hudCardContainer?: Phaser.GameObjects.Container
  private hudCardBg?: Phaser.GameObjects.Image
  private abilityFaceContainer?: Phaser.GameObjects.Container
  private statsFaceContainer?: Phaser.GameObjects.Container
  private hudCardHitArea?: Phaser.GameObjects.Rectangle
  private showingAbilityFace = true

  constructor(scene: Phaser.Scene, sceneHeight: number, playerCount: number = 8) {
    this.scene = scene
    this.sceneHeight = sceneHeight
    this.playerCount = playerCount
  }

  // --- HUD 생성: 좌상단 순위(createRankingPanel) | 우상단 시간/라운드 | 우하단 HUD 카드 ---
  createHUD() {
    const width = this.scene.scale.width

    this.createTopRightPanel(width)

    // 중앙 하단: 능력치/현재상태 HUD 카드 (가로 중앙, 아래에 배치)
    let cardW = GUIManager.HUD_CARD_WIDTH
    let cardH = GUIManager.HUD_CARD_HEIGHT
    if (this.scene.textures.exists(GUIManager.HUD_CARD_BG_KEY)) {
      const frame = this.scene.textures.get(GUIManager.HUD_CARD_BG_KEY).getSourceImage()
      if (frame) {
        cardW = frame.width * GUIManager.HUD_CARD_ASSET_SCALE
        cardH = frame.height * GUIManager.HUD_CARD_ASSET_SCALE
      }
    }
    const hudCardX = width / 2
    const hudCardY = this.sceneHeight - cardH / 2
    this.createHudCard(hudCardX, hudCardY, cardW, cardH)
  }

  /** 우상단: 현재 순위(1/8) → 시간 (위에서 아래, 라운드 표시 없음) */
  private createTopRightPanel(width: number) {
    const x = width - GUIManager.TOP_RIGHT_OFFSET_X
    const y = GUIManager.TOP_RIGHT_OFFSET_Y

    // 우상단 텍스트: 흰색 글자 + 검은색 테두리
    const strokeThickness = 6
    const textColor = '#ffffff'
    const strokeColor = '#000000'

    // 현재 순위: 숫자(큰 글씨) + st/nd/rd/th(작은 글씨), 1st 만 표시
    const rankNumX = x - 40
    this.rankingRankText = this.scene.add
      .text(rankNumX, y, '1', {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '64px',
        color: textColor,
        fontStyle: 'bold',
      })
      .setStroke(strokeColor, strokeThickness)
      .setOrigin(1, 0)
      .setDepth(GUIManager.PANEL_DEPTH)
      .setScrollFactor(0)

    // 접미사: 숫자 기준 우하단에 붙임 (origin 0,1 = 좌하단 기준)
    const rankNumHeight = 64
    this.rankingOrdinalSuffixText = this.scene.add
      .text(rankNumX, y + rankNumHeight, 'st', {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '28px',
        color: textColor,
      })
      .setStroke(strokeColor, strokeThickness)
      .setOrigin(0, 1)
      .setDepth(GUIManager.PANEL_DEPTH)
      .setScrollFactor(0)

    const timeY = y + 72
    // 고정폭(모노스페이스) 폰트로 숫자당 너비 동일 → 시간 갱신 시 좌우 흔들림 방지
    this.timeText = this.scene.add
      .text(x, timeY, '0:000', {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '32px',
        color: textColor,
      })
      .setStroke(strokeColor, strokeThickness)
      .setOrigin(1, 0)
      .setDepth(GUIManager.PANEL_DEPTH)
      .setScrollFactor(0)
  }

  /** 우상단 업데이트: 기록 시간(순위표 기록과 동일, 초 단위 소수점 3자리). 라운드 표시 없음. */
  updateTopRight(recordTimeSec: number) {
    if (this.timeText) {
      const sec = Math.floor(recordTimeSec)
      const ms = Math.floor((recordTimeSec - sec) * 1000) % 1000 // 000~999만 표시 (1000 방지)
      this.timeText.setText(`${sec}:${String(ms).padStart(3, '0')}`)
    }
  }

  /** 하단 HUD 카드 배경 텍스처 키 (RaceScene preload에서 로드) */
  private static readonly HUD_CARD_BG_KEY = 'hud_panel_bg'
  /** 하단 HUD 카드 배경 에셋에 적용하는 스케일 (한 번만) */
  private static readonly HUD_CARD_ASSET_SCALE = 0.7

  /** 하단 HUD 카드 중앙 반투명 패널 알파 (프레임 안의 카드) */
  private static readonly HUD_CARD_PANEL_ALPHA = 0.5
  /** 하단 HUD 카드가 프레임보다 살짝 작게 그려지도록 하는 안쪽 여백(px) */
  private static readonly HUD_CARD_INSET = 12

  /** 하단 HUD 카드: 프레임 에셋(race_hud) + 중앙 패널(능력치/현재상태) */
  private createHudCard(centerX: number, centerY: number, cardWidth: number, cardHeight: number) {
    const halfW = cardWidth / 2
    const halfH = cardHeight / 2

    this.hudCardContainer = this.scene.add.container(centerX, centerY)
    this.hudCardContainer.setDepth(GUIManager.CARD_DEPTH).setScrollFactor(0)

    // 하단 HUD 카드 내부 크기: 프레임보다 inset만큼 작게
    const inset = GUIManager.HUD_CARD_INSET
    const innerW = cardWidth - 2 * inset
    const innerH = cardHeight - 2 * inset
    const innerHalfW = innerW / 2
    const innerHalfH = innerH / 2

    // 1) 에셋 없을 때만 배경(검정) 먼저
    if (!this.scene.textures.exists(GUIManager.HUD_CARD_BG_KEY)) {
      const graphics = this.scene.add.graphics()
      graphics.fillStyle(GUIManager.STATS_BG_COLOR, 1)
      graphics.fillRect(-halfW, -halfH, cardWidth, cardHeight)
      this.hudCardContainer.add(graphics)
    }

    // 2) 중앙 반투명 패널(프레임보다 약간 작게): 앞면(능력치) / 뒷면(현재상태)
    // 표시 순서: 먼저 추가한 쪽이 아래 → 나가는 쪽이 위에 와야 슬라이드 시 자연스럽게 가려짐
    const panelBgBack = this.scene.add
      .graphics()
      .fillStyle(0x000000, GUIManager.HUD_CARD_PANEL_ALPHA)
      .fillRect(-innerHalfW, -innerHalfH, innerW, innerH)

    this.statsFaceContainer = this.scene.add.container(0, 0)
    this.statsFaceContainer.setVisible(false)
    this.statsFaceContainer.add(panelBgBack)
    this.createStatsTableInContainer(this.statsFaceContainer, innerW, innerH)
    this.hudCardContainer.add(this.statsFaceContainer)

    const panelBg = this.scene.add
      .graphics()
      .fillStyle(0x000000, GUIManager.HUD_CARD_PANEL_ALPHA)
      .fillRect(-innerHalfW, -innerHalfH, innerW, innerH)

    this.abilityFaceContainer = this.scene.add.container(0, 0)
    this.abilityFaceContainer.add(panelBg)
    this.createAbilityTableInContainer(this.abilityFaceContainer, innerW, innerH)
    this.hudCardContainer.add(this.abilityFaceContainer)

    // 3) 프레임은 컨테이너 밖·씬에 더 높은 depth로 추가 → 반투명 하단 HUD 카드 위에 확실히 그림
    if (this.scene.textures.exists(GUIManager.HUD_CARD_BG_KEY)) {
      this.hudCardBg = this.scene.add
        .image(centerX, centerY, GUIManager.HUD_CARD_BG_KEY)
        .setOrigin(0.5, 0.5)
        .setScale(GUIManager.HUD_CARD_ASSET_SCALE)
        .setDepth(GUIManager.CARD_DEPTH + 0.5)
        .setScrollFactor(0)
    }

    // 클릭 영역: 에셋과 동일 크기 (완전 투명 — 프레임을 가리지 않음)
    this.hudCardHitArea = this.scene.add
      .rectangle(centerX, centerY, cardWidth, cardHeight, 0x000000, 0)
      .setOrigin(0.5, 0.5)
      .setDepth(GUIManager.CARD_DEPTH + 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    this.hudCardHitArea.on('pointerdown', () => this.toggleHudCardFace())
  }

  /** 하단 HUD 카드 전환 (능력치 ↔ 현재상태) — 애니메이션 없이 즉시 전환 */
  private toggleHudCardFace() {
    if (!this.abilityFaceContainer || !this.statsFaceContainer) return

    this.showingAbilityFace = !this.showingAbilityFace
    this.abilityFaceContainer.setVisible(this.showingAbilityFace)
    this.abilityFaceContainer.setX(0)
    this.statsFaceContainer.setVisible(!this.showingAbilityFace)
    this.statsFaceContainer.setX(0)
  }

  /**
   * 하단 HUD 카드의 표시 면을 설정 (증강 선택 중 = 능력치, 레이스 중 = 속도/체력 등).
   * 클릭으로 토글하는 동작은 그대로 유지됨.
   */
  setHudCardFace(showAbility: boolean) {
    if (!this.abilityFaceContainer || !this.statsFaceContainer) return
    this.showingAbilityFace = showAbility
    this.abilityFaceContainer.setVisible(showAbility)
    this.abilityFaceContainer.setX(0)
    this.statsFaceContainer.setVisible(!showAbility)
    this.statsFaceContainer.setX(0)
  }

  /** 하단 HUD 카드 앞면: 능력치 표 (2열 3행), 컨테이너 내부 로컬 좌표 */
  private createAbilityTableInContainer(
    container: Phaser.GameObjects.Container,
    width: number,
    height: number,
  ) {
    const cols = 2
    const rows = 3
    const cellWidth = width / cols
    const cellHeight = height / rows
    const halfW = width / 2
    const halfH = height / 2
    const startX = -halfW
    const startY = -halfH

    const labels = [
      [i18next.t('game.speed'), i18next.t('game.stamina')],
      [i18next.t('game.power'), i18next.t('game.guts')],
      [i18next.t('game.start'), i18next.t('game.luck')],
    ]

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = startX + col * cellWidth + cellWidth / 2
        const cellY = startY + row * cellHeight + cellHeight / 2
        const text = this.scene.add
          .text(cellX, cellY, `${labels[row][col]} : 0`, {
            fontFamily: 'NeoDunggeunmo',
            fontSize: '13px',
            color: '#ffffff',
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(GUIManager.TEXT_DEPTH)
          .setScrollFactor(0)
        container.add(text)
        this.abilityCellTexts.push(text)
      }
    }
  }

  /** 하단 HUD 카드 뒷면: 현재상태 표 (1열 3행), 컨테이너 내부 로컬 좌표 */
  private createStatsTableInContainer(
    container: Phaser.GameObjects.Container,
    _width: number,
    height: number,
  ) {
    const rows = 3
    const cellHeight = height / rows
    const halfH = height / 2
    const startY = -halfH

    const labels = [
      i18next.t('game.speed'),
      i18next.t('game.health', { current: 0, max: 0 }),
      i18next.t('game.conditionBonus', { bonus: '0.0' }),
    ]

    for (let row = 0; row < rows; row++) {
      const cellX = 0
      const cellY = startY + row * cellHeight + cellHeight / 2
      const text = this.scene.add
        .text(cellX, cellY, `${labels[row]} : 0`, {
          fontFamily: 'NeoDunggeunmo',
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(GUIManager.TEXT_DEPTH)
        .setScrollFactor(0)
      container.add(text)
      this.statsCellTexts.push(text)
    }
  }

  // --- 좌상단 순위표 (숫자+이름 리스트 표시) ---
  createRankingPanel() {
    const panelX = GUIManager.RANKING_LEFT_MARGIN + GUIManager.RANKING_PANEL_WIDTH / 2
    const listStartY = GUIManager.RANKING_TOP_OFFSET_Y + 8
    const panelLeft = panelX - GUIManager.RANKING_PANEL_WIDTH / 2

    // 바둑판 무늬 반투명 배경 (홀수/짝수 행 다른 색, border 없음)
    this.rankingPanelBg?.destroy()
    this.rankingPanelBg = this.scene.add.graphics()
    for (let i = 0; i < this.playerCount; i++) {
      const isOdd = i % 2 === 0
      this.rankingPanelBg.fillStyle(
        isOdd ? GUIManager.RANKING_BG_DARK : GUIManager.RANKING_BG_LIGHT,
        isOdd ? GUIManager.RANKING_BG_DARK_ALPHA : GUIManager.RANKING_BG_LIGHT_ALPHA,
      )
      this.rankingPanelBg.fillRect(
        panelLeft,
        listStartY + i * GUIManager.RANK_ROW_GAP,
        GUIManager.RANKING_PANEL_WIDTH,
        GUIManager.RANK_ROW_GAP,
      )
    }
    this.rankingPanelBg.setDepth(GUIManager.PANEL_TEXT_DEPTH - 1).setScrollFactor(0)

    // 순위표 글씨: 반투명 회색
    this.rankingRowTexts = []
    for (let i = 0; i < this.playerCount; i++) {
      const text = this.scene.add
        .text(
          panelX - GUIManager.RANKING_PANEL_WIDTH / 2 + 12,
          listStartY + i * GUIManager.RANK_ROW_GAP,
          '',
          {
            fontFamily: 'NeoDunggeunmo',
            fontSize: `${GUIManager.RANK_ROW_FONT}px`,
            color: GUIManager.RANKING_PANEL_COLOR,
          },
        )
        .setStroke('#374151', 3)
        .setOrigin(0, 0)
        .setAlpha(GUIManager.RANKING_PANEL_ALPHA)
        .setDepth(GUIManager.PANEL_TEXT_DEPTH)
        .setScrollFactor(0)
      this.rankingRowTexts.push(text)
    }
  }

  /** 순위 업데이트. playerHorseIndex: 플레이어 말 인덱스(0 기준), 좌상단 순위표 갱신용 */
  updateRanking(
    horses: Array<{
      name: string
      position: number
      finished: boolean
      finishTime?: number | null
      currentTime?: number
    }>,
    playerHorseIndex?: number,
  ) {
    const sorted = [...horses].sort((a, b) => {
      if (a.finished && !b.finished) return -1
      if (!a.finished && b.finished) return 1
      if (a.finished && b.finished) {
        const aTime = a.finishTime ?? Infinity
        const bTime = b.finishTime ?? Infinity
        return aTime - bTime
      }
      return b.position - a.position
    })

    const playerHorse =
      playerHorseIndex != null && horses[playerHorseIndex] ? horses[playerHorseIndex] : null
    const playerName = playerHorse?.name ?? null
    const playerRank = playerName != null ? sorted.findIndex((h) => h.name === playerName) + 1 : 1

    if (this.rankingRankText) this.rankingRankText.setText(String(playerRank))
    if (this.rankingOrdinalSuffixText) {
      this.rankingOrdinalSuffixText.setText(getOrdinalSuffix(playerRank))
    }

    // 맨 처음 10m 구간에서는 순위 변경 효과 미적용
    const leadingDistanceM = Math.max(0, ...horses.map((h) => h.position))
    const allowRankChangeEffect = leadingDistanceM >= 5

    const maxCount = Math.min(this.rankingRowTexts.length, sorted.length)
    for (let i = 0; i < maxCount; i++) {
      const horse = sorted[i]
      const rank = i + 1
      const text = this.rankingRowTexts[i]
      if (!text) continue

      const isPlayer = horse.name === playerName
      const normalColor = GUIManager.RANKING_PANEL_COLOR
      const normalAlpha = GUIManager.RANKING_PANEL_ALPHA
      text.setText(`${rank}${getOrdinalSuffix(rank)} ${horse.name}`)

      const previousRank = this.previousRankings.get(horse.name)
      const rankChanged = previousRank !== undefined && previousRank !== rank

      if (rankChanged && allowRankChangeEffect) {
        const isRankUp = previousRank > rank
        const highlightColor = isRankUp ? '#00ff00' : '#ff0000'
        text.setStyle({
          color: highlightColor,
          fontStyle: isPlayer ? 'bold' : 'normal',
        })
        text.setAlpha(1)
        const highlightDurationMs = 1000
        const endAt = this.scene.time.now + highlightDurationMs
        this.rankingHighlightEndAt.set(horse.name, endAt)
        this.scene.time.delayedCall(highlightDurationMs, () => {
          this.rankingHighlightEndAt.delete(horse.name)
          text.setStyle({
            color: normalColor,
            fontStyle: isPlayer ? 'bold' : 'normal',
          })
          text.setAlpha(normalAlpha)
        })
        this.scene.tweens.add({
          targets: text,
          alpha: 0.6,
          duration: 300,
          yoyo: true,
          ease: 'Power1',
          onComplete: () => text.setAlpha(normalAlpha),
        })
      } else {
        const highlightEndAt = this.rankingHighlightEndAt.get(horse.name)
        const stillHighlighting = highlightEndAt != null && this.scene.time.now < highlightEndAt
        if (!stillHighlighting) {
          text.setStyle({
            color: normalColor,
            fontStyle: isPlayer ? 'bold' : 'normal',
          })
          text.setAlpha(normalAlpha)
        }
      }

      this.previousRankings.set(horse.name, rank)
    }
    for (let i = maxCount; i < this.rankingRowTexts.length; i++) {
      this.rankingRowTexts[i]?.setText('')
    }
  }

  /**
   * 능력치 수치에 따른 색상 반환
   * 낮음: (회색) 0~9.9, 보통: (초록색) 10~14.9, 좋음: (노란색) 15~19.9, 높음: (빨간색) 20~
   * @param value 능력치 수치
   * @returns 색상 코드 (hex string)
   */
  private getStatColor(value: number): string {
    if (value < 10) {
      return '#9ca3af' // 회색 (낮음: 0~9.9)
    } else if (value < 15) {
      return '#10b981' // 초록색 (보통: 10~14.9)
    } else if (value < 20) {
      return '#eab308' // 노란색 (좋음: 15~19.9)
    } else {
      return '#f87171' // 빨간색 (높음: 20~)
    }
  }

  /**
   * 체력 회복 표시 (일시적 애니메이션)
   * @param recoveryAmount 회복량
   */
  private showStaminaRecovery(recoveryAmount: number) {
    if (this.statsCellTexts.length < 2) return
    const staminaText = this.statsCellTexts[1]
    const mat = staminaText.getWorldTransformMatrix()
    const worldX = mat.tx
    const worldY = mat.ty

    const recoveryText = this.scene.add
      .text(worldX + 70, worldY, `+${recoveryAmount}`, {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '16px',
        color: '#00ff00',
        align: 'center',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(GUIManager.TEXT_DEPTH + 1)
      .setScrollFactor(0)

    this.scene.tweens.add({
      targets: recoveryText,
      y: worldY - 30,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => recoveryText.destroy(),
    })
  }

  /**
   * 증강 선택 씬 HUD 표시 모드
   * - 'hidden': 룰렛 중 — 전부 숨김(순위표, 우상단, 하단 HUD 카드)
   * - 'bottomOnly': 카드 등장 후 — 하단 HUD 카드만 표시
   * - 'full': 씬 종료 후 — 전부 표시
   * @param options.fadeIn true면 full 전환 시 alpha 0→1 페이드인 (슬로모 복귀 후 등)
   * @param options.fadeOut true면 hidden 전환 시 alpha 1→0 페이드아웃 후 숨김 (슬로모 시작 시 등)
   */
  setAugmentSelectionHUD(
    mode: 'full' | 'bottomOnly' | 'hidden',
    options?: { fadeIn?: boolean; fadeOut?: boolean },
  ) {
    const showTop = mode === 'full'
    const showBottom = mode === 'full' || mode === 'bottomOnly'
    type Visible = { setVisible(v: boolean): void; setAlpha(a: number): void }

    if (mode === 'hidden' && options?.fadeOut) {
      const targets = [
        this.rankingPanelBg,
        ...this.rankingRowTexts,
        this.rankingRankText,
        this.rankingOrdinalSuffixText,
        this.timeText,
        this.hudCardContainer,
        this.hudCardBg,
        this.hudCardHitArea,
      ].filter((o) => o != null) as Phaser.GameObjects.GameObject[]
      this.scene.tweens.add({
        targets,
        alpha: 0,
        duration: 280,
        ease: 'Power2.In',
        onComplete: () => {
          targets.forEach((o) => {
            ;(o as unknown as Visible).setVisible(false)
            ;(o as unknown as Visible).setAlpha(1)
          })
        },
      })
      return
    }

    if (mode === 'full' && options?.fadeIn) {
      const targets = [
        this.rankingPanelBg,
        ...this.rankingRowTexts,
        this.rankingRankText,
        this.rankingOrdinalSuffixText,
        this.timeText,
        this.hudCardContainer,
        this.hudCardBg,
        this.hudCardHitArea,
      ].filter((o) => o != null) as Phaser.GameObjects.GameObject[]
      targets.forEach((o) => {
        const v = o as unknown as Visible
        v.setVisible(true)
        v.setAlpha(0)
      })
      this.scene.tweens.add({
        targets,
        alpha: 1,
        duration: 320,
        ease: 'Power2.Out',
      })
      return
    }

    this.rankingPanelBg?.setVisible(showTop)
    this.rankingRowTexts.forEach((t) => t.setVisible(showTop))
    this.rankingRankText?.setVisible(showTop)
    this.rankingOrdinalSuffixText?.setVisible(showTop)
    this.timeText?.setVisible(showTop)

    this.hudCardContainer?.setVisible(showBottom)
    this.hudCardBg?.setVisible(showBottom)
    this.hudCardHitArea?.setVisible(showBottom)
  }

  /**
   * HUD 정리
   */
  destroy() {
    // 하단 HUD 카드: 컨테이너·프레임(씬 직접 추가)·히트 영역 각각 제거
    this.hudCardContainer?.destroy(true)
    this.hudCardContainer = undefined
    this.hudCardBg?.destroy()
    this.hudCardBg = undefined
    this.abilityFaceContainer = undefined
    this.statsFaceContainer = undefined
    this.hudCardHitArea?.destroy()
    this.hudCardHitArea = undefined
    this.abilityCellTexts = []
    this.statsCellTexts = []

    this.rankingRankText?.destroy()
    this.rankingRankText = undefined
    this.rankingOrdinalSuffixText?.destroy()
    this.rankingOrdinalSuffixText = undefined
    this.rankingPanelBg?.destroy()
    this.rankingPanelBg = undefined
    this.rankingRowTexts.forEach((t) => t.destroy())
    this.rankingRowTexts = []

    this.timeText?.destroy()
    this.timeText = undefined

    this.previousRankings.clear()
    this.rankingHighlightEndAt.clear()
  }

  // 능력치 텍스트 업데이트
  updateStats(horse: {
    currentSpeed: number // m/s
    maxSpeed_ms: number // m/s
    stamina: number
    maxStamina: number
    conditionRoll: number
    baseStats?: {
      Speed: number
      Stamina: number
      Power: number
      Guts: number
      Start: number
      Luck: number
    }
    effStats?: {
      Speed: number
      Stamina: number
      Power: number
      Guts: number
      Start: number
      Luck: number
    }
    overtakeBonusActive?: boolean
    overtakeBonusValue?: number
    overtakeCount?: number
    lastStaminaRecovery?: number
  }) {
    // m/s를 km/h로 변환
    const msToKmh = (ms: number) => (ms * 3600) / 1000
    const currentSpeedKmh = msToKmh(horse.currentSpeed)
    const maxSpeedKmh = msToKmh(horse.maxSpeed_ms)

    // 체력 계산
    const staminaPercent = Math.round((horse.stamina / horse.maxStamina) * 100)

    // 행운 보너스 계산
    const conditionBonus = horse.conditionRoll * 100 // -10% ~ +10%

    // 오른쪽 박스: 현재 상태 텍스트 업데이트 (1열 3행) - i18next 사용
    if (this.statsCellTexts.length >= 3) {
      // 속도 : X / Y km/h (+X%)
      let speedText = i18next.t('game.currentSpeed', {
        current: currentSpeedKmh.toFixed(1),
        max: maxSpeedKmh.toFixed(1),
      })
      if (
        horse.overtakeBonusActive &&
        horse.overtakeBonusValue &&
        horse.overtakeBonusValue > 0 &&
        horse.overtakeCount !== undefined &&
        horse.overtakeCount > 0
      ) {
        // 수치별 속도 증가율: 6→1%, 7→1.5%, 8→2%, 9→2.5%, 10→3%
        const speedBonusPerOvertake = (horse.overtakeBonusValue - 6) * 0.005 + 0.01
        const bonusPercent = (Math.pow(1.0 + speedBonusPerOvertake, horse.overtakeCount) - 1) * 100
        speedText += ` (+${bonusPercent.toFixed(1)}%)`
      }
      this.statsCellTexts[0].setText(speedText)

      // 체력 : X / 100 (i18next 사용)
      this.statsCellTexts[1].setText(
        i18next.t('game.health', { current: staminaPercent, max: 100 }),
      )

      // 체력 회복 표시 (일시적)
      if (horse.lastStaminaRecovery && horse.lastStaminaRecovery > 0) {
        this.showStaminaRecovery(horse.lastStaminaRecovery)
        // 다음 프레임에서 초기화되도록 함 (race-sim.ts에서 처리)
      }

      // 행운 보너스 : +2.3% 형식으로 표시
      const bonusSign = conditionBonus >= 0 ? '+' : ''
      this.statsCellTexts[2].setText(
        i18next.t('game.conditionBonus', { bonus: `${bonusSign}${conditionBonus.toFixed(1)}` }),
      )
    }

    // 왼쪽 박스: 능력치 텍스트 업데이트 (2열 3행) - i18next 사용
    if (this.abilityCellTexts.length >= 6 && horse.effStats) {
      const stats = horse.effStats
      // 순서: [속도, 지구력, 가속, 근성, 출발, 행운]
      const statValues = [
        Math.round(stats.Speed * 10) / 10,
        Math.round(stats.Stamina * 10) / 10,
        Math.round(stats.Power * 10) / 10,
        Math.round(stats.Guts * 10) / 10,
        Math.round(stats.Start * 10) / 10,
        Math.round(stats.Luck * 10) / 10,
      ]
      const statLabels = [
        i18next.t('game.speed'),
        i18next.t('game.stamina'),
        i18next.t('game.power'),
        i18next.t('game.guts'),
        i18next.t('game.start'),
        i18next.t('game.luck'),
      ]

      const highlightIndex =
        this.previewAugment?.statType != null
          ? STAT_ORDER.indexOf(this.previewAugment.statType)
          : -1
      const previewAdd =
        highlightIndex >= 0 && this.previewAugment?.statValue != null
          ? this.previewAugment.statValue
          : null

      for (let i = 0; i < 6; i++) {
        const value = statValues[i]
        const label = statLabels[i]
        const isHighlight = i === highlightIndex
        const addValue = isHighlight && previewAdd != null ? previewAdd : null
        const sumValue = addValue != null ? value + addValue : value
        const displayValue = addValue != null ? String(sumValue) : String(value)
        const color = this.getStatColor(sumValue) // 능력치 구간별 색상(회/초/노/빨), 강조 시에도 동일
        this.abilityCellTexts[i].setText(`${label} : ${displayValue}`)
        this.abilityCellTexts[i].setStyle({
          color,
          fontStyle: isHighlight ? 'bold' : 'normal',
          fontSize: isHighlight ? '16px' : '14px',
        })
      }
    }
  }

  /**
   * 증강 선택 화면에서 카드 클릭 시 미리보기 강조 설정.
   * 카드 클릭 시 호출하면 해당 증강의 능력치(statType) 셀에 강조가 적용됨.
   * null이면 강조 해제.
   */
  setAugmentPreview(augment: Augment | null) {
    this.previewAugment = augment
  }
}
