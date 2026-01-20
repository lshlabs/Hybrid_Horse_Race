import Phaser from 'phaser'
import type {
  Augment,
  AugmentRarity,
  AugmentStatType,
  SpecialAbilityType,
} from '../../../engine/race'
import {
  AUGMENT_RARITY_NAMES,
  AUGMENT_STAT_NAMES,
  SPECIAL_ABILITY_NAMES,
  createAugment,
  createLastSpurtAugment,
  createOvertakeAugment,
  createEscapeCrisisAugment,
} from '../../../engine/race'

/**
 * 개발용 증강 선택 패널
 * 개발/테스트 시 특정 증강을 직접 선택할 수 있도록 함
 */
export default class AugmentDevPanel {
  private scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private isVisible = false

  // 콜백
  private onAugmentGenerated?: (augments: Augment[]) => void

  // 선택 상태
  private selectedRarity: AugmentRarity = 'common'
  private selectedStatType?: AugmentStatType
  private selectedSpecialAbility?: SpecialAbilityType
  private selectedStatValue: number = 1
  private selectedAbilityValue: number = 6

  // UI 요소
  private rarityButtons: Phaser.GameObjects.Container[] = []
  private statTypeButtons: Phaser.GameObjects.Container[] = []
  private specialAbilityButtons: Phaser.GameObjects.Container[] = []
  private generateButton?: Phaser.GameObjects.Container
  private closeButton?: Phaser.GameObjects.Container
  private valueText?: Phaser.GameObjects.Text
  private valueSectionContainer?: Phaser.GameObjects.Container

  // 색상 상수
  private static readonly RARITY_COLORS: Record<AugmentRarity, number> = {
    common: 0x9e9e9e,
    rare: 0x2196f3,
    epic: 0x9c27b0,
    legendary: 0xffd700,
    hidden: 0xff9800,
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * 패널 표시
   */
  show(onAugmentGenerated: (augments: Augment[]) => void) {
    if (this.isVisible) return
    this.isVisible = true
    this.onAugmentGenerated = onAugmentGenerated
    this.createPanel()
  }

  /**
   * 패널 숨기기
   */
  hide() {
    if (!this.isVisible) return
    this.isVisible = false
    if (this.container) {
      this.container.destroy()
      this.container = undefined
    }
    this.clearUI()
  }

  /**
   * 패널 생성
   */
  private createPanel() {
    const width = this.scene.scale.width
    const height = this.scene.scale.height

    this.container = this.scene.add.container(0, 0).setDepth(10000)

    // 배경 오버레이
    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setInteractive()
    this.container.add(overlay)

    // 패널 배경
    const panelWidth = 600
    const panelHeight = 700
    const panelBg = this.scene.add
      .graphics()
      .fillStyle(0x1a1a2e, 0.95)
      .fillRoundedRect(
        width / 2 - panelWidth / 2,
        height / 2 - panelHeight / 2,
        panelWidth,
        panelHeight,
        16,
      )
      .lineStyle(3, 0x6366f1, 1)
      .strokeRoundedRect(
        width / 2 - panelWidth / 2,
        height / 2 - panelHeight / 2,
        panelWidth,
        panelHeight,
        16,
      )
    this.container.add(panelBg)

    // 제목
    const title = this.scene.add
      .text(width / 2, height / 2 - panelHeight / 2 + 30, '개발용 증강 생성', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.container.add(title)

    // 등급 선택
    this.createRaritySection(width / 2, height / 2 - 250)
    // 능력치 선택
    this.createStatTypeSection(width / 2, height / 2 - 100)
    // 특수 능력 선택
    this.createSpecialAbilitySection(width / 2, height / 2 + 50)
    // 수치 선택
    this.createValueSection(width / 2, height / 2 + 200)
    // 생성 버튼
    this.createGenerateButton(width / 2, height / 2 + 280)
    // 닫기 버튼
    this.createCloseButton(width / 2, height / 2 + 330)

    // 페이드 인
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    })

    // ESC 키로 닫기
    this.scene.input.keyboard?.once('keydown-ESC', () => this.hide())
  }

  /**
   * 등급 선택 섹션
   */
  private createRaritySection(x: number, y: number) {
    const label = this.scene.add
      .text(x, y - 30, '등급', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.container!.add(label)

    const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary', 'hidden']
    const buttonWidth = 90
    const buttonHeight = 40
    const gap = 10
    const totalWidth = rarities.length * buttonWidth + (rarities.length - 1) * gap
    const startX = x - totalWidth / 2 + buttonWidth / 2

    rarities.forEach((rarity, index) => {
      const buttonX = startX + index * (buttonWidth + gap)
      const button = this.createRarityButton(
        buttonX,
        y,
        buttonWidth,
        buttonHeight,
        rarity,
        rarity === this.selectedRarity,
      )
      this.container!.add(button)
      this.rarityButtons.push(button)
    })
  }

  /**
   * 등급 버튼 생성
   */
  private createRarityButton(
    x: number,
    y: number,
    width: number,
    height: number,
    rarity: AugmentRarity,
    isSelected: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)
    const color = AugmentDevPanel.RARITY_COLORS[rarity]
    const bgColor = isSelected ? color : 0x333333

    const bg = this.scene.add
      .graphics()
      .fillStyle(bgColor, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 8)
      .lineStyle(2, color, 1)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 8)
    container.add(bg)

    const text = this.scene.add
      .text(0, 0, AUGMENT_RARITY_NAMES[rarity], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.selectRarity(rarity)
      })
    container.add(hitArea)

    return container
  }

  /**
   * 등급 선택
   */
  private selectRarity(rarity: AugmentRarity) {
    this.selectedRarity = rarity
    // 특수 능력은 히든 등급에서만 가능
    if (rarity !== 'hidden') {
      this.selectedSpecialAbility = undefined
    }
    this.updateRarityButtons()
    this.updateStatTypeButtons()
    this.updateSpecialAbilityButtons()
  }

  /**
   * 등급 버튼 업데이트
   */
  private updateRarityButtons() {
    this.rarityButtons.forEach((button, index) => {
      const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary', 'hidden']
      const rarity = rarities[index]
      const isSelected = rarity === this.selectedRarity
      const color = AugmentDevPanel.RARITY_COLORS[rarity]
      const bgColor = isSelected ? color : 0x333333

      const bg = button.list[0] as Phaser.GameObjects.Graphics
      bg.clear()
      bg.fillStyle(bgColor, 1)
      bg.fillRoundedRect(-45, -20, 90, 40, 8)
      bg.lineStyle(2, color, 1)
      bg.strokeRoundedRect(-45, -20, 90, 40, 8)
    })
  }

  /**
   * 능력치 타입 선택 섹션
   */
  private createStatTypeSection(x: number, y: number) {
    const label = this.scene.add
      .text(x, y - 30, '능력치 타입', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.container!.add(label)

    const statTypes: AugmentStatType[] = [
      'Speed',
      'Stamina',
      'Power',
      'Guts',
      'Start',
      'Consistency',
    ]
    const buttonWidth = 80
    const buttonHeight = 35
    const gap = 8
    const cols = 3 // 열 개수
    //const rows = 2 // 행 개수

    statTypes.forEach((statType, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const buttonX =
        x -
        (cols * buttonWidth + (cols - 1) * gap) / 2 +
        col * (buttonWidth + gap) +
        buttonWidth / 2
      const buttonY = y + row * (buttonHeight + gap)

      const button = this.createStatTypeButton(
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        statType,
        this.selectedStatType === statType,
      )
      this.container!.add(button)
      this.statTypeButtons.push(button)
    })

    // 특수 능력 선택 시 능력치 버튼 비활성화
    this.updateStatTypeButtons()
  }

  /**
   * 능력치 타입 버튼 생성
   */
  private createStatTypeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    statType: AugmentStatType,
    isSelected: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)
    const bgColor = isSelected ? 0x4caf50 : 0x333333

    const bg = this.scene.add
      .graphics()
      .fillStyle(bgColor, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 6)
    container.add(bg)

    const text = this.scene.add
      .text(0, 0, AUGMENT_STAT_NAMES[statType], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.selectedSpecialAbility) {
          this.selectStatType(statType)
        }
      })
    container.add(hitArea)

    return container
  }

  /**
   * 능력치 타입 선택
   */
  private selectStatType(statType: AugmentStatType) {
    this.selectedStatType = statType
    this.selectedSpecialAbility = undefined
    this.updateStatTypeButtons()
    this.updateSpecialAbilityButtons()
    this.updateValueText()
  }

  /**
   * 능력치 타입 버튼 업데이트
   */
  private updateStatTypeButtons() {
    const isSpecialAbilitySelected = !!this.selectedSpecialAbility
    this.statTypeButtons.forEach((button, index) => {
      const statTypes: AugmentStatType[] = [
        'Speed',
        'Stamina',
        'Power',
        'Guts',
        'Start',
        'Consistency',
      ]
      const statType = statTypes[index]
      const isSelected = statType === this.selectedStatType && !isSpecialAbilitySelected

      const bg = button.list[0] as Phaser.GameObjects.Graphics
      const text = button.list[1] as Phaser.GameObjects.Text
      const hitArea = button.list[2] as Phaser.GameObjects.Rectangle

      bg.clear()
      bg.fillStyle(isSelected ? 0x4caf50 : isSpecialAbilitySelected ? 0x222222 : 0x333333, 1)
      bg.fillRoundedRect(-40, -17.5, 80, 35, 6)

      text.setAlpha(isSpecialAbilitySelected ? 0.5 : 1)
      if (isSpecialAbilitySelected) {
        hitArea.removeInteractive()
      } else {
        hitArea.setInteractive({ useHandCursor: true })
      }
    })
  }

  /**
   * 특수 능력 선택 섹션
   */
  private createSpecialAbilitySection(x: number, y: number) {
    const label = this.scene.add
      .text(x, y - 30, '특수 능력 (히든 등급만)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.container!.add(label)

    const abilities: SpecialAbilityType[] = ['lastSpurt', 'overtake', 'escapeCrisis']
    const buttonWidth = 150
    const buttonHeight = 40
    const gap = 15

    abilities.forEach((ability, index) => {
      const buttonX =
        x -
        (abilities.length * buttonWidth + (abilities.length - 1) * gap) / 2 +
        index * (buttonWidth + gap) +
        buttonWidth / 2
      const button = this.createSpecialAbilityButton(
        buttonX,
        y,
        buttonWidth,
        buttonHeight,
        ability,
        this.selectedSpecialAbility === ability,
      )
      this.container!.add(button)
      this.specialAbilityButtons.push(button)
    })

    this.updateSpecialAbilityButtons()
  }

  /**
   * 특수 능력 버튼 생성
   */
  private createSpecialAbilityButton(
    x: number,
    y: number,
    width: number,
    height: number,
    ability: SpecialAbilityType,
    isSelected: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)
    const bgColor = isSelected ? 0xff9800 : 0x333333

    const bg = this.scene.add
      .graphics()
      .fillStyle(bgColor, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 8)
    container.add(bg)

    const text = this.scene.add
      .text(0, 0, SPECIAL_ABILITY_NAMES[ability], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.selectedRarity === 'hidden') {
          this.selectSpecialAbility(ability)
        }
      })
    container.add(hitArea)

    return container
  }

  /**
   * 특수 능력 선택
   */
  private selectSpecialAbility(ability: SpecialAbilityType) {
    this.selectedSpecialAbility = ability
    this.selectedStatType = undefined
    this.selectedRarity = 'hidden'
    this.updateRarityButtons()
    this.updateStatTypeButtons()
    this.updateSpecialAbilityButtons()
    this.updateValueText()
  }

  /**
   * 특수 능력 버튼 업데이트
   */
  private updateSpecialAbilityButtons() {
    const isHidden = this.selectedRarity === 'hidden'
    this.specialAbilityButtons.forEach((button, index) => {
      const abilities: SpecialAbilityType[] = ['lastSpurt', 'overtake', 'escapeCrisis']
      const ability = abilities[index]
      const isSelected = ability === this.selectedSpecialAbility

      const bg = button.list[0] as Phaser.GameObjects.Graphics
      const text = button.list[1] as Phaser.GameObjects.Text
      const hitArea = button.list[2] as Phaser.GameObjects.Rectangle

      bg.clear()
      bg.fillStyle(isSelected ? 0xff9800 : isHidden ? 0x333333 : 0x222222, 1)
      bg.fillRoundedRect(-75, -20, 150, 40, 8)

      text.setAlpha(isHidden ? 1 : 0.5)
      if (isHidden) {
        hitArea.setInteractive({ useHandCursor: true })
      } else {
        hitArea.removeInteractive()
      }
    })
  }

  /**
   * 수치 선택 섹션
   */
  private createValueSection(x: number, y: number) {
    const label = this.scene.add
      .text(x, y - 30, '수치', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.container!.add(label)

    this.valueSectionContainer = this.scene.add.container(0, 0)

    // 수치 표시 및 조절 버튼
    this.valueText = this.scene.add
      .text(x, y, `${this.selectedStatType ? this.selectedStatValue : this.selectedAbilityValue}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.valueSectionContainer.add(this.valueText)

    // 감소 버튼
    const decreaseBtnContainer = this.scene.add.container(x - 70, y)
    const decreaseBg = this.scene.add
      .graphics()
      .fillStyle(0x333333, 1)
      .fillRoundedRect(-30, -20, 60, 40, 8)
      .lineStyle(2, 0xffffff, 1)
      .strokeRoundedRect(-30, -20, 60, 40, 8)
    decreaseBtnContainer.add(decreaseBg)

    const decreaseText = this.scene.add
      .text(0, 0, '-', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    decreaseBtnContainer.add(decreaseText)

    const decreaseHitArea = this.scene.add
      .rectangle(0, 0, 60, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.selectedStatType) {
          this.selectedStatValue = Math.max(1, this.selectedStatValue - 1)
        } else if (this.selectedSpecialAbility) {
          this.selectedAbilityValue = Math.max(6, this.selectedAbilityValue - 1)
        }
        this.updateValueText()
      })
    decreaseBtnContainer.add(decreaseHitArea)
    this.valueSectionContainer.add(decreaseBtnContainer)

    // 증가 버튼
    const increaseBtnContainer = this.scene.add.container(x + 130, y)
    const increaseBg = this.scene.add
      .graphics()
      .fillStyle(0x333333, 1)
      .fillRoundedRect(-30, -20, 60, 40, 8)
      .lineStyle(2, 0xffffff, 1)
      .strokeRoundedRect(-30, -20, 60, 40, 8)
    increaseBtnContainer.add(increaseBg)

    const increaseText = this.scene.add
      .text(0, 0, '+', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    increaseBtnContainer.add(increaseText)

    const increaseHitArea = this.scene.add
      .rectangle(0, 0, 60, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.selectedStatType) {
          this.selectedStatValue = Math.min(20, this.selectedStatValue + 1)
        } else if (this.selectedSpecialAbility) {
          this.selectedAbilityValue = Math.min(10, this.selectedAbilityValue + 1)
        }
        this.updateValueText()
      })
    increaseBtnContainer.add(increaseHitArea)
    this.valueSectionContainer.add(increaseBtnContainer)

    this.container!.add(this.valueSectionContainer)
  }

  /**
   * 수치 텍스트 업데이트
   */
  private updateValueText() {
    if (this.valueText) {
      this.valueText.setText(
        `${this.selectedStatType ? this.selectedStatValue : this.selectedAbilityValue}`,
      )
    }
  }

  /**
   * 생성 버튼
   */
  private createGenerateButton(x: number, y: number) {
    const width = 200
    const height = 50

    this.generateButton = this.scene.add.container(x, y)

    const bg = this.scene.add
      .graphics()
      .fillStyle(0x4caf50, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 12)
    this.generateButton.add(bg)

    const text = this.scene.add
      .text(0, 0, '3개 생성', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.generateButton.add(text)

    const hitArea = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.clear()
        bg.fillStyle(0x45a049, 1)
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      })
      .on('pointerout', () => {
        bg.clear()
        bg.fillStyle(0x4caf50, 1)
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      })
      .on('pointerdown', () => {
        this.generateAugments()
      })
    this.generateButton.add(hitArea)

    this.container!.add(this.generateButton)
  }

  /**
   * 닫기 버튼
   */
  private createCloseButton(x: number, y: number) {
    const width = 150
    const height = 40

    this.closeButton = this.scene.add.container(x, y)

    const bg = this.scene.add
      .graphics()
      .fillStyle(0x666666, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 8)
    this.closeButton.add(bg)

    const text = this.scene.add
      .text(0, 0, '닫기', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    this.closeButton.add(text)

    const hitArea = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.clear()
        bg.fillStyle(0x777777, 1)
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
      })
      .on('pointerout', () => {
        bg.clear()
        bg.fillStyle(0x666666, 1)
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
      })
      .on('pointerdown', () => {
        this.hide()
      })
    this.closeButton.add(hitArea)

    this.container!.add(this.closeButton)
  }

  /**
   * 증강 생성
   */
  private generateAugments() {
    const augments: Augment[] = []

    // 선택된 증강 1개 생성
    if (this.selectedSpecialAbility) {
      // 특수 능력 증강
      let augment: Augment
      if (this.selectedSpecialAbility === 'lastSpurt') {
        augment = createLastSpurtAugment()
      } else if (this.selectedSpecialAbility === 'overtake') {
        augment = createOvertakeAugment()
      } else {
        augment = createEscapeCrisisAugment()
      }
      // 수치 오버라이드 (reflect 사용 불가하므로 수동 설정)
      augment.specialAbilityValue = this.selectedAbilityValue
      augments.push(augment)
    } else if (this.selectedStatType) {
      // 일반 증강
      const augment = createAugment(
        this.selectedRarity,
        this.selectedStatType,
        this.selectedStatValue,
      )
      augments.push(augment)
    } else {
      // 아무것도 선택 안 함 - 랜덤 생성
      const augment = createAugment(this.selectedRarity, 'Speed', undefined)
      augments.push(augment)
    }

    // 나머지 2개는 랜덤 생성
    while (augments.length < 3) {
      const statTypes: AugmentStatType[] = [
        'Speed',
        'Stamina',
        'Power',
        'Guts',
        'Start',
        'Consistency',
      ]
      const randomStatType = statTypes[Math.floor(Math.random() * statTypes.length)]
      const augment = createAugment(this.selectedRarity, randomStatType)
      augments.push(augment)
    }

    // 콜백 호출
    if (this.onAugmentGenerated) {
      this.onAugmentGenerated(augments)
    }

    this.hide()
  }

  /**
   * UI 요소 정리
   */
  private clearUI() {
    this.rarityButtons = []
    this.statTypeButtons = []
    this.specialAbilityButtons = []
    this.generateButton = undefined
    this.closeButton = undefined
    this.valueText = undefined
    this.valueSectionContainer = undefined
  }
}
