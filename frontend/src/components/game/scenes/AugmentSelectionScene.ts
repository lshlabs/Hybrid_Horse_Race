import Phaser from 'phaser'
import type { Augment, AugmentRarity } from '../../../types/augment'
import { generateAugmentChoices } from '../../../data/augments'
import { AUGMENT_STAT_NAMES } from '../../../types/augment'

/**
 * 증강 선택 Scene
 * RaceScene 위에 오버레이로 표시됨
 */
export default class AugmentSelectionScene extends Phaser.Scene {
  private selectedAugment: Augment | null = null
  private rerollCount: number = 0
  private maxRerolls: number = 0
  private currentRarity: AugmentRarity = 'rare'
  private choices: Augment[] = []
  private onSelectCallback?: (augment: Augment) => void
  private onCancelCallback?: () => void

  // UI 요소들
  private background?: Phaser.GameObjects.Graphics
  private titleText?: Phaser.GameObjects.Text
  private rerollButton?: Phaser.GameObjects.Text
  private rerollButtonBg?: Phaser.GameObjects.Graphics
  private confirmButton?: Phaser.GameObjects.Text
  private confirmButtonBg?: Phaser.GameObjects.Graphics
  private augmentCards: Phaser.GameObjects.Container[] = []

  constructor() {
    super({ key: 'AugmentSelectionScene' })
  }

  init(data?: {
    rarity?: AugmentRarity
    maxRerolls?: number
    onSelect?: (augment: Augment) => void
    onCancel?: () => void
  }) {
    this.currentRarity = data?.rarity || 'rare'
    this.maxRerolls = data?.maxRerolls || 0
    this.rerollCount = 0
    this.onSelectCallback = data?.onSelect
    this.onCancelCallback = data?.onCancel
    this.selectedAugment = null
  }

  create(data?: {
    rarity?: AugmentRarity
    maxRerolls?: number
    onSelect?: (augment: Augment) => void
    onCancel?: () => void
  }) {
    // init에서 데이터를 받지 못한 경우 create에서 받기
    if (data) {
      this.currentRarity = data.rarity || this.currentRarity
      this.maxRerolls = data.maxRerolls ?? this.maxRerolls
      this.onSelectCallback = data.onSelect || this.onSelectCallback
      this.onCancelCallback = data.onCancel || this.onCancelCallback
    }

    console.log('AugmentSelectionScene create 호출됨', {
      rarity: this.currentRarity,
      maxRerolls: this.maxRerolls,
    })

    const width = this.scale.width
    const height = this.scale.height

    // 반투명 배경
    this.background = this.add.graphics()
    this.background.fillStyle(0x000000, 0.7)
    this.background.fillRect(0, 0, width, height)
    this.background.setDepth(1000)
    this.background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    )
    this.background.setPosition(width / 2 - width / 2, height / 2 - height / 2)

    // 제목
    this.titleText = this.add
      .text(width / 2, height * 0.15, '증강을 선택하세요', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(1001)

    // 증강 선택지 생성
    this.generateChoices()
    this.createAugmentCards()

    // 버튼 영역 (나란하게 배치)
    // 제목(0.15)과 카드(0.45) 사이 여백(0.3)만큼 카드 아래에 배치
    const cardY = height * 0.45
    const titleY = height * 0.15
    const gapBetweenTitleAndCard = cardY - titleY
    const buttonY = cardY + gapBetweenTitleAndCard
    const buttonGap = 20
    const buttonWidth = 150
    const totalButtonWidth = buttonWidth * 2 + buttonGap
    const buttonStartX = width / 2 - totalButtonWidth / 2 + buttonWidth / 2

    // 새로고침 버튼 (둥근 모서리)
    if (this.maxRerolls - this.rerollCount > 0) {
      const buttonText = `새로고침 (${this.maxRerolls - this.rerollCount})`
      this.rerollButton = this.add
        .text(buttonStartX, buttonY, buttonText, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(1002)

      const textWidth = this.rerollButton.width + 32
      const textHeight = this.rerollButton.height + 20
      this.rerollButtonBg = this.add.graphics()
      this.rerollButtonBg.fillStyle(0x333333, 1)
      this.rerollButtonBg.fillRoundedRect(
        buttonStartX - textWidth / 2,
        buttonY - textHeight / 2,
        textWidth,
        textHeight,
        12,
      )
      this.rerollButtonBg.setDepth(1001)
      this.rerollButtonBg.setInteractive(
        new Phaser.Geom.Rectangle(
          buttonStartX - textWidth / 2,
          buttonY - textHeight / 2,
          textWidth,
          textHeight,
        ),
        Phaser.Geom.Rectangle.Contains,
      )
      this.rerollButtonBg.setInteractive({ useHandCursor: true })
      this.rerollButtonBg.on('pointerdown', () => this.reroll())

      // 텍스트도 클릭 가능하게 (배경과 동일한 영역)
      this.rerollButton.setInteractive(
        new Phaser.Geom.Rectangle(
          buttonStartX - textWidth / 2,
          buttonY - textHeight / 2,
          textWidth,
          textHeight,
        ),
        Phaser.Geom.Rectangle.Contains,
      )
      this.rerollButton.setInteractive({ useHandCursor: true })
      this.rerollButton.on('pointerdown', () => this.reroll())
    }

    // 선택하기 버튼 (둥근 모서리)
    this.confirmButton = this.add
      .text(buttonStartX + buttonWidth + buttonGap, buttonY, '선택하기', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(1002)

    const confirmTextWidth = this.confirmButton.width + 32
    const confirmTextHeight = this.confirmButton.height + 20
    const confirmButtonColor = this.selectedAugment ? 0x00aa00 : 0x666666
    this.confirmButtonBg = this.add.graphics()
    this.confirmButtonBg.fillStyle(confirmButtonColor, 1)
    this.confirmButtonBg.fillRoundedRect(
      buttonStartX + buttonWidth + buttonGap - confirmTextWidth / 2,
      buttonY - confirmTextHeight / 2,
      confirmTextWidth,
      confirmTextHeight,
      12,
    )
    this.confirmButtonBg.setDepth(1001)
    this.confirmButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(
        buttonStartX + buttonWidth + buttonGap - confirmTextWidth / 2,
        buttonY - confirmTextHeight / 2,
        confirmTextWidth,
        confirmTextHeight,
      ),
      Phaser.Geom.Rectangle.Contains,
    )
    this.confirmButtonBg.setInteractive({ useHandCursor: true })
    this.confirmButtonBg.on('pointerdown', () => this.confirmSelection())

    // 텍스트도 클릭 가능하게 (배경과 동일한 영역)
    this.confirmButton.setInteractive(
      new Phaser.Geom.Rectangle(
        buttonStartX + buttonWidth + buttonGap - confirmTextWidth / 2,
        buttonY - confirmTextHeight / 2,
        confirmTextWidth,
        confirmTextHeight,
      ),
      Phaser.Geom.Rectangle.Contains,
    )
    this.confirmButton.setInteractive({ useHandCursor: true })
    this.confirmButton.on('pointerdown', () => this.confirmSelection())

    // 키보드 입력 (단축키는 제거했지만 기능은 유지)
    this.input.keyboard?.on('keydown-R', () => {
      if (this.maxRerolls - this.rerollCount > 0 && this.rerollButton) {
        this.reroll()
      }
    })

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.selectedAugment) {
        this.confirmSelection()
      }
    })
  }

  private generateChoices() {
    this.choices = generateAugmentChoices(this.currentRarity)
  }

  private createAugmentCards() {
    const width = this.scale.width
    const height = this.scale.height
    const cardWidth = 200
    const cardHeight = 280
    const cardGap = 30
    const startX = width / 2 - (cardWidth * 3 + cardGap * 2) / 2 + cardWidth / 2
    const cardY = height * 0.45 // 카드 위치를 위로 조정 (새로고침 버튼과 간격 확보)

    // 기존 카드 제거
    this.augmentCards.forEach((card) => card.destroy())
    this.augmentCards = []

    // 각 증강 카드 생성
    this.choices.forEach((augment, index) => {
      const cardX = startX + index * (cardWidth + cardGap)
      const card = this.createAugmentCard(cardX, cardY, cardWidth, cardHeight, augment)
      this.augmentCards.push(card)
    })
  }

  private createAugmentCard(
    x: number,
    y: number,
    width: number,
    height: number,
    augment: Augment,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    // 카드 배경 (등급별 색상)
    const rarityColors: Record<AugmentRarity, number> = {
      common: 0x888888, // 회색
      rare: 0x0088ff, // 파란색
      epic: 0x8800ff, // 보라색
      legendary: 0xff8800, // 주황색
    }

    // 카드 배경 (둥근 모서리)
    const cardBgGraphics = this.add.graphics()
    cardBgGraphics.fillStyle(rarityColors[augment.rarity], 0.9)
    cardBgGraphics.fillRoundedRect(-width / 2, -height / 2, width, height, 16)
    cardBgGraphics.lineStyle(3, 0xffffff, 1)
    cardBgGraphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 16)
    const cardBg = cardBgGraphics

    // 카드 테두리 (선택 시, 둥근 모서리)
    const cardBorderGraphics = this.add.graphics()
    cardBorderGraphics.lineStyle(4, 0xffff00, 0)
    cardBorderGraphics.strokeRoundedRect(
      -(width + 8) / 2,
      -(height + 8) / 2,
      width + 8,
      height + 8,
      20,
    )
    const cardBorder = cardBorderGraphics

    // 증강 이름
    const nameText = this.add
      .text(0, -height / 2 + 30, augment.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: width - 20 },
      })
      .setOrigin(0.5, 0)

    // 능력치 정보
    const statName = AUGMENT_STAT_NAMES[augment.statType]
    const statText = this.add
      .text(0, -height / 2 + 80, `${statName}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5, 0)

    const valueText = this.add
      .text(0, -height / 2 + 110, `+${augment.statValue}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffff00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)

    // 설명
    if (augment.description) {
      const descText = this.add
        .text(0, height / 2 - 40, augment.description, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: width - 20 },
        })
        .setOrigin(0.5, 1)
      container.add([cardBg, cardBorder, nameText, statText, valueText, descText])
    } else {
      container.add([cardBg, cardBorder, nameText, statText, valueText])
    }

    // 클릭 가능하게 설정 (Container에 interactive 설정)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    )
    container.setInteractive({ useHandCursor: true })
    container.on('pointerdown', () => {
      this.selectAugment(augment)
    })

    // 호버 효과 (선택되지 않은 카드만)
    container.on('pointerover', () => {
      if (this.selectedAugment !== augment) {
        cardBg.setAlpha(0.8)
        container.setScale(1.02) // 약간 확대
      }
    })
    container.on('pointerout', () => {
      if (this.selectedAugment !== augment) {
        cardBg.setAlpha(1)
        container.setScale(1.0) // 원래 크기
      }
    })

    container.setDepth(1001)
    return container
  }

  private selectAugment(augment: Augment) {
    // 이미 선택된 카드를 다시 클릭하면 선택 해제
    if (this.selectedAugment === augment) {
      this.selectedAugment = null
      this.updateCardSelection()
      if (this.confirmButton && this.confirmButtonBg) {
        const textWidth = this.confirmButton.width + 32
        const textHeight = this.confirmButton.height + 20
        this.confirmButtonBg.clear()
        this.confirmButtonBg.fillStyle(0x666666, 1)
        this.confirmButtonBg.fillRoundedRect(
          this.confirmButton.x - textWidth / 2,
          this.confirmButton.y - textHeight / 2,
          textWidth,
          textHeight,
          12,
        )
      }
      return
    }

    // 새 카드 선택
    this.selectedAugment = augment
    this.updateCardSelection()

    // 확인 버튼 활성화
    if (this.confirmButton && this.confirmButtonBg) {
      const textWidth = this.confirmButton.width + 32
      const textHeight = this.confirmButton.height + 20
      this.confirmButtonBg.clear()
      this.confirmButtonBg.fillStyle(0x00aa00, 1)
      this.confirmButtonBg.fillRoundedRect(
        this.confirmButton.x - textWidth / 2,
        this.confirmButton.y - textHeight / 2,
        textWidth,
        textHeight,
        12,
      )
    }
  }

  // 카드 선택 상태 업데이트 (시각적 피드백)
  private updateCardSelection() {
    this.augmentCards.forEach((card, index) => {
      const cardBg = card.list[0] as Phaser.GameObjects.Graphics
      const border = card.list[1] as Phaser.GameObjects.Graphics
      const isSelected = this.selectedAugment === this.choices[index]

      if (isSelected) {
        // 선택된 카드: 노란색 테두리, 밝은 배경, 약간 확대
        border.setAlpha(1)
        border.clear()
        border.lineStyle(6, 0xffff00, 1) // 더 두꺼운 테두리
        const cardWidth = 200
        const cardHeight = 280
        border.strokeRoundedRect(
          -(cardWidth + 8) / 2,
          -(cardHeight + 8) / 2,
          cardWidth + 8,
          cardHeight + 8,
          20,
        )
        cardBg.setAlpha(1.0) // 최대 밝기
        card.setScale(1.05) // 약간 확대
        card.setDepth(1002) // 다른 카드보다 위에
      } else {
        // 선택되지 않은 카드: 테두리 숨김, 약간 어둡게
        border.setAlpha(0)
        cardBg.setAlpha(0.7) // 어둡게 (선택되지 않은 것 강조)
        card.setScale(1.0) // 원래 크기
        card.setDepth(1001) // 원래 depth
      }
    })
  }

  private reroll() {
    if (this.rerollCount >= this.maxRerolls) return

    this.rerollCount++
    this.generateChoices()
    this.createAugmentCards()
    this.selectedAugment = null
    this.updateCardSelection() // 카드 상태 초기화

    // 리롤 버튼 업데이트
    const remainingRerolls = this.maxRerolls - this.rerollCount
    if (remainingRerolls > 0 && this.rerollButton && this.rerollButtonBg) {
      this.rerollButton.setText(`새로고침 (${remainingRerolls})`)
      // 배경 크기 재조정
      const textWidth = this.rerollButton.width + 32
      const textHeight = this.rerollButton.height + 20
      this.rerollButtonBg.clear()
      this.rerollButtonBg.fillStyle(0x333333, 1)
      this.rerollButtonBg.fillRoundedRect(
        this.rerollButton.x - textWidth / 2,
        this.rerollButton.y - textHeight / 2,
        textWidth,
        textHeight,
        12,
      )
    } else if (this.rerollButton && this.rerollButtonBg) {
      // 리롤 횟수 소진 시 버튼 숨기기
      this.rerollButton.setVisible(false)
      this.rerollButtonBg.setVisible(false)
      this.rerollButtonBg.disableInteractive()

      // 선택하기 버튼 위치 조정 (새로고침 버튼이 없어지면 중앙으로)
      if (this.confirmButton && this.confirmButtonBg) {
        this.confirmButton.setX(this.scale.width / 2)
        const textWidth = this.confirmButton.width + 32
        const textHeight = this.confirmButton.height + 20
        this.confirmButtonBg.clear()
        this.confirmButtonBg.fillStyle(this.selectedAugment ? 0x00aa00 : 0x666666, 1)
        this.confirmButtonBg.fillRoundedRect(
          this.confirmButton.x - textWidth / 2,
          this.confirmButton.y - textHeight / 2,
          textWidth,
          textHeight,
          12,
        )
      }
    }

    // 확인 버튼 비활성화
    if (this.confirmButton && this.confirmButtonBg) {
      const textWidth = this.confirmButton.width + 32
      const textHeight = this.confirmButton.height + 20
      this.confirmButtonBg.clear()
      this.confirmButtonBg.fillStyle(0x666666, 1)
      this.confirmButtonBg.fillRoundedRect(
        this.confirmButton.x - textWidth / 2,
        this.confirmButton.y - textHeight / 2,
        textWidth,
        textHeight,
        12,
      )
    }
  }

  private confirmSelection() {
    if (!this.selectedAugment) return

    if (this.onSelectCallback) {
      this.onSelectCallback(this.selectedAugment)
    }

    // Scene 종료
    this.scene.stop()
  }

  shutdown() {
    // 키보드 이벤트 정리
    this.input.keyboard?.off('keydown-R')
    this.input.keyboard?.off('keydown-ENTER')

    // 콜백 호출 (취소)
    if (!this.selectedAugment && this.onCancelCallback) {
      this.onCancelCallback()
    }
  }
}
