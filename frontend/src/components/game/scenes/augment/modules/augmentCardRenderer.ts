import Phaser from 'phaser'
import type { Augment, AugmentStatType } from '../../../../../engine/race'
import {
  AUGMENT_STAT_NAMES,
  AUGMENT_STAT_DESCRIPTIONS,
  SPECIAL_ABILITY_DESCRIPTIONS,
} from '../../../../../engine/race'

/**
 * 증강 카드 내부 콘텐츠 렌더러.
 * - 카드 배경 외의 "아이콘/이름/설명" 요소만 생성한다.
 * - 일반 스탯 카드와 특수 능력 카드를 동일 인터페이스로 처리한다.
 */
export function createAugmentCardContent(config: {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  visualsContainer: Phaser.GameObjects.Container
  augment: Augment
  cardWidth: number
  cardHeight: number
  iconSize: number
  iconYOffset: number
  textNameYOffset: number
  textDescYOffset: number
  statIconMap: Record<AugmentStatType, string>
}) {
  const {
    scene,
    container,
    visualsContainer,
    augment,
    cardWidth,
    cardHeight,
    iconSize,
    iconYOffset,
    textNameYOffset,
    textDescYOffset,
    statIconMap,
  } = config

  if (augment.specialAbility) {
    return addSpecialAbilityContent({
      scene,
      container,
      visualsContainer,
      augment,
      cardWidth,
      cardHeight,
      iconSize,
      iconYOffset,
      textNameYOffset,
      textDescYOffset,
    })
  }

  return addStatContent({
    scene,
    container,
    visualsContainer,
    augment,
    cardWidth,
    cardHeight,
    iconSize,
    iconYOffset,
    textNameYOffset,
    textDescYOffset,
    statIconMap,
  })
}

/** 특수 능력 카드(예: 추입, 추월, 위기탈출) 콘텐츠를 그린다. */
function addSpecialAbilityContent(config: {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  visualsContainer: Phaser.GameObjects.Container
  augment: Augment
  cardWidth: number
  cardHeight: number
  iconSize: number
  iconYOffset: number
  textNameYOffset: number
  textDescYOffset: number
}) {
  const {
    scene,
    container,
    visualsContainer,
    augment,
    cardWidth,
    cardHeight,
    iconSize,
    iconYOffset,
    textNameYOffset,
    textDescYOffset,
  } = config

  // 엔진 정의 설명문을 그대로 사용해 UI/밸런스 설명을 일치시킨다.
  const abilityDescription = SPECIAL_ABILITY_DESCRIPTIONS[augment.specialAbility!]
  const iconKey = getSpecialAbilityIconKey(scene, augment.specialAbility!)

  if (iconKey) {
    const icon = scene.add.image(0, -cardHeight / 2 + 20 + iconYOffset + iconSize / 2, iconKey)

    // 위기탈출 아이콘은 세로형 비율이라 원본 비율을 유지한다.
    if (augment.specialAbility === 'escapeCrisis') {
      setIconAspectRatio(scene, icon, iconKey, iconSize)
    } else {
      icon.setDisplaySize(iconSize, iconSize)
    }
    visualsContainer.add(icon)
  }

  const nameSize = 20
  const descSize = 14
  const nameY = 30 + textNameYOffset
  const descY = cardHeight / 2 - 40 + textDescYOffset

  const nameValueStr =
    augment.specialAbilityValue != null
      ? `${augment.name} +${augment.specialAbilityValue}`
      : augment.name

  const nameText = scene.add
    .text(0, nameY, nameValueStr, {
      fontFamily: 'NeoDunggeunmo',
      fontSize: `${nameSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
  container.add(nameText)

  const descText = scene.add
    .text(0, descY, abilityDescription, {
      fontFamily: 'NeoDunggeunmo',
      fontSize: `${descSize}px`,
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: cardWidth - 30 },
    })
    .setOrigin(0.5)
  container.add(descText)
}

/** 일반 스탯 카드(속도/파워/근성 등) 콘텐츠를 그린다. */
function addStatContent(config: {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  visualsContainer: Phaser.GameObjects.Container
  augment: Augment
  cardWidth: number
  cardHeight: number
  iconSize: number
  iconYOffset: number
  textNameYOffset: number
  textDescYOffset: number
  statIconMap: Record<AugmentStatType, string>
}) {
  const {
    scene,
    container,
    visualsContainer,
    augment,
    cardWidth,
    cardHeight,
    iconSize,
    iconYOffset,
    textNameYOffset,
    textDescYOffset,
    statIconMap,
  } = config

  const iconKey = statIconMap[augment.statType!]

  if (scene.textures.exists(iconKey)) {
    const icon = scene.add.image(0, -cardHeight / 2 + 20 + iconYOffset + iconSize / 2, iconKey)
    icon.setDisplaySize(iconSize, iconSize)
    visualsContainer.add(icon)
  }

  const nameSize = 22
  const descSize = 14
  const nameY = 30 + textNameYOffset
  const descY = cardHeight / 2 - 40 + textDescYOffset

  const statName = AUGMENT_STAT_NAMES[augment.statType!]
  const nameValueStr =
    augment.statValue != null
      ? `${statName} ${augment.statValue > 0 ? '+' : ''}${augment.statValue}`
      : statName

  const nameText = scene.add
    .text(0, nameY, nameValueStr, {
      fontFamily: 'NeoDunggeunmo',
      fontSize: `${nameSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
  container.add(nameText)

  const descText = scene.add
    .text(0, descY, AUGMENT_STAT_DESCRIPTIONS[augment.statType!], {
      fontFamily: 'NeoDunggeunmo',
      fontSize: `${descSize}px`,
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: cardWidth - 30 },
    })
    .setOrigin(0.5)
  container.add(descText)
}

/** 특수 능력명 -> 아이콘 키 매핑 */
function getSpecialAbilityIconKey(scene: Phaser.Scene, ability: string): string | null {
  const keyMap: Record<string, string> = {
    lastSpurt: 'special_last_spurt',
    overtake: 'special_overtake',
    escapeCrisis: 'special_escape_crisis',
  }
  const key = keyMap[ability]
  return key && scene.textures.exists(key) ? key : null
}

/** 아이콘 원본 비율을 유지한 채 목표 높이에 맞춘다. */
function setIconAspectRatio(
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image,
  iconKey: string,
  iconSize: number,
) {
  const texture = scene.textures.get(iconKey)
  if (texture?.source?.[0]) {
    const { width, height } = texture.source[0]
    const aspectRatio = width / height
    icon.setDisplaySize(iconSize * aspectRatio, iconSize)
  } else {
    icon.setDisplaySize(iconSize, iconSize)
  }
}
