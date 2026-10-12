#!/usr/bin/env bash
# Run against an already built/patched ScummVM source tree. No game data needed.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${1:?Usage: engine/tests/test-http-fs-cache.sh /path/to/built/scummvm-web}"
SRC="$(cd "$SRC" && pwd)"
TEST_OUT="$(mktemp -d "${TMPDIR:-/tmp}/dighd-http-fs-test.XXXXXX")"
trap 'rm -rf "$TEST_OUT"' EXIT
cd "$SRC"
em++ -DHAVE_CONFIG_H -DEMSCRIPTEN '-DDATA_PATH="/data"' \
  -I"$HERE/http-fs-stubs" -I. -Iengines -std=c++11 -O2 \
  "$HERE/http-fs-cache.cpp" backends/fs/emscripten/http-fs.cpp \
  backends/fs/abstract-fs.o backends/fs/posix/posix-fs.o \
  backends/fs/posix/posix-iostream.o backends/fs/stdiostream.o \
  common/libcommon.a common/formats/libformats.a common/libcommon.a \
  -sENVIRONMENT=node -sALLOW_MEMORY_GROWTH=1 -o "$TEST_OUT/lookup.js"
node "$TEST_OUT/lookup.js"
