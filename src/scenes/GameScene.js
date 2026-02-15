import Phaser from 'phaser';
import LEVELS from '../data/levels';
import Node from '../objects/Node';
import Link from '../objects/Link';
import Packet from '../objects/Packet';
import Malware from '../objects/Malware';
import { soundEngine } from '../audio/SoundEngine';

// Random network event messages — expanded with more surprises
const NETWORK_EVENTS = [
    { msg: '⚡ TRAFFIC SPIKE — Links reshuffled!', action: 'shuffleCongestion', weight: 3 },
    { msg: '🔒 FIREWALL POLICY UPDATE — Timing changed!', action: 'speedFirewall', weight: 2 },
    { msg: '🐛 WORM DETECTED — Malware speeds up!', action: 'speedMalware', weight: 2 },
    { msg: '📡 SIGNAL BOOST — Packet speed up!', action: 'boostSpeed', weight: 2 },
    { msg: '🌐 DNS RESOLUTION DELAY...', action: 'freezePacket', weight: 2 },
    { msg: '💥 EMP BURST — Labels scrambled!', action: 'empBlackout', weight: 2 },
    { msg: '☣️ PACKET CORRUPTION — Integrity draining!', action: 'corruptPacket', weight: 1 },
    { msg: '🔀 EMERGENCY ROUTE — Shortcut opened!', action: 'emergencyRoute', weight: 1 },
    { msg: '⚡ POWER SURGE — Brief invincibility!', action: 'powerSurge', weight: 1 },
    { msg: '🔥 NODE OVERLOAD — Path blocked!', action: 'nodeOverload', weight: 2 },
    { msg: '💰 BANDWIDTH BONUS — 2x score!', action: 'scoreBoost', weight: 1 },
    { msg: '🐌 LAG SPIKE — Everything slows...', action: 'lagSpike', weight: 2 },
];

// Weighted random selection
function pickWeightedEvent() {
    const totalWeight = NETWORK_EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalWeight;
    for (const event of NETWORK_EVENTS) {
        r -= event.weight;
        if (r <= 0) return event;
    }
    return NETWORK_EVENTS[0];
}

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.levelIndex = data.level || 0;
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0b0f1a');
        this.cameras.main.fadeIn(500, 0, 0, 0);

        const levelData = LEVELS[this.levelIndex];
        this._gameOver = false;

        // ── Timer — difficulty curve: level 1 = 45s, levels 5-10 plateau ~55-65s ──
        const timerTable = [45, 40, 40, 45, 50, 50, 55, 55, 60, 65];
        this.levelTime = timerTable[this.levelIndex] || 50;
        this.timeRemaining = this.levelTime;

        // ── Animated grid background ──
        const gridGfx = this.add.graphics().setDepth(0);
        gridGfx.lineStyle(1, 0x111d2e, 0.35);
        for (let x = 0; x <= width; x += 40) { gridGfx.moveTo(x, 0); gridGfx.lineTo(x, height); }
        for (let y = 0; y <= height; y += 40) { gridGfx.moveTo(0, y); gridGfx.lineTo(width, y); }
        gridGfx.strokePath();

        // ── Scanline overlay ──
        const scanGfx = this.add.graphics().setDepth(100).setAlpha(0.03);
        for (let y = 0; y < height; y += 4) {
            scanGfx.fillStyle(0x000000, 1);
            scanGfx.fillRect(0, y, width, 2);
        }

        // ── Level title ──
        const levelTitle = this.add.text(width / 2, 50, `LEVEL ${levelData.id}: ${levelData.name.toUpperCase()}`, {
            fontFamily: '"Courier New", monospace', fontSize: '16px',
            color: '#334466', letterSpacing: 4,
        }).setOrigin(0.5).setAlpha(0).setDepth(30);
        this.tweens.add({ targets: levelTitle, alpha: 0.8, y: 40, duration: 800, ease: 'Power2' });

        // ── Level title flash ──
        const sub = this.add.text(width / 2, height * 0.5, levelData.subtitle.toUpperCase(), {
            fontFamily: '"Courier New", monospace', fontSize: '28px',
            color: '#00ffcc', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0).setDepth(90);
        this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 200 });
        this.tweens.add({ targets: sub, alpha: 0, y: height * 0.45, duration: 600, delay: 1500 });

        // ── Build Level ──
        this.nodes = [];
        this.links = [];
        this.malwares = [];
        this._neighborLabels = [];
        this._overloadedNodes = new Set();
        this._scoreMultiplier = 1;
        const nodeMap = {};

        const marginX = 60, marginY = 80;
        const playW = width - marginX * 2, playH = height - marginY * 2;

        // Nodes
        levelData.nodes.forEach(nd => {
            const nx = marginX + nd.x * playW;
            const ny = marginY + nd.y * playH;
            const node = new Node(this, nx, ny, nd.type, nd.id, nd.label);
            this.nodes.push(node);
            nodeMap[nd.id] = node;
        });

        // Links
        levelData.links.forEach(ld => {
            const a = nodeMap[ld.from], b = nodeMap[ld.to];
            if (a && b) {
                const link = new Link(this, a, b, !!ld.congested);
                this.links.push(link);
                a.addNeighbor(b); b.addNeighbor(a);
                a.neighborLinks.set(b.id, link);
                b.neighborLinks.set(a.id, link);
            }
        });

        // Powerups
        if (levelData.powerups) {
            levelData.powerups.forEach(pu => {
                const node = nodeMap[pu.node];
                if (node) node.setPowerup(pu.type);
            });
        }

        // Malware
        if (levelData.malware) {
            levelData.malware.forEach(mwId => {
                const node = nodeMap[mwId];
                if (node) {
                    const mw = new Malware(this, node.x, node.y, node);
                    this.malwares.push(mw);
                }
            });
        }

        // ── Create Packet ──
        const sourceNode = this.nodes.find(n => n.type === 'source');
        this.packet = new Packet(this, sourceNode.x, sourceNode.y, sourceNode);
        this._updateNeighborLabels();

        // ── Launch UI ──
        this.scene.launch('UIScene', { levelIndex: this.levelIndex, levelTime: this.levelTime });

        // ── Mouse Input ──
        this.input.on('gameobjectdown', (pointer, gameObject) => {
            if (this._gameOver) return;
            if (gameObject instanceof Node) {
                this.packet.moveTo(gameObject);
            }
        });

        this.input.on('gameobjectover', (pointer, gameObject) => {
            if (gameObject instanceof Node && this.packet.currentNode.neighbors.includes(gameObject)) {
                const link = this.packet.currentNode.neighborLinks.get(gameObject.id);
                if (link) link.highlight(true);
            }
        });
        this.input.on('gameobjectout', (pointer, gameObject) => {
            if (gameObject instanceof Node) {
                const link = this.packet.currentNode.neighborLinks.get(gameObject.id);
                if (link && !this.packet.isMoving) link.highlight(false);
            }
        });

        // ── Keyboard Input ──
        this.input.keyboard.on('keydown', (event) => {
            if (this._gameOver) return;
            const num = parseInt(event.key);
            if (num >= 1 && num <= 9) {
                const neighbors = this.packet.currentNode.neighbors;
                if (num <= neighbors.length) {
                    this.packet.moveTo(neighbors[num - 1]);
                }
            }
        });

        // ── Update neighbor labels when packet arrives ──
        this.events.on('packetArrived', () => {
            this._updateNeighborLabels();
        });

        // ── Random Events — trigger first one early, then frequently ──
        this.time.delayedCall(Phaser.Math.Between(3000, 5000), () => {
            this._triggerRandomEvent();
        });
        this._eventTimer = this.time.addEvent({
            delay: Phaser.Math.Between(5000, 9000),
            callback: this._triggerRandomEvent,
            callbackScope: this,
            loop: true,
        });

        // ── Timer countdown ──
        this._timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this._gameOver) return;
                this.timeRemaining--;
                this.events.emit('timerUpdate', this.timeRemaining);
                if (this.timeRemaining <= 5 && this.timeRemaining > 0) {
                    soundEngine.urgentTick();
                }
                if (this.timeRemaining <= 0) {
                    soundEngine.gameOver();
                    this.events.emit('gameOver', 'Time expired — too slow!');
                }
            },
            callbackScope: this,
            loop: true,
        });

        // ── Level Complete / Game Over ──
        this.events.on('levelComplete', (score) => {
            if (this._gameOver) return;
            this._gameOver = true;
            // Apply score multiplier
            score = Math.floor(score * this._scoreMultiplier);
            this.time.delayedCall(600, () => {
                this.scene.stop('UIScene');
                this.scene.start('LevelCompleteScene', {
                    levelIndex: this.levelIndex,
                    score,
                    ttl: this.packet.ttl,
                    integrity: this.packet.integrity,
                    maxCombo: this.packet.maxCombo,
                    timeLeft: this.timeRemaining,
                });
            });
        });

        this.events.on('gameOver', (reason) => {
            if (this._gameOver) return;
            this._gameOver = true;
            this.scene.pause();
        });
    }

    _updateNeighborLabels() {
        // Clear old labels
        this._neighborLabels.forEach(lbl => lbl.destroy());
        this._neighborLabels = [];

        if (!this.packet) return;
        const neighbors = this.packet.currentNode.neighbors;
        neighbors.forEach((node, index) => {
            const label = this.add.text(node.x + 20, node.y - 25, `[${index + 1}]`, {
                fontFamily: '"Courier New", monospace',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#00ffcc',
                backgroundColor: '#0d1b2acc',
                padding: { x: 4, y: 2 },
            }).setDepth(80).setAlpha(0);

            this.tweens.add({ targets: label, alpha: 1, duration: 200, delay: index * 50 });
            this._neighborLabels.push(label);
        });
    }

    _triggerRandomEvent() {
        if (this._gameOver) return;

        const event = pickWeightedEvent();
        soundEngine.alert();
        this.events.emit('showToast', event.msg);
        this.events.emit('networkEvent', event.msg);

        switch (event.action) {
            case 'shuffleCongestion':
                this.links.forEach(link => {
                    if (Math.random() < 0.4) {
                        link.isCongested = !link.isCongested;
                        link.draw();
                    }
                });
                // Screen flash
                this.cameras.main.flash(200, 20, 40, 60, true);
                break;

            case 'speedFirewall':
                this.nodes.forEach(node => {
                    if (node.type === 'firewall' && node._firewallTimer) {
                        node._firewallTimer.delay = 1200;
                    }
                });
                this.time.delayedCall(5000, () => {
                    this.nodes.forEach(node => {
                        if (node.type === 'firewall' && node._firewallTimer) {
                            node._firewallTimer.delay = 2500;
                        }
                    });
                });
                break;

            case 'speedMalware':
                this.malwares.forEach(mw => { mw.speed = 150; });
                this.cameras.main.shake(60, 0.003);
                this.time.delayedCall(5000, () => {
                    this.malwares.forEach(mw => { mw.speed = 100; });
                });
                break;

            case 'boostSpeed':
                this.packet.speed = 350;
                this.time.delayedCall(4000, () => {
                    if (this.packet) this.packet.speed = 220;
                });
                break;

            case 'freezePacket':
                this.packet.isMoving = true;
                this.cameras.main.shake(80, 0.003);
                // Visual freeze overlay
                const freezeOverlay = this.add.rectangle(
                    this.scale.width / 2, this.scale.height / 2,
                    this.scale.width, this.scale.height, 0x0044ff, 0.08
                ).setDepth(95);
                this.time.delayedCall(1500, () => {
                    if (this.packet) this.packet.isMoving = false;
                    freezeOverlay.destroy();
                });
                break;

            case 'empBlackout': {
                // Temporarily hide all node labels and number hints
                const labels = [...this._neighborLabels];
                labels.forEach(l => l.setAlpha(0));
                this.nodes.forEach(n => {
                    if (n._labelText) n._labelText.setAlpha(0);
                });
                this.cameras.main.flash(300, 80, 0, 80, true);
                this.time.delayedCall(3000, () => {
                    labels.forEach(l => { if (l.active) l.setAlpha(1); });
                    this.nodes.forEach(n => {
                        if (n._labelText) n._labelText.setAlpha(1);
                    });
                    this.events.emit('showToast', '✅ EMP cleared — labels restored');
                });
                break;
            }

            case 'corruptPacket':
                // Gradual integrity drain
                if (!this.packet.isShielded) {
                    this.cameras.main.shake(150, 0.008);
                    const drainTimer = this.time.addEvent({
                        delay: 500,
                        callback: () => {
                            if (this.packet && !this.packet.isShielded) {
                                this.packet.integrity = Math.max(0, this.packet.integrity - 3);
                                this.events.emit('updateHUD', {
                                    ttl: this.packet.ttl,
                                    integrity: this.packet.integrity,
                                });
                            }
                        },
                        repeat: 5,
                    });
                    // Red flash warning
                    const corruptVfx = this.add.rectangle(
                        this.scale.width / 2, this.scale.height / 2,
                        this.scale.width, this.scale.height, 0xff0000, 0.06
                    ).setDepth(95);
                    this.time.delayedCall(3000, () => corruptVfx.destroy());
                } else {
                    this.events.emit('showToast', '🛡 Shield absorbed corruption!');
                }
                break;

            case 'emergencyRoute': {
                // Create a temporary shortcut link
                const nonAdjacentPairs = [];
                for (let i = 0; i < this.nodes.length; i++) {
                    for (let j = i + 1; j < this.nodes.length; j++) {
                        const a = this.nodes[i], b = this.nodes[j];
                        if (!a.neighbors.includes(b) && a.type !== 'source' && b.type !== 'source') {
                            nonAdjacentPairs.push([a, b]);
                        }
                    }
                }
                if (nonAdjacentPairs.length > 0) {
                    const [a, b] = Phaser.Utils.Array.GetRandom(nonAdjacentPairs);
                    const link = new Link(this, a, b, false);
                    link._lineGfx.setAlpha(0.6);
                    this.links.push(link);
                    a.addNeighbor(b); b.addNeighbor(a);
                    a.neighborLinks.set(b.id, link);
                    b.neighborLinks.set(a.id, link);
                    this._updateNeighborLabels();
                    // Flash the new link
                    this.tweens.add({
                        targets: link._lineGfx, alpha: { from: 0, to: 0.6 },
                        duration: 200, yoyo: true, repeat: 3,
                    });
                    // Remove after 8 seconds
                    this.time.delayedCall(8000, () => {
                        a.neighbors = a.neighbors.filter(n => n !== b);
                        b.neighbors = b.neighbors.filter(n => n !== a);
                        a.neighborLinks.delete(b.id);
                        b.neighborLinks.delete(a.id);
                        const idx = this.links.indexOf(link);
                        if (idx > -1) this.links.splice(idx, 1);
                        link.destroy();
                        this._updateNeighborLabels();
                        this.events.emit('showToast', '🔀 Emergency route closed');
                    });
                }
                break;
            }

            case 'powerSurge':
                // Brief invincibility
                this.packet.activateShield();
                this.cameras.main.flash(200, 0, 60, 40, true);
                break;

            case 'nodeOverload': {
                // Temporarily block a random non-essential node
                const candidates = this.nodes.filter(n =>
                    n.type !== 'source' && n.type !== 'server' &&
                    n !== this.packet.currentNode && !this._overloadedNodes.has(n)
                );
                if (candidates.length > 0) {
                    const target = Phaser.Utils.Array.GetRandom(candidates);
                    this._overloadedNodes.add(target);
                    // Visual: red pulse
                    const warningCircle = this.add.circle(target.x, target.y, 35, 0xff0000, 0.2).setDepth(5);
                    const warningText = this.add.text(target.x, target.y - 40, '⛔ OVERLOADED', {
                        fontFamily: '"Courier New", monospace', fontSize: '10px',
                        color: '#ff4444', fontStyle: 'bold',
                    }).setOrigin(0.5).setDepth(80);
                    this.tweens.add({
                        targets: warningCircle, scaleX: 1.3, scaleY: 1.3, alpha: 0.4,
                        duration: 600, yoyo: true, repeat: -1,
                    });

                    // Store original blocked state
                    const wasBlocked = target.isBlocked;
                    target.isBlocked = true;

                    this.time.delayedCall(5000, () => {
                        this._overloadedNodes.delete(target);
                        target.isBlocked = wasBlocked;
                        warningCircle.destroy();
                        warningText.destroy();
                        this.events.emit('showToast', `✅ ${target.label} back online`);
                    });
                }
                break;
            }

            case 'scoreBoost':
                this._scoreMultiplier = 2;
                this.cameras.main.flash(150, 60, 60, 0, true);
                this.time.delayedCall(6000, () => {
                    this._scoreMultiplier = 1;
                    this.events.emit('showToast', '💰 Score bonus expired');
                });
                break;

            case 'lagSpike':
                // Everything goes slow-mo briefly
                this.packet.speed = 80;
                this.malwares.forEach(mw => { mw.speed = 40; });
                // Desaturated overlay
                const lagOverlay = this.add.rectangle(
                    this.scale.width / 2, this.scale.height / 2,
                    this.scale.width, this.scale.height, 0x222244, 0.12
                ).setDepth(95);
                this.time.delayedCall(3000, () => {
                    if (this.packet) this.packet.speed = 220;
                    this.malwares.forEach(mw => { mw.speed = 100; });
                    lagOverlay.destroy();
                    this.events.emit('showToast', '✅ Connection stabilized');
                });
                break;
        }

        // Schedule next event — randomize the delay each time
        if (this._eventTimer) this._eventTimer.delay = Phaser.Math.Between(5000, 9000);
    }

    update(time, delta) {
        this.malwares.forEach(mw => mw.update());
    }
}
