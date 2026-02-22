/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // 모든 네트워크 인터페이스에서 접근 가능
    port: 5173, // 기본 포트 (변경 가능)
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
  },
  build: {
    // Phaser 엔진 청크는 특성상 큰 편이므로 경고 임계값을 엔진 크기에 맞춘다.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'vendor-phaser'
          if (id.includes('node_modules/firebase')) return 'vendor-firebase'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          // NOTE:
          // Forcing every game component into a single `game-core` chunk caused a circular
          // dependency with `vendor-react` in production builds, which broke React namespace
          // initialization (`forwardRef` became undefined at runtime). Let Rollup split app
          // chunks naturally to avoid circular chunk init ordering issues.
          return undefined
        },
      },
    },
  },
})
