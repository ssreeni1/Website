/**
 * Writing Network Graph
 * Interactive force-directed graph visualization
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
        this.pulseOffset = 0;

        // Physics
        this.centerForce = 0.01;
        this.repulsion = 2000;
        this.linkStrength = 0.05;
        this.damping = 0.85;

        // Colors
        this.colors = {
            node: '#ffffff',
            nodeHover: '#ff4500',
            edge: 'rgba(255, 255, 255, 0.2)',
            edgeHighlight: 'rgba(255, 69, 0, 0.6)',
            text: '#ffffff',
            textMuted: 'rgba(255, 255, 255, 0.6)'
        };
    }

    /**
     * Initialize network
     */
    async init(container) {
        this.container = container;
        await this.loadData();
        this.createCanvas();
        this.initializePositions();
        this.setupEventListeners();
        return this;
    }

    /**
     * Load network data
     */
    async loadData() {
        try {
            const response = await fetch('/content/writing.json');
            this.data = await response.json();
        } catch (error) {
            console.error('Failed to load writing data:', error);
            this.data = { nodes: [], edges: [], types: {} };
        }
    }

    /**
     * Create canvas
     */
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'writing-canvas';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
    }

    /**
     * Initialize node positions
     */
    initializePositions() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;

        this.nodes = this.data.nodes.map((node, i) => {
            const angle = (i / this.data.nodes.length) * Math.PI * 2 - Math.PI / 2;
            return {
                ...node,
                x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
                y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
                vx: 0,
                vy: 0,
                radius: 20
            };
        });

        this.edges = this.data.edges.map(edge => ({
            source: this.nodes.find(n => n.id === edge.source),
            target: this.nodes.find(n => n.id === edge.target)
        })).filter(e => e.source && e.target);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleHover(x, y);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredNode = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleClick(x, y);
        });

        // Touch support
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleClick(x, y);
        });
    }

    /**
     * Handle resize
     */
    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = Math.max(500, window.innerHeight - 200);

        if (this.nodes.length > 0) {
            this.initializePositions();
        }
    }

    /**
     * Handle hover
     */
    handleHover(x, y) {
        this.hoveredNode = null;

        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < node.radius + 10) {
                this.hoveredNode = node;
                break;
            }
        }

        this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'default';
    }

    /**
     * Handle click
     */
    handleClick(x, y) {
        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < node.radius + 10) {
                window.open(node.url, '_blank', 'noopener,noreferrer');
                return;
            }
        }
    }

    /**
     * Start rendering
     */
    render() {
        this.isActive = true;
        this.animate();
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isActive) return;

        this.updatePhysics();
        this.draw();
        this.pulseOffset = (this.pulseOffset + 0.01) % 1;

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Update physics simulation
     */
    updatePhysics() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Apply forces
        for (const node of this.nodes) {
            // Center force
            node.vx += (centerX - node.x) * this.centerForce;
            node.vy += (centerY - node.y) * this.centerForce;

            // Repulsion from other nodes
            for (const other of this.nodes) {
                if (node === other) continue;

                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = this.repulsion / (distance * distance);

                node.vx += (dx / distance) * force;
                node.vy += (dy / distance) * force;
            }
        }

        // Link forces
        for (const edge of this.edges) {
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (distance - 150) * this.linkStrength;

            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            edge.source.vx += fx;
            edge.source.vy += fy;
            edge.target.vx -= fx;
            edge.target.vy -= fy;
        }

        // Apply velocity and damping
        for (const node of this.nodes) {
            node.vx *= this.damping;
            node.vy *= this.damping;
            node.x += node.vx;
            node.y += node.vy;

            // Boundary constraints
            const margin = 50;
            node.x = Math.max(margin, Math.min(this.canvas.width - margin, node.x));
            node.y = Math.max(margin, Math.min(this.canvas.height - margin, node.y));
        }
    }

    /**
     * Draw everything
     */
    draw() {
        // Clear
        this.ctx.fillStyle = 'transparent';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw edges
        this.drawEdges();

        // Draw nodes
        this.drawNodes();
    }

    /**
     * Draw edges
     */
    drawEdges() {
        for (const edge of this.edges) {
            const isHighlighted = this.hoveredNode &&
                (edge.source === this.hoveredNode || edge.target === this.hoveredNode);

            this.ctx.beginPath();
            this.ctx.moveTo(edge.source.x, edge.source.y);
            this.ctx.lineTo(edge.target.x, edge.target.y);
            this.ctx.strokeStyle = isHighlighted ? this.colors.edgeHighlight : this.colors.edge;
            this.ctx.lineWidth = isHighlighted ? 2 : 1;
            this.ctx.stroke();

            // Draw energy pulse on highlighted edges
            if (isHighlighted) {
                const pulseT = this.pulseOffset;
                const pulseX = edge.source.x + (edge.target.x - edge.source.x) * pulseT;
                const pulseY = edge.source.y + (edge.target.y - edge.source.y) * pulseT;

                this.ctx.beginPath();
                this.ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ff4500';
                this.ctx.fill();
            }
        }
    }

    /**
     * Draw nodes
     */
    drawNodes() {
        for (const node of this.nodes) {
            const isHovered = node === this.hoveredNode;
            const isConnected = this.hoveredNode && this.edges.some(
                e => (e.source === this.hoveredNode && e.target === node) ||
                     (e.target === this.hoveredNode && e.source === node)
            );
            const isActive = isHovered || isConnected;

            const radius = isHovered ? node.radius + 5 : node.radius;

            // Draw node circle
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

            if (isActive) {
                this.ctx.fillStyle = '#ff4500';
                this.ctx.shadowColor = '#ff4500';
                this.ctx.shadowBlur = 20;
            } else {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }

            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Draw type icon/letter
            this.ctx.font = '12px "SF Mono", Monaco, monospace';
            this.ctx.fillStyle = isActive ? '#000' : this.colors.text;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            const typeIcon = node.type === 'twitter' ? 'X' : node.type === 'research' ? 'R' : 'P';
            this.ctx.fillText(typeIcon, node.x, node.y);

            // Draw label on hover
            if (isHovered) {
                this.drawTooltip(node);
            }
        }
    }

    /**
     * Draw tooltip for hovered node
     */
    drawTooltip(node) {
        const padding = 10;
        const lineHeight = 18;

        this.ctx.font = '14px "SF Mono", Monaco, monospace';
        const titleWidth = this.ctx.measureText(node.title).width;

        this.ctx.font = '12px "SF Mono", Monaco, monospace';
        const descWidth = node.description ? this.ctx.measureText(node.description).width : 0;

        const boxWidth = Math.min(300, Math.max(titleWidth, descWidth) + padding * 2);
        const boxHeight = node.description ? lineHeight * 2 + padding * 2 : lineHeight + padding * 2;

        let boxX = node.x - boxWidth / 2;
        let boxY = node.y - node.radius - boxHeight - 15;

        // Keep tooltip on screen
        boxX = Math.max(10, Math.min(this.canvas.width - boxWidth - 10, boxX));
        if (boxY < 10) {
            boxY = node.y + node.radius + 15;
        }

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        this.ctx.strokeStyle = '#ff4500';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Title
        this.ctx.font = '14px "SF Mono", Monaco, monospace';
        this.ctx.fillStyle = '#ff4500';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        const truncatedTitle = this.truncateText(node.title, boxWidth - padding * 2);
        this.ctx.fillText(truncatedTitle, boxX + padding, boxY + padding);

        // Description
        if (node.description) {
            this.ctx.font = '12px "SF Mono", Monaco, monospace';
            this.ctx.fillStyle = this.colors.textMuted;
            const truncatedDesc = this.truncateText(node.description, boxWidth - padding * 2);
            this.ctx.fillText(truncatedDesc, boxX + padding, boxY + padding + lineHeight);
        }
    }

    /**
     * Truncate text to fit width
     */
    truncateText(text, maxWidth) {
        let truncated = text;
        while (this.ctx.measureText(truncated).width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        return truncated.length < text.length ? truncated + '...' : truncated;
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
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

export default WritingNetwork;
