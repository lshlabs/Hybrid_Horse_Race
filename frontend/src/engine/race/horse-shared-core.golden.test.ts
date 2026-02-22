import { describe, expect, it } from 'vitest'

import { applyAugmentsToStats } from './augments'
import { Horse } from './horse'
import type { Augment, Stats } from './types'
import { HorseCore } from '../../../../shared/race-core/horse-core'
import {
  applyHorseRankUpdate,
  applySpecialAbilityToState,
  applyStatAugments,
} from '../../../../shared/race-core/horse-logic-core'

function createBaseStats(overrides?: Partial<Stats>): Stats {
  return {
    Speed: 10,
    Stamina: 10,
    Power: 10,
    Guts: 10,
    Start: 40,
    Luck: 10,
    ...overrides,
  }
}

describe('horse/shared-core golden parity', () => {
  it('applies stat augments consistently between frontend and shared core helper', () => {
    const baseStats = createBaseStats()
    const augments: Augment[] = [
      { id: 'a1', name: 'Speed +2', rarity: 'common', statType: 'Speed', statValue: 2 },
      { id: 'a2', name: 'Luck +1', rarity: 'common', statType: 'Luck', statValue: 1 },
      {
        id: 's1',
        name: 'Overtake',
        rarity: 'hidden',
        specialAbility: 'overtake',
        specialAbilityValue: 8,
      },
    ]

    const frontendApplied = applyAugmentsToStats(baseStats, augments)
    const sharedApplied = applyStatAugments(baseStats, augments)

    expect(frontendApplied).toEqual(sharedApplied)
    expect(frontendApplied).toEqual({
      Speed: 12,
      Stamina: 10,
      Power: 10,
      Guts: 10,
      Start: 40,
      Luck: 11,
    })
  })

  it('maps special ability values with a shared formula (golden snapshot)', () => {
    const frontendHorse = new Horse('golden-horse', createBaseStats())
    frontendHorse.setSpecialAbility('lastSpurt', 8)
    frontendHorse.setSpecialAbility('overtake', 9)
    frontendHorse.setSpecialAbility('escapeCrisis', 7)

    const fromHelper = applySpecialAbilityToState(
      applySpecialAbilityToState(
        applySpecialAbilityToState(
          {
            lastSpurtTriggerProgress: 1.0,
            overtakeBonusValue: 0,
            escapeCrisisValue: 0,
          },
          'lastSpurt',
          8,
        ),
        'overtake',
        9,
      ),
      'escapeCrisis',
      7,
    )

    expect({
      lastSpurtTriggerProgress: frontendHorse.lastSpurtTriggerProgress,
      overtakeBonusValue: frontendHorse.overtakeBonusValue,
      escapeCrisisValue: frontendHorse.escapeCrisisValue,
    }).toEqual(fromHelper)

    expect(fromHelper).toMatchObject({
      lastSpurtTriggerProgress: 0.84,
      overtakeBonusValue: 9,
      escapeCrisisValue: 7,
    })
  })

  it('keeps rank update side effects aligned (frontend Horse vs shared HorseCore)', () => {
    const baseStats = createBaseStats({ Speed: 0, Stamina: 0, Power: 0, Guts: 0, Luck: 0 })
    const frontendHorse = new Horse('frontend', baseStats)
    frontendHorse.maxStamina = 100
    frontendHorse.stamina = 80
    frontendHorse.setSpecialAbility('overtake', 8)
    frontendHorse.setSpecialAbility('escapeCrisis', 7)

    const sharedHorse = new HorseCore('p1', baseStats, [], 0, 500)
    sharedHorse.maxStamina = 100
    sharedHorse.stamina = 80
    ;(sharedHorse as unknown as { overtakeBonusValue: number }).overtakeBonusValue = 8
    ;(sharedHorse as unknown as { escapeCrisisValue: number }).escapeCrisisValue = 7

    const rankSequence = [5, 5, 3, 2, 4]
    for (const rank of rankSequence) {
      frontendHorse.updateRank(rank)
      sharedHorse.updateRank(rank)
    }

    expect({
      currentRank: frontendHorse.currentRank,
      previousRank: frontendHorse.previousRank,
      stamina: frontendHorse.stamina,
      overtakeCount: frontendHorse.overtakeCount,
      escapeCrisisActive: frontendHorse.escapeCrisisActive,
      escapeCrisisUsed: frontendHorse.escapeCrisisUsed,
    }).toEqual({
      currentRank: sharedHorse.currentRank,
      previousRank: sharedHorse.previousRank,
      stamina: sharedHorse.stamina,
      overtakeCount: sharedHorse.overtakeCount,
      escapeCrisisActive: sharedHorse.escapeCrisisActive,
      escapeCrisisUsed: sharedHorse.escapeCrisisUsed,
    })

    expect(frontendHorse.lastStaminaRecovery).toBe(0)
  })

  it('produces deterministic rank-update golden outputs from shared helper', () => {
    let state = {
      currentRank: 999,
      previousRank: 999,
      maxStamina: 100,
      stamina: 80,
      overtakeBonusValue: 8,
      overtakeCount: 0,
      escapeCrisisValue: 7,
      escapeCrisisUsed: false,
    }

    const outputs = [5, 3, 4].map((rank) => {
      const result = applyHorseRankUpdate(state, rank)
      state = {
        ...state,
        currentRank: result.currentRank,
        previousRank: result.previousRank,
        stamina: result.stamina,
        overtakeCount: result.overtakeCount,
        escapeCrisisUsed: result.escapeCrisisUsed,
      }
      return {
        rank,
        currentRank: result.currentRank,
        previousRank: result.previousRank,
        stamina: result.stamina,
        overtakeCount: result.overtakeCount,
        overtakeBonusActive: result.overtakeBonusActive,
        staminaRecovered: result.staminaRecovered,
        escapeCrisisActive: result.escapeCrisisActive,
        escapeCrisisUsed: result.escapeCrisisUsed,
      }
    })

    expect(outputs).toEqual([
      {
        rank: 5,
        currentRank: 5,
        previousRank: 999,
        stamina: 80,
        overtakeCount: 0,
        overtakeBonusActive: false,
        staminaRecovered: 0,
        escapeCrisisActive: false,
        escapeCrisisUsed: false,
      },
      {
        rank: 3,
        currentRank: 3,
        previousRank: 5,
        stamina: 83,
        overtakeCount: 1,
        overtakeBonusActive: true,
        staminaRecovered: 3,
        escapeCrisisActive: false,
        escapeCrisisUsed: false,
      },
      {
        rank: 4,
        currentRank: 4,
        previousRank: 3,
        stamina: 83,
        overtakeCount: 1,
        overtakeBonusActive: false,
        staminaRecovered: 0,
        escapeCrisisActive: true,
        escapeCrisisUsed: true,
      },
    ])
  })
})
