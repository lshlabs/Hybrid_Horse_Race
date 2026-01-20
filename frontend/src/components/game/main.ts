import Phaser from 'phaser'
import RaceScene from './scenes/RaceScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  render: {
    pixelArt: false, // 텍스트 선명도를 위해 false (배경은 개별적으로 NEAREST 필터 적용)
    antialias: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [RaceScene],
}

new Phaser.Game(config)
