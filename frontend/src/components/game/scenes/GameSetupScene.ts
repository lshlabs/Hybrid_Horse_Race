import Phaser from 'phaser'

/**
 * 게임 설정 Scene - 개발용
 * 플레이어 수(2~8)와 세트 수(1~3)를 설정하는 UI 제공
 * 추후 제거 예정
 */
export default class GameSetupScene extends Phaser.Scene {
  // 플레이어 수 선택
  private playerCount: number = 8
  private playerCountButtons: Phaser.GameObjects.Container[] = []
  private playerCountText?: Phaser.GameObjects.Text

  // 세트 수 선택
  private setCount: number = 3
  private setCountButtons: Phaser.GameObjects.Container[] = []
  private setCountText?: Phaser.GameObjects.Text

  // 시작 버튼
  private startButton?: Phaser.GameObjects.Container

  // 콜백
  private onCompleteCallback?: (settings: {
    playerCount: number
    setCount: number
    playerHorseIndex: number
  }) => void

  // UI 상수
  private static readonly BUTTON_WIDTH = 60
  private static readonly BUTTON_HEIGHT = 50
  private static readonly BUTTON_RADIUS = 8
  private static readonly SELECTED_COLOR = 0x4caf50
  private static readonly UNSELECTED_COLOR = 0x666666
  private static readonly START_BUTTON_WIDTH = 200
  private static readonly START_BUTTON_HEIGHT = 60

  // UI 간격 상수
  private static readonly SECTION_SPACING = 120 // 섹션 간 간격
  private static readonly LABEL_OFFSET = -40 // 라벨 Y 오프셋 (섹션 기준)
  private static readonly TEXT_OFFSET = 50 // 선택 텍스트 Y 오프셋 (섹션 기준)
  private static readonly BUTTON_SPACING = 10 // 버튼 간 간격
  private static readonly SET_BUTTON_SPACING = 20 // 세트 버튼 간 간격 (더 넓게)

  constructor() {
    super('GameSetupScene')
  }

  init(data?: {
    onComplete?: (settings: {
      playerCount: number
      setCount: number
      playerHorseIndex: number
    }) => void
  }) {
    this.onCompleteCallback = data?.onComplete
  }

  create() {
    const { width, height } = this.scale

    // 반투명 배경 오버레이
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setInteractive()

    // 타이틀
    const title = this.add
      .text(width / 2, height * 0.15, '게임 설정 (개발용)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // 플레이어 수 선택 UI
    this.createPlayerCountSelector(width, height)

    // 세트 수 선택 UI
    this.createSetCountSelector(width, height)

    // 시작 버튼
    this.createStartButton(width, height)

    // 페이드 인 애니메이션 - hitArea는 제외하고 페이드 인 적용
    const uiElements = [
      title,
      ...this.playerCountButtons,
      this.playerCountText,
      ...this.setCountButtons,
      this.setCountText,
      this.startButton,
    ].filter(Boolean)

    uiElements.forEach((element) => {
      if (element) {
        // 컨테이너인 경우 hitArea(인덱스 2)를 제외하고 페이드 인 적용
        if (element instanceof Phaser.GameObjects.Container) {
          // 배경과 텍스트는 페이드 인
          const bg = element.getAt(0) as Phaser.GameObjects.Graphics
          const text = element.getAt(1) as Phaser.GameObjects.Text

          bg?.setAlpha(0) // 배경 (graphics)
          text?.setAlpha(0) // 텍스트

          this.tweens.add({
            targets: [bg, text].filter(Boolean),
            alpha: 1,
            duration: 300,
            delay: Math.random() * 200,
            ease: 'Power2',
          })
        } else {
          // 일반 텍스트 요소
          element.setAlpha(0)
          this.tweens.add({
            targets: element,
            alpha: 1,
            duration: 300,
            delay: Math.random() * 200,
            ease: 'Power2',
          })
        }
      }
    })

    // ESC 키로 취소 (기본 설정으로 진행)
    this.input.keyboard?.on('keydown-ESC', () => this.startGame())
  }

  /**
   * 플레이어 수 선택 UI 생성
   */
  private createPlayerCountSelector(width: number, height: number) {
    const sectionY = height * 0.25
    const labelY = sectionY + GameSetupScene.LABEL_OFFSET

    // 라벨
    this.add
      .text(width / 2, labelY, '플레이어 수 (2~8)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // 버튼들
    const totalWidth =
      (GameSetupScene.BUTTON_WIDTH + GameSetupScene.BUTTON_SPACING) * 7 -
      GameSetupScene.BUTTON_SPACING
    const startX = width / 2 - totalWidth / 2 + GameSetupScene.BUTTON_WIDTH / 2

    for (let i = 2; i <= 8; i++) {
      const buttonX =
        startX + (i - 2) * (GameSetupScene.BUTTON_WIDTH + GameSetupScene.BUTTON_SPACING)
      const button = this.createNumberButton(buttonX, sectionY, i, i === this.playerCount)
      button.setData('playerCount', i)
      this.setupButtonInteraction(button, () => {
        this.selectPlayerCount(i)
      })
      this.playerCountButtons.push(button)
    }

    // 현재 선택된 값 표시
    this.playerCountText = this.add
      .text(width / 2, sectionY + GameSetupScene.TEXT_OFFSET, `선택됨: ${this.playerCount}명`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5)
  }

  /**
   * 세트 수 선택 UI 생성
   */
  private createSetCountSelector(width: number, height: number) {
    const sectionY = height * 0.3 + GameSetupScene.SECTION_SPACING
    const labelY = sectionY + GameSetupScene.LABEL_OFFSET

    // 라벨
    this.add
      .text(width / 2, labelY, '세트 수 (1~3)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // 버튼들
    const totalWidth =
      (GameSetupScene.BUTTON_WIDTH + GameSetupScene.SET_BUTTON_SPACING) * 3 -
      GameSetupScene.SET_BUTTON_SPACING
    const startX = width / 2 - totalWidth / 2 + GameSetupScene.BUTTON_WIDTH / 2

    for (let i = 1; i <= 3; i++) {
      const buttonX =
        startX + (i - 1) * (GameSetupScene.BUTTON_WIDTH + GameSetupScene.SET_BUTTON_SPACING)
      const button = this.createNumberButton(buttonX, sectionY, i, i === this.setCount)
      button.setData('setCount', i)
      this.setupButtonInteraction(button, () => {
        this.selectSetCount(i)
      })
      this.setCountButtons.push(button)
    }

    // 현재 선택된 값 표시
    this.setCountText = this.add
      .text(width / 2, sectionY + GameSetupScene.TEXT_OFFSET, `선택됨: ${this.setCount}세트`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5)
  }

  /**
   * 숫자 선택 버튼 생성
   */
  private createNumberButton(
    x: number,
    y: number,
    number: number,
    isSelected: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    // 배경
    const bg = this.add.graphics()
    const color = isSelected ? GameSetupScene.SELECTED_COLOR : GameSetupScene.UNSELECTED_COLOR
    bg.fillStyle(color, 1)
    bg.fillRoundedRect(
      -GameSetupScene.BUTTON_WIDTH / 2,
      -GameSetupScene.BUTTON_HEIGHT / 2,
      GameSetupScene.BUTTON_WIDTH,
      GameSetupScene.BUTTON_HEIGHT,
      GameSetupScene.BUTTON_RADIUS,
    )
    container.add(bg)

    // 텍스트
    const text = this.add
      .text(0, 0, number.toString(), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(text)

    // 인터랙티브 영역
    const hitArea = this.add
      .rectangle(0, 0, GameSetupScene.BUTTON_WIDTH, GameSetupScene.BUTTON_HEIGHT, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    container.add(hitArea)

    container.setData('bg', bg)
    container.setData('hitArea', hitArea)

    return container
  }

  /**
   * 버튼 상호작용 설정 (hover, click 통일)
   */
  private setupButtonInteraction(container: Phaser.GameObjects.Container, onClick: () => void) {
    const bg = container.getData('bg') as Phaser.GameObjects.Graphics
    const hitArea = container.getData('hitArea') as Phaser.GameObjects.Rectangle

    // 현재 선택 상태 확인 헬퍼
    const isCurrentlySelected = () => {
      return (
        (container.getData('playerCount') !== undefined &&
          container.getData('playerCount') === this.playerCount) ||
        (container.getData('setCount') !== undefined &&
          container.getData('setCount') === this.setCount)
      )
    }

    // 버튼 배경 그리기 헬퍼
    const drawButtonBg = (color: number) => {
      bg.clear()
      bg.fillStyle(color, 1)
      bg.fillRoundedRect(
        -GameSetupScene.BUTTON_WIDTH / 2,
        -GameSetupScene.BUTTON_HEIGHT / 2,
        GameSetupScene.BUTTON_WIDTH,
        GameSetupScene.BUTTON_HEIGHT,
        GameSetupScene.BUTTON_RADIUS,
      )
    }

    // hover 효과
    hitArea.on('pointerover', () => {
      const currentIsSelected = isCurrentlySelected()
      const hoverColor = currentIsSelected ? 0x45a049 : 0x777777
      drawButtonBg(hoverColor)
    })

    // hover 해제 효과
    hitArea.on('pointerout', () => {
      const currentIsSelected = isCurrentlySelected()
      const currentColor = currentIsSelected
        ? GameSetupScene.SELECTED_COLOR
        : GameSetupScene.UNSELECTED_COLOR
      drawButtonBg(currentColor)
    })

    // 클릭 이벤트
    hitArea.on('pointerdown', onClick)
  }

  /**
   * 시작 버튼 생성
   */
  private createStartButton(width: number, height: number) {
    const buttonY = height * 0.3 + GameSetupScene.SECTION_SPACING * 2

    const container = this.add.container(width / 2, buttonY)

    // 배경
    const bg = this.add.graphics()
    bg.fillStyle(0x2196f3, 1)
    bg.fillRoundedRect(
      -GameSetupScene.START_BUTTON_WIDTH / 2,
      -GameSetupScene.START_BUTTON_HEIGHT / 2,
      GameSetupScene.START_BUTTON_WIDTH,
      GameSetupScene.START_BUTTON_HEIGHT,
      GameSetupScene.BUTTON_RADIUS,
    )
    container.add(bg)

    // 텍스트
    const text = this.add
      .text(0, 0, '게임 시작', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(text)

    // 인터랙티브 영역
    const hitArea = this.add
      .rectangle(
        0,
        0,
        GameSetupScene.START_BUTTON_WIDTH,
        GameSetupScene.START_BUTTON_HEIGHT,
        0x000000,
        0,
      )
      .setInteractive({ useHandCursor: true })
    container.add(hitArea)

    // 시작 버튼 배경 그리기 헬퍼
    const drawStartButtonBg = (color: number) => {
      bg.clear()
      bg.fillStyle(color, 1)
      bg.fillRoundedRect(
        -GameSetupScene.START_BUTTON_WIDTH / 2,
        -GameSetupScene.START_BUTTON_HEIGHT / 2,
        GameSetupScene.START_BUTTON_WIDTH,
        GameSetupScene.START_BUTTON_HEIGHT,
        GameSetupScene.BUTTON_RADIUS,
      )
    }

    // 이벤트
    hitArea.on('pointerdown', () => this.startGame())

    // hover 효과
    hitArea.on('pointerover', () => {
      drawStartButtonBg(0x1976d2)
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      })
    })

    hitArea.on('pointerout', () => {
      drawStartButtonBg(0x2196f3)
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      })
    })

    this.startButton = container
  }

  /**
   * 플레이어 수 선택
   */
  private selectPlayerCount(count: number) {
    if (this.playerCount === count) return

    // 이전 선택 해제
    this.updateButtonSelection(this.playerCountButtons, this.playerCount, false)

    // 새 선택 적용
    this.playerCount = count

    // 텍스트 업데이트
    this.updateButtonSelection(this.playerCountButtons, count, true)
    if (this.playerCountText) {
      this.playerCountText.setText(`선택됨: ${count}명`)
    }
  }

  /**
   * 세트 수 선택
   */
  private selectSetCount(count: number) {
    if (this.setCount === count) return

    // 이전 선택 해제
    this.updateButtonSelection(this.setCountButtons, this.setCount, false)

    // 새 선택 적용
    this.setCount = count
    this.updateButtonSelection(this.setCountButtons, count, true)

    // 텍스트 업데이트
    if (this.setCountText) {
      this.setCountText.setText(`선택됨: ${count}세트`)
    }
  }

  /**
   * 버튼 선택 상태 업데이트
   */
  private updateButtonSelection(
    buttons: Phaser.GameObjects.Container[],
    value: number,
    isSelected: boolean,
  ) {
    const button = buttons.find(
      (btn) => btn.getData('playerCount') === value || btn.getData('setCount') === value,
    )
    if (!button) return

    const bg = button.getData('bg') as Phaser.GameObjects.Graphics
    const color = isSelected ? GameSetupScene.SELECTED_COLOR : GameSetupScene.UNSELECTED_COLOR

    bg.clear()
    bg.fillStyle(color, 1)
    bg.fillRoundedRect(
      -GameSetupScene.BUTTON_WIDTH / 2,
      -GameSetupScene.BUTTON_HEIGHT / 2,
      GameSetupScene.BUTTON_WIDTH,
      GameSetupScene.BUTTON_HEIGHT,
      GameSetupScene.BUTTON_RADIUS,
    )
  }

  /**
   * 게임 시작
   */
  private startGame() {
    // 플레이어 수에 맞게 랜덤 말 번호 선택 (0부터 playerCount-1까지)
    const randomHorseIndex = Math.floor(Math.random() * this.playerCount)

    this.onCompleteCallback?.({
      playerCount: this.playerCount,
      setCount: this.setCount,
      playerHorseIndex: randomHorseIndex,
    })
    this.scene.stop()
  }
}
