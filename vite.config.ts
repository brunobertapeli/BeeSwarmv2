import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'electron',
                'dotenv',
                'mongodb',
                '@supabase/supabase-js',
                'better-sqlite3',
                'simple-git',
                'node-pty',
                // MongoDB optional dependencies
                'kerberos',
                'mongodb-client-encryption',
                '@mongodb-js/zstd',
                'snappy',
                'socks',
                'aws4',
                'gcp-metadata',
                '@aws-sdk/credential-providers',
                '@aws-sdk/client-sso-oidc',
                'saslprep',
                'bson'
              ]
            }
          }
        }
      },
      {
        entry: 'electron/preload.js',
        onstart(options) {
          // Just copy the file directly without processing
          const src = path.resolve('electron/preload.js')
          const dest = path.resolve('dist-electron/preload.cjs')
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.copyFileSync(src, dest)
          options.reload()
        },
        vite: {
          build: {
            watch: {},
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload-unused.js'
              },
              plugins: [
                {
                  name: 'copy-preload',
                  writeBundle() {
                    const src = path.resolve('electron/preload.js')
                    const dest = path.resolve('dist-electron/preload.cjs')
                    fs.copyFileSync(src, dest)
                  }
                }
              ]
            }
          }
        }
      }
    ]),
    renderer()
  ],
  server: {
    port: 5173,
    hmr: {
      overlay: false
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
