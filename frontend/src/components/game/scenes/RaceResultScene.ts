import Phaser from 'phaser'
import type { Augment } from '../../../types/augment'
import { AUGMENT_STAT_NAMES, AUGMENT_RARITY_NAMES } from '../../../types/augment'

/**
 * 레이스 결과 Scene
 * RaceScene 위에 오버레이로 표시됨
 */
export default class RaceResultScene extends Phaser.Scene {
  private onCloseCallback?: () => void
  private playerHorseIndex: number = 0 // 플레이어 말 인덱스 (0 = 1번 말)
  private rankings: Array<{
    rank: number
    name: string
    time: number
    finished: boolean
    augments?: Augment[]
  }> = []

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
    onClose?: () => void
  }) {
    this.rankings = data?.rankings || []
    this.playerHorseIndex = data?.playerHorseIndex ?? 0
    this.onCloseCallback = data?.onClose
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
    onClose?: () => void
  }) {
    // init에서 데이터를 받지 못한 경우 create에서 받기
    if (data) {
      this.rankings = data.rankings || this.rankings
      this.playerHorseIndex = data.playerHorseIndex ?? this.playerHorseIndex
      this.onCloseCallback = data.onClose || this.onCloseCallback
    }

    const width = this.scale.width
    const height = this.scale.height

    // 반투명 배경
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(2000)
      .setInteractive()

    // 제목 (위치를 더 위로 조정하여 겹침 방지)
    this.add
      .text(width / 2, height * 0.1, '레이스 완주!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2001)

    // 최종 순위표 생성 (위치를 아래로 조정)
    this.createRankingTable(width, height)

    // 닫기 버튼
    const closeButton = this.add
      .text(width / 2, height * 0.9, '닫기', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#333333',
      })
      .setOrigin(0.5)
      .setPadding(16, 10, 16, 10)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true })

    closeButton.on('pointerdown', () => {
      if (this.onCloseCallback) {
        this.onCloseCallback()
      }
      this.scene.stop()
    })

    // 키보드 입력
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.onCloseCallback) {
        this.onCloseCallback()
      }
      this.scene.stop()
    })
  }

  private createRankingTable(width: number, height: number) {
    const tableX = width / 2
    const tableY = height * 0.5 // 위치를 아래로 조정하여 제목과 겹침 방지
    const tableWidth = 700 // 증강 정보를 위해 너비 증가
    const tableHeight = 450 // 증강 정보를 위해 높이 증가
    const rows = this.rankings.length + 1 // 헤더 + 데이터 행
    const cellHeight = tableHeight / rows

    // 테이블 배경 (어두운색)
    this.add
      .rectangle(tableX, tableY, tableWidth, tableHeight, 0x1a1a2e, 0.95)
      .setOrigin(0.5)
      .setDepth(2001)

    // 테이블 테두리 (밝은색)
    this.add
      .graphics()
      .lineStyle(3, 0xffffff, 0.8)
      .strokeRect(tableX - tableWidth / 2, tableY - tableHeight / 2, tableWidth, tableHeight)
      .setDepth(2002)

    // 열 너비 (증강 정보 추가로 조정)
    const rankColWidth = tableWidth * 0.1
    const nameColWidth = tableWidth * 0.25
    const timeColWidth = tableWidth * 0.2
    const augmentColWidth = tableWidth * 0.45
    const startX = tableX - tableWidth / 2
    const startY = tableY - tableHeight / 2

    // 세로선 그리기 (밝은색)
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0xffffff, 0.5)
    graphics.setDepth(2002)

    // 열 구분선
    let currentX = startX + rankColWidth
    graphics.moveTo(currentX, startY)
    graphics.lineTo(currentX, startY + tableHeight)
    currentX += nameColWidth
    graphics.moveTo(currentX, startY)
    graphics.lineTo(currentX, startY + tableHeight)
    currentX += timeColWidth
    graphics.moveTo(currentX, startY)
    graphics.lineTo(currentX, startY + tableHeight)

    // 가로선 그리기
    for (let row = 1; row < rows; row++) {
      const lineY = startY + row * cellHeight
      graphics.moveTo(startX, lineY)
      graphics.lineTo(startX + tableWidth, lineY)
    }
    graphics.strokePath()

    // 헤더 (흰색 텍스트)
    const headerY = startY + cellHeight / 2
    this.add
      .text(startX + rankColWidth / 2, headerY, '순위', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2003)

    this.add
      .text(startX + rankColWidth + nameColWidth / 2, headerY, '이름', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2003)

    this.add
      .text(startX + rankColWidth + nameColWidth + timeColWidth / 2, headerY, '기록', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2003)

    this.add
      .text(
        startX + rankColWidth + nameColWidth + timeColWidth + augmentColWidth / 2,
        headerY,
        '증강',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          color: '#ffffff',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5, 0.5)
      .setDepth(2003)

    // 데이터 행
    this.rankings.forEach((result, index) => {
      const rowY = startY + (index + 1) * cellHeight + cellHeight / 2
      const playerNumber = result.name.replace('Horse_', '')
      const isPlayerHorse = parseInt(playerNumber) === this.playerHorseIndex + 1

      // 플레이어 말 행 배경 하이라이트
      if (isPlayerHorse) {
        this.add
          .rectangle(tableX, rowY, tableWidth, cellHeight, 0xffff00, 0.2)
          .setOrigin(0.5)
          .setDepth(2002)
      }

      // 순위 (플레이어 말은 노란색, 나머지는 흰색)
      this.add
        .text(startX + rankColWidth / 2, rowY, `${result.rank}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: isPlayerHorse ? '#ffff00' : '#ffffff',
          fontStyle: isPlayerHorse ? 'bold' : 'normal',
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2003)

      // 이름 (플레이어 말은 노란색, 나머지는 흰색)
      const nameText = isPlayerHorse ? `플레이어 ${playerNumber} (나)` : `플레이어 ${playerNumber}`
      this.add
        .text(startX + rankColWidth + nameColWidth / 2, rowY, nameText, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: isPlayerHorse ? '#ffff00' : '#ffffff',
          fontStyle: isPlayerHorse ? 'bold' : 'normal',
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2003)

      // 기록 (플레이어 말은 노란색, 나머지는 흰색)
      const timeText = result.finished ? `${result.time.toFixed(3)}초` : '미완주'
      this.add
        .text(startX + rankColWidth + nameColWidth + timeColWidth / 2, rowY, timeText, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: isPlayerHorse ? '#ffff00' : result.finished ? '#ffffff' : '#888888',
          fontStyle: isPlayerHorse ? 'bold' : 'normal',
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2003)

      // 증강 정보 (등급 포함, 플레이어 말은 노란색, 나머지는 흰색)
      const augments = result.augments || []
      let augmentText = '없음'
      if (augments.length > 0) {
        augmentText = augments
          .map((aug) => {
            const rarityName = AUGMENT_RARITY_NAMES[aug.rarity]
            const statName = AUGMENT_STAT_NAMES[aug.statType]
            const statValue = aug.statValue > 0 ? `+${aug.statValue}` : `${aug.statValue}`
            return `[${rarityName}] ${statName} ${statValue}`
          })
          .join(', ')
      }

      this.add
        .text(
          startX + rankColWidth + nameColWidth + timeColWidth + augmentColWidth / 2,
          rowY,
          augmentText,
          {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: isPlayerHorse ? '#ffff00' : '#ffffff',
            fontStyle: isPlayerHorse ? 'bold' : 'normal',
            align: 'center',
            wordWrap: { width: augmentColWidth - 20 },
          },
        )
        .setOrigin(0.5, 0.5)
        .setDepth(2003)
    })
  }
}
