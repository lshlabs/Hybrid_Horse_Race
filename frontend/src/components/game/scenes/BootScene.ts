import Phaser from 'phaser'

/**
 * 게임 시작 시 가장 먼저 실행되는 부트 씬.
 * UI에서 공통으로 쓰는 폰트를 먼저 로드한 뒤 RaceScene으로 넘어간다.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  async create() {
    // Phaser 텍스트 생성 전에 폰트를 로드해야 첫 프레임 깨짐(기본 폰트 대체)을 막을 수 있다.
    await Promise.all([
      document.fonts.load('14px "NeoDunggeunmo"'),
      document.fonts.load('16px "NeoDunggeunmo"'),
      document.fonts.load('20px "NeoDunggeunmo"'),
      document.fonts.load('24px "NeoDunggeunmo"'),
      document.fonts.load('28px "NeoDunggeunmo"'),
      document.fonts.load('32px "NeoDunggeunmo"'),
      document.fonts.load('36px "NeoDunggeunmo"'),
      document.fonts.load('48px "NeoDunggeunmo"'),
      document.fonts.load('64px "NeoDunggeunmo"'),
      document.fonts.load('120px "NeoDunggeunmo"'),
    ])

    // 리소스 준비가 끝나면 실제 게임 플레이 씬으로 전환한다.
    this.scene.start('RaceScene')
  }
}
