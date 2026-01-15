/**
 * Ouroboros - ASCII snake animation renderer
 */

import { OUROBOROS_FRAMES, FRAME_DURATION, TOTAL_FRAMES } from './ascii-frames.js';

export class Ouroboros {
    constructor() {
        this.currentFrame = 0;
        this.lastFrameTime = 0;
        this.scale = 1;
        this.color = '#ffffff';
        this.glowColor = '#ff4500';
        this.fontSize = 14;
        this.centerX = 0;
        this.centerY = 0;
    }

    /**
     * Initialize with canvas dimensions
     */
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;

        // Scale based on viewport
        if (width < 768) {
            this.scale = 0.7;
            this.fontSize = 10;
        } else if (width < 1024) {
            this.scale = 0.85;
            this.fontSize = 12;
        } else {
            this.scale = 1;
            this.fontSize = 14;
        }

        return this;
    }

    /**
     * Update animation frame based on time
     */
    update(timestamp) {
        if (timestamp - this.lastFrameTime >= FRAME_DURATION) {
            this.currentFrame = (this.currentFrame + 1) % TOTAL_FRAMES;
            this.lastFrameTime = timestamp;
        }
    }

    /**
     * Render current frame to canvas
     */
    render(ctx) {
        const frame = OUROBOROS_FRAMES[this.currentFrame];
        const lines = frame.split('\n').filter(line => line.trim());

        const lineHeight = this.fontSize * 1.2 * this.scale;
        const charWidth = this.fontSize * 0.6 * this.scale;

        // Calculate dimensions
        const maxWidth = Math.max(...lines.map(l => l.length)) * charWidth;
        const totalHeight = lines.length * lineHeight;

        const startX = this.centerX - maxWidth / 2;
        const startY = this.centerY - totalHeight / 2;

        // Set font
        ctx.font = `${this.fontSize * this.scale}px "SF Mono", Monaco, monospace`;
        ctx.textBaseline = 'top';

        // Draw with glow effect
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = this.color;

        lines.forEach((line, i) => {
            // Highlight special characters
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                const x = startX + j * charWidth;
                const y = startY + i * lineHeight;

                if (char === '@' || char === 'V') {
                    // Head and tongue in accent color
                    ctx.fillStyle = this.glowColor;
                    ctx.shadowBlur = 20;
                } else {
                    ctx.fillStyle = this.color;
                    ctx.shadowBlur = 10;
                }

                ctx.fillText(char, x, y);
            }
        });

        // Reset shadow
        ctx.shadowBlur = 0;
    }

    /**
     * Get center position for node network attachment
     */
    getCenter() {
        return { x: this.centerX, y: this.centerY };
    }

    /**
     * Get approximate radius for node positioning
     */
    getRadius() {
        return 80 * this.scale;
    }
}

export default Ouroboros;
