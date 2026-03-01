/**
 * Node Network - Section labels at vertices of an ASCII triangle framing the ouroboros
 */

export class NodeNetwork {
    constructor() {
        this.nodes = [];
        this.center = { x: 0, y: 0 };
        this.hoveredNode = null;
        this.color = '#ffffff';
        this.accentColor = '#ff4500';
        this.flowOffset = 0;
        this.flowChars = '·-~=*=~-';
        this.charSpacing = 14;
        this.fontSize = 22;
    }

    /**
     * Initialize with center point and viewport dimensions.
     * Returns the adjusted center so the ouroboros can be shifted to match.
     */
    init(centerX, centerY, width, height, radius) {
        const isMobile = width < 768;
        this.fontSize = isMobile ? 16 : 22;
        const labelPad = isMobile ? 90 : 80;

        const idealDistance = radius * 4;
        const horizontalMax = (width / 2 - labelPad) / Math.cos(Math.PI / 6);
        const verticalMax = height / 2 - (isMobile ? 70 : 60);
        const distance = Math.min(idealDistance, horizontalMax, verticalMax);

        const labelOffset = isMobile ? 12 : 16;
        const bottomLabelGap = isMobile ? 18 : 24;

        // Compute raw vertex positions relative to 0,0 then find bounding box
        const raw = [
            { angle: -Math.PI / 6,     lox: labelOffset,  loy: 0,              ta: 'left',   label: 'Work' },
            { angle: -5 * Math.PI / 6, lox: -labelOffset, loy: 0,              ta: 'right',  label: 'Writing' },
            { angle: Math.PI / 2,      lox: 0,            loy: bottomLabelGap, ta: 'center', label: 'Fun' },
        ];

        // Estimate label pixel widths for bounding box (monospace ~0.6 * fontSize per char)
        const charPx = this.fontSize * 0.6;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (const r of raw) {
            const vx = Math.cos(r.angle) * distance;
            const vy = Math.sin(r.angle) * distance;

            // Label extent
            const labelW = r.label.length * charPx;
            let labelLeft, labelRight;
            if (r.ta === 'left')        { labelLeft = vx + r.lox;            labelRight = vx + r.lox + labelW; }
            else if (r.ta === 'right')  { labelLeft = vx + r.lox - labelW;   labelRight = vx + r.lox; }
            else                        { labelLeft = vx - labelW / 2;        labelRight = vx + labelW / 2; }

            const labelTop = vy + r.loy - this.fontSize / 2;
            const labelBottom = vy + r.loy + this.fontSize / 2;

            minX = Math.min(minX, vx, labelLeft);
            maxX = Math.max(maxX, vx, labelRight);
            minY = Math.min(minY, vy, labelTop);
            maxY = Math.max(maxY, vy, labelBottom);
        }

        // Shift so bounding box is centered in viewport
        const bboxCenterX = (minX + maxX) / 2;
        const bboxCenterY = (minY + maxY) / 2;

        const adjCenterX = width / 2 - bboxCenterX;
        const adjCenterY = height / 2 - bboxCenterY;

        this.center = { x: adjCenterX, y: adjCenterY };

        this.nodes = raw.map(r => ({
            id: r.label.toLowerCase(),
            label: r.label,
            x: adjCenterX + Math.cos(r.angle) * distance,
            y: adjCenterY + Math.sin(r.angle) * distance,
            labelOffsetX: r.lox,
            labelOffsetY: r.loy,
            textAlign: r.ta,
        }));

        return this.center;
    }

    /**
     * Update flow animation
     */
    update(deltaTime, rotation) {
        this.flowOffset += deltaTime * 0.03;
    }

    /**
     * Render flowing edges, dots, and labels
     */
    render(ctx) {
        this.renderEdges(ctx);
        this.nodes.forEach(node => {
            this.renderDot(ctx, node);
            this.renderLabel(ctx, node);
        });
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

        ctx.font = '10px "SF Mono", Monaco, monospace';
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
                const alpha = Math.min(1, edgeFade) * 0.35;

                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.color;
                ctx.fillText(char, x, y);
            }
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Render vertex dot
     */
    renderDot(ctx, node) {
        const isHovered = this.hoveredNode === node.id;
        const r = isHovered ? 5 : 3;

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? this.accentColor : this.color;

        if (isHovered) {
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 10;
        }

        ctx.fill();
        ctx.shadowBlur = 0;
    }

    /**
     * Render label text positioned outside each vertex
     */
    renderLabel(ctx, node) {
        const isHovered = this.hoveredNode === node.id;

        ctx.font = `${isHovered ? '600' : '500'} ${this.fontSize}px "SF Mono", Monaco, monospace`;
        ctx.fillStyle = isHovered ? this.accentColor : this.color;
        ctx.textAlign = node.textAlign;
        ctx.textBaseline = 'middle';

        if (isHovered) {
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 10;
        }

        ctx.fillText(
            node.label,
            node.x + node.labelOffsetX,
            node.y + node.labelOffsetY
        );
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
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 40) {
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
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 40) {
                return node.id;
            }
        }
        return null;
    }
}

export default NodeNetwork;
