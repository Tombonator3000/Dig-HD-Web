import {LocalLibrary, RemoteSource, ApiError, makeIndexes, privateFetch, blobIds} from './local-files.mjs';
import {attachTouch} from './touch.mjs';

// The page goes straight into the game. Only the first time (no key and no
// chosen folders) it asks for the read-only key to the private repository.
// HD or original graphics is chosen in the game's own menu (F5).

const baseURL = new URL('./', location.href);
const library = new LocalLibrary(baseURL.pathname);
const networkFetch = window.fetch.bind(window);
const query = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const canvas = $('canvas');
const statusElement = $('status');
let started = false;

function status(text = '', error = false) {
  statusElement.textContent = text;
  statusElement.hidden = !text;
  statusElement.classList.toggle('error', error);
}

function showScreen(id) {
  for (const screen of ['key', 'ended']) $(screen).hidden = screen !== id;
}

function showKey(message = '') {
  showScreen('key');
  status();
  $('key-error').textContent = message;
  $('key-error').hidden = !message;
  $('token').focus();
}

function megabytes(bytes) {
  return Math.round(bytes / 1048576);
}

// Big files are fetched once and kept. The game waits for them, so the screen
// says what is coming and how far it has come.
const fileNames = {'DIGMUSIC.BUN': 'musikken', 'DIGVOICE.BUN': 'talen', 'DIG.LA1': 'spillet'};
function progress(name, done, size) {
  if (done >= size) {
    $('loading').hidden = true;
    return;
  }
  const what = fileNames[name] || (/\.SAN$/.test(name) ? 'filmen' : name);
  $('loading-text').textContent = 'Laster ned ' + what + ': ' + megabytes(done) + ' av ' + megabytes(size) + ' MB';
  $('loading-bar').style.width = (100 * done / size).toFixed(1) + '%';
  $('loading').hidden = false;
}

// WebGL draws the game. Without it, ScummVM's software drawing is used.
function hasWebGL() {
  try {
    const test = document.createElement('canvas');
    return Boolean(test.getContext('webgl2') || test.getContext('webgl'));
  } catch {
    return false;
  }
}

// The whole screen: browsers allow it only after a click or a key, so it comes
// with the first one. In Chrome and Edge Esc then still reaches the game (skip a
// scene); holding Esc leaves full screen. Firefox leaves full screen on Esc, and
// the next click or key brings it back.
function fullscreen() {
  if (!started || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({navigationUI: 'hide'})
    .then(() => navigator.keyboard?.lock?.(['Escape']))
    .catch(() => {});
}
window.addEventListener('mousedown', fullscreen, true);
window.addEventListener('keydown', fullscreen, true);

// The connection is gone; the game waits and the file is tried again
function waiting(seconds) {
  status('Mistet kontakten med GitHub. Prøver igjen om ' + seconds + ' s …');
}

$('key').addEventListener('submit', async event => {
  event.preventDefault();
  const token = $('token').value.trim();
  if (!token) return;
  $('token').value = '';
  await library.setMeta('token', token);
  // Keeps the game in the browser when space runs low
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => false);
  startRemote(token);
});

$('folders-link').addEventListener('click', () => { $('folders').hidden = false; });
for (const kind of ['game', 'mod']) {
  $(kind + '-files').addEventListener('change', async event => {
    if (!event.target.files.length) return;
    status(kind === 'game' ? 'Lagrer spillfilene i nettleseren …' : 'Lagrer HD-grafikken i nettleseren …');
    try {
      await library.import(event.target.files, kind);
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      if (library.metadata.game && library.metadata.mod) {
        // Folders on this machine instead of the repository
        await library.setMeta('token', undefined);
        startLocal();
      } else {
        status('Velg ' + (kind === 'game' ? 'HD-mappen' : 'spillmappen') + ' også.');
      }
    } catch (error) {
      status(error.name === 'QuotaExceededError' ? 'Nettleseren har ikke nok lagringsplass.' : error.message, true);
    } finally {
      event.target.value = '';
    }
  });
}

$('again').addEventListener('click', () => location.reload());

async function startRemote(token) {
  showScreen(null);
  status('Henter fillisten fra GitHub …');
  const source = new RemoteSource(library, token, networkFetch, {progress, waiting});
  let rows;
  try {
    rows = await source.list();
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      await library.setMeta('token', undefined);
      showKey(error.message);
    } else {
      status(error instanceof TypeError ? 'Fikk ikke kontakt med GitHub. Sjekk nettet og last siden på nytt.' : error.message, true);
    }
    return;
  }
  // Music and speech (391 MB) stay in memory while the game runs. Left out
  // with ?uten-lyd, and on devices that report less than 4 GB memory.
  const withoutSound = query.has('uten-lyd') || (navigator.deviceMemory && navigator.deviceMemory < 4);
  await launch(source, withoutSound ? rows.filter(row => !/\.BUN$/.test(row.path)) : rows);
  // Files an older HD pack had, are removed when the game has started
  setTimeout(() => library.pruneBlobs(blobIds(rows)).catch(() => {}), 30000);
}

function startLocal() {
  return launch(library, [...library.metadata.game.files, ...library.metadata.mod.files]);
}

function sendKey(key, code, keyCode) {
  canvas.focus();
  const dispatch = type => canvas.dispatchEvent(new KeyboardEvent(type, {key, code, keyCode, which: keyCode, bubbles: true, cancelable: true}));
  dispatch('keydown');
  // ScummVM reads the key while polling; let it stay down for a moment
  setTimeout(() => dispatch('keyup'), 120);
}

// Touch on phones and tablets (touch.mjs): tap, drag, hold, two and three fingers
const keys = {F5: ['F5', 'F5', 116], Escape: ['Escape', 'Escape', 27]};
attachTouch(canvas, name => sendKey(...keys[name]));

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  status('Grafikken i nettleseren ble borte. Last siden på nytt.', true);
});

async function launch(source, rows) {
  if (started) return;
  started = true;
  showScreen(null);
  status('Laster spillmotoren …');
  try {
    const response = await networkFetch(new URL('data/index.json', baseURL));
    if (!response.ok) throw new Error('Fant ikke spillmotorens data. Last siden på nytt.');
    const indexes = makeIndexes(rows, await response.json());
    // A file the game could not get is shown, not swallowed
    const reader = {read: path => source.read(path).then(blob => {
      if (/^Mistet kontakten/.test(statusElement.textContent)) status();
      return blob;
    }, error => { status(error.message, true); throw error; })};
    window.fetch = privateFetch(reader, indexes, baseURL, networkFetch);

    const env = {DIGHD_MOD: '/data/mods/gpt', HOME: '/home/dig-hd' + baseURL.pathname.replace(/[^a-zA-Z0-9_-]/g, '_')};
    if (query.has('rom')) {
      const room = Number(query.get('rom'));
      if (!Number.isInteger(room) || room < 1 || room > 111) throw new Error('Romnummeret må være mellom 1 og 111.');
      Object.assign(env, {DIGHD_TEST_ROOM: String(room), DIGHD_TEST_AT: '240', DIGHD_SKIP_VIDEO: '1'});
    }
    if (query.has('klassisk')) env.DIGHD_CLASSIC = '1';
    if (query.has('gult')) env.DIGHD_SHOW_MISSING = '1';
    // The engine's test hooks work here too (docs/HD-MOTOR.md)
    for (const [key, value] of query) if (/^DIGHD_(TEST_[A-Z0-9_]+|SKIP_VIDEO|TEXT|VERIFY|BENCH)$/.test(key)) env[key] = value;
    const args = ['--path=/data/games/dig', '--savepath=' + env.HOME, '--aspect-ratio', '--subtitles'];
    if (query.has('programvare') || !hasWebGL()) args.push('--gfx-mode=surfacesdl');
    args.push('dig');
    history.replaceState(null, '', location.pathname + location.search + '#' + args.join(' '));

    canvas.focus();
    // F5 is the game's menu, not reload; Ctrl+H is HD or classic, not history
    window.addEventListener('keydown', event => {
      if (/^F([1-9]|10)$/.test(event.key) || event.key === 'Tab' || event.key === 'Backspace' ||
          ((event.ctrlKey || event.altKey) && !event.metaKey && event.key.length === 1)) event.preventDefault();
    }, true);
    // The Dig uses digital audio, not MIDI. Avoid an unrelated browser permission.
    Object.defineProperty(navigator, 'requestMIDIAccess', {configurable: true, value: () => new Promise(() => {})});
    window.Module = {
      canvas,
      locateFile: path => new URL(path, baseURL).href,
      preRun: [() => {
        for (const [key, value] of Object.entries(env)) ENV[key] = value;
        FS.mkdirTree(env.HOME);
      }],
      onRuntimeInitialized: () => status('Starter The Dig …'),
      onAbort: text => status('Spillmotoren stoppet: ' + text, true),
      onExit: () => { status(); showScreen('ended'); },
      print: text => {
        console.log(text);
        if (/Could not load any graphics mode/.test(text)) {
          status('Nettleseren fikk ikke tegnet spillet. Slå på maskinvareakselerasjon i nettleseren, eller legg ?programvare bak adressen.', true);
        }
        // The canvas gets its right size after a resize event
        if (/^DigHD: screen /.test(text)) {
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (!statusElement.classList.contains('error')) status();
          }, 300);
        }
      },
      printErr: text => console.error(text),
      setStatus: text => { if (text) console.log(text); }
    };
    // An engine that stops must not leave the page looking like it is still starting
    window.addEventListener('error', event => status('Spillmotoren stoppet: ' + (event.message || 'ukjent feil'), true));
    window.addEventListener('unhandledrejection', event => {
      if (!statusElement.classList.contains('error')) status('Spillmotoren stoppet: ' + (event.reason?.message || event.reason || 'ukjent feil'), true);
    });
    const script = document.createElement('script');
    script.src = new URL('scummvm.js', baseURL).href;
    script.onerror = () => status('Spillmotoren kunne ikke lastes. Last siden på nytt.', true);
    document.body.appendChild(script);
  } catch (error) {
    started = false;
    window.fetch = networkFetch;
    status(error.message, true);
  }
}

try {
  if (!globalThis.WebAssembly) throw new Error('Denne nettleseren støtter ikke spillmotoren. Bruk en oppdatert Chrome, Edge eller Firefox.');
  await library.open();
  // ?ny-nokkel asks for a new key
  const token = query.has('ny-nokkel') ? null : await library.getMeta('token');
  if (token) await startRemote(token);
  else if (!query.has('ny-nokkel') && library.metadata.game && library.metadata.mod) await startLocal();
  else showKey();
} catch (error) {
  status('Kunne ikke starte: ' + error.message, true);
}
