/**
 * 개발/테스트용 localStorage 키
 * "처음부터 다시 테스트" 시 이 키들만 비우고, hybrid-horse-race-user-id는 유지합니다.
 */
const DEV_STORAGE_KEYS = [
  'dev_room_config',
  'dev_player_id',
  'dev_player_ids',
  'dev_player_nickname_data',
  'dev_player_custom_names',
  'dev_selected_horses',
] as const

/**
 * 테스트 관련 localStorage를 비웁니다.
 * 사용자 식별자(hybrid-horse-race-user-id)는 제거하지 않습니다.
 */
export function clearDevTestStorage(): void {
  for (const key of DEV_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
}
