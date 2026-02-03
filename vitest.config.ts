import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    deps: {
      inline: [/lucide/]
    },
    alias: {
      'monaco-editor': resolve(__dirname, 'tests/mocks/monaco.ts')
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/*.spec.ts']
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, './src/renderer/src'),
      '@main': resolve(__dirname, './src/main'),
      '@preload': resolve(__dirname, './src/preload'),
      'monaco-editor': resolve(__dirname, 'tests/mocks/monaco.ts')
    }
  }
})
