import type { CallableOptions } from 'firebase-functions/v2/https'

const REGION = 'asia-northeast3'
const CORS_ENV_KEY = 'FUNCTIONS_CORS_ORIGINS'

const DEFAULT_ALLOWED_ORIGINS: Array<string | RegExp> = [
  'https://hybrid-horse-race-staging.web.app',
  'https://hybrid-horse-race-prod.web.app',
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
]

function parseAllowedOriginsFromEnv(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return []
  }
  return rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

const envOrigins = parseAllowedOriginsFromEnv(process.env[CORS_ENV_KEY])
const callableCorsOrigins: Array<string | RegExp> =
  envOrigins.length > 0 ? envOrigins : DEFAULT_ALLOWED_ORIGINS

export const CALLABLE_OPTIONS: CallableOptions = {
  region: REGION,
  cors: callableCorsOrigins,
}

