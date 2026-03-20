import {
  formatNickname,
  generateNicknameData,
  type NicknameData,
} from '../utils/nickname-generator'

const CUSTOM_NAME_KEY = 'dev_player_custom_names'
const NICKNAME_DATA_KEY = 'dev_player_nickname_data'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? (parsed as Record<string, T>) : {}
  } catch {
    return {}
  }
}

function writeRecord<T>(key: string, value: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage write failures (private mode/quota)
  }
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
