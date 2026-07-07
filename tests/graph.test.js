import { buildGraphFromGrid, getNode } from '../src/map/graph.js';

describe('buildGraphFromGrid', () => {
  test('builds one node per walkable tile', () => {
    const graph = buildGraphFromGrid([
      [0, 1, 0],
      [0, 0, 1]
    ]);

    expect(graph.nodes.size).toBe(4);
  });

  test('excludes blocked tiles', () => {
    const graph = buildGraphFromGrid([
      [0, 1],
      [1, 0]
    ]);

    expect(getNode(graph, 1, 0)).toBeNull();
    expect(getNode(graph, 0, 1)).toBeNull();
  });

  test('connects only adjacent walkable tiles', () => {
    const graph = buildGraphFromGrid([
      [0, 0, 0],
      [1, 0, 1],
      [0, 0, 0]
    ]);

    const center = getNode(graph, 1, 1);
    const neighbors = graph.adjacency.get(center.id).map((edge) => edge.node.id).sort();

    expect(neighbors).toEqual(['1,0', '1,2']);
    expect(neighbors).not.toContain('0,0');
  });
});
