# Integration Guide - Zoom Detail System

## Quick Start (5 Minutes)

### What You Get
- ✅ **Automatic zoom-based detail switching**
- ✅ **Individual seats with people at high zoom**
- ✅ **Godot grass/fence/furniture sprites**
- ✅ **Performance optimized (only renders visible detail)**

### Integration Steps

#### 1. Update MainScene.js Imports (Top of file)

Add these imports after the existing ones:

```javascript
import { ZoomDetailManager, DETAIL_LEVELS } from '../map/zoomDetailManager.js';
import { getRandomGrass, getFenceSprite } from '../assets/loadGodotAssets.js';
```

#### 2. Initialize Detail Manager (In create() method)

Add after `this.updateProjectionConfig()`:

```javascript
// Get loaded Godot assets
this.godotAssets = this.registry.get('godotAssets') || {};

// Initialize zoom detail manager
this.detailManager = new ZoomDetailManager(this);
this.detailManager.initialize();

// Track zoom for change detection
this.previousZoom = this.cameras.main.zoom;
```

#### 3. Update Zoom Tracking (In update() method)

Add before the keyboard input handling:

```javascript
// Update detail level based on zoom (2D mode only)
if (this.projectionMode === '2d') {
  const currentZoom = this.cameras.main.zoom;
  if (Math.abs(currentZoom - this.previousZoom) > 0.05) {
    this.detailManager.updateForZoom(currentZoom);
    this.previousZoom = currentZoom;
  }
}
```

#### 4. Enhance Seat Rendering (In drawMap() method)

Replace the `else if (tile === 2)` block in the 2D mode section:

**OLD CODE:**
```javascript
} else if (tile === 2) {
  img = this.add.image(worldX, worldY, 'tile-seat-2d').setOrigin(0.5, 0.5).setDepth(1);
}
```

**NEW CODE:**
```javascript
} else if (tile === 2) {
  const detailLevel = this.detailManager?.getCurrentLevel() || DETAIL_LEVELS.MEDIUM;
  
  if (detailLevel === DETAIL_LEVELS.HIGH && this.godotAssets.detailedSeats) {
    // Show individual seat with person
    const isOccupied = Math.random() > 0.3;
    const seatIndex = isOccupied ? (1 + Math.floor(Math.random() * 3)) : 0;
    const seatKey = this.godotAssets.detailedSeats[seatIndex];
    
    if (this.textures.exists(seatKey)) {
      img = this.add.image(worldX, worldY, seatKey)
        .setOrigin(0.5, 0.5)
        .setDepth(1)
        .setScale(2);
    }
  } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
    img = this.add.image(worldX, worldY, 'tile-seat-2d').setOrigin(0.5, 0.5).setDepth(1);
  } else {
    // Low detail: simple colored block
    const g = this.add.graphics();
    g.fillStyle(0x4aa3df, 1);
    g.fillRect(-16, -16, 32, 32);
    g.setPosition(worldX, worldY);
    g.setDepth(1);
    img = g;
  }
}
```

#### 5. Cleanup (In shutdown event)

Add to the `SHUTDOWN` event handler:

```javascript
this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
  // ... existing cleanup ...
  
  if (this.detailManager) {
    this.detailManager.destroy();
  }
});
```

### That's It! 🎉

Now when you:
- **Zoom out** → Simplified colored blocks
- **Zoom normal** → Standard tiles
- **Zoom in** → Individual seats with people!

## Testing

1. Run your dev server: `npm run dev`
2. Open the app in browser
3. Switch to **2D mode** (button top-right)
4. Use **pinch zoom** or **mouse wheel** to zoom in/out
5. Watch seats transform from blocks → tiles → individual people!

## Customization

### Adjust Zoom Thresholds

Edit `src/map/zoomDetailManager.js`:

```javascript
export const ZOOM_THRESHOLDS = {
  LOW: 0.6,    // Change: when simplified view appears
  MEDIUM: 1.5, // Change: when detailed view appears
  HIGH: 1.5
};
```

### Add Grass Variety (Optional)

Replace `tile === 5` (grass) in 2D mode:

```javascript
} else if (tile === 5) {
  const detailLevel = this.detailManager?.getCurrentLevel() || DETAIL_LEVELS.MEDIUM;
  
  if (detailLevel === DETAIL_LEVELS.HIGH && this.godotAssets.grass) {
    const grassKey = getRandomGrass(this.godotAssets.grass);
    if (grassKey && this.textures.exists(grassKey)) {
      img = this.add.image(worldX, worldY, grassKey)
        .setOrigin(0.5, 0.5)
        .setDepth(0)
        .setScale(2);
    }
  } else {
    img = this.add.image(worldX, worldY, 'tile-grass-2d').setOrigin(0.5, 0.5).setDepth(0);
  }
}
```

## Troubleshooting

### Assets not loading?
Check browser console for:
```
✓ Sliced grass tileset: X sprites
✓ Sliced fences tileset: X sprites
✓ Generated X detailed seat sprites
```

If missing, verify paths in `src/assets/loadGodotAssets.js`

### Detail level not changing?
- Ensure you're in **2D mode** (3D mode uses existing isometric tiles)
- Check zoom range matches your camera settings
- Add console.log in update() to see current zoom value

### Seats not showing people?
- Verify `godotAssets.detailedSeats` is populated
- Check `this.textures.exists(seatKey)` returns true
- Try reducing `.setScale(2)` to `.setScale(1)` if too large

## Performance Tips

- Detail system only renders ONE level at a time (others hidden)
- No performance impact until you actually zoom
- High detail only activates when zoomed in close
- Consider adding object culling for very large stadiums

## Next Steps

Once integrated:

1. **Add furniture** to food/merch areas (see `MainSceneEnhanced.js`)
2. **Add fences** around seating sections
3. **Customize seat occupancy** (currently 70% random)
4. **Add visual indicator** showing current detail level
5. **Extend to 3D mode** (optional - more complex)

## Files Reference

```
New Files:
- src/assets/spriteExtractor.js      (Sprite slicing logic)
- src/assets/loadGodotAssets.js      (Asset loader)
- src/map/zoomDetailManager.js       (LOD system)
- src/scenes/MainSceneEnhanced.js    (Example code)

Modified Files:
- src/scenes/BootScene.js            (Now loads Godot assets)
- src/scenes/MainScene.js            (Add zoom detail logic)
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify asset paths are correct
3. Ensure imports are at top of files
4. Test in 2D mode first (3D needs additional work)

**Ready to see individual seats!** 🪑👤
