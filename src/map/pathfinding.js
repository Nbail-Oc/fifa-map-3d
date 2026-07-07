function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(cameFrom, current) {
  const path = [current];

  while (cameFrom.has(current.id)) {
    current = cameFrom.get(current.id);
    path.unshift(current);
  }

  return path;
}

export function findPath(graph, startNode, endNode) {
  if (!startNode || !endNode) return null;
  if (startNode.id === endNode.id) return [startNode];

  const open = new Map([[startNode.id, startNode]]);
  const cameFrom = new Map();
  const gScore = new Map([[startNode.id, 0]]);
  const fScore = new Map([[startNode.id, heuristic(startNode, endNode)]]);

  while (open.size > 0) {
    let current = null;
    let currentScore = Infinity;

    for (const node of open.values()) {
      const score = fScore.get(node.id) ?? Infinity;
      if (score < currentScore) {
        current = node;
        currentScore = score;
      }
    }

    if (current.id === endNode.id) {
      return reconstructPath(cameFrom, current);
    }

    open.delete(current.id);

    for (const edge of graph.adjacency.get(current.id) ?? []) {
      const tentative = (gScore.get(current.id) ?? Infinity) + edge.cost;
      if (tentative < (gScore.get(edge.node.id) ?? Infinity)) {
        cameFrom.set(edge.node.id, current);
        gScore.set(edge.node.id, tentative);
        fScore.set(edge.node.id, tentative + heuristic(edge.node, endNode));
        open.set(edge.node.id, edge.node);
      }
    }
  }

  return null;
}
