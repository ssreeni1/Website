/**
 * Node Network - Animated lines connecting ouroboros to section labels
 */

export class NodeNetwork {
    constructor() {
        this.nodes = [];
        this.center = { x: 0, y: 0 };
        this.hoveredNode = null;
        this.pulseOffset = 0;
        this.color = '#ffffff';
        this.accentColor = '#ff4500';
    }

    /**
     * Initialize with center point and viewport dimensions
     */
    init(centerX, centerY, width, height, radius) {
        this.center = { x: centerX, y: centerY };

        // Calculate node positions around the ouroboros
        const distance = radius * 2.5;

        this.nodes = [
            {
                id: 'work',
                label: 'Work',
                angle: -Math.PI / 4, // Top-right
                x: centerX + Math.cos(-Math.PI / 4) * distance,
                y: centerY + Math.sin(-Math.PI / 4) * distance,
                progress: 0 // For draw-in animation
            },
            {
                id: 'writing',
                label: 'Writing',
                angle: -3 * Math.PI / 4, // Top-left
                x: centerX + Math.cos(-3 * Math.PI / 4) * distance,
                y: centerY + Math.sin(-3 * Math.PI / 4) * distance,
                progress: 0
            },
            {
                id: 'fun',
                label: 'Fun',
                angle: Math.PI / 2, // Bottom
                x: centerX + Math.cos(Math.PI / 2) * distance,
                y: centerY + Math.sin(Math.PI / 2) * distance,
                progress: 0
            }
        ];

        return this;
    }

    /**
     * Update animations
     */
    update(deltaTime) {
        // Update pulse animation
        this.pulseOffset = (this.pulseOffset + deltaTime * 0.001) % 1;

        // Update draw-in progress for each node
        this.nodes.forEach(node => {
            if (node.progress < 1) {
                node.progress = Math.min(1, node.progress + 0.02);
            }
        });
    }

    /**
     * Render nodes and connecting lines
     */
    render(ctx) {
        this.nodes.forEach(node => {
            this.renderLine(ctx, node);
            this.renderNode(ctx, node);
            this.renderLabel(ctx, node);
        });
    }

    /**
     * Render connecting line with energy pulse
     */
    renderLine(ctx, node) {
        const isHovered = this.hoveredNode === node.id;
        const progress = this.easeOutCubic(node.progress);

        // Calculate current end point based on progress
        const currentX = this.center.x + (node.x - this.center.x) * progress;
        const currentY = this.center.y + (node.y - this.center.y) * progress;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(this.center.x, this.center.y);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = isHovered ? this.accentColor : this.color;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Draw energy pulse if fully drawn
        if (node.progress >= 1) {
            const pulseT = (this.pulseOffset + this.nodes.indexOf(node) * 0.33) % 1;
            const pulseX = this.center.x + (node.x - this.center.x) * pulseT;
            const pulseY = this.center.y + (node.y - this.center.y) * pulseT;

            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
            ctx.fillStyle = this.accentColor;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    /**
     * Render node circle
     */
    renderNode(ctx, node) {
        if (node.progress < 1) return;

        const isHovered = this.hoveredNode === node.id;
        const radius = isHovered ? 10 : 7;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? this.accentColor : this.color;

        if (isHovered) {
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 15;
        }

        ctx.fill();
        ctx.shadowBlur = 0;
    }

    /**
     * Render node label
     */
    renderLabel(ctx, node) {
        if (node.progress < 1) return;

        const isHovered = this.hoveredNode === node.id;

        ctx.font = `${isHovered ? '600' : '500'} 14px "SF Mono", Monaco, monospace`;
        ctx.fillStyle = isHovered ? this.accentColor : this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Position label outside the node
        const labelDistance = 25;
        const labelX = node.x + Math.cos(node.angle) * labelDistance;
        const labelY = node.y + Math.sin(node.angle) * labelDistance;

        if (isHovered) {
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 10;
        }

        ctx.fillText(node.label, labelX, labelY);
        ctx.shadowBlur = 0;
    }

    /**
     * Handle mouse/touch position for hover effects
     */
    handleHover(x, y) {
        this.hoveredNode = null;

        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 30) { // Hit area
                this.hoveredNode = node.id;
                break;
            }
        }

        return this.hoveredNode;
    }

    /**
     * Get node at point (for click handling)
     */
    getNodeAtPoint(x, y) {
        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 30) {
                return node.id;
            }
        }
        return null;
    }

    /**
     * Easing function for smooth animations
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
}

export default NodeNetwork;
