import Phaser from 'phaser'
import type { Augment, AugmentRarity } from '../../../engine/race'
import { AUGMENT_STAT_NAMES, SPECIAL_ABILITY_NAMES } from '../../../engine/race'

/**
 * 레이스 결과 Scene
 * RaceScene 위에 오버레이로 표시됨
 * 현대적이고 fancy한 카드 스타일 UI
 */
export default class RaceResultScene extends Phaser.Scene {
  private onCloseCallback?: () => void
  private onNextSetCallback?: () => void
  private playerHorseIndex: number = 0
  private playerCount: number = 8 // 플레이어 수
  private currentSet: number = 1 // 현재 세트
  private totalSets: number = 3 // 전체 세트 수
  private rankings: Array<{
    rank: number
    name: string
    time: number
    finished: boolean
    augments?: Augment[]
  }> = []

  // 등급별 색상
  private static readonly RARITY_COLORS: Record<AugmentRarity, string> = {
    common: '#9e9e9e',
    rare: '#2196f3',
    epic: '#9c27b0',
    legendary: '#ffd700',
    hidden: '#ff9800',
  }

  // 순위별 메달 색상
  private static readonly MEDAL_COLORS: Record<number, number> = {
    1: 0xffd700, // 금
    2: 0xc0c0c0, // 은
    3: 0xcd7f32, // 동
  }

  constructor() {
    super({ key: 'RaceResultScene' })
  }

  init(data?: {
    rankings?: Array<{
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: Augment[]
    }>
    playerHorseIndex?: number
    playerCount?: number
    currentSet?: number
    totalSets?: number
    onClose?: () => void
    onNextSet?: () => void
  }) {
    this.rankings = data?.rankings || []
    this.playerHorseIndex = data?.playerHorseIndex ?? 0
    this.playerCount = data?.playerCount ?? 8
    this.currentSet = data?.currentSet ?? 1
    this.totalSets = data?.totalSets ?? 3
    this.onCloseCallback = data?.onClose
    this.onNextSetCallback = data?.onNextSet
  }

  create(data?: {
    rankings?: Array<{
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: Augment[]
    }>
    playerHorseIndex?: number
    playerCount?: number
    currentSet?: number
    totalSets?: number
    onClose?: () => void
    onNextSet?: () => void
  }) {
    if (data) {
      this.rankings = data.rankings || this.rankings
      this.playerHorseIndex = data.playerHorseIndex ?? this.playerHorseIndex
      this.playerCount = data.playerCount ?? this.playerCount
      this.currentSet = data.currentSet ?? this.currentSet
      this.totalSets = data.totalSets ?? this.totalSets
      this.onCloseCallback = data.onClose || this.onCloseCallback
      this.onNextSetCallback = data.onNextSet || this.onNextSetCallback
    }

    this.cameras.main.roundPixels = true

    const width = this.scale.width
    const height = this.scale.height

    // 어두운 배경 오버레이 (즉시 표시)
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
      .setDepth(2000)
      .setInteractive()

    // 순위 카드 생성
    this.createRankingCards(width, height)

    // 버튼 생성 (세트 상태에 따라)
    if (this.currentSet < this.totalSets) {
      // 남은 세트가 있으면 준비 버튼
      this.createReadyButton(width, height)
    } else {
      // 최종 세트면 최종 결과 보기 버튼
      this.createFinalResultButton(width, height)
    }
  }

  private closeScene() {
    if (this.onCloseCallback) {
      this.onCloseCallback()
    }
    this.scene.stop()
  }

  /**
   * 순위 카드 생성 (현대적인 디자인)
   */
  private createRankingCards(width: number, height: number) {
    const cardWidth = Math.min(width * 0.9, 800)
    const cardHeight = 55
    const cardGap = 5

    // 플레이어 수만큼만 결과 표시
    const resultsToShow = this.rankings.slice(0, this.playerCount)

    // 전체 카드 높이 계산
    const totalHeight = resultsToShow.length * cardHeight + (resultsToShow.length - 1) * cardGap

    // 중앙 정렬 (버튼 공간 고려하여 약간 위로)
    const startY = height / 2 - totalHeight / 2 - 20

    resultsToShow.forEach((result, index) => {
      const cardY = startY + index * (cardHeight + cardGap)
      const delay = 150 + index * 70

      this.createRankCard(result, width / 2, cardY, cardWidth, cardHeight, delay)
    })
  }

  /**
   * 개별 순위 카드 생성
   */
  private createRankCard(
    result: { rank: number; name: string; time: number; finished: boolean; augments?: Augment[] },
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    delay: number,
  ) {
    const playerNumber = result.name.replace('Horse_', '')
    const isPlayerHorse = parseInt(playerNumber) === this.playerHorseIndex + 1
    const medalColor = RaceResultScene.MEDAL_COLORS[result.rank]

    // 카드 컨테이너
    const cardContainer = this.add.container(x, y).setDepth(2001).setAlpha(0)

    // 카드 배경 (플레이어 말은 금색 테두리, 나머지는 일반)
    const bgColor = isPlayerHorse ? 0x2a2a3e : 0x1a1a2e
    const borderColor = isPlayerHorse ? 0xffd700 : medalColor || 0x666666
    const borderWidth = isPlayerHorse ? 4 : 2

    const cardBg = this.add.graphics()
    cardBg.fillStyle(bgColor, 0.95)
    cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    cardBg.lineStyle(borderWidth, borderColor, 1)
    cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    cardContainer.add(cardBg)

    // 순위 (메달 이모지 또는 숫자)
    let rankText = `${result.rank}`
    if (result.rank === 1) rankText = '🥇'
    else if (result.rank === 2) rankText = '🥈'
    else if (result.rank === 3) rankText = '🥉'

    const rank = this.add
      .text(-cardWidth / 2 + 35, 0, rankText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: result.rank <= 3 ? '30px' : '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    cardContainer.add(rank)

    // 이름 (플레이어는 왕관 이모지)
    const namePrefix = isPlayerHorse ? '👑 ' : ''
    const nameSuffix = isPlayerHorse ? ' (나)' : ''
    const name = this.add
      .text(-cardWidth / 2 + 120, 0, `${namePrefix}플레이어 ${playerNumber}${nameSuffix}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        color: isPlayerHorse ? '#ffd700' : '#ffffff',
        fontStyle: isPlayerHorse ? 'bold' : 'normal',
      })
      .setOrigin(0, 0.5)
    cardContainer.add(name)

    // 기록
    const timeText = result.finished ? `⏱️ ${result.time.toFixed(3)}초` : '❌ 미완주'
    const time = this.add
      .text(-cardWidth / 2 + 350, 0, timeText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: result.finished ? '#ffffff' : '#888888',
        fontStyle: 'normal',
      })
      .setOrigin(0, 0.5)
    cardContainer.add(time)

    // 증강 표시 (등급 색상 + 이름 + 수치)
    const augments = result.augments || []

    if (augments.length === 0) {
      const noAugmentText = this.add
        .text(cardWidth / 2 - 20, 0, '증강 없음', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#888888',
        })
        .setOrigin(1, 0.5)
      cardContainer.add(noAugmentText)
    } else {
      // 최대 2개 표시 + 더보기
      const augmentsToShow = augments.slice(0, 2)
      const augmentTexts: Array<{ text: string; color: string }> = []

      augmentsToShow.forEach((aug) => {
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

      // 텍스트 생성 (콤마로 구분)
      const fullText =
        augmentTexts.map((item) => item.text).join(', ') +
        (augments.length > 2 ? ` +${augments.length - 2}` : '')

      // 가장 높은 등급의 색상 사용
      const highestRarityColor = augmentTexts[0]?.color || '#ffffff'

      const augmentDisplay = this.add
        .text(cardWidth / 2 - 20, 0, fullText, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: highestRarityColor,
        })
        .setOrigin(1, 0.5)
      cardContainer.add(augmentDisplay)
    }

    // 등장 애니메이션
    this.tweens.add({
      targets: cardContainer,
      alpha: 1,
      y: y,
      duration: 400,
      delay: delay,
      ease: 'Back.easeOut',
    })
  }

  /**
   * 준비 버튼 생성 (다음 세트가 있을 때)
   */
  private createReadyButton(width: number, height: number) {
    const buttonY = height * 0.85
    const buttonWidth = 200
    const buttonHeight = 45

    const buttonContainer = this.add
      .container(width / 2, buttonY)
      .setDepth(2001)
      .setAlpha(0)

    // 버튼 배경
    const buttonBg = this.add.graphics()
    buttonBg.fillStyle(0x4caf50, 1)
    buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)
    buttonContainer.add(buttonBg)

    // 버튼 텍스트
    const buttonText = this.add
      .text(0, 0, '준비', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    buttonContainer.add(buttonText)

    // 인터랙티브 영역
    const hitArea = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    buttonContainer.add(hitArea)

    // hover 효과
    hitArea.on('pointerover', () => {
      buttonBg.clear()
      buttonBg.fillStyle(0x45a049, 1)
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)
      this.tweens.add({
        targets: buttonContainer,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      })
    })

    hitArea.on('pointerout', () => {
      buttonBg.clear()
      buttonBg.fillStyle(0x4caf50, 1)
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)
      this.tweens.add({
        targets: buttonContainer,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      })
    })

    hitArea.on('pointerdown', () => {
      // 준비 버튼 클릭 -> 대기 중 버튼으로 변경
      this.showWaitingButton(buttonContainer, buttonBg, buttonText, buttonWidth, buttonHeight)
    })

    // 버튼 등장 애니메이션
    this.tweens.add({
      targets: buttonContainer,
      alpha: 1,
      duration: 400,
      delay: 800,
      ease: 'Power2',
    })
  }

  /**
   * 대기 중 버튼으로 변경 (다른 플레이어 대기)
   */
  private showWaitingButton(
    buttonContainer: Phaser.GameObjects.Container,
    buttonBg: Phaser.GameObjects.Graphics,
    buttonText: Phaser.GameObjects.Text,
    buttonWidth: number,
    buttonHeight: number,
  ) {
    // 버튼 비활성화
    const hitArea = buttonContainer.getAt(2) as Phaser.GameObjects.Rectangle
    hitArea.disableInteractive()

    // 버튼 스타일 변경 (회색)
    buttonBg.clear()
    buttonBg.fillStyle(0x666666, 1)
    buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)

    // 플레이어 카운트 (개발 단계: 0.5초마다 1씩 증가)
    let readyCount = 1
    buttonText.setText(`대기 중 (${readyCount}/${this.playerCount})`)

    const interval = setInterval(() => {
      readyCount++
      buttonText.setText(`대기 중 (${readyCount}/${this.playerCount})`)

      if (readyCount >= this.playerCount) {
        clearInterval(interval)
        // 모든 플레이어가 준비되면 다음 세트 시작
        this.time.delayedCall(500, () => {
          this.startNextSet()
        })
      }
    }, 500)
  }

  /**
   * 다음 세트 시작
   */
  private startNextSet() {
    if (this.onNextSetCallback) {
      this.onNextSetCallback()
    }
    this.scene.stop()
  }

  /**
   * 최종 결과 보기 버튼 생성 (마지막 세트일 때)
   */
  private createFinalResultButton(width: number, height: number) {
    const buttonY = height * 0.85
    const buttonWidth = 240
    const buttonHeight = 45

    const buttonContainer = this.add
      .container(width / 2, buttonY)
      .setDepth(2001)
      .setAlpha(0)

    // 버튼 배경
    const buttonBg = this.add.graphics()
    buttonBg.fillStyle(0xffd700, 1) // 금색
    buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)
    buttonContainer.add(buttonBg)

    // 버튼 텍스트
    const buttonText = this.add
      .text(0, 0, '최종 결과 보기', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#000000',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    buttonContainer.add(buttonText)

    // 인터랙티브 영역
    const hitArea = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    buttonContainer.add(hitArea)

    // hover 효과
    hitArea.on('pointerover', () => {
      buttonBg.clear()
      buttonBg.fillStyle(0xffc107, 1) // 어두운 금색
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)
      this.tweens.add({
        targets: buttonContainer,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      })
    })

    hitArea.on('pointerout', () => {
      buttonBg.clear()
      buttonBg.fillStyle(0xffd700, 1)
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12)
      this.tweens.add({
        targets: buttonContainer,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      })
    })

    hitArea.on('pointerdown', () => {
      // TODO: 최종 결과 화면 구현
      this.closeScene()
    })

    // 버튼 등장 애니메이션
    this.tweens.add({
      targets: buttonContainer,
      alpha: 1,
      duration: 400,
      delay: 800,
      ease: 'Power2',
    })
  }
}
