import Phaser from 'phaser';
import { soundEngine } from '../audio/SoundEngine';

export default class Packet extends Phaser.GameObjects.Container {
    constructor(scene, x, y, startNode) {
        super(scene, x, y);
        this.scene = scene;

        // Stats
        this.ttl = 100;
        this.integrity = 100;
        this.speed = 220;
        this.score = 0;
        this.startTime = Date.now();

        // Combo system
        this.combo = 0;
        this.comboTimer = 0;
        this.comboWindow = 2500; // ms to keep combo alive
        this.maxCombo = 0;

        // Navigation
        this.currentNode = startNode;
        this.targetNode = null;
        this.isMoving = false;
        this.isShielded = false;
        this.moveCount = 0;

        scene.add.existing(this);
        this.setDepth(20);
        this._build();
    }

    _build() {
        // Outer glow
        this._glow = this.scene.add.graphics();
        this._glow.fillStyle(0x00ffcc, 0.15);
        this._glow.fillCircle(0, 0, 18);
        this.add(this._glow);

        // Main body — diamond shape
        this._body = this.scene.add.graphics();
        this._drawBody(0x00ffcc);
        this.add(this._body);

        // Pulsing glow
        this.scene.tweens.add({
            targets: this._glow,
            scaleX: 1.6, scaleY: 1.6, alpha: 0.05,
            duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // Trail emitter
        this._trailTimer = this.scene.time.addEvent({
            delay: 50, callback: this._emitTrail, callbackScope: this, loop: true,
        });
    }

    _drawBody(color) {
        this._body.clear();
        this._body.fillStyle(color, 1);
        this._body.beginPath();
        this._body.moveTo(0, -10);
        this._body.lineTo(8, 0);
        this._body.lineTo(0, 10);
        this._body.lineTo(-8, 0);
        this._body.closePath();
        this._body.fillPath();
        this._body.fillStyle(0xffffff, 0.6);
        this._body.fillCircle(0, 0, 3);
    }

    _emitTrail() {
        if (!this.isMoving || !this.active) return;
        const color = this.combo >= 3 ? 0xffdd00 : 0x00ffcc;
        const particle = this.scene.add.circle(this.x, this.y, 3, color, 0.5);
        particle.setDepth(15);
        this.scene.tweens.add({
            targets: particle, alpha: 0, scaleX: 0.2, scaleY: 0.2,
            duration: 400, onComplete: () => particle.destroy(),
        });
    }

    moveTo(targetNode) {
        if (this.isMoving) return;
        if (!this.currentNode.neighbors.includes(targetNode)) return;

        // Firewall check
        if (targetNode.type === 'firewall' && targetNode.isBlocked) {
            soundEngine.blocked();
            this._bounceBack(targetNode);
            return;
        }

        soundEngine.move();

        // Find the link
        const link = this.scene.links.find(l =>
            (l.nodeA === this.currentNode && l.nodeB === targetNode) ||
            (l.nodeB === this.currentNode && l.nodeA === targetNode)
        );

        let speedMult = 1;
        if (link && link.isCongested) speedMult = 0.4;
        if (link) link.highlight(true);

        this.targetNode = targetNode;
        this.isMoving = true;
        this.moveCount++;

        const distance = Phaser.Math.Distance.Between(this.x, this.y, targetNode.x, targetNode.y);
        const duration = (distance / (this.speed * speedMult)) * 1000;

        // Speed lines effect during movement
        this._spawnSpeedLines();

        this.scene.tweens.add({
            targets: this, x: targetNode.x, y: targetNode.y,
            duration, ease: 'Power1',
            onComplete: () => {
                if (link) link.highlight(false);
                this._arrive(targetNode);
            },
        });

        // TTL cost — switches are cheaper (fast Layer 2 forwarding)
        let baseCost = 5;
        if (targetNode.type === 'switch') baseCost = 2;
        const cost = link ? baseCost * link.getCost() : baseCost;
        this.damageTTL(cost);
    }

    _spawnSpeedLines() {
        for (let i = 0; i < 3; i++) {
            const angle = Phaser.Math.Between(0, 360);
            const dist = Phaser.Math.Between(8, 20);
            const lx = this.x + Math.cos(angle) * dist;
            const ly = this.y + Math.sin(angle) * dist;
            const line = this.scene.add.rectangle(lx, ly, 2, Phaser.Math.Between(6, 14), 0x00ffcc, 0.4);
            line.setDepth(14);
            line.setRotation(Phaser.Math.DegToRad(angle));
            this.scene.tweens.add({
                targets: line, alpha: 0, scaleY: 2,
                duration: 250, onComplete: () => line.destroy(),
            });
        }
    }

    _bounceBack(targetNode) {
        this.scene.cameras.main.shake(80, 0.005);
        const dx = (targetNode.x - this.x) * 0.08;
        const dy = (targetNode.y - this.y) * 0.08;
        this.scene.tweens.add({
            targets: this, x: this.x + dx, y: this.y + dy,
            duration: 60, yoyo: true,
        });
        this._drawBody(0xff3333);
        this.scene.time.delayedCall(200, () => this._drawBody(0x00ffcc));
    }

    _arrive(node) {
        this.currentNode = node;
        this.targetNode = null;
        this.isMoving = false;

        soundEngine.arrive();

        // Combo logic
        const now = Date.now();
        if (now - this.comboTimer < this.comboWindow) {
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            if (this.combo >= 2) {
                soundEngine.combo(this.combo);
                this.scene.events.emit('combo', this.combo);
            }
        } else {
            this.combo = 1;
        }
        this.comboTimer = now;

        // Arrival pulse
        const pulseColor = this.combo >= 3 ? 0xffdd00 : 0x00ffcc;
        const pulseSize = this.combo >= 3 ? 6 : 4;
        for (let i = 0; i < (this.combo >= 3 ? 3 : 1); i++) {
            const pulse = this.scene.add.circle(this.x, this.y, pulseSize, pulseColor, 0.6);
            pulse.setDepth(18);
            this.scene.tweens.add({
                targets: pulse,
                scaleX: 4 + i, scaleY: 4 + i, alpha: 0,
                duration: 400 + i * 100, delay: i * 60,
                onComplete: () => pulse.destroy(),
            });
        }

        // Camera zoom punch on high combo
        if (this.combo >= 4) {
            this.scene.cameras.main.zoomTo(1.05, 80);
            this.scene.time.delayedCall(80, () => this.scene.cameras.main.zoomTo(1, 200));
        }

        this.scene.events.emit('packetArrived', node);

        // ── Node-type-specific mechanics ──
        this._handleNodeEffect(node);

        // Powerup collection
        if (node.powerup) {
            soundEngine.powerup();
            if (node.powerup === 'shield') {
                this.activateShield();
                this.scene.events.emit('showToast', '🛡  ENCRYPTION SHIELD ACTIVE!');
            } else if (node.powerup === 'ttl') {
                this.ttl = Math.min(100, this.ttl + 25);
                this.scene.events.emit('updateHUD', { ttl: this.ttl, integrity: this.integrity });
                this.scene.events.emit('showToast', '⏱  TTL RESTORED +25');
            }
            node.clearPowerup();
        }

        // Win condition
        if (node.type === 'server') {
            const elapsed = (Date.now() - this.startTime) / 1000;
            const comboBonus = this.maxCombo * 50;
            this.score = Math.floor(this.ttl * 2 + this.integrity * 2 + Math.max(0, 300 - elapsed) + comboBonus);
            soundEngine.victory();
            this.scene.events.emit('levelComplete', this.score);
        }
    }

    activateShield() {
        this.isShielded = true;
        if (this._shieldGfx) this._shieldGfx.destroy();
        this._shieldGfx = this.scene.add.graphics();
        this._shieldGfx.lineStyle(2, 0x00ffff, 0.8);
        this._shieldGfx.strokeCircle(0, 0, 18);
        this._shieldGfx.fillStyle(0x00ffff, 0.08);
        this._shieldGfx.fillCircle(0, 0, 18);
        this.add(this._shieldGfx);

        this.scene.tweens.add({
            targets: this._shieldGfx,
            alpha: { from: 0.8, to: 0.3 }, duration: 600, yoyo: true, repeat: -1,
        });

        this.scene.time.delayedCall(6000, () => {
            this.isShielded = false;
            if (this._shieldGfx) { this._shieldGfx.destroy(); this._shieldGfx = null; }
            this.scene.events.emit('showToast', '🛡  Shield Expired');
        });
    }

    damageTTL(amount) {
        this.ttl = Math.max(0, this.ttl - amount);
        this.scene.events.emit('updateHUD', { ttl: this.ttl, integrity: this.integrity });
        if (this.ttl <= 0) {
            soundEngine.gameOver();
            this.scene.events.emit('gameOver', 'TTL Expired — Packet dropped!');
        }
    }

    damageIntegrity(amount) {
        if (this.isShielded) return;
        soundEngine.damage();
        this.integrity = Math.max(0, this.integrity - amount);
        this.scene.events.emit('updateHUD', { ttl: this.ttl, integrity: this.integrity });

        // Damage flash + screen shake
        this._drawBody(0xff0000);
        this.scene.cameras.main.shake(100, 0.012);
        this.scene.time.delayedCall(150, () => this._drawBody(0x00ffcc));

        // Reset combo on damage
        this.combo = 0;
        this.scene.events.emit('combo', 0);

        if (this.integrity <= 0) {
            soundEngine.gameOver();
            this.scene.events.emit('gameOver', 'Packet Corrupted — Data lost!');
        }
    }

    // ── Node-type-specific gameplay effects ──
    _handleNodeEffect(node) {
        switch (node.type) {
            case 'switch':
                // Switches = fast local forwarding — speed boost
                this.speed *= 1.3;
                this.scene.events.emit('showToast', '⚡ SWITCH — Fast L2 forwarding!');
                // Brief visual indicator
                const flash = this.scene.add.circle(this.x, this.y, 30, 0x00ffcc, 0.3);
                flash.setDepth(6);
                this.scene.tweens.add({
                    targets: flash, scaleX: 3, scaleY: 3, alpha: 0,
                    duration: 400, onComplete: () => flash.destroy(),
                });
                // Reset speed after a delay
                this.scene.time.delayedCall(3000, () => { this.speed = 220; });
                break;

            case 'router':
                // Routers = intelligent path choice — shows direction hint
                this._showRouterHint(node);
                this.scene.events.emit('showToast', '🧭 ROUTER — Path analyzed!');
                break;

            case 'loadbalancer':
                // Load balancers = distribute traffic — random redirect
                this._handleLoadBalancerRedirect(node);
                break;

            case 'vpn':
                // VPN = encryption — auto-grants shield
                if (!this.isShielded) {
                    this.activateShield();
                    this.scene.events.emit('showToast', '🔐 VPN TUNNEL — Auto-encrypted!');
                    soundEngine.powerup();
                } else {
                    this.scene.events.emit('showToast', '🔐 VPN — Already encrypted');
                }
                break;

            default:
                break;
        }
    }

    _showRouterHint(routerNode) {
        // Find the server node
        const serverNode = this.scene.nodes.find(n => n.type === 'server');
        if (!serverNode) return;

        // Find which neighbor is closest to the server
        let bestNeighbor = null;
        let bestDist = Infinity;
        routerNode.neighbors.forEach(nb => {
            const dist = Phaser.Math.Distance.Between(nb.x, nb.y, serverNode.x, serverNode.y);
            if (dist < bestDist) { bestDist = dist; bestNeighbor = nb; }
        });

        if (!bestNeighbor) return;

        // Draw arrow pointing toward best neighbor
        const angle = Phaser.Math.Angle.Between(routerNode.x, routerNode.y, bestNeighbor.x, bestNeighbor.y);
        const arrowDist = 50;
        const ax = routerNode.x + Math.cos(angle) * arrowDist;
        const ay = routerNode.y + Math.sin(angle) * arrowDist;

        const arrow = this.scene.add.text(ax, ay, '➤', {
            fontFamily: '"Courier New", monospace', fontSize: '24px',
            color: '#44ff88',
        }).setOrigin(0.5).setRotation(angle).setDepth(80).setAlpha(0);

        const label = this.scene.add.text(ax, ay + 22, 'BEST ROUTE', {
            fontFamily: '"Courier New", monospace', fontSize: '10px',
            color: '#44ff88', backgroundColor: '#0a1628ee',
            padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(80).setAlpha(0);

        // Animate hint in and out
        this.scene.tweens.add({ targets: [arrow, label], alpha: 1, duration: 300 });
        this.scene.tweens.add({
            targets: [arrow, label], alpha: 0, duration: 500, delay: 3000,
            onComplete: () => { arrow.destroy(); label.destroy(); },
        });
    }

    _handleLoadBalancerRedirect(node) {
        const neighbors = node.neighbors;
        if (neighbors.length <= 1) {
            this.scene.events.emit('showToast', '🎲 LOAD BALANCER — Only one path');
            return;
        }

        // Pick a random neighbor (not where we came from if possible)
        const candidates = neighbors.filter(n => n !== this.currentNode);
        const target = Phaser.Utils.Array.GetRandom(candidates.length > 0 ? candidates : neighbors);

        this.scene.events.emit('showToast', `🎲 LOAD BALANCER — Redirected to ${target.label}!`);
        this.scene.cameras.main.shake(60, 0.004);
        soundEngine.alert();

        // Auto-move to random neighbor after brief delay
        this.scene.time.delayedCall(500, () => {
            if (!this._gameOver) this.moveTo(target);
        });
    }

    destroy() {
        if (this._trailTimer) this._trailTimer.remove();
        super.destroy();
    }
}
