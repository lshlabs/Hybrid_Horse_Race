import Phaser from 'phaser'
import type { Augment, AugmentRarity, AugmentStatType } from '../../../engine/race'
import {
  AUGMENT_RARITY_NAMES,
  AUGMENT_STAT_NAMES,
  AUGMENT_STAT_DESCRIPTIONS,
  SPECIAL_ABILITY_DESCRIPTIONS,
  generateAugmentChoices,
} from '../../../engine/race'
import AugmentDevPanel from '../ui/AugmentDevPanel'
import accelerationUrl from '../../../assets/images/etc/acceleration.png'
import consistencyUrl from '../../../assets/images/etc/Consistency.png'
import gutsUrl from '../../../assets/images/etc/guts.png'
import maxSpeedUrl from '../../../assets/images/etc/max_speed.png'
import staminaUrl from '../../../assets/images/etc/stamina.png'
import startUrl from '../../../assets/images/etc/start.png'
import lastSpurtUrl from '../../../assets/images/etc/last_spurt.png'
import overtakeUrl from '../../../assets/images/etc/overtake.png'
import magneticUrl from '../../../assets/images/etc/magnetic.png'

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

  private static readonly RARITY_BG_COLORS: Record<AugmentRarity, number> = {
    common: 0x424242,
    rare: 0x1565c0,
    epic: 0x6a1b9a,
    legendary: 0x8b7500, // 진한 금색
    hidden: 0xe65100, // 진한 주황색
  }

  private static readonly STAT_ICON_MAP: Record<AugmentStatType, string> = {
    Speed: 'stat_max_speed',
    Stamina: 'stat_stamina',
    Power: 'stat_acceleration',
    Guts: 'stat_guts',
    Start: 'stat_start',
    Consistency: 'stat_consistency',
  }

  // 레이아웃 상수
  private static readonly CARD_WIDTH = 200
  private static readonly CARD_HEIGHT = 280
  private static readonly CARD_GAP = 30
  private static readonly CARD_RADIUS = 16
  private static readonly ICON_SIZE = 128
  private static readonly BUTTON_WIDTH = 140
  private static readonly BUTTON_HEIGHT = 50
  private static readonly BUTTON_RADIUS = 12

  // 상태 필드
  private rarity: AugmentRarity = 'common'
  private maxRerolls: number = 3
  private rerollCount: number = 0
  private onSelectCallback?: (augment: Augment, usedRerolls: number) => void
  private onCancelCallback?: () => void

  private augmentChoices: Augment[] = []
  private selectedAugment: Augment | null = null
  private selectedCardIndex: number = -1

  // UI 요소
  private uiContainer?: Phaser.GameObjects.Container
  private cardGraphics: Phaser.GameObjects.Graphics[] = []
  private cardContainers: Phaser.GameObjects.Container[] = []
  private rerollButton?: Phaser.GameObjects.Container
  private confirmButton?: Phaser.GameObjects.Container
  private rerollText?: Phaser.GameObjects.Text
  private slotMachineContainer?: Phaser.GameObjects.Container

  // 개발용 패널
  private devPanel?: AugmentDevPanel
  private devPanelButton?: Phaser.GameObjects.Container

  constructor() {
    super('AugmentSelectionScene')
  }

  preload() {
    this.load.image('stat_acceleration', accelerationUrl)
    this.load.image('stat_consistency', consistencyUrl)
    this.load.image('stat_guts', gutsUrl)
    this.load.image('stat_max_speed', maxSpeedUrl)
    this.load.image('stat_stamina', staminaUrl)
    this.load.image('stat_start', startUrl)
    this.load.image('special_last_spurt', lastSpurtUrl)
    this.load.image('special_overtake', overtakeUrl)
    this.load.image('special_escape_crisis', magneticUrl)
  }

  init(data?: {
    rarity?: AugmentRarity
    maxRerolls?: number
    onSelect?: (augment: Augment, usedRerolls: number) => void
    onCancel?: () => void
  }) {
    this.rarity = data?.rarity ?? 'common'
    this.maxRerolls = data?.maxRerolls ?? 3
    this.onSelectCallback = data?.onSelect
    this.onCancelCallback = data?.onCancel

    this.rerollCount = 0
    this.selectedAugment = null
    this.selectedCardIndex = -1
    this.cardGraphics = []
    this.cardContainers = []

    this.augmentChoices = generateAugmentChoices(this.rarity)
  }

  create() {
    const { width, height } = this.scale

    this.uiContainer = this.add.container(0, 0)

    // 반투명 배경 오버레이
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
    overlay.setInteractive()
    this.uiContainer.add(overlay)

    // 페이드 인 애니메이션
    this.uiContainer.setAlpha(0)
    this.tweens.add({
      targets: this.uiContainer,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    })

    this.input.keyboard?.on('keydown-ESC', () => this.cancelSelection())

    // 개발 패널 초기화
    this.devPanel = new AugmentDevPanel(this)

    // 개발 패널 단축키 (D 키)
    this.input.keyboard?.on('keydown-D', () => {
      if (!this.devPanel) return
      this.devPanel.show((augments) => {
        // 개발 패널에서 생성된 증강으로 교체
        this.augmentChoices = augments
        // 슬롯머신 애니메이션 스킵하고 바로 카드 표시
        if (this.slotMachineContainer) {
          this.slotMachineContainer.destroy()
          this.slotMachineContainer = undefined
        }
        this.showAugmentSelectionUI(width, height)
      })
    })

    this.startSlotMachineAnimation(width, height)
  }

  private createTitle(width: number, height: number) {
    if (!this.uiContainer) return

    const title = this.add
      .text(width / 2, height * 0.235, '증강 선택', {
        fontFamily: 'Arial, sans-serif',
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
    const cardY = height * 0.5
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

      const { container, graphics } = this.createAugmentCard(cardX, cardY, augment, i)
      this.uiContainer.add(container)
      this.cardContainers.push(container)
      this.cardGraphics.push(graphics)

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
          this.createHiddenAugmentAnimation(container, cardX, cardY, delay)
        }
      } else if (augment.rarity === 'hidden') {
        // fadeIn이 false일 때도 히든 등급 추가 효과 적용
        this.createHiddenAugmentAnimation(container, cardX, cardY, i * 200)
      }
    }
  }

  /**
   * 기존 카드 제거
   */
  private clearCards() {
    this.cardContainers.forEach((container) => container.destroy())
    this.cardGraphics.forEach((graphics) => graphics.destroy())
    this.cardContainers = []
    this.cardGraphics = []
  }

  private createAugmentCard(
    x: number,
    y: number,
    augment: Augment,
    index: number,
  ): { container: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics } {
    const container = this.add.container(x, y)
    const { CARD_WIDTH, CARD_HEIGHT, ICON_SIZE } = AugmentSelectionScene
    const bgColor = AugmentSelectionScene.RARITY_BG_COLORS[augment.rarity]
    const borderColor = AugmentSelectionScene.RARITY_COLORS[augment.rarity]

    const graphics = this.add.graphics()
    this.drawCard(graphics, bgColor, borderColor, false)
    container.add(graphics)

    if (augment.specialAbility) {
      this.addSpecialAbilityContent(container, augment, CARD_WIDTH, CARD_HEIGHT, ICON_SIZE)
    } else if (augment.statType) {
      this.addStatContent(container, augment, CARD_WIDTH, CARD_HEIGHT, ICON_SIZE)
    }

    this.addCardInteractivity(container, index, CARD_WIDTH, CARD_HEIGHT)
    return { container, graphics }
  }

  /**
   * 특수 능력 카드 콘텐츠 추가
   */
  private addSpecialAbilityContent(
    container: Phaser.GameObjects.Container,
    augment: Augment,
    cardWidth: number,
    cardHeight: number,
    iconSize: number,
  ) {
    const abilityDescription = SPECIAL_ABILITY_DESCRIPTIONS[augment.specialAbility!]
    const iconKey = this.getSpecialAbilityIconKey(augment.specialAbility!)

    if (iconKey) {
      const icon = this.add.image(0, -cardHeight / 2 + 20 + iconSize / 2, iconKey)

      // 위기 탈출은 원본 비율 유지, 나머지는 정사각형
      if (augment.specialAbility === 'escapeCrisis') {
        this.setIconAspectRatio(icon, iconKey, iconSize)
      } else {
        icon.setDisplaySize(iconSize, iconSize)
      }
      container.add(icon)
    }

    // 이름
    const nameText = this.add
      .text(0, 30, augment.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(nameText)

    // 수치
    if (augment.specialAbilityValue != null) {
      const valueText = this.add
        .text(0, 65, `+${augment.specialAbilityValue}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '32px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      container.add(valueText)
    }

    // 설명
    const descText = this.add
      .text(0, cardHeight / 2 - 40, abilityDescription, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#cccccc',
        align: 'center',
        wordWrap: { width: cardWidth - 30 },
      })
      .setOrigin(0.5)
    container.add(descText)
  }

  /**
   * 일반 능력치 카드 콘텐츠 추가
   */
  private addStatContent(
    container: Phaser.GameObjects.Container,
    augment: Augment,
    cardWidth: number,
    cardHeight: number,
    iconSize: number,
  ) {
    const iconKey = AugmentSelectionScene.STAT_ICON_MAP[augment.statType!]

    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(0, -cardHeight / 2 + 20 + iconSize / 2, iconKey)
      icon.setDisplaySize(iconSize, iconSize)
      container.add(icon)
    }

    // 능력치 이름
    const nameText = this.add
      .text(0, 30, AUGMENT_STAT_NAMES[augment.statType!], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(nameText)

    // 능력치 값
    if (augment.statValue != null) {
      const valueSign = augment.statValue > 0 ? '+' : ''
      const valueText = this.add
        .text(0, 65, `${valueSign}${augment.statValue}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '32px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      container.add(valueText)
    }

    // 설명
    const descText = this.add
      .text(0, cardHeight / 2 - 40, AUGMENT_STAT_DESCRIPTIONS[augment.statType!], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#cccccc',
        align: 'center',
        wordWrap: { width: cardWidth - 30 },
      })
      .setOrigin(0.5)
    container.add(descText)
  }

  /**
   * 특수 능력 아이콘 키 반환
   */
  private getSpecialAbilityIconKey(ability: string): string | null {
    const keyMap: Record<string, string> = {
      lastSpurt: 'special_last_spurt',
      overtake: 'special_overtake',
      escapeCrisis: 'special_escape_crisis',
    }
    const key = keyMap[ability]
    return key && this.textures.exists(key) ? key : null
  }

  /**
   * 아이콘 비율 유지하며 크기 설정
   */
  private setIconAspectRatio(icon: Phaser.GameObjects.Image, iconKey: string, iconSize: number) {
    const texture = this.textures.get(iconKey)
    if (texture?.source?.[0]) {
      const { width, height } = texture.source[0]
      const aspectRatio = width / height
      icon.setDisplaySize(iconSize * aspectRatio, iconSize)
    } else {
      icon.setDisplaySize(iconSize, iconSize)
    }
  }

  /**
   * 카드 인터랙티브 이벤트 추가
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

    hitArea.on('pointerover', () => {
      if (this.selectedCardIndex !== index) {
        this.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
          ease: 'Power2',
        })
      }
    })

    hitArea.on('pointerout', () => {
      if (this.selectedCardIndex !== index) {
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2',
        })
      }
    })

    hitArea.on('pointerdown', () => this.selectCard(index))
    container.add(hitArea)
  }

  /**
   * 카드 배경 및 테두리 그리기
   */
  private drawCard(
    graphics: Phaser.GameObjects.Graphics,
    bgColor: number,
    borderColor: number,
    isSelected: boolean,
  ) {
    const { CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS } = AugmentSelectionScene
    const halfWidth = CARD_WIDTH / 2
    const halfHeight = CARD_HEIGHT / 2

    graphics.clear()

    if (isSelected) {
      graphics.fillStyle(borderColor, 0.3)
      graphics.fillRoundedRect(
        -halfWidth - 6,
        -halfHeight - 6,
        CARD_WIDTH + 12,
        CARD_HEIGHT + 12,
        CARD_RADIUS + 4,
      )
    }

    graphics.fillStyle(bgColor, 1)
    graphics.fillRoundedRect(-halfWidth, -halfHeight, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)

    graphics.lineStyle(isSelected ? 4 : 2, borderColor, 1)
    graphics.strokeRoundedRect(-halfWidth, -halfHeight, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
  }

  /**
   * 카드 선택 처리
   */
  private selectCard(index: number) {
    const previousIndex = this.selectedCardIndex
    this.selectedCardIndex = index
    this.selectedAugment = this.augmentChoices[index]

    const augment = this.augmentChoices[index]
    const borderColor = AugmentSelectionScene.RARITY_COLORS[augment.rarity]
    const bgColor = AugmentSelectionScene.RARITY_BG_COLORS[augment.rarity]

    // 이전 선택 해제
    if (previousIndex >= 0 && previousIndex !== index) {
      const prevAugment = this.augmentChoices[previousIndex]
      const prevBorderColor = AugmentSelectionScene.RARITY_COLORS[prevAugment.rarity]
      const prevBgColor = AugmentSelectionScene.RARITY_BG_COLORS[prevAugment.rarity]

      this.updateCardSelection(previousIndex, prevBgColor, prevBorderColor, false, 1)
    }

    // 현재 선택 적용
    this.updateCardSelection(index, bgColor, borderColor, true, 1.1)
    this.updateConfirmButton(true)
  }

  /**
   * 카드 선택 상태 업데이트
   */
  private updateCardSelection(
    index: number,
    bgColor: number,
    borderColor: number,
    isSelected: boolean,
    scale: number,
  ) {
    const graphics = this.cardGraphics[index]
    const container = this.cardContainers[index]

    if (graphics && container) {
      this.drawCard(graphics, bgColor, borderColor, isSelected)
      this.tweens.add({
        targets: container,
        scaleX: scale,
        scaleY: scale,
        duration: isSelected ? 150 : 100,
        ease: isSelected ? 'Back.easeOut' : 'Power2',
      })
    }
  }

  private createButtons(width: number, height: number) {
    if (!this.uiContainer) return

    const { BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = AugmentSelectionScene
    const buttonY = height * 0.8
    const buttonGap = 40
    const centerX = width / 2

    this.rerollButton = this.createButton(
      centerX - BUTTON_WIDTH / 2 - buttonGap / 2,
      buttonY,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      BUTTON_RADIUS,
      0x555555,
      `리롤 (${this.maxRerolls - this.rerollCount}/${this.maxRerolls})`,
      () => this.reroll(),
    )
    this.rerollText = this.rerollButton.getAt(1) as Phaser.GameObjects.Text
    this.uiContainer.add(this.rerollButton)

    this.confirmButton = this.createButton(
      centerX + BUTTON_WIDTH / 2 + buttonGap / 2,
      buttonY,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      BUTTON_RADIUS,
      0x4caf50,
      '선택',
      () => this.confirmSelection(),
    )
    this.uiContainer.add(this.confirmButton)
    this.updateConfirmButton(false)

    // 개발 패널 버튼 (우측 상단)
    this.createDevPanelButton(width)
  }

  /**
   * 개발 패널 버튼 생성
   */
  private createDevPanelButton(width: number) {
    if (!this.uiContainer || !this.devPanel) return

    const buttonWidth = 120
    const buttonHeight = 40
    const buttonX = width - buttonWidth / 2 - 20
    const buttonY = 40

    this.devPanelButton = this.add.container(buttonX, buttonY)

    const bg = this.add
      .graphics()
      .fillStyle(0x666666, 1)
      .fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8)
      .lineStyle(2, 0xff9800, 1)
      .strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8)
    this.devPanelButton.add(bg)

    const text = this.add
      .text(0, 0, '개발 모드', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.devPanelButton.add(text)

    const hitArea = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.clear()
        bg.fillStyle(0x777777, 1)
        bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8)
        bg.lineStyle(2, 0xff9800, 1)
        bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8)
      })
      .on('pointerout', () => {
        bg.clear()
        bg.fillStyle(0x666666, 1)
        bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8)
        bg.lineStyle(2, 0xff9800, 1)
        bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8)
      })
      .on('pointerdown', () => {
        this.devPanel?.show((augments) => {
          // 개발 패널에서 생성된 증강으로 교체
          this.augmentChoices = augments
          // 기존 카드 제거 후 새 카드 생성
          this.clearCards()
          this.createCards(this.scale.width, this.scale.height, {
            fadeIn: true,
            initialAlpha: 0,
            initialScale: 0.8,
          })
        })
      })
    this.devPanelButton.add(hitArea)

    this.uiContainer.add(this.devPanelButton)
  }

  /**
   * 버튼 생성
   */
  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    const bg = this.add.graphics()

    this.drawButtonBackground(bg, width, height, radius, color, 1)
    container.add(bg)

    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(text)

    const hitArea = this.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    this.addButtonHoverEffects(hitArea, bg, width, height, radius, color)
    hitArea.on('pointerdown', onClick)
    container.add(hitArea)

    container.setData('bg', bg)
    container.setData('color', color)
    container.setData('hitArea', hitArea)

    return container
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
   * 버튼 hover 효과 추가
   */
  private addButtonHoverEffects(
    hitArea: Phaser.GameObjects.Rectangle,
    bg: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    radius: number,
    color: number,
  ) {
    hitArea.on('pointerover', () => {
      this.drawButtonBackground(bg, width, height, radius, color, 0.8)
    })

    hitArea.on('pointerout', () => {
      this.drawButtonBackground(bg, width, height, radius, color, 1)
    })
  }

  /**
   * 확인 버튼 활성화/비활성화
   */
  private updateConfirmButton(enabled: boolean) {
    if (!this.confirmButton) return

    const bg = this.confirmButton.getData('bg') as Phaser.GameObjects.Graphics
    const hitArea = this.confirmButton.getData('hitArea') as Phaser.GameObjects.Rectangle
    const { BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = AugmentSelectionScene

    const color = enabled ? 0x4caf50 : 0x333333
    this.drawButtonBackground(bg, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS, color, 1)

    if (enabled) {
      hitArea.setInteractive({ useHandCursor: true })
      this.confirmButton.setAlpha(1)
    } else {
      hitArea.disableInteractive()
      this.confirmButton.setAlpha(0.5)
    }
  }

  /**
   * 증강 리롤 (새로운 선택지 생성)
   */
  private reroll() {
    if (this.rerollCount >= this.maxRerolls) return

    this.rerollCount++
    this.selectedAugment = null
    this.selectedCardIndex = -1
    this.updateConfirmButton(false)

    // 리롤 버튼 텍스트 업데이트
    if (this.rerollText) {
      this.rerollText.setText(`리롤 (${this.maxRerolls - this.rerollCount}/${this.maxRerolls})`)
    }

    // 리롤 소진 시 버튼 비활성화
    if (this.rerollCount >= this.maxRerolls && this.rerollButton) {
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

    const bg = this.rerollButton.getData('bg') as Phaser.GameObjects.Graphics
    const hitArea = this.rerollButton.getData('hitArea') as Phaser.GameObjects.Rectangle
    const { BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = AugmentSelectionScene

    const color = enabled ? 0x555555 : 0x333333
    this.drawButtonBackground(bg, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS, color, 1)

    if (enabled) {
      hitArea.setInteractive({ useHandCursor: true })
      this.rerollButton.setAlpha(1)
    } else {
      hitArea.disableInteractive()
      this.rerollButton.setAlpha(0.5)
    }
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
  private createHiddenAugmentAnimation(
    _container: Phaser.GameObjects.Container,
    cardX: number,
    cardY: number,
    delay: number,
  ) {
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
   * 증강 선택 확정
   */
  private confirmSelection() {
    if (!this.selectedAugment) return
    // 사용한 리롤 횟수와 함께 콜백 호출
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

  /**
   * 슬롯머신 애니메이션 시작
   */
  private startSlotMachineAnimation(width: number, height: number) {
    this.slotMachineContainer = this.add.container(0, 0)
    this.slotMachineContainer.setDepth(1000)

    const frameX = width / 2
    const frameY = height / 2
    const frameWidth = 400
    const frameHeight = 120
    const textSpacing = 90
    const spinDuration = 5000

    // 프레임 배경
    const frameBg = this.add.graphics()
    frameBg.fillStyle(0x000000, 0.8)
    frameBg.fillRoundedRect(
      frameX - frameWidth / 2,
      frameY - frameHeight / 2,
      frameWidth,
      frameHeight,
      16,
    )
    this.slotMachineContainer.add(frameBg)

    // 등급 목록
    const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary']
    const rarityNames = rarities.map((r) => AUGMENT_RARITY_NAMES[r])
    const rarityColors = rarities.map((r) => AugmentSelectionScene.RARITY_COLORS[r])

    // 마스크 생성
    const maskGraphics = this.add.graphics()
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(
      frameX - frameWidth / 2,
      frameY - frameHeight / 2,
      frameWidth,
      frameHeight,
    )
    maskGraphics.setVisible(false)
    const mask = maskGraphics.createGeometryMask()
    this.slotMachineContainer.add(maskGraphics)

    // 슬롯 텍스트 생성 및 애니메이션
    const slotTexts = this.createSlotTexts(
      frameX,
      frameY,
      rarityNames,
      rarityColors,
      mask,
      textSpacing,
    )
    this.animateSlotTexts(slotTexts, frameY, textSpacing, rarities, spinDuration, width, height)

    // 프레임 테두리
    const frameGraphics = this.add.graphics()
    frameGraphics.lineStyle(6, 0xffd700, 1)
    frameGraphics.strokeRoundedRect(
      frameX - frameWidth / 2,
      frameY - frameHeight / 2,
      frameWidth,
      frameHeight,
      16,
    )
    this.slotMachineContainer.add(frameGraphics)

    // 글로우 펄스 효과
    this.addSlotGlowEffect(frameX, frameY, frameWidth, spinDuration)
  }

  /**
   * 슬롯 텍스트 생성
   */
  private createSlotTexts(
    frameX: number,
    frameY: number,
    rarityNames: string[],
    rarityColors: number[],
    mask: Phaser.Display.Masks.GeometryMask,
    textSpacing: number,
  ): Phaser.GameObjects.Text[] {
    const repeatCount = 20
    const slotTexts: Phaser.GameObjects.Text[] = []

    for (let i = 0; i < repeatCount; i++) {
      for (let j = 0; j < rarityNames.length; j++) {
        const text = this.add
          .text(frameX, frameY - 500 - (i * rarityNames.length + j) * textSpacing, rarityNames[j], {
            fontFamily: 'Arial, sans-serif',
            fontSize: '48px',
            color: `#${rarityColors[j].toString(16).padStart(6, '0')}`,
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setMask(mask)

        this.slotMachineContainer?.add(text)
        slotTexts.push(text)
      }
    }

    return slotTexts
  }

  /**
   * 슬롯 텍스트 애니메이션
   */
  private animateSlotTexts(
    slotTexts: Phaser.GameObjects.Text[],
    frameY: number,
    textSpacing: number,
    rarities: AugmentRarity[],
    spinDuration: number,
    width: number,
    height: number,
  ): void {
    const targetRarityIndex = rarities.indexOf(this.rarity)
    const repeatCount = 20
    const lastCycleStart = (repeatCount - 1) * rarities.length
    const targetTextIndex = lastCycleStart + targetRarityIndex

    slotTexts.forEach((text, index) => {
      const finalY = frameY + (targetTextIndex - index) * textSpacing

      this.tweens.add({
        targets: text,
        y: finalY,
        duration: spinDuration,
        ease: 'Circ.easeOut',
        onComplete: () => {
          if (index === targetTextIndex) {
            this.highlightFinalRarity(width, height, text, targetRarityIndex, rarities)
          }
        },
      })
    })
  }

  /**
   * 슬롯머신 글로우 효과 추가
   */
  private addSlotGlowEffect(
    frameX: number,
    frameY: number,
    frameWidth: number,
    spinDuration: number,
  ) {
    const glowCircle = this.add.circle(frameX, frameY, frameWidth / 2, 0xffd700, 0.1)
    glowCircle.setBlendMode(Phaser.BlendModes.ADD)
    this.slotMachineContainer?.add(glowCircle)

    this.tweens.add({
      targets: glowCircle,
      alpha: { from: 0.1, to: 0.3 },
      scale: { from: 0.9, to: 1.1 },
      duration: 200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: Math.floor(spinDuration / 400),
    })
  }

  /**
   * 최종 등급 강조 및 다음 단계로 전환
   */
  private highlightFinalRarity(
    width: number,
    height: number,
    finalText: Phaser.GameObjects.Text,
    targetRarityIndex: number,
    rarities: AugmentRarity[],
  ) {
    const finalColor = AugmentSelectionScene.RARITY_COLORS[rarities[targetRarityIndex]]

    // 펄스 애니메이션
    this.tweens.add({
      targets: finalText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 300,
      ease: 'Back.easeOut',
      yoyo: true,
      onComplete: () => this.moveTextToTitle(width, height, finalText),
    })

    // 폭발 파티클
    this.createExplosionParticles(width / 2, height / 2, finalColor)
  }

  /**
   * 폭발 파티클 생성
   */
  private createExplosionParticles(centerX: number, centerY: number, color: number) {
    const particleCount = 30
    const distance = 200

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const targetX = centerX + Math.cos(angle) * distance
      const targetY = centerY + Math.sin(angle) * distance

      const particle = this.add.circle(centerX, centerY, 8, color, 1)
      particle.setBlendMode(Phaser.BlendModes.ADD)
      this.slotMachineContainer?.add(particle)

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      })
    }
  }

  /**
   * 슬롯머신 페이드 아웃 후 증강 선택 UI로 전환
   */
  private moveTextToTitle(width: number, height: number, finalText: Phaser.GameObjects.Text) {
    if (!this.slotMachineContainer) return

    finalText.clearMask()
    this.tweens.add({
      targets: finalText,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
    })

    this.tweens.add({
      targets: this.slotMachineContainer,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.slotMachineContainer?.removeAll(true)
        this.slotMachineContainer?.destroy(true)
        this.slotMachineContainer = undefined
        this.showAugmentSelectionUI(width, height)
      },
    })
  }

  /**
   * 증강 선택 UI 표시
   */
  private showAugmentSelectionUI(width: number, height: number) {
    this.createTitle(width, height)
    this.createCards(width, height)
    this.createButtons(width, height)
  }

  /**
   * UI 정리 및 참조 제거
   */
  private cleanupUI() {
    this.slotMachineContainer?.removeAll(true)
    this.slotMachineContainer?.destroy()
    this.slotMachineContainer = undefined

    this.cardContainers.forEach((container) => container.removeAll(true))
    this.cardContainers.forEach((container) => container.destroy())
    this.cardContainers = []

    this.cardGraphics.forEach((graphics) => graphics.destroy())
    this.cardGraphics = []

    this.rerollButton?.removeAll(true)
    this.rerollButton?.destroy()
    this.rerollButton = undefined

    this.devPanelButton?.removeAll(true)
    this.devPanelButton?.destroy()
    this.devPanelButton = undefined

    this.devPanel?.hide()

    this.confirmButton?.removeAll(true)
    this.confirmButton?.destroy()
    this.confirmButton = undefined

    this.uiContainer?.removeAll(true)
    this.uiContainer?.destroy()
    this.uiContainer = undefined

    this.rerollText = undefined
    this.selectedAugment = null
    this.selectedCardIndex = -1
    this.onSelectCallback = undefined
    this.onCancelCallback = undefined
  }
}
