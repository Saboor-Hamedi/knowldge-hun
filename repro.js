// Hack to fix electron module resolution
const originalPaths = module.paths
module.paths = module.paths.filter((p) => !p.includes('node_modules'))

let electron
try {
  electron = require('electron')
} catch (e) {
  console.log('Failed to require electron without node_modules:', e.message)
}

// Restore paths
module.paths = originalPaths

if (!electron || typeof electron === 'string') {
  console.log('Still string or undefined, trying paths hack...')
  // If that failed, maybe we need to be more aggressive?
  // But checking if 'electron' is just invalid.
  electron = require('electron')
}

console.log('electron type:', typeof electron)
if (typeof electron === 'object') {
  console.log('SUCCESS! app defined:', !!electron.app)
} else {
  console.log('FAIL. Resolved to:', electron)
}
