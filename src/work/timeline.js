/**
 * Work Timeline Component
 * Vertical timeline with nodes, alternating sides, scroll reveal
 */

import { EventBus, Events } from '../core/events.js';

export class Timeline {
    constructor() {
        this.container = null;
        this.data = null;
        this.observer = null;
    }

    /**
     * Initialize timeline
     */
    async init(container) {
        this.container = container;
        await this.loadData();
        this.setupIntersectionObserver();
        return this;
    }

    /**
     * Load timeline data
     */
    async loadData() {
        try {
            const response = await fetch('/content/work/work.json');
            this.data = await response.json();
        } catch (error) {
            console.error('Failed to load work data:', error);
            this.data = { positions: [], education: [] };
        }
    }

    /**
     * Setup intersection observer for scroll animations
     */
    setupIntersectionObserver() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('timeline-item--visible');
                        this.observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.2,
                rootMargin: '0px 0px -50px 0px'
            }
        );
    }

    /**
     * Render timeline
     */
    render() {
        if (!this.data) return;

        // Re-create observer if it was disconnected
        if (!this.observer) {
            this.setupIntersectionObserver();
        }

        this.container.innerHTML = `
            <div class="timeline">
                <div class="timeline-line"></div>
                ${this.renderPositions()}
                ${this.renderEducation()}
            </div>
        `;

        // Observe all timeline items
        this.container.querySelectorAll('.timeline-item').forEach((item) => {
            this.observer.observe(item);
        });
    }

    /**
     * Render work positions
     */
    renderPositions() {
        return this.data.positions
            .map((position, index) => this.renderItem(position, index, 'position'))
            .join('');
    }

    /**
     * Render education
     */
    renderEducation() {
        if (!this.data.education || this.data.education.length === 0) return '';

        return `
            <div class="timeline-section-label">Education</div>
            ${this.data.education
                .map((edu, index) => this.renderItem(edu, this.data.positions.length + index, 'education'))
                .join('')}
        `;
    }

    /**
     * Render a single timeline item
     */
    renderItem(item, index, type) {
        const side = index % 2 === 0 ? 'left' : 'right';
        const isCurrent = item.current;
        const title = type === 'education' ? item.institution : item.company;
        const subtitle = type === 'education' ? `${item.degree} - ${item.field}` : item.title;
        const dates = item.dates || '';
        const description = item.description || '';

        return `
            <div class="timeline-item timeline-item--${side}" data-id="${item.id}">
                <div class="timeline-node ${isCurrent ? 'timeline-node--current' : ''}">
                    <div class="timeline-node__dot"></div>
                    ${isCurrent ? '<div class="timeline-node__pulse"></div>' : ''}
                </div>
                <div class="timeline-content">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="timeline-content__link">
                        <h3 class="timeline-content__title">${title}</h3>
                        <p class="timeline-content__subtitle">${subtitle}</p>
                        <span class="timeline-content__dates">${dates}</span>
                        ${description ? `<p class="timeline-content__description">${description}</p>` : ''}
                    </a>
                </div>
            </div>
        `;
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export default Timeline;
