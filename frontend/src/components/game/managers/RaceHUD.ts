// RaceHUD.ts
import Phaser from 'phaser'
import type { Augment, AugmentRarity } from '../../../engine/race'
import { AUGMENT_STAT_NAMES, SPECIAL_ABILITY_NAMES } from '../../../engine/race'

export default class RaceHUD {
  // HUD 스타일 상수 - Glassmorphism 디자인
  private static readonly CARD_SELECTED_COLOR = 0x6366f1 // 인디고 (선택된 증강) - Glassmorphism
  private static readonly CARD_LOCKED_COLOR = 0xffffff // 흰색 반투명 (선택 전 증강)
  private static readonly STATS_BG_COLOR = 0xffffff // 흰색 반투명 배경
  private static readonly CARD_DEPTH = 31
  private static readonly TEXT_DEPTH = 32
  private static readonly PANEL_DEPTH = 40
  private static readonly PANEL_TEXT_DEPTH = 41
  // 증강 등급별 색상 (rarity에 따른 카드 배경색)
  private static readonly AUGMENT_RARITY_COLORS: Record<AugmentRarity, number> = {
    common: 0x64748b, // 회색 (일반)
    rare: 0x3b82f6, // 파란색 (레어)
    epic: 0x8b5cf6, // 보라색 (영웅)
    legendary: 0xf59e0b, // 황금색 (전설)
    hidden: 0xef4444, // 빨간색 (히든)
  }
  // HUD 레이아웃 상수 - 미니멀 디자인
  private static readonly MARGIN = 32
  private static readonly CARD_WIDTH = 140
  private static readonly CARD_VERTICAL_PADDING = 48
  private static readonly CARD_RADIUS = 16
  private static readonly LOCK_SCALE = 0.04

  // 순위표 상수 - Glassmorphism
  private static readonly PANEL_WIDTH = 280 // 미니멀한 너비
  private static readonly PANEL_MARGIN = 20
  private static readonly PANEL_RADIUS = 20
  private static readonly TOP_PADDING = 32
  private static readonly RANK_COUNT = 8
  private static readonly LINE_GAP = 32
  private static readonly RANK_FONT_SIZE = 16
  private static readonly BOTTOM_PADDING = 32

  private scene: Phaser.Scene
  private gameAreaHeight: number
  private hudHeight: number
  private setCount: number // 세트 수
  private playerCount: number // 플레이어 수
  private abilityCellTexts: Phaser.GameObjects.Text[] = []
  private statsCellTexts: Phaser.GameObjects.Text[] = []
  private rankingCellTexts: Phaser.GameObjects.Text[][] = [] // [행][열] 형태
  private previousRankings: Map<string, number> = new Map() // 말 이름 -> 이전 순위 (애니메이션용)

  // 증강 카드 관련
  private augmentCards: {
    bg?: Phaser.GameObjects.Graphics
    text?: Phaser.GameObjects.Text
    lock?: Phaser.GameObjects.Image
  }[] = []
  private cardPositions: { x: number; y: number }[] = []

  constructor(
    scene: Phaser.Scene,
    gameAreaHeight: number,
    hudHeight: number,
    setCount: number = 3,
    playerCount: number = 8,
  ) {
    this.scene = scene
    this.gameAreaHeight = gameAreaHeight
    this.hudHeight = hudHeight
    this.setCount = setCount
    this.playerCount = playerCount
  }

  // --- 하단 HUD 생성 ---
  createHUD() {
    const width = this.scene.scale.width
    const topY = this.gameAreaHeight
    const baseY = topY + this.hudHeight / 2
    const cardHeight = this.hudHeight - RaceHUD.CARD_VERTICAL_PADDING

    // 전체 HUD 배경 - Glassmorphism 스타일 (완전 투명)

    // 카드 1, 2, 3 위치 계산 (왼쪽에서부터 고정 위치)
    const card1X = RaceHUD.MARGIN + RaceHUD.CARD_WIDTH / 2
    const card2X = card1X + RaceHUD.CARD_WIDTH + RaceHUD.MARGIN
    const card3X = card2X + RaceHUD.CARD_WIDTH + RaceHUD.MARGIN

    // 카드 위치 저장 (세트 수만큼만)
    this.cardPositions = []
    const cardPositionsAll = [
      { x: card1X, y: baseY },
      { x: card2X, y: baseY },
      { x: card3X, y: baseY },
    ]
    // 세트 수만큼만 위치 추가
    for (let i = 0; i < this.setCount; i++) {
      this.cardPositions.push(cardPositionsAll[i])
    }

    // 초기 카드 생성 (세트 수만큼만 생성, 모두 잠금 상태) - Glassmorphism 스타일
    this.cardPositions.forEach((pos) => {
      // Glassmorphism 배경 (반투명 흰색)
      const bg = this.scene.add.graphics()
      bg.fillStyle(RaceHUD.CARD_LOCKED_COLOR, 0.15) // 매우 투명한 흰색
      bg.fillRoundedRect(
        pos.x - RaceHUD.CARD_WIDTH / 2,
        pos.y - cardHeight / 2,
        RaceHUD.CARD_WIDTH,
        cardHeight,
        RaceHUD.CARD_RADIUS,
      )
      // Glassmorphism 테두리
      bg.lineStyle(1, 0xffffff, 0.2)
      bg.strokeRoundedRect(
        pos.x - RaceHUD.CARD_WIDTH / 2,
        pos.y - cardHeight / 2,
        RaceHUD.CARD_WIDTH,
        cardHeight,
        RaceHUD.CARD_RADIUS,
      )
      bg.setDepth(RaceHUD.CARD_DEPTH)

      // 잠금 아이콘 (필터는 RaceScene에서 일괄 적용)
      const lockImage = this.scene.add.image(pos.x, pos.y, 'lock')
      lockImage.setOrigin(0.5)
      lockImage.setScale(RaceHUD.LOCK_SCALE)
      lockImage.setDepth(RaceHUD.TEXT_DEPTH)
      lockImage.setTint(0xffffff) // 흰색으로 변경

      this.augmentCards.push({ bg, lock: lockImage })
    })

    // 능력치 박스 영역 (두 개의 박스로 분할) - 고정 위치
    const cardStatsGap = RaceHUD.MARGIN
    // card3X 기준으로 고정 계산 (항상 3번째 카드 위치 기준)
    const totalStatsWidth =
      width - (card3X + RaceHUD.CARD_WIDTH / 2 + cardStatsGap + RaceHUD.MARGIN)
    const boxGap = RaceHUD.MARGIN / 2 // 두 박스 사이 간격
    const boxWidth = (totalStatsWidth - boxGap) / 2 // 각 박스의 너비

    // 왼쪽 박스: 능력치 표시 (2열 3행 표) - 고정 위치
    const abilityBoxX = card3X + RaceHUD.CARD_WIDTH / 2 + cardStatsGap + boxWidth / 2
    this.createCard(abilityBoxX, baseY, boxWidth, cardHeight, RaceHUD.STATS_BG_COLOR)
    this.createAbilityTable(abilityBoxX, baseY, boxWidth, cardHeight)

    // 오른쪽 박스: 현재 상태 표시 (1열 3행 표) - 고정 위치
    const statsBoxX = abilityBoxX + boxWidth / 2 + boxGap + boxWidth / 2
    this.createCard(statsBoxX, baseY, boxWidth, cardHeight, RaceHUD.STATS_BG_COLOR)
    this.createStatsTable(statsBoxX, baseY, boxWidth, cardHeight)
  }

  // 카드 생성 헬퍼 메서드 - Glassmorphism 스타일
  private createCard(x: number, y: number, width: number, height: number, color: number) {
    const graphics = this.scene.add.graphics()
    // Glassmorphism 배경 (반투명)
    graphics.fillStyle(color, 0.2)
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, RaceHUD.CARD_RADIUS)
    // Glassmorphism 테두리
    graphics.lineStyle(1, 0xffffff, 0.15)
    graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, RaceHUD.CARD_RADIUS)
    graphics.setDepth(RaceHUD.CARD_DEPTH)
  }

  // 증강 정보 업데이트 - 미니멀 스타일
  updateAugments(augments: Augment[]) {
    const cardHeight = this.hudHeight - RaceHUD.CARD_VERTICAL_PADDING
    const cardStyleCommon = {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff', // 흰색
      align: 'center' as const,
    }

    // 세트 수에 따라 표시할 최대 증강 개수 제한
    const maxAugmentsToShow = this.setCount

    // 각 카드 위치에 대해 업데이트 (세트 수만큼만)
    for (let i = 0; i < this.setCount; i++) {
      const card = this.augmentCards[i]
      const pos = this.cardPositions[i]
      // 증강은 순서대로 첫 번째부터 채워짐 (세트 수만큼만 표시)
      const augment = i < augments.length && i < maxAugmentsToShow ? augments[i] : undefined

      if (!card || !pos) continue

      // 기존 텍스트 제거
      if (card.text) {
        card.text.destroy()
        card.text = undefined
      }

      if (augment) {
        // 증강이 선택된 경우 - Glassmorphism 스타일
        // 배경 색상 변경 (등급별 색상 적용)
        if (card.bg) {
          card.bg.clear()
          // 선택된 카드 배경 (등급별 색상)
          const rarityColor = this.getAugmentRarityColor(augment.rarity)
          card.bg.fillStyle(rarityColor, 0.3)
          card.bg.fillRoundedRect(
            pos.x - RaceHUD.CARD_WIDTH / 2,
            pos.y - cardHeight / 2,
            RaceHUD.CARD_WIDTH,
            cardHeight,
            RaceHUD.CARD_RADIUS,
          )
          // 강조 테두리 (등급별 색상)
          card.bg.lineStyle(2, rarityColor, 0.6)
          card.bg.strokeRoundedRect(
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
        let displayText = ''
        if (augment.specialAbility) {
          // 특수 능력인 경우
          const abilityName = SPECIAL_ABILITY_NAMES[augment.specialAbility]
          if (augment.specialAbilityValue != null) {
            displayText = `${abilityName}\n+${augment.specialAbilityValue}`
          } else {
            displayText = abilityName
          }
        } else if (augment.statType && augment.statValue != null) {
          // 일반 증강인 경우
          const statName = AUGMENT_STAT_NAMES[augment.statType]
          const statValue = augment.statValue > 0 ? `+${augment.statValue}` : `${augment.statValue}`
          displayText = `${statName}\n${statValue}`
        }

        card.text = this.scene.add
          .text(pos.x, pos.y, displayText, {
            ...cardStyleCommon,
          })
          .setOrigin(0.5)
          .setDepth(RaceHUD.TEXT_DEPTH)
      } else {
        // 증강이 선택되지 않은 경우 (잠금 상태) - Glassmorphism 스타일
        // 배경 색상 변경
        if (card.bg) {
          card.bg.clear()
          card.bg.fillStyle(RaceHUD.CARD_LOCKED_COLOR, 0.08) // 매우 투명한 흰색
          card.bg.fillRoundedRect(
            pos.x - RaceHUD.CARD_WIDTH / 2,
            pos.y - cardHeight / 2,
            RaceHUD.CARD_WIDTH,
            cardHeight,
            RaceHUD.CARD_RADIUS,
          )
          // 기본 테두리
          card.bg.lineStyle(1, 0xffffff, 0.15)
          card.bg.strokeRoundedRect(
            pos.x - RaceHUD.CARD_WIDTH / 2,
            pos.y - cardHeight / 2,
            RaceHUD.CARD_WIDTH,
            cardHeight,
            RaceHUD.CARD_RADIUS,
          )
        }

        // 잠금 아이콘 표시 (없으면 생성)
        if (!card.lock) {
          card.lock = this.scene.add.image(pos.x, pos.y, 'lock')
          card.lock.setOrigin(0.5)
          card.lock.setScale(RaceHUD.LOCK_SCALE)
          card.lock.setDepth(RaceHUD.TEXT_DEPTH)
        }
      }
    }
  }

  // 능력치 표 생성 (2열 3행) - 미니멀 디자인 (선 제거)
  private createAbilityTable(x: number, y: number, width: number, height: number) {
    const cols = 2
    const rows = 3
    const cellWidth = width / cols
    const cellHeight = height / rows
    const startX = x - width / 2
    const startY = y - height / 2

    // 표 선 제거 - 미니멀 디자인

    // 각 셀에 텍스트 생성 - 미니멀 스타일
    const labels = [
      ['속도', '지구력'],
      ['가속', '근성'],
      ['출발', '일관성'],
    ]

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = startX + col * cellWidth + cellWidth / 2
        const cellY = startY + row * cellHeight + cellHeight / 2
        const text = this.scene.add
          .text(cellX, cellY, `${labels[row][col]} : 0`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            color: '#ffffff', // 흰색
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(RaceHUD.TEXT_DEPTH)
        this.abilityCellTexts.push(text)
      }
    }
  }

  // 현재 상태 표 생성 (1열 3행) - 미니멀 디자인 (선 제거)
  private createStatsTable(x: number, y: number, width: number, height: number) {
    const cols = 1
    const rows = 3
    const cellWidth = width / cols
    const cellHeight = height / rows
    const startX = x - width / 2
    const startY = y - height / 2

    // 표 선 제거 - 미니멀 디자인

    // 각 셀에 텍스트 생성 - 미니멀 스타일
    const labels = ['속도', '체력', '컨디션']
    // 초기 텍스트는 나중에 updateStats에서 업데이트됨

    for (let row = 0; row < rows; row++) {
      const cellX = startX + cellWidth / 2
      const cellY = startY + row * cellHeight + cellHeight / 2
      const text = this.scene.add
        .text(cellX, cellY, `${labels[row]} : 0`, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
          color: '#ffffff', // 흰색
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
    const rows = this.playerCount + 1 // 헤더 + 플레이어 수만큼의 데이터 행
    const cellHeight = RaceHUD.LINE_GAP
    const tableHeight = cellHeight * rows
    const panelHeight = RaceHUD.TOP_PADDING + tableHeight + RaceHUD.BOTTOM_PADDING

    const panelX = width - RaceHUD.PANEL_WIDTH / 2 - RaceHUD.PANEL_MARGIN
    const panelY = RaceHUD.TOP_PADDING + panelHeight / 2

    // 패널 배경 - Glassmorphism 스타일
    const panelGraphics = this.scene.add.graphics()
    panelGraphics.fillStyle(0x000000, 0.4) // 어두운 반투명 배경
    panelGraphics.fillRoundedRect(
      panelX - RaceHUD.PANEL_WIDTH / 2,
      panelY - panelHeight / 2,
      RaceHUD.PANEL_WIDTH,
      panelHeight,
      RaceHUD.PANEL_RADIUS,
    )
    // Glassmorphism 테두리
    panelGraphics.lineStyle(1, 0xffffff, 0.2)
    panelGraphics.strokeRoundedRect(
      panelX - RaceHUD.PANEL_WIDTH / 2,
      panelY - panelHeight / 2,
      RaceHUD.PANEL_WIDTH,
      panelHeight,
      RaceHUD.PANEL_RADIUS,
    )
    panelGraphics.setDepth(RaceHUD.PANEL_DEPTH)

    // 순위표 영역 계산 (패널 전체 너비 사용, 좌우 여백 최소화)
    const tableStartY = panelY - panelHeight / 2 + RaceHUD.TOP_PADDING
    const tableWidth = RaceHUD.PANEL_WIDTH - 30 // 좌우 여백
    const tableX = panelX

    // 순위표 생성 (헤더 + 데이터 행)
    this.createRankingTable(tableX, tableStartY, tableWidth, rows)
  }

  // 순위표 생성 (헤더 + 데이터 행)
  private createRankingTable(x: number, y: number, width: number, totalRows?: number) {
    const cols = 3 // 순위, 이름, 기록
    const rows = totalRows || this.playerCount + 1 // 헤더 + 플레이어 수만큼의 데이터 행

    // 열 너비 조정 (이름과 시간이 충분한 공간을 가지도록)
    const rankColWidth = width * 0.2 // 순위 열: 20% (숫자만 표시하므로 좁게)
    const nameColWidth = width * 0.45 // 이름 열: 45% (플레이어 + 번호)
    const timeColWidth = width * 0.35 // 시간 열: 35% (0.000초 형식)
    const colWidths = [rankColWidth, nameColWidth, timeColWidth]

    // 행 높이 계산 (LINE_GAP 기반)
    const cellHeight = RaceHUD.LINE_GAP

    const startX = x - width / 2
    const startY = y

    // 표 선 제거 - 미니멀 디자인

    // 헤더 행 생성 - 미니멀 스타일
    const headerLabels = ['순위', '이름', '기록']
    const headerRow: Phaser.GameObjects.Text[] = []
    let currentX = startX
    for (let col = 0; col < cols; col++) {
      // 셀 중앙 위치 계산
      const cellX = currentX + colWidths[col] / 2
      const cellY = startY + cellHeight / 2
      const text = this.scene.add
        .text(cellX, cellY, headerLabels[col], {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: `${RaceHUD.RANK_FONT_SIZE}px`,
          color: '#ffffff', // 흰색
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5) // 중앙 정렬
        .setDepth(RaceHUD.PANEL_TEXT_DEPTH)
      headerRow.push(text)
      currentX += colWidths[col]
    }
    this.rankingCellTexts.push(headerRow)

    // 데이터 행 생성 - 미니멀 스타일
    for (let row = 1; row < rows; row++) {
      const dataRow: Phaser.GameObjects.Text[] = []
      let currentX = startX
      for (let col = 0; col < cols; col++) {
        // 셀 중앙 위치 계산
        const cellX = currentX + colWidths[col] / 2
        const cellY = startY + row * cellHeight + cellHeight / 2
        const text = this.scene.add
          .text(cellX, cellY, '', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: `${RaceHUD.RANK_FONT_SIZE}px`,
            color: '#ffffff', // 흰색
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
      this.playerCount, // 플레이어 수만큼만 표시
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
          const originalColor = '#ffffff' // 원래 색상 (흰색)

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
   * 증강 등급에 따른 배경색 반환
   * @param rarity 증강 등급
   * @returns Phaser 색상 값
   */
  private getAugmentRarityColor(rarity: AugmentRarity): number {
    return RaceHUD.AUGMENT_RARITY_COLORS[rarity] || RaceHUD.CARD_SELECTED_COLOR
  }

  /**
   * 체력 회복 표시 (일시적 애니메이션)
   * @param recoveryAmount 회복량
   */
  private showStaminaRecovery(recoveryAmount: number) {
    // 체력 텍스트 위치 가져오기
    if (this.statsCellTexts.length < 2) return
    const staminaText = this.statsCellTexts[1]
    const staminaX = staminaText.x
    const staminaY = staminaText.y

    // 회복량 텍스트 생성 (+x 형식)
    const recoveryText = this.scene.add
      .text(staminaX + 80, staminaY, `+${recoveryAmount}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        color: '#00ff00', // 초록색
        align: 'center',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(RaceHUD.TEXT_DEPTH + 1)

    // 애니메이션: 위로 이동하며 페이드아웃
    this.scene.tweens.add({
      targets: recoveryText,
      y: staminaY - 30,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        recoveryText.destroy()
      },
    })
  }

  /**
   * HUD 정리
   */
  destroy() {
    // 모든 UI 요소 제거
    this.augmentCards.forEach((card) => {
      card.bg?.destroy()
      card.text?.destroy()
      card.lock?.destroy()
    })
    this.augmentCards = []

    this.abilityCellTexts.forEach((text) => text.destroy())
    this.abilityCellTexts = []

    this.statsCellTexts.forEach((text) => text.destroy())
    this.statsCellTexts = []

    this.rankingCellTexts.forEach((row) => {
      row.forEach((cell) => cell.destroy())
    })
    this.rankingCellTexts = []

    this.previousRankings.clear()
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

    // 컨디션 보너스 계산
    const conditionBonus = horse.conditionRoll * 100 // -10% ~ +10%

    // 오른쪽 박스: 현재 상태 텍스트 업데이트 (1열 3행)
    if (this.statsCellTexts.length >= 3) {
      // 속도 : X / Y km/h (+X%)
      let speedText = `속도 : ${currentSpeedKmh.toFixed(1)} / ${maxSpeedKmh.toFixed(1)} km/h`
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

      // 체력 : X / 100
      this.statsCellTexts[1].setText(`체력 : ${staminaPercent} / 100`)

      // 체력 회복 표시 (일시적)
      if (horse.lastStaminaRecovery && horse.lastStaminaRecovery > 0) {
        this.showStaminaRecovery(horse.lastStaminaRecovery)
        // 다음 프레임에서 초기화되도록 함 (race-sim.ts에서 처리)
      }

      // 컨디션 보너스 : +2.3% 형식으로 표시
      const bonusSign = conditionBonus >= 0 ? '+' : ''
      this.statsCellTexts[2].setText(`컨디션 보너스 : ${bonusSign}${conditionBonus.toFixed(1)}%`)
    }

    // 왼쪽 박스: 능력치 텍스트 업데이트 (2열 3행)
    if (this.abilityCellTexts.length >= 6 && horse.effStats) {
      const stats = horse.effStats
      // 순서: [속도, 지구력, 가속, 근성, 출발, 일관성]
      const statValues = [
        Math.round(stats.Speed * 10) / 10,
        Math.round(stats.Stamina * 10) / 10,
        Math.round(stats.Power * 10) / 10,
        Math.round(stats.Guts * 10) / 10,
        Math.round(stats.Start * 10) / 10,
        Math.round(stats.Consistency * 10) / 10,
      ]
      const statLabels = ['속도', '지구력', '가속', '근성', '출발', '일관성']

      for (let i = 0; i < 6; i++) {
        const value = statValues[i]
        const label = statLabels[i]
        const color = this.getStatColor(value)
        this.abilityCellTexts[i].setText(`${label} : ${value}`)
        this.abilityCellTexts[i].setStyle({ color })
      }
    }
  }

  /**
   * 현재 세트 업데이트 (이전 세트 카드 잠금 해제)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateCurrentSet(_currentSet: number) {
    // 이전 세트들의 카드는 이미 선택되어 있으므로 유지
    // 현재 세트 카드는 아직 잠금 상태이므로 업데이트 불필요
  }
}
