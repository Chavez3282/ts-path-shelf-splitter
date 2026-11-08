# ts-path-shelf-splitter

Splits path strings into their component parts and reassembles them, with explicit POSIX and Windows handling and no runtime dependencies.

## Usage

```js
import { parsePath, joinParts, normalizePath, isWindowsPath } from 'ts-path-shelf-splitter';

const p = parsePath('/usr/local/bin/node');
// { root: '/', dir: '/usr/local/bin', base: 'node', ext: '', name: 'node',
//   parts: ['usr', 'local', 'bin', 'node'], platform: 'posix' }

const rebuilt = joinParts(p, 'posix');   // '/usr/local/bin/node'

const clean = normalizePath('/a/b/../c/./d'); // '/a/c/d'

isWindowsPath('C:\\Windows'); // true
```

## Why

Standard `path` modules are platform-specific at import time: on Linux you get the POSIX implementation, on Windows the Win32 one. Code that needs to reason about a path that came from the *other* platform — a Windows deploy target described in a config file read on a Linux CI runner, say — has to swap modules or hand-roll splitting. This library keeps both flavours in one place behind four named functions: `parsePath`, `joinParts`, `normalizePath`, `isWindowsPath`.

The trade-off is depth. UNC paths (`\\server\share`) are detected and their leading backslash run is preserved, but the library does not resolve them against a UNC root semantics — it treats `server` and `share` as ordinary segments. If you need mount-point awareness, this is not the right tool.

## Edge you will hit

`isWindowsPath` is a heuristic: a path is treated as Windows when it starts with a drive letter (`C:`) or a backslash. A POSIX filename that *contains* a backslash will therefore be misclassified. Backslashes are illegal in Windows filenames and rare enough on POSIX that the heuristic holds for normal input, but it is a heuristic, not a guarantee. When you know the origin, pass `forcePlatform` to `parsePath` or `normalizePath` and bypass the guess entirely.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

