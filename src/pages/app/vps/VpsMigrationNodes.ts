import { fetchNodes, type Node } from '../../../lib/api/nodes';

/** Node#index uses the default ascending ID cursor, unlike node status history. */
export async function fetchMigrationNodes(): Promise<Node[]> {
  const nodes: Node[] = [];
  let fromId = 0;
  // Do not silently present a truncated list, including when the API caps limit.
  for (;;) {
    const page = await fetchNodes({ limit: 100, fromId, type: 'node', state: 'active', includes: 'location__environment' });
    if (!page.data.length) return nodes;
    let previousId = fromId;
    for (const node of page.data) {
      if (!Number.isSafeInteger(node.id) || node.id <= previousId) {
        throw new Error('Migration node list did not advance in ID order');
      }
      previousId = node.id;
    }
    nodes.push(...page.data);
    fromId = previousId;
  }
}
