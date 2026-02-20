# 오프셋 / 매직넘버 일람

위치·연출·시간 관련 오프셋과 매직넘버를 한 표로 정리. 단위와 정의 위치를 맞춰 두었음.

## 표

| 이름 | 단위 | 값(또는 공식) | 용도 | 정의/사용 파일 |
|------|------|----------------|------|----------------|
| **FINISH_LINE_OFFSET_M** | m | 0.35 | 결승 판정, 말 위치→progress 시 말 코 맞춤 | `engine/race/trackConstants.ts` |
| **HORSE_RIGHT_EDGE_OFFSET** | px | 35 | 출발선에서 말 오른쪽 끝 오프셋 | `HorseManager.ts` |
| **finishTriggerM** | m | `trackLengthM - 10` | 결승 연출 트리거 (결승 10m 전) | `RaceScene.ts` |
| **runPastM 계수** | m/s | 15 | 완주 후 “계속 달리는” 연출용 가상 속도 (`timeSinceFinish * 15`) | `CameraScrollManager.ts` |
| **simSlowmoRestoreMs** | ms | 300 | 결승 슬로우모 복구 트윈 duration | `RaceScene.ts` |

## 비고

- **FINISH_LINE_OFFSET_M**: 결승선만 사용. 출발선은 `HORSE_RIGHT_EDGE_OFFSET`(px)로 별도.
- **finishTriggerM**의 10, **runPastM**의 15, **simSlowmoRestoreMs**의 300은 상수로 두고 있으나, 필요 시 constants 또는 각 파일 상단에 이름 붙여 두면 유지보수에 유리함.
