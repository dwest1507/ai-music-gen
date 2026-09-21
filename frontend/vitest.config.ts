import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'path'

export default defineConfig({
    // @vitejs/plugin-react 6 dropped its `babel` option; React Compiler now runs
    // as a separate Babel pass. `reactCompilerPreset()` targets React 19 by
    // default, which is what the old `{ target: "19" }` asked for.
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
    ],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './vitest.setup.ts',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
