import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole game — code, styles, photos — into one standalone
// dist/index.html that runs offline by double-clicking it.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100 * 1024 * 1024, // inline every image as a data URL
    cssCodeSplit: false,
    chunkSizeWarningLimit: 10000,
  },
});
