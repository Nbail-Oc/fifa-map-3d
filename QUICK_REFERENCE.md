# Quick Reference Guide - New Features

## 🎮 User Controls

### Rotation (Touch Devices)
| Action | Gesture | Works In |
|--------|---------|----------|
| Smooth Rotation | Two fingers, rotate | 2D + 3D |
| Reset to North | Tap "⬆ Reset North" button | 2D + 3D |
| Cardinal Snap | Tap "Rotate Map" button | 3D only |

### Navigation
| Action | Method | Works In |
|--------|--------|----------|
| Pan/Drag | One finger drag | 2D + 3D |
| Zoom | Pinch or mouse wheel | 2D + 3D |
| Walk (WASD) | Keyboard | 2D + 3D |

### UI Elements
| Element | When Visible | Location |
|---------|--------------|----------|
| Compass | When rotated > 3° | Bottom-right |
| Reset North | When rotated > 3° | Top-right |
| Rotate Map | Always (3D mode) | Top-right |
| Switch 2D/3D | Always | Top-right |

---

## 🗺️ Tile Types Reference

| Type | Name | 3D Texture | 2D Texture | Walkable |
|------|------|-----------|-----------|----------|
| 0 | Concourse | `tile-floor` | `tile-floor-2d` | ✅ |
| 1 | Wall | `tile-wall-{0-3}` | `tile-wall-2d` | ❌ |
| 2 | Seating | `tile-seat-{variant}-{0-3}` | `tile-seat-2d` | ❌ |
| 3 | Field | `tile-field` | `tile-field-2d` | ❌ |
| 4 | Parking | `tile-parking` | `tile-parking-2d` | ✅ |
| 5 | Grass | `tile-grass` | `tile-grass-2d` | ❌ |
| 6 | Tree | `tile-tree` | `tile-tree-2d` | ❌ |
| 7 | Road | `tile-road` | `tile-road-2d` | ✅ |

---

## 💻 Developer Reference

### Key State Variables
```javascript
// Rotation
this.mapRotationAngle       // Smooth rotation (radians)
this.mapRotation            // Discrete rotation (0-3)
this.previousTwoFingerAngle // Gesture tracking
this.isRotating             // Gesture state flag

// Projection
this.projectionMode         // '2d' or '3d'
this.worldOffset            // Map positioning { x, y }

// Map
this.isoMapWidth            // Calculated map width
this.isoMapHeight           // Calculated map height
```

### Key Methods
```javascript
// Rotation
setupInteractions()         // Gesture handlers
updateCompass()             // Compass rotation
updateCompassVisibility()   // Show/hide logic

// Rendering
drawMap()                   // Render all tiles
drawPois()                  // Render POI markers
drawFieldMarkings()         // Field lines
tileToWorld(x, y)           // Tile → screen coords
rotateTile(x, y)            // Tile rotation (discrete)

// Projection
toggleProjectionMode()      // Switch 2D ↔ 3D
updateProjectionConfig()    // Update map dimensions
```

### Configuration Constants
```javascript
// src/map/mockStadiumMap.js
export const TILE_SIZE = 32
export const ISO_TILE_WIDTH = 64
export const ISO_TILE_HEIGHT = 32
export const WALL_HEIGHT = 26
export const SEAT_HEIGHT = 14
export const EXTERIOR_PADDING = 5

// Thresholds
ROTATION_THRESHOLD = 0.02   // radians (line ~1029)
COMPASS_THRESHOLD = 0.05    // radians (line ~1083)
RESET_DURATION = 300        // ms (line ~218)
```

---

## 🔧 Common Tasks

### Add New Exterior Tile Type
1. Update tile type comment in `mockStadiumMap.js`
2. Add generator function in `generateAssets.js`
3. Call from `makeExteriorTiles()` and `makeExteriorTiles2D()`
4. Add render case in `drawMap()` method
5. Update `isWalkable()` if needed

### Change Exterior Padding Size
```javascript
// src/map/mockStadiumMap.js
export const EXTERIOR_PADDING = 5; // Change this value
```

### Adjust Rotation Sensitivity
```javascript
// src/scenes/MainScene.js (line ~1029)
if (Math.abs(deltaAngle) > 0.02) {  // Change threshold
  this.mapRotationAngle += deltaAngle;
}
```

### Customize Compass Appearance
```javascript
// src/scenes/MainScene.js (line ~231)
compassDiv.style.width = '60px';           // Size
compassDiv.style.backgroundColor = '...';   // Color
compassDiv.innerHTML = '<div>N</div>';      // Content
```

---

## 🐛 Troubleshooting

### Rotation not working?
- ✅ Check: Using touch device or touch emulation
- ✅ Check: Two pointers detected (`input.pointer1` and `pointer2`)
- ✅ Check: Not in mobile follow mode (camera follows player)

### Compass not appearing?
- ✅ Check: `Math.abs(mapRotationAngle) > 0.05`
- ✅ Check: Element not hidden by CSS
- ✅ Check: `updateCompass()` called in `update()` loop

### Exterior tiles not showing?
- ✅ Check: Textures generated in `generateAssets()`
- ✅ Check: `tileGrid` using expanded version
- ✅ Check: Camera bounds include exterior area

### Performance issues?
- ✅ Check: Browser console for errors
- ✅ Check: Tile count (should be 60×46 = 2,760)
- ✅ Check: Memory usage (shouldn't exceed 200MB)

---

## 📦 Files Quick Reference

### Core Files
| File | Purpose | Lines | Key Content |
|------|---------|-------|-------------|
| `MainScene.js` | Main game scene | ~1300 | Rendering, rotation, controls |
| `mockStadiumMap.js` | Tile grid + POIs | ~200 | Grid data, tile types, POIs |
| `generateAssets.js` | Texture generation | ~900 | All tile textures |
| `expandedStadiumMap.js` | Grid expansion | ~60 | Padding logic |

### Documentation
| File | Purpose |
|------|---------|
| `ROTATION_FEATURE_SUMMARY.md` | 2D rotation details |
| `3D_ROTATION_FEATURE_SUMMARY.md` | 3D rotation details |
| `COMPLETE_FEATURE_SUMMARY.md` | All features overview |
| `QUICK_REFERENCE.md` | This file |

---

## 🎯 Testing Scenarios

### Smoke Test (2 minutes)
1. Load app - should show 3D stadium with exterior
2. Pinch to zoom - should zoom smoothly
3. Two-finger rotate - compass appears
4. Tap Reset North - animates to 0°
5. Switch to 2D - rotation preserved
6. Drag to exterior - parking lots visible

### Full Test (10 minutes)
- [ ] Rotation in 2D mode (smooth, threshold, compass)
- [ ] Rotation in 3D mode (smooth, button, compass)
- [ ] Panning with rotation compensation
- [ ] Pinch zoom while rotating
- [ ] POI selection when rotated
- [ ] Pathfinding on exterior tiles
- [ ] Mode switching behavior
- [ ] Reset North animation
- [ ] Discrete rotation button (3D)
- [ ] Walk on parking/roads
- [ ] Blocked by grass/trees

---

## 📞 Support Info

### Known Issues
1. **3D lighting at non-cardinal angles** - Minor cosmetic issue
2. **No desktop rotation gesture** - Touch devices only
3. **Labels rotate with map** - Same as Google Maps

### Getting Help
- Check documentation files in project root
- Review inline code comments
- Test on touch device or with touch emulation
- Check browser console for errors

---

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo>
cd FIFA_MAP
npm install

# Run development server
npm run dev

# Open browser
http://localhost:5176/

# Test rotation
# 1. Touch device: Use two fingers to rotate
# 2. Desktop: Click "Rotate Map" button (3D only)
```

---

**Version:** 1.0.0  
**Date:** July 7, 2026  
**Status:** ✅ Production Ready
