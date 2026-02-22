import { logger } from 'firebase-functions'

export type LogContext = Record<string, unknown>

// event 이름 + context 형태로 로그를 통일해서 남기기 위한 얇은 wrapper
export function logInfo(event: string, context: LogContext): void {
  logger.info(event, context)
}

export function logWarn(event: string, context: LogContext): void {
  logger.warn(event, context)
}
