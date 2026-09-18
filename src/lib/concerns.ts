export interface ConcernRef {
  class_name: string;
  row_id: number;
  /** Human-friendly class label supplied by the transaction-chain API. */
  class_label?: string;
  label?: string;
  /** Raw object from the API (for debugging). */
  raw?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function positiveInteger(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) return null;
  return v;
}

function coerceString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : null;
  }
  return null;
}

function pickLabel(obj: Record<string, unknown>): string | undefined {
  return (
    coerceString(obj['label']) ??
    coerceString(obj['name']) ??
    coerceString(obj['hostname']) ??
    undefined
  );
}

function validClassName(value: unknown): string | null {
  const className = coerceString(value);
  if (!className || !/^[A-Za-z][A-Za-z0-9_:]*$/.test(className)) return null;
  return className;
}

function classLabels(value: unknown): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  if (!isRecord(value) || Array.isArray(value)) return labels;

  for (const [rawClassName, rawLabel] of Object.entries(value)) {
    const className = validClassName(rawClassName);
    const label = coerceString(rawLabel);
    if (className && label) labels.set(className, label);
  }

  return labels;
}

function directObjectRef(value: unknown): { className: unknown; rowId: unknown; label?: string } | null {
  if (!isRecord(value) || Array.isArray(value)) return null;

  if ('class_name' in value && 'row_id' in value) {
    return { className: value['class_name'], rowId: value['row_id'], label: pickLabel(value) };
  }
  if ('class_name' in value && 'id' in value) {
    return { className: value['class_name'], rowId: value['id'], label: pickLabel(value) };
  }
  if ('className' in value && 'rowId' in value) {
    return { className: value['className'], rowId: value['rowId'], label: pickLabel(value) };
  }
  if ('class' in value && 'id' in value) {
    return { className: value['class'], rowId: value['id'], label: pickLabel(value) };
  }

  return null;
}

function tupleRef(value: unknown, exact: boolean): { className: unknown; rowId: unknown; label?: string } | null {
  if (!Array.isArray(value) || value.length < 2 || (exact && value.length !== 2)) return null;
  const label = !exact && typeof value[2] === 'string' && value[2].trim() ? value[2].trim() : undefined;
  return { className: value[0], rowId: value[1], label };
}

/**
 * Normalize the two transaction-chain concern shapes understood by the UI.
 *
 * The active f94 API returns an envelope such as:
 * `{ type: "affect", objects: [["Vps", 123]], labels: { Vps: "VPS" } }`.
 * Older fixtures and cached payloads can contain a top-level array of tuples or
 * direct concern objects. Unknown nesting and malformed references are ignored
 * deliberately so untrusted custom payload fields cannot turn into UI links.
 */
export function normalizeTransactionChainConcerns(concerns: unknown): ConcernRef[] {
  const out: ConcernRef[] = [];
  const seen = new Set<string>();

  const push = (
    candidate: { className: unknown; rowId: unknown; label?: string } | null,
    labels: ReadonlyMap<string, string>,
    raw: unknown
  ) => {
    if (!candidate) return;
    const className = validClassName(candidate.className);
    const rowId = positiveInteger(candidate.rowId);
    if (!className || rowId === null) return;

    const key = `${className}:${rowId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      class_name: className,
      row_id: rowId,
      class_label: labels.get(className),
      label: candidate.label,
      raw,
    });
  };

  if (Array.isArray(concerns)) {
    const labels = new Map<string, string>();
    for (const item of concerns) {
      push(tupleRef(item, false) ?? directObjectRef(item), labels, item);
    }
    return out;
  }

  if (!isRecord(concerns) || Array.isArray(concerns) || !('objects' in concerns)) return out;
  const objects = concerns['objects'];
  if (!Array.isArray(objects)) return out;

  const labels = classLabels(concerns['labels']);
  for (const item of objects) {
    // The f94 envelope contract contains exact [class_name, row_id] tuples.
    push(tupleRef(item, true), labels, item);
  }

  return out;
}

/**
 * Backward-compatible name used by existing consumers. Extraction is now
 * deliberately limited to the documented envelope and legacy top-level list.
 */
export function extractConcernRefs(concerns: unknown, _opts?: { maxDepth?: number }): ConcernRef[] {
  return normalizeTransactionChainConcerns(concerns);
}
