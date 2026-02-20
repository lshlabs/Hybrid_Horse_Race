import Phaser from 'phaser'
import { tileMapAssetLoaders } from '../tilemaps/tileMapAssets'

/** 말 스프라이트 텍스처 키 목록 (horse1~horse8, ready/run) */
const HORSE_ASSET_KEYS = Array.from({ length: 8 }, (_, i) => {
  const n = i + 1
  return [`horse${n}_ready1`, `horse${n}_ready2`, `horse${n}_ready3`, `horse${n}_run`] as const
}).flat()

/**
 * 픽셀 아트 성격의 텍스처에 NEAREST 필터를 강제한다.
 * 스케일 업 시 보간(blurring)이 들어가지 않도록 씬 초기화 직후 호출한다.
 */
export function applyPixelArtFilter(scene: Phaser.Scene) {
  // 타일맵 + HUD/말 스프라이트 중 픽셀 아트로 렌더링해야 하는 키만 대상으로 한다.
  const textureKeys = [
    ...tileMapAssetLoaders.map((a) => a.key),
    'arrow',
    'hud_panel_bg',
    ...HORSE_ASSET_KEYS,
  ]
  textureKeys.forEach((key) => {
    // 씬마다 preload 순서가 다를 수 있으므로 존재 확인 후 필터를 적용한다.
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
  })
}
