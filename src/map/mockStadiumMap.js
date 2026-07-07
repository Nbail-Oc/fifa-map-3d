import { addExteriorTiles, adjustCoordinatesForPadding, adjustPOIsForPadding, upscaleGrid, upscalePOIs } from './expandedStadiumMap.js';

export const TILE_SIZE = 32;
export const EXTERIOR_PADDING = 5; // Number of tiles to add around the stadium

// ============================================================================
// ISOMETRIC PROJECTION CONSTANTS
// ----------------------------------------------------------------------------
export const ISO_TILE_WIDTH = 64;   // full diamond width in px
export const ISO_TILE_HEIGHT = 32;  // full diamond height in px (2:1 ratio)
export const WALL_HEIGHT = 26;      // px the wall block extrudes upward
export const SEAT_HEIGHT = 14;      // px the seating riser extrudes upward

// ============================================================================
// STADIUM MAP LAYOUT (60 x 46 tiles - includes exterior area)
// ----------------------------------------------------------------------------
// Tile values (multi-value tiles):
//   0 -> Concourse / Walkway     (walkable)
//   1 -> Structural Wall          (outer shell / barriers, not walkable)
//   2 -> Spectator Seating Block  (not walkable - decorative seating rows)
//   3 -> Soccer Pitch / Field     (not walkable - grass playing field)
//   4 -> Parking Lot / Pavement   (exterior, walkable)
//   5 -> Grass / Landscaping      (exterior, not walkable)
//   6 -> Trees / Decorative       (exterior, not walkable)
//   7 -> Road / Street            (exterior, walkable)
//
// Layout, working inward from the outside:
//   Exterior (4,5,6,7) -> parking lots, roads, landscaping surrounding stadium
//   Outer Wall (1)     -> stadium perimeter / exterior facade, 14 gate openings
//   Concourse A (0)    -> outer walkable ring, with alcove rooms (restrooms,
//                         food stands, medical, merch)
//   Seating Ring A (2) -> lower bowl seating blocks, with vomitory tunnels (0)
//                         cutting through to Concourse B (Sections 101-138)
//   Concourse B (0)    -> inner walkable ring (premium concourse)
//   Seating Ring B (2) -> premium lower-bowl seating, with tunnels (0) leading
//                         to the field-side rail (Premium Sections 201-214)
//   Field (3)          -> the pitch itself (center), not walkable by spectators
// ============================================================================

// Original stadium grid (50 x 36)
const originalTileGrid = [
  [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 1],
  [0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0],
  [1, 0, 0, 2, 2, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 0, 0, 2, 2, 2, 0, 0, 1],
  [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
];

// Export the expanded grid with exterior tiles (upscaled by factor of 4)
const upscaledTileGrid = upscaleGrid(originalTileGrid, 4);
export const tileGrid = addExteriorTiles(upscaledTileGrid, EXTERIOR_PADDING);

// ============================================================================
// POINTS OF INTEREST
// ----------------------------------------------------------------------------
// type: 'gate'     -> stadium entrance/exit (14)
// type: 'seat'     -> seating section / vomitory tunnel entrance (38)
// type: 'food'     -> food & beverage stand (10)
// type: 'restroom' -> restroom (6)
// type: 'medical'  -> first-aid / medical point (4)
// type: 'merch'    -> merchandise stand (4)
// ============================================================================

const originalPois = [
  { id: 'gate-1', name: 'Gate 1', type: 'gate', tileX: 6, tileY: 0 },
  { id: 'gate-2', name: 'Gate 2', type: 'gate', tileX: 18, tileY: 0 },
  { id: 'gate-3', name: 'Gate 3', type: 'gate', tileX: 30, tileY: 0 },
  { id: 'gate-4', name: 'Gate 4', type: 'gate', tileX: 42, tileY: 0 },
  { id: 'gate-5', name: 'Gate 5', type: 'gate', tileX: 6, tileY: 35 },
  { id: 'gate-6', name: 'Gate 6', type: 'gate', tileX: 18, tileY: 35 },
  { id: 'gate-7', name: 'Gate 7', type: 'gate', tileX: 30, tileY: 35 },
  { id: 'gate-8', name: 'Gate 8', type: 'gate', tileX: 42, tileY: 35 },
  { id: 'gate-9', name: 'Gate 9', type: 'gate', tileX: 0, tileY: 8 },
  { id: 'gate-10', name: 'Gate 10', type: 'gate', tileX: 0, tileY: 18 },
  { id: 'gate-11', name: 'Gate 11', type: 'gate', tileX: 0, tileY: 27 },
  { id: 'gate-12', name: 'Gate 12', type: 'gate', tileX: 49, tileY: 8 },
  { id: 'gate-13', name: 'Gate 13', type: 'gate', tileX: 49, tileY: 18 },
  { id: 'gate-14', name: 'Gate 14', type: 'gate', tileX: 49, tileY: 27 },
  { id: 'section-101', name: 'Section 101', type: 'seat', tileX: 6, tileY: 2 },
  { id: 'section-102', name: 'Section 102', type: 'seat', tileX: 12, tileY: 2 },
  { id: 'section-103', name: 'Section 103', type: 'seat', tileX: 18, tileY: 2 },
  { id: 'section-104', name: 'Section 104', type: 'seat', tileX: 24, tileY: 2 },
  { id: 'section-105', name: 'Section 105', type: 'seat', tileX: 30, tileY: 2 },
  { id: 'section-106', name: 'Section 106', type: 'seat', tileX: 36, tileY: 2 },
  { id: 'section-107', name: 'Section 107', type: 'seat', tileX: 42, tileY: 2 },
  { id: 'section-108', name: 'Section 108', type: 'seat', tileX: 6, tileY: 33 },
  { id: 'section-109', name: 'Section 109', type: 'seat', tileX: 12, tileY: 33 },
  { id: 'section-110', name: 'Section 110', type: 'seat', tileX: 18, tileY: 33 },
  { id: 'section-111', name: 'Section 111', type: 'seat', tileX: 24, tileY: 33 },
  { id: 'section-112', name: 'Section 112', type: 'seat', tileX: 30, tileY: 33 },
  { id: 'section-113', name: 'Section 113', type: 'seat', tileX: 36, tileY: 33 },
  { id: 'section-114', name: 'Section 114', type: 'seat', tileX: 42, tileY: 33 },
  { id: 'section-115', name: 'Section 115', type: 'seat', tileX: 2, tileY: 5 },
  { id: 'section-116', name: 'Section 116', type: 'seat', tileX: 2, tileY: 10 },
  { id: 'section-117', name: 'Section 117', type: 'seat', tileX: 2, tileY: 15 },
  { id: 'section-118', name: 'Section 118', type: 'seat', tileX: 2, tileY: 20 },
  { id: 'section-119', name: 'Section 119', type: 'seat', tileX: 2, tileY: 25 },
  { id: 'section-120', name: 'Section 120', type: 'seat', tileX: 47, tileY: 5 },
  { id: 'section-121', name: 'Section 121', type: 'seat', tileX: 47, tileY: 10 },
  { id: 'section-122', name: 'Section 122', type: 'seat', tileX: 47, tileY: 15 },
  { id: 'section-123', name: 'Section 123', type: 'seat', tileX: 47, tileY: 20 },
  { id: 'section-124', name: 'Section 124', type: 'seat', tileX: 47, tileY: 25 },
  { id: 'section-201', name: 'Premium Section 201', type: 'seat', tileX: 10, tileY: 7 },
  { id: 'section-202', name: 'Premium Section 202', type: 'seat', tileX: 20, tileY: 7 },
  { id: 'section-203', name: 'Premium Section 203', type: 'seat', tileX: 30, tileY: 7 },
  { id: 'section-204', name: 'Premium Section 204', type: 'seat', tileX: 40, tileY: 7 },
  { id: 'section-205', name: 'Premium Section 205', type: 'seat', tileX: 10, tileY: 28 },
  { id: 'section-206', name: 'Premium Section 206', type: 'seat', tileX: 20, tileY: 28 },
  { id: 'section-207', name: 'Premium Section 207', type: 'seat', tileX: 30, tileY: 28 },
  { id: 'section-208', name: 'Premium Section 208', type: 'seat', tileX: 40, tileY: 28 },
  { id: 'section-209', name: 'Premium Section 209', type: 'seat', tileX: 7, tileY: 8 },
  { id: 'section-210', name: 'Premium Section 210', type: 'seat', tileX: 7, tileY: 18 },
  { id: 'section-211', name: 'Premium Section 211', type: 'seat', tileX: 7, tileY: 27 },
  { id: 'section-212', name: 'Premium Section 212', type: 'seat', tileX: 42, tileY: 8 },
  { id: 'section-213', name: 'Premium Section 213', type: 'seat', tileX: 42, tileY: 18 },
  { id: 'section-214', name: 'Premium Section 214', type: 'seat', tileX: 42, tileY: 27 },
  { id: 'restroom-top-1', name: 'North Restroom 1', type: 'restroom', tileX: 4, tileY: 4 },
  { id: 'food-top-1', name: 'North Food Stand 1', type: 'food', tileX: 10, tileY: 4 },
  { id: 'food-top-2', name: 'North Food Stand 2', type: 'food', tileX: 16, tileY: 4 },
  { id: 'medical-top-1', name: 'North Medical Point 1', type: 'medical', tileX: 22, tileY: 4 },
  { id: 'merch-top-1', name: 'North Merchandise Stand 1', type: 'merch', tileX: 28, tileY: 4 },
  { id: 'restroom-top-2', name: 'North Restroom 2', type: 'restroom', tileX: 34, tileY: 4 },
  { id: 'food-top-3', name: 'North Food Stand 3', type: 'food', tileX: 40, tileY: 4 },
  { id: 'restroom-bottom-3', name: 'South Restroom 3', type: 'restroom', tileX: 4, tileY: 32 },
  { id: 'food-bottom-4', name: 'South Food Stand 4', type: 'food', tileX: 10, tileY: 32 },
  { id: 'merch-bottom-2', name: 'South Merchandise Stand 2', type: 'merch', tileX: 16, tileY: 32 },
  { id: 'medical-bottom-2', name: 'South Medical Point 2', type: 'medical', tileX: 22, tileY: 32 },
  { id: 'food-bottom-5', name: 'South Food Stand 5', type: 'food', tileX: 28, tileY: 32 },
  { id: 'restroom-bottom-4', name: 'South Restroom 4', type: 'restroom', tileX: 34, tileY: 32 },
  { id: 'food-bottom-6', name: 'South Food Stand 6', type: 'food', tileX: 40, tileY: 32 },
  { id: 'restroom-left-5', name: 'West Restroom 5', type: 'restroom', tileX: 4, tileY: 4 },
  { id: 'food-left-7', name: 'West Food Stand 7', type: 'food', tileX: 4, tileY: 10 },
  { id: 'medical-left-3', name: 'West Medical Point 3', type: 'medical', tileX: 4, tileY: 16 },
  { id: 'merch-left-3', name: 'West Merchandise Stand 3', type: 'merch', tileX: 4, tileY: 22 },
  { id: 'food-left-8', name: 'West Food Stand 8', type: 'food', tileX: 4, tileY: 28 },
  { id: 'restroom-right-6', name: 'East Restroom 6', type: 'restroom', tileX: 46, tileY: 4 },
  { id: 'food-right-9', name: 'East Food Stand 9', type: 'food', tileX: 46, tileY: 10 },
  { id: 'merch-right-4', name: 'East Merchandise Stand 4', type: 'merch', tileX: 46, tileY: 16 },
  { id: 'medical-right-4', name: 'East Medical Point 4', type: 'medical', tileX: 46, tileY: 22 },
  { id: 'food-right-10', name: 'East Food Stand 10', type: 'food', tileX: 46, tileY: 28 },
];

// Export POIs with adjusted coordinates for exterior padding (upscaled by factor of 4)
const upscaledPois = upscalePOIs(originalPois, 4);
export const pois = adjustPOIsForPadding(upscaledPois, EXTERIOR_PADDING);

const rawSpawn = { tileX: 6, tileY: 1 };
const upscaledSpawn = { tileX: rawSpawn.tileX * 4, tileY: rawSpawn.tileY * 4 };
export const spawn = adjustCoordinatesForPadding(upscaledSpawn, EXTERIOR_PADDING);

// Only tile value 0 (Concourse / Walkway), 4 (Parking), and 7 (Road) are walkable.
// Seating (2), walls (1), field (3), grass (5), and trees (6) all block movement/pathfinding.
export function isWalkable(tileX, tileY, grid = tileGrid) {
  const tileValue = grid[tileY]?.[tileX];
  return tileValue === 0 || tileValue === 4 || tileValue === 7;
}

export function tileToWorld(tileX, tileY) {
  return {
    x: (tileX - tileY) * (ISO_TILE_WIDTH / 2),
    y: (tileX + tileY) * (ISO_TILE_HEIGHT / 2)
  };
}

// Overall footprint of the projected map, used by MainScene to size the
// camera bounds and to compute a worldOffset that keeps every projected
// coordinate positive on screen (tileToWorld can return negative x).
export function isoMapSize(grid = tileGrid, rotation = 0) {
  const isOdd = rotation % 2 !== 0;
  const rows = isOdd ? grid[0].length : grid.length;
  const cols = isOdd ? grid.length : grid[0].length;
  const minWorldX = -(rows - 1) * (ISO_TILE_WIDTH / 2); // leftmost diamond x
  const width = (cols + rows) * (ISO_TILE_WIDTH / 2);
  const height = (cols + rows) * (ISO_TILE_HEIGHT / 2) + WALL_HEIGHT;
  const originX = rows * (ISO_TILE_WIDTH / 2);
  return { width, height, originX, minWorldX, rows, cols };
}