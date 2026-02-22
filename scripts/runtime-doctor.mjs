const nodeMajor = Number(process.versions.node.split('.')[0] || '0')

const checks = [
  {
    name: 'Node.js major version (recommended: 22 for Functions emulator parity)',
    ok: nodeMajor === 22,
    detail: `current=${process.versions.node}`,
  },
]

console.log('Runtime Doctor')
console.log('==============')
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'WARN'} | ${check.name} | ${check.detail}`)
}

if (!checks.every((check) => check.ok)) {
  console.log('\nGuidance:')
  console.log('- Use Node 22 (e.g. nvm/volta) before running emulators/deploy for highest parity.')
  console.log('- Current mismatch may still run locally, but can produce emulator warnings.')
}
