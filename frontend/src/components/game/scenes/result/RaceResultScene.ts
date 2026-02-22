import Phaser from 'phaser'
import i18next from 'i18next'
import type { Augment, AugmentRarity } from '../../../../engine/race'
import { AUGMENT_STAT_NAMES, SPECIAL_ABILITY_NAMES } from '../../../../engine/race'
import { createRoundedButton, type RoundedButtonController } from '../../ui/createRoundedButton'

/**
 * 라운드 종료 후 순위를 보여주는 오버레이 씬
 * RaceScene 위에 launch되어 결과를 보여주고, 버튼 클릭 후 다음 흐름으로 넘긴다.
 */
export default class RaceResultScene extends Phaser.Scene {
  private onCloseCallback?: () => void
  private onNextSetCallback?: () => void
  private onFinalResultCallback?: () => void
  private playerHorseIndex: number = 0
  private playerCount: number = 8
  private currentSet: number = 1
  private totalRounds: number = 3
  private rankings: Array<{
    rank: number
    name: string
    time: number
    finished: boolean
    augments?: Augment[]
    horseIndex?: number // 플레이어 말 강조 표시용 원래 말 인덱스
  }> = []

  /** 결과표 전체 컨테이너. 버튼 클릭 후 페이드 아웃할 때 같이 숨긴다. */
  private resultContainer?: Phaser.GameObjects.Container
  private readyButton?: RoundedButtonController
  private finalResultButton?: RoundedButtonController

  private shouldShowReadyButton(): boolean {
    return this.currentSet < this.totalRounds
  }

  private addResultButtonContainer(button: RoundedButtonController, delay: number = 800) {
    if (!this.resultContainer) return

    button.container.setAlpha(0)
    this.resultContainer.add(button.container)
    this.tweens.add({
      targets: button.container,
      alpha: 1,
      duration: 400,
      delay,
      ease: 'Power2',
    })
  }

  private handleReadyButtonClick() {
    this.showWaitingButton()
  }

  private handleFinalResultButtonClick() {
    if (this.onFinalResultCallback) {
      this.onFinalResultCallback()
      return
    }
    this.closeScene()
  }

  // 증강 등급 배지 색상
  private static readonly RARITY_COLORS: Record<AugmentRarity, string> = {
    common: '#9e9e9e',
    rare: '#2196f3',
    epic: '#9c27b0',
    legendary: '#ffd700',
    hidden: '#ff9800',
  }

  // 1~3등 메달색
  private static readonly MEDAL_COLORS: Record<number, number> = {
    1: 0xffd700, // 금
    2: 0xc0c0c0, // 은
    3: 0xcd7f32, // 동
  }

  constructor() {
    super({ key: 'RaceResultScene' })
    // 게임 시작 시점 언어를 사용한다. (게임 중 언어 변경은 여기서 따로 반영 안 함)
  }

  init(data?: {
    rankings?: Array<{
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: Augment[]
      horseIndex?: number
    }>
    playerHorseIndex?: number
    playerCount?: number
    currentSet?: number
    totalRounds?: number
    onClose?: () => void
    onNextSet?: () => void
    onFinalResult?: () => void
  }) {
    this.rankings = data?.rankings || []
    this.playerHorseIndex = data?.playerHorseIndex ?? 0
    this.playerCount = data?.playerCount ?? 8
    this.currentSet = data?.currentSet ?? 1
    this.totalRounds = data?.totalRounds ?? 3
    this.onCloseCallback = data?.onClose
    this.onNextSetCallback = data?.onNextSet
    this.onFinalResultCallback = data?.onFinalResult
  }

  create(data?: {
    rankings?: Array<{
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: Augment[]
      horseIndex?: number
    }>
    playerHorseIndex?: number
    playerCount?: number
    currentSet?: number
    totalRounds?: number
    onClose?: () => void
    onNextSet?: () => void
    onFinalResult?: () => void
  }) {
    if (data) {
      this.rankings = data.rankings || this.rankings
      this.playerHorseIndex = data.playerHorseIndex ?? this.playerHorseIndex
      this.playerCount = data.playerCount ?? this.playerCount
      this.currentSet = data.currentSet ?? this.currentSet
      this.totalRounds = data.totalRounds ?? this.totalRounds
      this.onCloseCallback = data.onClose || this.onCloseCallback
      this.onNextSetCallback = data.onNextSet || this.onNextSetCallback
      this.onFinalResultCallback = data.onFinalResult || this.onFinalResultCallback
    }

    this.cameras.main.roundPixels = true

    const width = this.scale.width
    const height = this.scale.height

    this.resultContainer = this.add.container(0, 0).setDepth(2000)
    this.resultContainer.add(
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92).setInteractive(),
    )

    this.createRankingCards(width, height)

    if (this.shouldShowReadyButton()) {
      this.createReadyButton(width, height)
    } else {
      this.createFinalResultButton(width, height)
    }
  }

  private closeScene() {
    this.onCloseCallback?.()
    this.scene.stop()
  }

  /**
   * 순위 카드 생성 (현대적인 디자인)
   */
  private createRankingCards(width: number, height: number) {
    const cardWidth = Math.min(width * 0.9, 800)
    const cardHeight = 55
    const cardGap = 5

    // 실제 참가자 수만큼만 표시
    const resultsToShow = this.rankings.slice(0, this.playerCount)

    // 전체 카드 높이 계산
    const totalHeight = resultsToShow.length * cardHeight + (resultsToShow.length - 1) * cardGap

    // 하단 버튼 공간을 남기고 중앙 배치
    const startY = height / 2 - totalHeight / 2 - 20

    resultsToShow.forEach((result, index) => {
      const cardY = startY + index * (cardHeight + cardGap)
      const delay = 150 + index * 70

      this.createRankCard(
        result,
        width / 2,
        cardY,
        cardWidth,
        cardHeight,
        delay,
        this.resultContainer!,
      )
    })
  }

  private isPlayerHorseResult(result: (typeof this.rankings)[number]): boolean {
    return result.horseIndex !== undefined && result.horseIndex === this.playerHorseIndex
  }

  private createRankCardBackground(
    cardContainer: Phaser.GameObjects.Container,
    cardWidth: number,
    cardHeight: number,
    result: (typeof this.rankings)[number],
    isPlayerHorse: boolean,
  ) {
    const medalColor = RaceResultScene.MEDAL_COLORS[result.rank]
    const bgColor = isPlayerHorse ? 0x2a2a3e : 0x1a1a2e
    const borderColor = isPlayerHorse ? 0xffd700 : medalColor || 0x666666
    const borderWidth = isPlayerHorse ? 4 : 2

    const cardBg = this.add.graphics()
    cardBg.fillStyle(bgColor, 0.95)
    cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    cardBg.lineStyle(borderWidth, borderColor, 1)
    cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    cardContainer.add(cardBg)
  }

  private getRankBadgeText(rank: number): string {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `${rank}`
  }

  private getResultDisplayName(result: (typeof this.rankings)[number]): string {
    return (
      result.name ||
      (result.horseIndex !== undefined ? `Horse_${result.horseIndex + 1}` : 'Unknown')
    )
  }

  private addRankBadgeText(
    cardContainer: Phaser.GameObjects.Container,
    result: (typeof this.rankings)[number],
    cardWidth: number,
  ) {
    const rankText = this.getRankBadgeText(result.rank)
    const rank = this.add
      .text(-cardWidth / 2 + 35, 0, rankText, {
        fontFamily: 'NeoDunggeunmo',
        fontSize: result.rank <= 3 ? '30px' : '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    cardContainer.add(rank)
  }

  private addNameText(
    cardContainer: Phaser.GameObjects.Container,
    result: (typeof this.rankings)[number],
    cardWidth: number,
    isPlayerHorse: boolean,
  ) {
    const nameSuffix = isPlayerHorse ? ' (나)' : ''
    const displayName = this.getResultDisplayName(result)
    const name = this.add
      .text(-cardWidth / 2 + 120, 0, `${displayName}${nameSuffix}`, {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '17px',
        color: isPlayerHorse ? '#ffd700' : '#ffffff',
        fontStyle: isPlayerHorse ? 'bold' : 'normal',
      })
      .setOrigin(0, 0.5)
    cardContainer.add(name)
  }

  private addTimeText(
    cardContainer: Phaser.GameObjects.Container,
    result: (typeof this.rankings)[number],
    cardWidth: number,
  ) {
    const timeText = result.finished
      ? i18next.t('game.raceTime', { time: result.time.toFixed(3) })
      : i18next.t('game.dnf')
    const time = this.add
      .text(-cardWidth / 2 + 350, 0, timeText, {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '16px',
        color: result.finished ? '#ffffff' : '#888888',
        fontStyle: 'normal',
      })
      .setOrigin(0, 0.5)
    cardContainer.add(time)
  }

  private buildAugmentSummaryItems(augments: Augment[]): Array<{ text: string; color: string }> {
    const augmentTexts: Array<{ text: string; color: string }> = []

    augments.forEach((aug) => {
      let text = ''
      const color = RaceResultScene.RARITY_COLORS[aug.rarity]

      if (aug.specialAbility) {
        const abilityName = SPECIAL_ABILITY_NAMES[aug.specialAbility]
        const value = aug.specialAbilityValue ? ` +${aug.specialAbilityValue}` : ''
        text = `${abilityName}${value}`
      } else if (aug.statType && aug.statValue != null) {
        const statName = AUGMENT_STAT_NAMES[aug.statType]
        text = `${statName} +${aug.statValue}`
      }

      if (text) {
        augmentTexts.push({ text, color })
      }
    })

    return augmentTexts
  }

  private addNoAugmentText(cardContainer: Phaser.GameObjects.Container, cardWidth: number) {
    const noAugmentText = this.add
      .text(cardWidth / 2 - 20, 0, i18next.t('game.noAugment'), {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(1, 0.5)
    cardContainer.add(noAugmentText)
  }

  private addAugmentSummaryTexts(
    cardContainer: Phaser.GameObjects.Container,
    augments: Augment[],
    cardWidth: number,
  ) {
    if (augments.length === 0) {
      this.addNoAugmentText(cardContainer, cardWidth)
      return
    }

    const augmentTexts = this.buildAugmentSummaryItems(augments)
    const fontSize = augments.length > 3 ? '12px' : '14px'
    let cursorX = cardWidth / 2 - 20

    for (let i = augmentTexts.length - 1; i >= 0; i--) {
      const item = augmentTexts[i]
      const itemText = this.add
        .text(cursorX, 0, item.text, {
          fontFamily: 'NeoDunggeunmo',
          fontSize,
          color: item.color,
        })
        .setOrigin(1, 0.5)
      cardContainer.add(itemText)
      cursorX -= itemText.width

      if (i <= 0) continue

      const separator = this.add
        .text(cursorX, 0, ', ', {
          fontFamily: 'NeoDunggeunmo',
          fontSize,
          color: '#ffffff',
        })
        .setOrigin(1, 0.5)
      cardContainer.add(separator)
      cursorX -= separator.width
    }
  }

  private animateRankCardEntrance(
    cardContainer: Phaser.GameObjects.Container,
    y: number,
    delay: number,
  ) {
    this.tweens.add({
      targets: cardContainer,
      alpha: 1,
      y,
      duration: 400,
      delay,
      ease: 'Back.easeOut',
    })
  }

  /**
   * 개별 순위 카드 생성
   */
  private createRankCard(
    result: {
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: Augment[]
      horseIndex?: number
    },
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    delay: number,
    parent: Phaser.GameObjects.Container,
  ) {
    const isPlayerHorse = this.isPlayerHorseResult(result)

    const cardContainer = this.add.container(x, y).setAlpha(0)
    this.createRankCardBackground(cardContainer, cardWidth, cardHeight, result, isPlayerHorse)
    this.addRankBadgeText(cardContainer, result, cardWidth)
    this.addNameText(cardContainer, result, cardWidth, isPlayerHorse)
    this.addTimeText(cardContainer, result, cardWidth)
    this.addAugmentSummaryTexts(cardContainer, result.augments || [], cardWidth)

    parent.add(cardContainer)
    this.animateRankCardEntrance(cardContainer, y, delay)
  }

  /**
   * 준비 버튼 생성 (다음 세트가 있을 때)
   */
  private createReadyButton(width: number, height: number) {
    const buttonY = height * 0.85
    const buttonWidth = 200
    const buttonHeight = 45

    this.readyButton = createRoundedButton(this, {
      x: width / 2,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      radius: 12,
      color: 0x4caf50,
      hoverColor: 0x45a049,
      label: i18next.t('game.ready'),
      fontSize: '20px',
      onClick: () => this.handleReadyButtonClick(),
      scaleOnHover: true,
    })

    this.readyButton.text.setColor('#ffffff')
    this.addResultButtonContainer(this.readyButton)
  }

  /**
   * 버튼 클릭 시: 대기 오버레이를 먼저 띄운 뒤 결과표 페이드 아웃 → 3초 후 증강 룰렛.
   * 오버레이를 나중에 띄우면 페이드 종료~오버레이 표시 사이 한 프레임에 RaceScene이 비쳐 깜빡이므로, 먼저 띄움.
   */
  private showWaitingButton() {
    const container = this.resultContainer
    if (this.readyButton) {
      this.readyButton.setEnabled(false)
    }

    if (!container) {
      this.startNextSet()
      return
    }

    this.tweens.add({
      targets: container,
      alpha: 0,
      duration: 280,
      ease: 'Power2.In',
      onComplete: () => this.startNextSet(),
    })
  }

  /**
   * 다음 세트 시작
   */
  private startNextSet() {
    this.onNextSetCallback?.()
    this.scene.stop()
  }

  /**
   * 최종 결과 보기 버튼 생성 (마지막 세트일 때)
   */
  private createFinalResultButton(width: number, height: number) {
    const buttonY = height * 0.85
    const buttonWidth = 240
    const buttonHeight = 45

    this.finalResultButton = createRoundedButton(this, {
      x: width / 2,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      radius: 12,
      color: 0xffd700,
      hoverColor: 0xffc107,
      label: i18next.t('game.viewFinalResult'),
      textColor: '#000000',
      fontSize: '20px',
      onClick: () => this.handleFinalResultButtonClick(),
      scaleOnHover: true,
    })
    this.finalResultButton.container.setDepth(2001)
    this.addResultButtonContainer(this.finalResultButton)
  }
}
