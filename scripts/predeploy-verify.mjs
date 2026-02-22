import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

const argv = process.argv.slice(2)

function getArgValue(name, defaultValue) {
  const index = argv.findIndex((arg) => arg === name || arg.startsWith(`${name}=`))
  if (index < 0) return defaultValue
  const current = argv[index]
  if (current.includes('=')) return current.split('=').slice(1).join('=')
  return argv[index + 1] ?? defaultValue
}

function hasFlag(name) {
  return argv.includes(name)
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`Predeploy Verify
================

Usage:
  node scripts/predeploy-verify.mjs --project <staging|prod> --mode <staging|production>

Options:
  --project <alias>       Firebase alias to verify (default: staging)
  --mode <vite-mode>      frontend env mode (staging|production, default: staging)
  --skip-golden           Skip golden test
  --skip-doctor           Skip runtime doctor
  --skip-contract         Skip contract check
  --config-only           Only validate config/env/aliases (do not run commands)
  --help                  Show this message
`)
  process.exit(0)
}

const projectAlias = getArgValue('--project', 'staging')
const mode = getArgValue('--mode', projectAlias === 'prod' ? 'production' : 'staging')
const configOnly = hasFlag('--config-only')

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const placeholderFragments = ['your-', 'example', '000000000000', 'XXXXXXXXXX']

function fail(message) {
  console.error(`FAIL | ${message}`)
  process.exit(1)
}

function warn(message) {
  console.warn(`WARN | ${message}`)
}

function pass(message) {
  console.log(`PASS | ${message}`)
}

function parseSimpleEnvFile(content) {
  const map = new Map()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex < 0) continue
    const key = line.slice(0, eqIndex).trim()
    const value = line.slice(eqIndex + 1).trim()
    map.set(key, value)
  }
  return map
}

function runCommand(command) {
  console.log(`\n$ ${command}`)
  execSync(command, { stdio: 'inherit' })
}

console.log('Predeploy Verify')
console.log('================')
console.log(`Target alias: ${projectAlias}`)
console.log(`Frontend mode: ${mode}`)

const firebasercPath = resolve('.firebaserc')
if (!existsSync(firebasercPath)) {
  fail('.firebaserc not found')
}

let firebaserc
try {
  firebaserc = JSON.parse(readFileSync(firebasercPath, 'utf8'))
} catch (error) {
  fail(`Invalid .firebaserc JSON: ${String(error)}`)
}

const projects = firebaserc?.projects ?? {}
const aliasProjectId = projects[projectAlias]
if (!aliasProjectId) {
  fail(`.firebaserc is missing alias "${projectAlias}"`)
}
pass(`.firebaserc alias exists: ${projectAlias} -> ${aliasProjectId}`)

if (projects.default === 'demo-hybrid-horse-race') {
  warn('default Firebase project is still demo-hybrid-horse-race (change before real deploy)')
}

if (typeof aliasProjectId === 'string' && placeholderFragments.some((p) => aliasProjectId.includes(p))) {
  fail(`Firebase alias "${projectAlias}" still points to placeholder project id: ${aliasProjectId}`)
}

if (aliasProjectId === 'demo-hybrid-horse-race') {
  fail(`Firebase alias "${projectAlias}" points to demo project`)
}

const envFilePath = resolve(`frontend/.env.${mode}`)
if (!existsSync(envFilePath)) {
  fail(`Missing env file: frontend/.env.${mode} (copy from frontend/.env.${mode}.example)`)
}
pass(`Env file exists: frontend/.env.${mode}`)

const envMap = parseSimpleEnvFile(readFileSync(envFilePath, 'utf8'))
for (const key of requiredEnvKeys) {
  const value = envMap.get(key)
  if (!value) fail(`Missing required env key: ${key} in frontend/.env.${mode}`)
  if (placeholderFragments.some((p) => value.includes(p))) {
    fail(`Env key ${key} still uses placeholder value in frontend/.env.${mode}`)
  }
}
pass('Required Firebase env keys are present and not placeholders')

const emulatorEnabled = envMap.get('VITE_USE_FIREBASE_EMULATOR')
if (emulatorEnabled !== 'false') {
  fail(`VITE_USE_FIREBASE_EMULATOR must be false for deploy (current: ${emulatorEnabled ?? 'missing'})`)
}
pass('VITE_USE_FIREBASE_EMULATOR=false')

const mockFallbackEnabled = envMap.get('VITE_ENABLE_MOCK_ROOM_FALLBACK')
if (mockFallbackEnabled !== 'false') {
  fail(
    `VITE_ENABLE_MOCK_ROOM_FALLBACK must be false for deploy (current: ${mockFallbackEnabled ?? 'missing'})`,
  )
}
pass('VITE_ENABLE_MOCK_ROOM_FALLBACK=false')

if (configOnly) {
  console.log('\nConfig-only checks completed.')
  process.exit(0)
}

const frontendBuildCommand =
  mode === 'production'
    ? 'npm run build --prefix frontend'
    : `npm run build --prefix frontend -- --mode ${mode}`

const commands = ['npm run build --prefix functions', frontendBuildCommand, 'npm run test --prefix frontend -- --run']

if (!hasFlag('--skip-contract')) {
  commands.push('npm run contract:check')
}
if (!hasFlag('--skip-golden')) {
  commands.push('npm run test --prefix frontend -- --run src/engine/race/horse-shared-core.golden.test.ts')
}
if (!hasFlag('--skip-doctor')) {
  commands.push('npm run doctor:runtime')
}

for (const command of commands) {
  runCommand(command)
}

console.log('\nPASS | Predeploy verification completed')
