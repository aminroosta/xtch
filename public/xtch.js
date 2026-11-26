// XTCH v1.0: 56-byte container header, metadata, chapters, index, then XTH pages.
const WIDTH = 480, HEIGHT = 800;
const PLANE_BYTES = WIDTH * HEIGHT / 8;
const PAGE_BYTES = 22 + 2 * PLANE_BYTES;
const MAX_OUTPUT = 256 * 1024 * 1024;
const utf8 = new TextEncoder();

function xtchHeader(book) {
  const { count, toc } = book;
  const meta = 56, chapter = meta + 256, index = chapter + 96 * toc.length;
  const data = index + 16 * count;
  if (!count || count > 65535 || data + count * PAGE_BYTES > MAX_OUTPUT) {
    throw new Error('This layout exceeds the 256 MiB export limit. Try a smaller font size.');
  }
  const header = new Uint8Array(data);
  const view = new DataView(header.buffer);
  const u16 = (at, v) => view.setUint16(at, v, true);
  const u32 = (at, v) => view.setUint32(at, v, true);
  const u64 = (at, v) => view.setBigUint64(at, BigInt(v), true);
  const string = (at, length, value) => {
    utf8.encodeInto(String(value || '').replaceAll('\0', ''), header.subarray(at, at + length - 1));
  };
  header.set([88, 84, 67, 72, 1, 0]); // XTCH, v1.0
  u16(6, count);
  header[9] = 1;
  header[11] = Number(toc.length > 0);
  u32(12, 1);
  u64(16, meta);
  u64(24, index);
  u64(32, data);
  u64(48, toc.length ? chapter : 0);
  string(meta, 128, book.title);
  string(meta + 128, 64, book.author);
  string(meta + 224, 16, book.language);
  u32(meta + 240, Math.floor(Date.now() / 1000));
  u16(meta + 244, 0); // Use the first page as the cover.
  u16(meta + 246, toc.length);

  // Chapter coordinates on disk are one-based, as read by CrossPoint.
  let end = count;
  for (let i = toc.length - 1; i >= 0;) {
    const p = toc[i].page;
    do {
      const at = chapter + 96 * i;
      string(at, 80, toc[i].title);
      u16(at + 80, p + 1);
      u16(at + 82, end);
      i--;
    } while (i >= 0 && toc[i].page === p);
    end = p;
  }
  for (let i = 0; i < count; i++) {
    const at = index + 16 * i;
    u64(at, data + i * PAGE_BYTES);
    u32(at + 8, PAGE_BYTES);
    u16(at + 12, WIDTH);
    u16(at + 14, HEIGHT);
  }
  return header;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const XTH_LEVEL = [0b11, 0b01, 0b10, 0b00];

// Quantize once before either displaying a preview or packing bitplanes.
function quantize(frame, dither) {
  const shades = new Uint8Array(WIDTH * HEIGHT);
  // CoolReader's bundled wrapper draws a clock and page counter along the top.
  // Drop that band, leaving a 14px top gutter and returning the saved area at bottom.
  const shift = 20;
  const gutter = 14;
  shades.fill(3, 0, gutter * WIDTH);
  shades.fill(3, (HEIGHT - shift) * WIDTH);
  for (let y = gutter; y < HEIGHT - shift; y++) {
    for (let x = 0, src = (y + shift) * WIDTH * 4; x < WIDTH; x++, src += 4) {
      let gray = (77 * frame[src] + 150 * frame[src + 1] + 29 * frame[src + 2]) / 256;
      if (dither) gray += (BAYER[(y & 3) * 4 + (x & 3)] - 7.5) * 3.5;
      shades[y * WIDTH + x] = gray < 42.5 ? 0 : gray < 127.5 ? 1 : gray < 212.5 ? 2 : 3;
    }
  }
  return shades;
}

function encodeXth(shades, out) {
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  out.set([88, 84, 72, 0]); // XTH
  view.setUint16(4, WIDTH, true);
  view.setUint16(6, HEIGHT, true);
  view.setUint32(10, PLANE_BYTES * 2, true);
  // XTH columns scan right-to-left, MSB first down each group of eight pixels.
  let at = 22;
  for (let x = WIDTH - 1; x >= 0; x--) {
    for (let y = 0; y < HEIGHT; y += 8) {
      let low = 0, high = 0;
      for (let bit = 7, pos = y * WIDTH + x; bit >= 0; bit--, pos += WIDTH) {
        const value = XTH_LEVEL[shades[pos]];
        low |= (value & 1) << bit;
        high |= (value >> 1) << bit;
      }
      out[at] = low;
      out[at++ + PLANE_BYTES] = high;
    }
  }
}
