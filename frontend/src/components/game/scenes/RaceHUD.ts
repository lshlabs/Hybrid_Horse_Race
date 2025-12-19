// RaceHUD.ts
import Phaser from 'phaser'
import type { Augment } from '../../../types/augment'
import { AUGMENT_STAT_NAMES } from '../../../types/augment'

export default class RaceHUD {
  // HUD 스타일 상수
  private static readonly HUD_BG_COLOR = 0x05051a // 어두운 보라색 배경
  private static readonly HUD_DEPTH = 30
  private static readonly CARD_SELECTED_COLOR = 0xfff27a // 노란색 (선택된 증강)
  private static readonly CARD_LOCKED_COLOR = 0x828282 // 회색 (선택 전 증강)
  private static readonly STATS_BG_COLOR = 0x004488 // 진한 파란색 배경
  private static readonly CARD_DEPTH = 31
  private static readonly TEXT_DEPTH = 32
  private static readonly PANEL_DEPTH = 40
  private static readonly PANEL_TEXT_DEPTH = 41

  // HUD 레이아웃 상수
  private static readonly MARGIN = 24
  private static readonly CARD_WIDTH = 150
  private static readonly CARD_VERTICAL_PADDING = 40
  private static readonly CARD_RADIUS = 12
  private static readonly LOCK_SCALE = 0.05

  // 순위표 상수
  private static readonly PANEL_WIDTH = 260 // 텍스트 겹침 방지를 위해 너비 증가
  private static readonly PANEL_MARGIN = 16
  private static readonly PANEL_RADIUS = 16
  private static readonly TOP_PADDING = 24
  private static readonly TITLE_FONT_SIZE = 22
  private static readonly TITLE_LIST_GAP = 32
  private static readonly RANK_COUNT = 8
  private static readonly LINE_GAP = 26
  private static readonly RANK_FONT_SIZE = 18
  private static readonly BOTTOM_PADDING = 24

  private scene: Phaser.Scene
  private gameAreaHeight: number
  private hudHeight: number
  private abilityTableGraphics?: Phaser.GameObjects.Graphics
  private statsTableGraphics?: Phaser.GameObjects.Graphics
  private abilityCellTexts: Phaser.GameObjects.Text[] = []
  private statsCellTexts: Phaser.GameObjects.Text[] = []
  private rankingTableGraphics?: Phaser.GameObjects.Graphics
  private rankingCellTexts: Phaser.GameObjects.Text[][] = [] // [행][열] 형태
  private previousRankings: Map<string, number> = new Map() // 말 이름 -> 이전 순위 (애니메이션용)

  // 증강 카드 관련
  private augmentCards: {
    bg?: Phaser.GameObjects.Graphics
    text?: Phaser.GameObjects.Text
    lock?: Phaser.GameObjects.Image
  }[] = []
  private cardPositions: { x: number; y: number }[] = []

  constructor(scene: Phaser.Scene, gameAreaHeight: number, hudHeight: number) {
    this.scene = scene
    this.gameAreaHeight = gameAreaHeight
    this.hudHeight = hudHeight
  }

  // --- 하단 HUD 생성 ---
  createHUD() {
    const width = this.scene.scale.width
    const topY = this.gameAreaHeight
    const baseY = topY + this.hudHeight / 2
    const cardHeight = this.hudHeight - RaceHUD.CARD_VERTICAL_PADDING

    // 전체 HUD 배경
    this.scene.add
      .rectangle(width / 2, baseY, width, this.hudHeight, RaceHUD.HUD_BG_COLOR)
      .setOrigin(0.5)
      .setDepth(RaceHUD.HUD_DEPTH)

    // 카드 1, 2, 3 위치 계산
    const card1X = RaceHUD.MARGIN + RaceHUD.CARD_WIDTH / 2
    const card2X = card1X + RaceHUD.CARD_WIDTH + RaceHUD.MARGIN
    const card3X = card2X + RaceHUD.CARD_WIDTH + RaceHUD.MARGIN

    // 카드 위치 저장
    this.cardPositions = [
      { x: card1X, y: baseY },
      { x: card2X, y: baseY },
      { x: card3X, y: baseY },
    ]

    // 초기 카드 생성 (모두 잠금 상태)
    this.cardPositions.forEach((pos) => {
      const bg = this.scene.add.graphics()
      bg.fillStyle(RaceHUD.CARD_LOCKED_COLOR, 1)
      bg.fillRoundedRect(
        pos.x - RaceHUD.CARD_WIDTH / 2,
        pos.y - cardHeight / 2,
        RaceHUD.CARD_WIDTH,
        cardHeight,
        RaceHUD.CARD_RADIUS,
      )
      bg.setDepth(RaceHUD.CARD_DEPTH)

      const lockImage = this.scene.add.image(pos.x, pos.y, 'lock3')
      lockImage.setOrigin(0.5)
      lockImage.setScale(RaceHUD.LOCK_SCALE)
      lockImage.setDepth(RaceHUD.TEXT_DEPTH)

      this.augmentCards.push({ bg, lock: lockImage })
    })

    // 능력치 박스 영역 (두 개의 박스로 분할)
    const cardStatsGap = RaceHUD.MARGIN
    const totalStatsWidth = width - (RaceHUD.CARD_WIDTH * 3 + RaceHUD.MARGIN * 4 + cardStatsGap)
    const boxGap = RaceHUD.MARGIN / 2 // 두 박스 사이 간격
    const boxWidth = (totalStatsWidth - boxGap) / 2 // 각 박스의 너비

    // 왼쪽 박스: 능력치 표시 (2열 3행 표)
    const abilityBoxX = card3X + RaceHUD.CARD_WIDTH / 2 + cardStatsGap + boxWidth / 2
    this.createCard(abilityBoxX, baseY, boxWidth, cardHeight, RaceHUD.STATS_BG_COLOR)
    this.createAbilityTable(abilityBoxX, baseY, boxWidth, cardHeight)

    // 오른쪽 박스: 현재 상태 표시 (1열 3행 표)
    const statsBoxX = abilityBoxX + boxWidth / 2 + boxGap + boxWidth / 2
    this.createCard(statsBoxX, baseY, boxWidth, cardHeight, RaceHUD.STATS_BG_COLOR)
    this.createStatsTable(statsBoxX, baseY, boxWidth, cardHeight)
  }

  // 카드 생성 헬퍼 메서드
  private createCard(x: number, y: number, width: number, height: number, color: number) {
    const graphics = this.scene.add.graphics()
    graphics.fillStyle(color, 1)
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, RaceHUD.CARD_RADIUS)
    graphics.setDepth(RaceHUD.CARD_DEPTH)
  }

  // 증강 정보 업데이트
  updateAugments(augments: Augment[]) {
    const cardHeight = this.hudHeight - RaceHUD.CARD_VERTICAL_PADDING
    const cardStyleCommon = {
      fontFamily: 'Arial, sans-serif', // 더 선명한 폰트
      fontSize: '18px',
      color: '#000000',
      align: 'center' as const,
    }

    // 각 카드 위치에 대해 업데이트
    for (let i = 0; i < 3; i++) {
      const card = this.augmentCards[i]
      const pos = this.cardPositions[i]
      const augment = augments[i]

      if (!card || !pos) continue

      // 기존 텍스트 제거
      if (card.text) {
        card.text.destroy()
        card.text = undefined
      }

      if (augment) {
        // 증강이 선택된 경우
        // 배경 색상 변경
        if (card.bg) {
          card.bg.clear()
          card.bg.fillStyle(RaceHUD.CARD_SELECTED_COLOR, 1)
          card.bg.fillRoundedRect(
            pos.x - RaceHUD.CARD_WIDTH / 2,
            pos.y - cardHeight / 2,
            RaceHUD.CARD_WIDTH,
            cardHeight,
            RaceHUD.CARD_RADIUS,
          )
        }

        // 잠금 아이콘 제거
        if (card.lock) {
          card.lock.destroy()
          card.lock = undefined
        }

        // 증강 정보 텍스트 표시
        const statName = AUGMENT_STAT_NAMES[augment.statType]
        const statValue = augment.statValue > 0 ? `+${augment.statValue}` : `${augment.statValue}`
        const displayText = `${statName}\n${statValue}`

        card.text = this.scene.add
          .text(pos.x, pos.y, displayText, {
            ...cardStyleCommon,
            fontFamily: 'Arial, sans-serif', // 더 선명한 폰트
          })
          .setOrigin(0.5)
          .setDepth(RaceHUD.TEXT_DEPTH)
      } else {
        // 증강이 선택되지 않은 경우 (잠금 상태)
        // 배경 색상 변경
        if (card.bg) {
          card.bg.clear()
          card.bg.fillStyle(RaceHUD.CARD_LOCKED_COLOR, 1)
          card.bg.fillRoundedRect(
            pos.x - RaceHUD.CARD_WIDTH / 2,
            pos.y - cardHeight / 2,
            RaceHUD.CARD_WIDTH,
            cardHeight,
            RaceHUD.CARD_RADIUS,
          )
        }

        // 잠금 아이콘 표시 (없으면 생성)
        if (!card.lock) {
          card.lock = this.scene.add.image(pos.x, pos.y, 'lock3')
          card.lock.setOrigin(0.5)
          card.lock.setScale(RaceHUD.LOCK_SCALE)
          card.lock.setDepth(RaceHUD.TEXT_DEPTH)
        }
      }
    }
  }

  // 능력치 표 생성 (2열 3행)
  private createAbilityTable(x: number, y: number, width: number, height: number) {
    const cols = 2
    const rows = 3
    const cellWidth = width / cols
    const cellHeight = height / rows
    const startX = x - width / 2
    const startY = y - height / 2

    // 표 선 그리기
    this.abilityTableGraphics = this.scene.add.graphics()
    this.abilityTableGraphics.lineStyle(2, 0xffffff, 0.5)
    this.abilityTableGraphics.setDepth(RaceHUD.TEXT_DEPTH - 1)

    // 세로선 (열 구분)
    for (let col = 1; col < cols; col++) {
      const lineX = startX + col * cellWidth
      this.abilityTableGraphics.moveTo(lineX, startY)
      this.abilityTableGraphics.lineTo(lineX, startY + height)
    }

    // 가로선 (행 구분)
    for (let row = 1; row < rows; row++) {
      const lineY = startY + row * cellHeight
      this.abilityTableGraphics.moveTo(startX, lineY)
      this.abilityTableGraphics.lineTo(startX + width, lineY)
    }
    this.abilityTableGraphics.strokePath()

    // 각 셀에 텍스트 생성
    const labels = [
      ['속도', '지구력'],
      ['가속', '근성'],
      ['출발', '안정성'],
    ]

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = startX + col * cellWidth + cellWidth / 2
        const cellY = startY + row * cellHeight + cellHeight / 2
        const text = this.scene.add
          .text(cellX, cellY, `${labels[row][col]} : 0`, {
            fontFamily: 'Arial, sans-serif', // 더 선명한 폰트
            fontSize: '16px',
            color: '#ffffff',
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(RaceHUD.TEXT_DEPTH)
        this.abilityCellTexts.push(text)
      }
    }
  }

  // 현재 상태 표 생성 (1열 3행)
  private createStatsTable(x: number, y: number, width: number, height: number) {
    const cols = 1
    const rows = 3
    const cellWidth = width / cols
    const cellHeight = height / rows
    const startX = x - width / 2
    const startY = y - height / 2

    // 표 선 그리기
    this.statsTableGraphics = this.scene.add.graphics()
    this.statsTableGraphics.lineStyle(2, 0xffffff, 0.5)
    this.statsTableGraphics.setDepth(RaceHUD.TEXT_DEPTH - 1)

    // 가로선 (행 구분)
    for (let row = 1; row < rows; row++) {
      const lineY = startY + row * cellHeight
      this.statsTableGraphics.moveTo(startX, lineY)
      this.statsTableGraphics.lineTo(startX + width, lineY)
    }
    this.statsTableGraphics.strokePath()

    // 각 셀에 텍스트 생성
    const labels = ['속도', '체력', '컨디션']
    // 초기 텍스트는 나중에 updateStats에서 업데이트됨

    for (let row = 0; row < rows; row++) {
      const cellX = startX + cellWidth / 2
      const cellY = startY + row * cellHeight + cellHeight / 2
      const text = this.scene.add
        .text(cellX, cellY, `${labels[row]} : 0`, {
          fontFamily: 'Arial, sans-serif', // 더 선명한 폰트
          fontSize: '16px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(RaceHUD.TEXT_DEPTH)
      this.statsCellTexts.push(text)
    }
  }

  // --- 우측 순위표 패널 (반투명) ---
  createRankingPanel() {
    const width = this.scene.scale.width

    // 패널 높이 계산 (제목 제거, 헤더 + 데이터 행만)
    const rows = RaceHUD.RANK_COUNT + 1 // 헤더 + 데이터 행
    const cellHeight = RaceHUD.LINE_GAP
    const tableHeight = cellHeight * rows
    const panelHeight = RaceHUD.TOP_PADDING + tableHeight + RaceHUD.BOTTOM_PADDING

    const panelX = width - RaceHUD.PANEL_WIDTH / 2 - RaceHUD.PANEL_MARGIN
    const panelY = RaceHUD.TOP_PADDING + panelHeight / 2

    // 패널 배경
    const panelGraphics = this.scene.add.graphics()
    panelGraphics.fillStyle(0xffffff, 0.55)
    panelGraphics.fillRoundedRect(
      panelX - RaceHUD.PANEL_WIDTH / 2,
      panelY - panelHeight / 2,
      RaceHUD.PANEL_WIDTH,
      panelHeight,
      RaceHUD.PANEL_RADIUS,
    )
    // 테두리 보더 제거
    panelGraphics.setDepth(RaceHUD.PANEL_DEPTH)

    // 순위표 영역 계산 (패널 전체 너비 사용, 좌우 여백 최소화)
    const tableStartY = panelY - panelHeight / 2 + RaceHUD.TOP_PADDING
    const tableWidth = RaceHUD.PANEL_WIDTH - 30 // 좌우 여백
    const tableX = panelX

    // 순위표 생성 (헤더 + 데이터 행)
    this.createRankingTable(tableX, tableStartY, tableWidth)
  }

  // 순위표 생성 (헤더 + 데이터 행)
  private createRankingTable(x: number, y: number, width: number) {
    const cols = 3 // 순위, 이름, 기록
    const rows = RaceHUD.RANK_COUNT + 1 // 헤더 + 데이터 행

    // 열 너비 조정 (이름과 시간이 충분한 공간을 가지도록)
    const rankColWidth = width * 0.2 // 순위 열: 20% (숫자만 표시하므로 좁게)
    const nameColWidth = width * 0.45 // 이름 열: 45% (플레이어 + 번호)
    const timeColWidth = width * 0.35 // 시간 열: 35% (0.000초 형식)
    const colWidths = [rankColWidth, nameColWidth, timeColWidth]

    // 행 높이 계산 (LINE_GAP 기반, 정확히 계산)
    const cellHeight = RaceHUD.LINE_GAP
    const totalHeight = cellHeight * rows

    const startX = x - width / 2
    const startY = y

    // 표 선 그리기
    this.rankingTableGraphics = this.scene.add.graphics()
    this.rankingTableGraphics.lineStyle(2, 0x888888, 0.6) // 옅은 회색으로 변경
    this.rankingTableGraphics.setDepth(RaceHUD.PANEL_TEXT_DEPTH - 1)

    // 세로선 (열 구분)
    let currentX = startX
    for (let col = 1; col < cols; col++) {
      currentX += colWidths[col - 1]
      this.rankingTableGraphics.moveTo(currentX, startY)
      this.rankingTableGraphics.lineTo(currentX, startY + totalHeight)
    }

    // 가로선 (행 구분)
    for (let row = 1; row < rows; row++) {
      const lineY = startY + row * cellHeight
      this.rankingTableGraphics.moveTo(startX, lineY)
      this.rankingTableGraphics.lineTo(startX + width, lineY)
    }
    this.rankingTableGraphics.strokePath()

    // 헤더 행 생성
    const headerLabels = ['순위', '이름', '기록']
    const headerRow: Phaser.GameObjects.Text[] = []
    currentX = startX
    for (let col = 0; col < cols; col++) {
      // 셀 중앙 위치 계산
      const cellX = currentX + colWidths[col] / 2
      const cellY = startY + cellHeight / 2
      const text = this.scene.add
        .text(cellX, cellY, headerLabels[col], {
          fontFamily: 'Arial, sans-serif', // 더 선명한 폰트
          fontSize: `${RaceHUD.RANK_FONT_SIZE}px`,
          color: '#000000',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5) // 중앙 정렬
        .setDepth(RaceHUD.PANEL_TEXT_DEPTH)
      headerRow.push(text)
      currentX += colWidths[col]
    }
    this.rankingCellTexts.push(headerRow)

    // 데이터 행 생성
    for (let row = 1; row < rows; row++) {
      const dataRow: Phaser.GameObjects.Text[] = []
      currentX = startX
      for (let col = 0; col < cols; col++) {
        // 셀 중앙 위치 계산
        const cellX = currentX + colWidths[col] / 2
        const cellY = startY + row * cellHeight + cellHeight / 2
        const text = this.scene.add
          .text(cellX, cellY, '', {
            fontFamily: 'Arial, sans-serif', // 더 선명한 폰트
            fontSize: `${RaceHUD.RANK_FONT_SIZE}px`,
            color: '#000000',
          })
          .setOrigin(0.5, 0.5) // 중앙 정렬
          .setDepth(RaceHUD.PANEL_TEXT_DEPTH)
        dataRow.push(text)
        currentX += colWidths[col]
      }
      this.rankingCellTexts.push(dataRow)
    }
  }

  // 순위 업데이트
  updateRanking(
    horses: Array<{
      name: string
      position: number
      finished: boolean
      finishTime?: number | null
      currentTime?: number
    }>,
  ) {
    // position 기준으로 정렬 (높은 순서대로)
    const sorted = [...horses].sort((a, b) => {
      // 완주한 말이 우선
      if (a.finished && !b.finished) return -1
      if (!a.finished && b.finished) return 1
      // 둘 다 완주했으면 finishTime 기준 (빠른 순)
      if (a.finished && b.finished) {
        const aTime = a.finishTime ?? Infinity
        const bTime = b.finishTime ?? Infinity
        return aTime - bTime
      }
      // 둘 다 미완주면 position 기준
      return b.position - a.position
    })

    // 순위표 업데이트 (헤더 제외한 데이터 행만)
    const maxCount = Math.min(
      this.rankingCellTexts.length - 1, // 헤더 제외
      sorted.length,
      RaceHUD.RANK_COUNT,
    )

    for (let i = 0; i < maxCount; i++) {
      const horse = sorted[i]
      const rowIndex = i + 1 // 헤더 다음부터
      const row = this.rankingCellTexts[rowIndex]

      if (row && row.length >= 3) {
        // 플레이어 번호 추출 (Horse_1 -> 1, Horse_2 -> 2)
        const playerNumber = horse.name.replace('Horse_', '')

        // 기록 계산
        let time: number
        if (horse.finished && horse.finishTime != null && horse.finishTime > 0) {
          time = horse.finishTime
        } else {
          time = horse.currentTime ?? 0
        }

        // 소수점 3자리까지 표시
        const timeStr = time.toFixed(3)

        // 순위 변경 감지 및 애니메이션
        const currentRank = i + 1
        const previousRank = this.previousRankings.get(horse.name)
        const rankChanged = previousRank !== undefined && previousRank !== currentRank

        // 순위, 이름, 시간 업데이트
        row[0].setText(`${currentRank}`) // 순위
        row[1].setText(`플레이어 ${playerNumber}`) // 이름
        row[2].setText(`${timeStr}초`) // 시간

        // 순위 변경 애니메이션
        if (rankChanged) {
          const isRankUp = previousRank > currentRank // 순위가 올라감 (숫자가 작아짐)
          const originalColor = '#000000' // 원래 색상 (검은색)

          // 순위, 이름, 기록 텍스트 모두에 색상 효과 적용
          const targetColor = isRankUp ? '#00ff00' : '#ff0000' // 올라가면 초록, 내려가면 빨강

          // 모든 셀에 색상 펄스 효과 적용
          row.forEach((cell) => {
            cell.setStyle({ color: targetColor })
          })

          this.scene.time.delayedCall(400, () => {
            // 모든 셀을 원래 색상으로 복원
            row.forEach((cell) => {
              cell.setStyle({ color: originalColor })
            })
          })

          // 전체 행에 페이드 효과 (색상 변경 없이, 완료 후 원래 alpha로 복원)
          row.forEach((cell) => {
            this.scene.tweens.add({
              targets: cell,
              alpha: 0.6,
              duration: 150,
              yoyo: true,
              ease: 'Power1',
              onComplete: () => {
                // 페이드 효과 후 원래 alpha(1.0)로 확실히 복원
                cell.setAlpha(1.0)
              },
            })
          })
        }

        // 현재 순위 저장
        this.previousRankings.set(horse.name, currentRank)
      }
    }

    // 나머지 행은 비우기
    for (let i = maxCount; i < RaceHUD.RANK_COUNT; i++) {
      const rowIndex = i + 1
      const row = this.rankingCellTexts[rowIndex]
      if (row && row.length >= 3) {
        row[0].setText('')
        row[1].setText('')
        row[2].setText('')
      }
    }

    // 순위표 밖으로 나간 말들의 이전 순위 정보 제거
    const currentHorseNames = new Set(sorted.map((h) => h.name))
    for (const [horseName] of this.previousRankings) {
      if (!currentHorseNames.has(horseName)) {
        this.previousRankings.delete(horseName)
      }
    }
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
      Consistency: number
    }
    effStats?: {
      Speed: number
      Stamina: number
      Power: number
      Guts: number
      Start: number
      Consistency: number
    }
  }) {
    // m/s를 km/h로 변환
    const msToKmh = (ms: number) => (ms * 3600) / 1000
    const currentSpeedKmh = msToKmh(horse.currentSpeed)
    const maxSpeedKmh = msToKmh(horse.maxSpeed_ms)

    // 체력 계산
    const staminaPercent = Math.round((horse.stamina / horse.maxStamina) * 100)

    // 컨디션 보너스 계산
    const conditionBonus = horse.conditionRoll * 100 // -10% ~ +10%

    // 오른쪽 박스: 현재 상태 텍스트 업데이트 (1열 3행)
    if (this.statsCellTexts.length >= 3) {
      // 속도 : X / Y km/h
      this.statsCellTexts[0].setText(
        `속도 : ${currentSpeedKmh.toFixed(1)} / ${maxSpeedKmh.toFixed(1)} km/h`,
      )

      // 체력 : X / 100
      this.statsCellTexts[1].setText(`체력 : ${staminaPercent} / 100`)

      // 컨디션 보너스 : +2.3% 형식으로 표시
      const bonusSign = conditionBonus >= 0 ? '+' : ''
      this.statsCellTexts[2].setText(`컨디션 보너스 : ${bonusSign}${conditionBonus.toFixed(1)}%`)
    }

    // 왼쪽 박스: 능력치 텍스트 업데이트 (2열 3행)
    if (this.abilityCellTexts.length >= 6 && horse.effStats) {
      const stats = horse.effStats
      // 순서: [속도, 지구력, 가속, 근성, 출발, 안정성]
      this.abilityCellTexts[0].setText(`속도 : ${Math.round(stats.Speed * 10) / 10}`)
      this.abilityCellTexts[1].setText(`지구력 : ${Math.round(stats.Stamina * 10) / 10}`)
      this.abilityCellTexts[2].setText(`가속 : ${Math.round(stats.Power * 10) / 10}`)
      this.abilityCellTexts[3].setText(`근성 : ${Math.round(stats.Guts * 10) / 10}`)
      this.abilityCellTexts[4].setText(`출발 : ${Math.round(stats.Start * 10) / 10}`)
      this.abilityCellTexts[5].setText(`안정성 : ${Math.round(stats.Consistency * 10) / 10}`)
    }
  }
}
