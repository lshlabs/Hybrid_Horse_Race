import Phaser from 'phaser'
import RaceScene from './scenes/RaceScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS, // 🔴 WebGL 말고 Canvas 강제
  parent: 'game',
  width: 1280, // 게임 내부 해상도 = 실제 캔버스 크기
  height: 720, // map1 높이(576)와 동일하게 맞춤
  backgroundColor: '#000000',
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.NONE, // 🔴 Phaser의 추가 스케일링 사용 안함
  },
  scene: [RaceScene],
}

new Phaser.Game(config)
