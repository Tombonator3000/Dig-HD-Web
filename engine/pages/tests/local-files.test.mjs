import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFiles, makeIndexes, privateFetch, GAME_ROOT, MOD_ROOT} from '../local-files.mjs';

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
