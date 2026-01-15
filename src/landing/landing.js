/**
 * Landing Page - Main orchestrator for ouroboros animation and node network
 */

import { Ouroboros } from './ouroboros.js';
import { NodeNetwork } from './node-network.js';
import { EventBus, Events } from '../core/events.js';
import { Router } from '../core/router.js';

export class Landing {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.ouroboros = new Ouroboros();
        this.nodeNetwork = new NodeNetwork();
        this.animationId = null;
        this.lastTime = 0;
        this.isActive = false;
    }

    /**
     * Initialize landing page
     */
    init(container) {
        this.container = container;
        this.createCanvas();
        this.setupEventListeners();
        this.resize();
        return this;
    }

    /**
     * Create and setup canvas element
     */
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'landing-canvas';
        this.canvas.className = 'landing-canvas';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
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

            const hoveredNode = this.nodeNetwork.handleHover(x, y);
            this.canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const clickedNode = this.nodeNetwork.getNodeAtPoint(x, y);
            if (clickedNode) {
                this.navigateToSection(clickedNode);
            }
        });

        // Touch support
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            const clickedNode = this.nodeNetwork.getNodeAtPoint(x, y);
            if (clickedNode) {
                this.navigateToSection(clickedNode);
            }
        });
    }

    /**
     * Handle resize
     */
    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.canvas.width = width;
        this.canvas.height = height;

        this.ouroboros.init(width, height);

        const center = this.ouroboros.getCenter();
        const radius = this.ouroboros.getRadius();
        this.nodeNetwork.init(center.x, center.y, width, height, radius);
    }

    /**
     * Navigate to a section
     */
    navigateToSection(sectionId) {
        EventBus.emit(Events.LANDING_COMPLETE, { section: sectionId });

        // Fade out animation
        this.container.classList.add('landing-fade-out');

        setTimeout(() => {
            this.cleanup();
            Router.enterContent(sectionId);
        }, 500);
    }

    /**
     * Start rendering
     */
    render() {
        this.isActive = true;
        this.lastTime = performance.now();
        this.animate();
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isActive) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and render
        this.ouroboros.update(currentTime);
        this.ouroboros.render(this.ctx);

        this.nodeNetwork.update(deltaTime);
        this.nodeNetwork.render(this.ctx);

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

export default Landing;
