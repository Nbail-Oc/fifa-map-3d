import Phaser from 'phaser';
import Player from '../entities/Player.js';
import DestinationPanel from '../ui/DestinationPanel.js';
import { makeCalibration, transformLocation } from '../map/calibration.js';
import { buildGraphFromGrid, getNode } from '../map/graph.js';
import { findPath } from '../map/pathfinding.js';
import {
  ISO_TILE_HEIGHT,
  ISO_TILE_WIDTH,
  WALL_HEIGHT,
  SEAT_HEIGHT,
  TILE_SIZE,
  pois,
  spawn,
  tileGrid,
  tileToWorld,
  isoMapSize,
  isWalkable
} from '../map/mockStadiumMap.js';
import { ZoomDetailManager, DETAIL_LEVELS } from '../map/zoomDetailManager.js';
import { getRandomGrass, getFenceSprite, getFurnitureSprite, FURNITURE_INDICES } from '../assets/loadGodotAssets.js';

const CALIBRATION_KEY = 'stadium-navigator-calibration';
const SMOOTHING_ALPHA = 0.35;

// Depth tiers. Tiles/POIs/the player are depth-sorted by (tileX + tileY),
// which is the standard isometric "painter's algorithm" key - it grows from
// back-left to front-right exactly the way things should visually overlap.
// Overlay elements (route line, heading arrow, top status text) always sit
// above the map, so they get a fixed depth well above the largest possible
// tile-sum.
const { rows, cols } = isoMapSize(tileGrid);
const MAX_TILE_SUM = rows + cols;
const OVERLAY_DEPTH = MAX_TILE_SUM + 100;
const FIELD_MARKINGS_DEPTH = MAX_TILE_SUM + 20;

const poiColors = {
  gate: 0x4aa3df,
  seat: 0x7d6be8,
  food: 0xe08b3e,
  restroom: 0x3fbf7f,
  medical: 0xe05252,
  merch: 0xd0a94a
};

// Seat texture variant is chosen per-tile from distance-to-bowl-center,
// giving the blue (outer) -> teal (mid) -> purple (inner/premium) gradient
// look from the reference image without needing new per-tile map data.
function seatVariantKey(tileX, tileY, grid) {
  const centerX = grid[0].length / 2;
  const centerY = grid.length / 2;
  const maxDist = Math.hypot(centerX, centerY);
  const dist = Math.hypot(tileX - centerX, tileY - centerY);
  const norm = dist / maxDist;

  if (norm > 0.62) return 'tile-seat-outer';
  if (norm > 0.4) return 'tile-seat-mid';
  return 'tile-seat-inner';
}

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  create() {
    this.graph = buildGraphFromGrid(tileGrid);
    this.mode = 'staff';
    this.allowFanFallback = false;
    this.geoWatchId = null;
    this.lastGpsPosition = null;
    this.gpsUpdateCount = 0;
    this.headingDegrees = null;
    this.headingListener = null;
    this.smoothedTile = null;
    this.calibrationRefs = this.loadCalibrationRefs();
    this.activeDestination = null;
    this.activePath = null;
    this.pathGraphics = this.add.graphics().setDepth(OVERLAY_DEPTH);
    this.headingGraphics = this.add.graphics().setDepth(OVERLAY_DEPTH + 1);
    
    this.mapRotation = 0;
    this.projectionMode = '3d';
    this.mapRotationAngle = 0; // Continuous rotation angle for smooth rotation (radians)
    this.previousTwoFingerAngle = null; // Track two-finger gesture angle
    this.isRotating = false; // Flag to distinguish rotation from other gestures
    this.updateProjectionConfig();

    // Initialize zoom detail system with Godot assets
    this.godotAssets = this.registry.get('godotAssets') || {};
    this.detailManager = new ZoomDetailManager(this);
    this.detailManager.initialize();
    this.previousZoom = this.cameras.main.zoom;

    // Viewport culling camera state tracking
    this.lastCameraScrollX = 0;
    this.lastCameraScrollY = 0;
    this.lastCameraZoom = 0;
    this.decorativeDetails = [];

    // Group seat tiles into sections, rows, and seats, and select exactly 200 seats in proper rows
    this.initializeSeatsStructure();
    
    // Detail level indicator
    this.detailLevelText = this.add.text(10, 35, '', {
      fontFamily: 'Inter, Arial',
      fontSize: '11px',
      color: '#a0d0ff',
      backgroundColor: 'rgba(24,32,42,0.65)',
      padding: { x: 6, y: 3 }
    }).setDepth(OVERLAY_DEPTH + 10).setScrollFactor(0).setVisible(false);

    this.drawMap();
    this.drawFieldMarkings();
    this.drawPois();

    // Define player animations
    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('player-idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player-walk', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    });

    this.player = new Player(this, spawn.tileX, spawn.tileY);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.status = this.add.text(10, 10, 'Pick a destination or walk with WASD / arrow keys.', {
      fontFamily: 'Inter, Arial',
      fontSize: '14px',
      color: '#f7f2e8',
      backgroundColor: 'rgba(24,32,42,0.75)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 360 }
    }).setDepth(OVERLAY_DEPTH + 10).setScrollFactor(0);

    this.mySeatPoi = null;
    this.mySeatInfo = null;
    this.loadStoredSeat();

    this.panel = new DestinationPanel(pois, {
      onSelect: (poi) => this.routeToPoi(poi),
      onPoiSelect: (poi) => this.selectPoi(poi),
      onRecenter: () => this.recenterOnPlayer(),
      onSetMySeat: (seatInfo) => this.setMySeat(seatInfo),
      onGoToMySeat: () => this.goToMySeat(),
      onReset: () => this.resetNavigator(),
      onModeChange: (mode) => this.setMode(mode),
      onFallbackChange: (enabled) => {
        this.allowFanFallback = enabled;
      },
      onCalibrate: (poiId) => this.addCalibrationPoint(poiId),
      onClearCalibration: () => this.clearCalibration(),
      onEnableHeading: () => this.startHeading()
    });
    this.panel.setMode(this.mode);
    this.updateCalibrationStatus();
    this.layoutGameView();
    this.scale.on('resize', () => this.layoutGameView());

    // ponytail: support multi-touch for pinch zoom & setup drag/zoom interaction
    this.input.addPointer(2);
    this.setupInteractions();

    // Create a toggle button for 2D/3D view
    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = 'Switch to 2D';
    toggleBtn.id = 'projection-toggle-btn';
    toggleBtn.style.position = 'fixed';
    toggleBtn.style.top = '10px';
    toggleBtn.style.right = '10px';
    toggleBtn.style.zIndex = '1000';
    toggleBtn.style.backgroundColor = '#1e293b';
    toggleBtn.style.color = '#f8fafc';
    toggleBtn.style.border = '1px solid #475569';
    toggleBtn.style.padding = '8px 12px';
    toggleBtn.style.borderRadius = '6px';
    toggleBtn.style.fontFamily = 'Inter, Arial, sans-serif';
    toggleBtn.style.fontSize = '13px';
    toggleBtn.style.fontWeight = '600';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
    toggleBtn.addEventListener('click', () => this.toggleProjectionMode());
    document.body.appendChild(toggleBtn);
    this.toggleBtnEl = toggleBtn;

    // Create a rotate map button (only visible/enabled in 3D projection mode)
    const rotateBtn = document.createElement('button');
    rotateBtn.innerText = 'Rotate Map';
    rotateBtn.id = 'map-rotate-btn';
    rotateBtn.style.position = 'fixed';
    rotateBtn.style.top = '10px';
    rotateBtn.style.right = '125px';
    rotateBtn.style.zIndex = '1000';
    rotateBtn.style.backgroundColor = '#1e293b';
    rotateBtn.style.color = '#f8fafc';
    rotateBtn.style.border = '1px solid #475569';
    rotateBtn.style.padding = '8px 12px';
    rotateBtn.style.borderRadius = '6px';
    rotateBtn.style.fontFamily = 'Inter, Arial, sans-serif';
    rotateBtn.style.fontSize = '13px';
    rotateBtn.style.fontWeight = '600';
    rotateBtn.style.cursor = 'pointer';
    rotateBtn.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
    rotateBtn.addEventListener('click', () => {
      if (this.projectionMode !== '3d') return;
      
      // Reset smooth rotation first
      this.mapRotationAngle = 0;
      this.cameras.main.setRotation(0);
      
      // Then apply discrete 90° rotation
      this.mapRotation = (this.mapRotation + 1) % 4;
      this.updateProjectionConfig();
      this.drawMap();
      this.drawFieldMarkings();
      this.drawPois();
      this.player.reset(this.player.tileX, this.player.tileY);
      if (this.activePath) this.drawRoute(this.activePath);
      this.layoutGameView();
    });
    document.body.appendChild(rotateBtn);
    this.rotateBtnEl = rotateBtn;

    // Create a "Reset North" button for rotation (visible when rotated)
    const resetNorthBtn = document.createElement('button');
    resetNorthBtn.innerText = '⬆ Reset North';
    resetNorthBtn.id = 'reset-north-btn';
    resetNorthBtn.style.position = 'fixed';
    resetNorthBtn.style.top = '50px';
    resetNorthBtn.style.right = '10px';
    resetNorthBtn.style.zIndex = '1000';
    resetNorthBtn.style.backgroundColor = '#1e293b';
    resetNorthBtn.style.color = '#f8fafc';
    resetNorthBtn.style.border = '1px solid #475569';
    resetNorthBtn.style.padding = '8px 12px';
    resetNorthBtn.style.borderRadius = '6px';
    resetNorthBtn.style.fontFamily = 'Inter, Arial, sans-serif';
    resetNorthBtn.style.fontSize = '13px';
    resetNorthBtn.style.fontWeight = '600';
    resetNorthBtn.style.cursor = 'pointer';
    resetNorthBtn.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
    resetNorthBtn.style.display = 'none'; // Hidden by default, shown when rotated
    resetNorthBtn.addEventListener('click', () => {
      // Smooth transition back to 0 rotation
      this.tweens.add({
        targets: this,
        mapRotationAngle: 0,
        duration: 300,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          this.cameras.main.setRotation(this.mapRotationAngle);
        }
      });
    });
    document.body.appendChild(resetNorthBtn);
    this.resetNorthBtnEl = resetNorthBtn;

    // Create compass indicator (visible when rotated in any mode)
    const compassDiv = document.createElement('div');
    compassDiv.id = 'compass-indicator';
    compassDiv.style.position = 'fixed';
    compassDiv.style.bottom = '20px';
    compassDiv.style.right = '20px';
    compassDiv.style.zIndex = '1000';
    compassDiv.style.width = '60px';
    compassDiv.style.height = '60px';
    compassDiv.style.backgroundColor = 'rgba(30, 41, 59, 0.9)';
    compassDiv.style.border = '2px solid #475569';
    compassDiv.style.borderRadius = '50%';
    compassDiv.style.display = 'none'; // Hidden by default
    compassDiv.style.alignItems = 'center';
    compassDiv.style.justifyContent = 'center';
    compassDiv.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.3)';
    compassDiv.innerHTML = '<div style="font-size: 24px; font-weight: bold; color: #ef4444;">N</div>';
    document.body.appendChild(compassDiv);
    this.compassEl = compassDiv;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopGeolocation();
      this.stopHeading();
      this.panel.destroy();
      this.clearRenderedTiles();
      if (this.toggleBtnEl) {
        this.toggleBtnEl.remove();
      }
      if (this.rotateBtnEl) {
        this.rotateBtnEl.remove();
      }
      if (this.resetNorthBtnEl) {
        this.resetNorthBtnEl.remove();
      }
      if (this.compassEl) {
        this.compassEl.remove();
      }
      if (this.detailManager) {
        this.detailManager.destroy();
        this.detailManager = null;
      }
    });
  }

  layoutGameView() {
    const width = this.scale.width;
    const height = this.scale.height;
    const isMobile = width < 761;
    const panelHeight = this.panel?.el.getBoundingClientRect().height ?? 0;
    const gameHeight = isMobile ? Math.max(280, height - panelHeight - 18) : height;
    const pad = isMobile ? 10 : 32;
    const statusGap = isMobile ? 44 : 14;
    const containZoom = Math.min((width - pad * 2) / this.isoMapWidth, (gameHeight - statusGap - pad) / this.isoMapHeight);
    const coverZoom = Math.max((width - pad * 2) / this.isoMapWidth, (gameHeight - statusGap - pad) / this.isoMapHeight);
    this.minZoom = Math.max(0.3, containZoom); // never let viewport exceed map bounds
    const zoom = isMobile ? Math.min(coverZoom, 1.05) : Math.min(containZoom, 1.15);

    this.cameras.main.setViewport(0, 0, width, gameHeight);
    this.cameras.main.setZoom(Math.max(this.minZoom, zoom));
    this.cameras.main.setBounds(
      this.mapLeft,
      this.mapTop - statusGap / Math.max(this.minZoom, zoom),
      this.isoMapWidth,
      this.isoMapHeight + statusGap / Math.max(this.minZoom, zoom)
    );
    if (isMobile) {
      this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 56);
    } else {
      this.cameras.main.stopFollow();
      this.cameras.main.centerOn(
        this.mapLeft + this.isoMapWidth / 2,
        this.mapTop + this.isoMapHeight / 2 + statusGap / Math.max(this.minZoom, zoom)
      );
    }
    this.status.setWordWrapWidth(width - 20);
    this.updateLayers(this.cameras.main.zoom);
  }

  update() {
    this.updatePlayerDepth();
    this.drawHeadingIndicator();
    this.updateCompass(); // Update compass rotation indicator

    // Update detail level based on zoom (2D mode)
    if (this.projectionMode === '2d' && this.detailManager) {
      const currentZoom = this.cameras.main.zoom;
      if (Math.abs(currentZoom - this.previousZoom) > 0.05) {
        const changed = this.detailManager.updateForZoom(currentZoom);
        if (changed) {
          this.updateDetailLevelIndicator();
          // Redraw map with new detail level
          this.drawMap();
          this.drawPois();
        }
        this.previousZoom = currentZoom;
      }
    }

    // Viewport culling update when camera moves or zooms
    const cam = this.cameras.main;
    if (Math.abs(cam.scrollX - this.lastCameraScrollX) > 2 ||
        Math.abs(cam.scrollY - this.lastCameraScrollY) > 2 ||
        Math.abs(cam.zoom - this.lastCameraZoom) > 0.01) {
      this.updateViewportCulling();
      this.lastCameraScrollX = cam.scrollX;
      this.lastCameraScrollY = cam.scrollY;
      this.lastCameraZoom = cam.zoom;
    }

    if (this.player.isMoving || this.player.isAutoWalking) return;
    if (this.mode === 'fan' && !this.allowFanFallback) return;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keys.A)) {
      this.player.tryMove(-1, 0, () => this.clearRoute());
      this.resumeFollowIfMobile();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keys.D)) {
      this.player.tryMove(1, 0, () => this.clearRoute());
      this.resumeFollowIfMobile();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W)) {
      this.player.tryMove(0, -1, () => this.clearRoute());
      this.resumeFollowIfMobile();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keys.S)) {
      this.player.tryMove(0, 1, () => this.clearRoute());
      this.resumeFollowIfMobile();
    }
  }

  drawMap() {
    this.clearRenderedTiles();
    this.updateViewportCulling(true);
  }

  clearRenderedTiles() {
    if (this.decorativeDetails) {
      this.decorativeDetails.forEach(d => d.destroy());
      this.decorativeDetails = [];
    }

    if (this.renderedTilesMap) {
      for (const [key, obj] of this.renderedTilesMap.entries()) {
        if (obj) obj.destroy();
      }
      this.renderedTilesMap.clear();
    } else {
      this.renderedTilesMap = new Map();
    }

    if (this.mapTilesGroup) {
      this.mapTilesGroup.clear(true, true);
    } else {
      this.mapTilesGroup = this.add.group();
    }
  }

  updateViewportCulling(force = false) {
    if (!this.renderedTilesMap) {
      this.renderedTilesMap = new Map();
    }

    const cam = this.cameras.main;
    const bounds = cam.worldView;
    const pad = 64; // safety padding in px to prevent pop-in at borders

    const detailLevel = this.detailManager?.getCurrentLevel() || DETAIL_LEVELS.MEDIUM;

    // Loop over all tiles in the grid
    tileGrid.forEach((row, y) => {
      row.forEach((tile, x) => {
        const world = this.tileToWorld(x, y);
        const worldX = this.worldOffset.x + world.x;
        const worldY = this.worldOffset.y + world.y;

        // Determine if tile is inside padded viewport
        const isVisible = (worldX >= bounds.x - pad &&
                           worldX <= bounds.right + pad &&
                           worldY >= bounds.y - pad &&
                           worldY <= bounds.bottom + pad);

        const key = `${x},${y}`;
        const isRendered = this.renderedTilesMap.has(key);

        if (isVisible) {
          if (!isRendered || force) {
            // If already rendered, destroy the old one first
            if (isRendered) {
              const oldObj = this.renderedTilesMap.get(key);
              if (oldObj) oldObj.destroy();
            }

            const img = this.drawTile(x, y, tile, worldX, worldY, detailLevel);
            if (img) {
              this.renderedTilesMap.set(key, img);
              this.mapTilesGroup.add(img);
            }
          }
        } else {
          if (isRendered) {
            const img = this.renderedTilesMap.get(key);
            if (img) img.destroy();
            this.renderedTilesMap.delete(key);
          }
        }
      });
    });

    // Add decorative details at high zoom (2D mode only)
    if (this.projectionMode === '2d' && detailLevel === DETAIL_LEVELS.HIGH) {
      this.addDecorativeDetails();
    }
  }

  drawTile(x, y, tile, worldX, worldY, detailLevel) {
    const r = this.projectionMode === '3d' ? this.rotateTile(x, y) : { x, y };
    const depth = r.x + r.y;

    if (this.projectionMode === '3d') {
      if (tile === 0) {
        return this.add.image(worldX, worldY, 'tile-floor').setOrigin(0.5, 0.5).setDepth(depth);
      } else if (tile === 3) {
        return this.add.image(worldX, worldY, 'tile-field').setOrigin(0.5, 0.5).setDepth(depth);
      } else if (tile === 2) {
        if (this.activeSeatsSet.has(`${x},${y}`)) {
          const key = seatVariantKey(x, y, tileGrid);
          return this.add.image(worldX, worldY + ISO_TILE_HEIGHT / 2, `${key}-${this.mapRotation || 0}`)
            .setOrigin(0.5, 1)
            .setDepth(depth);
        } else {
          return this.add.image(worldX, worldY, 'tile-floor').setOrigin(0.5, 0.5).setDepth(depth);
        }
      } else if (tile === 1) {
        return this.add.image(worldX, worldY + ISO_TILE_HEIGHT / 2, `tile-wall-${this.mapRotation || 0}`)
          .setOrigin(0.5, 1)
          .setDepth(depth);
      } else if (tile === 4) {
        return this.add.image(worldX, worldY, 'tile-parking').setOrigin(0.5, 0.5).setDepth(depth);
      } else if (tile === 5) {
        return this.add.image(worldX, worldY, 'tile-grass').setOrigin(0.5, 0.5).setDepth(depth);
      } else if (tile === 6) {
        return this.add.image(worldX, worldY, 'tile-tree').setOrigin(0.5, 0.5).setDepth(depth);
      } else if (tile === 7) {
        return this.add.image(worldX, worldY, 'tile-road').setOrigin(0.5, 0.5).setDepth(depth);
      }
    } else {
      // 2D flat mode with enhanced detail levels
      if (tile === 0) {
        // Check if there is a POI at this concourse tile
        const poi = pois.find(p => p.tileX === x && p.tileY === y);
        if (poi) {
          if (poi.type === 'food') return this.drawFoodStand(worldX, worldY, detailLevel);
          if (poi.type === 'medical') return this.drawMedicalStand(worldX, worldY, detailLevel);
          if (poi.type === 'restroom') return this.drawRestroomStand(worldX, worldY, detailLevel);
          if (poi.type === 'gate') return this.drawGateStand(worldX, worldY, detailLevel);
          if (poi.type === 'merch') return this.drawMerchStand(worldX, worldY, detailLevel);
        }
        return this.add.image(worldX, worldY, 'tile-floor-2d').setOrigin(0.5, 0.5).setDepth(0);
      } else if (tile === 3) {
        return this.add.image(worldX, worldY, 'tile-field-2d').setOrigin(0.5, 0.5).setDepth(0);
      } else if (tile === 2) {
        // ENHANCED SEATS with detail levels
        return this.drawEnhancedSeat(worldX, worldY, x, y, detailLevel);
      } else if (tile === 1) {
        return this.add.image(worldX, worldY, 'tile-wall-2d').setOrigin(0.5, 0.5).setDepth(2);
      } else if (tile === 4) {
        return this.add.image(worldX, worldY, 'tile-parking-2d').setOrigin(0.5, 0.5).setDepth(0);
      } else if (tile === 5) {
        // ENHANCED GRASS with variety
        return this.drawEnhancedGrass(worldX, worldY, x, y, detailLevel);
      } else if (tile === 6) {
        // ENHANCED TREE with variety
        return this.drawEnhancedTree(worldX, worldY, x, y, detailLevel);
      } else if (tile === 7) {
        // ENHANCED ROAD with variety
        return this.drawEnhancedRoad(worldX, worldY, x, y, detailLevel);
      }
    }
    return null;
  }

  drawPois() {
    const iconKeys = {
      gate: 'icon-gate',
      seat: 'icon-seat',
      food: 'icon-food',
      restroom: 'icon-restroom',
      medical: 'icon-medical',
      merch: 'icon-merch'
    };

    if (this.poiObjects) {
      this.poiObjects.forEach((obj) => {
        obj.outerBg.destroy();
        obj.bg.destroy();
        obj.icon.destroy();
        obj.nameLabel.destroy();
        if (obj.mySeatRing) obj.mySeatRing.destroy();
      });
    }
    this.poiObjects = [];

    pois.forEach((poi) => {
      const world = this.tileToWorld(poi.tileX, poi.tileY);
      const x = this.worldOffset.x + world.x;
      const y = this.worldOffset.y + world.y;
      const r = this.projectionMode === '3d' ? this.rotateTile(poi.tileX, poi.tileY) : { x: poi.tileX, y: poi.tileY };
      const baseDepth = this.projectionMode === '3d' ? (r.x + r.y) : 10;

      const detailLevel = this.detailManager?.getCurrentLevel() || DETAIL_LEVELS.MEDIUM;
      const isHighOrMed = this.projectionMode === '2d' && (detailLevel === DETAIL_LEVELS.HIGH || detailLevel === DETAIL_LEVELS.MEDIUM);

      const outerBg = this.add.circle(x, y, 15, 0xffffff, 0.18).setDepth(baseDepth + 0.1);
      const bg = this.add.circle(x, y, 12, poiColors[poi.type], 1).setDepth(baseDepth + 0.2);

      const icon = this.add.image(x, y - 1, iconKeys[poi.type] ?? 'icon-gate')
        .setOrigin(0.5)
        .setDisplaySize(18, 18)
        .setDepth(baseDepth + 0.3);

      if (isHighOrMed) {
        outerBg.setVisible(false);
        icon.setVisible(false);
        bg.setAlpha(0); // Invisible but remains interactive
        if (poi.type === 'gate') {
          bg.setRadius(64); // covers 4 tiles wide for the gate entrance
        } else {
          bg.setRadius(16); // Larger hit area over the entire tile
        }
      }

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', (pointer, localX, localY, event) => {
        if (event) event.stopPropagation();
        this.selectPoi(poi);
      });

      let mySeatRing = null;
      let labelText = poi.name;
      if (this.mySeatPoi && this.mySeatPoi.id === poi.id) {
        mySeatRing = this.add.circle(x, y, 20, 0xfacc15, 0.3)
          .setStrokeStyle(2.5, 0xfacc15, 0.8)
          .setDepth(baseDepth + 0.05);

        this.tweens.add({
          targets: mySeatRing,
          alpha: 0.1,
          scale: 1.25,
          duration: 1000,
          yoyo: true,
          repeat: -1
        });

        if (this.mySeatInfo) {
          labelText = `⭐ My Seat\nSec ${this.mySeatInfo.section} Row ${this.mySeatInfo.row}\nSeat ${this.mySeatInfo.seat}`;
        }
      }

      const nameLabel = this.add.text(x, y + 18, labelText, {
        fontFamily: 'Inter, Arial',
        fontSize: '10px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: this.mySeatPoi && this.mySeatPoi.id === poi.id ? 'rgba(180, 83, 9, 0.95)' : 'rgba(15, 23, 42, 0.85)',
        padding: { x: 5, y: 3 }
      }).setOrigin(0.5, 0).setDepth(baseDepth + 0.4);

      this.poiObjects.push({
        poi,
        outerBg,
        bg,
        icon,
        nameLabel,
        mySeatRing
      });
    });

    // Draw exact seat pin-point marker if set
    if (this.mySeatTile) {
      const world = this.tileToWorld(this.mySeatTile.tileX, this.mySeatTile.tileY);
      const sx = this.worldOffset.x + world.x;
      const sy = this.worldOffset.y + world.y;
      
      const baseDepth = this.projectionMode === '3d' ? (this.mySeatTile.tileX + this.mySeatTile.tileY) : 10;
      
      const seatMarker = this.add.star(sx, sy, 5, 4, 10, 0xfacc15, 1)
        .setStrokeStyle(1.5, 0xffffff, 1)
        .setDepth(baseDepth + 2);
      
      this.tweens.add({
        targets: seatMarker,
        scale: 1.3,
        angle: 180,
        duration: 1200,
        yoyo: true,
        repeat: -1
      });
      
      this.poiObjects.push({
        outerBg: seatMarker,
        bg: { destroy() {} },
        icon: { destroy() {} },
        nameLabel: { destroy() {} }
      });
    }

    this.updateLayers(this.cameras.main.zoom);
  }

  drawFieldMarkings() {
    if (this.fieldMarkingsGraphics) {
      this.fieldMarkingsGraphics.clear();
    } else {
      this.fieldMarkingsGraphics = this.add.graphics().setDepth(FIELD_MARKINGS_DEPTH);
    }

    const fieldTiles = [];
    tileGrid.forEach((row, y) => row.forEach((tile, x) => {
      if (tile === 3) {
        const r = this.projectionMode === '3d' ? this.rotateTile(x, y) : { x, y };
        fieldTiles.push(r);
      }
    }));
    if (fieldTiles.length === 0) return;

    const minX = Math.min(...fieldTiles.map((t) => t.x));
    const maxX = Math.max(...fieldTiles.map((t) => t.x));
    const minY = Math.min(...fieldTiles.map((t) => t.y));
    const maxY = Math.max(...fieldTiles.map((t) => t.y));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const halfW = (maxX - minX) / 2;
    const halfH = (maxY - minY) / 2;

    const g = this.fieldMarkingsGraphics;
    g.lineStyle(2, 0xffffff, 0.55);

    if (this.projectionMode === '3d') {
      const toScreen = (rx, ry) => {
        return {
          x: this.worldOffset.x + (rx - ry) * (ISO_TILE_WIDTH / 2),
          y: this.worldOffset.y + (rx + ry) * (ISO_TILE_HEIGHT / 2)
        };
      };
      const strokeLoop = (g, tilePoints, closed) => {
        const screenPoints = tilePoints.map(([tx, ty]) => toScreen(tx, ty));
        g.beginPath();
        g.moveTo(screenPoints[0].x, screenPoints[0].y);
        screenPoints.slice(1).forEach((p) => g.lineTo(p.x, p.y));
        if (closed) g.closePath();
        g.strokePath();
      };

      strokeLoop(g, [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]], true);
      strokeLoop(g, [[cx, minY], [cx, maxY]], false);

      const radius = Math.min(halfW, halfH) * 0.35;
      const circlePoints = [];
      for (let i = 0; i <= 32; i += 1) {
        const angle = (i / 32) * Math.PI * 2;
        circlePoints.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
      }
      strokeLoop(g, circlePoints, true);

      const center = toScreen(cx, cy);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(center.x, center.y, 2.5);

      const boxHalfW = halfW * 0.55;
      const boxDepthTiles = Math.max(2, halfH * 0.35);
      strokeLoop(g, [
        [cx - boxHalfW, minY], [cx + boxHalfW, minY],
        [cx + boxHalfW, minY + boxDepthTiles], [cx - boxHalfW, minY + boxDepthTiles]
      ], true);
      strokeLoop(g, [
        [cx - boxHalfW, maxY], [cx + boxHalfW, maxY],
        [cx + boxHalfW, maxY - boxDepthTiles], [cx - boxHalfW, maxY - boxDepthTiles]
      ], true);
    } else {
      // 2D flat view markings
      const toScreen = (tx, ty) => {
        const w = this.tileToWorld(tx, ty);
        return { x: this.worldOffset.x + w.x, y: this.worldOffset.y + w.y };
      };
      const pMin = toScreen(minX - 0.5, minY - 0.5);
      const pMax = toScreen(maxX + 0.5, maxY + 0.5);
      const pCenter = toScreen(cx, cy);

      g.strokeRect(pMin.x, pMin.y, pMax.x - pMin.x, pMax.y - pMin.y);
      g.lineBetween(pCenter.x, pMin.y, pCenter.x, pMax.y);

      const radiusX = (maxX - minX) * TILE_SIZE * 0.35 / 2;
      g.strokeCircle(pCenter.x, pCenter.y, radiusX);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(pCenter.x, pCenter.y, 2.5);

      const boxW = (maxX - minX) * TILE_SIZE * 0.55;
      const boxH = Math.max(2, halfH * 0.35) * TILE_SIZE;
      g.strokeRect(pCenter.x - boxW / 2, pMin.y, boxW, boxH);
      g.strokeRect(pCenter.x - boxW / 2, pMax.y - boxH, boxW, boxH);
    }
  }

  routeToPoi(poi) {
    const start = getNode(this.graph, this.player.tileX, this.player.tileY);
    let targetX = poi.tileX;
    let targetY = poi.tileY;

    const isClickedSeat = poi.id.startsWith('seat-');
    if (isClickedSeat || (this.mySeatPoi && this.mySeatPoi.id === poi.id && this.mySeatTile)) {
      const seatX = isClickedSeat ? poi.tileX : this.mySeatTile.tileX;
      const seatY = isClickedSeat ? poi.tileY : this.mySeatTile.tileY;
      const closestWalkable = this.findClosestWalkableTile(seatX, seatY);
      if (closestWalkable) {
        targetX = closestWalkable.x;
        targetY = closestWalkable.y;
      }
    }

    const end = getNode(this.graph, targetX, targetY);
    const path = findPath(this.graph, start, end);

    if (!path) {
      this.status.setText(`No route to ${poi.name}.`);
      return;
    }

    this.panel.setActive(poi.id);
    this.drawRoute(path);
    this.resumeFollowIfMobile();
    this.activeDestination = poi;
    this.activePath = path;
    this.status.setText(`Head toward ${poi.name}.`);

    if (this.mode === 'fan') return;

    this.panel.setBusy(true);
    this.player.autoWalk(
      path,
      (node, index) => this.updateDirections(path, node, index, poi),
      () => {
        this.status.setText(`Arrived at ${poi.name}. Pick another destination when ready.`);
        this.panel.setBusy(false);
      }
    );
  }

  setMode(mode) {
    this.mode = mode;
    this.panel.setMode(mode);
    this.panel.setBusy(false);
    this.clearRoute();
    requestAnimationFrame(() => this.layoutGameView());

    if (mode === 'fan') {
      this.startGeolocation();
      this.status.setText('Fan Mode uses real browser location. Calibrate two points, then pick a destination.');
    } else {
      this.stopGeolocation();
      this.stopHeading();
      this.headingGraphics.clear();
      this.panel.setGpsStatus('GPS inactive');
      this.panel.setHeadingStatus('Compass inactive');
      this.status.setText('Staff/Dev Mode: pick a destination or walk with WASD / arrow keys.');
    }
  }

  startGeolocation() {
    if (!navigator.geolocation) {
      this.panel.setGpsStatus('Geolocation not supported', true);
      return;
    }
    if (this.geoWatchId !== null) return;

    this.geoWatchId = navigator.geolocation.watchPosition(
      (position) => this.handleGpsPosition(position),
      (error) => this.panel.setGpsStatus(`GPS unavailable: ${error.message}`, true),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }

  stopGeolocation() {
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }

  async startHeading() {
    if (!window.DeviceOrientationEvent) {
      this.panel.setHeadingStatus('Compass not supported on this phone', true);
      return;
    }

    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          this.panel.setHeadingStatus('Compass permission denied', true);
          return;
        }
      }
    } catch (error) {
      this.panel.setHeadingStatus(`Compass unavailable: ${error.message}`, true);
      return;
    }

    this.stopHeading();
    this.headingListener = (event) => this.handleHeading(event);
    window.addEventListener('deviceorientationabsolute', this.headingListener, true);
    window.addEventListener('deviceorientation', this.headingListener, true);
    this.panel.setHeadingStatus('Compass active - rotate your phone');
  }

  stopHeading() {
    if (!this.headingListener) return;
    window.removeEventListener('deviceorientationabsolute', this.headingListener, true);
    window.removeEventListener('deviceorientation', this.headingListener, true);
    this.headingListener = null;
  }

  handleHeading(event) {
    const webkitHeading = event.webkitCompassHeading;
    const alphaHeading = typeof event.alpha === 'number' ? 360 - event.alpha : null;
    const heading = typeof webkitHeading === 'number' ? webkitHeading : alphaHeading;
    if (heading === null) return;

    this.headingDegrees = this.normalizeDegrees(heading);
    const cardinal = this.cardinalDirection(this.headingDegrees);
    const needsCalibration = this.calibrationRefs.length < 2;
    this.panel.setHeadingStatus(
      needsCalibration
        ? `Facing ${cardinal} (${Math.round(this.headingDegrees)} deg). Calibrate 2 points for map direction.`
        : `Facing ${cardinal} on map (${Math.round(this.headingDegrees)} deg)`
    );
  }

  handleGpsPosition(position) {
    this.gpsUpdateCount += 1;
    this.lastGpsPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    const weak = position.coords.accuracy > 20;
    const calibrationText = this.calibrationRefs.length < 2
      ? ` - GPS OK, calibrate ${this.calibrationRefs.length}/2 before marker moves`
      : '';
    this.panel.setGpsStatus(
      `GPS ${this.gpsUpdateCount} | ${Math.round(position.coords.accuracy)}m${weak ? ' weak' : ''}${calibrationText}`,
      weak || this.calibrationRefs.length < 2
    );

    if (this.calibrationRefs.length < 2) {
      // GPS is working but calibration not complete - status already updated above
      return;
    }

    let rawTile;
    try {
      rawTile = transformLocation(makeCalibration(this.calibrationRefs), this.lastGpsPosition);
    } catch (error) {
      this.panel.setGpsStatus(error.message, true);
      return;
    }

    const maxX = tileGrid[0].length - 1;
    const maxY = tileGrid.length - 1;
    const clamped = {
      tileX: Math.max(0, Math.min(maxX, rawTile.tileX)),
      tileY: Math.max(0, Math.min(maxY, rawTile.tileY))
    };

    // Basic exponential smoothing only; indoor accuracy is still limited by GPS itself.
    this.smoothedTile = this.smoothedTile
      ? {
        tileX: this.smoothedTile.tileX + SMOOTHING_ALPHA * (clamped.tileX - this.smoothedTile.tileX),
        tileY: this.smoothedTile.tileY + SMOOTHING_ALPHA * (clamped.tileY - this.smoothedTile.tileY)
      }
      : clamped;

    this.player.moveToApproxTile(this.smoothedTile.tileX, this.smoothedTile.tileY);
    this.refreshFanRoute();
  }

  addCalibrationPoint(poiId) {
    if (!this.lastGpsPosition) {
      this.panel.setGpsStatus('Waiting for GPS fix before calibration', true);
      return;
    }

    const poi = pois.find((item) => item.id === poiId);
    this.calibrationRefs = this.calibrationRefs.filter((ref) => ref.poiId !== poiId);
    this.calibrationRefs.push({
      poiId,
      lat: this.lastGpsPosition.lat,
      lng: this.lastGpsPosition.lng,
      tileX: poi.tileX,
      tileY: poi.tileY
    });
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(this.calibrationRefs));
    this.smoothedTile = null;
    this.updateCalibrationStatus();
  }

  clearCalibration() {
    this.calibrationRefs = [];
    this.smoothedTile = null;
    localStorage.removeItem(CALIBRATION_KEY);
    this.updateCalibrationStatus();
  }

  loadCalibrationRefs() {
    try {
      return JSON.parse(localStorage.getItem(CALIBRATION_KEY)) ?? [];
    } catch {
      return [];
    }
  }

  updateCalibrationStatus() {
    const count = this.calibrationRefs.length;
    if (count < 2) {
      this.panel.setGpsStatus(`Calibration ${count}/2 points - marker waits for 2 points`, true);
    } else {
      this.panel.setGpsStatus(`Calibration ready (${count} point${count === 1 ? '' : 's'})`);
    }
  }

  drawHeadingIndicator() {
    this.headingGraphics.clear();
    if (this.mode !== 'fan' || this.headingDegrees === null) return;

    const angle = this.headingMapAngle();
    if (angle === null) return;

    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    const length = 54;
    const spread = 0.44;
    const tip = {
      x: x + Math.cos(angle) * length,
      y: y + Math.sin(angle) * length
    };
    const left = {
      x: x + Math.cos(angle + Math.PI - spread) * 16,
      y: y + Math.sin(angle + Math.PI - spread) * 16
    };
    const right = {
      x: x + Math.cos(angle + Math.PI + spread) * 16,
      y: y + Math.sin(angle + Math.PI + spread) * 16
    };

    this.headingGraphics.fillStyle(0x41c7f4, 0.26);
    this.headingGraphics.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
    this.headingGraphics.lineStyle(3, 0x41c7f4, 0.9);
    this.headingGraphics.lineBetween(x, y, tip.x, tip.y);
  }

  headingMapAngle() {
    const heading = (this.headingDegrees * Math.PI) / 180;
    const realVector = { x: Math.sin(heading), y: Math.cos(heading) };

    if (this.calibrationRefs.length >= 2) {
      try {
        const calibration = makeCalibration(this.calibrationRefs);
        const here = this.lastGpsPosition ?? this.calibrationRefs[0];
        const start = transformLocation(calibration, here);
        const end = transformLocation(calibration, {
          lat: here.lat + realVector.y * 0.00001,
          lng: here.lng + realVector.x * 0.00001
        });
        const startWorld = this.tileToWorld(start.tileX, start.tileY);
        const endWorld = this.tileToWorld(end.tileX, end.tileY);
        return Math.atan2(endWorld.y - startWorld.y, endWorld.x - startWorld.x);
      } catch {
        return null;
      }
    }

    const startWorld = this.tileToWorld(0, 0);
    const endWorld = this.tileToWorld(realVector.x, -realVector.y);
    return Math.atan2(endWorld.y - startWorld.y, endWorld.x - startWorld.x);
  }

  normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  cardinalDirection(degrees) {
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return names[Math.round(degrees / 45) % names.length];
  }

  refreshFanRoute() {
    if (this.mode !== 'fan' || !this.activeDestination) return;
    const start = getNode(this.graph, this.player.tileX, this.player.tileY);
    const end = getNode(this.graph, this.activeDestination.tileX, this.activeDestination.tileY);
    const path = findPath(this.graph, start, end);
    if (!path) return;

    this.activePath = path;
    this.drawRoute(path);
    this.updateDirections(path, path[0], 0, this.activeDestination);
  }

  drawRoute(path) {
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(6, 0x41c7f4, 0.42);
    this.pathGraphics.beginPath();

    path.forEach((node, index) => {
      const world = this.tileToWorld(node.x, node.y);
      const x = this.worldOffset.x + world.x;
      const y = this.worldOffset.y + world.y;
      if (index === 0) this.pathGraphics.moveTo(x, y);
      else this.pathGraphics.lineTo(x, y);
    });

    this.pathGraphics.strokePath();
    this.pathGraphics.fillStyle(0x5eead4, 0.35);
    path.forEach((node) => {
      const world = this.tileToWorld(node.x, node.y);
      const x = this.worldOffset.x + world.x;
      const y = this.worldOffset.y + world.y;
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(x, y - 6);
      this.pathGraphics.lineTo(x + 12, y);
      this.pathGraphics.lineTo(x, y + 6);
      this.pathGraphics.lineTo(x - 12, y);
      this.pathGraphics.closePath();
      this.pathGraphics.fillPath();
    });
  }

  updateDirections(path, node, index, poi) {
    if (path.length <= 1 || index === 0) {
      this.status.setText(`Continue toward ${poi.name}.`);
      return;
    }

    if (index >= path.length - 1) {
      this.status.setText(`Arriving at ${poi.name}.`);
      return;
    }

    const previous = path[index - 1];
    const next = path[index + 1];
    const dx1 = node.x - previous.x;
    const dy1 = node.y - previous.y;
    const dx2 = next.x - node.x;
    const dy2 = next.y - node.y;

    if (dx1 === dx2 && dy1 === dy2) {
      this.status.setText(`Continue straight toward ${poi.name}.`);
    } else {
      this.status.setText(`Turn ${this.turnDirection(dx1, dy1, dx2, dy2)} near the concourse junction.`);
    }
  }

  turnDirection(dx1, dy1, dx2, dy2) {
    const cross = dx1 * dy2 - dy1 * dx2;
    return cross > 0 ? 'right' : 'left';
  }

  clearRoute() {
    this.pathGraphics.clear();
    this.panel.setActive(null);
    this.activeDestination = null;
    this.activePath = null;
    this.status.setText(this.mode === 'fan'
      ? 'Fan Mode: GPS moves the marker. Pick a destination after calibration.'
      : 'Pick a destination or walk with WASD / arrow keys.');
  }

  resetNavigator() {
    this.clearRoute();
    this.panel.setBusy(false);
    this.player.reset(spawn.tileX, spawn.tileY);
  }

  // ponytail: setup pan/zoom and multi-touch interactions
  setupInteractions() {
    let prevDistance = 0;

    // Mouse wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const camera = this.cameras.main;
      const oldZoom = camera.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - deltaY * 0.001, this.minZoom, 6.0);

      if (newZoom !== oldZoom) {
        camera.stopFollow();

        // Calculate screen displacement from camera center
        const dx = pointer.x - camera.width / 2;
        const dy = pointer.y - camera.height / 2;
        let rx = dx;
        let ry = dy;

        // If camera is rotated, rotate screen displacement back to align with world axes
        if (this.mapRotationAngle !== 0) {
          const cos = Math.cos(-this.mapRotationAngle);
          const sin = Math.sin(-this.mapRotationAngle);
          rx = dx * cos - dy * sin;
          ry = dx * sin + dy * cos;
        }

        camera.setZoom(newZoom);
        camera.scrollX += rx * (1 / oldZoom - 1 / newZoom);
        camera.scrollY += ry * (1 / oldZoom - 1 / newZoom);

        this.updateLayers(newZoom);
      }
    });

    // Panning, Pinching & Rotation
    this.input.on('pointerdown', (pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        this.cameras.main.stopFollow();
        prevDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        
        // Initialize rotation angle for two-finger gesture (2D mode only)
        if (this.projectionMode === '2d') {
          this.previousTwoFingerAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        } else {
          this.previousTwoFingerAngle = null;
        }
        this.isRotating = false;
        
        // Start two-finger drag from the midpoint of two touches
        this.dragStartPoint = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2
        };
        this.cameraStartScroll = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
      } else {
        this.cameras.main.stopFollow();
        this.dragStartPoint = { x: pointer.x, y: pointer.y };
        this.cameraStartScroll = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
      }
    });

    this.input.on('pointermove', (pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // 1. Handle pinch-to-zoom (only if distance is reasonable to avoid division jump)
        if (dist > 30) {
          if (prevDistance > 30) {
            // ponytail: delta distance based zoom is far more stable than ratio
            const zoomFactor = 1 + (dist - prevDistance) * 0.003;
            const camera = this.cameras.main;
            const oldZoom = camera.zoom;
            const newZoom = Phaser.Math.Clamp(oldZoom * zoomFactor, this.minZoom, 6.0);

            if (newZoom !== oldZoom) {
              // Calculate screen displacement from camera center
              const dx = midX - camera.width / 2;
              const dy = midY - camera.height / 2;
              let rx = dx;
              let ry = dy;

              // Rotate screen displacement back to align with world axes if camera is rotated
              if (this.mapRotationAngle !== 0) {
                const cos = Math.cos(-this.mapRotationAngle);
                const sin = Math.sin(-this.mapRotationAngle);
                rx = dx * cos - dy * sin;
                ry = dx * sin + dy * cos;
              }

              camera.setZoom(newZoom);
              const scrollDiffX = rx * (1 / oldZoom - 1 / newZoom);
              const scrollDiffY = ry * (1 / oldZoom - 1 / newZoom);
              camera.scrollX += scrollDiffX;
              camera.scrollY += scrollDiffY;
              
              // Shift the starting scroll to align with midpoint zoom adjustment
              this.cameraStartScroll.x += scrollDiffX;
              this.cameraStartScroll.y += scrollDiffY;

              this.updateLayers(newZoom);
            }
          }
          prevDistance = dist;
        } else {
          prevDistance = 0;
        }

        // 2. Handle two-finger rotation (works in 2D mode only)
        if (this.projectionMode === '2d' && this.previousTwoFingerAngle !== null && dist > 30) {
          const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          let deltaAngle = currentAngle - this.previousTwoFingerAngle;
          
          // Normalize angle difference to [-π, π]
          while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
          while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
          
          if (Math.abs(deltaAngle) > 0.02) {
            this.isRotating = true;
            this.mapRotationAngle += deltaAngle;
            this.cameras.main.setRotation(this.mapRotationAngle);
          }
          
          this.previousTwoFingerAngle = currentAngle;
        }

        // 3. Handle two-finger panning
        if (this.dragStartPoint) {
          const camera = this.cameras.main;
          const dx = midX - this.dragStartPoint.x;
          const dy = midY - this.dragStartPoint.y;

          if (this.mapRotationAngle !== 0) {
            const cos = Math.cos(-this.mapRotationAngle);
            const sin = Math.sin(-this.mapRotationAngle);
            const rotatedDx = dx * cos - dy * sin;
            const rotatedDy = dx * sin + dy * cos;
            camera.scrollX = this.cameraStartScroll.x - rotatedDx / camera.zoom;
            camera.scrollY = this.cameraStartScroll.y - rotatedDy / camera.zoom;
          } else {
            camera.scrollX = this.cameraStartScroll.x - dx / camera.zoom;
            camera.scrollY = this.cameraStartScroll.y - dy / camera.zoom;
          }
        }
      } else if (pointer.isDown && this.dragStartPoint) {
        // Handle single-finger panning with rotation compensation
        const camera = this.cameras.main;
        const dx = pointer.x - this.dragStartPoint.x;
        const dy = pointer.y - this.dragStartPoint.y;
        
        // If camera is rotated, compensate for the rotation
        if (this.mapRotationAngle !== 0) {
          const cos = Math.cos(-this.mapRotationAngle);
          const sin = Math.sin(-this.mapRotationAngle);
          const rotatedDx = dx * cos - dy * sin;
          const rotatedDy = dx * sin + dy * cos;
          camera.scrollX = this.cameraStartScroll.x - rotatedDx / camera.zoom;
          camera.scrollY = this.cameraStartScroll.y - rotatedDy / camera.zoom;
        } else {
          camera.scrollX = this.cameraStartScroll.x - dx / camera.zoom;
          camera.scrollY = this.cameraStartScroll.y - dy / camera.zoom;
        }
      }
    });

    this.input.on('pointerup', (pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (!p1.isDown || !p2.isDown) {
        prevDistance = 0;
        this.previousTwoFingerAngle = null;
        this.isRotating = false;
      }
      
      // Seamless transition: if one finger is still down, set it as the drag start for panning
      if (p1.isDown && !p2.isDown) {
        this.dragStartPoint = { x: p1.x, y: p1.y };
        this.cameraStartScroll = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
      } else if (p2.isDown && !p1.isDown) {
        this.dragStartPoint = { x: p2.x, y: p2.y };
        this.cameraStartScroll = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
      } else {
        // Tap/click detection
        if (this.dragStartPoint) {
          const dragDist = Phaser.Math.Distance.Between(
            pointer.downX, pointer.downY,
            pointer.upX, pointer.upY
          );
          const duration = pointer.upTime - pointer.downTime;
          if (dragDist < 8 && duration < 300) {
            this.handleMapClick(pointer);
          }
        }
        this.dragStartPoint = null;
      }
    });
  }

  // ponytail: handle layer switching / levels of detail based on zoom level
  updateLayers(zoom) {
    if (!this.poiObjects) return;

    this.poiObjects.forEach((obj) => {
      if (zoom < 0.75) {
        // Abstract View (Game look): only show minimal color dots
        obj.nameLabel.setVisible(false);
        obj.icon.setVisible(false);
        obj.outerBg.setAlpha(0.2);
        obj.bg.setScale(0.85);
      } else if (zoom < 1.0) {
        // Medium Detail: show icons inside dots
        obj.nameLabel.setVisible(false);
        obj.icon.setVisible(true);
        obj.icon.setAlpha(Phaser.Math.Percent(zoom, 0.75, 1.0));
        obj.outerBg.setAlpha(0.65);
        obj.bg.setScale(1.0);
      } else {
        // Full Detailed View: show names and icons
        obj.nameLabel.setVisible(true);
        obj.nameLabel.setAlpha(Phaser.Math.Percent(zoom, 1.0, 1.25));
        obj.icon.setVisible(true);
        obj.icon.setAlpha(1.0);
        obj.outerBg.setAlpha(1.0);
        obj.bg.setScale(1.0);
      }
    });
  }

  // Update compass indicator rotation and visibility (works in both 2D and 3D modes)
  updateCompass() {
    if (!this.compassEl) return;
    
    this.updateCompassVisibility();
    
    // Rotate the compass to show current map orientation
    // The compass "N" should point to actual north (up in world space)
    const degreesRotation = -(this.mapRotationAngle * 180 / Math.PI);
    this.compassEl.style.transform = `rotate(${degreesRotation}deg)`;
  }

  updateCompassVisibility() {
    if (!this.compassEl || !this.resetNorthBtnEl) return;
    
    // Show compass and reset button when there's significant rotation (2D mode only)
    const shouldShow = this.projectionMode === '2d' && Math.abs(this.mapRotationAngle) > 0.05;
    this.compassEl.style.display = shouldShow ? 'flex' : 'none';
    this.resetNorthBtnEl.style.display = shouldShow ? 'block' : 'none';
  }

  // Enhanced seat rendering with detail levels and custom PNGs
  drawEnhancedSeat(worldX, worldY, tileX, tileY, detailLevel) {
    const seatVariant = seatVariantKey(tileX, tileY, tileGrid);
    
    if (!this.activeSeatsSet.has(`${tileX},${tileY}`)) {
      return this.add.image(worldX, worldY, 'tile-floor-2d')
        .setOrigin(0.5, 0.5)
        .setDepth(0);
    }
    
    // Map seat tier to custom PNG key
    const seatKey = seatVariant === 'tile-seat-inner' ? 'ai-seat-premium' : 
                    seatVariant === 'tile-seat-mid' ? 'ai-seat-vip' : 'ai-seat-general';
    
    const container = this.add.container(worldX, worldY);
    const floor = this.add.image(0, 0, 'tile-floor-2d').setOrigin(0.5, 0.5);
    container.add(floor);
    
    if (detailLevel === DETAIL_LEVELS.HIGH) {
      // HIGH DETAIL: Render custom PNG seat at full detail size
      const seat = this.add.image(0, 0, seatKey).setDisplaySize(20, 20);
      container.add(seat);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      // MEDIUM DETAIL: Scale seat down
      const seat = this.add.image(0, 0, seatKey).setDisplaySize(13, 13);
      container.add(seat);
    } else {
      // LOW DETAIL: Render solid color block on top of floor
      const colors = {
        'tile-seat-outer': 0x3b82f6,  // Blue
        'tile-seat-mid': 0xef4444,    // Red
        'tile-seat-inner': 0xd97706   // Gold
      };
      const dot = this.add.rectangle(0, 0, 8, 8, colors[seatVariant] || 0x3b82f6);
      container.add(dot);
    }
    container.setDepth(1);
    return container;
  }

  // Enhanced grass rendering with variety
  drawEnhancedGrass(worldX, worldY, tileX, tileY, detailLevel) {
    if (detailLevel === DETAIL_LEVELS.HIGH) {
      const container = this.add.container(worldX, worldY);
      const bg = this.add.image(0, 0, 'tile-grass-2d').setOrigin(0.5, 0.5);
      // Add a couple of tiny daisy flowers
      const f1 = this.add.circle(-8, -4, 1.5, 0xffffff);
      const f2 = this.add.circle(6, 6, 1.5, 0xfacc15);
      container.add([bg, f1, f2]);
      container.setDepth(0);
      return container;
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      return this.add.image(worldX, worldY, 'tile-grass-2d')
        .setOrigin(0.5, 0.5)
        .setDepth(0);
    } else {
      return this.add.rectangle(worldX, worldY, 32, 32, 0x5ba35f)
        .setDepth(0);
    }
  }

  // Enhanced tree rendering
  drawEnhancedTree(worldX, worldY, tileX, tileY, detailLevel) {
    const container = this.add.container(worldX, worldY);
    // Draw grass background first
    const grass = this.add.image(0, 0, 'tile-grass-2d').setOrigin(0.5, 0.5);
    container.add(grass);

    if (detailLevel === DETAIL_LEVELS.HIGH) {
      const tree = this.add.image(0, -6, 'ai-decor-tree').setDisplaySize(24, 28);
      container.add(tree);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      const tree = this.add.image(0, -3, 'ai-decor-tree').setDisplaySize(16, 20);
      container.add(tree);
    } else {
      const dot = this.add.circle(0, 0, 5, 0x1b5e20);
      container.add(dot);
    }
    container.setDepth(1);
    return container;
  }

  // Enhanced road rendering
  drawEnhancedRoad(worldX, worldY, tileX, tileY, detailLevel) {
    if (detailLevel === DETAIL_LEVELS.HIGH || detailLevel === DETAIL_LEVELS.MEDIUM) {
      return this.add.image(worldX, worldY, 'ai-tile-road')
        .setDisplaySize(32, 32)
        .setDepth(0);
    } else {
      return this.add.rectangle(worldX, worldY, 32, 32, 0x23262b)
        .setDepth(0);
    }
  }

  // Kiosk / Stands Drawings
  drawFoodStand(worldX, worldY, detailLevel) {
    const container = this.add.container(worldX, worldY);
    const floor = this.add.image(0, 0, 'tile-floor-2d').setOrigin(0.5, 0.5);
    container.add(floor);

    if (detailLevel === DETAIL_LEVELS.HIGH) {
      const stand = this.add.image(0, -4, 'ai-stand-food').setDisplaySize(26, 26);
      container.add(stand);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      const stand = this.add.image(0, -2, 'ai-stand-food').setDisplaySize(18, 18);
      container.add(stand);
    } else {
      const dot = this.add.rectangle(0, 0, 10, 10, 0xa16207);
      container.add(dot);
    }
    container.setDepth(2);
    return container;
  }

  drawMedicalStand(worldX, worldY, detailLevel) {
    const container = this.add.container(worldX, worldY);
    const floor = this.add.image(0, 0, 'tile-floor-2d').setOrigin(0.5, 0.5);
    container.add(floor);

    if (detailLevel === DETAIL_LEVELS.HIGH) {
      const tent = this.add.image(0, -4, 'ai-stand-medical').setDisplaySize(26, 26);
      container.add(tent);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      const tent = this.add.image(0, -2, 'ai-stand-medical').setDisplaySize(18, 18);
      container.add(tent);
    } else {
      const dot = this.add.rectangle(0, 0, 10, 10, 0xef4444);
      container.add(dot);
    }
    container.setDepth(2);
    return container;
  }

  drawRestroomStand(worldX, worldY, detailLevel) {
    const container = this.add.container(worldX, worldY);
    const floor = this.add.image(0, 0, 'tile-floor-2d').setOrigin(0.5, 0.5);
    container.add(floor);

    if (detailLevel === DETAIL_LEVELS.HIGH) {
      const cabin = this.add.image(0, -4, 'ai-stand-restroom').setDisplaySize(24, 26);
      container.add(cabin);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      const cabin = this.add.image(0, -2, 'ai-stand-restroom').setDisplaySize(16, 18);
      container.add(cabin);
    } else {
      const dot = this.add.rectangle(0, 0, 10, 10, 0x0284c7);
      container.add(dot);
    }
    container.setDepth(2);
    return container;
  }

  drawGateStand(worldX, worldY, detailLevel) {
    const container = this.add.container(worldX, worldY);
    const floor = this.add.image(0, 0, 'tile-floor-2d').setOrigin(0.5, 0.5);
    container.add(floor);

    if (detailLevel === DETAIL_LEVELS.HIGH) {
      // 4 tiles wide (4 * 32 = 128px wide)
      const gate = this.add.image(0, -16, 'ai-stand-gate').setDisplaySize(128, 92);
      container.add(gate);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      // 2.5 tiles wide (80px wide)
      const gate = this.add.image(0, -8, 'ai-stand-gate').setDisplaySize(80, 58);
      container.add(gate);
    } else {
      const dot = this.add.rectangle(0, 0, 24, 10, 0x475569);
      container.add(dot);
    }
    container.setDepth(2);
    return container;
  }

  drawMerchStand(worldX, worldY, detailLevel) {
    const container = this.add.container(worldX, worldY);
    const floor = this.add.image(0, 0, 'tile-floor-2d').setOrigin(0.5, 0.5);
    container.add(floor);

    if (detailLevel === DETAIL_LEVELS.HIGH) {
      const stand = this.add.image(0, -4, 'ai-stand-merch').setDisplaySize(26, 26);
      container.add(stand);
    } else if (detailLevel === DETAIL_LEVELS.MEDIUM) {
      const stand = this.add.image(0, -2, 'ai-stand-merch').setDisplaySize(18, 18);
      container.add(stand);
    } else {
      const dot = this.add.rectangle(0, 0, 10, 10, 0x6d28d9);
      container.add(dot);
    }
    container.setDepth(2);
    return container;
  }

  // Add decorative details at high zoom level
  addDecorativeDetails() {
    if (this.decorativeDetails) {
      this.decorativeDetails.forEach(d => d.destroy());
    }
    this.decorativeDetails = [];

    const cam = this.cameras.main;
    const bounds = cam.worldView;
    const pad = 64;

    // 1. Add parked cars in the visible parking lot (tile === 4)
    tileGrid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === 4) {
          const world = this.tileToWorld(x, y);
          const worldX = this.worldOffset.x + world.x;
          const worldY = this.worldOffset.y + world.y;

          const isVisible = (worldX >= bounds.x - pad &&
                             worldX <= bounds.right + pad &&
                             worldY >= bounds.y - pad &&
                             worldY <= bounds.bottom + pad);

          if (isVisible) {
            // Seed a deterministic random check using x & y
            const isParked = ((x * 17 + y * 23) % 100) < 30; // 30% parking rate
            if (isParked) {
              const car = this.add.image(worldX, worldY, 'ai-decor-car')
                .setDisplaySize(24, 18)
                .setDepth(1);
              
              // Random flip for variety
              if ((x + y) % 2 === 0) {
                car.setFlipX(true);
              }
              this.mapTilesGroup.add(car);
              this.decorativeDetails.push(car);
            }
          }
        }
      });
    });

    // 2. Add furniture at food/merch POIs
    if (this.godotAssets && this.godotAssets.furniture && this.godotAssets.furniture.length > 0) {
      pois.forEach((poi) => {
        if (poi.type === 'food' || poi.type === 'merch') {
          const world = this.tileToWorld(poi.tileX, poi.tileY);
          const worldX = this.worldOffset.x + world.x;
          const worldY = this.worldOffset.y + world.y;

          const isVisible = (worldX >= bounds.x - pad &&
                             worldX <= bounds.right + pad &&
                             worldY >= bounds.y - pad &&
                             worldY <= bounds.bottom + pad);

          if (!isVisible) return;
          
          // Add furniture around the POI
          const furnitureKey = getFurnitureSprite(
            this.godotAssets.furniture,
            poi.type === 'food' ? FURNITURE_INDICES.STALL : FURNITURE_INDICES.COUNTER
          );
          
          if (furnitureKey && this.textures.exists(furnitureKey)) {
            const furniture = this.add.image(worldX + 24, worldY, furnitureKey)
              .setOrigin(0.5, 0.5)
              .setDepth(10)
              .setScale(1.5);
            this.mapTilesGroup.add(furniture);
            this.decorativeDetails.push(furniture);
          }
        }
      });
    }
  }

  // Update detail level indicator
  updateDetailLevelIndicator() {
    if (!this.detailLevelText) return;
    
    const level = this.detailManager?.getCurrentLevel();
    if (this.projectionMode === '2d') {
      if (level === DETAIL_LEVELS.HIGH) {
        this.detailLevelText.setText('🔍 High Detail - Individual Seats Visible');
      } else if (level === DETAIL_LEVELS.MEDIUM) {
        this.detailLevelText.setText('👁️ Medium Detail');
      } else {
        this.detailLevelText.setText('🗺️ Low Detail - Overview');
      }
      this.detailLevelText.setVisible(true);
      
      // Auto-hide after 2 seconds
      this.time.delayedCall(2000, () => {
        if (this.detailLevelText) {
          this.detailLevelText.setVisible(false);
        }
      });
    } else {
      this.detailLevelText.setVisible(false);
    }
  }

  resumeFollowIfMobile() {
    const isMobile = this.scale.width < 761;
    if (isMobile) {
      this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 56);
    }
  }

  updatePlayerDepth() {
    if (!this.player) return;
    if (this.projectionMode === '3d') {
      const r = this.rotateTile(this.player.tileX, this.player.tileY);
      this.player.sprite.setDepth(r.x + r.y + 0.5);
    } else {
      this.player.sprite.setDepth(10);
    }
  }

  rotateTile(x, y) {
    const rows = tileGrid.length;
    const cols = tileGrid[0].length;
    switch (this.mapRotation || 0) {
      case 0: return { x, y };
      case 1: return { x: rows - 1 - y, y: x };            // 90° CW
      case 2: return { x: cols - 1 - x, y: rows - 1 - y };  // 180°
      case 3: return { x: y, y: cols - 1 - x };             // 270° CW
      default: return { x, y };
    }
  }

  // ponytail: dynamic tileToWorld based on current projection Mode
  tileToWorld(tileX, tileY) {
    const r = this.projectionMode === '3d' ? this.rotateTile(tileX, tileY) : { x: tileX, y: tileY };
    if (this.projectionMode === '3d') {
      return {
        x: (r.x - r.y) * (ISO_TILE_WIDTH / 2),
        y: (r.x + r.y) * (ISO_TILE_HEIGHT / 2)
      };
    } else {
      return {
        x: r.x * TILE_SIZE + TILE_SIZE / 2,
        y: r.y * TILE_SIZE + TILE_SIZE / 2
      };
    }
  }

  updateProjectionConfig() {
    if (this.projectionMode === '3d') {
      const { width, height, originX, minWorldX } = isoMapSize(tileGrid, this.mapRotation);
      this.isoMapWidth = width;
      this.isoMapHeight = height;
      this.worldOffset = { x: originX + 24, y: WALL_HEIGHT + 24 };
      this.mapLeft = this.worldOffset.x + minWorldX;   // true left edge
      this.mapTop  = this.worldOffset.y - ISO_TILE_HEIGHT / 2;
    } else {
      this.isoMapWidth = tileGrid[0].length * TILE_SIZE;
      this.isoMapHeight = tileGrid.length * TILE_SIZE;
      this.worldOffset = { x: 24, y: 52 };
      this.mapLeft = this.worldOffset.x;
      this.mapTop  = this.worldOffset.y;
    }
  }

  toggleProjectionMode() {
    this.projectionMode = this.projectionMode === '3d' ? '2d' : '3d';
    this.toggleBtnEl.innerText = this.projectionMode === '3d' ? 'Switch to 2D' : 'Switch to 3D';
    
    // If switching to 3d view, clear any smooth camera rotation
    if (this.projectionMode === '3d') {
      this.mapRotationAngle = 0;
      this.cameras.main.setRotation(0);
    }

    // The discrete rotation button is only for 3D mode's cardinal direction snapping
    // It's useful when user wants aligned lighting on walls
    if (this.rotateBtnEl) {
      this.rotateBtnEl.style.display = this.projectionMode === '3d' ? 'block' : 'none';
    }
    
    // Reset North button and compass only show for 2D mode now
    this.updateCompassVisibility();

    // Update sizing config
    this.updateProjectionConfig();

    // Redraw map and visuals
    this.drawMap();
    this.drawFieldMarkings();
    this.drawPois();

    // Relocate player to matching world coordinates
    this.player.reset(this.player.tileX, this.player.tileY);

    // Redraw route if path is active
    if (this.activePath) {
      this.drawRoute(this.activePath);
    }

    // Reset camera boundaries and positioning
    this.layoutGameView();

    // Center camera on the player
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
  }

  loadStoredSeat() {
    try {
      const storedSeat = JSON.parse(localStorage.getItem('stadium-my-seat'));
      if (storedSeat && storedSeat.section) {
        this.mySeatInfo = storedSeat;
        const sectionStr = storedSeat.section.toLowerCase();
        this.mySeatPoi = pois.find(
          (p) => p.name.toLowerCase().includes(sectionStr) || p.id.toLowerCase().includes(sectionStr)
        );
        if (this.mySeatPoi && this.sectionSeats && this.sectionSeats[this.mySeatPoi.id]) {
          const section = this.sectionSeats[this.mySeatPoi.id];
          const rowLabel = storedSeat.row.toUpperCase();
          const seatNum = parseInt(storedSeat.seat, 10);
          let targetSeat = null;
          if (section.rows[rowLabel]) {
            targetSeat = section.rows[rowLabel].find(s => s.seatNum === seatNum);
          }
          if (!targetSeat) {
            for (const rKey of section.rowKeys) {
              const activeInRow = section.rows[rKey].find(s => this.activeSeatsSet.has(`${s.x},${s.y}`));
              if (activeInRow) {
                targetSeat = activeInRow;
                break;
              }
            }
          }
          if (targetSeat) {
            this.mySeatTile = { tileX: targetSeat.x, tileY: targetSeat.y };
          } else {
            this.mySeatTile = null;
          }
        } else {
          this.mySeatTile = null;
        }
      } else {
        this.mySeatPoi = null;
        this.mySeatInfo = null;
        this.mySeatTile = null;
      }
    } catch (e) {
      this.mySeatPoi = null;
      this.mySeatInfo = null;
      this.mySeatTile = null;
    }
  }

  setMySeat(seatInfo) {
    this.mySeatInfo = seatInfo;
    const sectionStr = seatInfo.section.toLowerCase();
    this.mySeatPoi = pois.find(
      (p) => p.name.toLowerCase().includes(sectionStr) || p.id.toLowerCase().includes(sectionStr)
    );
    
    if (this.mySeatPoi && this.sectionSeats && this.sectionSeats[this.mySeatPoi.id]) {
      const section = this.sectionSeats[this.mySeatPoi.id];
      const rowLabel = seatInfo.row.toUpperCase();
      const seatNum = parseInt(seatInfo.seat, 10);
      
      let targetSeat = null;
      if (section.rows[rowLabel]) {
        targetSeat = section.rows[rowLabel].find(s => s.seatNum === seatNum);
      }
      
      if (!targetSeat) {
        for (const rKey of section.rowKeys) {
          const activeInRow = section.rows[rKey].find(s => this.activeSeatsSet.has(`${s.x},${s.y}`));
          if (activeInRow) {
            targetSeat = activeInRow;
            break;
          }
        }
      }
      
      if (targetSeat) {
        this.mySeatTile = { tileX: targetSeat.x, tileY: targetSeat.y };
        console.log(`Pinpointed seat: ${sectionStr} Row ${rowLabel} Seat ${seatNum} at X: ${targetSeat.x}, Y: ${targetSeat.y}`);
      } else {
        this.mySeatTile = null;
      }
    } else {
      this.mySeatTile = null;
    }
    
    this.drawMap();
    this.drawPois();
    if (this.mySeatPoi) {
      this.selectPoi(this.mySeatPoi);
    }
  }

  goToMySeat() {
    if (this.mySeatPoi) {
      this.selectPoi(this.mySeatPoi);
      this.routeToPoi(this.mySeatPoi);
    }
  }

  selectPoi(poi) {
    this.panel.showPoiCard(poi);
    const world = this.tileToWorld(poi.tileX, poi.tileY);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(
      world.x + this.worldOffset.x,
      world.y + this.worldOffset.y
    );
    this.updateLayers(this.cameras.main.zoom);
  }

  recenterOnPlayer() {
    if (!this.player) return;
    const world = this.tileToWorld(this.player.tileX, this.player.tileY);
    const camera = this.cameras.main;
    camera.stopFollow();
    
    // Calculate zoom based on projection mode to show specific tile width
    // 3D view: zoom to show ~2 tiles wide (current + 2 tiles)
    // 2D view: zoom to show ~4 tiles wide (current + 4 tiles)
    const screenWidth = this.scale.width;
    const tileWidth = ISO_TILE_WIDTH; // 64px
    
    let targetZoom;
    if (this.projectionMode === '3d') {
      // For 3D view: show 2 tiles wide total
      targetZoom = screenWidth / (tileWidth * 2);
    } else {
      // For 2D view: show 4 tiles wide total
      targetZoom = screenWidth / (tileWidth * 4);
    }
    
    // Clamp between minZoom and max zoom (6.0)
    targetZoom = Phaser.Math.Clamp(targetZoom, this.minZoom, 6.0);
    
    camera.setZoom(targetZoom);
    camera.centerOn(
      world.x + this.worldOffset.x,
      world.y + this.worldOffset.y
    );
    this.updateLayers(camera.zoom);
  }

  // Helper to convert world coordinates to grid coordinates for 2D and 3D projection modes
  worldToTile(worldX, worldY) {
    if (this.projectionMode === '3d') {
      const tx = worldX - this.worldOffset.x;
      const ty = worldY - this.worldOffset.y;
      const isox = (tx / (ISO_TILE_WIDTH / 2) + ty / (ISO_TILE_HEIGHT / 2)) / 2;
      const isoy = (ty / (ISO_TILE_HEIGHT / 2) - tx / (ISO_TILE_WIDTH / 2)) / 2;
      const rx = Math.round(isox);
      const ry = Math.round(isoy);
      
      const rows = tileGrid.length;
      const cols = tileGrid[0].length;
      switch (this.mapRotation || 0) {
        case 0: return { x: rx, y: ry };
        case 1: return { x: ry, y: rows - 1 - rx };
        case 2: return { x: cols - 1 - rx, y: rows - 1 - ry };
        case 3: return { x: cols - 1 - ry, y: rx };
        default: return { x: rx, y: ry };
      }
    } else {
      const rx = Math.floor((worldX - this.worldOffset.x) / TILE_SIZE);
      const ry = Math.floor((worldY - this.worldOffset.y) / TILE_SIZE);
      return { x: rx, y: ry };
    }
  }

  // Get Section, Row and Seat Number details for a given seat tile coordinate
  getSeatDetailsAt(tileX, tileY) {
    if (!this.activeSeatsSet || !this.activeSeatsSet.has(`${tileX},${tileY}`)) return null;

    for (const poiId in this.sectionSeats) {
      const section = this.sectionSeats[poiId];
      for (const rowLabel in section.rows) {
        const seat = section.rows[rowLabel].find(s => s.x === tileX && s.y === tileY);
        if (seat) {
          const poi = pois.find(p => p.id === poiId);
          return {
            poiId,
            sectionName: poi ? poi.name : 'Unknown Section',
            row: rowLabel,
            seatNum: seat.seatNum
          };
        }
      }
    }
    return null;
  }

  // Handle map click events to select seats and stands
  handleMapClick(pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tileCoords = this.worldToTile(worldPoint.x, worldPoint.y);
    const { x, y } = tileCoords;

    if (y < 0 || y >= tileGrid.length || x < 0 || x >= tileGrid[0].length) return;

    const tile = tileGrid[y][x];

    // 1. Check if it matches a POI (gate, food, medical, restroom, merch)
    const poi = pois.find(p => p.tileX === x && p.tileY === y);
    if (poi) {
      this.selectPoi(poi);
      return;
    }

    // 2. Check if it's an active seat
    if (tile === 2 && this.activeSeatsSet && this.activeSeatsSet.has(`${x},${y}`)) {
      const seatDetails = this.getSeatDetailsAt(x, y);
      if (seatDetails) {
        const seatPoi = {
          id: `seat-${x}-${y}`,
          name: `${seatDetails.sectionName} Row ${seatDetails.row} Seat ${seatDetails.seatNum}`,
          type: 'seat',
          tileX: x,
          tileY: y
        };
        this.selectPoi(seatPoi);
      }
    }
  }

  // Group all seat tiles into sections, rows, and seats, and select exactly 4700 seats in proper rows
  initializeSeatsStructure() {
    const seatingPois = pois.filter(poi => poi.type === 'seat');
    const seatsByPoi = new Map();
    
    seatingPois.forEach(poi => {
      seatsByPoi.set(poi.id, []);
    });
    
    tileGrid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === 2) {
          let closestPoi = null;
          let minDist = Infinity;
          seatingPois.forEach(poi => {
            const dist = Math.hypot(x - poi.tileX, y - poi.tileY);
            if (dist < minDist) {
              minDist = dist;
              closestPoi = poi;
            }
          });
          
          if (closestPoi && minDist < 15) {
            seatsByPoi.get(closestPoi.id).push({ x, y });
          }
        }
      });
    });
    
    this.sectionSeats = {};
    this.activeSeatsSet = new Set();
    let totalSeatsPlaced = 0;
    const targetSeatCount = 4700;
    const poiIds = Array.from(seatsByPoi.keys());
    
    poiIds.forEach(poiId => {
      const coords = seatsByPoi.get(poiId);
      if (coords.length === 0) return;
      
      const rowsMap = new Map();
      coords.forEach(c => {
        if (!rowsMap.has(c.y)) {
          rowsMap.set(c.y, []);
        }
        rowsMap.get(c.y).push(c);
      });
      
      const sortedY = Array.from(rowsMap.keys()).sort((a, b) => a - b);
      const organizedRows = {};
      const rowKeys = [];
      
      sortedY.forEach((yVal, index) => {
        const rowLabel = String.fromCharCode(65 + index);
        rowKeys.push(rowLabel);
        
        const rowSeats = rowsMap.get(yVal).sort((a, b) => a.x - b.x);
        organizedRows[rowLabel] = rowSeats.map((seat, seatIndex) => ({
          x: seat.x,
          y: seat.y,
          seatNum: seatIndex + 1
        }));
      });
      
      this.sectionSeats[poiId] = {
        rows: organizedRows,
        rowKeys: rowKeys
      };
    });
    
    // Select active seats in a structured row-by-row way across all sections
    const maxRows = 60;
    for (let rIndex = 0; rIndex < maxRows; rIndex++) {
      const rowLabel = String.fromCharCode(65 + rIndex);
      for (const poiId of poiIds) {
        if (totalSeatsPlaced >= targetSeatCount) break;
        
        const section = this.sectionSeats[poiId];
        if (section && section.rows[rowLabel]) {
          const seatsInRow = section.rows[rowLabel];
          seatsInRow.forEach(seat => {
            if (totalSeatsPlaced < targetSeatCount) {
              this.activeSeatsSet.add(`${seat.x},${seat.y}`);
              totalSeatsPlaced++;
            }
          });
        }
      }
      if (totalSeatsPlaced >= targetSeatCount) break;
    }
  }

  // Find the closest walkable tile to a given seat tile
  findClosestWalkableTile(tileX, tileY) {
    const queue = [{ x: tileX, y: tileY }];
    const visited = new Set();
    visited.add(`${tileX},${tileY}`);
    
    while (queue.length > 0) {
      const curr = queue.shift();
      if (isWalkable(curr.x, curr.y)) {
        return curr;
      }
      
      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 }
      ];
      
      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (n.x >= 0 && n.x < tileGrid[0].length && n.y >= 0 && n.y < tileGrid.length) {
          if (!visited.has(key)) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
    }
    return null;
  }
}