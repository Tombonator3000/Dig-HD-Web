# HTTP filesystem regression check

Run after the WebAssembly build, with its Emscripten environment active:

```sh
source engine/emsdk/emsdk_env.sh
engine/tests/test-http-fs-cache.sh engine/scummvm-web
```

Pass another built source directory as the argument if `SCUMMVM_WEB_SRC` was used.
The check links the existing WebAssembly objects and libraries and recompiles
only the HTTP backend and a small test driver. It needs no browser, credentials,
network requests, or game files. Node is supplied by the Emscripten environment.

The driver exercises the real `HTTPFilesystemNode` and ScummVM JSON parser.
A test-only `emscripten.h` replaces the two asynchronous fetch bridges with
in-memory fixtures; filesystem metadata and lookup code are unchanged.
It checks 90,000 lookups in a 30,000-file directory, one parse/fetch per directory,
stable metadata and live allocated bytes after warmup, independently owned
listing nodes, file/directory filtering, missing files, empty directories,
`baseUrl` redirects, path normalization and retry after a failed index request.
The timing is diagnostic, not a machine-dependent pass threshold.

This is a backend regression check. Saving in IndexedDB, real browser input and
runtime animation performance still need browser verification.

# Packaging verification

```sh
python3 engine/tests/test-build-pages.py -v
```

These three fast tests use temporary Git repositories to check stacked patches
that modify an earlier patch's new file, rejection of missing or extra changes,
and preservation of both the real index and unrelated working files.
No WebAssembly build is needed. Git rejection messages in the negative tests
are expected; the test suite must finish with `OK`.
