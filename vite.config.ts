import { defineConfig } from 'vite';

// Classic IIFE bundle. build-preview.mjs embeds it (including its styles) in one HTML.
export default defineConfig({
  base: './',
  build: { rolldownOptions: { output: { format: 'iife' } } },
  plugins: [{
    name: 'offline-html', apply: 'build',
    transformIndexHtml: { order: 'post', handler: html => html.replace('type="module"', 'defer').replaceAll(' crossorigin', '') },
  }],
});
