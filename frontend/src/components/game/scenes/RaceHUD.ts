// RaceHUD.ts
import Phaser from 'phaser'

export default class RaceHUD {
  private scene: Phaser.Scene
  private gameAreaHeight: number
  private hudHeight: number
  private rankingTexts: Phaser.GameObjects.Text[] = []

  constructor(scene: Phaser.Scene, gameAreaHeight: number, hudHeight: number) {
    this.scene = scene
    this.gameAreaHeight = gameAreaHeight
    this.hudHeight = hudHeight
  }

  // --- 하단 HUD 생성 ---
  createHUD() {
    const width = this.scene.scale.width
    const HUD_H = this.hudHeight // HUD 영역의 전체 높이 (RaceScene에서 전달받은 값)
    const topY = this.gameAreaHeight // 게임 영역의 끝 (HUD 시작 위치)
    const baseY = topY + HUD_H / 2 // HUD의 세로 중앙 위치 (모든 요소가 이 기준으로 배치됨)
    const MARGIN = 24 // 카드들 사이의 간격, 좌측 여백

    // 전체 HUD 배경
    this.scene.add
      .rectangle(width / 2, baseY, width, HUD_H, 0x05051a) // 0x05051a: 어두운 보라색 배경색
      .setOrigin(0.5)
      .setDepth(30)

    // 증강 카드 3개
    const CARD_W = 150 // 카드의 가로 폭 (조정 가능: 120, 180, 200 등)
    const CARD_H = HUD_H - 40 // 카드의 세로 높이 (HUD 높이에서 상하 여백 40px 제외)
    const CARD_RADIUS = 12 // 카드 모서리 둥글기 (조정 가능: 8, 16, 20 등, 0이면 각진 모서리)

    const cardStyleCommon = {
      fontFamily: 'sans-serif',
      fontSize: '18px', // 카드 내 텍스트 크기 (조정 가능: 16px, 20px 등)
      color: '#000000',
      align: 'center' as const,
    }

    // 카드 1 – 선택된 증강
    const card1X = MARGIN + CARD_W / 2 // 첫 번째 카드의 X 위치 (왼쪽에서 MARGIN만큼 떨어진 위치)
    // 둥근 모서리를 위해 Graphics 객체 사용
    const card1Graphics = this.scene.add.graphics()
    card1Graphics.fillStyle(0xfff27a, 1) // 0xfff27a: 노란색 (선택된 증강 표시)
    card1Graphics.fillRoundedRect(
      card1X - CARD_W / 2, // X 시작 위치 (중앙 기준이므로 절반 빼기)
      baseY - CARD_H / 2, // Y 시작 위치 (중앙 기준이므로 절반 빼기)
      CARD_W,
      CARD_H,
      CARD_RADIUS,
    )
    card1Graphics.setDepth(31)
    const card1Bg = { x: card1X, y: baseY } // 텍스트 위치 참조용

    this.scene.add
      .text(card1Bg.x, card1Bg.y, '최고속도 증가\n+18%', {
        ...cardStyleCommon,
      })
      .setOrigin(0.5)
      .setDepth(32)

    // 카드 2, 3 – 선택 전
    const card2X = card1X + CARD_W + MARGIN // 두 번째 카드 X 위치 (첫 번째 카드 + 카드 폭 + 간격)
    const card3X = card2X + CARD_W + MARGIN // 세 번째 카드 X 위치 (두 번째 카드 + 카드 폭 + 간격)

    ;[card2X, card3X].forEach((x) => {
      // 둥근 모서리를 위해 Graphics 객체 사용
      const cardGraphics = this.scene.add.graphics()
      cardGraphics.fillStyle(0x828282, 1) // 0x0055cc: 파란색 (선택 전 증강 표시)
      cardGraphics.fillRoundedRect(
        x - CARD_W / 2, // X 시작 위치 (중앙 기준이므로 절반 빼기)
        baseY - CARD_H / 2, // Y 시작 위치 (중앙 기준이므로 절반 빼기)
        CARD_W,
        CARD_H,
        CARD_RADIUS,
      )
      cardGraphics.setDepth(31)

      // 잠금 아이콘 이미지 표시
      const lockImage = this.scene.add.image(x, baseY, 'lock3')
      lockImage.setOrigin(0.5)
      lockImage.setDepth(32)

      // 이미지 크기 조정 (카드에 맞게 스케일)
      const LOCK_SCALE = 0.05 // 잠금 아이콘 크기 조정 (조정 가능: 0.3, 0.4, 0.6 등)
      lockImage.setScale(LOCK_SCALE)
    })

    // 능력치 박스 (오른쪽 넓은 영역)
    const CARD_STATS_GAP = MARGIN // 3번째 카드와 능력치 박스 사이 간격 (조정 가능: MARGIN * 1.5, MARGIN * 2 등)
    const statsW = width - (CARD_W * 3 + MARGIN * 4 + CARD_STATS_GAP) // 능력치 박스 가로 폭 (전체 너비 - 카드 3개 - 여백 - 간격)
    const statsX = card3X + CARD_W / 2 + CARD_STATS_GAP + statsW / 2 // 능력치 박스 X 위치 (3번째 카드 오른쪽 + 간격)

    // 능력치 박스도 둥근 모서리로 생성
    const statsGraphics = this.scene.add.graphics()
    statsGraphics.fillStyle(0x004488, 1) // 0x004488: 진한 파란색 배경
    statsGraphics.fillRoundedRect(
      statsX - statsW / 2, // X 시작 위치 (중앙 기준이므로 절반 빼기)
      baseY - CARD_H / 2, // Y 시작 위치 (중앙 기준이므로 절반 빼기)
      statsW,
      CARD_H,
      CARD_RADIUS, // 카드와 동일한 모서리 둥글기
    )
    statsGraphics.setDepth(31)
    const statsBg = { x: statsX, y: baseY } // 텍스트 위치 참조용

    const statsText = [
      '속도 : 39 / 55 km/h',
      '컨디션 : 62 / 100',
      '체력 : 77 / 100',
      '습성 : 도주마',
    ].join('\n')

    this.scene.add
      .text(
        statsBg.x - statsW / 2 + 24, // 텍스트 시작 X 위치 (박스 왼쪽에서 24px 떨어진 위치)
        statsBg.y - CARD_H / 2 + 20, // 텍스트 시작 Y 위치 (박스 위쪽에서 20px 떨어진 위치)
        statsText,
        {
          fontFamily: 'sans-serif',
          fontSize: '18px', // 능력치 텍스트 크기 (조정 가능: 16px, 20px 등)
          color: '#ffffff', // 흰색 텍스트
          align: 'left',
        },
      )
      .setDepth(32)
  }

  // --- 우측 순위표 패널 (반투명) ---
  createRankingPanel() {
    const width = this.scene.scale.width

    const PANEL_W = 120 // 패널의 가로 폭 (조정 가능: 100, 150, 200 등)
    const MARGIN = 16 // 패널의 오른쪽 여백

    // 내용 영역 크기 계산 (글씨 영역만큼만 높이 설정)
    const TOP_PADDING = 24 // 패널 상단 여백
    const TITLE_FONT_SIZE = 22 // 제목 텍스트 크기
    const TITLE_LIST_GAP = 32 // 제목과 리스트 사이 간격
    const RANK_COUNT = 8 // 순위 항목 개수 (조정 가능: 4, 6, 10 등)
    const lineGap = 26 // 순위 항목 간 세로 간격 (조정 가능: 24, 28, 30 등)
    const RANK_FONT_SIZE = 18 // 순위 텍스트 크기
    const BOTTOM_PADDING = 24 // 패널 하단 여백

    // 패널 높이 계산: 상단 여백 + 제목 높이 + 간격 + 리스트 높이 + 하단 여백
    const titleHeight = TITLE_FONT_SIZE // 제목 높이
    const listHeight = RANK_COUNT * lineGap - lineGap + RANK_FONT_SIZE // 리스트 높이 (마지막 항목 포함)
    const panelH = TOP_PADDING + titleHeight + TITLE_LIST_GAP + listHeight + BOTTOM_PADDING

    const panelX = width - PANEL_W / 2 - MARGIN // 패널의 X 위치 (화면 오른쪽에서 MARGIN만큼 떨어진 위치)
    const panelY = TOP_PADDING + panelH / 2 // 패널의 세로 위치 (위쪽에서 시작, 내용에 맞춤)

    // 둥근 모서리 패널 배경 (Graphics 객체 사용)
    const PANEL_RADIUS = 16 // 패널 모서리 둥글기 (조정 가능: 8, 12, 20 등)
    const panelGraphics = this.scene.add.graphics()
    panelGraphics.fillStyle(0xffffff, 0.55) // 0xffffff: 흰색, 0.55: 투명도 (0.0=완전투명, 1.0=불투명, 조정 가능: 0.7, 0.8 등)
    panelGraphics.fillRoundedRect(
      panelX - PANEL_W / 2, // X 시작 위치 (중앙 기준이므로 절반 빼기)
      panelY - panelH / 2, // Y 시작 위치 (중앙 기준이므로 절반 빼기)
      PANEL_W,
      panelH,
      PANEL_RADIUS,
    )
    panelGraphics.lineStyle(2, 0x000000, 1) // 2: 테두리 두께, 0x000000: 검은색 테두리, 1: 테두리 불투명도
    panelGraphics.strokeRoundedRect(
      panelX - PANEL_W / 2, // X 시작 위치
      panelY - panelH / 2, // Y 시작 위치
      PANEL_W,
      panelH,
      PANEL_RADIUS,
    )
    panelGraphics.setDepth(40)

    // 제목
    const titleY = panelY - panelH / 2 + TOP_PADDING // 제목의 Y 위치 (패널 위쪽에서 TOP_PADDING만큼 떨어진 위치)
    this.scene.add
      .text(panelX, titleY, '순위표', {
        fontFamily: 'sans-serif',
        fontSize: `${TITLE_FONT_SIZE}px`, // 제목 텍스트 크기
        color: '#000000',
      })
      .setOrigin(0.5)
      .setDepth(41)

    // 순위 리스트 (초기화)
    const startY = titleY + titleHeight / 2 + TITLE_LIST_GAP // 순위 리스트 시작 Y 위치 (제목 아래에서 간격만큼)

    for (let i = 0; i < RANK_COUNT; i++) {
      const text = this.scene.add
        .text(
          panelX - PANEL_W / 2 + 20, // 텍스트 시작 X 위치 (패널 왼쪽에서 20px 떨어진 위치)
          startY + i * lineGap, // 각 항목의 Y 위치
          `플레이어 ${i + 1}`,
          {
            fontFamily: 'sans-serif',
            fontSize: `${RANK_FONT_SIZE}px`, // 순위 텍스트 크기
            color: '#000000',
          },
        )
        .setDepth(41)
      this.rankingTexts.push(text)
    }
  }

  // 순위 업데이트
  updateRanking(horses: Array<{ name: string; position: number; finished: boolean }>) {
    // position 기준으로 정렬 (높은 순서대로)
    const sorted = [...horses]
      .map((h, idx) => ({ ...h, originalIndex: idx }))
      .sort((a, b) => {
        // 완주한 말이 우선
        if (a.finished && !b.finished) return -1
        if (!a.finished && b.finished) return 1
        // 둘 다 완주했거나 둘 다 미완주면 position 기준
        return b.position - a.position
      })

    // 순위표 업데이트
    for (let i = 0; i < this.rankingTexts.length && i < sorted.length; i++) {
      const horse = sorted[i]
      const rank = i + 1
      const name = horse.name.replace('Horse_', '말 ')
      this.rankingTexts[i].setText(`${rank}. ${name}`)
    }
  }
}
