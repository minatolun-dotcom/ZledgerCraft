// Starts the real dependency-free server on an ephemeral port, then runs the
// browser suites against it. This keeps the app runtime dependency-free while
// making the external Playwright coverage reproducible.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = dirname(fileURLToPath(import.meta.url));
const root = join(toolsDir, '..', '..');
const mode = process.argv[2] === 'bench' ? 'bench' : 'test';
const browser = ['chromium', 'firefox', 'webkit'].includes(process.env.BROWSER)
  ? process.env.BROWSER
  : 'chromium';
const artifacts = join(toolsDir, '.artifacts', browser);
rmSync(artifacts, { recursive: true, force: true });
mkdirSync(artifacts, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-browser-'));

let server;
let base = '';

function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  server = null;
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error(`Server did not start:\n${output}`));
    }, 15_000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/ZledgerCraft running at (https?:\/\/[^ ]+)/);
      if (!match) return;
      clearTimeout(timer);
      server.stdout.off('data', onData);
      resolve(match[1]);
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}:\n${output}`));
    });
  });
}

function runScript(name) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${browser}: ${name}`);
    const child = spawn(process.execPath, [join(toolsDir, name)], {
      cwd: root,
      env: {
        ...process.env,
        AUDIT_BASE: base,
        AUDIT_OUT: artifacts,
        BROWSER: browser,
      },
      stdio: 'inherit',
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${name} exceeded the 120 second limit`));
    }, 120_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${name} failed with exit ${code}`));
    });
  });
}


const scripts = mode === 'bench' ? ['benchmark.cjs'] : [
  'ca-core.cjs',
  'ca-advanced.cjs',
  'render.cjs',
  'login-reset.cjs',
  'axe.cjs',
  'workspace-conflict.cjs',
];

try {
  server = spawn(process.execPath, ['serve.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      ZL_DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await waitForServer();
  console.log(`Server ${base} browser=${browser} mode=${mode}`);
  for (const script of scripts) await runScript(script);
  console.log(`\nBrowser ${mode} passed for ${browser}. Artifacts: ${artifacts}`);
} catch (error) {
  console.error(`\nBrowser ${mode} failed for ${browser}: ${error.message}`);
  process.exitCode = 1;
} finally {
  stopServer();
  rmSync(dataDir, { recursive: true, force: true });
}
