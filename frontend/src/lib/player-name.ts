import {
  formatNickname,
  generateNicknameData,
  type NicknameData,
} from '../utils/nickname-generator'

const CUSTOM_NAME_KEY = 'dev_player_custom_names'
const NICKNAME_DATA_KEY = 'dev_player_nickname_data'

function readRecord<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, T>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeRecord<T>(key: string, value: Record<string, T>): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function resolvePlayerDisplayName(playerId: string): string {
  if (!playerId) {
    return formatNickname(generateNicknameData())
  }

  const customNames = readRecord<string>(CUSTOM_NAME_KEY)
  const customName = customNames[playerId]?.trim()
  if (customName) return customName

  const nicknameDataMap = readRecord<NicknameData>(NICKNAME_DATA_KEY)
  const nicknameData = nicknameDataMap[playerId] ?? generateNicknameData()
  if (!nicknameDataMap[playerId]) {
    nicknameDataMap[playerId] = nicknameData
    writeRecord(NICKNAME_DATA_KEY, nicknameDataMap)
  }
  return formatNickname(nicknameData)
}
