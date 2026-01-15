/**
 * Writing Network - Interactive node network visualization
 * Gray shimmering orbs with orange hover effect
 */

export class WritingNetwork {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.data = null;
        this.nodes = [];
        this.edges = [];
        this.hoveredNode = null;
        this.animationId = null;
        this.isActive = false;
        this.time = 0;
        this.seedRandom = null;
    }

    /**
     * Seeded random for consistent layout
     */
    seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Initialize writing section
     */
    async init(container) {
        this.container = container;
        await this.loadData();
        this.createCanvas();
        this.calculateLayout();
        this.createEdges();
        this.setupEventListeners();
        return this;
    }

    /**
     * Load writing data
     */
    async loadData() {
        try {
            const response = await fetch('/content/writing.json');
            this.data = await response.json();
        } catch (error) {
            console.error('Failed to load writing data:', error);
            this.data = { items: [] };
        }
    }

    /**
     * Create canvas element
     */
    createCanvas() {
        this.container.innerHTML = `
            <div class="writing-network">
                <canvas class="writing-network__canvas"></canvas>
                <div class="writing-network__tooltip"></div>
            </div>
        `;
        this.canvas = this.container.querySelector('.writing-network__canvas');
        this.tooltip = this.container.querySelector('.writing-network__tooltip');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Calculate node layout - random scattered arrangement
     */
    calculateLayout() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = Math.max(500, rect.height || 600);

        this.canvas.width = width;
        this.canvas.height = height;

        const centerX = width / 2;
        const centerY = height / 2;
        const count = this.data.items.length;
        const nodeRadius = 16;
        const padding = 80;

        // Generate random positions with collision avoidance
        const positions = [];
        let seed = 42; // Fixed seed for consistent layout

        for (let i = 0; i < count; i++) {
            let placed = false;
            let attempts = 0;
            const maxAttempts = 200;

            while (!placed && attempts < maxAttempts) {
                // Random position within bounds
                const angle = this.seededRandom(seed++) * Math.PI * 2;
                const distance = this.seededRandom(seed++) * Math.min(width, height) * 0.35 + 50;

                // Add some randomness to make it more organic
                const jitterX = (this.seededRandom(seed++) - 0.5) * 100;
                const jitterY = (this.seededRandom(seed++) - 0.5) * 100;

                const x = centerX + Math.cos(angle) * distance + jitterX;
                const y = centerY + Math.sin(angle) * distance + jitterY;

                // Check boundaries
                if (x < padding || x > width - padding || y < padding || y > height - padding) {
                    attempts++;
                    continue;
                }

                // Check for overlaps
                let valid = true;
                for (const pos of positions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < nodeRadius * 4) {
                        valid = false;
                        break;
                    }
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
                const distance = Math.min(width, height) * 0.3;
                positions.push({
                    x: centerX + Math.cos(angle) * distance,
                    y: centerY + Math.sin(angle) * distance
                });
            }
        }

        this.nodes = this.data.items.map((item, index) => ({
            ...item,
            x: positions[index].x,
            y: positions[index].y,
            radius: nodeRadius,
            shimmerOffset: Math.random() * Math.PI * 2
        }));
    }

    /**
     * Create edges - highly interconnected random web
     */
    createEdges() {
        this.edges = [];
        const n = this.nodes.length;

        // Connect each node to 3-4 nearest neighbors
        for (let i = 0; i < n; i++) {
            const distances = [];
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const dx = this.nodes[i].x - this.nodes[j].x;
                    const dy = this.nodes[i].y - this.nodes[j].y;
                    distances.push({ index: j, dist: Math.sqrt(dx * dx + dy * dy) });
                }
            }
            distances.sort((a, b) => a.dist - b.dist);

            // Connect to 3-4 nearest neighbors
            const connectCount = Math.min(4, distances.length);
            for (let k = 0; k < connectCount; k++) {
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

        // Add some random cross-connections for more chaos
        let seed = 123;
        for (let i = 0; i < n; i++) {
            const randomTarget = Math.floor(this.seededRandom(seed++) * n);
            if (randomTarget !== i) {
                const exists = this.edges.some(e =>
                    (e.from === i && e.to === randomTarget) || (e.from === randomTarget && e.to === i)
                );
                if (!exists) {
                    this.edges.push({ from: i, to: randomTarget });
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

        // Handle resize
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
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < node.radius + 10) {
                foundNode = node;
                break;
            }
        }

        if (foundNode !== this.hoveredNode) {
            this.hoveredNode = foundNode;
            if (foundNode) {
                this.showTooltip(foundNode, e.clientX, e.clientY);
                this.canvas.style.cursor = 'pointer';
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
    handleClick(e) {
        if (this.hoveredNode && this.hoveredNode.url) {
            window.open(this.hoveredNode.url, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Show tooltip
     */
    showTooltip(node, x, y) {
        const date = new Date(node.date).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        });

        this.tooltip.innerHTML = `
            <div class="writing-network__tooltip-title">${node.title}</div>
            <div class="writing-network__tooltip-meta">
                <span class="writing-network__tooltip-type">${node.type}</span>
                <span class="writing-network__tooltip-date">${date}</span>
            </div>
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

        // Recreate canvas if it was cleaned up
        if (!this.canvas || !this.ctx) {
            this.createCanvas();
            this.calculateLayout();
            this.createEdges();
            this.setupEventListeners();
        }

        this.isActive = true;
        this.time = performance.now();
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
        this.time = performance.now();

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Draw edges
        this.drawEdges(ctx);

        // Draw nodes
        this.drawNodes(ctx);

        // Continue animation for shimmer effect
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    /**
     * Draw connecting edges
     */
    drawEdges(ctx) {
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.25;

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
     * Draw nodes - gray shimmering orbs, orange on hover
     */
    drawNodes(ctx) {
        for (const node of this.nodes) {
            const isHovered = this.hoveredNode === node;
            const baseRadius = node.radius;
            const radius = isHovered ? baseRadius + 4 : baseRadius;

            // Calculate shimmer effect
            const shimmer = Math.sin(this.time * 0.002 + node.shimmerOffset) * 0.15 + 0.85;

            if (isHovered) {
                // Orange glow for hovered
                ctx.shadowColor = '#ff4500';
                ctx.shadowBlur = 25;

                // Outer glow ring
                const gradient = ctx.createRadialGradient(
                    node.x, node.y, radius * 0.5,
                    node.x, node.y, radius * 1.5
                );
                gradient.addColorStop(0, '#ff4500');
                gradient.addColorStop(0.5, 'rgba(255, 69, 0, 0.5)');
                gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();

                // Main orb - solid orange
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4500';
                ctx.fill();

                // Inner highlight
                const innerGradient = ctx.createRadialGradient(
                    node.x - radius * 0.3, node.y - radius * 0.3, 0,
                    node.x, node.y, radius
                );
                innerGradient.addColorStop(0, 'rgba(255, 200, 150, 0.6)');
                innerGradient.addColorStop(0.5, 'rgba(255, 100, 50, 0.3)');
                innerGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = innerGradient;
                ctx.fill();

            } else {
                // Gray shimmering orb
                const grayBase = Math.floor(80 + shimmer * 40);
                const grayHighlight = Math.floor(140 + shimmer * 60);

                // Subtle outer glow
                ctx.shadowColor = `rgba(${grayHighlight}, ${grayHighlight}, ${grayHighlight}, 0.5)`;
                ctx.shadowBlur = 8;

                // Main orb gradient
                const gradient = ctx.createRadialGradient(
                    node.x - radius * 0.3, node.y - radius * 0.3, 0,
                    node.x, node.y, radius * 1.2
                );
                gradient.addColorStop(0, `rgb(${grayHighlight + 30}, ${grayHighlight + 30}, ${grayHighlight + 30})`);
                gradient.addColorStop(0.4, `rgb(${grayBase + 40}, ${grayBase + 40}, ${grayBase + 40})`);
                gradient.addColorStop(0.8, `rgb(${grayBase}, ${grayBase}, ${grayBase})`);
                gradient.addColorStop(1, `rgb(${grayBase - 20}, ${grayBase - 20}, ${grayBase - 20})`);

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();

                // Specular highlight
                const specGradient = ctx.createRadialGradient(
                    node.x - radius * 0.4, node.y - radius * 0.4, 0,
                    node.x - radius * 0.2, node.y - radius * 0.2, radius * 0.5
                );
                specGradient.addColorStop(0, `rgba(255, 255, 255, ${0.3 * shimmer})`);
                specGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = specGradient;
                ctx.fill();
            }

            ctx.shadowBlur = 0;
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

export default WritingNetwork;
