/**
 * StaffScene.js — Full staff portal scene
 *
 * Features:
 *  - Isometric map (same as MainScene)
 *  - Self-locator: GPS + calibration (same as fan mode)
 *  - "You are here" animated player sprite
 *  - Staff members shown as animated Player sprites with role/name badges
 *  - Fan dot overlay (toggleable)
 *  - Cluster bubbles (count per zone when zoomed out)
 *  - Heatmap overlay
 *  - Search (POIs + staff members)
 *  - StaffDashboard panel
 */

import Phaser from 'phaser';
import Player from '../entities/Player.js';
import { makeCalibration, transformLocation } from '../map/calibration.js';
import { buildGraphFromGrid, getNode } from '../map/graph.js';
import { findPath } from '../map/pathfinding.js';
import {
  ISO_TILE_WIDTH, ISO_TILE_HEIGHT, WALL_HEIGHT, TILE_SIZE,
  pois, spawn, tileGrid, isoMapSize, isWalkable
} from '../map/mockStadiumMap.js';
import { ZoomDetailManager, DETAIL_LEVELS } from '../map/zoomDetailManager.js';
import StaffDashboard from '../ui/StaffDashboard.js';
import {
  STAFF_MEMBERS, SECTIONS,
  generateFanPositions, getSectionStats, getAlertTemplates
} from '../data/mockPeopleData.js';

// ── Depth tiers ──────────────────────────────────────────────────────────────
const { rows, cols } = isoMapSize(tileGrid);
const MAX_TILE_SUM      = rows + cols;
const OVERLAY_DEPTH     = MAX_TILE_SUM + 100;
const FIELD_MARKINGS_D  = MAX_TILE_SUM + 20;
const STAFF_SPRITE_D    = OVERLAY_DEPTH + 5;
const FAN_DOT_D         = OVERLAY_DEPTH + 2;
const CLUSTER_D         = OVERLAY_DEPTH + 6;
const HEATMAP_D         = OVERLAY_DEPTH + 1;
const SELF_D            = OVERLAY_DEPTH + 10;
const ROUTE_D           = OVERLAY_DEPTH;

const SMOOTHING_ALPHA   = 0.35;
const CALIBRATION_KEY   = 'staff-nav-calibration';

const POI_COLORS = {
  gate: 0x4aa3df, seat: 0x7d6be8, food: 0xe08b3e,
  restroom: 0x3fbf7f, medical: 0xe05252, merch: 0xd0a94a
};

// Seat variant helper (mirrors MainScene)
function seatVariantKey(tileX, tileY) {
  const cx = tileGrid[0].length / 2, cy = tileGrid.length / 2;
  const norm = Math.hypot(tileX - cx, tileY - cy) / Math.hypot(cx, cy);
  if (norm > 0.62) return 'tile-seat-outer';
  if (norm > 0.4)  return 'tile-seat-mid';
  return 'tile-seat-inner';
}

export default class StaffScene extends Phaser.Scene {
  constructor() { super('StaffScene'); }

  // ── create ─────────────────────────────────────────────────────────────────
  create() {
    this.graph = buildGraphFromGrid(tileGrid);

    // Projection
    this.projectionMode = '3d';
    this.mapRotation    = 0;
    this.pathGraphics   = this.add.graphics().setDepth(ROUTE_D);

    // GPS / self-locator state
    this.geoWatchId      = null;
    this.lastGpsPosition = null;
    this.gpsUpdateCount  = 0;
    this.smoothedTile    = null;
    this.calibrationRefs = this._loadCalibration();

    // Overlay state
    this.showFans       = false;
    this.showClusters   = true;
    this.showHeatmap    = false;
    this.staffObjs      = [];   // { sprite, nameTxt, glowRing, member }
    this.fanDotObjs     = [];
    this.clusterObjs    = [];
    this.heatmapGfx     = null;

    // Route state
    this.activeDestination = null;
    this.activePath        = null;

    // Viewport culling
    this.renderedTilesMap  = new Map();
    this.decorativeDetails = [];
    this.lastCameraScrollX = 0;
    this.lastCameraScrollY = 0;
    this.lastCameraZoom    = 0;

    this.updateProjectionConfig();

    // Zoom-detail system
    this.godotAssets   = this.registry.get('godotAssets') || {};
    this.detailManager = new ZoomDetailManager(this);
    this.detailManager.initialize();
    this.previousZoom  = this.cameras.main.zoom;

    // Seat structure
    this._initSeats();

    // ── Player animations ───────────────────────────────────────────────────
    if (!this.anims.exists('idle')) {
      this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('player-idle', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    }
    if (!this.anims.exists('walk')) {
      this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player-walk', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
    }

    // ── "You are here" player sprite (starts at spawn) ──────────────────────
    this.selfPlayer = new Player(this, spawn.tileX, spawn.tileY);
    // Tint cyan to distinguish from fan view
    this.selfPlayer.sprite.setTint(0x00eaff).setDepth(SELF_D);

    // Self label
    this.selfLabel = this.add.text(
      this.selfPlayer.sprite.x, this.selfPlayer.sprite.y - 20,
      '📍 You', { fontFamily: 'Inter, Arial', fontSize: '9px', color: '#00eaff',
        backgroundColor: 'rgba(0,30,60,0.85)', padding: { x: 4, y: 2 } }
    ).setOrigin(0.5, 1).setDepth(SELF_D + 1).setScrollFactor(1);

    // ── Layout FIRST (so camera is set before map renders) ──────────────────
    this.layoutGameView();
    this.scale.on('resize', () => this.layoutGameView());

    // ── Draw map ────────────────────────────────────────────────────────────
    this._drawMap();
    this._drawFieldMarkings();
    this._drawPois();

    // ── Staff sprites ───────────────────────────────────────────────────────
    this._drawStaffSprites();

    // ── Map control buttons ─────────────────────────────────────────────────
    this._createMapButtons();

    // ── Staff dashboard panel ────────────────────────────────────────────────
    this.dashboard = new StaffDashboard({
      staffMembers:     STAFF_MEMBERS,
      alertTemplates:   getAlertTemplates(),
      getStats:         () => getSectionStats(),
      onFlyToStaff:     (m) => this._flyToTile(m.tileX, m.tileY, true),
      onFlyToTile:      (tx, ty) => this._flyToTile(tx, ty),
      onFlyToLocation:  (loc) => this._flyToLocationName(loc),
      onToggleFans:     (v) => this._toggleFans(v),
      onToggleClusters: (v) => this._toggleClusters(v),
      onToggleHeatmap:  (v) => this._toggleHeatmap(v),
      onStartGps:       () => this._startGps(),
      onStopGps:        () => this._stopGps(),
      onCalibrate:      (poiId) => this._calibrate(poiId),
      onClearCalib:     () => this._clearCalibration(),
      onCenterSelf:     () => this._centerOnSelf(),
    });

    // Reflect any saved calibration in the sidebar status line
    if (this.calibrationRefs.length) {
      this.dashboard.setGpsStatus(
        `GPS inactive · ${this.calibrationRefs.length}/2 points saved`, 'idle'
      );
    }

    // ── Interactions ─────────────────────────────────────────────────────────
    this.input.addPointer(2);
    this._setupInteractions();

    // ── Cleanup ──────────────────────────────────────────────────────────────
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._stopGps();
      this.dashboard?.destroy();
      this._removeMapButtons();
      this._clearStaffSprites();
      this._clearFanDots();
      this._clearClusters();
      this.heatmapGfx?.destroy();
      this._clearRenderedTiles();
      this.detailManager?.destroy();
    });
  }

  // ── Update loop ─────────────────────────────────────────────────────────────
  update() {
    // Keep self label on player sprite
    if (this.selfPlayer && this.selfLabel) {
      this.selfLabel.setPosition(this.selfPlayer.sprite.x, this.selfPlayer.sprite.y - 22);
    }

    const cam = this.cameras.main;
    const moved =
      Math.abs(cam.scrollX - this.lastCameraScrollX) > 2 ||
      Math.abs(cam.scrollY - this.lastCameraScrollY) > 2 ||
      Math.abs(cam.zoom   - this.lastCameraZoom)     > 0.01;

    if (moved) {
      this._updateViewportCulling();
      this.lastCameraScrollX = cam.scrollX;
      this.lastCameraScrollY = cam.scrollY;
      this.lastCameraZoom    = cam.zoom;

      // Toggle cluster bubble visibility by zoom
      if (this.showClusters) {
        const vis = cam.zoom < 1.6;
        this.clusterObjs.forEach(o => {
          o.bg?.setVisible(vis);
          o.ring?.setVisible(vis);
          o.cnt?.setVisible(vis);
          o.lbl?.setVisible(vis);
        });
      }

      // Hide role labels when zoomed far out
      const showLabels = cam.zoom > 1.15;
      this.staffObjs.forEach(o => {
        o.roleTxt?.setVisible(showLabels);
        o.nameTxt?.setVisible(showLabels);
      });
    }

    // 2D detail level
    if (this.projectionMode === '2d' && this.detailManager) {
      const z = cam.zoom;
      if (Math.abs(z - this.previousZoom) > 0.05) {
        if (this.detailManager.updateForZoom(z)) {
          this._drawMap();
          this._drawPois();
        }
        this.previousZoom = z;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GPS / Self-locator
  // ═══════════════════════════════════════════════════════════════════════════

  _startGps() {
    if (!navigator.geolocation) {
      this.dashboard?._showToast('Geolocation not supported on this device', '📡', 'warning');
      this.dashboard?.setGpsStatus('GPS not supported', 'warn');
      return;
    }
    if (this.geoWatchId !== null) return;
    this.geoWatchId = navigator.geolocation.watchPosition(
      (pos) => this._handleGps(pos),
      (err) => {
        this.dashboard?._showToast(`GPS: ${err.message}`, '⚠️', 'warning');
        this.dashboard?.setGpsStatus(`GPS error: ${err.message}`, 'warn');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    this.dashboard?.setGpsActive(true);
    this.dashboard?.setGpsStatus('GPS started — waiting for fix…', 'ok');
    this.dashboard?._showToast('GPS self-locator started', '📍', 'info');
  }

  _stopGps() {
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    this.dashboard?.setGpsActive(false);
    this.dashboard?.setGpsStatus('GPS inactive', 'idle');
  }

  _handleGps(position) {
    this.gpsUpdateCount++;
    this.lastGpsPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    const weak = position.coords.accuracy > 20;
    const calOk = this.calibrationRefs.length >= 2;
    this.dashboard?.setGpsStatus(
      calOk
        ? `GPS #${this.gpsUpdateCount} · ±${Math.round(position.coords.accuracy)}m${weak ? ' (weak)' : ''}`
        : `±${Math.round(position.coords.accuracy)}m · calibrate ${this.calibrationRefs.length}/2 points`,
      calOk && !weak ? 'ok' : 'warn'
    );

    if (!calOk) return;

    let rawTile;
    try {
      rawTile = transformLocation(makeCalibration(this.calibrationRefs), this.lastGpsPosition);
    } catch (e) {
      this.dashboard?.setGpsStatus(e.message, 'warn');
      return;
    }

    const maxX = tileGrid[0].length - 1;
    const maxY = tileGrid.length - 1;
    const clamped = {
      tileX: Math.max(0, Math.min(maxX, rawTile.tileX)),
      tileY: Math.max(0, Math.min(maxY, rawTile.tileY))
    };

    this.smoothedTile = this.smoothedTile
      ? {
          tileX: this.smoothedTile.tileX + SMOOTHING_ALPHA * (clamped.tileX - this.smoothedTile.tileX),
          tileY: this.smoothedTile.tileY + SMOOTHING_ALPHA * (clamped.tileY - this.smoothedTile.tileY)
        }
      : clamped;

    this.selfPlayer.moveToApproxTile(this.smoothedTile.tileX, this.smoothedTile.tileY);
  }

  _calibrate(poiId) {
    if (!this.lastGpsPosition) {
      this.dashboard?.setGpsStatus('No GPS fix yet — start GPS first', 'warn');
      this.dashboard?._showToast('No GPS fix yet — start GPS first', '⚠️', 'warning');
      return;
    }
    const poi = pois.find(p => p.id === poiId);
    if (!poi) return;
    this.calibrationRefs = this.calibrationRefs.filter(r => r.poiId !== poiId);
    this.calibrationRefs.push({
      poiId,
      lat: this.lastGpsPosition.lat,
      lng: this.lastGpsPosition.lng,
      tileX: poi.tileX,
      tileY: poi.tileY
    });
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(this.calibrationRefs));
    this.smoothedTile = null;
    this.dashboard?.setGpsStatus(`Calibrated ${this.calibrationRefs.length}/2: ${poi.name}`, 'ok');
    this.dashboard?._showToast(`Calibration point set at ${poi.name}`, '📌', 'info');
  }

  _clearCalibration() {
    this.calibrationRefs = [];
    this.smoothedTile = null;
    localStorage.removeItem(CALIBRATION_KEY);
    this.dashboard?.setGpsStatus(
      this.geoWatchId !== null ? 'Calibration cleared — recalibrate 0/2' : 'GPS inactive',
      this.geoWatchId !== null ? 'warn' : 'idle'
    );
    this.dashboard?._showToast('GPS calibration cleared', '🔄', 'info');
  }

  _loadCalibration() {
    try { return JSON.parse(localStorage.getItem(CALIBRATION_KEY)) ?? []; }
    catch { return []; }
  }

  _centerOnSelf() {
    const cam = this.cameras.main;
    cam.stopFollow();
    const world = this.tileToWorld(this.selfPlayer.tileX, this.selfPlayer.tileY);
    const targetZoom = Math.min(3.5, cam.zoom * 1.8);
    this.tweens.add({
      targets: cam,
      zoom: targetZoom,
      duration: 350,
      ease: 'Quad.easeOut',
      onUpdate: () => cam.centerOn(this.worldOffset.x + world.x, this.worldOffset.y + world.y)
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Staff sprites (animated player sprites with name badges)
  // ═══════════════════════════════════════════════════════════════════════════

  _drawStaffSprites() {
    this._clearStaffSprites();
    STAFF_MEMBERS.forEach(member => {
      const world = this.tileToWorld(member.tileX, member.tileY);
      const wx = this.worldOffset.x + world.x;
      const wy = this.worldOffset.y + world.y;

      // Glow ring behind sprite
      const glowRing = this.add.circle(wx, wy, 14,
        parseInt(member.color.replace('#', ''), 16), 0.25
      ).setDepth(STAFF_SPRITE_D - 0.1);

      // Animated sprite (same as player sprites)
      const sprite = this.add.sprite(wx, wy, 'player-idle')
        .setOrigin(0.5, 0.88)
        .setDisplaySize(28, 28)
        .setTint(parseInt(member.color.replace('#', ''), 16))
        .setDepth(STAFF_SPRITE_D)
        .play('idle');

      // Role badge (small coloured pill above sprite)
      const roleTxt = this.add.text(wx, wy - 22, member.role, {
        fontFamily: 'Inter, Arial',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: member.color,
        padding: { x: 3, y: 1 }
      }).setOrigin(0.5, 1).setDepth(STAFF_SPRITE_D + 0.2);

      // Name label
      const nameTxt = this.add.text(wx, wy - 32, member.name.split(' ')[0], {
        fontFamily: 'Inter, Arial',
        fontSize: '8px',
        color: '#e2e8f0',
        backgroundColor: 'rgba(15,23,42,0.82)',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(STAFF_SPRITE_D + 0.1);

      // Pulse animation on the glow
      this.tweens.add({
        targets: glowRing,
        alpha: 0.05, scale: 1.5,
        duration: 1100 + Math.random() * 500,
        yoyo: true, repeat: -1,
        delay: Math.random() * 700
      });

      // Slight idle bob on sprite
      this.tweens.add({
        targets: sprite,
        y: wy - 2,
        duration: 800 + Math.random() * 400,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 600
      });

      // Click → fly to + show info
      sprite.setInteractive({ useHandCursor: true });
      sprite.on('pointerover', () => sprite.setScale(1.2));
      sprite.on('pointerout',  () => sprite.setScale(1.0));
      sprite.on('pointerdown', () => {
        this._flyToTile(member.tileX, member.tileY, true);
        this.dashboard?._showToast(`${member.name} — ${member.zone}`, '🎯');
      });

      this.staffObjs.push({ sprite, glowRing, roleTxt, nameTxt, member });
    });
  }

  _clearStaffSprites() {
    this.staffObjs.forEach(o => {
      o.glowRing?.destroy();
      o.sprite?.destroy();
      o.roleTxt?.destroy();
      o.nameTxt?.destroy();
    });
    this.staffObjs = [];
  }

  _repositionStaff() {
    this.staffObjs.forEach(o => {
      const world = this.tileToWorld(o.member.tileX, o.member.tileY);
      const wx = this.worldOffset.x + world.x;
      const wy = this.worldOffset.y + world.y;
      o.glowRing.setPosition(wx, wy);
      o.sprite.setPosition(wx, wy);
      o.roleTxt.setPosition(wx, wy - 22);
      o.nameTxt.setPosition(wx, wy - 32);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Fan dots
  // ═══════════════════════════════════════════════════════════════════════════

  _toggleFans(show) {
    this.showFans = show;
    show ? this._drawFanDots() : this._clearFanDots();
  }

  _drawFanDots() {
    this._clearFanDots();
    generateFanPositions(500).forEach(fan => {
      const world = this.tileToWorld(fan.tileX, fan.tileY);
      const dot = this.add.circle(
        this.worldOffset.x + world.x,
        this.worldOffset.y + world.y,
        3.5, 0xfbbf24, 0.7
      ).setDepth(FAN_DOT_D);
      this.fanDotObjs.push(dot);
    });
  }

  _clearFanDots() {
    this.fanDotObjs.forEach(d => d.destroy());
    this.fanDotObjs = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cluster bubbles
  // ═══════════════════════════════════════════════════════════════════════════

  _toggleClusters(show) {
    this.showClusters = show;
    show ? this._drawClusters() : this._clearClusters();
  }

  _drawClusters() {
    this._clearClusters();
    const stats = getSectionStats();
    SECTIONS.forEach(sec => {
      const s = stats[sec.id];
      if (!s) return;
      const cx = Math.round((sec.minX + sec.maxX) / 2);
      const cy = Math.round((sec.minY + sec.maxY) / 2);
      const world = this.tileToWorld(cx, cy);
      const wx = this.worldOffset.x + world.x;
      const wy = this.worldOffset.y + world.y;
      const color = s.pct > 85 ? 0xef4444 : s.pct > 60 ? 0xf59e0b : 0x3b82f6;
      const alpha = 0.18 + (s.pct / 100) * 0.28;

      const bg   = this.add.circle(wx, wy, 40, color, alpha).setDepth(CLUSTER_D);
      const ring = this.add.circle(wx, wy, 40, color, 0).setStrokeStyle(2, color, 0.6).setDepth(CLUSTER_D + 0.1);
      const cnt  = this.add.text(wx, wy - 6, `${s.count}`, {
        fontFamily: 'Inter, Arial', fontSize: '14px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5).setDepth(CLUSTER_D + 0.2);
      const lbl  = this.add.text(wx, wy + 10, sec.name.split(' ')[0], {
        fontFamily: 'Inter, Arial', fontSize: '8px', color: 'rgba(255,255,255,0.65)'
      }).setOrigin(0.5).setDepth(CLUSTER_D + 0.2);

      this.tweens.add({ targets: ring, scaleX: 1.1, scaleY: 1.1, alpha: 0.35,
        duration: 1400, yoyo: true, repeat: -1, delay: Math.random() * 500 });
      this.clusterObjs.push({ bg, ring, cnt, lbl });
    });
  }

  _clearClusters() {
    this.clusterObjs.forEach(o => {
      o.bg?.destroy(); o.ring?.destroy(); o.cnt?.destroy(); o.lbl?.destroy();
    });
    this.clusterObjs = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Heatmap
  // ═══════════════════════════════════════════════════════════════════════════

  _toggleHeatmap(show) {
    this.showHeatmap = show;
    if (show) {
      this._drawHeatmap();
    } else {
      this.heatmapGfx?.destroy();
      this.heatmapGfx = null;
    }
  }

  _drawHeatmap() {
    this.heatmapGfx?.destroy();
    const gfx   = this.add.graphics().setDepth(HEATMAP_D).setAlpha(0.36);
    const stats = getSectionStats();
    SECTIONS.forEach(sec => {
      const s = stats[sec.id];
      if (!s) return;
      const color = s.pct > 75 ? 0xdc2626 : s.pct > 50 ? 0xf97316 : s.pct > 25 ? 0xfbbf24 : 0x86efac;
      for (let ty = sec.minY; ty <= sec.maxY; ty++) {
        for (let tx = sec.minX; tx <= sec.maxX; tx++) {
          const tile = tileGrid[ty]?.[tx];
          if (tile !== 0 && tile !== 7 && tile !== 4) continue;
          const world = this.tileToWorld(tx, ty);
          const wx = this.worldOffset.x + world.x;
          const wy = this.worldOffset.y + world.y;
          gfx.fillStyle(color, 0.5);
          if (this.projectionMode === '3d') {
            const hw = ISO_TILE_WIDTH / 2, hh = ISO_TILE_HEIGHT / 2;
            gfx.fillPoints([
              { x: wx, y: wy - hh }, { x: wx + hw, y: wy },
              { x: wx, y: wy + hh }, { x: wx - hw, y: wy }
            ], true);
          } else {
            gfx.fillRect(wx - TILE_SIZE / 2, wy - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    });
    this.heatmapGfx = gfx;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Route drawing
  // ═══════════════════════════════════════════════════════════════════════════

  _drawRoute(path) {
    this.pathGraphics.clear();
    if (!path || path.length < 2) return;
    this.pathGraphics.lineStyle(3, 0x00eaff, 0.8);
    this.pathGraphics.beginPath();
    path.forEach((node, i) => {
      const world = this.tileToWorld(node.x, node.y);
      const sx = this.worldOffset.x + world.x;
      const sy = this.worldOffset.y + world.y;
      if (i === 0) this.pathGraphics.moveTo(sx, sy);
      else         this.pathGraphics.lineTo(sx, sy);
    });
    this.pathGraphics.strokePath();

    // Destination pulse
    const last = path[path.length - 1];
    const lw = this.tileToWorld(last.x, last.y);
    const lx = this.worldOffset.x + lw.x;
    const ly = this.worldOffset.y + lw.y;
    this.pathGraphics.fillStyle(0x00eaff, 0.8);
    this.pathGraphics.fillCircle(lx, ly, 6);
  }

  _routeToTile(tileX, tileY, label = 'destination') {
    const start = getNode(this.graph, this.selfPlayer.tileX, this.selfPlayer.tileY);
    const end   = getNode(this.graph, tileX, tileY);
    if (!start || !end) return;
    const path = findPath(this.graph, start, end);
    if (path) {
      this.activePath = path;
      this._drawRoute(path);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Navigation helpers
  // ═══════════════════════════════════════════════════════════════════════════

  _flyToTile(tileX, tileY, zoomIn = false) {
    const world = this.tileToWorld(tileX, tileY);
    const cam = this.cameras.main;
    cam.stopFollow();
    if (zoomIn) {
      const tz = Math.min(3.5, cam.zoom * 2);
      this.tweens.add({
        targets: cam, zoom: tz, duration: 400, ease: 'Quad.easeOut',
        onUpdate: () => cam.centerOn(this.worldOffset.x + world.x, this.worldOffset.y + world.y)
      });
    } else {
      cam.centerOn(this.worldOffset.x + world.x, this.worldOffset.y + world.y);
    }
  }

  _flyToLocationName(loc) {
    const poi = pois.find(p => p.name.toLowerCase().includes(loc.toLowerCase()));
    if (poi) { this._flyToTile(poi.tileX, poi.tileY); return; }
    const m = STAFF_MEMBERS.find(s => s.zone.toLowerCase().includes(loc.toLowerCase()));
    if (m) { this._flyToTile(m.tileX, m.tileY); return; }
    const sec = SECTIONS.find(s => s.name.toLowerCase().includes(loc.toLowerCase()));
    if (sec) this._flyToTile(
      Math.round((sec.minX + sec.maxX) / 2),
      Math.round((sec.minY + sec.maxY) / 2)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Projection helpers
  // ═══════════════════════════════════════════════════════════════════════════

  updateProjectionConfig() {
    if (this.projectionMode === '3d') {
      const { width, height, originX, minWorldX } = isoMapSize(tileGrid, this.mapRotation);
      this.isoMapWidth  = width;
      this.isoMapHeight = height;
      this.worldOffset  = { x: originX + 24, y: WALL_HEIGHT + 24 };
      this.mapLeft      = this.worldOffset.x + minWorldX;
      this.mapTop       = this.worldOffset.y - ISO_TILE_HEIGHT / 2;
    } else {
      this.isoMapWidth  = tileGrid[0].length * TILE_SIZE;
      this.isoMapHeight = tileGrid.length * TILE_SIZE;
      this.worldOffset  = { x: 24, y: 52 };
      this.mapLeft      = this.worldOffset.x;
      this.mapTop       = this.worldOffset.y;
    }
  }

  tileToWorld(tileX, tileY) {
    const r = this.projectionMode === '3d' ? this._rotateTile(tileX, tileY) : { x: tileX, y: tileY };
    if (this.projectionMode === '3d') {
      return { x: (r.x - r.y) * (ISO_TILE_WIDTH / 2), y: (r.x + r.y) * (ISO_TILE_HEIGHT / 2) };
    }
    return { x: r.x * TILE_SIZE + TILE_SIZE / 2, y: r.y * TILE_SIZE + TILE_SIZE / 2 };
  }

  _rotateTile(x, y) {
    const R = tileGrid.length, C = tileGrid[0].length;
    switch (this.mapRotation) {
      case 1: return { x: R - 1 - y, y: x };
      case 2: return { x: C - 1 - x, y: R - 1 - y };
      case 3: return { x: y, y: C - 1 - x };
      default: return { x, y };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Layout / camera
  // ═══════════════════════════════════════════════════════════════════════════

  layoutGameView() {
    const W = this.scale.width;
    const H = this.scale.height;
    const panelW  = 360;
    const topBar  = 40;
    const botBar  = 44;
    const gameW   = W - panelW;
    const gameH   = H - topBar - botBar;

    const pad = 32;
    const containZoom = Math.min(
      (gameW - pad * 2) / this.isoMapWidth,
      (gameH - pad) / this.isoMapHeight
    );
    this.minZoom = 0.45;
    const zoom = Math.min(containZoom, 1.15);

    this.cameras.main.setViewport(0, topBar, gameW, gameH);
    this.cameras.main.setZoom(Math.max(this.minZoom, zoom));
    this.cameras.main.setBounds(
      this.mapLeft, this.mapTop - 20,
      this.isoMapWidth, this.isoMapHeight + 20
    );
    this.cameras.main.centerOn(
      this.mapLeft + this.isoMapWidth / 2,
      this.mapTop  + this.isoMapHeight / 2
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Projection toggle / rotate
  // ═══════════════════════════════════════════════════════════════════════════

  _toggleProjection() {
    this.projectionMode = this.projectionMode === '3d' ? '2d' : '3d';
    if (this._toggleBtn) this._toggleBtn.textContent = this.projectionMode === '3d' ? 'Switch to 2D' : 'Switch to 3D';
    if (this._rotateBtn) this._rotateBtn.style.display = this.projectionMode === '3d' ? 'block' : 'none';
    this.updateProjectionConfig();
    this._redrawAll();
    this.layoutGameView();
  }

  _rotateMap() {
    if (this.projectionMode !== '3d') return;
    this.mapRotation = (this.mapRotation + 1) % 4;
    this.updateProjectionConfig();
    this._redrawAll();
    this.layoutGameView();
  }

  _redrawAll() {
    this._drawMap();
    this._drawFieldMarkings();
    this._drawPois();
    this._drawStaffSprites();
    if (this.showFans) { this._clearFanDots(); this._drawFanDots(); }
    if (this.showClusters) this._drawClusters();
    if (this.showHeatmap) this._drawHeatmap();
    // Reposition self-player
    if (this.selfPlayer) this.selfPlayer.reset(this.selfPlayer.tileX, this.selfPlayer.tileY);
    // Redraw route
    if (this.activePath) this._drawRoute(this.activePath);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Map buttons
  // ═══════════════════════════════════════════════════════════════════════════

  _createMapButtons() {
    const style = {
      position: 'fixed', zIndex: '1200',
      background: '#1e293b', color: '#f8fafc',
      border: '1px solid #475569', padding: '7px 12px',
      borderRadius: '6px', fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px', fontWeight: '600', cursor: 'pointer',
      boxShadow: '0 4px 6px -1px rgb(0 0 0/0.2)'
    };
    const make = (id, text, top, right, cb) => {
      const btn = document.createElement('button');
      btn.id = id; btn.textContent = text;
      Object.assign(btn.style, style, { top, right });
      btn.addEventListener('click', cb);
      document.body.appendChild(btn);
      return btn;
    };

    // GPS, Center Me, and calibration now live in the dashboard sidebar (Map tab).
    this._toggleBtn = make('sp-proj-btn',   'Switch to 2D', '48px', '370px', () => this._toggleProjection());
    this._rotateBtn = make('sp-rotate-btn', '↻ Rotate Map', '48px', '478px', () => this._rotateMap());
  }

  _removeMapButtons() {
    this._toggleBtn?.remove();
    this._rotateBtn?.remove();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Interactions (drag pan + pinch zoom + mouse wheel)
  // ═══════════════════════════════════════════════════════════════════════════

  _setupInteractions() {
    const cam = this.cameras.main;
    let isDragging = false, dragSX = 0, dragSY = 0, camSX = 0, camSY = 0, lastDist = 0;

    this.input.on('pointerdown', ptr => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) return;
      isDragging = true;
      dragSX = ptr.x; dragSY = ptr.y;
      camSX = cam.scrollX; camSY = cam.scrollY;
    });

    this.input.on('pointermove', ptr => {
      // Pinch
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        isDragging = false;
        const p1 = this.input.pointer1, p2 = this.input.pointer2;
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (lastDist > 0) {
          const dz = (dist - lastDist) * 0.004;
          cam.setZoom(Phaser.Math.Clamp(cam.zoom + dz, this.minZoom, 6));
        }
        lastDist = dist; return;
      }
      lastDist = 0;
      if (!isDragging || !ptr.isDown) return;
      cam.scrollX = camSX - (ptr.x - dragSX) / cam.zoom;
      cam.scrollY = camSY - (ptr.y - dragSY) / cam.zoom;
    });

    this.input.on('pointerup', () => { isDragging = false; lastDist = 0; });

    this.input.on('wheel', (ptr, objs, dx, dy) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, this.minZoom, 6));
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Seat structure
  // ═══════════════════════════════════════════════════════════════════════════

  _initSeats() {
    const seatingPois = pois.filter(p => p.type === 'seat');
    const byPoi = new Map();
    seatingPois.forEach(p => byPoi.set(p.id, []));

    tileGrid.forEach((row, y) => row.forEach((tile, x) => {
      if (tile !== 2) return;
      let best = null, bestD = Infinity;
      seatingPois.forEach(p => {
        const d = Math.hypot(x - p.tileX, y - p.tileY);
        if (d < bestD) { bestD = d; best = p; }
      });
      if (best && bestD < 15) byPoi.get(best.id).push({ x, y });
    }));

    this.activeSeatsSet = new Set();
    let placed = 0;
    for (const coords of byPoi.values()) {
      for (const c of coords) {
        if (placed >= 4700) break;
        this.activeSeatsSet.add(`${c.x},${c.y}`);
        placed++;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Map rendering
  // ═══════════════════════════════════════════════════════════════════════════

  _drawMap() {
    this._clearRenderedTiles();
    this._updateViewportCulling(true);
  }

  _clearRenderedTiles() {
    this.decorativeDetails.forEach(d => d.destroy());
    this.decorativeDetails = [];
    for (const obj of this.renderedTilesMap.values()) obj?.destroy();
    this.renderedTilesMap.clear();
    if (this.mapTilesGroup) this.mapTilesGroup.clear(true, true);
    else this.mapTilesGroup = this.add.group();
  }

  _updateViewportCulling(force = false) {
    const cam    = this.cameras.main;
    const bounds = cam.worldView;
    const pad    = 350;
    const det    = this.detailManager?.getCurrentLevel() || DETAIL_LEVELS.MEDIUM;

    tileGrid.forEach((row, y) => row.forEach((tile, x) => {
      const world = this.tileToWorld(x, y);
      const wx = this.worldOffset.x + world.x;
      const wy = this.worldOffset.y + world.y;
      const vis = wx >= bounds.x - pad && wx <= bounds.right + pad &&
                  wy >= bounds.y - pad && wy <= bounds.bottom + pad;
      const key = `${x},${y}`;
      const isR = this.renderedTilesMap.has(key);

      if (vis) {
        if (!isR || force) {
          if (isR) { this.renderedTilesMap.get(key)?.destroy(); }
          const img = this._drawTile(x, y, tile, wx, wy, det);
          if (img) { this.renderedTilesMap.set(key, img); this.mapTilesGroup.add(img); }
        }
      } else if (isR) {
        this.renderedTilesMap.get(key)?.destroy();
        this.renderedTilesMap.delete(key);
      }
    }));
  }

  _drawTile(x, y, tile, worldX, worldY, detailLevel) {
    const r = this.projectionMode === '3d' ? this._rotateTile(x, y) : { x, y };
    const depth = r.x + r.y;

    if (this.projectionMode === '3d') {
      if (tile === 0) return this.add.image(worldX, worldY, 'tile-floor').setOrigin(0.5).setDepth(depth);
      if (tile === 3) return this.add.image(worldX, worldY, 'tile-field').setOrigin(0.5).setDepth(depth);
      if (tile === 2) {
        if (this.activeSeatsSet?.has(`${x},${y}`)) {
          const k = seatVariantKey(x, y);
          return this.add.image(worldX, worldY + ISO_TILE_HEIGHT / 2, `${k}-${this.mapRotation || 0}`)
            .setOrigin(0.5, 1).setDepth(depth);
        }
        return this.add.image(worldX, worldY, 'tile-floor').setOrigin(0.5).setDepth(depth);
      }
      if (tile === 1) return this.add.image(worldX, worldY + ISO_TILE_HEIGHT / 2, `tile-wall-${this.mapRotation || 0}`).setOrigin(0.5, 1).setDepth(depth);
      if (tile === 4) return this.add.image(worldX, worldY, 'tile-parking').setOrigin(0.5).setDepth(depth);
      if (tile === 5) return this.add.image(worldX, worldY, 'tile-grass').setOrigin(0.5).setDepth(depth);
      if (tile === 6) return this.add.image(worldX, worldY, 'tile-tree').setOrigin(0.5).setDepth(depth);
      if (tile === 7) return this.add.image(worldX, worldY, 'tile-road').setOrigin(0.5).setDepth(depth);
    } else {
      if (tile === 0) return this.add.image(worldX, worldY, 'tile-floor-2d').setOrigin(0.5).setDepth(0);
      if (tile === 3) return this.add.image(worldX, worldY, 'tile-field-2d').setOrigin(0.5).setDepth(0);
      if (tile === 2) return this.add.image(worldX, worldY, 'tile-floor-2d').setOrigin(0.5).setDepth(0);
      if (tile === 1) return this.add.image(worldX, worldY, 'tile-wall-2d').setOrigin(0.5).setDepth(2);
      if (tile === 4) return this.add.image(worldX, worldY, 'tile-parking-2d').setOrigin(0.5).setDepth(0);
      if (tile === 5) return this.add.image(worldX, worldY, 'tile-grass-2d').setOrigin(0.5).setDepth(0);
      if (tile === 7) return this.add.image(worldX, worldY, 'tile-road-2d').setOrigin(0.5).setDepth(0);
    }
    return null;
  }

  _drawFieldMarkings() {
    if (this.fieldGfx) this.fieldGfx.clear();
    else this.fieldGfx = this.add.graphics().setDepth(FIELD_MARKINGS_D);

    const fieldTiles = [];
    tileGrid.forEach((row, y) => row.forEach((tile, x) => {
      if (tile === 3) {
        const r = this.projectionMode === '3d' ? this._rotateTile(x, y) : { x, y };
        fieldTiles.push(r);
      }
    }));
    if (!fieldTiles.length) return;

    const minX = Math.min(...fieldTiles.map(t => t.x));
    const maxX = Math.max(...fieldTiles.map(t => t.x));
    const minY = Math.min(...fieldTiles.map(t => t.y));
    const maxY = Math.max(...fieldTiles.map(t => t.y));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2;

    const g = this.fieldGfx;
    g.lineStyle(2, 0xffffff, 0.5);

    if (this.projectionMode === '3d') {
      const toS = (rx, ry) => ({
        x: this.worldOffset.x + (rx - ry) * (ISO_TILE_WIDTH / 2),
        y: this.worldOffset.y + (rx + ry) * (ISO_TILE_HEIGHT / 2)
      });
      const strokeLoop = (pts, closed) => {
        const sp = pts.map(([tx, ty]) => toS(tx, ty));
        g.beginPath(); g.moveTo(sp[0].x, sp[0].y);
        sp.slice(1).forEach(p => g.lineTo(p.x, p.y));
        if (closed) g.closePath();
        g.strokePath();
      };
      strokeLoop([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]], true);
      strokeLoop([[cx, minY], [cx, maxY]], false);
      const r = Math.min(halfW, halfH) * 0.35;
      const circ = Array.from({ length: 33 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      });
      strokeLoop(circ, true);
      const ctr = toS(cx, cy);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(ctr.x, ctr.y, 2.5);
    } else {
      const toS = (tx, ty) => {
        const w = this.tileToWorld(tx, ty);
        return { x: this.worldOffset.x + w.x, y: this.worldOffset.y + w.y };
      };
      const pMin = toS(minX - 0.5, minY - 0.5);
      const pMax = toS(maxX + 0.5, maxY + 0.5);
      const pCtr = toS(cx, cy);
      g.strokeRect(pMin.x, pMin.y, pMax.x - pMin.x, pMax.y - pMin.y);
      g.lineBetween(pCtr.x, pMin.y, pCtr.x, pMax.y);
      const rX = (maxX - minX) * TILE_SIZE * 0.35 / 2;
      g.strokeCircle(pCtr.x, pCtr.y, rX);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(pCtr.x, pCtr.y, 2.5);
    }
  }

  _drawPois() {
    if (this.poiObjects) this.poiObjects.forEach(o => {
      o.outerBg?.destroy(); o.bg?.destroy(); o.icon?.destroy(); o.nameLabel?.destroy();
    });
    this.poiObjects = [];
    const iconKeys = {
      gate: 'icon-gate', seat: 'icon-seat', food: 'icon-food',
      restroom: 'icon-restroom', medical: 'icon-medical', merch: 'icon-merch'
    };
    pois.forEach(poi => {
      const world = this.tileToWorld(poi.tileX, poi.tileY);
      const x = this.worldOffset.x + world.x;
      const y = this.worldOffset.y + world.y;
      const r = this.projectionMode === '3d' ? this._rotateTile(poi.tileX, poi.tileY) : { x: poi.tileX, y: poi.tileY };
      const d = this.projectionMode === '3d' ? (r.x + r.y) : 10;
      const outerBg   = this.add.circle(x, y, 14, 0xffffff, 0.12).setDepth(d + 0.1);
      const bg        = this.add.circle(x, y, 10, POI_COLORS[poi.type], 1).setDepth(d + 0.2);
      const icon      = this.add.image(x, y - 1, iconKeys[poi.type] ?? 'icon-gate')
        .setOrigin(0.5).setDisplaySize(14, 14).setDepth(d + 0.3);
      const nameLabel = this.add.text(x, y + 14, poi.name, {
        fontFamily: 'Inter, Arial', fontSize: '8px', color: '#fff',
        backgroundColor: 'rgba(15,23,42,0.8)', padding: { x: 3, y: 2 }
      }).setOrigin(0.5, 0).setDepth(d + 0.4);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this._flyToTile(poi.tileX, poi.tileY);
        this.pathGraphics.clear();
        this._routeToTile(poi.tileX, poi.tileY, poi.name);
      });
      this.poiObjects.push({ outerBg, bg, icon, nameLabel });
    });
  }
}
