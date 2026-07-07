# Zoom Detail System - Enhanced 2D Stadium View

## Overview

This system adds **zoom-based Level of Detail (LOD)** rendering to your stadium map, using your Godot asset packs to show individual seats, people, grass tiles, fences, and furniture when zoomed in.

## What Was Added

### 1. **Sprite Extraction System** (`src/assets/spriteExtractor.js`)
- Slices Godot tileset PNG files into individual sprite textures
- Creates detail-level variants (low/medium/high) for each sprite
- Generates detailed seat sprites with sitting characters
- Determines appropriate detail level based on camera zoom

### 2. **Godot Asset Loader** (`src/assets/loadGodotAssets.js`)
- Loads your Godot tilesets:
  - ✅ Grass tiles (Sprout Lands)
  - ✅ Fences
  - ✅ Doors
  - ✅ Basic Furniture
  - ✅ Character sprites (sitting poses)
- Provides helper functions to access specific sprites
- Pre-configured for your asset pack structure

### 3. **Zoom Detail Manager** (`src/map/zoomDetailManager.js`)
- Manages 3 detail levels based on zoom:
  - **LOW** (zoom < 0.6): Simplified colored blocks
  - **MEDIUM** (zoom 0.6-1.5): Standard isometric tiles
  - **HIGH** (zoom > 1.5): Individual seats with people, detailed textures
- Automatically shows/hides appropriate detail level
- Registers objects across multiple detail levels
- Performance-optimized (only renders visible detail level)

### 4. **Updated Boot Scene**
- Now loads Godot assets during preload
- Processes tilesets into usable sprites
- Stores assets globally for MainScene access

## How It Works

```javascript
// Zoom levels determine what you see:

Zoom < 0.6  → Stadium overview (colored blocks)
Zoom 0.6-1.5 → Normal view (current isometric tiles)  
Zoom > 1.5   → Detailed view (individual seats with people!)
```

## Assets Available

### From Your Godot Packs:

**Tilesets Loaded:**
- `grass-0-0`, `grass-0-1`, etc. - Individual grass tile variants
- `fence-0-0`, `fence-0-1`, etc. - Fence pieces (horizontal, vertical, corners)
- `door-0-0`, `door-0-1`, etc. - Door sprites
- `furniture-0-0`, `furniture-0-1`, etc. - Chairs, tables, benches, counters, stalls

**Character Sprites:**
- `char-adamSit` - Adam sitting (16x16 spritesheet)
- `char-alexSit` - Alex sitting
- `char-ameliaSit` - Amelia sitting
- `char-bobSit` - Bob sitting

**Generated Detailed Seats:**
- `seat-empty` - Empty stadium seat
- `seat-occupied-blue` - Seat with person (blue section)
- `seat-occupied-teal` - Seat with person (teal section)
- `seat-occupied-purple` - Seat with person (purple/premium section)

## Integration with MainScene

To add zoom-based detail to your main map:

```javascript
import { ZoomDetailManager, createSeatRowVariants } from '../map/zoomDetailManager.js';

// In MainScene.create()
this.detailManager = new ZoomDetailManager(this);
this.detailManager.initialize();

// Get loaded assets
const godotAssets = this.registry.get('godotAssets');

// Create seat rows with detail levels
const seatVariants = createSeatRowVariants(
  this, 
  100, 100, // x, y position
  10, // number of seats in row
  godotAssets.detailedSeats
);

// Register with detail manager
this.detailManager.registerObject('seat-row-1', seatVariants);

// In MainScene.update() or camera zoom handler
this.detailManager.updateForZoom(this.cameras.main.zoom);
```

## Example Usage: Enhanced Seat Rendering

Replace current seat tile rendering with zoom-aware detailed seats:

```javascript
// OLD: Single isometric seat tile
const seat = this.add.image(x, y, 'tile-seat-outer-0');

// NEW: Three detail levels (automatically switches based on zoom)
const seatVariants = {
  low: this.add.graphics().fillStyle(0x4aa3df).fillRect(x, y, 32, 4),
  medium: this.add.image(x, y, 'tile-seat-outer-0'), 
  high: this.add.image(x, y, 'seat-occupied-blue') // Shows individual person!
};

this.detailManager.registerObject(`seat-${x}-${y}`, seatVariants);
```

## Helper Functions

### Get Random Grass Tile
```javascript
import { getRandomGrass } from '../assets/loadGodotAssets.js';

const godotAssets = this.registry.get('godotAssets');
const grassKey = getRandomGrass(godotAssets.grass);
const grassSprite = this.add.image(x, y, grassKey);
```

### Get Fence by Direction
```javascript
import { getFenceSprite } from '../assets/loadGodotAssets.js';

const fenceKey = getFenceSprite(godotAssets.fences, 'horizontal');
const fence = this.add.image(x, y, fenceKey);
```

### Get Furniture
```javascript
import { getFurnitureSprite, FURNITURE_INDICES } from '../assets/loadGodotAssets.js';

const chairKey = getFurnitureSprite(godotAssets.furniture, FURNITURE_INDICES.CHAIR);
const chair = this.add.image(x, y, chairKey);
```

## Performance Considerations

- Only ONE detail level is rendered at a time (others are hidden)
- Switching between detail levels is instant
- High detail only activates when zoomed in close
- Memory efficient: sprites are pre-generated once during boot

## Next Steps

To fully integrate this system into your stadium map:

1. **Update MainScene** to use `ZoomDetailManager`
2. **Replace seat tile rendering** with detail-aware variants
3. **Add grass/fence decorations** using loaded Godot sprites
4. **Add furniture to concession areas** (food stalls, benches)
5. **Hook camera zoom events** to trigger detail updates

## File Structure

```
src/
├── assets/
│   ├── spriteExtractor.js       (NEW - Slices tilesets)
│   ├── loadGodotAssets.js       (NEW - Loads Godot packs)
│   └── generateAssets.js        (EXISTING - Procedural tiles)
├── map/
│   └── zoomDetailManager.js     (NEW - LOD system)
└── scenes/
    ├── BootScene.js             (UPDATED - Loads Godot assets)
    └── MainScene.js             (TO UPDATE - Integrate detail system)
```

## Configuration

Edit `ZOOM_THRESHOLDS` in `zoomDetailManager.js` to adjust when detail levels switch:

```javascript
export const ZOOM_THRESHOLDS = {
  LOW: 0.6,    // Adjust: when to show simplified view
  MEDIUM: 1.5, // Adjust: when to show detailed view
  HIGH: 1.5
};
```

## Troubleshooting

**Q: Sprites not showing?**
- Check browser console for "Sliced [name] tileset" messages
- Verify asset paths in `loadGodotAssets.js` match your folder structure

**Q: Detail level not switching?**
- Ensure `updateForZoom()` is called in MainScene update loop
- Check zoom thresholds match your camera zoom range

**Q: Performance issues at high detail?**
- Reduce number of detailed objects near edges
- Increase HIGH zoom threshold to require more zoom
- Use object culling (only render visible seats)

## What You Can Do Now

✅ **Individual seats visible when zoomed in**
✅ **Random grass variation using your Godot grass tiles**
✅ **Fences and decorative elements from your asset packs**
✅ **Furniture in concession stands (chairs, tables, counters)**
✅ **People sitting in seats (using your character sprites)**
✅ **Automatic LOD switching based on zoom**
✅ **Performance-optimized rendering**

**The system is ready!** Just integrate `ZoomDetailManager` into MainScene and start replacing tiles with detail-aware variants.
