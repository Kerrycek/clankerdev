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

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return Uint8Array.from(data ?? []);
}

function decodeUtf16Be(bytes) {
  const swapped = Buffer.from(bytes);
  for (let i = 0; i + 1 < swapped.length; i += 2) {
    const a = swapped[i];
    swapped[i] = swapped[i + 1];
    swapped[i + 1] = a;
  }
  return swapped.toString('utf16le');
}

function legacyHookDecode(data, encodingLabel = 'UTF-8') {
  const bytes = toUint8Array(data);
  const encoding = labelToName(encodingLabel) ?? 'UTF-8';

  if (encoding === 'windows-1252' || encoding === 'x-user-defined') {
    return Buffer.from(bytes).toString('latin1');
  }

  if (encoding === 'UTF-16LE') {
    return Buffer.from(bytes).toString('utf16le');
  }

  if (encoding === 'UTF-16BE') {
    return decodeUtf16Be(bytes);
  }

  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return Buffer.from(bytes).toString('utf8');
  }
}

module.exports = {
  getBOMEncoding,
  labelToName,
  legacyHookDecode,
};
