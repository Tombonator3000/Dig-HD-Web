import {LocalLibrary, makeIndexes, privateFetch, summarize} from './local-files.mjs';

const baseURL = new URL('./', location.href);
const library = new LocalLibrary(baseURL.pathname);
const networkFetch = window.fetch.bind(window);
const statusElement = document.querySelector('#status');
const startButton = document.querySelector('#start');
const clearButton = document.querySelector('#clear');
const canvas = document.querySelector('#canvas');
let busy = true;

function status(text = '', error = false) {
  statusElement.textContent = text;
  statusElement.hidden = !text;
  statusElement.classList.toggle('error', error);
}

function refresh() {
  for (const kind of ['game', 'mod']) {
    const item = library.metadata[kind];
    const element = document.querySelector('#' + kind + '-state');
    element.classList.toggle('ready', Boolean(item));
    if (!item) {
      element.textContent = kind === 'game' ? 'Ingen spillfiler valgt' : 'Ingen HD-pakke valgt';
    } else if (kind === 'mod') {
      // Counted from the file list, so a pack chosen before the counts existed shows them too.
      const sum = summarize(item.files, item.created);
      const parts = [sum.rooms + ' HD-rom'];
      if (sum.objects) parts.push(sum.objects + ' objektbilder');
      if (sum.cels) parts.push(sum.cels + ' figurruter');
      element.textContent = parts.join(', ') + ' · ' + Math.round(sum.bytes / 1048576) + ' MB' + (sum.created ? ' · laget ' + sum.created : '');
    } else {
      const paths = new Set(item.files.map(file => file.path.split('/').at(-1)));
      element.textContent = 'Spillfiler klare · ' + (paths.has('DIGMUSIC.BUN') ? 'musikk' : 'uten musikk') + ' · ' + (paths.has('DIGVOICE.BUN') ? 'tale' : 'uten tale');
    }
  }
  startButton.disabled = busy || !library.metadata.game || !library.metadata.mod;
  clearButton.disabled = busy || !(library.metadata.game || library.metadata.mod);
  document.querySelectorAll('input[type=file]').forEach(input => input.disabled = busy);
}

for (const kind of ['game', 'mod']) {
  document.querySelector('#' + kind + '-files').addEventListener('change', async event => {
    if (!event.target.files.length || busy) return;
    busy = true;
    refresh();
    status('Lagrer ' + (kind === 'game' ? 'spillfilene' : 'HD-grafikken') + ' i nettleseren …');
    try {
      await library.import(event.target.files, kind);
      // Persistence protects large game libraries from automatic storage eviction.
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      status('Filene er klare og blir på denne maskinen.');
    } catch (error) {
      status(error.name === 'QuotaExceededError' ? 'Nettleseren har ikke nok lagringsplass. Frigjør plass og velg mappen igjen.' : error.message, true);
    } finally {
      event.target.value = '';
      busy = false;
      refresh();
    }
  });
}

clearButton.addEventListener('click', async () => {
  busy = true;
  refresh();
  try {
    await library.clear();
    status('Spillfilene og HD-pakken er fjernet fra nettleseren. Lagrede spill er beholdt.');
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    refresh();
  }
});

function sendKey(key, code, keyCode, ctrlKey = false) {
  canvas.focus();
  // SDL tracks modifier key presses; ctrlKey on H alone does not set its state.
  if (ctrlKey) canvas.dispatchEvent(new KeyboardEvent('keydown', {key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, ctrlKey: true, bubbles: true}));
  const dispatch = type => canvas.dispatchEvent(new KeyboardEvent(type, {key, code, keyCode, which: keyCode, ctrlKey, bubbles: true, cancelable: true}));
  dispatch('keydown');
  // ScummVM samples SDL's modifier state while polling the queued key event.
  setTimeout(() => {
    dispatch('keyup');
    if (ctrlKey) canvas.dispatchEvent(new KeyboardEvent('keyup', {key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, bubbles: true}));
  }, 120);
}
document.querySelector('#hd-toggle').addEventListener('click', () => sendKey('h', 'KeyH', 72, true));
document.querySelector('#menu').addEventListener('click', () => sendKey('F5', 'F5', 116));
document.querySelector('#fullscreen').addEventListener('click', () => {
  const player = document.querySelector('#player');
  const action = document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen();
  action.catch(error => status(error.message, true));
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  status('Grafikken i nettleseren ble borte. Last siden på nytt.', true);
});

startButton.addEventListener('click', async () => {
  if (startButton.disabled) return;
  busy = true;
  refresh();
  status('Laster spillmotoren …');
  try {
    const response = await networkFetch(new URL('data/index.json', baseURL));
    if (!response.ok) throw new Error('Fant ikke spillmotorens data. Prøv å laste siden på nytt.');
    const indexes = makeIndexes([...library.metadata.game.files, ...library.metadata.mod.files], await response.json());
    window.fetch = privateFetch(library, indexes, baseURL, networkFetch);

    const query = new URLSearchParams(location.search);
    const env = {DIGHD_MOD: '/data/mods/gpt', HOME: '/home/dig-hd' + baseURL.pathname.replace(/[^a-zA-Z0-9_-]/g, '_')};
    if (query.has('rom')) {
      const room = Number(query.get('rom'));
      if (!Number.isInteger(room) || room < 1 || room > 111) throw new Error('Romnummeret må være mellom 1 og 111.');
      Object.assign(env, {DIGHD_TEST_ROOM: String(room), DIGHD_TEST_AT: '240', DIGHD_SKIP_VIDEO: '1'});
    }
    if (query.has('klassisk')) env.DIGHD_CLASSIC = '1';
    if (query.has('gult')) env.DIGHD_SHOW_MISSING = '1';
    // Explicit test hooks remain useful for the same checks as the native motor.
    for (const [key, value] of query) if (/^DIGHD_(TEST_[A-Z0-9_]+|SKIP_VIDEO|TEXT|VERIFY|BENCH)$/.test(key)) env[key] = value;
    const args = ['--path=/data/games/dig', '--savepath=' + env.HOME, '--aspect-ratio', '--subtitles', 'dig'];
    history.replaceState(null, '', location.pathname + location.search + '#' + args.join(' '));

    document.querySelector('#setup').hidden = true;
    document.querySelector('#player').hidden = false;
    document.querySelector('#controls').hidden = false;
    document.body.classList.add('playing');
    canvas.focus();
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
      onRuntimeInitialized: () => status('Starter The Dig med HD …'),
      onAbort: text => status('Spillmotoren stoppet: ' + text, true),
      print: text => {
        console.log(text);
        if (/^DigHD: screen /.test(text)) {
          setTimeout(() => { window.dispatchEvent(new Event('resize')); status(); }, 300);
        }
      },
      printErr: text => console.error(text),
      setStatus: text => { if (text) console.log(text); }
    };
    const script = document.createElement('script');
    script.src = new URL('scummvm.js', baseURL).href;
    script.onerror = () => status('Spillmotoren kunne ikke lastes. Prøv å laste siden på nytt.', true);
    document.body.appendChild(script);
  } catch (error) {
    window.fetch = networkFetch;
    busy = false;
    refresh();
    status(error.message, true);
  }
});

try {
  if (!globalThis.WebAssembly) throw new Error('Denne nettleseren støtter ikke spillmotoren. Bruk en oppdatert Chrome, Edge eller Firefox.');
  await library.open();
  busy = false;
  refresh();
  status(library.metadata.game && library.metadata.mod ? 'Spillet og HD-grafikken er klare. Trykk Spill med HD.' : 'Velg spillfilene og HD-pakken én gang for å starte.');
} catch (error) {
  status('Kunne ikke åpne lokal lagring: ' + error.message, true);
}
