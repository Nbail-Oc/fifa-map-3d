import { TILE_SIZE, isWalkable, tileToWorld } from '../map/mockStadiumMap.js';

export default class Player {
  constructor(scene, tileX, tileY) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.isMoving = false;
    this.isAutoWalking = false;

    const world = this.scene.tileToWorld(tileX, tileY);
    this.sprite = scene.add.sprite(world.x + this.scene.worldOffset.x, world.y + this.scene.worldOffset.y, 'player-idle')
      .setOrigin(0.5, 0.88)
      .setDisplaySize(32, 32)
      .setDepth(10)
      .play('idle');
  }

  get currentTile() {
    return { x: this.tileX, y: this.tileY };
  }

  tryMove(dx, dy, onArrive) {
    if (this.isMoving || this.isAutoWalking) return false;

    const nextX = this.tileX + dx;
    const nextY = this.tileY + dy;
    if (!isWalkable(nextX, nextY)) return false;

    this.moveToTile(nextX, nextY, onArrive);
    return true;
  }

  moveToTile(tileX, tileY, onArrive) {
    this.isMoving = true;
    const dx = tileX - this.tileX;
    if (dx !== 0) {
      this.sprite.setFlipX(dx < 0);
    }
    this.sprite.play('walk', true);
    const world = this.scene.tileToWorld(tileX, tileY);

    this.scene.tweens.add({
      targets: this.sprite,
      x: world.x + this.scene.worldOffset.x,
      y: world.y + this.scene.worldOffset.y,
      duration: 170,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tileX = tileX;
        this.tileY = tileY;
        this.isMoving = false;
        this.sprite.play('idle');
        onArrive?.(this.currentTile);
      }
    });
  }

  moveToApproxTile(tileX, tileY) {
    if (this.isAutoWalking) return;

    const dx = tileX - this.tileX;
    if (dx !== 0) {
      this.sprite.setFlipX(dx < 0);
    }

    this.tileX = Math.round(tileX);
    this.tileY = Math.round(tileY);
    const world = this.scene.tileToWorld(tileX, tileY);

    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.play('walk', true);
    this.scene.tweens.add({
      targets: this.sprite,
      x: world.x + this.scene.worldOffset.x,
      y: world.y + this.scene.worldOffset.y,
      duration: 450,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.sprite.play('idle');
      }
    });
  }

  autoWalk(path, onStep, onComplete) {
    if (!path || path.length === 0 || this.isAutoWalking) return;

    this.isAutoWalking = true;
    let index = 1;

    const walkNext = () => {
      if (index >= path.length) {
        this.isAutoWalking = false;
        onComplete?.();
        return;
      }

      const node = path[index];
      this.moveToTile(node.x, node.y, () => {
        onStep?.(node, index);
        index += 1;
        walkNext();
      });
    };

    walkNext();
  }

  reset(tileX, tileY) {
    this.scene.tweens.killTweensOf(this.sprite);
    this.tileX = tileX;
    this.tileY = tileY;
    this.isMoving = false;
    this.isAutoWalking = false;
    const world = this.scene.tileToWorld(tileX, tileY);
    this.sprite.setPosition(world.x + this.scene.worldOffset.x, world.y + this.scene.worldOffset.y).play('idle');
  }
}
