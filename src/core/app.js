/**
 * Main Application Entry Point
 *
 * Initializes all components and sets up the application.
 */

import { AppState } from './state.js';
import { EventBus, Events } from './events.js';
import { Router } from './router.js';
import { TabNav } from '../nav/tabs.js';

// Component imports
import { Timeline } from '../work/timeline.js';
import { WritingNetwork } from '../writing/network.js';
import { Collage } from '../fun/collage.js';

// Component instances
let timeline = null;
let writingNetwork = null;
let collage = null;

/**
 * Initialize application
 */
async function init() {
    console.log('[App] Initializing...');

    // Initialize tab navigation
    TabNav.init();

    // Initialize router
    Router.init();

    // Register components with router
    Router.register('work', {
        init: async (container) => {
            timeline = new Timeline();
            await timeline.init(container);
            return timeline;
        },
        render: () => timeline?.render(),
        cleanup: () => timeline?.cleanup()
    });

    Router.register('writing', {
        init: async (container) => {
            writingNetwork = new WritingNetwork();
            await writingNetwork.init(container);
            return writingNetwork;
        },
        render: () => writingNetwork?.render(),
        cleanup: () => writingNetwork?.cleanup()
    });

    Router.register('fun', {
        init: async (container) => {
            collage = new Collage();
            await collage.init(container);
            return collage;
        },
        render: () => collage?.render(),
        cleanup: () => collage?.cleanup()
    });

    // Start directly on writing tab (landing is accessed via SS button)
    const params = new URLSearchParams(window.location.search);
    const startTab = params.get('tab') || 'writing';
    await skipToContent(startTab);

    console.log('[App] Initialized');
}

/**
 * Skip landing and go directly to content
 * @param {string} tab - Tab to show
 */
async function skipToContent(tab) {
    const landingEl = document.getElementById('landing-container');
    const content = document.getElementById('content-container');

    if (landingEl) {
        landingEl.classList.add('landing-hidden');
    }

    if (content) {
        content.style.display = 'block';
        content.style.opacity = '1';
    }

    // Activate the tab panel first (use #tab-{name} to get panel, not button)
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) {
        panel.classList.add('active');
    }

    AppState.setState({
        currentView: 'content',
        currentTab: tab
    });

    // Initialize and render the component
    const component = Router.components.get(tab);
    if (component) {
        const container = panel?.querySelector('.tab-panel__content');
        if (container) {
            await component.init(container);
            Router.initialized.add(tab);
            component.render();
            Router.currentComponent = component;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for testing
export { init };
