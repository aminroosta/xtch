# Paperform — EPUB to XTCH

[Use Paperform at xtch.pages.dev](https://xtch.pages.dev/).

Paperform turns an EPUB into 480 × 800, four-level grayscale XTCH pages for the Xteink X4 Classic. Choose a local EPUB, adjust its type and layout, preview actual export pages, then compile and download the XTCH. Copy it to the reader’s microSD card.

Conversion runs in a Web Worker. Paperform does not upload EPUBs, retain books between sessions, or contact third-party services. It remembers layout preferences on this browser. After the app finishes caching its assets on your first visit, it can open and convert books offline. Use **Install app** where offered or **Add to Home Screen** from Safari’s Share menu.

## Run locally

Requires Node.js 22+. There are no npm dependencies to install.

```sh
npm run dev
```

Open http://localhost:8788. Restart the command after editing `public/` to rebuild. For PWA install and offline testing, use localhost or HTTPS.

## Deploy to Cloudflare Pages

For Git integration, set the build command to `npm run build` and the output directory to `dist`. No Functions, runtime secrets, or environment variables are needed on the site.

The live site uses the Cloudflare Pages project `xtch`, with `main` as its production branch. To deploy to your own account, first create a direct-upload Pages project in the Cloudflare dashboard, then substitute its name below. The token needs **Account → Cloudflare Pages → Edit**. If it can access several accounts, set `CLOUDFLARE_ACCOUNT_ID` to the intended account.

```sh
npm run build
CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" npx wrangler@4 pages deploy dist --project-name xtch --branch main
```

## Limits

- Use DRM-free EPUBs. Input is limited to 48 MiB compressed and 192 MiB unpacked. An export over 256 MiB requires a smaller layout or a split book. Large books may still exceed a phone’s available memory.
- Rendering preserves the EPUB’s text and embedded styling where supported by CoolReader. A book’s own font or spacing rules may override the default typeface, and the app does not repair broken source text. XTCH stores pre-rendered pages; the font cannot be changed on the reader.

## Third-party software

See [THIRD_PARTY.md](THIRD_PARTY.md) for the renderer source, build recipe, and font licenses.
