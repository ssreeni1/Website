/**
 * Fun Network Component
 * Images arranged as network nodes with connecting lines
 */

export class Collage {
    constructor() {
        this.container = null;
        this.data = null;
        this.nodes = [];
        this.edges = [];
        this.hoveredNode = null;
        this.loadedImages = new Map();
        this.grayscaleImages = new Map();
        this.isActive = false;
        this.animationId = null;
    }

    /**
     * Initialize network
     */
    async init(container) {
        this.container = container;
        await this.loadData();
        await this.preloadImages();
        return this;
    }

    /**
     * Load fun data
     */
    async loadData() {
        try {
            const response = await fetch('/content/fun.json');
            this.data = await response.json();
        } catch (error) {
            console.error('Failed to load fun data:', error);
            this.data = { images: [] };
        }
    }

    /**
     * Preload all images
     */
    async preloadImages() {
        const promises = this.data.images.map(item => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.loadedImages.set(item.id, img);
                    this.grayscaleImages.set(item.id, this.createGrayscale(img));
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = item.src;
            });
        });
        await Promise.all(promises);
    }

    /**
     * Pre-render a grayscale version of an image (works on all browsers)
     */
    createGrayscale(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            d[i] = gray;
            d[i + 1] = gray;
            d[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Create canvas and layout
     */
    createCanvas() {
        this.container.innerHTML = `
            <div class="fun-network">
                <canvas class="fun-network__canvas"></canvas>
                <div class="fun-network__tooltip"></div>
            </div>
        `;
        this.canvas = this.container.querySelector('.fun-network__canvas');
        this.tooltip = this.container.querySelector('.fun-network__tooltip');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Calculate node positions in organic network layout
     */
    calculateLayout() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = Math.max(700, rect.height || 700);

        this.canvas.width = width;
        this.canvas.height = height;

        const centerX = width / 2;
        const centerY = height / 2;
        const count = this.data.images.length;

        // Calculate image sizes based on viewport
        const baseSize = Math.min(width, height) * 0.26;

        // Position images in an organic scattered pattern
        const positions = this.generatePositions(count, centerX, centerY, width, height, baseSize);

        this.nodes = this.data.images.map((item, index) => {
            const size = item.span === 'large' ? baseSize * 1.3 : baseSize;
            const w = size;
            const h = size * 0.75;
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 0.4;
            return {
                ...item,
                x: positions[index].x,
                y: positions[index].y,
                width: w,
                height: h,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                mass: w * h,
                hoverScale: 1
            };
        });
    }

    /**
     * Generate organic positions for nodes
     */
    generatePositions(count, centerX, centerY, width, height, baseSize) {
        const positions = [];
        const padding = baseSize * 1.1;
        const maxAttempts = 100;

        for (let i = 0; i < count; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < maxAttempts) {
                // Generate position with some organic variation
                const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
                const radiusVariation = 0.6 + Math.random() * 0.4;
                const radius = Math.min(width, height) * 0.38 * radiusVariation;

                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                // Check for overlaps with existing positions
                let valid = true;
                for (const pos of positions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < padding * 1.5) {
                        valid = false;
                        break;
                    }
                }

                // Check boundaries
                if (x < padding || x > width - padding || y < padding || y > height - padding) {
                    valid = false;
                }

                if (valid) {
                    positions.push({ x, y });
                    placed = true;
                }
                attempts++;
            }

            // Fallback position if couldn't find valid spot
            if (!placed) {
                const angle = (i / count) * Math.PI * 2;
                const radius = Math.min(width, height) * 0.4;
                positions.push({
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius
                });
            }
        }

        return positions;
    }

    /**
     * Create edges connecting nodes
     */
    createEdges() {
        this.edges = [];

        // Connect each node to 2-3 nearest neighbors
        for (let i = 0; i < this.nodes.length; i++) {
            const distances = [];
            for (let j = 0; j < this.nodes.length; j++) {
                if (i !== j) {
                    const dx = this.nodes[i].x - this.nodes[j].x;
                    const dy = this.nodes[i].y - this.nodes[j].y;
                    distances.push({ index: j, dist: Math.sqrt(dx * dx + dy * dy) });
                }
            }
            distances.sort((a, b) => a.dist - b.dist);

            // Connect to 2 nearest neighbors
            for (let k = 0; k < Math.min(2, distances.length); k++) {
                const j = distances[k].index;
                // Avoid duplicate edges
                const exists = this.edges.some(e =>
                    (e.from === i && e.to === j) || (e.from === j && e.to === i)
                );
                if (!exists) {
                    this.edges.push({ from: i, to: j });
                }
            }
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: true });

        this.resizeObserver = new ResizeObserver(() => {
            this.calculateLayout();
            this.createEdges();
            this.lastTimestamp = null;
        });
        this.resizeObserver.observe(this.container);
    }

    /**
     * Handle mouse move for hover effects
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let foundNode = null;
        for (const node of this.nodes) {
            const halfW = node.width / 2;
            const halfH = node.height / 2;
            if (x >= node.x - halfW && x <= node.x + halfW &&
                y >= node.y - halfH && y <= node.y + halfH) {
                foundNode = node;
                break;
            }
        }

        if (foundNode !== this.hoveredNode) {
            this.hoveredNode = foundNode;
            if (foundNode) {
                this.showTooltip(foundNode, e.clientX, e.clientY);
                this.canvas.style.cursor = foundNode.url ? 'pointer' : 'default';
            } else {
                this.hideTooltip();
                this.canvas.style.cursor = 'default';
            }
        } else if (foundNode) {
            this.updateTooltipPosition(e.clientX, e.clientY);
        }
    }

    /**
     * Handle touch for mobile tap-to-open
     */
    handleTouch(e) {
        const touch = e.touches[0];
        if (!touch) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        this.hoveredNode = null;
        for (const node of this.nodes) {
            const halfW = node.width / 2;
            const halfH = node.height / 2;
            if (x >= node.x - halfW && x <= node.x + halfW &&
                y >= node.y - halfH && y <= node.y + halfH) {
                this.hoveredNode = node;
                break;
            }
        }
    }

    /**
     * Handle click to open link
     */
    handleClick() {
        if (this.hoveredNode && this.hoveredNode.url) {
            window.open(this.hoveredNode.url, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Show tooltip
     */
    showTooltip(node, x, y) {
        this.tooltip.innerHTML = `
            <div class="fun-network__tooltip-title">${node.alt}</div>
        `;
        this.tooltip.classList.add('visible');
        this.updateTooltipPosition(x, y);
    }

    /**
     * Update tooltip position
     */
    updateTooltipPosition(x, y) {
        const rect = this.container.getBoundingClientRect();
        this.tooltip.style.left = `${x - rect.left + 15}px`;
        this.tooltip.style.top = `${y - rect.top - 10}px`;
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        this.tooltip.classList.remove('visible');
        this.hoveredNode = null;
    }

    /**
     * Render the network
     */
    render() {
        if (!this.data) return;

        // Recreate canvas if it was cleaned up or doesn't exist
        if (!this.canvas || !this.ctx) {
            this.createCanvas();
            this.calculateLayout();
            this.createEdges();
            this.setupEventListeners();
        }

        this.isActive = true;
        this.lastTimestamp = null;
        this.draw(performance.now());
    }

    /**
     * Update node positions — drift + wall bounce + node-node collisions
     */
    update(dt) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const nodes = this.nodes;
        const minSpeed = 0.3;
        const maxSpeed = 2.5;

        // Move nodes
        for (const n of nodes) {
            n.x += n.vx * dt;
            n.y += n.vy * dt;

            // Wall bounce
            const halfW = n.width / 2;
            const halfH = n.height / 2;
            if (n.x - halfW < 0) { n.x = halfW; n.vx = Math.abs(n.vx); }
            if (n.x + halfW > w) { n.x = w - halfW; n.vx = -Math.abs(n.vx); }
            if (n.y - halfH < 0) { n.y = halfH; n.vy = Math.abs(n.vy); }
            if (n.y + halfH > h) { n.y = h - halfH; n.vy = -Math.abs(n.vy); }
        }

        // Node-node elastic collisions (circle-based)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const rA = Math.max(a.width, a.height) / 2 * 0.85;
                const rB = Math.max(b.width, b.height) / 2 * 0.85;
                const minDist = rA + rB;

                if (dist < minDist && dist > 0) {
                    // Normal vector
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Separate overlapping nodes
                    const overlap = (minDist - dist) / 2;
                    a.x -= nx * overlap;
                    a.y -= ny * overlap;
                    b.x += nx * overlap;
                    b.y += ny * overlap;

                    // Relative velocity along normal
                    const dvx = a.vx - b.vx;
                    const dvy = a.vy - b.vy;
                    const dvn = dvx * nx + dvy * ny;

                    // Only resolve if approaching
                    if (dvn > 0) {
                        const totalMass = a.mass + b.mass;
                        const impulse = (2 * dvn) / totalMass;
                        a.vx -= impulse * b.mass * nx;
                        a.vy -= impulse * b.mass * ny;
                        b.vx += impulse * a.mass * nx;
                        b.vy += impulse * a.mass * ny;
                    }
                }
            }
        }

        // Clamp speeds
        for (const n of nodes) {
            const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (speed < minSpeed) {
                const scale = minSpeed / speed;
                n.vx *= scale;
                n.vy *= scale;
            } else if (speed > maxSpeed) {
                const scale = maxSpeed / speed;
                n.vx *= scale;
                n.vy *= scale;
            }
        }
    }

    /**
     * Draw the network
     */
    draw(timestamp) {
        if (!this.isActive) return;

        // Compute delta time (capped at 32ms to prevent tunneling)
        if (this.lastTimestamp) {
            const dt = Math.min(timestamp - this.lastTimestamp, 32) / 16.667;
            this.update(dt);
        }
        this.lastTimestamp = timestamp;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Draw edges first (behind images)
        this.drawEdges(ctx);

        // Draw nodes (images)
        this.drawNodes(ctx);

        this.animationId = requestAnimationFrame((ts) => this.draw(ts));
    }

    /**
     * Draw connecting edges
     */
    drawEdges(ctx) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;

        for (const edge of this.edges) {
            const from = this.nodes[edge.from];
            const to = this.nodes[edge.to];

            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Draw image nodes
     */
    drawNodes(ctx) {
        for (const node of this.nodes) {
            const img = this.loadedImages.get(node.id);
            if (!img) continue;

            const isHovered = this.hoveredNode === node;
            const scale = isHovered ? 1.08 : 1;
            const width = node.width * scale;
            const height = node.height * scale;
            const x = node.x - width / 2;
            const y = node.y - height / 2;

            // Save context for effects
            ctx.save();

            // Add glow on hover
            if (isHovered) {
                ctx.shadowColor = '#ff4500';
                ctx.shadowBlur = 20;
            }

            // Draw border/frame
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x - 3, y - 3, width + 6, height + 6);
            ctx.strokeStyle = isHovered ? '#ff4500' : '#333333';
            ctx.lineWidth = isHovered ? 2 : 1;
            ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);

            ctx.shadowBlur = 0;

            // Draw image (pre-rendered grayscale for non-hovered)
            if (!isHovered) {
                const grayImg = this.grayscaleImages.get(node.id);
                ctx.drawImage(grayImg || img, x, y, width, height);
            } else {
                ctx.drawImage(img, x, y, width, height);
            }

            ctx.restore();
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.isActive = false;
        this.lastTimestamp = null;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        // Clear references so render() knows to recreate
        this.canvas = null;
        this.ctx = null;
        this.tooltip = null;
    }
}

export default Collage;
