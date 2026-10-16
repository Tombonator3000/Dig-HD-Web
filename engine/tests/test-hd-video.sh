#!/usr/bin/env bash
# Test den faktiske HD-videodekoderen med syntetiske bilder, uten spillfiler.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "${1:?Bruk: engine/tests/test-hd-video.sh /sti/til/bygget/scummvm}" && pwd)"
TEST_OUT="$(mktemp -d "${TMPDIR:-/tmp}/dighd-video-test.XXXXXX")"
trap 'rm -rf "$TEST_OUT"' EXIT
ffmpeg -v error -f lavfi -i testsrc2=size=64x48:rate=12 -frames:v 8 \
  -c:v libvpx -g 3 -auto-alt-ref 0 -lag-in-frames 0 -pix_fmt yuv420p "$TEST_OUT/test.ivf"
ffmpeg -v error -i "$TEST_OUT/test.ivf" -f rawvideo -pix_fmt rgb24 "$TEST_OUT/test.rgb"
cd "$SRC"
# Reuse configure's compiler, flags and link libraries on Linux and Emscripten.
cat > "$TEST_OUT/Makefile" <<'MAKE'
include config.mk
ifdef EMSCRIPTEN
# The game shell needs a browser; this decoder check needs only Node and local fixtures.
LDFLAGS := -sENVIRONMENT=node -sNODERAWFS=1 -sALLOW_MEMORY_GROWTH=1 -sUSE_LIBPNG=1 -sUSE_ZLIB=1 -sUSE_VORBIS=1 -sUSE_OGG=1
endif
all:
	$(CXX) $(CXXFLAGS) $(CPPFLAGS) $(INCLUDES) $(DEFINES) -DHAVE_CONFIG_H -I. -Iengines $(VIDEO_TEST_SRC) graphics/libgraphics.a common/libcommon.a common/formats/libformats.a common/libcommon.a $(LDFLAGS) $(LIBS) -o $(VIDEO_TEST_OUT)
MAKE
SUFFIX=""
if grep -q '^EMSCRIPTEN = 1' config.mk; then SUFFIX=.js; fi
make -s -f "$TEST_OUT/Makefile" VIDEO_TEST_SRC="$HERE/hd-video.cpp" VIDEO_TEST_OUT="$TEST_OUT/video$SUFFIX"
if [ "$SUFFIX" = .js ]; then
  node "$TEST_OUT/video.js" "$TEST_OUT/test.ivf" "$TEST_OUT/test.rgb"
else
  "$TEST_OUT/video" "$TEST_OUT/test.ivf" "$TEST_OUT/test.rgb"
fi
