/**
 * Zoom Detail Manager
 * 
 * Manages Level of Detail (LOD) rendering based on camera zoom level
 * Shows simplified graphics when zoomed out, detailed sprites when zoomed in
 */

import { getDetailLevel } from '../assets/spriteExtractor.js';

/**
 * Zoom thresholds for detail levels
 */
export const ZOOM_THRESHOLDS = {
  LOW: 0.6,      // Below this: use low-detail simplified graphics
  MEDIUM: 1.5,   // Below this: use medium detail (original tiles)
  HIGH: 1.5      // Above this: use high detail (individual seats, people, furniture)
};

/**
 * Detail level enumeration
 */
export const DETAIL_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export class ZoomDetailManager {
  constructor(scene) {
    this.scene = scene;
    this.currentDetailLevel = DETAIL_LEVELS.MEDIUM;
    this.detailGroups = {
      low: null,
      medium: null,
      high: null
    };
    
    // Track which objects are in which detail level
    this.objectRegistry = new Map();
  }

  /**
   * Initialize detail level groups
   */
  initialize() {
    this.detailGroups.low = this.scene.add.group();
    this.detailGroups.medium = this.scene.add.group();
    this.detailGroups.high = this.scene.add.group();
    
    // Start with medium detail visible
    this.setDetailLevel(DETAIL_LEVELS.MEDIUM);
  }

  /**
   * Update detail level based on zoom
   * @param {number} zoom - Current camera zoom level
   * @returns {boolean} True if detail level changed
   */
  updateForZoom(zoom) {
    const newLevel = this.getDetailLevelForZoom(zoom);
    
    if (newLevel !== this.currentDetailLevel) {
      this.setDetailLevel(newLevel);
      return true;
    }
    
    return false;
  }

  /**
   * Determine detail level for given zoom
   * @param {number} zoom - Zoom level
   * @returns {string} Detail level
   */
  getDetailLevelForZoom(zoom) {
    return getDetailLevel(zoom);
  }

  /**
   * Set active detail level (hide others)
   * @param {string} level - Detail level to show
   */
  setDetailLevel(level) {
    // Hide all groups
    Object.values(this.detailGroups).forEach(group => {
      if (group) group.setVisible(false);
    });
    
    // Show selected level
    if (this.detailGroups[level]) {
      this.detailGroups[level].setVisible(true);
    }
    
    this.currentDetailLevel = level;
    
    // Emit event for other systems to react
    this.scene.events.emit('detail-level-changed', level);
  }

  /**
   * Register an object across multiple detail levels
   * @param {string} id - Unique identifier for this object
   * @param {Object} variants - Object with low, medium, high Phaser game objects
   */
  registerObject(id, variants) {
    // Add objects to appropriate groups
    if (variants.low && this.detailGroups.low) {
      this.detailGroups.low.add(variants.low);
    }
    if (variants.medium && this.detailGroups.medium) {
      this.detailGroups.medium.add(variants.medium);
    }
    if (variants.high && this.detailGroups.high) {
      this.detailGroups.high.add(variants.high);
    }
    
    this.objectRegistry.set(id, variants);
  }

  /**
   * Remove a registered object
   * @param {string} id - Object identifier
   */
  removeObject(id) {
    const variants = this.objectRegistry.get(id);
    if (!variants) return;
    
    // Destroy all variants
    Object.values(variants).forEach(obj => {
      if (obj && obj.destroy) {
        obj.destroy();
      }
    });
    
    this.objectRegistry.delete(id);
  }

  /**
   * Clear all registered objects
   */
  clearAll() {
    this.objectRegistry.forEach((variants, id) => {
      this.removeObject(id);
    });
    this.objectRegistry.clear();
  }

  /**
   * Get current detail level
   * @returns {string} Current detail level
   */
  getCurrentLevel() {
    return this.currentDetailLevel;
  }

  /**
   * Check if currently at high detail (individual seats visible)
   * @returns {boolean}
   */
  isHighDetail() {
    return this.currentDetailLevel === DETAIL_LEVELS.HIGH;
  }

  /**
   * Destroy the manager and clean up
   */
  destroy() {
    this.clearAll();
    
    Object.values(this.detailGroups).forEach(group => {
      if (group) group.destroy(true);
    });
    
    this.detailGroups = {};
    this.objectRegistry.clear();
  }
}

/**
 * Helper to create seat row with detail variants
 * @param {Phaser.Scene} scene - The scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} count - Number of seats in row
 * @param {Array} detailedSeatSprites - Array of detailed seat sprite keys
 * @returns {Object} Variants object with low/medium/high detail game objects
 */
export function createSeatRowVariants(scene, x, y, count, detailedSeatSprites) {
  const variants = {};
  
  // Low detail: single colored rectangle representing the row
  const lowDetailGraphics = scene.add.graphics();
  lowDetailGraphics.fillStyle(0x4aa3df, 1);
  lowDetailGraphics.fillRect(x, y, count * 8, 4);
  lowDetailGraphics.setPosition(0, 0);
  variants.low = lowDetailGraphics;
  
  // Medium detail: simplified seat icons
  const mediumDetailContainer = scene.add.container(x, y);
  for (let i = 0; i < count; i++) {
    const seatGraphics = scene.add.graphics();
    seatGraphics.fillStyle(0x4aa3df, 1);
    seatGraphics.fillRoundedRect(i * 8, 0, 6, 6, 1);
    seatGraphics.fillStyle(0xffffff, 0.3);
    seatGraphics.fillRect(i * 8 + 1, 1, 4, 1);
    mediumDetailContainer.add(seatGraphics);
  }
  variants.medium = mediumDetailContainer;
  
  // High detail: individual seat sprites with people
  const highDetailContainer = scene.add.container(x, y);
  for (let i = 0; i < count; i++) {
    // Randomly select occupied or empty seat
    const isOccupied = Math.random() > 0.3;
    const spriteKey = isOccupied 
      ? detailedSeatSprites[1 + Math.floor(Math.random() * 3)] // occupied variants
      : detailedSeatSprites[0]; // empty seat
    
    if (scene.textures.exists(spriteKey)) {
      const seat = scene.add.image(i * 16, 0, spriteKey);
      seat.setOrigin(0, 0);
      highDetailContainer.add(seat);
    }
  }
  variants.high = highDetailContainer;
  
  return variants;
}
