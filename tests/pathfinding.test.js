import { buildGraphFromGrid, getNode } from '../src/map/graph.js';
import { findPath } from '../src/map/pathfinding.js';

function pathFor(grid, start, end) {
  const graph = buildGraphFromGrid(grid);
  return findPath(graph, getNode(graph, start[0], start[1]), getNode(graph, end[0], end[1]));
}

describe('findPath', () => {
  test('finds the shortest path on an open grid', () => {
    const path = pathFor(
      [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ],
      [0, 0],
      [2, 2]
    );

    expect(path).toHaveLength(5);
  });

  test('returns null when no path exists', () => {
    const path = pathFor(
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0]
      ],
      [0, 0],
      [2, 2]
    );

    expect(path).toBeNull();
  });

  test('does not step onto blocked tiles', () => {
    const grid = [
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 0]
    ];
    const path = pathFor(grid, [0, 0], [2, 0]);

    expect(path).not.toBeNull();
    expect(path.every((node) => grid[node.y][node.x] === 0)).toBe(true);
  });

  test('start equals destination returns a single-node path', () => {
    const path = pathFor(
      [
        [0, 0],
        [0, 0]
      ],
      [1, 1],
      [1, 1]
    );

    expect(path).toHaveLength(1);
    expect(path[0].id).toBe('1,1');
  });

  test('finds a route around an obstacle', () => {
    const path = pathFor(
      [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0]
      ],
      [0, 1],
      [3, 1]
    );

    expect(path).not.toBeNull();
    expect(path.map((node) => node.id)).toEqual(['0,1', '0,0', '1,0', '2,0', '3,0', '3,1']);
  });
});
