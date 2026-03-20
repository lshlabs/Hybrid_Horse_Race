import Phaser from 'phaser'
import { tileMapAssetLoaders } from '../tilemaps/tileMapAssets'

const HORSE_COUNT = 8
const PIXEL_FILTER_UI_KEYS = ['arrow', 'hud_panel_bg'] as const

const HORSE_ASSET_KEYS = Array.from({ length: HORSE_COUNT }, (_, i) => {
  const n = i + 1
  return [`horse${n}_ready1`, `horse${n}_ready2`, `horse${n}_ready3`, `horse${n}_run`] as const
}).flat()

function applyNearestFilterIfExists(scene: Phaser.Scene, key: string): void {
  if (!scene.textures.exists(key)) return
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
}

export function applyPixelArtFilter(scene: Phaser.Scene): void {
  const textureKeys = [
    ...tileMapAssetLoaders.map((assetLoader) => assetLoader.key),
    ...PIXEL_FILTER_UI_KEYS,
    ...HORSE_ASSET_KEYS,
  ]

  textureKeys.forEach((key) => {
    applyNearestFilterIfExists(scene, key)
  })
}
