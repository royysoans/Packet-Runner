import Phaser from 'phaser';
import LEVELS from '../data/levels';
import Node from '../objects/Node';
import Link from '../objects/Link';
import Packet from '../objects/Packet';
import Malware from '../objects/Malware';
import { soundEngine } from '../audio/SoundEngine';

// Random network event messages
const NETWORK_EVENTS = [
    { msg: '⚡ TRAFFIC SPIKE — Links reshuffled!', action: 'shuffleCongestion' },
    { msg: '🔒 FIREWALL POLICY UPDATE — Timing changed!', action: 'speedFirewall' },
    { msg: '🐛 WORM DETECTED — Malware speeds up!', action: 'speedMalware' },
    { msg: '📡 SIGNAL BOOST — Packet speed up!', action: 'boostSpeed' },
    { msg: '🌐 DNS RESOLUTION DELAY...', action: 'freezePacket' },
];

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

        // Scanline
        const scanline = this.add.graphics().setDepth(50).setAlpha(0.03);
        scanline.fillStyle(0x00ffcc, 1);
        for (let y = 0; y < height; y += 4) scanline.fillRect(0, y, width, 1);

        // ── Level title ──
        const levelTitle = this.add.text(width / 2, 50, `LEVEL ${levelData.id}: ${levelData.name.toUpperCase()}`, {
            fontFamily: '"Courier New", monospace', fontSize: '16px',
            color: '#334466', letterSpacing: 4,
        }).setOrigin(0.5).setAlpha(0).setDepth(30);
        this.tweens.add({ targets: levelTitle, alpha: 0.8, y: 40, duration: 800, ease: 'Power2' });

        // Subtitle flash
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

        // Source
        const sourceNode = nodeMap['src'];
        this.packet = new Packet(this, sourceNode.x, sourceNode.y, sourceNode);

        // Malware
        if (levelData.malware) {
            levelData.malware.forEach(mId => {
                const mNode = nodeMap[mId];
                if (mNode) this.malwares.push(new Malware(this, mNode.x, mNode.y, mNode));
            });
        }

        // Show initial neighbor labels
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

        // ── Random Events ──
        this._eventTimer = this.time.addEvent({
            delay: Phaser.Math.Between(8000, 14000),
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
                    this.events.emit('gameOver', 'Time Expired — Too slow!');
                }
            },
            loop: true,
        });

        // ── Level Complete / Game Over ──
        this.events.on('levelComplete', (score) => {
            this._gameOver = true;
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

        const event = Phaser.Utils.Array.GetRandom(NETWORK_EVENTS);
        soundEngine.alert();
        this.events.emit('showToast', event.msg);
        this.events.emit('networkEvent', event.msg);

        switch (event.action) {
            case 'shuffleCongestion':
                // Randomly change which links are congested
                this.links.forEach(link => {
                    if (Math.random() < 0.3) {
                        link.isCongested = !link.isCongested;
                        link.draw();
                    }
                });
                break;

            case 'speedFirewall':
                // Temporarily speed up firewall toggling
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
                // Brief freeze — can't move for 1.5s
                this.packet.isMoving = true; // lock movement
                this.cameras.main.shake(80, 0.003);
                this.time.delayedCall(1500, () => {
                    if (this.packet) this.packet.isMoving = false;
                });
                break;
        }
    }

    update(time, delta) {
        this.malwares.forEach(mw => mw.update());
    }
}
