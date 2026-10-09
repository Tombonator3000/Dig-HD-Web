import {LocalLibrary, RemoteSource, ApiError, makeIndexes, privateFetch} from './local-files.mjs';

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

// Big files are fetched once and kept; show how far it has come
function progress(name, done, size) {
  status(done < size ? 'Henter ' + name + ' første gang: ' + megabytes(done) + ' av ' + megabytes(size) + ' MB' : '');
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
  const source = new RemoteSource(library, token, networkFetch, progress);
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
  await launch(source, rows);
  // Files an older HD pack had, are removed when the game has started
  setTimeout(() => library.pruneBlobs(new Set(rows.map(row => row.sha))).catch(() => {}), 30000);
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

// Touch: two fingers open the game's menu (F5), three skip a scene (Esc)
let fingers = 0;
canvas.addEventListener('touchstart', event => {
  fingers = Math.max(fingers, event.touches.length);
  if (event.touches.length > 1) event.preventDefault();
}, {passive: false});
canvas.addEventListener('touchend', event => {
  if (event.touches.length) return;
  if (fingers === 2) sendKey('F5', 'F5', 116);
  else if (fingers === 3) sendKey('Escape', 'Escape', 27);
  fingers = 0;
});

// On a phone the game gets the whole screen, turned sideways, at the first touch
canvas.addEventListener('pointerdown', () => {
  if (!matchMedia('(pointer: coarse)').matches || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({navigationUI: 'hide'})
    .then(() => screen.orientation?.lock?.('landscape')?.catch(() => {}))
    .catch(() => {});
});

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
    const reader = {read: path => source.read(path).catch(error => { status(error.message, true); throw error; })};
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
    const args = ['--path=/data/games/dig', '--savepath=' + env.HOME, '--aspect-ratio', '--subtitles', 'dig'];
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
        // The canvas gets its right size after a resize event
        if (/^DigHD: screen /.test(text)) {
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (!statusElement.classList.contains('error') && !/^Henter /.test(statusElement.textContent)) status();
          }, 300);
        }
      },
      printErr: text => console.error(text),
      setStatus: text => { if (text) console.log(text); }
    };
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
