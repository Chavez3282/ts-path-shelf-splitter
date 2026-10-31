import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { parsePath, joinParts, normalizePath, isWindowsPath } from '../src/index.js';

test('parsePath splits a simple POSIX absolute path', () => {
  const p = parsePath('/usr/local/bin/node');
  assert.equal(p.root, '/');
  assert.equal(p.dir, '/usr/local/bin');
  assert.equal(p.base, 'node');
  assert.equal(p.ext, '');
  assert.equal(p.name, 'node');
  assert.deepEqual(p.parts, ['usr', 'local', 'bin', 'node']);
  assert.equal(p.platform, 'posix');
});

test('parsePath extracts a file extension', () => {
  const p = parsePath('/home/alice/report.tar.gz');
  assert.equal(p.base, 'report.tar.gz');
  assert.equal(p.ext, '.gz');
  assert.equal(p.name, 'report.tar');
});

test('parsePath treats leading-dot files as having no extension', () => {
  const p = parsePath('/home/alice/.bashrc');
  assert.equal(p.base, '.bashrc');
  assert.equal(p.ext, '');
  assert.equal(p.name, '.bashrc');
});

test('parsePath handles relative paths with no root', () => {
  const p = parsePath('src/index.js');
  assert.equal(p.root, '');
  assert.equal(p.dir, 'src');
  assert.equal(p.base, 'index.js');
  assert.equal(p.ext, '.js');
  assert.equal(p.name, 'index');
});

test('parsePath collapses repeated separators into empty segments that are dropped', () => {
  const p = parsePath('/usr//local///bin');
  assert.deepEqual(p.parts, ['usr', 'local', 'bin']);
  assert.equal(p.root, '/');
});

test('parsePath recognises a Windows drive path', () => {
  const p = parsePath('C:\\Users\\Alice\\Documents\\notes.txt');
  assert.equal(p.platform, 'windows');
  assert.equal(p.root, '');
  assert.equal(p.dir, 'C:\\Users\\Alice\\Documents');
  assert.equal(p.base, 'notes.txt');
  assert.equal(p.ext, '.txt');
  assert.equal(p.name, 'notes');
});

test('parsePath recognises a Windows UNC-style leading backslash path', () => {
  const p = parsePath('\\\\server\\share\\file.dat');
  assert.equal(p.platform, 'windows');
  assert.equal(p.root, '\\\\');
  assert.deepEqual(p.parts, ['server', 'share', 'file.dat']);
  assert.equal(p.dir, '\\\\server\\share');
  assert.equal(p.base, 'file.dat');
});

test('isWindowsPath detects drive letters and leading backslashes', () => {
  assert.equal(isWindowsPath('C:\\Windows'), true);
  assert.equal(isWindowsPath('D:/Data'), true);
  assert.equal(isWindowsPath('\\\\server\\share'), true);
  assert.equal(isWindowsPath('/usr/local'), false);
  assert.equal(isWindowsPath('relative/path'), false);
});

test('joinParts rebuilds a POSIX path from parts', () => {
  const rebuilt = joinParts(['usr', 'local', 'bin'], 'posix');
  assert.equal(rebuilt, 'usr/local/bin');
});

test('joinParts rebuilds an absolute path from a parsed object', () => {
  const p = parsePath('/var/log/app.log');
  const rebuilt = joinParts(p, 'posix');
  assert.equal(rebuilt, '/var/log/app.log');
});

test('joinParts uses backslashes on windows', () => {
  const rebuilt = joinParts(['Users', 'Alice', 'Desktop'], 'windows');
  assert.equal(rebuilt, 'Users\\Alice\\Desktop');
});

test('normalizePath resolves . and .. segments', () => {
  assert.equal(normalizePath('/a/b/../c/./d'), '/a/c/d');
});

test('normalizePath drops .. that would climb above root', () => {
  assert.equal(normalizePath('/../../etc'), '/etc');
});

test('normalizePath on a Windows path keeps backslash separators', () => {
  assert.equal(normalizePath('C:\\Users\\..\\Users\\Bob\\.'), 'C:\\Users\\Bob');
});

test('parsePath with forcePlatform overrides the heuristic', () => {
  const p = parsePath('C:/Users/Bob', 'posix');
  assert.equal(p.platform, 'posix');
  assert.deepEqual(p.parts, ['C:', 'Users', 'Bob']);
});

test('parsePath on a bare filename returns empty dir and root', () => {
  const p = parsePath('README.md');
  assert.equal(p.root, '');
  assert.equal(p.dir, '');
  assert.equal(p.base, 'README.md');
  assert.equal(p.ext, '.md');
  assert.equal(p.name, 'README');
});

test('parsePath on a trailing-separator path drops the trailing empty segment', () => {
  const p = parsePath('/usr/local/');
  assert.equal(p.root, '/');
  assert.deepEqual(p.parts, ['usr', 'local']);
});

test('joinParts with an empty array and a root returns just the root', () => {
  assert.equal(joinParts({ root: '/', parts: [] }, 'posix'), '/');
});
