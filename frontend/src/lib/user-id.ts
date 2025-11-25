/**
 * 사용자 ID 관리 (임시 localStorage 기반)
 * TODO: 실제 인증 시스템으로 교체
 */

const USER_ID_KEY = 'hybrid-horse-race-user-id'

/**
 * 사용자 ID 가져오기 (없으면 생성)
 */
export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY)
  
  if (!userId) {
    // 새 사용자 ID 생성 (타임스탬프 + 랜덤)
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(USER_ID_KEY, userId)
  }
  
  return userId
}

/**
 * 사용자 ID 설정
 */
export function setUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId)
}

/**
 * 사용자 ID 초기화
 */
export function clearUserId(): void {
  localStorage.removeItem(USER_ID_KEY)
}

