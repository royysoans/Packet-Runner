import Phaser from 'phaser';
import LEVELS from '../data/levels';
import { soundEngine } from '../audio/SoundEngine';
import LevelSelectScene from './LevelSelectScene';

export default class LevelCompleteScene extends Phaser.Scene {
    constructor() {
        super('LevelCompleteScene');
    }

    init(data) {
        this.levelIndex = data.levelIndex || 0;
        this.score = data.score || 0;
        this.ttl = data.ttl || 0;
        this.integrity = data.integrity || 0;
        this.maxCombo = data.maxCombo || 0;
        this.timeLeft = data.timeLeft || 0;
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0b0f1a');
        this.cameras.main.fadeIn(400, 0, 0, 0);

        // Save progress
        LevelSelectScene.saveProgress(this.levelIndex, this.score);

        const levelData = LEVELS[this.levelIndex];

        // Success particles
        for (let i = 0; i < 60; i++) {
            const px = Phaser.Math.Between(0, width);
            const py = Phaser.Math.Between(0, height);
            const colors = [0x00ff88, 0x00ffcc, 0x44ddff, 0xffffff, 0xffdd00];
            const dot = this.add.circle(px, py, Phaser.Math.Between(1, 4), Phaser.Utils.Array.GetRandom(colors), 0);
            this.tweens.add({
                targets: dot, alpha: Phaser.Math.FloatBetween(0.2, 0.7),
                y: dot.y - Phaser.Math.Between(30, 100),
                duration: Phaser.Math.Between(2000, 5000), delay: Phaser.Math.Between(0, 1500),
                repeat: -1, yoyo: true,
            });
        }

        // Checkmark
        const checkmark = this.add.text(width / 2, height * 0.12, '✓', {
            fontFamily: '"Courier New", monospace', fontSize: '64px', color: '#00ff88',
        }).setOrigin(0.5).setAlpha(0);

        // Title
        const title = this.add.text(width / 2, height * 0.22, 'PACKET DELIVERED', {
            fontFamily: '"Courier New", monospace', fontSize: '44px', fontStyle: 'bold',
            color: '#00ff88', stroke: '#003311', strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0);

        // Star rating
        const stars = this.score > 500 ? '★★★' : this.score > 300 ? '★★☆' : '★☆☆';
        const starColor = this.score > 500 ? '#ffdd00' : this.score > 300 ? '#ffaa44' : '#888888';

        const starsText = this.add.text(width / 2, height * 0.31, stars, {
            fontFamily: '"Courier New", monospace', fontSize: '30px', color: starColor,
        }).setOrigin(0.5).setAlpha(0);

        // Stats
        const statsText = [
            `LEVEL ${levelData.id}: ${levelData.name}`,
            '',
            `TTL Remaining    ${Math.floor(this.ttl).toString().padStart(4)}`,
            `Integrity        ${Math.floor(this.integrity).toString().padStart(3)}%`,
            `Max Combo        ${this.maxCombo.toString().padStart(4)}x`,
            `Time Left        ${this.timeLeft.toString().padStart(4)}s`,
            `────────────────────`,
            `TOTAL SCORE      ${this.score.toString().padStart(4)}`,
        ].join('\n');

        const stats = this.add.text(width / 2, height * 0.48, statsText, {
            fontFamily: '"Courier New", monospace', fontSize: '15px',
            color: '#88bbcc', align: 'center', lineSpacing: 3,
        }).setOrigin(0.5).setAlpha(0);

        // Fact
        const factBox = this.add.graphics().setAlpha(0);
        factBox.fillStyle(0x0a1628, 0.8);
        factBox.fillRoundedRect(width / 2 - 350, height * 0.70 - 10, 700, 50, 8);
        factBox.lineStyle(1, 0x1a3355, 0.5);
        factBox.strokeRoundedRect(width / 2 - 350, height * 0.70 - 10, 700, 50, 8);

        const factLabel = this.add.text(width / 2, height * 0.70, '💡 DID YOU KNOW?', {
            fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#44aaff',
        }).setOrigin(0.5, 0).setAlpha(0);

        const factText = this.add.text(width / 2, height * 0.70 + 16, levelData.fact, {
            fontFamily: '"Courier New", monospace', fontSize: '12px',
            color: '#668899', align: 'center', wordWrap: { width: 660 },
        }).setOrigin(0.5, 0).setAlpha(0);

        // Animations
        this.tweens.add({ targets: checkmark, alpha: 1, scaleX: { from: 2, to: 1 }, scaleY: { from: 2, to: 1 }, duration: 500 });
        this.tweens.add({ targets: title, alpha: 1, duration: 600, delay: 300 });
        this.tweens.add({ targets: starsText, alpha: 1, duration: 400, delay: 500 });
        this.tweens.add({ targets: stats, alpha: 1, duration: 600, delay: 700 });
        this.tweens.add({ targets: [factBox, factLabel, factText], alpha: 1, duration: 500, delay: 1000 });

        // ── Buttons row ──
        const hasNext = this.levelIndex < LEVELS.length - 1;
        const btnY = height * 0.85;

        if (hasNext) {
            this._createButton(width / 2 - 245, btnY, 230, '▶  NEXT LEVEL', '#00ffcc', 0x0a1628, 0x00ffcc, () => {
                soundEngine.click();
                this.cameras.main.fadeOut(300, 0, 0, 0);
                this.time.delayedCall(300, () => this.scene.start('GameScene', { level: this.levelIndex + 1 }));
            });
        }

        this._createButton(hasNext ? width / 2 - 5 : width / 2 - 115, btnY, 230, '📋  LEVEL SELECT', '#4488aa', 0x0a1628, 0x334455, () => {
            soundEngine.click();
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.time.delayedCall(300, () => this.scene.start('LevelSelectScene'));
        });

        if (hasNext) {
            this._createButton(width / 2 + 235, btnY, 130, '☰ MENU', '#557788', 0x0a1628, 0x334455, () => {
                soundEngine.click();
                this.cameras.main.fadeOut(300, 0, 0, 0);
                this.time.delayedCall(300, () => this.scene.start('MenuScene'));
            });
        }
    }

    _createButton(x, y, w, label, textColor, bgColor, borderColor, callback) {
        const h = 42;
        const bg = this.add.graphics().setAlpha(0);
        bg.fillStyle(bgColor, 1);
        bg.fillRoundedRect(x, y, w, h, 10);
        bg.lineStyle(2, borderColor, 0.6);
        bg.strokeRoundedRect(x, y, w, h, 10);

        const text = this.add.text(x + w / 2, y + h / 2, label, {
            fontFamily: '"Courier New", monospace', fontSize: '14px', color: textColor,
        }).setOrigin(0.5).setAlpha(0);

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => text.setColor('#ffffff'));
        zone.on('pointerout', () => text.setColor(textColor));
        zone.on('pointerdown', callback);

        this.tweens.add({ targets: [bg, text], alpha: 1, duration: 400, delay: 1200 });
    }
}
