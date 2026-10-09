import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFiles, makeIndexes, privateFetch, summarize, treeRows, RemoteSource, ApiError, REPO, GAME_ROOT, MOD_ROOT} from '../local-files.mjs';

const file = (name, content = 'sample') => ({name: name.split('/').at(-1), webkitRelativePath: name, size: content.length});

test('imports game files from a directory without importing unrelated files', () => {
  const rows = selectFiles([file('game/dig.la0'), file('game/dig.la1'), file('game/VIDEO/sq1.san'), file('game/token.txt')], 'game');
  assert.deepEqual(rows.map(row => row.path), [GAME_ROOT + 'DIG.LA0', GAME_ROOT + 'DIG.LA1', GAME_ROOT + 'VIDEO/SQ1.SAN']);
  assert.throws(() => selectFiles([file('game/DIG.LA0')], 'game'), /DIG.LA1/);
});

test('HD references and prompts are excluded; an incomplete mod is rejected', () => {
  const rows = selectFiles([file('gpt/mod.json'), file('gpt/rooms/room022.png'), file('gpt/rooms/room022_idx.png'), file('gpt/prompt.txt'), file('gpt/referanse.png')], 'mod');
  assert.equal(rows.length, 3);
  assert.throws(() => selectFiles([file('gpt/mod.json')], 'mod'), /HD-mappen/);
  assert.throws(() => selectFiles([file('gpt/mod.json'), file('gpt/rooms/room022.png'), file('gpt/rooms/room022.png')], 'mod'), /samme navn/);
});

test('HD objects and figure cels are imported and counted without their _idx files', () => {
  const rows = selectFiles([
    file('gpt/mod.json'), file('gpt/rooms/room022.png'), file('gpt/rooms/room022_idx.png'),
    file('gpt/objects/obj097_0a.png'), file('gpt/objects/obj097_0a_idx.png'),
    file('gpt/costumes/costume014_003.png'), file('gpt/costumes/costume014_003_idx.png'),
    file('gpt/costumes/costume014_016.png'), file('gpt/costumes/costume014_016_idx.png'),
    file('gpt/SHA256SUMS'), file('gpt/README.md')], 'mod');
  assert.equal(rows.length, 9);
  assert.ok(rows.some(row => row.path === MOD_ROOT + 'costumes/costume014_016_idx.png'));
  const sum = summarize(rows, '2026-10-09 09:49');
  assert.deepEqual([sum.rooms, sum.objects, sum.cels, sum.created], [1, 1, 2, '2026-10-09 09:49']);
  assert.equal(sum.bytes, 9 * 'sample'.length);
});

test('ScummVM directory indexes combine local game/HD files with built-in themes', () => {
  const indexes = makeIndexes([{path: GAME_ROOT + 'VIDEO/SQ1.SAN', size: 45}, {path: MOD_ROOT + 'rooms/room022.png', size: 23}], {'scummmodern.zip': 99});
  assert.deepEqual(indexes.get('/data/index.json'), {'scummmodern.zip': 99, games: {}, mods: {}});
  assert.deepEqual(indexes.get('/data/games/dig/VIDEO/index.json'), {'SQ1.SAN': 45});
  assert.deepEqual(indexes.get('/data/mods/gpt/rooms/index.json'), {'room022.png': 23});
});

test('private data and missing private files never reach the network; themes use the Pages prefix', async () => {
  const requests = [];
  const base = new URL('https://example.github.io/Dig-HD-Web/');
  const fetch = privateFetch({read: async path => path.endsWith('DIG.LA0') ? new Blob(['local']) : undefined}, makeIndexes([{path: GAME_ROOT + 'DIG.LA0', size: 5}]), base, async url => {
    requests.push(String(url)); return new Response('network');
  });
  assert.equal(await (await fetch(GAME_ROOT + 'DIG.LA0')).text(), 'local');
  assert.equal((await fetch(GAME_ROOT + 'missing.BUN')).status, 404);
  assert.equal((await fetch(MOD_ROOT + 'missing.png')).status, 404);
  assert.deepEqual(requests, []);
  assert.equal(await (await fetch('/data/scummmodern.zip')).text(), 'network');
  assert.deepEqual(requests, ['https://example.github.io/Dig-HD-Web/data/scummmodern.zip']);
});

const tree = [
  {path: 'README.md', type: 'blob', sha: 'r', size: 10},
  {path: 'game', type: 'tree', sha: 't'},
  {path: 'game/DIG.LA0', type: 'blob', sha: 'a0', size: 5},
  {path: 'game/DIG.LA1', type: 'blob', sha: 'a1', size: 7},
  {path: 'game/VIDEO/SQ1.SAN', type: 'blob', sha: 's1', size: 9},
  {path: 'game/SHA256SUMS', type: 'blob', sha: 'x', size: 3}
];
const modTree = [
  {path: 'mod.json', type: 'blob', sha: 'm', size: 4},
  {path: 'rooms/room022.png', type: 'blob', sha: 'r22', size: 6},
  {path: 'costumes/costume014_003.png', type: 'blob', sha: 'c3', size: 8},
  {path: 'SHA256SUMS', type: 'blob', sha: 'y', size: 3}
];

test('git tree listings become the same paths as chosen folders, with blob ids', () => {
  assert.deepEqual(treeRows(tree, 'game/', 'game'), [
    {path: GAME_ROOT + 'DIG.LA0', size: 5, sha: 'a0'},
    {path: GAME_ROOT + 'DIG.LA1', size: 7, sha: 'a1'},
    {path: GAME_ROOT + 'VIDEO/SQ1.SAN', size: 9, sha: 's1'}]);
  assert.deepEqual(treeRows(modTree, '', 'mod').map(row => row.path),
    [MOD_ROOT + 'mod.json', MOD_ROOT + 'rooms/room022.png', MOD_ROOT + 'costumes/costume014_003.png']);
});

function memoryLibrary() {
  const blobs = new Map(), meta = new Map();
  return {
    blobs,
    getBlob: async sha => blobs.get(sha),
    putBlob: async (sha, blob) => { blobs.set(sha, blob); },
    getMeta: async key => meta.get(key),
    setMeta: async (key, value) => { meta.set(key, value); }
  };
}

function github(requests, status = 200) {
  return async (url, options) => {
    requests.push({url: String(url), auth: options?.headers?.Authorization, accept: options?.headers?.Accept});
    if (status !== 200) return new Response('{}', {status});
    const u = new URL(url);
    if (u.pathname.endsWith('/git/trees/spilldata')) return Response.json({tree, truncated: false});
    if (u.pathname.endsWith('/git/trees/hd-mod')) return Response.json({tree: modTree, truncated: false});
    if (u.pathname.includes('/git/blobs/')) return new Response('blob ' + u.pathname.split('/').at(-1));
    return new Response('', {status: 404});
  };
}

test('files come from the private branches with the key, once per blob id', async () => {
  const requests = [];
  const library = memoryLibrary();
  const source = new RemoteSource(library, 'KEY', github(requests));
  const rows = await source.list();
  assert.equal(rows.length, 6);
  assert.ok(requests.every(r => r.url.startsWith('https://api.github.com/repos/' + REPO + '/') && r.auth === 'Bearer KEY'));
  assert.equal(await (await source.read(GAME_ROOT + 'DIG.LA1')).text(), 'blob a1');
  assert.equal(await (await source.read(GAME_ROOT + 'DIG.LA1')).text(), 'blob a1');
  assert.equal(requests.filter(r => r.url.includes('/git/blobs/a1')).length, 1);
  assert.equal(requests.find(r => r.url.includes('/git/blobs/')).accept, 'application/vnd.github.raw+json');
  assert.equal(await source.read(GAME_ROOT + 'DIGMUSIC.BUN'), undefined);
  assert.equal(requests.length, 3);

  // Offline: the last list is used, and kept files still work
  const offline = new RemoteSource(library, 'KEY', async () => { throw new TypeError('Failed to fetch'); });
  assert.equal((await offline.list()).length, 6);
  assert.equal(await (await offline.read(GAME_ROOT + 'DIG.LA1')).text(), 'blob a1');
});

test('a key GitHub does not accept gives an error the page can show', async () => {
  for (const status of [401, 404]) {
    const source = new RemoteSource(memoryLibrary(), 'BAD', github([], status));
    await assert.rejects(source.list(), error => error instanceof ApiError && error.status === status);
  }
});

test('with the private branches, game paths never go to the site', async () => {
  const requests = [];
  const source = new RemoteSource(memoryLibrary(), 'KEY', github(requests));
  const rows = await source.list();
  const base = new URL('https://example.github.io/Dig-HD-Web/');
  const site = [];
  const fetch = privateFetch(source, makeIndexes(rows), base, async url => { site.push(String(url)); return new Response('x'); });
  assert.equal(await (await fetch(GAME_ROOT + 'DIG.LA0')).text(), 'blob a0');
  assert.equal((await fetch(GAME_ROOT + 'DIGVOICE.BUN')).status, 404);
  assert.equal((await fetch(MOD_ROOT + 'rooms/room023.png')).status, 404);
  assert.deepEqual(site, []);
});
