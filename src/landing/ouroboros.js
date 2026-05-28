/**
 * Ouroboros - ASCII art renderer from image
 * Converts the ouroboros image to rotating ASCII art in real-time
 */

export class Ouroboros {
    constructor() {
        this.image = null;
        this.imageLoaded = false;
        this.rotation = 0;
        this.rotationSpeed = 0.0003; // Radians per millisecond
        this.scale = 1;
        this.centerX = 0;
        this.centerY = 0;

        // ASCII art settings
        this.asciiChars = ' .,:;+*?%S#@'; // Dark to light
        this.gridSize = 280; // Size of the ASCII grid (pixels to sample)
        this.charWidth = 6;  // Width of each character cell
        this.charHeight = 10; // Height of each character cell
        this.fontSize = 9;

        // Offscreen canvas for image processing
        this.offscreenCanvas = null;
        this.offscreenCtx = null;

        // Om symbol settings
        this.omCanvas = null;
        this.omCtx = null;
        this.omSize = 200; // Size of the Om sampling grid
        this.omReady = false;
    }

    /**
     * Initialize with canvas dimensions
     */
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;

        // Scale based on viewport
        if (width < 768) {
            this.scale = 0.55;
            this.fontSize = 6;
            this.charWidth = 4;
            this.charHeight = 7;
        } else if (width < 1024) {
            this.scale = 0.75;
            this.fontSize = 7;
            this.charWidth = 5;
            this.charHeight = 8;
        } else {
            this.scale = 1;
            this.fontSize = 9;
            this.charWidth = 6;
            this.charHeight = 10;
        }

        // Create offscreen canvas for image sampling
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.gridSize;
        this.offscreenCanvas.height = this.gridSize;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

        // Load the ouroboros image
        this.loadImage();

        // Prepare Om symbol
        this.prepareOm();

        return this;
    }

    /**
     * Load the ouroboros image
     */
    loadImage() {
        this.image = new Image();
        this.image.onload = () => {
            this.imageLoaded = true;
        };
        this.image.src = '/content/images/ouroboros.jpg';
    }

    /**
     * Pre-render Om symbol to offscreen canvas for ASCII sampling
     */
    prepareOm() {
        this.omCanvas = document.createElement('canvas');
        this.omCanvas.width = this.omSize;
        this.omCanvas.height = this.omSize;
        this.omCtx = this.omCanvas.getContext('2d', { willReadFrequently: true });

        // Draw ॐ as a large glyph onto the offscreen canvas
        this.omCtx.fillStyle = '#000000';
        this.omCtx.fillRect(0, 0, this.omSize, this.omSize);

        this.omCtx.fillStyle = '#ffffff';
        this.omCtx.font = `bold ${Math.floor(this.omSize * 0.75)}px serif`;
        this.omCtx.textAlign = 'center';
        this.omCtx.textBaseline = 'middle';
        this.omCtx.fillText('ॐ', this.omSize / 2, this.omSize / 2);

        this.omReady = true;
    }

    /**
     * Update rotation based on time
     */
    update(timestamp) {
        this.rotation += this.rotationSpeed * 16;
    }

    /**
     * Convert brightness (0-255) to ASCII character
     */
    brightnessToChar(brightness) {
        const index = Math.floor((brightness / 255) * (this.asciiChars.length - 1));
        return this.asciiChars[index];
    }

    /**
     * Render the rotating ASCII ouroboros to canvas
     */
    render(ctx) {
        if (!this.imageLoaded || !this.image) return;

        const size = this.gridSize;
        const halfSize = size / 2;

        // Clear offscreen canvas
        this.offscreenCtx.fillStyle = '#000000';
        this.offscreenCtx.fillRect(0, 0, size, size);

        // Draw rotated image to offscreen canvas
        this.offscreenCtx.save();
        this.offscreenCtx.translate(halfSize, halfSize);
        this.offscreenCtx.rotate(this.rotation);

        // Create circular clip
        this.offscreenCtx.beginPath();
        this.offscreenCtx.arc(0, 0, halfSize * 0.95, 0, Math.PI * 2);
        this.offscreenCtx.closePath();
        this.offscreenCtx.clip();

        this.offscreenCtx.drawImage(
            this.image,
            -halfSize,
            -halfSize,
            size,
            size
        );
        this.offscreenCtx.restore();

        // Get image data for ASCII conversion
        const imageData = this.offscreenCtx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        // Calculate ASCII grid dimensions
        const cols = Math.floor(size / this.charWidth);
        const rows = Math.floor(size / this.charHeight);

        // Calculate total ASCII art size for centering
        const totalWidth = cols * this.charWidth * this.scale;
        const totalHeight = rows * this.charHeight * this.scale;
        const startX = this.centerX - totalWidth / 2;
        const startY = this.centerY - totalHeight / 2;

        // Set up text rendering
        ctx.font = `${this.fontSize * this.scale}px "Electrolize", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        // Sample image and render ASCII
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Sample center of this character cell
                const sampleX = Math.floor(col * this.charWidth + this.charWidth / 2);
                const sampleY = Math.floor(row * this.charHeight + this.charHeight / 2);

                // Get pixel index
                const pixelIndex = (sampleY * size + sampleX) * 4;

                // Get RGB values
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                // Calculate brightness (luminance formula)
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

                // Skip very dark pixels (background)
                if (brightness < 15) continue;

                // Get ASCII character
                const char = this.brightnessToChar(brightness);

                // Skip space characters
                if (char === ' ') continue;

                // Calculate position
                const x = startX + col * this.charWidth * this.scale;
                const y = startY + row * this.charHeight * this.scale;

                // Color based on brightness - orange tones
                if (brightness > 180) {
                    ctx.fillStyle = '#ff4500';
                    ctx.shadowColor = '#ff4500';
                    ctx.shadowBlur = 8;
                } else if (brightness > 100) {
                    ctx.fillStyle = '#cc3700';
                    ctx.shadowColor = '#ff4500';
                    ctx.shadowBlur = 4;
                } else {
                    ctx.fillStyle = '#7a2000';
                    ctx.shadowBlur = 0;
                }

                ctx.fillText(char, x, y);
            }
        }

        // Reset shadow
        ctx.shadowBlur = 0;

        // Render Om symbol in center
        this.renderOm(ctx);
    }

    /**
     * Render shimmering Om symbol as ASCII art in the center of the ouroboros
     */
    renderOm(ctx) {
        if (!this.omReady) return;

        const omData = this.omCtx.getImageData(0, 0, this.omSize, this.omSize);
        const omPixels = omData.data;

        const cols = Math.floor(this.omSize / this.charWidth);
        const rows = Math.floor(this.omSize / this.charHeight);

        const omScale = this.scale * 0.55;

        // First pass: find the actual bounding box of non-empty cells
        // so we can center on the real content, not the grid
        let minCol = cols, maxCol = 0, minRow = rows, maxRow = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const sampleX = Math.floor(col * this.charWidth + this.charWidth / 2);
                const sampleY = Math.floor(row * this.charHeight + this.charHeight / 2);
                const pixelIndex = (sampleY * this.omSize + sampleX) * 4;
                const r = omPixels[pixelIndex];
                const g = omPixels[pixelIndex + 1];
                const b = omPixels[pixelIndex + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                if (brightness >= 30) {
                    const char = this.brightnessToChar(brightness);
                    if (char !== ' ') {
                        if (col < minCol) minCol = col;
                        if (col > maxCol) maxCol = col;
                        if (row < minRow) minRow = row;
                        if (row > maxRow) maxRow = row;
                    }
                }
            }
        }

        // Content dimensions in pixels
        const contentWidth = (maxCol - minCol + 1) * this.charWidth * omScale;
        const contentHeight = (maxRow - minRow + 1) * this.charHeight * omScale;

        // Offset so the content bounding box is dead center on ouroboros center
        const startX = this.centerX - contentWidth / 2 - minCol * this.charWidth * omScale;
        const startY = this.centerY - contentHeight / 2 - minRow * this.charHeight * omScale;

        // Shimmer: oscillating brightness multiplier
        const time = performance.now();
        const shimmer = 0.6 + 0.4 * Math.sin(time * 0.003);
        const shimmer2 = 0.5 + 0.5 * Math.sin(time * 0.005 + 1.2);

        ctx.font = `${this.fontSize * omScale}px "Electrolize", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const sampleX = Math.floor(col * this.charWidth + this.charWidth / 2);
                const sampleY = Math.floor(row * this.charHeight + this.charHeight / 2);

                const pixelIndex = (sampleY * this.omSize + sampleX) * 4;
                const r = omPixels[pixelIndex];
                const g = omPixels[pixelIndex + 1];
                const b = omPixels[pixelIndex + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

                if (brightness < 30) continue;

                const char = this.brightnessToChar(brightness);
                if (char === ' ') continue;

                const x = startX + col * this.charWidth * omScale;
                const y = startY + row * this.charHeight * omScale;

                // Per-character shimmer variation based on position
                const localShimmer = 0.6 + 0.4 * Math.sin(time * 0.004 + col * 0.3 + row * 0.5);
                const glow = shimmer * localShimmer;

                // Orange tones with shimmer - matching ouroboros palette
                const r_color = Math.floor(255 * glow);
                const g_color = Math.floor(69 * glow * shimmer2);
                const b_color = 0;

                ctx.fillStyle = `rgb(${r_color}, ${g_color}, ${b_color})`;
                ctx.shadowColor = `rgb(${Math.min(255, r_color + 40)}, ${Math.min(100, g_color + 20)}, 0)`;
                ctx.shadowBlur = 6 * glow;

                ctx.fillText(char, x, y);
            }
        }

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
        const cols = Math.floor(this.gridSize / this.charWidth);
        return (cols * this.charWidth * this.scale) / 2 * 0.6;
    }
}

export default Ouroboros;
