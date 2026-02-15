import Phaser from 'phaser';

export default class Link extends Phaser.GameObjects.Graphics {
    constructor(scene, nodeA, nodeB, isCongested = false) {
        super(scene);
        this.scene = scene;
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.isCongested = isCongested;
        this._isActive = false;

        scene.add.existing(this);
        this.setDepth(1);
        this.draw();

        // Animated dashes for congested links
        if (this.isCongested) {
            this._dashOffset = 0;
            this.scene.events.on('update', this._animateDash, this);
        }
    }

    draw() {
        this.clear();
        const baseColor = this.isCongested ? 0xff44aa : 0x1a3355;
        const baseAlpha = this.isCongested ? 0.5 : 0.5;
        const baseWidth = this.isCongested ? 3 : 2;

        this.lineStyle(baseWidth, baseColor, baseAlpha);

        if (this.isCongested) {
            this._drawDashedLine(this.nodeA.x, this.nodeA.y, this.nodeB.x, this.nodeB.y, 10, 6);
        } else {
            this.beginPath();
            this.moveTo(this.nodeA.x, this.nodeA.y);
            this.lineTo(this.nodeB.x, this.nodeB.y);
            this.strokePath();
        }

        // Direction arrow at midpoint
        this._drawMidpointArrow(baseColor, baseAlpha);
    }

    _drawDashedLine(x1, y1, x2, y2, dashLen, gapLen) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        let drawn = this._dashOffset || 0;

        this.beginPath();
        while (drawn < len) {
            const sx = x1 + ux * drawn;
            const sy = y1 + uy * drawn;
            const ex = Math.min(drawn + dashLen, len);
            const endX = x1 + ux * ex;
            const endY = y1 + uy * ex;
            this.moveTo(sx, sy);
            this.lineTo(endX, endY);
            drawn = ex + gapLen;
        }
        this.strokePath();
    }

    _drawMidpointArrow(color, alpha) {
        // small circle at midpoint
        const mx = (this.nodeA.x + this.nodeB.x) / 2;
        const my = (this.nodeA.y + this.nodeB.y) / 2;
        this.fillStyle(color, alpha * 0.8);
        this.fillCircle(mx, my, 3);
    }

    _animateDash() {
        this._dashOffset = (this._dashOffset + 0.3) % 16;
        this.draw();
    }

    highlight(active = true) {
        this._isActive = active;
        this.clear();

        if (active) {
            // Glowing active line
            this.lineStyle(4, 0x00ffcc, 0.2);
            this.beginPath();
            this.moveTo(this.nodeA.x, this.nodeA.y);
            this.lineTo(this.nodeB.x, this.nodeB.y);
            this.strokePath();

            this.lineStyle(2, 0x00ffcc, 0.9);
            this.beginPath();
            this.moveTo(this.nodeA.x, this.nodeA.y);
            this.lineTo(this.nodeB.x, this.nodeB.y);
            this.strokePath();
        } else {
            this.draw();
        }
    }

    getCost() {
        return this.isCongested ? 2.0 : 1.0;
    }

    destroy() {
        if (this.isCongested) {
            this.scene.events.off('update', this._animateDash, this);
        }
        super.destroy();
    }
}
