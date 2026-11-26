# Third-party software

## EPUB renderer

`public/vendor/crengine.js` and `public/vendor/crengine.wasm` are built from [CoolReader at `064723e`](https://github.com/buggins/coolreader/tree/064723eace938389fb99f84518ce773ede38dbdf) using the [epub-to-xtc-converter wrapper and build recipe at `a5719c6`](https://github.com/bigbag/epub-to-xtc-converter/tree/a5719c6d4f64c52675b55889b18dae9877a9e9d6/wasm-build), plus our [alignment and word-spacing patches](renderer/).

Run `renderer/rebuild.sh` with Podman (or `CONTAINER_ENGINE=docker renderer/rebuild.sh`) to rebuild the renderer with Emscripten 6.0.9. The regular site build uses the checked-in artifacts.

- [CoolReader license](public/vendor/COOLREADER-LICENSE.txt)
- [WASM wrapper repository license](public/vendor/WRAPPER-LICENSE.txt)

```text
a3a0e214abc7987d56a0954bddda50421d12c17f12b7a490a4d83753c25476a8  crengine.js
598a215d6ba639abc3b79e75c203f657ed784fa9f57dc9282caa27082a51ce27  crengine.wasm
```

## Fonts

- [STIX Two Text and STIX Two Math](https://github.com/stipub/stixfonts) — [SIL Open Font License](public/fonts/STIX-OFL.txt)
- [Liberation Sans and Liberation Mono](https://github.com/liberation-fonts/liberation-fonts) — [SIL Open Font License](public/fonts/LIBERATION-OFL.txt)
- [Atkinson Hyperlegible](https://github.com/google/fonts/tree/5e5a3e04a1af8effa6e5708e4e963a49faff93ab/ofl/atkinsonhyperlegible) — [SIL Open Font License](public/fonts/ATKINSON-OFL.txt)
- [EB Garamond](https://github.com/octaviopardo/EBGaramond12/tree/6d9aff51f8d0f02b21846e2f4db015c75c24a55c/fonts/otf) — [SIL Open Font License](public/fonts/EBGARAMOND-OFL.txt)
- [Lora](https://github.com/cyrealtype/Lora-Cyrillic/tree/990d096770ec849579270d3031e1b84ea32e1272/fonts/otf) — [SIL Open Font License](public/fonts/LORA-OFL.txt)

## Format reference

The XTCH encoder follows [CrazyCoder’s XTC/XTCH format notes](https://gist.github.com/CrazyCoder/b125f26d6987c0620058249f59f1327d) and [CrossPoint’s reader implementation](https://github.com/crosspoint-reader/crosspoint-reader/tree/master/lib/Xtc).
