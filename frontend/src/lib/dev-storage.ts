const DEV_STORAGE_KEYS = [
  'dev_room_config',
  'dev_player_id',
  'dev_player_ids',
  'dev_player_nickname_data',
  'dev_player_custom_names',
  'dev_selected_horses',
] as const

function removeStorageKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore storage remove failures (private mode/quota)
  }
}

export function clearDevTestStorage(): void {
  for (const key of DEV_STORAGE_KEYS) {
    removeStorageKey(key)
  }
}
