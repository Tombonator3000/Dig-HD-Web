#define FORBIDDEN_SYMBOL_EXCEPTION_FILE
#define FORBIDDEN_SYMBOL_EXCEPTION_printf
#define FORBIDDEN_SYMBOL_EXCEPTION_fprintf
#define FORBIDDEN_SYMBOL_EXCEPTION_fopen
#define FORBIDDEN_SYMBOL_EXCEPTION_fclose
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <malloc.h>
#include "backends/fs/emscripten/http-fs.h"
#include "common/system.h"
#include "common/debug.h"
#include "common/textconsole.h"

#undef stderr
#undef exit
#undef abort
#undef clock
OSystem *g_system = nullptr;

static Common::HashMap<Common::String, Common::String> indexes;
static Common::HashMap<Common::String, int> fetches;
char *_httpFsFetchIndex(const char *url) {
	++fetches[url];
	const Common::String &text = indexes[url];
	char *response = (char *)malloc(text.size() + 1);
	memcpy(response, text.c_str(), text.size() + 1);
	return response;
}
bool _httpFsFetchFile(const char *, byte *, int) { return false; }
class Probe : public HTTPFilesystemNode {
public:
	Probe(const Common::String &path) : HTTPFilesystemNode(path) {}
	static uint entries() { return _httpEntries.size(); }
	static uint folders() { return _httpFolders.size(); }
	static void reset() { _httpEntries.clear(); _httpFolders.clear(); }
};
static void clearList(AbstractFSList &list) { for (uint i = 0; i < list.size(); ++i) delete list[i]; list.clear(); }
static void check(bool pass, const char *message) { if (!pass) { fprintf(stderr, "FAIL: %s\n", message); exit(1); } }
int main() {
	indexes["/data/index.json"] = "{\"mods\":{},\"empty\":{},\"retry\":{},\"redirect\":{\"baseUrl\":\"https://cdn.example/test\"},\"top.bin\":3}";
	indexes["/data/mods/index.json"] = "{\"gpt\":{}}";
	indexes["/data/mods/gpt/index.json"] = "{\"costumes\":{}}";
	indexes["/data/empty/index.json"] = "{}";
	indexes["https://cdn.example/test/index.json"] = "{\"remote.bin\":12}";
	Common::String large = "{\"child\":{}";
	for (int i = 0; i < 30000; ++i)
		large += Common::String::format(",\"frame%05d.png\":%d", i, i + 1);
	large += "}";
	indexes["/data/mods/gpt/costumes/index.json"] = large;
	Probe initial("/data/mods/gpt/costumes/frame12345.png");
	check(initial.exists() && !initial.isDirectory(), "nested first lookup");
	const uint entryCount = Probe::entries();
	const clock_t start = clock();
	int warmBytes = 0;
	for (int pass = 0; pass < 3; ++pass) {
		for (int i = 0; i < 30000; ++i) {
			Probe node(Common::String::format("/data/mods/gpt/costumes/frame%05d.png", i));
			check(node.exists() && !node.isDirectory(), "indexed lookup");
		}
		if (pass == 0)
			warmBytes = mallinfo().uordblks;
		else
			check(mallinfo().uordblks == warmBytes, "lookups retain no allocations after warmup");
	}
	const double seconds = double(clock() - start) / CLOCKS_PER_SEC;
	check(Probe::entries() == entryCount, "repeated lookups do not grow metadata");
	check(fetches["/data/mods/gpt/costumes/index.json"] == 1, "large index fetched once");
	Probe missing("/data/mods/gpt/costumes/missing.png");
	check(!missing.exists(), "missing file stays missing");
	check(fetches["/data/mods/gpt/costumes/index.json"] == 1, "missing lookup reuses parsed index");
	Probe directory("/data/mods/gpt/costumes");
	AbstractFSList list;
	check(directory.getChildren(list, Common::FSNode::kListFilesOnly, true) && list.size() == 30000, "file listing owns 30000 nodes");
	check(list[0]->exists(), "returned nodes valid");
	clearList(list);
	check(directory.getChildren(list, Common::FSNode::kListDirectoriesOnly, true) && list.size() == 1, "directory filter");
	clearList(list);
	Probe empty("/data/empty");
	check(empty.getChildren(list, Common::FSNode::kListAll, true) && list.empty(), "empty directory");
	check(empty.getChildren(list, Common::FSNode::kListAll, true), "repeat empty directory");
	check(fetches["/data/empty/index.json"] == 1, "empty index fetched once");
	Probe remote("/data/redirect/remote.bin");
	check(remote.exists() && fetches["https://cdn.example/test/index.json"] == 1, "baseUrl redirect");
	Probe retry("/data/retry");
	check(!retry.getChildren(list, Common::FSNode::kListAll, true), "missing index returns false");
	indexes["/data/retry/index.json"] = "{}";
	check(retry.getChildren(list, Common::FSNode::kListAll, true), "missing index can be retried");
	check(fetches["/data/retry/index.json"] == 2, "404 behavior is retained");
	Probe normalized("/data//mods/gpt/costumes/./frame12345.png");
	check(normalized.exists(), "path normalization");
	printf("PASS: 90000 real HTTPFilesystemNode lookups against 30000 entries in %.3f seconds; metadata remains %u entries with stable live allocations; listings, missing files, empty indexes, redirect, failed-index retry and normalization pass.\n", seconds, entryCount);
	Probe::reset();
	return 0;
}
