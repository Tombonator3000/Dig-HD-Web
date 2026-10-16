// Standalone regression driver, linked to the actual ScummVM decoder and surfaces.
#define FORBIDDEN_SYMBOL_EXCEPTION_FILE
#define FORBIDDEN_SYMBOL_EXCEPTION_fopen
#define FORBIDDEN_SYMBOL_EXCEPTION_fclose
#define FORBIDDEN_SYMBOL_EXCEPTION_fseek
#define FORBIDDEN_SYMBOL_EXCEPTION_fread
#define FORBIDDEN_SYMBOL_EXCEPTION_ftell
#define FORBIDDEN_SYMBOL_EXCEPTION_printf
#define FORBIDDEN_SYMBOL_EXCEPTION_fprintf
#include <cstdio>
#include <cstdlib>
#include "common/memstream.h"
#include "common/system.h"
#include "scumm/dighd_video.h"
#undef exit
#undef stderr
OSystem *g_system = nullptr;

static void check(bool pass, const char *message) {
	if (!pass) { fprintf(stderr, "FAIL: %s\n", message); exit(1); }
}
static Common::Array<byte> read(const char *path) {
	FILE *f = fopen(path, "rb");
	check(f != nullptr, "fixture opens");
	fseek(f, 0, SEEK_END);
	long size = ftell(f);
	rewind(f);
	Common::Array<byte> bytes;
	bytes.resize(size);
	check(fread(bytes.data(), 1, size, f) == (size_t)size, "fixture reads");
	fclose(f);
	return bytes;
}
static bool open(Scumm::DigHDVideo &video, const Common::Array<byte> &bytes,
                 const Graphics::PixelFormat &format) {
	return video.open(new Common::MemoryReadStream(bytes.data(), bytes.size()), 64, 48, format);
}
static uint32 hash(const Graphics::Surface *surface) {
	check(surface != nullptr, "picture decodes");
	uint32 value = 0;
	for (int y = 0; y < surface->h; ++y)
		for (int x = 0; x < surface->w * surface->format.bytesPerPixel; ++x)
			value = value * 33 + ((const byte *)surface->getBasePtr(0, y))[x];
	return value;
}
static void compare(const Graphics::Surface *surface, const byte *rgb, int tolerance) {
	check(surface && surface->w == 64 && surface->h == 48, "picture dimensions");
	uint64 difference = 0;
	for (int y = 0; y < 48; ++y) for (int x = 0; x < 64; ++x) {
		const byte *p = (const byte *)surface->getBasePtr(x, y);
		const uint32 color = surface->format.bytesPerPixel == 4 ? READ_UINT32(p) : READ_UINT16(p);
		byte r, g, b;
		surface->format.colorToRGB(color, r, g, b);
		const byte *ref = rgb + (y * 64 + x) * 3;
		difference += ABS(int(r) - ref[0]) + ABS(int(g) - ref[1]) + ABS(int(b) - ref[2]);
	}
	check(difference < uint64(tolerance) * 64 * 48 * 3, "RGB agrees with independent FFmpeg decode");
}
int main(int argc, char **argv) {
	check(argc == 3, "usage: hd-video fixture.ivf reference.rgb");
	const Common::Array<byte> bytes = read(argv[1]), rgb = read(argv[2]);
	const Graphics::PixelFormat rgba(4, 8, 8, 8, 8, 0, 8, 16, 24);
	const Graphics::PixelFormat rgb565(2, 5, 6, 5, 0, 11, 5, 0, 0);
	check(rgb.size() == 8 * 64 * 48 * 3, "8-frame reference");
	for (int mode = 0; mode < 2; ++mode) {
		Scumm::DigHDVideo video;
		check(open(video, bytes, mode ? rgb565 : rgba) && video.frameCount() == 8, "valid IVF opens");
		uint32 hashes[8];
		for (int i = 0; i < 8; ++i) {
			const Graphics::Surface *picture = video.frame(i);
			compare(picture, rgb.data() + i * 64 * 48 * 3, mode ? 8 : 3);
			hashes[i] = hash(picture);
			check(hash(video.frame(i)) == hashes[i], "repeated frame is cached");
		}
		check(hash(video.frame(2)) == hashes[2], "backwards seek resets codec");
		check(hash(video.frame(7)) == hashes[7], "skipped SAN frames advance codec");
		check(hash(video.frame(0)) == hashes[0], "replay first frame");
		check(!video.frame(-1) && !video.frame(8), "out-of-range frames fail safely");
	}
	// Bad headers never reach libvpx.
	const int headerOffsets[] = {0, 4, 6, 8, 12, 14, 16, 20, 24};
	for (uint i = 0; i < ARRAYSIZE(headerOffsets); ++i) {
		Common::Array<byte> bad = bytes;
		bad[headerOffsets[i]] ^= 0xff;
		Scumm::DigHDVideo video;
		// Rate/scale and frame count need to be all zero to be invalid.
		if (headerOffsets[i] >= 16)
			WRITE_LE_UINT32(bad.data() + headerOffsets[i], 0);
		check(!open(video, bad, rgba), "bad header rejected");
	}
	for (int kind = 0; kind < 6; ++kind) {
		Common::Array<byte> bad = bytes;
		if (kind == 0) bad.resize(35);                          // short packet header
		if (kind == 1) WRITE_LE_UINT32(bad.data() + 32, 0xffffffff); // bounded packet
		if (kind == 2) WRITE_LE_UINT64(bad.data() + 36, 2);      // wrong frame number
		if (kind == 3) bad[44] &= ~0x10;                       // invisible frame
		if (kind == 4) WRITE_LE_UINT16(bad.data() + 50, 4096);  // wrong keyframe size
		if (kind == 5) bad[47] ^= 0xff;                        // corrupt keyframe
		Scumm::DigHDVideo video;
		check(open(video, bad, rgba) && !video.frame(0), "damaged packet fails safely");
		check(!video.frame(0), "failed stream is not retried");
	}
	Scumm::DigHDVideo empty;
	check(!empty.open(nullptr, 64, 48, rgba), "unreadable stream rejected");
	printf("PASS: VP8/RGB565/RGBA, independent decode, sequential/repeated/skipped/backwards frames, replay and malformed IVF.\n");
	return 0;
}
