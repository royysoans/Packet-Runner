import Phaser from 'phaser';
import { soundEngine } from '../audio/SoundEngine';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0b0f1a');

        // ── Animated grid background ──
        const gridGfx = this.add.graphics();
        gridGfx.lineStyle(1, 0x1a2744, 0.4);
        for (let x = 0; x <= width; x += 40) {
            gridGfx.moveTo(x, 0);
            gridGfx.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += 40) {
            gridGfx.moveTo(0, y);
            gridGfx.lineTo(width, y);
        }
        gridGfx.strokePath();

        // ── Floating particles ──
        for (let i = 0; i < 50; i++) {
            const px = Phaser.Math.Between(0, width);
            const py = Phaser.Math.Between(0, height);
            const dot = this.add.circle(px, py, Phaser.Math.Between(1, 3), 0x00ffcc, Phaser.Math.FloatBetween(0.1, 0.4));
            this.tweens.add({
                targets: dot,
                y: dot.y - Phaser.Math.Between(20, 80),
                alpha: 0,
                duration: Phaser.Math.Between(3000, 8000),
                repeat: -1,
                yoyo: true,
                delay: Phaser.Math.Between(0, 3000),
            });
        }

        // ── Decorative network nodes ──
        const nodePositions = [
            { x: width * 0.15, y: height * 0.3 },
            { x: width * 0.3, y: height * 0.7 },
            { x: width * 0.7, y: height * 0.25 },
            { x: width * 0.82, y: height * 0.65 },
            { x: width * 0.5, y: height * 0.85 },
        ];
        const colors = [0x00aaff, 0x00ffcc, 0xffaa00, 0x00ff88, 0xff55aa];

        const decoGfx = this.add.graphics();
        decoGfx.lineStyle(1, 0x1a3355, 0.3);
        for (let i = 0; i < nodePositions.length; i++) {
            for (let j = i + 1; j < nodePositions.length; j++) {
                if (Math.random() > 0.5) {
                    decoGfx.moveTo(nodePositions[i].x, nodePositions[i].y);
                    decoGfx.lineTo(nodePositions[j].x, nodePositions[j].y);
                }
            }
        }
        decoGfx.strokePath();

        nodePositions.forEach((pos, i) => {
            this.add.circle(pos.x, pos.y, 18, colors[i], 0.15);
            const node = this.add.circle(pos.x, pos.y, 8, colors[i], 0.6);
            this.tweens.add({
                targets: node,
                scaleX: 1.2,
                scaleY: 1.2,
                alpha: 0.3,
                duration: 2000 + i * 300,
                yoyo: true,
                repeat: -1,
            });
        });

        // ── Title ──
        const titleText = this.add.text(width / 2, height * 0.28, 'PACKET RUNNER', {
            fontFamily: '"Courier New", monospace',
            fontSize: '72px',
            fontStyle: 'bold',
            color: '#00ffcc',
            stroke: '#003322',
            strokeThickness: 3,
        }).setOrigin(0.5).setAlpha(0);

        const titleGlow = this.add.text(width / 2, height * 0.28, 'PACKET RUNNER', {
            fontFamily: '"Courier New", monospace',
            fontSize: '72px',
            fontStyle: 'bold',
            color: '#00ffcc',
        }).setOrigin(0.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({ targets: titleText, alpha: 1, y: height * 0.25, duration: 1200, ease: 'Power3' });
        this.tweens.add({ targets: titleGlow, alpha: 0.3, y: height * 0.25, duration: 1200, ease: 'Power3' });
        this.tweens.add({ targets: titleGlow, alpha: { from: 0.15, to: 0.35 }, duration: 2000, yoyo: true, repeat: -1, delay: 1200 });

        // ── Subtitle ──
        const subtitle = this.add.text(width / 2, height * 0.35, '// Navigate the Network. Deliver the Packet.', {
            fontFamily: '"Courier New", monospace',
            fontSize: '20px',
            color: '#557788',
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: subtitle, alpha: 1, duration: 800, delay: 800 });

        // ── Start Button ──
        const btnBg = this.add.graphics();
        const btnX = width / 2 - 160;
        const btnY = height * 0.52;
        const btnW = 320;
        const btnH = 60;

        const drawBtn = (hover) => {
            btnBg.clear();
            btnBg.fillStyle(hover ? 0x0d2040 : 0x0a1628, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 12);
            btnBg.lineStyle(2, 0x00ffcc, hover ? 1 : 0.6);
            btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 12);
        };
        drawBtn(false);

        const startText = this.add.text(width / 2, btnY + btnH / 2, '▶  START TRANSMISSION', {
            fontFamily: '"Courier New", monospace',
            fontSize: '22px',
            color: '#00ffcc',
        }).setOrigin(0.5);

        const hitZone = this.add.zone(width / 2, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });

        hitZone.on('pointerover', () => { drawBtn(true); startText.setColor('#ffffff'); });
        hitZone.on('pointerout', () => { drawBtn(false); startText.setColor('#00ffcc'); });
        hitZone.on('pointerdown', () => {
            // Initialize audio on first user gesture
            soundEngine.init();
            soundEngine.click();
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.time.delayedCall(400, () => {
                this.scene.start('GameScene', { level: 0 });
            });
        });

        btnBg.setAlpha(0);
        startText.setAlpha(0);
        this.tweens.add({ targets: [btnBg, startText], alpha: 1, duration: 600, delay: 1400 });

        // ── Level Select Button ──
        const lsBg = this.add.graphics();
        const lsY = height * 0.64;
        const lsW = 260;
        const lsH = 44;
        const lsX = width / 2 - lsW / 2;

        const drawLsBtn = (hover) => {
            lsBg.clear();
            lsBg.fillStyle(hover ? 0x0d2040 : 0x0a1628, 1);
            lsBg.fillRoundedRect(lsX, lsY, lsW, lsH, 10);
            lsBg.lineStyle(1, 0x4488aa, hover ? 0.8 : 0.4);
            lsBg.strokeRoundedRect(lsX, lsY, lsW, lsH, 10);
        };
        drawLsBtn(false);

        const lsText = this.add.text(width / 2, lsY + lsH / 2, '📋  SELECT LEVEL', {
            fontFamily: '"Courier New", monospace', fontSize: '16px', color: '#4488aa',
        }).setOrigin(0.5);

        const lsZone = this.add.zone(width / 2, lsY + lsH / 2, lsW, lsH).setInteractive({ useHandCursor: true });
        lsZone.on('pointerover', () => { drawLsBtn(true); lsText.setColor('#ffffff'); });
        lsZone.on('pointerout', () => { drawLsBtn(false); lsText.setColor('#4488aa'); });
        lsZone.on('pointerdown', () => {
            soundEngine.init();
            soundEngine.click();
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.time.delayedCall(300, () => {
                this.scene.start('LevelSelectScene');
            });
        });

        lsBg.setAlpha(0);
        lsText.setAlpha(0);
        this.tweens.add({ targets: [lsBg, lsText], alpha: 1, duration: 600, delay: 1600 });

        // ── Controls hint ──
        const controls = this.add.text(width / 2, height * 0.78,
            'Click nodes or press 1-9 to route your packet\nBuild combos  •  Manage your TTL  •  Beat the timer', {
            fontFamily: '"Courier New", monospace',
            fontSize: '14px',
            color: '#334455',
            align: 'center',
            lineSpacing: 6,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: controls, alpha: 1, duration: 600, delay: 1800 });

        this.add.text(width - 16, height - 16, 'v3.0', {
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            color: '#223344',
        }).setOrigin(1, 1);

        this.cameras.main.fadeIn(600, 0, 0, 0);
    }
}
