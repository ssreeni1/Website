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
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = item.src;
            });
        });
        await Promise.all(promises);
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
        const height = Math.max(500, rect.height || 600);

        this.canvas.width = width;
        this.canvas.height = height;

        const centerX = width / 2;
        const centerY = height / 2;
        const count = this.data.images.length;

        // Calculate image sizes based on viewport
        const baseSize = Math.min(width, height) * 0.18;

        // Position images in an organic scattered pattern
        const positions = this.generatePositions(count, centerX, centerY, width, height, baseSize);

        this.nodes = this.data.images.map((item, index) => {
            const size = item.span === 'large' ? baseSize * 1.3 : baseSize;
            return {
                ...item,
                x: positions[index].x,
                y: positions[index].y,
                width: size,
                height: size * 0.75,
                hoverScale: 1
            };
        });
    }

    /**
     * Generate organic positions for nodes
     */
    generatePositions(count, centerX, centerY, width, height, baseSize) {
        const positions = [];
        const padding = baseSize * 0.8;
        const maxAttempts = 100;

        for (let i = 0; i < count; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < maxAttempts) {
                // Generate position with some organic variation
                const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
                const radiusVariation = 0.6 + Math.random() * 0.4;
                const radius = Math.min(width, height) * 0.28 * radiusVariation;

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
                const radius = Math.min(width, height) * 0.3;
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

        this.resizeObserver = new ResizeObserver(() => {
            this.calculateLayout();
            this.createEdges();
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
        this.draw();
    }

    /**
     * Draw the network
     */
    draw() {
        if (!this.isActive) return;

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

        this.animationId = requestAnimationFrame(() => this.draw());
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

            // Apply grayscale filter for non-hovered images
            if (!isHovered) {
                ctx.filter = 'grayscale(100%)';
            } else {
                ctx.filter = 'grayscale(0%)';
            }

            // Draw image
            ctx.drawImage(img, x, y, width, height);

            ctx.restore();
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.isActive = false;
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
