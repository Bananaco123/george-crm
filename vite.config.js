import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('./', import.meta.url));
const hasLocalModules = existsSync(new URL('./node_modules/', import.meta.url));
const dependencyManifest = hasLocalModules
  ? new URL('./package.json', import.meta.url)
  : new URL('../GOS V1.0/demo V1.3/package.json', import.meta.url);
const dependencyRequire = createRequire(dependencyManifest);
const { default: react } = await import(pathToFileURL(dependencyRequire.resolve('@vitejs/plugin-react')).href);

// The workspace fallback reads existing packages; a normal npm install is fully independent.
const aliases = hasLocalModules ? [] : [
  { find: /^react(?=\/|$)/, replacement: dirname(dependencyRequire.resolve('react/package.json')) },
  { find: /^react-dom(?=\/|$)/, replacement: dirname(dependencyRequire.resolve('react-dom/package.json')) },
];

export default {
  root: projectRoot,
  // 相对资源路径兼容 GitHub Pages 的仓库子目录。
  base: './',
  cacheDir: '.vite',
  plugins: [react()],
  resolve: { alias: aliases, dedupe: ['react', 'react-dom'] },
  server: {
    host: 'localhost',
    port: 5188,
    strictPort: true,
    fs: { allow: [projectRoot, dirname(fileURLToPath(dependencyManifest))] },
  },
  preview: { host: 'localhost', port: 5188, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
};
