#!/usr/bin/env bash
# Bygger ScummVM med Dig HD-patchen for nettleseren (WebAssembly med Emscripten).
#
# Resultatet kjøres lokalt med engine/run-web.sh på http://localhost:8000.
# engine/build-pages.py lager en egen offentlig motorpakke som leser private filer
# fra nettleserens lokale lagring. Spillfilene og HD-grafikken skal aldri publiseres.
#
# Følger ScummVM sin egen oppskrift (dists/emscripten/build.sh på den låste commiten):
# samme Emscripten-versjon, configure med --host=wasm32-unknown-emscripten, make og
# make dist-emscripten. Bare SCUMM-motoren, som i engine/build.sh.
#
# Krever: git, make, python3, pkg-config, curl, tar, xz og zip. Emscripten (emsdk) installeres i
# engine/emsdk første gang (omtrent 350 MB). ScummVM sin configure bruker pkg-config for SDL3,
# og make dist-emscripten bruker zip.
#
# Bruk:  engine/build-web.sh        (kildekoden havner i engine/scummvm-web, resultatet i
#                                    engine/scummvm-web/build-emscripten)
#        SCUMMVM_WEB_SRC=/annen/mappe EMSDK_DIR=/annen/emsdk engine/build-web.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCUMMVM_WEB_SRC:-$HERE/scummvm-web}"
EMSDK_DIR="${EMSDK_DIR:-$HERE/emsdk}"
COMMIT="$(cat "$HERE/SCUMMVM_COMMIT")"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

# 1. Kildekoden: samme commit og samme patch som den vanlige motoren
if [ ! -d "$SRC/.git" ]; then
	echo "Henter ScummVM ($COMMIT) til $SRC ..."
	git init -q "$SRC"
	git -C "$SRC" remote add origin https://github.com/scummvm/scummvm
fi
git -C "$SRC" fetch -q --depth 1 origin "$COMMIT"
git -C "$SRC" checkout -q -f FETCH_HEAD
git -C "$SRC" clean -fdq engines/scumm

echo "Legger på patcher ..."
for p in "$HERE"/patches/*.patch; do
	git -C "$SRC" apply --whitespace=nowarn "$p"
	echo "  $(basename "$p")"
done

# 2. Emscripten: versjonen ScummVM sin egen byggeoppskrift bruker på denne commiten
EMSDK_VERSION="${EMSDK_VERSION:-$(sed -n 's/^EMSDK_VERSION="\${EMSDK_VERSION:-\([0-9.]*\)}"$/\1/p' "$SRC/dists/emscripten/build.sh")}"
EMSDK_VERSION="${EMSDK_VERSION:-4.0.10}"
if [ ! -x "$EMSDK_DIR/emsdk" ]; then
	echo "Henter emsdk til $EMSDK_DIR ..."
	git clone -q https://github.com/emscripten-core/emsdk "$EMSDK_DIR"
fi
if [ "$(cat "$EMSDK_DIR/.dighd-versjon" 2>/dev/null || true)" != "$EMSDK_VERSION" ]; then
	echo "Installerer Emscripten $EMSDK_VERSION (første gang laster den ned omtrent 350 MB) ..."
	(cd "$EMSDK_DIR" && { ./emsdk install "$EMSDK_VERSION" || { git pull -q && ./emsdk install "$EMSDK_VERSION"; }; } && ./emsdk activate "$EMSDK_VERSION") > "$EMSDK_DIR/install.log" 2>&1 \
		|| { tail -20 "$EMSDK_DIR/install.log"; echo "Installasjonen av Emscripten feilet, se $EMSDK_DIR/install.log"; exit 1; }
	echo "$EMSDK_VERSION" > "$EMSDK_DIR/.dighd-versjon"
fi
# shellcheck disable=SC1091
EMSDK_QUIET=1 source "$EMSDK_DIR/emsdk_env.sh"
# 4.0.10 har en skrivefeil i zlib.pc som også når PNG via pkg-config.
ZLIB_PC="$EMSDK_DIR/upstream/emscripten/cache/sysroot/lib/pkgconfig/zlib.pc"
if [ -f "$ZLIB_PC" ] && grep -q -- '-sUSE_ZIB' "$ZLIB_PC"; then
	sed -i 's/-sUSE_ZIB/-sUSE_ZLIB=1/g' "$ZLIB_PC"
fi
# Verts-PC-ens biblioteker (blant annet fra conda) må ikke brukes til WebAssembly.
export PKG_CONFIG_PATH=""

# 3. VP8-dekoder: libvpx har ingen Emscripten-port. Bygg den låste kilden som
# ScummVM sin egen oppskrift bruker. Ingen videokodere eller pthreads i nettleseren.
VPX_VERSION=1.15.0
WEB_LIBS="${DIGHD_WEB_LIBS:-$HERE/emsdk-libs}"
mkdir -p "$WEB_LIBS"
WEB_LIBS="$(cd "$WEB_LIBS" && pwd)"
VPX_PREFIX="$WEB_LIBS/vpx-$VPX_VERSION-$EMSDK_VERSION"
if [ ! -f "$VPX_PREFIX/lib/libvpx.a" ]; then
	ARCHIVE="$WEB_LIBS/libvpx-$VPX_VERSION.tar.gz"
	if [ ! -f "$ARCHIVE" ]; then
		curl --fail --location --retry 3 "https://codeload.github.com/webmproject/libvpx/tar.gz/refs/tags/v$VPX_VERSION" -o "$ARCHIVE.tmp"
		mv "$ARCHIVE.tmp" "$ARCHIVE"
	fi
	echo "e935eded7d81631a538bfae703fd1e293aad1c7fd3407ba00440c95105d2011e  $ARCHIVE" | sha256sum -c -
	tar -xzf "$ARCHIVE" -C "$WEB_LIBS"
	(
		cd "$WEB_LIBS/libvpx-$VPX_VERSION"
		emconfigure ./configure --target=generic-gnu --prefix="$VPX_PREFIX" \
			--disable-vp8-encoder --disable-vp9-encoder --disable-multithread \
			--disable-runtime-cpu-detect --disable-examples --disable-tools \
			--disable-docs --disable-unit-tests
		emmake make -j"$JOBS"
		emmake make install
		cp LICENSE "$VPX_PREFIX/LICENSE"
	) > "$WEB_LIBS/vpx-build.log" 2>&1 || { tail -30 "$WEB_LIBS/vpx-build.log"; exit 1; }
fi

# 4. Konfigurer og bygg
cd "$SRC"
CONFIG_ID="$(cat "$HERE/SCUMMVM_COMMIT" "$HERE"/patches/*.patch "$HERE/build-web.sh" | sha256sum | cut -d' ' -f1)-$EMSDK_VERSION"
if [ ! -f config.mk ] || [ "$(cat .dighd-config 2>/dev/null || true)" != "$CONFIG_ID" ] || [ "${RECONFIGURE:-0}" = "1" ]; then
	echo "Konfigurerer for nettleseren (bare SCUMM-motoren) ..."
	# Vorbis/Ogg brukes også av ScummVM sin eksisterende MKV-dekoder under USE_VPX.
	emconfigure ./configure --host=wasm32-unknown-emscripten --build=wasm32-unknown-emscripten \
		--disable-all-engines --enable-engine=scumm,scumm-7-8 \
		--disable-engine=he,rebel2-psx --disable-detection-full \
		--disable-debug --enable-optimizations \
		--enable-png --enable-zlib --enable-vpx --with-vpx-prefix="$VPX_PREFIX" \
		--enable-vorbis --enable-ogg \
		--disable-mt32emu --disable-fluidsynth --disable-cloud --disable-libcurl \
		--disable-sdlnet --disable-tts --disable-eventrecorder > configure.log 2>&1 \
		|| { tail -30 configure.log; echo "Konfigureringen feilet, se $SRC/configure.log"; exit 1; }
	grep -q '^USE_VPX=1' config.mk || { echo "VP8-støtte mangler i nettleserbygget"; exit 1; }
	echo "$CONFIG_ID" > .dighd-config
	rm -f scummvm-conf.*
fi

echo "Bygger med $JOBS tråder (første gang tar det noen minutter) ..."
emmake make -j"$JOBS" > build.log 2>&1 || { tail -30 build.log; echo "Bygging feilet, se $SRC/build.log"; exit 1; }
rm -rf build-emscripten
emmake make dist-emscripten >> build.log 2>&1 || { tail -30 build.log; echo "Pakkingen feilet, se $SRC/build.log"; exit 1; }
cp "$VPX_PREFIX/LICENSE" build-emscripten/doc/libvpx-LICENSE.txt
echo "Ferdig: $SRC/build-emscripten"
