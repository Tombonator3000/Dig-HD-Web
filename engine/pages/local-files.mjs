// Local game/HD files stay in IndexedDB. Only the ScummVM engine is downloaded.
export const GAME_ROOT = '/data/games/dig/';
export const MOD_ROOT = '/data/mods/gpt/';

export function selectFiles(files, kind) {
  const root = kind === 'game' ? GAME_ROOT : MOD_ROOT;
  const selected = new Map();
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    if (file.webkitRelativePath) parts.shift();
    if (parts.some(part => !part || part === '.' || part === '..')) continue;
    let relative = parts.join('/');
    if (kind === 'game') {
      relative = relative.toUpperCase();
      if (!/^(DIG\.(LA0|LA1)|DIG(MUSIC|VOICE)\.BUN|VIDEO\/[A-Z0-9_.-]+\.(SAN|NUT|TRS))$/.test(relative)) continue;
    } else {
      if (!/^(mod\.json|rooms\/room\d+(_idx)?\.png|objects\/obj\d+_[0-9a-fA-F]{2}(_idx)?\.png|costumes\/costume\d+_\d+(_idx)?\.png|san\/[A-Za-z0-9_-]+\/\d+\.png)$/.test(relative)) continue;
    }
    const path = root + relative;
    if (selected.has(path)) throw new Error('To filer har samme navn: ' + relative);
    selected.set(path, {path, size: file.size, blob: file});
  }
  if (kind === 'game' && (!selected.has(root + 'DIG.LA0') || !selected.has(root + 'DIG.LA1'))) {
    throw new Error('Velg mappen som inneholder DIG.LA0 og DIG.LA1.');
  }
  if (kind !== 'game' && (!selected.has(root + 'mod.json') || ![...selected.keys()].some(p => /\/rooms\/room\d+\.png$/.test(p)))) {
    throw new Error('Velg HD-mappen som inneholder mod.json og rooms.');
  }
  return [...selected.values()];
}

export function makeIndexes(rows, staticRoot = {}) {
  const indexes = new Map([['/data/index.json', {...staticRoot}]]);
  for (const {path, size} of rows) {
    const parts = path.split('/').filter(Boolean);
    if (parts.shift() !== 'data' || parts.some(p => p === '..' || p === '.')) throw new Error('Ugyldig filsti');
    let directory = '/data';
    for (let i = 0; i < parts.length; i++) {
      const key = directory + '/index.json';
      if (!indexes.has(key)) indexes.set(key, {});
      const index = indexes.get(key);
      index[parts[i]] = i === parts.length - 1 ? size : {};
      directory += '/' + parts[i];
    }
  }
  return indexes;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class LocalLibrary {
  constructor(basePath) {
    // GitHub Pages projects share an origin; keep this game's cache separate.
    this.name = 'dig-hd-files:' + basePath;
    this.db = null;
    this.metadata = {};
  }

  async open() {
    const request = indexedDB.open(this.name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', {keyPath: 'path'});
      request.result.createObjectStore('metadata');
    };
    this.db = await requestResult(request);
    this.db.onversionchange = () => this.db.close();
    const store = this.db.transaction('metadata').objectStore('metadata');
    const [game, mod] = await Promise.all(['game', 'mod'].map(key => requestResult(store.get(key))));
    this.metadata = {game, mod};
    return this.metadata;
  }

  async import(files, kind) {
    const rows = selectFiles(files, kind);
    let mod;
    if (kind === 'mod') {
      mod = JSON.parse(await rows.find(row => row.path === MOD_ROOT + 'mod.json').blob.text());
      if (mod.format !== 1 || mod.scale !== 4) throw new Error('HD-pakken må være i DigHD-format 1 med skala 4.');
    }
    const prefix = kind === 'game' ? GAME_ROOT : MOD_ROOT;
    const metadata = {
      files: rows.map(({path, size}) => ({path, size})),
      bytes: rows.reduce((sum, row) => sum + row.size, 0),
      rooms: rows.filter(row => /\/rooms\/room\d+\.png$/.test(row.path)).length,
      created: mod?.created || null
    };
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(['files', 'metadata'], 'readwrite');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Lagringen ble avbrutt.'));
      const store = tx.objectStore('files');
      // Replacement is atomic: a storage error preserves the previous usable set.
      store.delete(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      for (const row of rows) store.put({path: row.path, blob: row.blob});
      tx.objectStore('metadata').put(metadata, kind);
    });
    this.metadata[kind] = metadata;
    return metadata;
  }

  async read(path) {
    const row = await requestResult(this.db.transaction('files').objectStore('files').get(path));
    return row?.blob;
  }

  async clear() {
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(['files', 'metadata'], 'readwrite');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Slettingen ble avbrutt.'));
      tx.objectStore('files').clear();
      tx.objectStore('metadata').clear();
    });
    this.metadata = {};
  }
}

export function privateFetch(library, indexes, baseURL, networkFetch) {
  return async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, baseURL);
    if (url.origin !== baseURL.origin || !url.pathname.startsWith('/data/')) return networkFetch(input, options);
    const path = decodeURIComponent(url.pathname);
    const headers = {'Cache-Control': 'no-store'};
    if (indexes.has(path)) {
      headers['Content-Type'] = 'application/json';
      return new Response(JSON.stringify(indexes.get(path)), {headers});
    }
    if (path.startsWith(GAME_ROOT) || path.startsWith('/data/mods/')) {
      const blob = await library.read(path);
      // Never send a game/HD filename to GitHub or another server, even if missing.
      return new Response(blob || null, {status: blob ? 200 : 404, headers});
    }
    // Built-in ScummVM themes/translations use /data, but Pages has a project prefix.
    return networkFetch(new URL('data/' + path.slice('/data/'.length), baseURL), options);
  };
}
