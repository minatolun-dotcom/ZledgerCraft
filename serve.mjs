// ZledgerCraft - dependency-free static server with a local SQLite workspace.
import { createServer } from 'node:http';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const dataDir = join(root, 'data');
const legacyWorkspaceFile = join(dataDir, 'workspace.json');
const workspaceDbFile = join(dataDir, 'workspace.sqlite');
const BODY_LIMIT = 20 * 1024 * 1024;
let workspaceWriteQueue = Promise.resolve();

let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  // Older Node releases fall back to the revisioned JSON file.
}

let db = null;
let storage = 'json';
let selectWorkspace = null;
let upsertWorkspace = null;
let clearWorkspaceRow = null;

if (DatabaseSync) {
  await mkdir(dataDir, { recursive: true });
  db = new DatabaseSync(workspaceDbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rev INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      state TEXT NOT NULL
    );
  `);
  selectWorkspace = db.prepare('SELECT rev, updated_at, state FROM workspace WHERE id = 1');
  upsertWorkspace = db.prepare(`
    INSERT INTO workspace (id, rev, updated_at, state)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rev = excluded.rev,
      updated_at = excluded.updated_at,
      state = excluded.state
  `);
  clearWorkspaceRow = db.prepare('DELETE FROM workspace WHERE id = 1');
  storage = 'sqlite';
  await migrateLegacyWorkspace();
}

async function migrateLegacyWorkspace() {
  if (selectWorkspace.get()) return;
  let raw;
  try {
    raw = await readFile(legacyWorkspaceFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    throw new Error('Legacy workspace.json is not valid JSON. Fix or remove it before starting the server.');
  }
  if (!saved?.state || !Array.isArray(saved.state.companies)) {
    throw new Error('Legacy workspace.json has no company state. Fix or remove it before starting the server.');
  }
  const rev = Math.max(1, Number(saved.rev) || 0);
  const updatedAt = saved.updatedAt || new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertWorkspace.run(rev, updatedAt, JSON.stringify(saved.state));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  try {
    await rename(legacyWorkspaceFile, `${legacyWorkspaceFile}.migrated`);
  } catch {
    // The SQLite row is authoritative even if the legacy rename fails.
  }
  console.log(`Migrated ${legacyWorkspaceFile} into ${workspaceDbFile} at revision ${rev}.`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = resolve(join(root, normalize(relative)));
  return target.startsWith(root) ? target : null;
}

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error('Workspace body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonEnvelope() {
  try {
    const raw = await readFile(legacyWorkspaceFile, 'utf8');
    const saved = JSON.parse(raw);
    return {
      state: saved.state ?? null,
      rev: Number.isInteger(Number(saved.rev)) ? Number(saved.rev) : 0,
      updatedAt: saved.updatedAt ?? null,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: null, rev: 0, updatedAt: null };
    throw error;
  }
}

async function readWorkspaceEnvelope() {
  if (!db) return readJsonEnvelope();
  const row = selectWorkspace.get();
  if (!row) return { state: null, rev: 0, updatedAt: null };
  return {
    state: JSON.parse(row.state),
    rev: Number(row.rev),
    updatedAt: row.updated_at,
  };
}

function enqueueWorkspaceWrite(task) {
  const run = workspaceWriteQueue.then(task, task);
  workspaceWriteQueue = run.catch(() => {});
  return run;
}

async function writeWorkspace(state, baseRev) {
  const updatedAt = new Date().toISOString();
  if (db) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = selectWorkspace.get();
      const currentRev = row ? Number(row.rev) : 0;
      if (currentRev !== baseRev) {
        db.exec('ROLLBACK');
        return { conflict: true, rev: currentRev, updatedAt: row?.updated_at ?? null };
      }
      upsertWorkspace.run(baseRev + 1, updatedAt, JSON.stringify(state));
      db.exec('COMMIT');
      return { conflict: false, rev: baseRev + 1, updatedAt };
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // The transaction may already have been rolled back.
      }
      throw error;
    }
  }

  const current = await readJsonEnvelope();
  if (current.rev !== baseRev) {
    return { conflict: true, rev: current.rev, updatedAt: current.updatedAt };
  }
  await mkdir(dataDir, { recursive: true });
  const temp = `${legacyWorkspaceFile}.tmp`;
  const saved = { version: 2, rev: baseRev + 1, updatedAt, state };
  await writeFile(temp, JSON.stringify(saved), 'utf8');
  await rename(temp, legacyWorkspaceFile);
  return { conflict: false, rev: saved.rev, updatedAt };
}

async function handleWorkspaceApi(request, response, url) {
  if (request.method === 'GET') {
    try {
      const saved = await readWorkspaceEnvelope();
      if (url.searchParams.get('meta') === '1') {
        json(response, 200, { ok: true, rev: saved.rev, updatedAt: saved.updatedAt, storage });
      } else {
        json(response, 200, {
          ok: true,
          state: saved.state,
          rev: saved.rev,
          updatedAt: saved.updatedAt,
          storage,
        });
      }
    } catch {
      json(response, 500, { ok: false, error: 'Could not read the server workspace.' });
    }
    return;
  }
  if (request.method === 'PUT') {
    try {
      const body = JSON.parse(await readBody(request));
      if (!body || !body.state || !Array.isArray(body.state.companies)) {
        json(response, 400, { ok: false, error: 'Workspace state must contain companies.' });
        return;
      }
      const baseRev = Number(body.baseRev);
      if (!Number.isInteger(baseRev) || baseRev < 0) {
        json(response, 400, { ok: false, error: 'A workspace base revision is required.' });
        return;
      }
      const result = await enqueueWorkspaceWrite(() => writeWorkspace(body.state, baseRev));
      if (result.conflict) {
        json(response, 409, {
          ok: false,
          code: 'conflict',
          error: 'The server workspace changed since this copy was loaded.',
          rev: result.rev,
          updatedAt: result.updatedAt,
          storage,
        });
        return;
      }
      json(response, 200, { ok: true, rev: result.rev, updatedAt: result.updatedAt, storage });
    } catch (error) {
      json(response, 400, { ok: false, error: error.message || 'Could not save the server workspace.' });
    }
    return;
  }
  if (request.method === 'DELETE') {
    try {
      await enqueueWorkspaceWrite(async () => {
        if (db) {
          clearWorkspaceRow.run();
          return;
        }
        try {
          await unlink(legacyWorkspaceFile);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      });
    } catch {
      json(response, 500, { ok: false, error: 'Could not clear the server workspace.' });
      return;
    }
    json(response, 200, { ok: true, rev: 0, storage });
    return;
  }
  response.writeHead(405, { allow: 'GET, PUT, DELETE' });
  response.end();
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  const pathname = requestUrl.pathname;
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  if (pathname === '/api/workspace') {
    await handleWorkspaceApi(request, response, requestUrl);
    return;
  }
  if (decodedPath === '/data' || decodedPath.startsWith('/data/')) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  const target = resolvePath(request.url ?? '/');
  if (!target) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Not found: ${request.url}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ZledgerCraft running at http://127.0.0.1:${port}/ (${storage} workspace)`);
});
