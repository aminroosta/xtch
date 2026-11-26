importScripts('./vendor/crengine.js', './xtch.js');

const families = {
  serif: ['STIX Two Text', 'STIXTwoText', 'otf'],
  sans: ['Liberation Sans', 'LiberationSans', 'ttf'],
  mono: ['Liberation Mono', 'LiberationMono', 'ttf']
};
const styles = ['Regular', 'Italic', 'Bold', 'BoldItalic'];
let modulePromise, renderer, book, settings, exportTask;
const fontData = new Map();
const emit = (type, id, values = {}, transfer = []) => postMessage({type, id, ...values}, transfer);

function checkEpub(bytes) {
  // Inspect the ZIP directory before letting the renderer unpack it.
  const invalid = 'This file is not a supported EPUB. Choose a valid, DRM-free .epub file.';
  if (bytes.byteLength < 22 || bytes.byteLength > 48 * 1024 * 1024) {
    throw new Error('Choose an EPUB under 48 MiB.');
  }
  const view = new DataView(bytes);
  let footer = view.byteLength - 22;
  const min = Math.max(0, footer - 65535);
  while (footer >= min) {
    if (view.getUint32(footer, true) === 0x06054b50 &&
        footer + 22 + view.getUint16(footer + 20, true) === view.byteLength) break;
    footer--;
  }
  if (footer < min || view.getUint32(footer + 4, true) !== 0) throw new Error(invalid);
  const entries = view.getUint16(footer + 10, true);
  const end = view.getUint32(footer + 12, true) + view.getUint32(footer + 16, true);
  let at = view.getUint32(footer + 16, true);
  let expanded = 0, hasPackage = false;
  if (end > footer || entries > 20000) throw new Error(invalid);
  const expected = 'META-INF/container.xml';
  for (let i = 0; i < entries; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw new Error(invalid);
    if (view.getUint16(at + 8, true) & 1) throw new Error('Encrypted EPUBs are not supported.');
    const nameLength = view.getUint16(at + 28, true);
    const next = at + 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (next > end) throw new Error(invalid);
    if (nameLength === expected.length &&
        [...expected].every((c, j) => view.getUint8(at + 46 + j) === c.charCodeAt(0))) hasPackage = true;
    expanded += view.getUint32(at + 24, true);
    if (expanded > 192 * 1024 * 1024) throw new Error('This EPUB expands beyond the 192 MiB unpacking limit.');
    at = next;
  }
  if (!hasPackage) throw new Error(invalid);
}

async function getFont(name) {
  if (!fontData.has(name)) {
    const response = await fetch('./fonts/' + name);
    if (!response.ok) throw new Error('A bundled font could not be loaded. Reload and try again.');
    fontData.set(name, await response.arrayBuffer());
  }
  return fontData.get(name);
}

function inWasm(Module, bytes, fn) {
  const ptr = Module.allocateMemory(bytes.byteLength);
  if (!ptr) throw new Error('Not enough memory for this EPUB.');
  try {
    Module.HEAPU8.set(new Uint8Array(bytes), ptr);
    return fn(ptr, bytes.byteLength);
  } finally {
    Module.freeMemory(ptr);
  }
}

async function openBook(bytes, name) {
  checkEpub(bytes);
  if (!modulePromise) {
    modulePromise = CREngine({locateFile: file => new URL('./vendor/' + file, self.location.href).href})
      .catch(() => { modulePromise = null; throw new Error('Could not start the EPUB renderer. Reload the app and try again.'); });
  }
  const Module = await modulePromise;
  const names = Object.values(families).flatMap(([, prefix, ext]) => styles.map(s => prefix + '-' + s + '.' + ext));
  names.push('STIXTwoMath-Regular.otf');
  const fonts = await Promise.all(names.map(getFont));
  if (renderer) renderer.delete();
  renderer = null;
  book = null;
  const doc = new Module.EpubRenderer(WIDTH, HEIGHT);
  try {
    for (let i = 0; i < names.length; i++) {
      inWasm(Module, fonts[i], (ptr, length) => doc.registerFontFromMemory(ptr, length, names[i]));
    }
    if (!inWasm(Module, bytes, (ptr, length) => doc.loadEpubFromMemory(ptr, length))) {
      throw new Error('Could not read this EPUB. It may be damaged or protected by DRM.');
    }
    doc.configureStatusBar(false, false, false, false, false, false, false, false, false);
    const info = doc.getDocumentInfo();
    book = {
      title: info.title?.trim() || name.replace(/\.epub$/i, ''),
      author: info.author || info.authors || '',
      language: info.language || ''
    };
    renderer = doc;
  } catch (error) {
    doc.delete();
    throw error;
  }
}

function setLayout(next) {
  const font = families[next.font][0];
  renderer.setFontFace(font);
  renderer.setFontSize(next.size);
  renderer.setInterlineSpace(next.line);
  renderer.setMargins(next.margin, next.margin, next.margin, next.margin);
  renderer.setHyphenation(next.hyphen ? 2 : 0);
  settings = next;

  // Changes may defer pagination until the next draw.
  renderer.goToPage(0);
  renderer.renderCurrentPage();
  book.count = renderer.getPageCount();
  if (!book.count) throw new Error('The EPUB could not be paginated.');
  book.toc = (renderer.getToc() || [])
    .filter(x => x.title && Number.isInteger(x.page) && x.page >= 0 && x.page < book.count)
    .map(x => ({title: x.title.trim().replace(/\s+/g, ' '), page: x.page, level: x.level}))
    .filter(x => x.title).sort((a, b) => a.page - b.page).slice(0, 2000);
}

function render(page) {
  renderer.goToPage(page);
  renderer.renderCurrentPage();
  const frame = renderer.getFrameBuffer();
  if (frame.length !== WIDTH * HEIGHT * 4) throw new Error('The renderer returned an invalid page.');
  return quantize(frame, settings.dither);
}

function preview(id, page, includeBook = false) {
  const number = Math.min(book.count - 1, Math.max(0, Math.round(page)));
  const shades = render(number);
  emit('preview', id, {page: number, shades, book: includeBook ? book : undefined}, [shades.buffer]);
}

async function compile(id) {
  const header = xtchHeader(book);
  const task = {cancelled: false};
  exportTask = task;
  const count = book.count;
  const parts = [header];
  try {
    for (let start = 0; start < count; start += 24) {
      const end = Math.min(start + 24, count);
      const chunk = new Uint8Array((end - start) * PAGE_BYTES);
      for (let n = start; n < end; n++) {
        encodeXth(render(n), chunk.subarray((n - start) * PAGE_BYTES, (n - start + 1) * PAGE_BYTES));
      }
      parts.push(chunk);
      emit('progress', id, {done: end, count});
      await new Promise(resolve => setTimeout(resolve, 0));
      if (task.cancelled) {
        emit('cancelled', id);
        return;
      }
    }
    emit('compiled', id, {blob: new Blob(parts, {type: 'application/octet-stream'})});
  } finally {
    exportTask = null;
  }
}

onmessage = async ({data: msg}) => {
  const {type, id} = msg;
  try {
    if (type === 'cancel') {
      if (exportTask) exportTask.cancelled = true;
      return;
    }
    if (exportTask) return;
    if (type === 'open') {
      await openBook(msg.bytes, msg.name);
      setLayout(msg.settings);
      preview(id, 0, true);
    } else if (renderer && book) {
      if (type === 'layout') {
        const fraction = msg.page / Math.max(book.count - 1, 1);
        setLayout(msg.settings);
        preview(id, fraction * (book.count - 1), true);
      } else if (type === 'page') {
        preview(id, msg.page);
      } else if (type === 'compile') {
        await compile(id);
      }
    }
  } catch (error) {
    console.error(error);
    emit('error', id, {message: error.message || 'Could not process this EPUB.'});
  }
};
