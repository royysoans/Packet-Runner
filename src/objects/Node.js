import Phaser from 'phaser';

export default class Node extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type = 'router', id, label = '') {
        super(scene, x, y);
        this.scene = scene;
        this.type = type;
        this.id = id;
        this.label = label;
        this.neighbors = [];
        this.neighborLinks = new Map(); // nodeId -> Link reference
        this.powerup = null;
        this.isBlocked = false;
        this.isBurnedOut = false;
        this._firewallTimer = null;

        scene.add.existing(this);
        this.setDepth(10);

        this._buildVisuals();
        this._setupInteraction();

        // Firewall toggle
        if (this.type === 'firewall') {
            this.isBlocked = false;
            this._firewallTimer = this.scene.time.addEvent({
                delay: 2500,
                callback: () => {
                    this.isBlocked = !this.isBlocked;
                    this._updateVisuals();
                },
                loop: true,
            });
        }
    }

    // ── Colors per type ──
    static COLORS = {
        source: { fill: 0x00ccff, glow: 0x00ccff },
        router: { fill: 0x00aaff, glow: 0x0077cc },
        switch: { fill: 0x44ddff, glow: 0x2299cc },
        server: { fill: 0x00ff88, glow: 0x00cc66 },
        firewall: { fill: 0xffaa00, glow: 0xcc7700 },
        'firewall-blocked': { fill: 0xff3333, glow: 0xcc0000 },
        malware: { fill: 0xff0044, glow: 0xcc0033 },
        loadbalancer: { fill: 0xcc66ff, glow: 0x9933cc },
        vpn: { fill: 0x00ffcc, glow: 0x00cc99 },
        honeypot: { fill: 0xff5533, glow: 0xcc3311 },
        cache: { fill: 0x33eeff, glow: 0x00aacc },
        'cache-burned': { fill: 0x556677, glow: 0x334455 },
    };

    static RADIUS = {
        source: 22,
        server: 24,
        firewall: 18,
        router: 16,
        switch: 16,
        loadbalancer: 20,
        vpn: 18,
        malware: 16,
        honeypot: 18,
        cache: 18,
    };

    static SHAPES = {
        source: 'diamond',
        router: 'circle',
        switch: 'circle',
        server: 'hexagon',
        firewall: 'square',
        loadbalancer: 'circle',
        vpn: 'circle',
        malware: 'circle',
        honeypot: 'hexagon',
        cache: 'square',
    };

    _getColor() {
        if (this.type === 'firewall' && this.isBlocked) return Node.COLORS['firewall-blocked'];
        if (this.type === 'cache' && this.isBurnedOut) return Node.COLORS['cache-burned'];
        return Node.COLORS[this.type] || Node.COLORS.router;
    }

    _getRadius() {
        return Node.RADIUS[this.type] || 16;
    }

    _buildVisuals() {
        const r = this._getRadius();
        const { fill, glow } = this._getColor();
        const shape = Node.SHAPES[this.type] || 'circle';

        // Glow layer (outer)
        this._glowGfx = this.scene.add.graphics();
        this._drawShape(this._glowGfx, shape, r + 8, glow, 0.15);
        this.add(this._glowGfx);

        // Main shape
        this._mainGfx = this.scene.add.graphics();
        this._drawShape(this._mainGfx, shape, r, fill, 0.9);
        this.add(this._mainGfx);

        // Inner highlight
        this._innerGfx = this.scene.add.graphics();
        this._drawShape(this._innerGfx, shape, r * 0.5, 0xffffff, 0.12);
        this.add(this._innerGfx);

        // Pulsing glow animation
        this.scene.tweens.add({
            targets: this._glowGfx,
            scaleX: 1.25,
            scaleY: 1.25,
            alpha: 0.6,
            duration: 1800 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Label below node
        this._labelText = this.scene.add.text(0, r + 14, this.label, {
            fontFamily: '"Courier New", monospace',
            fontSize: '11px',
            color: '#4488aa',
            align: 'center',
        }).setOrigin(0.5, 0);
        this.add(this._labelText);

        // Type icon text (single char)
        const icon = this._getIcon();
        this._iconText = this.scene.add.text(0, 0, icon, {
            fontFamily: '"Courier New", monospace',
            fontSize: `${Math.max(12, r * 0.8)}px`,
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5).setAlpha(0.8);
        this.add(this._iconText);
    }

    _getIcon() {
        switch (this.type) {
            case 'source': return '◈';
            case 'router': return 'R';
            case 'switch': return 'S';
            case 'server': return '▣';
            case 'firewall': return this.isBlocked ? '✕' : '⊞';
            case 'loadbalancer': return '⇔';
            case 'vpn': return '⊡';
            case 'honeypot': return '⛨';
            case 'cache': return this.isBurnedOut ? '✕' : '⛁';
            default: return '●';
        }
    }

    _drawShape(gfx, shape, radius, color, alpha) {
        gfx.clear();
        gfx.fillStyle(color, alpha);
        switch (shape) {
            case 'circle':
                gfx.fillCircle(0, 0, radius);
                break;
            case 'square':
                gfx.fillRect(-radius, -radius, radius * 2, radius * 2);
                break;
            case 'diamond':
                gfx.beginPath();
                gfx.moveTo(0, -radius);
                gfx.lineTo(radius, 0);
                gfx.lineTo(0, radius);
                gfx.lineTo(-radius, 0);
                gfx.closePath();
                gfx.fillPath();
                break;
            case 'hexagon': {
                gfx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const hx = Math.cos(angle) * radius;
                    const hy = Math.sin(angle) * radius;
                    if (i === 0) gfx.moveTo(hx, hy);
                    else gfx.lineTo(hx, hy);
                }
                gfx.closePath();
                gfx.fillPath();
                break;
            }
        }
    }

    _updateVisuals() {
        const r = this._getRadius();
        const { fill, glow } = this._getColor();
        const shape = Node.SHAPES[this.type] || 'circle';

        this._drawShape(this._glowGfx, shape, r + 8, glow, 0.15);
        this._drawShape(this._mainGfx, shape, r, fill, 0.9);
        this._drawShape(this._innerGfx, shape, r * 0.5, 0xffffff, 0.12);
        this._iconText.setText(this._getIcon());
    }

    burnOut() {
        this.isBurnedOut = true;
        this._updateVisuals();
    }

    _setupInteraction() {
        const r = this._getRadius();
        this.setSize(r * 2.5, r * 2.5);
        this.setInteractive({ useHandCursor: true });

        // Tooltip
        this._tooltip = null;

        this.on('pointerover', () => {
            if (this._tooltip) this._tooltip.destroy();
            const desc = this._getDescription();
            this._tooltip = this.scene.add.text(this.x, this.y - this._getRadius() - 30, desc, {
                fontFamily: '"Courier New", monospace',
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: '#0d1b2a',
                padding: { x: 10, y: 6 },
                align: 'center',
            }).setOrigin(0.5, 1).setDepth(100);

            // Highlight
            this._mainGfx.setAlpha(1);
            this._labelText.setColor('#ffffff');
        });

        this.on('pointerout', () => {
            if (this._tooltip) {
                this._tooltip.destroy();
                this._tooltip = null;
            }
            this._mainGfx.setAlpha(0.9);
            this._labelText.setColor('#4488aa');
        });
    }

    _getDescription() {
        switch (this.type) {
            case 'source': return `[SOURCE] ${this.label}\nPacket origin point`;
            case 'router': return `[ROUTER] ${this.label}\n🧭 Shows best route to server`;
            case 'switch': return `[SWITCH] ${this.label}\n⚡ Fast L2 forwarding — low TTL cost`;
            case 'server': return `[SERVER] ${this.label}\n🎯 Destination — deliver the packet here!`;
            case 'firewall': return `[FIREWALL] ${this.label}\n${this.isBlocked ? '🔒 BLOCKED — wait for it to open' : '🔓 OPEN — pass through now!'}`;
            case 'loadbalancer': return `[LOAD BALANCER] ${this.label}\n🎲 WARNING: Redirects you randomly!`;
            case 'vpn': return `[VPN TUNNEL] ${this.label}\n🔐 Auto-grants encryption shield`;
            case 'honeypot': return `[HONEYPOT] ${this.label}\n🪤 Lures all active malware for 5s on visit!`;
            case 'cache': return `[CACHE] ${this.label}\n💾 ${this.isBurnedOut ? 'BURNED OUT — no longer active' : 'Restores +20 TTL on visit (single-use)'}`;
            default: return this.label;
        }
    }

    // ── Powerup visuals ──
    setPowerup(type) {
        this.powerup = type;
        if (this._puGfx) this._puGfx.destroy();
        if (this._puText) this._puText.destroy();
        if (this._puTween) this._puTween.remove();

        const r = this._getRadius();
        const color = type === 'shield' ? 0x00ffff : 0xffff00;
        const icon = type === 'shield' ? '🛡' : '⏱';

        this._puGfx = this.scene.add.graphics();
        this._puGfx.fillStyle(color, 0.8);
        this._puGfx.fillCircle(0, 0, 8);
        this._puGfx.setPosition(r + 6, -r - 6);
        this.add(this._puGfx);

        this._puText = this.scene.add.text(r + 6, -r - 6, icon, {
            fontSize: '12px',
        }).setOrigin(0.5);
        this.add(this._puText);

        this._puTween = this.scene.tweens.add({
            targets: [this._puGfx],
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.4,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });
    }

    clearPowerup() {
        this.powerup = null;
        if (this._puGfx) { this._puGfx.destroy(); this._puGfx = null; }
        if (this._puText) { this._puText.destroy(); this._puText = null; }
        if (this._puTween) { this._puTween.remove(); this._puTween = null; }
    }

    addNeighbor(node) {
        if (!this.neighbors.includes(node)) {
            this.neighbors.push(node);
        }
    }

    destroy() {
        if (this._firewallTimer) this._firewallTimer.remove();
        if (this._tooltip) this._tooltip.destroy();
        super.destroy();
    }
}
