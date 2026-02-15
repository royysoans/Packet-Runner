import Phaser from 'phaser';
import LEVELS from '../data/levels';
import { soundEngine } from '../audio/SoundEngine';

const SAVE_KEY = 'packetrunner_progress';

export default class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super('LevelSelectScene');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0b0f1a');
        this.cameras.main.fadeIn(300, 0, 0, 0);

        // Load progress
        const progress = this._loadProgress();

        // ── Background particles ──
        for (let i = 0; i < 25; i++) {
            const px = Phaser.Math.Between(0, width);
            const py = Phaser.Math.Between(0, height);
            const dot = this.add.circle(px, py, Phaser.Math.Between(1, 3), 0x223355, 0);
            this.tweens.add({
                targets: dot, alpha: Phaser.Math.FloatBetween(0.1, 0.4),
                duration: Phaser.Math.Between(2000, 5000), yoyo: true, repeat: -1,
            });
        }

        // ── Title ──
        this.add.text(width / 2, 40, 'SELECT LEVEL', {
            fontFamily: '"Courier New", monospace', fontSize: '28px',
            fontStyle: 'bold', color: '#00ffcc',
            stroke: '#003322', strokeThickness: 1,
        }).setOrigin(0.5);

        this.add.text(width / 2, 70, '// Choose your transmission route', {
            fontFamily: '"Courier New", monospace', fontSize: '13px',
            color: '#445566',
        }).setOrigin(0.5);

        // ── Level Grid (2 rows of 5) ──
        const cols = 5;
        const cardW = 200;
        const cardH = 90;
        const gapX = 20;
        const gapY = 20;
        const totalW = cols * cardW + (cols - 1) * gapX;
        const startX = (width - totalW) / 2;
        const startY = 110;

        LEVELS.forEach((level, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const cx = startX + col * (cardW + gapX);
            const cy = startY + row * (cardH + gapY + 20);

            // Determine state
            const isUnlocked = index === 0 || progress.completed.includes(index - 1);
            const isCompleted = progress.completed.includes(index);
            const bestScore = progress.scores[index] || 0;

            // Card background
            const card = this.add.graphics();
            const borderColor = isCompleted ? 0x00ff88 : (isUnlocked ? 0x00ffcc : 0x223344);
            const bgColor = isCompleted ? 0x0a2218 : (isUnlocked ? 0x0c1a2e : 0x0a0f18);
            const bgAlpha = isUnlocked ? 1 : 0.5;

            card.fillStyle(bgColor, bgAlpha);
            card.fillRoundedRect(cx, cy, cardW, cardH, 8);
            card.lineStyle(2, borderColor, isUnlocked ? 0.7 : 0.2);
            card.strokeRoundedRect(cx, cy, cardW, cardH, 8);

            // Level number
            const numColor = isCompleted ? '#00ff88' : (isUnlocked ? '#00ffcc' : '#334455');
            this.add.text(cx + 14, cy + 10, `${level.id}`, {
                fontFamily: '"Courier New", monospace', fontSize: '32px',
                fontStyle: 'bold', color: numColor,
            }).setAlpha(isUnlocked ? 1 : 0.4);

            // Level name
            const nameColor = isCompleted ? '#88ffbb' : (isUnlocked ? '#88bbcc' : '#334455');
            this.add.text(cx + 58, cy + 12, level.name.toUpperCase(), {
                fontFamily: '"Courier New", monospace', fontSize: '12px',
                fontStyle: 'bold', color: nameColor,
                wordWrap: { width: cardW - 68 },
            }).setAlpha(isUnlocked ? 1 : 0.4);

            // Status text
            if (isCompleted) {
                const stars = bestScore > 500 ? '★★★' : bestScore > 300 ? '★★☆' : '★☆☆';
                this.add.text(cx + 58, cy + 32, stars, {
                    fontFamily: '"Courier New", monospace', fontSize: '14px',
                    color: bestScore > 500 ? '#ffdd00' : bestScore > 300 ? '#ffaa44' : '#666666',
                });
                this.add.text(cx + 58, cy + 52, `SCORE: ${bestScore}`, {
                    fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#44aa66',
                });
            } else if (isUnlocked) {
                this.add.text(cx + 58, cy + 38, '▶ READY', {
                    fontFamily: '"Courier New", monospace', fontSize: '12px',
                    color: '#00ffcc', fontStyle: 'bold',
                });
            } else {
                this.add.text(cx + 58, cy + 38, '🔒 LOCKED', {
                    fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#334455',
                });
            }

            // Clickable zone (only for unlocked levels)
            if (isUnlocked) {
                const zone = this.add.zone(cx + cardW / 2, cy + cardH / 2, cardW, cardH)
                    .setInteractive({ useHandCursor: true });

                zone.on('pointerover', () => {
                    card.clear();
                    card.fillStyle(isCompleted ? 0x0f3322 : 0x112840, 1);
                    card.fillRoundedRect(cx, cy, cardW, cardH, 8);
                    card.lineStyle(2, isCompleted ? 0x44ff88 : 0x00ffee, 1);
                    card.strokeRoundedRect(cx, cy, cardW, cardH, 8);
                });

                zone.on('pointerout', () => {
                    card.clear();
                    card.fillStyle(bgColor, bgAlpha);
                    card.fillRoundedRect(cx, cy, cardW, cardH, 8);
                    card.lineStyle(2, borderColor, isUnlocked ? 0.7 : 0.2);
                    card.strokeRoundedRect(cx, cy, cardW, cardH, 8);
                });

                zone.on('pointerdown', () => {
                    soundEngine.click();
                    this.cameras.main.fadeOut(300, 0, 0, 0);
                    this.time.delayedCall(300, () => {
                        this.scene.start('GameScene', { level: index });
                    });
                });
            }
        });

        // ── Difficulty legend ──
        const legendY = startY + 2 * (cardH + gapY + 20) + 20;
        this.add.text(width / 2, legendY, [
            'DIFFICULTY SCALE:  Lvl 1-3 ▰▱▱  Easy   |   Lvl 4-6 ▰▰▱  Medium   |   Lvl 7-10 ▰▰▰  Hard',
        ].join(''), {
            fontFamily: '"Courier New", monospace', fontSize: '11px',
            color: '#445566', align: 'center',
        }).setOrigin(0.5);

        // ── Stats bar ──
        const completed = progress.completed.length;
        const totalScore = Object.values(progress.scores).reduce((a, b) => a + b, 0);
        const statsY = legendY + 30;
        this.add.text(width / 2, statsY,
            `Completed: ${completed}/${LEVELS.length}   |   Total Score: ${totalScore}`, {
            fontFamily: '"Courier New", monospace', fontSize: '13px',
            color: '#668899',
        }).setOrigin(0.5);

        // ── Back button ──
        const backY = height - 50;
        const backBg = this.add.graphics();
        backBg.fillStyle(0x0c1a2e, 1);
        backBg.fillRoundedRect(width / 2 - 100, backY - 18, 200, 40, 8);
        backBg.lineStyle(1, 0x334455, 0.5);
        backBg.strokeRoundedRect(width / 2 - 100, backY - 18, 200, 40, 8);

        const backText = this.add.text(width / 2, backY, '← BACK TO MENU', {
            fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#668899',
        }).setOrigin(0.5);

        const backZone = this.add.zone(width / 2, backY, 200, 40)
            .setInteractive({ useHandCursor: true });
        backZone.on('pointerover', () => backText.setColor('#ffffff'));
        backZone.on('pointerout', () => backText.setColor('#668899'));
        backZone.on('pointerdown', () => {
            soundEngine.click();
            this.cameras.main.fadeOut(200, 0, 0, 0);
            this.time.delayedCall(200, () => this.scene.start('MenuScene'));
        });
    }

    _loadProgress() {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) return JSON.parse(data);
        } catch (e) { /* ignore */ }
        return { completed: [], scores: {} };
    }

    static saveProgress(levelIndex, score) {
        let progress;
        try {
            const data = localStorage.getItem(SAVE_KEY);
            progress = data ? JSON.parse(data) : { completed: [], scores: {} };
        } catch (e) {
            progress = { completed: [], scores: {} };
        }

        if (!progress.completed.includes(levelIndex)) {
            progress.completed.push(levelIndex);
        }
        if (!progress.scores[levelIndex] || score > progress.scores[levelIndex]) {
            progress.scores[levelIndex] = score;
        }

        localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    }
}
