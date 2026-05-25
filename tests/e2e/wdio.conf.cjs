// E2E tests for Script Toolbox using tauri-driver + WebdriverIO.
//
// Prerequisites:
//   cargo install tauri-driver          (one-time)
//   make build                          (must build release binary first)
//
// Run: make test-e2e

const { spawn } = require('child_process')
const path = require('path')

const binary = path.join(
  __dirname, '..', '..',
  'src-tauri', 'target', 'release', 'script-toolbox'
)

let tauriDriver

exports.config = {
  port: 4444,
  specs: [path.join(__dirname, 'specs', '**', '*.spec.cjs')],
  maxInstances: 1,
  capabilities: [{
    maxInstances: 1,
    'tauri:options': { application: binary },
  }],
  logLevel: 'warn',
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 30000 },

  beforeSession: () => {
    tauriDriver = spawn('tauri-driver', [], { stdio: [null, process.stdout, process.stderr] })
  },
  afterSession: () => tauriDriver?.kill(),
}
