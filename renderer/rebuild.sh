#!/usr/bin/env bash
# Rebuild the vendored renderer; npm run build does not require this toolchain.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
container="${CONTAINER_ENGINE:-podman}"
jobs="${JOBS:-8}"
[[ "$jobs" =~ ^[1-9][0-9]*$ ]] || { echo 'JOBS must be a positive integer.' >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
upstream=a5719c6d4f64c52675b55889b18dae9877a9e9d6
git -C "$work" init --quiet
git -C "$work" fetch --quiet --depth=1 https://github.com/bigbag/epub-to-xtc-converter.git "$upstream"
git -C "$work" archive FETCH_HEAD:wasm-build Dockerfile build.sh EpubRenderer.cpp post.js patches scripts |
  tar -x -C "$work"

image=xtch-wasm-build
"$container" build --build-arg EMSDK_VERSION=6.0.9 -t "$image" "$work"
mkdir "$work/out"
"$container" run --rm --security-opt label=disable \
  -v "$root/renderer:/layout:ro" -v "$work/out:/out" "$image" \
  bash -c '
    set -e
    patch -d /opt/coolreader -p1 < /layout/coolreader.patch
    patch -d /opt/wrapper -p1 < /layout/wrapper.patch
    sed -i "s/\$(nproc)/$1/g" /opt/build.sh
    exec /opt/build.sh
  ' bash "$jobs"
cp "$work/out/crengine.js" "$work/out/crengine.wasm" "$root/public/vendor/"
