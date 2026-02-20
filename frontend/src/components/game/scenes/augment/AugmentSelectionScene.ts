import Phaser from 'phaser'
import i18next from 'i18next'
import type { Augment, AugmentRarity, AugmentStatType } from '../../../../engine/race'
import { generateAugmentChoices } from '../../../../engine/race'
import accelerationUrl from '../../../../assets/images/augments/power.png'
import luckUrl from '../../../../assets/images/augments/luck.png'
import gutsUrl from '../../../../assets/images/augments/guts.png'
import maxSpeedUrl from '../../../../assets/images/augments/speed.png'
import staminaUrl from '../../../../assets/images/augments/stamina.png'
import startUrl from '../../../../assets/images/augments/start.png'
import lastSpurtUrl from '../../../../assets/images/augments/last_spurt.png'
import overtakeUrl from '../../../../assets/images/augments/overtake.png'
import magneticUrl from '../../../../assets/images/augments/magnet.png'
import cardCommonUrl from '../../../../assets/images/augments/card/common.png'
import cardRareUrl from '../../../../assets/images/augments/card/rare.png'
import cardEpicUrl from '../../../../assets/images/augments/card/epic.png'
import cardLegendaryUrl from '../../../../assets/images/augments/card/legendary.png'
import cardHiddenUrl from '../../../../assets/images/augments/card/hidden.png'
import { createRoundedButton, type RoundedButtonController } from '../../ui/createRoundedButton'
import RouletteAnimator from './modules/RouletteAnimator'
import { createAugmentCardContent } from './modules/augmentCardRenderer'

/**
 * 증강 선택 Scene
 * 슬롯머신 연출 후 3개의 증강 카드 중 하나를 선택하는 UI를 제공
 */
export default class AugmentSelectionScene extends Phaser.Scene {
  // 스타일 상수
  private static readonly RARITY_COLORS: Record<AugmentRarity, number> = {
    common: 0x9e9e9e, // 회색
    rare: 0x2196f3, // 파란색
    epic: 0x9c27b0, // 보라색
    legendary: 0xffd700, // 금색
    hidden: 0xff9800, // 주황색
  }

  private static readonly STAT_ICON_MAP: Record<AugmentStatType, string> = {
    Speed: 'stat_max_speed',
    Stamina: 'stat_stamina',
    Power: 'stat_acceleration',
    Guts: 'stat_guts',
    Start: 'stat_start',
    Luck: 'stat_luck',
  }

  /** 등급별 카드 배경 텍스처 키 */
  private static readonly CARD_BG_KEYS: Record<AugmentRarity, string> = {
    common: 'card_common',
    rare: 'card_rare',
    epic: 'card_epic',
    legendary: 'card_legendary',
    hidden: 'card_hidden',
  }

  /** 증강 아이콘·카드 배경 텍스처 키 (LINEAR 유지 → 스무스 렌더링) */
  private static readonly AUGMENT_ICON_KEYS = [
    ...Object.values(AugmentSelectionScene.STAT_ICON_MAP),
    'special_last_spurt',
    'special_overtake',
    'special_escape_crisis',
    ...Object.values(AugmentSelectionScene.CARD_BG_KEYS),
  ] as const

  // 레이아웃 상수
  private static readonly CARD_WIDTH = 240
  private static readonly CARD_HEIGHT = 360
  private static readonly CARD_GAP = 24
  private static readonly ICON_SIZE = 100
  /** 증강 아이콘 Y 오프셋(px). 카드 상단 기준으로 아이콘을 아래(+) / 위(-)로 이동 */
  private static readonly ICON_Y_OFFSET = 50
  /** 증강 이름 Y 오프셋(px). 기본 30 기준 위(-) / 아래(+) 이동 */
  private static readonly TEXT_NAME_Y_OFFSET = 30
  /** 증강 설명 Y 오프셋(px). 카드 하단 기준 위(-) / 아래(+) 이동 */
  private static readonly TEXT_DESC_Y_OFFSET = -50
  private static readonly BUTTON_WIDTH = 140
  private static readonly BUTTON_HEIGHT = 50
  private static readonly BUTTON_RADIUS = 12
  /** UI 컨테이너 Y 오프셋 (레이아웃용, HUD 전용 영역 없음) */
  private static readonly UI_OFFSET_Y = 0
  /** 증강 UI 위쪽 오프셋(px). 값을 줄이면 카드가 화면 중앙에 가깝게 내려옴 */
  private static readonly AUGMENT_UI_UP_OFFSET = 40

  // 상태 필드
  private rarity: AugmentRarity = 'common'
  private maxRerolls: number = 3 // 전체 리롤 한도
  private remainingRerolls: number = 3 // 세트 간 공유되는 남은 리롤 횟수
  private rerollCount: number = 0 // 현재 세트에서 사용한 리롤 횟수
  private onSelectCallback?: (augment: Augment, usedRerolls: number) => void
  private onCancelCallback?: () => void
  /** 증강 카드 클릭 시 미리보기용 (HUD 능력치 강조). 선택 버튼이 아닌 카드 클릭이 트리거. */
  private onPreviewCallback?: (augment: Augment | null) => void
  /** 증강 카드 등장 시 호출 (하단 HUD 표시용) */
  private onCardsShownCallback?: () => void

  private augmentChoices: Augment[] = []
  private selectedAugment: Augment | null = null
  private selectedCardIndex: number = -1

  // UI 요소
  private uiContainer?: Phaser.GameObjects.Container
  private cardContainers: Phaser.GameObjects.Container[] = []
  private cardVisuals: Phaser.GameObjects.Container[] = []
  private rerollButton?: RoundedButtonController
  private confirmButton?: RoundedButtonController
  private rouletteAnimator?: RouletteAnimator
  /** 슬롯머신 연출 중 우상단 스킵 버튼 (등급확정 연출로 즉시 이동) */
  private skipRouletteButton?: RoundedButtonController
  /** 브라우저 자동재생 정책 대응: 첫 클릭 후 슬롯머신 시작용 오버레이 */
  private startOverlay?: Phaser.GameObjects.Container
  /** 첫 라운드 룰렛 이전에만 true → "클릭하여 게임 시작" 오버레이 표시 */
  private showTapToStart = false

  constructor() {
    super('AugmentSelectionScene')
    // 게임 시작 시점의 언어를 사용 (게임 중 언어 변경은 적용하지 않음)
  }
  preload() {
    this.load.image('stat_acceleration', accelerationUrl)
    this.load.image('stat_luck', luckUrl)
    this.load.image('stat_guts', gutsUrl)
    this.load.image('stat_max_speed', maxSpeedUrl)
    this.load.image('stat_stamina', staminaUrl)
    this.load.image('stat_start', startUrl)
    this.load.image('special_last_spurt', lastSpurtUrl)
    this.load.image('special_overtake', overtakeUrl)
    this.load.image('special_escape_crisis', magneticUrl)
    this.load.image('card_common', cardCommonUrl)
    this.load.image('card_rare', cardRareUrl)
    this.load.image('card_epic', cardEpicUrl)
    this.load.image('card_legendary', cardLegendaryUrl)
    this.load.image('card_hidden', cardHiddenUrl)
    this.load.audio('roulette_confirm', '/sounds/roulette_confirm.wav')
  }

  init(data?: {
    rarity?: AugmentRarity
    maxRerolls?: number
    remainingRerolls?: number
    /** 첫 라운드 룰렛 이전에만 true. true일 때만 "클릭하여 게임 시작" 오버레이 표시 */
    showTapToStart?: boolean
    onSelect?: (augment: Augment, usedRerolls: number) => void
    onCancel?: () => void
    onPreview?: (augment: Augment | null) => void
    /** 증강 카드 등장 시 호출 (하단 HUD 표시용) */
    onCardsShown?: () => void
  }) {
    this.rarity = data?.rarity ?? 'common'
    this.maxRerolls = data?.maxRerolls ?? 3 // 전체 리롤 한도
    this.remainingRerolls = data?.remainingRerolls ?? data?.maxRerolls ?? 3 // 남은 리롤 횟수
    this.onSelectCallback = data?.onSelect
    this.onCancelCallback = data?.onCancel
    this.onPreviewCallback = data?.onPreview
    this.onCardsShownCallback = data?.onCardsShown
    this.showTapToStart = data?.showTapToStart ?? false

    this.rerollCount = 0
    this.selectedAugment = null
    this.selectedCardIndex = -1
    this.cardContainers = []
    this.cardVisuals = []

    this.augmentChoices = generateAugmentChoices(this.rarity)
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setRoundPixels(true)

    // 증강 아이콘만 LINEAR(스무딩) 유지 → 픽셀 아트가 아닌 아이콘이 선명하게
    this.applySmoothFilterToAugmentIcons()

    this.uiContainer = this.add.container(0, AugmentSelectionScene.UI_OFFSET_Y)

    // 페이드 인 애니메이션
    this.uiContainer.setAlpha(0)
    this.tweens.add({
      targets: this.uiContainer,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    })

    this.input.keyboard?.on('keydown-ESC', () => this.cancelSelection())

    if (this.showTapToStart) {
      this.showTapToStartOverlay(width, height)
    } else {
      this.startSlotMachineAnimation(width, height)
    }
  }

  /**
   * "클릭하여 시작" 오버레이 표시. 첫 클릭 시 오버레이 제거 후 슬롯머신 시작.
   * 새로고침 시 사운드가 사용자 제스처 없이 막히는 것을 방지.
   */
  private showTapToStartOverlay(width: number, height: number) {
    const overlay = this.add.container(0, 0).setDepth(2000)
    this.startOverlay = overlay

    const bg = new Phaser.GameObjects.Graphics(this)
    bg.fillStyle(0x000000, 0.4)
    bg.fillRect(0, 0, width, height)
    overlay.add(bg)

    const hint = this.add
      .text(width / 2, height / 2, i18next.t('game.tapToStartRoulette'), {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    overlay.add(hint)

    const hitArea = this.add
      .rectangle(width / 2, height / 2, width, height)
      .setInteractive({ useHandCursor: true })
    overlay.add(hitArea)

    hitArea.once('pointerdown', () => {
      this.startOverlay?.destroy()
      this.startOverlay = undefined
      this.startSlotMachineAnimation(width, height)
    })
  }

  private createTitle(width: number, height: number) {
    if (!this.uiContainer) return

    const up = AugmentSelectionScene.AUGMENT_UI_UP_OFFSET
    const title = this.add
      .text(width / 2, height * 0.235 - up, i18next.t('game.augmentSelection'), {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '36px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.uiContainer.add(title)
  }

  /**
   * 카드 레이아웃 계산
   */
  private getCardLayout(width: number, height: number) {
    const up = AugmentSelectionScene.AUGMENT_UI_UP_OFFSET
    const cardY = height * 0.5 - up
    const totalWidth = AugmentSelectionScene.CARD_WIDTH * 3 + AugmentSelectionScene.CARD_GAP * 2
    const startX = (width - totalWidth) / 2 + AugmentSelectionScene.CARD_WIDTH / 2
    return { cardY, startX }
  }

  /**
   * 3개의 증강 카드 생성 (초기 생성 및 리롤 시 공통 사용)
   */
  private createCards(
    width: number,
    height: number,
    options: { fadeIn?: boolean; initialAlpha?: number; initialScale?: number } = {},
  ) {
    if (!this.uiContainer) return

    const { fadeIn = false, initialAlpha = 1, initialScale = 1 } = options
    const { cardY, startX } = this.getCardLayout(width, height)

    this.clearCards()

    for (let i = 0; i < 3; i++) {
      const augment = this.augmentChoices[i]
      const cardX = startX + i * (AugmentSelectionScene.CARD_WIDTH + AugmentSelectionScene.CARD_GAP)

      const { container, visualsContainer } = this.createAugmentCard(cardX, cardY, augment, i)
      this.uiContainer.add(container)
      this.cardContainers.push(container)
      this.cardVisuals.push(visualsContainer)

      if (fadeIn) {
        container.setAlpha(initialAlpha).setScale(initialScale)
        const delay = i * 50

        this.tweens.add({
          targets: container,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 250,
          delay,
          ease: 'Back.easeOut',
        })

        // 히든 등급은 추가 효과 적용
        if (augment.rarity === 'hidden') {
          this.createHiddenAugmentAnimation(cardX, cardY, delay)
        }
      } else if (augment.rarity === 'hidden') {
        // fadeIn이 false일 때도 히든 등급 추가 효과 적용
        this.createHiddenAugmentAnimation(cardX, cardY, i * 200)
      }
    }
  }

  /**
   * 기존 카드 제거
   */
  private clearCards() {
    this.cardContainers.forEach((container) => container.destroy())
    this.cardContainers = []
    this.cardVisuals = []
  }

  private createAugmentCard(
    x: number,
    y: number,
    augment: Augment,
    index: number,
  ): {
    container: Phaser.GameObjects.Container
    visualsContainer: Phaser.GameObjects.Container
  } {
    const container = this.add.container(x, y)
    const visualsContainer = this.add.container(0, 0)
    const { CARD_WIDTH, CARD_HEIGHT, ICON_SIZE } = AugmentSelectionScene

    const cardBgKey = AugmentSelectionScene.CARD_BG_KEYS[augment.rarity]
    const cardBg = this.add
      .image(0, 0, cardBgKey)
      .setDisplaySize(CARD_WIDTH, CARD_HEIGHT)
      .setOrigin(0.5)
    visualsContainer.add(cardBg)
    container.add(visualsContainer)

    createAugmentCardContent({
      scene: this,
      container,
      visualsContainer,
      augment,
      cardWidth: CARD_WIDTH,
      cardHeight: CARD_HEIGHT,
      iconSize: ICON_SIZE,
      iconYOffset: AugmentSelectionScene.ICON_Y_OFFSET,
      textNameYOffset: AugmentSelectionScene.TEXT_NAME_Y_OFFSET,
      textDescYOffset: AugmentSelectionScene.TEXT_DESC_Y_OFFSET,
      statIconMap: AugmentSelectionScene.STAT_ICON_MAP,
    })

    this.addCardInteractivity(container, index, CARD_WIDTH, CARD_HEIGHT)
    return { container, visualsContainer }
  }

  /** 증강 아이콘 텍스처에만 LINEAR 적용 → 픽셀화 없이 스무스 렌더링 */
  private applySmoothFilterToAugmentIcons(): void {
    const mode = Phaser.Textures.FilterMode.LINEAR
    for (const key of AugmentSelectionScene.AUGMENT_ICON_KEYS) {
      if (!this.textures.exists(key)) continue
      const tex = this.textures.get(key)
      tex.setFilter(mode)
      const sources = (
        tex as Phaser.Textures.Texture & { source?: Phaser.Textures.TextureSource[] }
      ).source
      if (sources && Array.isArray(sources)) {
        for (let i = 0; i < sources.length; i++) {
          sources[i].setFilter(mode)
        }
      }
    }
  }

  /**
   * 카드 인터랙티브 이벤트 추가 (시각 scale만)
   */
  private addCardInteractivity(
    container: Phaser.GameObjects.Container,
    index: number,
    cardWidth: number,
    cardHeight: number,
  ) {
    const hitArea = this.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    hitArea.on('pointerdown', () => this.selectCard(index))
    container.add(hitArea)
  }

  /**
   * 카드 선택 처리 (클릭 시 선택 + 미리보기 콜백으로 HUD 능력치 강조)
   */
  private selectCard(index: number) {
    const previousIndex = this.selectedCardIndex
    this.selectedCardIndex = index
    this.selectedAugment = this.augmentChoices[index]

    // 카드 클릭 시 미리보기: 추가될 능력치를 HUD에서 강조
    this.onPreviewCallback?.(this.selectedAugment)

    // 이전 선택 해제
    if (previousIndex >= 0 && previousIndex !== index) {
      this.updateCardSelection(previousIndex, false, 1)
    }

    // 현재 선택 적용 (에셋 카드만 사용, 테두리 없음 → scale로만 강조)
    this.updateCardSelection(index, true, 1.05)
    this.updateConfirmButton(true)
  }

  /**
   * 카드 선택 상태 업데이트 (시각 scale만)
   */
  private updateCardSelection(index: number, isSelected: boolean, scale: number) {
    const visualsContainer = this.cardVisuals[index]
    if (!visualsContainer) return

    this.tweens.killTweensOf(visualsContainer)
    this.tweens.add({
      targets: visualsContainer,
      scaleX: scale,
      scaleY: scale,
      duration: isSelected ? 150 : 100,
      ease: isSelected ? 'Back.easeOut' : 'Power2',
    })
  }

  private createButtons(width: number, height: number) {
    if (!this.uiContainer) return

    const { BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = AugmentSelectionScene
    const up = AugmentSelectionScene.AUGMENT_UI_UP_OFFSET
    const buttonY = height * 0.77 - up
    const buttonGap = 40
    const centerX = width / 2

    this.rerollButton = createRoundedButton(this, {
      x: centerX - BUTTON_WIDTH / 2 - buttonGap / 2,
      y: buttonY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      radius: BUTTON_RADIUS,
      color: 0x555555,
      label: this.getRerollButtonLabel(),
      onClick: () => this.reroll(),
    })
    this.uiContainer.add(this.rerollButton.container)
    // 라운드 변경 후 남은 리롤이 0이면 처음부터 비활성화 색/상태로 표시
    this.updateRerollButton(this.getRemainingRerollsForCurrentSelection() > 0)

    this.confirmButton = createRoundedButton(this, {
      x: centerX + BUTTON_WIDTH / 2 + buttonGap / 2,
      y: buttonY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      radius: BUTTON_RADIUS,
      color: 0x4caf50,
      label: i18next.t('game.select'),
      onClick: () => this.confirmSelection(),
    })
    this.uiContainer.add(this.confirmButton.container)
    this.updateConfirmButton(false)
  }

  /**
   * 버튼 배경 그리기
   */
  private drawButtonBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    radius: number,
    color: number,
    alpha: number,
  ) {
    graphics.clear()
    graphics.fillStyle(color, alpha)
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
  }

  /**
   * 확인 버튼 활성화/비활성화
   */
  private updateConfirmButton(enabled: boolean) {
    if (!this.confirmButton) return
    const { BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = AugmentSelectionScene

    const color = enabled ? 0x4caf50 : 0x333333
    this.drawButtonBackground(
      this.confirmButton.background,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      BUTTON_RADIUS,
      color,
      1,
    )
    this.confirmButton.setEnabled(enabled)
  }

  /**
   * 증강 리롤 (새로운 선택지 생성)
   */
  private reroll() {
    // 남은 리롤 횟수 확인 (세트 간 공유)
    if (this.rerollCount >= this.remainingRerolls) return

    this.rerollCount++
    this.selectedAugment = null
    this.selectedCardIndex = -1
    this.onPreviewCallback?.(null)
    this.updateConfirmButton(false)

    // 리롤 버튼 텍스트 업데이트 (i18next 사용)
    this.rerollButton?.setLabel(this.getRerollButtonLabel())

    // 리롤 소진 시 버튼 비활성화 (남은 리롤 횟수 확인)
    if (this.rerollCount >= this.remainingRerolls && this.rerollButton) {
      this.updateRerollButton(false)
    }

    // 카드 페이드 아웃 후 새 카드 생성
    this.fadeOutCards(() => {
      this.augmentChoices = generateAugmentChoices(this.rarity)
      this.createCards(this.scale.width, this.scale.height, {
        fadeIn: true,
        initialAlpha: 0,
        initialScale: 0.8,
      })
    })
  }

  /**
   * 리롤 버튼 활성화/비활성화
   */
  private updateRerollButton(enabled: boolean) {
    if (!this.rerollButton) return
    const { BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = AugmentSelectionScene

    const color = enabled ? 0x555555 : 0x333333
    this.drawButtonBackground(
      this.rerollButton.background,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      BUTTON_RADIUS,
      color,
      1,
    )
    this.rerollButton.setEnabled(enabled)
  }

  private getRemainingRerollsForCurrentSelection(): number {
    // 남은 총 리롤에서 이번 선택 씬에서 이미 사용한 횟수를 뺀다.
    return Math.max(0, this.remainingRerolls - this.rerollCount)
  }

  private getRerollButtonLabel(): string {
    // i18n 포맷에 맞춰 "남은 횟수/최대치"를 한 곳에서 계산한다.
    return i18next.t('game.reroll', {
      remaining: this.getRemainingRerollsForCurrentSelection(),
      max: this.maxRerolls,
    })
  }

  /**
   * 카드 페이드 아웃 애니메이션
   */
  private fadeOutCards(onComplete: () => void) {
    const totalCards = this.cardContainers.length

    if (totalCards === 0) {
      onComplete()
      return
    }

    let completedAnimations = 0

    this.cardContainers.forEach((container) => {
      this.tweens.add({
        targets: container,
        alpha: 0,
        scaleX: 0.8,
        scaleY: 0.8,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          completedAnimations++
          if (completedAnimations === totalCards) {
            onComplete()
          }
        },
      })
    })
  }

  /**
   * 히든 등급 카드 추가 효과 (파티클)
   * 일반 증강의 기본 등장 효과 위에 추가로 적용됨
   */
  private createHiddenAugmentAnimation(cardX: number, cardY: number, delay: number) {
    // 파티클 수집 효과
    this.time.delayedCall(delay + 300, () => {
      this.createHiddenParticles(cardX, cardY)
    })

    // 별 폭발 효과 (파티클 수집 완료 후 시작)
    this.time.delayedCall(delay + 300 + 1000, () => {
      this.createHiddenStars(cardX, cardY)
    })
  }

  /**
   * 히든 등급 파티클 생성 (중심으로 모이는 효과)
   */
  private createHiddenParticles(cardX: number, cardY: number) {
    const particleCount = 16

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const distance = 150
      const particleX = cardX + Math.cos(angle) * distance
      const particleY = cardY + Math.sin(angle) * distance

      const particle = this.add.circle(particleX, particleY, 10, 0xffd700, 1)
      particle.setBlendMode(Phaser.BlendModes.ADD)

      const glow = this.add.circle(particleX, particleY, 16, 0xff9800, 0.6)
      glow.setBlendMode(Phaser.BlendModes.ADD)

      this.uiContainer?.add(particle)
      this.uiContainer?.add(glow)

      this.tweens.add({
        targets: particle,
        x: cardX,
        y: cardY,
        alpha: 0,
        scale: 0,
        duration: 1000,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      })

      this.tweens.add({
        targets: glow,
        x: cardX,
        y: cardY,
        alpha: 0,
        scale: 0,
        duration: 1000,
        ease: 'Power2',
        onComplete: () => glow.destroy(),
      })
    }
  }

  /**
   * 히든 등급 별 폭발 효과 (더 눈에 띄게)
   */
  private createHiddenStars(cardX: number, cardY: number) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12
      const distance = 80
      const targetX = cardX + Math.cos(angle) * distance
      const targetY = cardY + Math.sin(angle) * distance

      const star = this.add.circle(cardX, cardY, 10, 0xffffff, 1)
      star.setBlendMode(Phaser.BlendModes.ADD)
      this.uiContainer?.add(star)

      this.tweens.add({
        targets: star,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => star.destroy(),
      })
    }
  }

  /**
   * 증강 선택 확정. 씬이 사라진 뒤 대기 연출은 RaceScene에서 처리.
   */
  private confirmSelection() {
    if (!this.selectedAugment) return
    this.fadeOutAndExit(() => this.onSelectCallback?.(this.selectedAugment!, this.rerollCount))
  }

  /**
   * 증강 선택 취소
   */
  private cancelSelection() {
    this.fadeOutAndExit(() => this.onCancelCallback?.())
  }

  /**
   * UI 페이드 아웃 후 씬 종료
   */
  private fadeOutAndExit(callback?: () => void) {
    this.onPreviewCallback?.(null)
    this.tweens.add({
      targets: this.uiContainer,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        callback?.()
        this.cleanupUI()
        this.scene.stop()
      },
    })
  }

  /** 룰렛 연출 오프셋(ms). 연출이 사운드보다 앞서면 양수로 연출 지연, 음수면 사운드 지연 */
  private static readonly ROULETTE_VISUAL_DELAY_MS = 400

  /** 슬롯머신(룰렛) 연출 시작 */
  private startSlotMachineAnimation(width: number, height: number) {
    // 사운드는 즉시 재생, 연출은 오프셋만큼 지연해 싱크 맞춤
    if (this.cache.audio.exists('roulette_confirm')) {
      this.sound.play('roulette_confirm', { volume: 0.8 })
    }
    this.rouletteAnimator?.destroy()
    this.rouletteAnimator = new RouletteAnimator({
      scene: this,
      uiOffsetY: AugmentSelectionScene.UI_OFFSET_Y,
      rarityColors: AugmentSelectionScene.RARITY_COLORS,
      rarity: this.rarity,
      visualDelayMs: AugmentSelectionScene.ROULETTE_VISUAL_DELAY_MS,
      onComplete: (nextWidth, nextHeight) => {
        this.removeSkipRouletteButton()
        this.showAugmentSelectionUI(nextWidth, nextHeight)
      },
    })
    this.rouletteAnimator.start(width, height)
    this.createSkipRouletteButton(width)
  }

  /** 슬롯머신 연출 중 우상단 스킵 버튼 생성 */
  private createSkipRouletteButton(width: number) {
    this.removeSkipRouletteButton()
    const padding = 20
    const btnWidth = 80
    const btnHeight = 36
    const x = width - padding - btnWidth / 2
    const y = padding + btnHeight / 2
    this.skipRouletteButton = createRoundedButton(this, {
      x,
      y,
      width: btnWidth,
      height: btnHeight,
      radius: 8,
      color: 0x555555,
      hoverColor: 0x666666,
      label: i18next.t('game.skip'),
      fontSize: '16px',
      onClick: () => {
        this.removeSkipRouletteButton()
        this.rouletteAnimator?.skip(this.scale.width, this.scale.height)
      },
    })
    this.skipRouletteButton.container.setDepth(1100)
    this.add.existing(this.skipRouletteButton.container)
  }

  private removeSkipRouletteButton() {
    if (!this.skipRouletteButton) return
    this.skipRouletteButton.container.removeAll(true)
    this.skipRouletteButton.container.destroy()
    this.skipRouletteButton = undefined
  }

  /**
   * 증강 선택 UI 표시 (카드 등장 시 하단 HUD도 함께 표시되도록 콜백 호출)
   */
  private showAugmentSelectionUI(width: number, height: number) {
    this.onCardsShownCallback?.()
    this.createTitle(width, height)
    this.createCards(width, height)
    this.createButtons(width, height)
  }

  /**
   * UI 정리 및 참조 제거
   */
  private cleanupUI() {
    // 씬 재진입 시 이전 선택 상태가 남지 않도록 모든 참조를 명시적으로 초기화한다.
    this.removeSkipRouletteButton()
    this.rouletteAnimator?.destroy()
    this.rouletteAnimator = undefined

    this.cardContainers.forEach((container) => container.removeAll(true))
    this.cardContainers.forEach((container) => container.destroy())
    this.cardContainers = []
    this.cardVisuals = []
    this.rerollButton?.container.removeAll(true)
    this.rerollButton?.container.destroy()
    this.rerollButton = undefined

    this.confirmButton?.container.removeAll(true)
    this.confirmButton?.container.destroy()
    this.confirmButton = undefined

    this.uiContainer?.removeAll(true)
    this.uiContainer?.destroy()
    this.uiContainer = undefined

    this.selectedAugment = null
    this.selectedCardIndex = -1
    this.onSelectCallback = undefined
    this.onCancelCallback = undefined
    this.onPreviewCallback = undefined
    this.onCardsShownCallback = undefined
  }
}
