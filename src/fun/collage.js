/**
 * Fun Collage Component
 * B&W image grid with grayscale-to-color hover effect
 */

export class Collage {
    constructor() {
        this.container = null;
        this.data = null;
    }

    /**
     * Initialize collage
     */
    async init(container) {
        this.container = container;
        await this.loadData();
        return this;
    }

    /**
     * Load collage data
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
     * Render collage
     */
    render() {
        if (!this.data) return;

        this.container.innerHTML = `
            <div class="collage-grid">
                ${this.data.images.map(image => this.renderImage(image)).join('')}
            </div>
        `;

        // Add hover listeners for mobile touch feedback
        this.container.querySelectorAll('.collage-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const url = item.dataset.url;
                if (url && url !== 'null') {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        });
    }

    /**
     * Render a single image
     */
    renderImage(image) {
        const hasLink = image.url && image.url !== 'null';
        const spanClass = image.span === 'large' ? 'collage-item--large' :
                         image.span === 'small' ? 'collage-item--small' : '';

        return `
            <div class="collage-item ${spanClass} ${hasLink ? 'collage-item--clickable' : ''}"
                 data-id="${image.id}"
                 data-url="${image.url}">
                <div class="collage-item__image-wrapper">
                    <img src="${image.src}"
                         alt="${image.alt}"
                         class="collage-item__image"
                         loading="lazy">
                </div>
                <div class="collage-item__overlay">
                    <span class="collage-item__label">${image.alt}</span>
                </div>
            </div>
        `;
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export default Collage;
