import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2] ?? 'dev';

if (!['dev', 'build', 'preview'].includes(command)) {
  console.error('Usage: node scripts/run.mjs [dev|build|preview]');
  process.exit(1);
}

const dependencyRoot = existsSync(join(projectRoot, 'node_modules'))
  ? projectRoot
  : resolve(projectRoot, '../GOS V1.0/demo V1.3');
const dependencyRequire = createRequire(join(dependencyRoot, 'package.json'));

try {
  const vite = await import(pathToFileURL(dependencyRequire.resolve('vite')).href);
  const config = { root: projectRoot, configFile: join(projectRoot, 'vite.config.js'), configLoader: 'native' };

  if (command === 'build') {
    await vite.build(config);
  } else if (command === 'preview') {
    const server = await vite.preview(config);
    server.printUrls();
  } else {
    const server = await vite.createServer(config);
    await server.listen();
    server.printUrls();
    server.bindCLIShortcuts({ print: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (error?.code === 'MODULE_NOT_FOUND' || error?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('请在 George CRM 目录安装 package.json 中的依赖；工作区未安装依赖时会尝试复用 GOS Demo V1.3 工具链。');
  }
  process.exitCode = 1;
}
