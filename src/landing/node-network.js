/**
 * Node Network - Metallic orbs at triangle vertices with flowing ASCII edges
 */

export class NodeNetwork {
    constructor() {
        this.nodes = [];
        this.center = { x: 0, y: 0 };
        this.hoveredNode = null;
        this.accentColor = '#ff4500';
        this.flowOffset = 0;
        this.flowChars = '·-~=*=~-';
        this.charSpacing = 14;
        this.orbRadius = 16;
        this.time = 0;
    }

    /**
     * Initialize with center point and viewport dimensions.
     * Returns the adjusted center so the ouroboros can be shifted to match.
     */
    init(centerX, centerY, width, height, radius) {
        const isMobile = width < 768;
        this.orbRadius = isMobile ? 12 : 16;

        const pad = this.orbRadius + 10;
        const idealDistance = radius * (isMobile ? 5 : 4);
        const horizontalMax = (width / 2 - pad) / Math.cos(Math.PI / 6);
        const verticalMax = height / 2 - pad;
        const distance = Math.min(idealDistance, horizontalMax, verticalMax);

        const raw = [
            { angle: -Math.PI / 6,     label: 'Work' },
            { angle: -5 * Math.PI / 6, label: 'Writing' },
            { angle: Math.PI / 2,      label: 'Fun' },
        ];

        // Bounding box for centering
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const r of raw) {
            const vx = Math.cos(r.angle) * distance;
            const vy = Math.sin(r.angle) * distance;
            minX = Math.min(minX, vx - this.orbRadius);
            maxX = Math.max(maxX, vx + this.orbRadius);
            minY = Math.min(minY, vy - this.orbRadius);
            maxY = Math.max(maxY, vy + this.orbRadius);
        }

        const adjCenterX = width / 2 - (minX + maxX) / 2;
        const adjCenterY = height / 2 - (minY + maxY) / 2;
        this.center = { x: adjCenterX, y: adjCenterY };

        this.nodes = raw.map(r => ({
            id: r.label.toLowerCase(),
            label: r.label,
            angle: r.angle,
            x: adjCenterX + Math.cos(r.angle) * distance,
            y: adjCenterY + Math.sin(r.angle) * distance,
            shimmerOffset: Math.random() * Math.PI * 2,
        }));

        return this.center;
    }

    /**
     * Update flow animation
     */
    update(deltaTime, rotation) {
        this.flowOffset += deltaTime * 0.03;
        this.time = performance.now();
    }

    /**
     * Render flowing edges and orbs
     */
    render(ctx) {
        this.renderEdges(ctx);
        this.nodes.forEach(node => this.renderOrb(ctx, node));
    }

    /**
     * Render flowing ASCII characters along each triangle edge
     */
    renderEdges(ctx) {
        const n = this.nodes;
        const edges = [
            [n[0], n[1]],
            [n[1], n[2]],
            [n[2], n[0]],
        ];

        ctx.font = '10px "Electrolize", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const [a, b] of edges) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const count = Math.floor(length / this.charSpacing);

            for (let i = 1; i < count; i++) {
                const t = i / count;
                const x = a.x + dx * t;
                const y = a.y + dy * t;

                const charIdx = Math.floor(i + this.flowOffset) % this.flowChars.length;
                const char = this.flowChars[charIdx];

                // Fade near vertices
                const edgeFade = Math.min(t, 1 - t) * 4;
                const alpha = Math.min(1, edgeFade) * 0.95;

                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.accentColor;
                ctx.fillText(char, x, y);
            }
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Render metallic shimmering orb at vertex
     */
    renderOrb(ctx, node) {
        const isHovered = this.hoveredNode === node.id;
        const r = isHovered ? this.orbRadius + 4 : this.orbRadius;
        const shimmer = Math.sin(this.time * 0.002 + node.shimmerOffset) * 0.15 + 0.85;

        // Pulsating glow intensity
        const pulse = Math.sin(this.time * 0.005 + node.shimmerOffset) * 0.5 + 0.5;
        const glowRadius = r * (2.0 + pulse * 1.2);
        const shadowIntensity = isHovered ? 40 : 20 + pulse * 25;

        // Outer pulsating glow
        ctx.shadowColor = this.accentColor;
        ctx.shadowBlur = shadowIntensity;

        const glow = ctx.createRadialGradient(node.x, node.y, r * 0.3, node.x, node.y, glowRadius);
        glow.addColorStop(0, `rgba(255, 69, 0, ${isHovered ? 0.8 : 0.5 * pulse})`);
        glow.addColorStop(0.5, `rgba(255, 69, 0, ${isHovered ? 0.4 : 0.2 * pulse})`);
        glow.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Main orb
        const main = ctx.createRadialGradient(
            node.x - r * 0.3, node.y - r * 0.3, 0,
            node.x, node.y, r
        );
        main.addColorStop(0, '#ff8c42');
        main.addColorStop(0.5, '#ff4500');
        main.addColorStop(1, '#cc3700');
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = main;
        ctx.fill();

        // Specular highlight
        const spec = ctx.createRadialGradient(
            node.x - r * 0.35, node.y - r * 0.35, 0,
            node.x - r * 0.15, node.y - r * 0.15, r * 0.5
        );
        spec.addColorStop(0, `rgba(255, 220, 180, ${0.5 * shimmer})`);
        spec.addColorStop(1, 'rgba(255, 220, 180, 0)');
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = spec;
        ctx.fill();

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
            if (Math.sqrt(dx * dx + dy * dy) < this.orbRadius + 10) {
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
            if (Math.sqrt(dx * dx + dy * dy) < this.orbRadius + 10) return node.id;
        }
        return null;
    }
}

export default NodeNetwork;
