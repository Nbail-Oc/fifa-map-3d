// Helper function to add exterior padding to the existing stadium grid
export function addExteriorTiles(originalGrid, padding = 5) {
  const rows = originalGrid.length;
  const cols = originalGrid[0].length;
  const newRows = rows + (padding * 2);
  const newCols = cols + (padding * 2);
  
  const expandedGrid = [];
  
  for (let y = 0; y < newRows; y++) {
    const row = [];
    for (let x = 0; x < newCols; x++) {
      // Check if we're in the padding area
      if (y < padding || y >= rows + padding || x < padding || x >= cols + padding) {
        // Exterior area - create pattern with parking, grass, and trees
        const distFromEdge = Math.min(
          y < padding ? y : (y >= rows + padding ? newRows - 1 - y : padding),
          x < padding ? x : (x >= cols + padding ? newCols - 1 - x : padding)
        );
        
        // Create a pattern: roads nearest edge, then parking, then grass/trees
        if (distFromEdge === 0) {
          row.push(7); // Road on outermost edge
        } else if (distFromEdge === 1) {
          row.push(4); // Parking lot
        } else if (distFromEdge === 2) {
          // Mix parking and grass
          row.push((x + y) % 3 === 0 ? 5 : 4);
        } else {
          // Inner exterior: grass and trees
          const isTree = (x % 4 === 0 && y % 4 === 0) || (x % 4 === 2 && y % 4 === 2);
          row.push(isTree ? 6 : 5);
        }
      } else {
        // Copy from original grid
        row.push(originalGrid[y - padding][x - padding]);
      }
    }
    expandedGrid.push(row);
  }
  
  return expandedGrid;
}

// Adjust spawn point and POI coordinates for the padding
export function adjustCoordinatesForPadding(coords, padding = 5) {
  return {
    ...coords,
    tileX: coords.tileX + padding,
    tileY: coords.tileY + padding
  };
}

export function adjustPOIsForPadding(pois, padding = 5) {
  return pois.map(poi => adjustCoordinatesForPadding(poi, padding));
}

// Upscale the original grid tile values by a given factor
export function upscaleGrid(grid, factor = 2) {
  const upscaled = [];
  for (let y = 0; y < grid.length; y++) {
    for (let fy = 0; fy < factor; fy++) {
      const newRow = [];
      for (let x = 0; x < grid[y].length; x++) {
        for (let fx = 0; fx < factor; fx++) {
          newRow.push(grid[y][x]);
        }
      }
      upscaled.push(newRow);
    }
  }
  return upscaled;
}

// Upscale the coordinates of POIs by a given factor
export function upscalePOIs(pois, factor = 2) {
  return pois.map(poi => ({
    ...poi,
    tileX: poi.tileX * factor,
    tileY: poi.tileY * factor
  }));
}

