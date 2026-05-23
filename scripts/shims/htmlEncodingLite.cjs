'use strict';

const LABELS = new Map([
  ['unicode-1-1-utf-8', 'UTF-8'],
  ['utf-8', 'UTF-8'],
  ['utf8', 'UTF-8'],
  ['utf-16', 'UTF-16LE'],
  ['utf-16le', 'UTF-16LE'],
  ['utf-16be', 'UTF-16BE'],
  ['windows-1252', 'windows-1252'],
  ['cp1252', 'windows-1252'],
  ['iso-8859-1', 'windows-1252'],
  ['iso8859-1', 'windows-1252'],
  ['latin1', 'windows-1252'],
  ['us-ascii', 'windows-1252'],
  ['x-user-defined', 'x-user-defined'],
]);

function labelToName(label) {
  const normalized = String(label ?? '').trim().toLowerCase();
  return LABELS.get(normalized) ?? null;
}

function getBOMEncoding(bytes) {
  if (!bytes || typeof bytes.length !== 'number') return null;
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'UTF-8';
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'UTF-16BE';
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'UTF-16LE';
  return null;
}

module.exports = {
  getBOMEncoding,
  labelToName,
};
