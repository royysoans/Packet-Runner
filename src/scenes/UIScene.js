import Phaser from 'phaser';
import LEVELS from '../data/levels';
import { soundEngine } from '../audio/SoundEngine';

export default class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    init(data) {
        this.levelIndex = data.levelIndex || 0;
        this.levelTime = data.levelTime || 30;
        this.timeRemaining = this.levelTime;
    }

    create() {
        const { width, height } = this.scale;
        const gameScene = this.scene.get('GameScene');

        // ── TTL Bar (top-left) ──
        this.add.text(20, 16, 'TTL', {
            fontFamily: '"Courier New", monospace', fontSize: '13px',
            color: '#00ffcc', fontStyle: 'bold',
        });

        this._ttlBarBg = this.add.graphics();
        this._ttlBarBg.fillStyle(0x112233, 0.8);
        this._ttlBarBg.fillRoundedRect(55, 14, 200, 18, 4);

        this._ttlBar = this.add.graphics();
        this._drawBar(this._ttlBar, 55, 14, 200, 18, 1, 0x00ffcc);

        this._ttlValue = this.add.text(262, 16, '100', {
            fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#00ffcc',
        });

        // ── Integrity Bar (top-right area) ──
        this.add.text(width - 310, 16, 'INTEGRITY', {
            fontFamily: '"Courier New", monospace', fontSize: '13px',
            color: '#44aaff', fontStyle: 'bold',
        });

        this._intBarBg = this.add.graphics();
        this._intBarBg.fillStyle(0x112233, 0.8);
        this._intBarBg.fillRoundedRect(width - 220, 14, 150, 18, 4);

        this._intBar = this.add.graphics();
        this._drawBar(this._intBar, width - 220, 14, 150, 18, 1, 0x44aaff);

        this._intValue = this.add.text(width - 62, 16, '100%', {
            fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#44aaff',
        }).setOrigin(0, 0).setDepth(75);

        // ── Timer (center-top) ──
        this._timerText = this.add.text(width / 2, 16, this._formatTime(this.timeRemaining), {
            fontFamily: '"Courier New", monospace', fontSize: '22px',
            fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(0.5, 0).setDepth(70);

        this._timerLabel = this.add.text(width / 2, 42, 'TIME', {
            fontFamily: '"Courier New", monospace', fontSize: '10px',
            color: '#445566',
        }).setOrigin(0.5, 0);

        // ── Combo display (below timer) ──
        this._comboText = this.add.text(width / 2, height - 100, '', {
            fontFamily: '"Courier New", monospace', fontSize: '28px',
            fontStyle: 'bold', color: '#ffdd00',
            stroke: '#332200', strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0).setDepth(80);

        this._comboLabel = this.add.text(width / 2, height - 72, '', {
            fontFamily: '"Courier New", monospace', fontSize: '12px',
            color: '#ffaa00',
        }).setOrigin(0.5).setAlpha(0).setDepth(80);

        // ── Event banner (top area) ──
        this._eventBanner = this.add.text(width / 2, 70, '', {
            fontFamily: '"Courier New", monospace', fontSize: '14px',
            fontStyle: 'bold', color: '#ffaa00',
            backgroundColor: '#1a1100cc',
            padding: { x: 16, y: 6 },
        }).setOrigin(0.5).setAlpha(0).setDepth(85);

        // ── Toast area ──
        this._toastText = this.add.text(width / 2, height - 40, '', {
            fontFamily: '"Courier New", monospace', fontSize: '15px',
            color: '#ffffff', backgroundColor: '#0d1b2aee',
            padding: { x: 16, y: 8 }, align: 'center',
        }).setOrigin(0.5).setAlpha(0).setDepth(90);

        // ── Event listeners ──
        gameScene.events.on('updateHUD', (data) => {
            const ttlPct = Math.max(0, data.ttl / 100);
            const intPct = Math.max(0, data.integrity / 100);

            this._drawBar(this._ttlBar, 55, 14, 200, 18, ttlPct, this._getBarColor(ttlPct));
            this._ttlValue.setText(Math.floor(data.ttl));
            this._ttlValue.setColor(ttlPct < 0.3 ? '#ff3333' : '#00ffcc');

            this._drawBar(this._intBar, width - 220, 14, 150, 18, intPct, this._getBarColor(intPct, 0x44aaff));
            this._intValue.setText(Math.floor(data.integrity) + '%');
            this._intValue.setColor(intPct < 0.3 ? '#ff3333' : '#44aaff');
        });

        gameScene.events.on('timerUpdate', (seconds) => {
            this.timeRemaining = seconds;
            this._timerText.setText(this._formatTime(seconds));
            if (seconds <= 10) {
                this._timerText.setColor('#ff3333');
                // Pulsing effect
                this.tweens.add({
                    targets: this._timerText,
                    scaleX: 1.15, scaleY: 1.15,
                    duration: 100, yoyo: true,
                });
            } else if (seconds <= 20) {
                this._timerText.setColor('#ffaa00');
            } else {
                this._timerText.setColor('#ffffff');
            }
        });

        gameScene.events.on('combo', (level) => {
            if (level >= 2) {
                this._comboText.setText(`${level}x COMBO`);
                this._comboLabel.setText(level >= 5 ? '🔥 UNSTOPPABLE' : level >= 4 ? '⚡ BLAZING' : level >= 3 ? '💫 GREAT' : '✨ NICE');
                this.tweens.killTweensOf(this._comboText);
                this.tweens.killTweensOf(this._comboLabel);
                this._comboText.setAlpha(1).setScale(1.3);
                this._comboLabel.setAlpha(1);
                this.tweens.add({ targets: this._comboText, scaleX: 1, scaleY: 1, duration: 200 });
                this.tweens.add({ targets: [this._comboText, this._comboLabel], alpha: 0, duration: 400, delay: 1800 });
            } else {
                this._comboText.setAlpha(0);
                this._comboLabel.setAlpha(0);
            }
        });

        gameScene.events.on('networkEvent', (msg) => {
            this._eventBanner.setText(msg);
            this.tweens.killTweensOf(this._eventBanner);
            this._eventBanner.setAlpha(1);
            this.tweens.add({
                targets: this._eventBanner, alpha: 0,
                duration: 600, delay: 3000,
            });
        });

        gameScene.events.on('showToast', (msg) => this._showToast(msg));
        gameScene.events.on('gameOver', (reason) => this._showGameOver(reason));

        this.events.on('shutdown', () => {
            gameScene.events.off('updateHUD');
            gameScene.events.off('timerUpdate');
            gameScene.events.off('combo');
            gameScene.events.off('networkEvent');
            gameScene.events.off('showToast');
            gameScene.events.off('gameOver');
        });
    }

    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    _drawBar(gfx, x, y, maxW, h, pct, color) {
        gfx.clear();
        const w = Math.max(2, maxW * pct);
        gfx.fillStyle(color, 0.8);
        gfx.fillRoundedRect(x, y, w, h, 4);
        gfx.fillStyle(0xffffff, 0.1);
        gfx.fillRoundedRect(x, y, w, h / 2, { tl: 4, tr: 4, bl: 0, br: 0 });
    }

    _getBarColor(pct, base = 0x00ffcc) {
        if (pct < 0.2) return 0xff3333;
        if (pct < 0.4) return 0xffaa00;
        return base;
    }

    _showToast(msg) {
        this._toastText.setText(msg);
        this.tweens.killTweensOf(this._toastText);
        this._toastText.setAlpha(1);
        this.tweens.add({ targets: this._toastText, alpha: 0, duration: 600, delay: 2000 });
    }

    _showGameOver(reason) {
        const { width, height } = this.scale;

        const overlay = this.add.graphics().setDepth(80);
        overlay.fillStyle(0x000000, 0);
        overlay.fillRect(0, 0, width, height);
        this.tweens.add({ targets: overlay, alpha: 0.85, duration: 400 });

        const xLines = this.add.graphics().setDepth(81).setAlpha(0);
        xLines.lineStyle(6, 0xff3333, 0.3);
        xLines.moveTo(width * 0.3, height * 0.2); xLines.lineTo(width * 0.7, height * 0.8);
        xLines.moveTo(width * 0.7, height * 0.2); xLines.lineTo(width * 0.3, height * 0.8);
        xLines.strokePath();
        this.tweens.add({ targets: xLines, alpha: 1, duration: 300, delay: 300 });

        const title = this.add.text(width / 2, height * 0.33, 'TRANSMISSION FAILED', {
            fontFamily: '"Courier New", monospace', fontSize: '48px',
            fontStyle: 'bold', color: '#ff3333',
            stroke: '#330000', strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0).setDepth(82);

        const reasonText = this.add.text(width / 2, height * 0.44, reason.toUpperCase(), {
            fontFamily: '"Courier New", monospace', fontSize: '20px', color: '#ff6666',
        }).setOrigin(0.5).setAlpha(0).setDepth(82);

        const levelData = LEVELS[this.levelIndex];
        const fact = this.add.text(width / 2, height * 0.56, `💡 ${levelData.fact}`, {
            fontFamily: '"Courier New", monospace', fontSize: '15px',
            color: '#668899', wordWrap: { width: 700 }, align: 'center',
        }).setOrigin(0.5).setAlpha(0).setDepth(82);

        this.tweens.add({ targets: title, alpha: 1, duration: 400, delay: 400 });
        this.tweens.add({ targets: reasonText, alpha: 1, duration: 400, delay: 600 });
        this.tweens.add({ targets: fact, alpha: 1, duration: 400, delay: 800 });

        // Retry button
        const btnY = height * 0.72;
        const btnBg = this.add.graphics().setDepth(82).setAlpha(0);
        btnBg.fillStyle(0x1a0000, 1);
        btnBg.fillRoundedRect(width / 2 - 140, btnY - 22, 280, 50, 10);
        btnBg.lineStyle(2, 0xff3333, 0.6);
        btnBg.strokeRoundedRect(width / 2 - 140, btnY - 22, 280, 50, 10);

        const btnText = this.add.text(width / 2, btnY + 3, '↻  RETRY TRANSMISSION', {
            fontFamily: '"Courier New", monospace', fontSize: '18px', color: '#ff5555',
        }).setOrigin(0.5).setDepth(82).setAlpha(0);

        const btnZone = this.add.zone(width / 2, btnY + 3, 280, 50).setInteractive({ useHandCursor: true }).setDepth(82);
        btnZone.on('pointerover', () => btnText.setColor('#ffffff'));
        btnZone.on('pointerout', () => btnText.setColor('#ff5555'));
        btnZone.on('pointerdown', () => {
            soundEngine.click();
            this.scene.stop('UIScene');
            this.scene.get('GameScene').scene.restart({ level: this.levelIndex });
        });

        this.tweens.add({ targets: [btnBg, btnText], alpha: 1, duration: 400, delay: 1000 });
    }
}
