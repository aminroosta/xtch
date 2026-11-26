const $ = id => document.getElementById(id);
const defaults = {font: 'serif', size: 30, line: 115, margin: 12, hyphen: true, dither: false};
const keys = Object.keys(defaults);
const form = $('layout');
const canvas = $('page');
const ctx = canvas.getContext('2d');
const frame = ctx.createImageData(canvas.width, canvas.height);
const MAX_EBOOK = 48 * 1024 * 1024;
const MAX_XTCH = 256 * 1024 * 1024;
let worker, book, fileName, page = 0, pendingPage = 0, seq = 0, mode = 'empty', timer, url;

function setSettings(values) {
  for (const key of keys) {
    const element = $(key);
    if (element.type === 'checkbox') element.checked = values[key];
    else element.value = values[key];
  }
  if (!$('font').value) $('font').value = defaults.font;
  showValues();
}

function readSettings() {
  return Object.fromEntries(keys.map(key => {
    const el = $(key);
    return [key, el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value];
  }));
}

function showValues() {
  $('size-val').value = $('size').value + ' px';
  $('line-val').value = $('line').value + '%';
  $('margin-val').value = $('margin').value + ' px';
}

try {
  setSettings({...defaults, ...JSON.parse(localStorage.getItem('paperform-layout') || '{}')});
} catch {
  setSettings(defaults);
}

function error(message = '') {
  $('error').textContent = message;
  $('error').hidden = !message;
}

function forgetExport() {
  if (url) URL.revokeObjectURL(url);
  url = null;
  $('download').hidden = true;
  $('download').removeAttribute('href');
}

function sizeBytes() {
  return book ? 312 + 96 * book.toc.length + 96038 * book.count : 0;
}
const mib = size => (size / 1048576).toFixed(1) + ' MiB';

function update() {
  const busy = mode === 'opening' || mode === 'compiling';
  const canTurn = !!book && (mode === 'ready' || mode === 'turning');
  $('pick').disabled = busy;
  $('layout').disabled = busy;
  $('reset').disabled = busy;
  $('prev').disabled = !canTurn || pendingPage <= 0;
  $('next').disabled = !canTurn || pendingPage >= book.count - 1;
  $('number').disabled = !canTurn;
  $('chapters').disabled = !canTurn || !book.toc.length;
  $('compile').disabled = mode !== 'ready' || sizeBytes() > MAX_XTCH;
  $('progress').hidden = mode !== 'compiling';
  $('cancel').hidden = mode !== 'compiling';
  $('size-estimate').textContent = book
    ? (sizeBytes() > MAX_XTCH ? 'Over 256 MiB · reduce font size to export' : '480 × 800 · about ' + mib(sizeBytes()))
    : '480 × 800 · 4-level grayscale';
}

function draw(shades) {
  for (let i = 0, k = 0; i < shades.length; i++) {
    const g = shades[i] * 85;
    frame.data[k++] = g;
    frame.data[k++] = g;
    frame.data[k++] = g;
    frame.data[k++] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  canvas.hidden = false;
  $('placeholder').hidden = true;
}

function showBook(info) {
  $('book-detail').hidden = !info;
  $('book-title').textContent = info?.title || '';
  $('book-author').textContent = info?.author || '';
  $('page-count').textContent = '/ ' + (info?.count ?? '—');
  $('number').max = info?.count || 1;
  $('chapters').replaceChildren(new Option('Jump to chapter', ''));
  if (info) {
    for (const entry of info.toc) $('chapters').add(new Option(entry.title, entry.page));
  }
}

function onMessage({data: msg}) {
  if (msg.id !== seq) return;
  switch (msg.type) {
    case 'preview': {
      if (msg.book) showBook(book = msg.book);
      page = pendingPage = msg.page;
      $('number').value = page + 1;
      $('chapters').value = '';
      draw(msg.shades);
      canvas.setAttribute('aria-label', 'Rendered page ' + (page + 1) + ' of ' + book.count);
      $('status').textContent = '';
      mode = 'ready';
      break;
    }
    case 'progress':
      $('progress').max = msg.count;
      $('progress').value = msg.done;
      $('status').textContent = 'Compiling ' + msg.done + ' of ' + msg.count + ' pages…';
      break;
    case 'compiled': {
      forgetExport();
      url = URL.createObjectURL(msg.blob);
      $('download').href = url;
      $('download').download = fileName.replace(/\.epub$/i, '') + '.xtch';
      $('download').hidden = false;
      $('status').textContent = 'XTCH ready to download · ' + mib(msg.blob.size);
      mode = 'ready';
      $('download').focus({preventScroll: true});
      break;
    }
    case 'cancelled':
      $('status').textContent = 'Export canceled.';
      mode = 'ready';
      break;
    case 'error':
      $('status').textContent = '';
      error(msg.message);
      if (mode === 'opening') {
        $('placeholder-text').textContent = 'Choose an EPUB to see its pages.';
        mode = 'empty';
      } else if (mode === 'reflowing') {
        mode = 'layout-error'; // No export with controls that don't match the preview.
      } else {
        pendingPage = page;
        $('number').value = page + 1;
        mode = book ? 'ready' : 'empty';
      }
      break;
  }
  update();
}

function startWorker() {
  const active = new Worker(new URL('./worker.js', import.meta.url));
  active.onmessage = onMessage;
  active.onerror = () => {
    active.terminate();
    if (active !== worker) return;
    worker = null;
    enterEmpty();
    error('The renderer stopped. Try opening the EPUB again, or try a smaller book.');
  };
  return active;
}

function enterEmpty() {
  clearTimeout(timer);
  forgetExport();
  book = null;
  page = pendingPage = 0;
  $('number').value = 1;
  showBook(null);
  $('placeholder').hidden = false;
  $('placeholder-text').textContent = 'Choose an EPUB to see its pages.';
  canvas.hidden = true;
  $('status').textContent = '';
  mode = 'empty';
  update();
}

async function openFile(file) {
  if (!file || mode === 'opening' || mode === 'compiling') return;
  error();
  if (!/\.epub$/i.test(file.name)) return error('Choose a file ending in .epub.');
  if (file.size < 22 || file.size > MAX_EBOOK) return error('Choose a valid EPUB under 48 MiB.');
  enterEmpty();
  mode = 'opening';
  $('placeholder-text').textContent = 'Opening and paginating your EPUB…';
  $('status').textContent = 'Opening ' + file.name + '…';
  const id = ++seq;
  update();
  try {
    // A new worker releases the previous EPUB and renderer heap, even on mobile.
    worker?.terminate();
    worker = startWorker();
    const bytes = await file.arrayBuffer();
    fileName = file.name;
    $('pick-label').textContent = 'Choose another EPUB';
    $('pick-hint').textContent = fileName;
    worker.postMessage({type: 'open', id, bytes, name: fileName, settings: readSettings()}, [bytes]);
  } catch {
    enterEmpty();
    error('Could not open the selected file. Try selecting it again.');
  }
}

function settingsChanged() {
  showValues();
  try { localStorage.setItem('paperform-layout', JSON.stringify(readSettings())); } catch { /* optional */ }
  if (!book) return;
  clearTimeout(timer);
  forgetExport();
  error();
  mode = 'reflowing';
  $('status').textContent = 'Updating preview…';
  const id = ++seq;
  update();
  timer = setTimeout(() => {
    worker.postMessage({type: 'layout', id, page, settings: readSettings()});
  }, 180);
}

function goTo(n) {
  if (!book || !Number.isFinite(n) || (mode !== 'ready' && mode !== 'turning')) return;
  error();
  pendingPage = Math.min(book.count - 1, Math.max(0, Math.round(n)));
  mode = 'turning';
  update();
  worker.postMessage({type: 'page', id: ++seq, page: pendingPage});
}

$('file').addEventListener('change', event => {
  openFile(event.target.files[0]);
  event.target.value = '';
});
$('pick').addEventListener('click', () => $('file').click());
window.addEventListener('dragover', event => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = $('pick').contains(event.target) && !$('pick').disabled ? 'copy' : 'none';
  $('pick').classList.toggle('drag', event.dataTransfer.dropEffect === 'copy');
});
$('pick').addEventListener('dragleave', event => {
  if (!$('pick').contains(event.relatedTarget)) $('pick').classList.remove('drag');
});
window.addEventListener('drop', event => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  $('pick').classList.remove('drag');
  if ($('pick').contains(event.target)) openFile(event.dataTransfer.files[0]);
});
form.addEventListener('input', settingsChanged);
$('reset').addEventListener('click', () => { setSettings(defaults); settingsChanged(); });
$('prev').addEventListener('click', () => goTo(pendingPage - 1));
$('next').addEventListener('click', () => goTo(pendingPage + 1));
$('chapters').addEventListener('change', event => {
  if (event.target.value !== '') goTo(Number(event.target.value));
});
$('go').addEventListener('submit', event => {
  event.preventDefault();
  goTo($('number').valueAsNumber - 1);
});
$('number').addEventListener('change', event => {
  if (event.target.valueAsNumber !== page + 1) goTo(event.target.valueAsNumber - 1);
});
window.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey ||
      event.target.closest?.('button, input, select, textarea, a, [contenteditable]')) return;
  if (!book || (mode !== 'ready' && mode !== 'turning')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    goTo(pendingPage + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});

$('compile').addEventListener('click', () => {
  if (mode !== 'ready') return;
  forgetExport();
  error();
  mode = 'compiling';
  $('progress').max = book.count;
  $('progress').value = 0;
  $('status').textContent = 'Compiling ' + book.count + ' pages…';
  update();
  worker.postMessage({type: 'compile', id: ++seq});
});
$('cancel').addEventListener('click', () => {
  $('status').textContent = 'Canceling export…';
  worker?.postMessage({type: 'cancel'});
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  $('install').hidden = true;
  await prompt.prompt();
});
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
update();
