# Third-party software

## EPUB renderer

`public/vendor/crengine.js` and `public/vendor/crengine.wasm` are the unmodified `wasm-build/out/` artifacts from [epub-to-xtc-converter at `a5719c6`](https://github.com/bigbag/epub-to-xtc-converter/tree/a5719c6d4f64c52675b55889b18dae9877a9e9d6). The same revision contains the [wrapper source, patches, and build instructions](https://github.com/bigbag/epub-to-xtc-converter/tree/a5719c6d4f64c52675b55889b18dae9877a9e9d6/wasm-build). It builds against [CoolReader at `064723e`](https://github.com/buggins/coolreader/tree/064723eace938389fb99f84518ce773ede38dbdf).

- [CoolReader license](public/vendor/COOLREADER-LICENSE.txt)
- [WASM wrapper repository license](public/vendor/WRAPPER-LICENSE.txt)

```text
a3a0e214abc7987d56a0954bddda50421d12c17f12b7a490a4d83753c25476a8  crengine.js
266f0bbf960843bfcb541160104877d688271f33a9ffc6e7be9bfe485e6d357c  crengine.wasm
```

## Fonts

- [STIX Two Text and STIX Two Math](https://github.com/stipub/stixfonts) — [SIL Open Font License](public/fonts/STIX-OFL.txt)
- [Liberation Sans and Liberation Mono](https://github.com/liberation-fonts/liberation-fonts) — [SIL Open Font License](public/fonts/LIBERATION-OFL.txt)

## Format reference

The XTCH encoder follows [CrazyCoder’s XTC/XTCH format notes](https://gist.github.com/CrazyCoder/b125f26d6987c0620058249f59f1327d) and [CrossPoint’s reader implementation](https://github.com/crosspoint-reader/crosspoint-reader/tree/master/lib/Xtc).
