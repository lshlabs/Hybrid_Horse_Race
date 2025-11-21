# 백엔드 빠른 시작 가이드

## 📋 현재 구현된 기능

✅ **기본 인프라**
- Firebase Functions 설정 완료
- 타입 정의 (`functions/src/types.ts`)
- 공통 유틸리티 (`functions/src/utils.ts`)
- 프론트엔드 연동 유틸리티 (`frontend/src/lib/firebase-functions.ts`)

✅ **구현된 Functions**
- `createRoom` - 룸 생성
- `joinRoom` - 룸 참가
- `setPlayerReady` - 준비 상태 변경

## 🚀 다음 단계

### 1. 개발 환경 실행

```bash
# 터미널 1: Firebase Emulator 실행
npm run emulators

# 터미널 2: 프론트엔드 개발 서버
npm run dev
```

### 2. 구현할 Functions 우선순위

#### Phase 1: 기본 게임 플로우
1. `startGame` - 모든 플레이어 준비 시 게임 시작
2. `selectRunStyle` - 주행 습성 선택
3. `leaveRoom` - 플레이어 나가기

#### Phase 2: 증강 시스템
4. `selectAugment` - 증강 선택
5. `rerollAugments` - 증강 새로고침

#### Phase 3: 레이스
6. `startRace` - 레이스 시뮬레이션 실행
7. `skipSet` - 세트 스킵

### 3. 구현 패턴

모든 Functions는 다음 패턴을 따릅니다:

```typescript
export const functionName = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      // 1. 입력 검증 (Zod)
      const parseResult = schema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments')
      }
      
      // 2. 비즈니스 로직
      // - 룸/플레이어 존재 확인
      // - 권한 확인 (호스트 여부 등)
      // - 상태 확인
      // - 데이터 업데이트
      
      // 3. 로깅
      logger.info('Action completed', { ... })
      
      // 4. 결과 반환
      return { success: true, ... }
    } catch (error) {
      logger.error('Error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Internal error')
    }
  },
)
```

## 📚 참고 문서

- [백엔드 개발 가이드](./backend-development-guide.md) - 상세한 아키텍처 및 구현 가이드
- [백엔드 사용 예시](./backend-usage-examples.md) - 프론트엔드에서 사용하는 방법

## 🔧 유용한 명령어

```bash
# Functions 빌드
npm run functions:build

# Functions만 배포
firebase deploy --only functions

# Firestore 규칙 배포
firebase deploy --only firestore:rules

# Emulator 로그 확인
# 브라우저에서 http://localhost:4000 접속
```

## ⚠️ 주의사항

1. **보안**: 모든 쓰기 작업은 Functions를 통해 수행
2. **에러 처리**: 명확한 에러 메시지 반환
3. **로깅**: 중요한 액션은 모두 로깅
4. **검증**: Zod를 사용한 입력 데이터 검증 필수


