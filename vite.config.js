import { defineConfig } from 'vite';
import { resolve, relative } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(__dirname, 'src');

function htmlPartialsPlugin() {
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(
          /<!--\s*@include:\s*([^\s]+)\s*-->/g,
          (_, file) => readFileSync(resolve(srcDir, file), 'utf-8')
        );
      }
    }
  };
}

function findHtmlEntries(dir) {
  const entries = {};
  function walk(current) {
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      if (statSync(full).isDirectory()) {
        // Exclude dev-only tool directories from the production build.
        // `_dev/` is the canonical exclusion primitive (FR32); any subdirectory
        // whose name starts with `_` is treated as dev-only and skipped.
        if (name.startsWith('_')) continue;
        walk(full);
      } else if (name === 'index.html' || name === '404.html') {
        const rel = relative(dir, full).replace(/\\/g, '/');
        const key = rel === 'index.html' ? 'main'
          : rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
        entries[key] = full;
      }
    }
  }
  walk(dir);
  return entries;
}

export default defineConfig({
  base: './',
  root: 'src',
  publicDir: '../public',
  plugins: [htmlPartialsPlugin()],
  server: {
    port: 5174,
    strictPort: false,  // fall back to next free port if 5174 is also taken
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: findHtmlEntries(srcDir)
    }
  }
});
