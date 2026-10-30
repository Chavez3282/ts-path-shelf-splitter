/**
 * Path shelf splitter — core implementation.
 *
 * The library deliberately uses a single source of truth for what counts as
 * a path separator: the SEPARATORS map below.  Keeping it in one place makes
 * the POSIX-vs-Windows reasoning auditable instead of scattered across string
 * operations that each happen to know about \\ and /.
 */

/**
 * Separator characters we recognise, keyed by platform label.
 * Windows accepts both backslash and forward slash in real APIs, so both
 * are listed there rather than splitting Windows into two flavours.
 */
const SEPARATORS = {
  posix: '/',
  windows: '\\\/',
};

/**
 * Compile a separator string into a character class pattern.
 * Returns a RegExp whose first match is a run of separator characters.
 */
function separatorPattern(platform) {
  const chars = SEPARATORS[platform];
  if (!chars) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return new RegExp(`[${escapeForCharClass(chars)}]+`);
}

/**
 * Escape characters that would otherwise be interpreted inside a RegExp
 * character class.  Only \\ needs escaping inside [] for our needs, but we
 * also escape ] defensively in case a future separator uses it.
 */
function escapeForCharClass(chars) {
  return chars.replace(/[\\\]]/g, (c) => `\\${c}`);
}

/**
 * Treat a leading run of separators as an absolute-root marker.
 *
 * POSIX has a single "/" root; Windows has a single \\ root but in practice
 * users pass \\Server\share paths too.  We do NOT attempt to resolve UNC
 * semantics here — that is the documented trade-off — but we do preserve
 * the leading separators so the caller can see them.
 */
function detectRoot(path, platform) {
  if (path.length === 0) return { root: '', rest: path };
  const pattern = new RegExp(`^(${separatorPattern(platform).source})`);
  const match = path.match(pattern);
  if (match) {
    return { root: match[0], rest: path.slice(match[0].length) };
  }
  return { root: '', rest: path };
}

/**
 * Heuristic: does the path look like a Windows-style path?
 *
 * We say "yes" when it starts with a drive letter (C:\) or with a backslash.
 * This is conservative — a POSIX path containing a backslash as a literal
 * filename character will be misidentified, but backslashes in filenames are
 * illegal on Windows and vanishingly rare on POSIX, so the heuristic is
 * sound for the inputs the library is designed for.
 */
export function isWindowsPath(path) {
  if (typeof path !== 'string') return false;
  if (path.length >= 2 && /^[A-Za-z]:/.test(path.slice(0, 2))) return true;
  return path.startsWith('\\');
}

/**
 * Split a path string into its component parts.
 *
 * Returns an object with:
 *   - root:    the leading separator run (empty string if relative)
 *   - dir:     the directory portion, joined with the platform separator,
 *              excluding the final segment but including the root
 *   - base:    the final non-empty segment, or '' if none
 *   - ext:     the extension of base, including the leading dot, or ''
 *   - name:    base without its extension
 *   - parts:   the array of non-empty segments between separators
 *   - platform: 'windows' | 'posix' — the platform the path was treated as
 *
 * The platform is inferred from the path itself unless `forcePlatform` is
 * supplied, which is useful when you know the origin and want to stop the
 * heuristic from second-guessing you.
 */
export function parsePath(path, forcePlatform) {
  if (typeof path !== 'string') {
    throw new TypeError('path must be a string');
  }
  const platform = forcePlatform || (isWindowsPath(path) ? 'windows' : 'posix');
  const pattern = separatorPattern(platform);

  const { root, rest } = detectRoot(path, platform);

  // Split the remainder and discard empty segments produced by consecutive
  // separators.
  const raw = rest.split(pattern);
  const segments = raw.filter((s) => s.length > 0);

  const base = segments.length > 0 ? segments[segments.length - 1] : '';
  const dirSegments = segments.slice(0, -1);

  const sep = platform === 'windows' ? '\\' : '/';
  const dir = root + dirSegments.join(sep);

  const ext = extractExtension(base);
  const name = ext ? base.slice(0, base.length - ext.length) : base;

  return {
    root,
    dir: dir.length > 0 ? dir : (root || ''),
    base,
    ext,
    name,
    parts: segments,
    platform,
  };
}

/**
 * Pull the extension off a base name.
 *
 * A leading-dot file (.bashrc) has no extension — the dot is part of the
 * name.  We only treat text after the LAST dot as an extension when that
 * dot is not the first character.
 */
function extractExtension(base) {
  if (!base) return '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return ''; // dot at position 0 => hidden file, no ext
  return base.slice(dot);
}

/**
 * Reassemble a path from its parts.
 *
 * `parts` may be a ParsedPath object or a plain array of strings.  When an
 * object is supplied the `root` and `parts` fields are honoured; when an
 * array is supplied the path is treated as relative unless `root` is given.
 *
 * `platform` controls the separator used in the output and defaults to
 * 'posix'.
 */
export function joinParts(parts, platform) {
  const plat = platform || 'posix';
  if (plat !== 'posix' && plat !== 'windows') {
    throw new Error(`Unknown platform: ${plat}`);
  }
  const sep = plat === 'windows' ? '\\' : '/';

  let root = '';
  let segments;

  if (Array.isArray(parts)) {
    segments = parts.filter((s) => typeof s === 'string' && s.length > 0);
  } else if (parts && typeof parts === 'object') {
    root = parts.root || '';
    const src = Array.isArray(parts.parts) ? parts.parts : [];
    segments = src.filter((s) => typeof s === 'string' && s.length > 0);
  } else {
    throw new TypeError('parts must be an array or a parsed path object');
  }

  const joined = segments.join(sep);
  if (root && joined) return root + joined;
  return root + joined;
}

/**
 * Collapse repeated separators and resolve "." and ".." segments.
 *
 * ".." that would climb above the root is silently dropped — the same
 * behaviour as Node's path.normalize on POSIX.  This keeps the output
 * within the subtree the root describes, which is what callers usually want
 * when normalising untrusted input.
 */
export function normalizePath(path, forcePlatform) {
  const parsed = parsePath(path, forcePlatform);
  const stack = [];

  for (const seg of parsed.parts) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(seg);
  }

  return joinParts({ root: parsed.root, parts: stack }, parsed.platform);
}
