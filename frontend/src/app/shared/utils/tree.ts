/** Flatten a recursive tree into a depth-annotated list. */
export function flattenTree<T extends { children?: T[] }>(
  nodes: T[],
  depth = 0,
): { node: T; depth: number }[] {
  const result: { node: T; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}
