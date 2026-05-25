// jsdom doesn't ship crypto.randomUUID; provide a counter-based stub
let seq = 0
if (!('randomUUID' in globalThis.crypto)) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `test-${++seq}-uuid`,
  })
}
