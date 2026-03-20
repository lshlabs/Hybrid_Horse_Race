/**
 * TileMapManager가 preload에서 순회하는 타일 에셋 매니페스트.
 * key 이름은 렌더링 코드에서 직접 참조되므로, 변경 시 사용처를 함께 수정해야 한다.
 */

// 배경 테마 1~4 (테마당 4레이어)
import bg1t1 from '../../../../assets/images/map/tile/background1/1.png'
import bg1t2 from '../../../../assets/images/map/tile/background1/2.png'
import bg1t3 from '../../../../assets/images/map/tile/background1/3.png'
import bg1t4 from '../../../../assets/images/map/tile/background1/4.png'
import bg2t1 from '../../../../assets/images/map/tile/background2/1.png'
import bg2t2 from '../../../../assets/images/map/tile/background2/2.png'
import bg2t3 from '../../../../assets/images/map/tile/background2/3.png'
import bg2t4 from '../../../../assets/images/map/tile/background2/4.png'
import bg3t1 from '../../../../assets/images/map/tile/background3/1.png'
import bg3t2 from '../../../../assets/images/map/tile/background3/2.png'
import bg3t3 from '../../../../assets/images/map/tile/background3/3.png'
import bg3t4 from '../../../../assets/images/map/tile/background3/4.png'
import bg4t1 from '../../../../assets/images/map/tile/background4/1.png'
import bg4t2 from '../../../../assets/images/map/tile/background4/2.png'
import bg4t3 from '../../../../assets/images/map/tile/background4/3.png'
import bg4t4 from '../../../../assets/images/map/tile/background4/4.png'

// 잔디/장식
import grass1 from '../../../../assets/images/map/tile/grass1.png'
import grass2 from '../../../../assets/images/map/tile/grass2.png'
import grass3 from '../../../../assets/images/map/tile/grass3.png'
import grass4 from '../../../../assets/images/map/tile/grass4.png'
import grass5 from '../../../../assets/images/map/tile/grass5.png'
import grass6 from '../../../../assets/images/map/tile/grass6.png'
import deco1 from '../../../../assets/images/map/tile/deco1.png'
import deco2 from '../../../../assets/images/map/tile/deco2.png'
import deco3 from '../../../../assets/images/map/tile/deco3.png'
import deco4 from '../../../../assets/images/map/tile/deco4.png'
import deco5 from '../../../../assets/images/map/tile/deco5.png'
import deco6 from '../../../../assets/images/map/tile/deco6.png'

// 트랙/스타트 영역
import trackTop from '../../../../assets/images/map/tile/track_top.png'
import track1 from '../../../../assets/images/map/tile/track1.png'
import track2 from '../../../../assets/images/map/tile/track2.png'
import trackBottom from '../../../../assets/images/map/tile/track_bottom.png'
import startTop from '../../../../assets/images/map/tile/start_top.png'
import start1 from '../../../../assets/images/map/tile/start1.png'
import startBottom from '../../../../assets/images/map/tile/start_bottom.png'

// 울타리
import fenceTile from '../../../../assets/images/map/tile/fence.png'

export type TileMapAssetLoader = {
  key: string
  url: string
}

const BACKGROUND_TILE_ASSETS: TileMapAssetLoader[] = [
  { key: 'bg1_t1', url: bg1t1 },
  { key: 'bg2_t1', url: bg2t1 },
  { key: 'bg3_t1', url: bg3t1 },
  { key: 'bg4_t1', url: bg4t1 },
  { key: 'bg1_t2', url: bg1t2 },
  { key: 'bg2_t2', url: bg2t2 },
  { key: 'bg3_t2', url: bg3t2 },
  { key: 'bg4_t2', url: bg4t2 },
  { key: 'bg1_t3', url: bg1t3 },
  { key: 'bg2_t3', url: bg2t3 },
  { key: 'bg3_t3', url: bg3t3 },
  { key: 'bg4_t3', url: bg4t3 },
  { key: 'bg1_t4', url: bg1t4 },
  { key: 'bg2_t4', url: bg2t4 },
  { key: 'bg3_t4', url: bg3t4 },
  { key: 'bg4_t4', url: bg4t4 },
]

const DECORATION_TILE_ASSETS: TileMapAssetLoader[] = [
  { key: 'grass1', url: grass1 },
  { key: 'grass2', url: grass2 },
  { key: 'grass3', url: grass3 },
  { key: 'grass4', url: grass4 },
  { key: 'grass5', url: grass5 },
  { key: 'grass6', url: grass6 },
  { key: 'deco1', url: deco1 },
  { key: 'deco2', url: deco2 },
  { key: 'deco3', url: deco3 },
  { key: 'deco4', url: deco4 },
  { key: 'deco5', url: deco5 },
  { key: 'deco6', url: deco6 },
]

const TRACK_TILE_ASSETS: TileMapAssetLoader[] = [
  { key: 'track_top', url: trackTop },
  { key: 'track1', url: track1 },
  { key: 'track2', url: track2 },
  { key: 'track_bottom', url: trackBottom },
  { key: 'start_top', url: startTop },
  { key: 'start1', url: start1 },
  { key: 'start_bottom', url: startBottom },
  { key: 'fence', url: fenceTile },
]

export const tileMapAssetLoaders: TileMapAssetLoader[] = [
  ...BACKGROUND_TILE_ASSETS,
  ...DECORATION_TILE_ASSETS,
  ...TRACK_TILE_ASSETS,
]
