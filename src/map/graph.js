export function nodeId(x, y) {
  return `${x},${y}`;
}

export function buildGraphFromGrid(grid) {
  const nodes = new Map();
  const adjacency = new Map();
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ];

  grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile !== 0) return;
      const id = nodeId(x, y);
      const node = { id, x, y };
      nodes.set(id, node);
      adjacency.set(id, []);
    });
  });

  for (const node of nodes.values()) {
    for (const [dx, dy] of directions) {
      const neighborId = nodeId(node.x + dx, node.y + dy);
      if (nodes.has(neighborId)) {
        adjacency.get(node.id).push({ node: nodes.get(neighborId), cost: 1 });
      }
    }
  }

  return { nodes, adjacency };
}

export function getNode(graph, x, y) {
  return graph.nodes.get(nodeId(x, y)) ?? null;
}
