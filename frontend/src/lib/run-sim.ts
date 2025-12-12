// 새로운 단순 스탯 시스템 기반 시뮬레이션 실행 스크립트
import {
  runRace,
  printRaceResults,
  printHorseStatsTable,
  // analyzeRaceResults,
  simulateStatImpact,
  simulateStatImpactFixedSpeed,
} from './race-sim'

// 간단한 예제 실행
function main() {
  console.log('=== 새로운 단순 스탯 시스템 시뮬레이션 ===\n')

  // 기본 8마리 랜덤 스탯으로 레이스 실행
  const results = runRace({ numHorses: 8 })

  // 말들의 스탯 표 출력
  const horses = results.map((r) => r.horse)
  printHorseStatsTable(horses)

  // 결과 출력
  printRaceResults(results)

  // 결과 분석
  // analyzeRaceResults(results)

  // 예: 500판, 말 8마리씩
  simulateStatImpact(1000, 8)

  // Speed=15 고정 메타
  simulateStatImpactFixedSpeed(1000, 8, 15)

  console.log('\n=== Simulation End ===')
}

// 실행
main()

export { main }
