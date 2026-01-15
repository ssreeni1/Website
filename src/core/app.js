/**
 * Main Application Entry Point
 *
 * Initializes all components and sets up the application.
 */

import { AppState } from './state.js';
import { EventBus, Events } from './events.js';
import { Router } from './router.js';
import { TabNav } from '../nav/tabs.js';

// Component imports (uncomment as implemented)
// import { Landing } from '../landing/landing.js';
// import { WorkTimeline } from '../work/timeline.js';
// import { Blog } from '../writing/blog.js';
// import { Collage } from '../fun/collage.js';

/**
 * Initialize application
 */
async function init() {
    console.log('[App] Initializing...');

    // Initialize tab navigation
    TabNav.init();

    // Register components with router (uncomment as implemented)
    // Router.register('work', WorkTimeline);
    // Router.register('writing', Blog);
    // Router.register('fun', Collage);

    // Initialize router
    Router.init();

    // Check for skip-landing query param (for testing)
    const params = new URLSearchParams(window.location.search);
    if (params.has('skip-landing')) {
        skipToContent(params.get('tab') || 'work');
    } else {
        // Initialize landing page (uncomment when implemented)
        // Landing.init(document.getElementById('landing-container'));
        // Landing.render();

        // For now, skip directly to content
        skipToContent('work');
    }

    console.log('[App] Initialized');
}

/**
 * Skip landing and go directly to content
 * @param {string} tab - Tab to show
 */
function skipToContent(tab) {
    const landing = document.getElementById('landing-container');
    const content = document.getElementById('content-container');

    if (landing) landing.style.display = 'none';
    if (content) {
        content.style.display = 'block';
        content.style.opacity = '1';
    }

    AppState.setState({
        currentView: 'content',
        currentTab: tab
    });

    // Activate the tab panel
    const panel = document.querySelector(`[data-tab="${tab}"]`);
    if (panel) panel.classList.add('active');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for testing
export { init };
