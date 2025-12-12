// 새로운 단순 스탯 시스템 기반 시뮬레이션 예제
import { runRace, printRaceResults, type Stats } from './race-sim'

// 예제 1: 기본 랜덤 스탯 8마리
export function example1_BasicRace() {
  console.log('\n=== 예제 1: 기본 랜덤 스탯 8마리 레이스 ===\n')
  const results = runRace({ numHorses: 8 })
  printRaceResults(results)
}

// 예제 2: 커스텀 스탯 말들
export function example2_CustomHorses() {
  console.log('\n=== 예제 2: 커스텀 스탯 말들 ===\n')

  const horses = [
    {
      name: '스피드형',
      stats: {
        Speed: 18,
        Stamina: 8,
        Power: 15,
        Guts: 10,
        Brain: 8,
        Start: 12,
        Consistency: 6,
      } as Stats,
    },
    {
      name: '지구력형',
      stats: {
        Speed: 10,
        Stamina: 18,
        Power: 8,
        Guts: 15,
        Brain: 10,
        Start: 8,
        Consistency: 8,
      } as Stats,
    },
    {
      name: '밸런스형',
      stats: {
        Speed: 12,
        Stamina: 12,
        Power: 12,
        Guts: 12,
        Brain: 12,
        Start: 12,
        Consistency: 12,
      } as Stats,
    },
  ]

  const results = runRace({ horses })
  printRaceResults(results)
}

// 예제 3: 극단적인 스탯 조합
export function example3_ExtremeStats() {
  console.log('\n=== 예제 3: 극단적인 스탯 조합 ===\n')

  const horses = [
    {
      name: '최고속도형',
      stats: {
        Speed: 20,
        Stamina: 1,
        Power: 20,
        Guts: 1,
        Brain: 1,
        Start: 20,
        Consistency: 1,
      } as Stats,
    },
    {
      name: '막판버티기형',
      stats: {
        Speed: 1,
        Stamina: 20,
        Power: 1,
        Guts: 20,
        Brain: 20,
        Start: 1,
        Consistency: 1,
      } as Stats,
    },
  ]

  const results = runRace({ horses })
  printRaceResults(results)
}

// 모든 예제 실행 (직접 실행 시)
// example1_BasicRace()
// example2_CustomHorses()
// example3_ExtremeStats()
