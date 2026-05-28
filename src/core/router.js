/**
 * Router - Client-side tab navigation
 *
 * Handles tab switching with transition animations and URL routing.
 */

import { AppState } from './state.js';
import { EventBus, Events } from './events.js';

const ROUTES = {
    work: '/work',
    writing: '/projects',
    fun: '/fun'
};

const PATH_TO_TAB = new Map([
    ['/', 'work'],
    ['/work', 'work'],
    ['/projects', 'writing'],
    ['/writing', 'writing'],
    ['/fun', 'fun']
]);

function isOldSite() {
    return normalizePath(window.location.pathname).startsWith('/old');
}

function normalizePath(pathname) {
    if (!pathname || pathname === '/') return '/';
    return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Router singleton
 */
export const Router = {
    components: new Map(),
    currentComponent: null,
    initialized: new Set(),

    /**
     * Register a tab component
     * @param {string} tabName - Tab identifier ('work', 'writing', 'fun')
     * @param {Object} component - Component implementing TabComponent interface
     */
    register(tabName, component) {
        this.components.set(tabName, component);
    },

    /**
     * Initialize router and set up event listeners
     */
    init() {
        // Listen for tab change requests
        EventBus.on(Events.TAB_CHANGE, ({ to, updateUrl = true }) => {
            this.navigateTo(to, { updateUrl });
        });

        window.addEventListener('popstate', () => {
            const tabName = this.getTabFromLocation();
            this.navigateTo(tabName, { updateUrl: false });
        });
    },

    /**
     * Resolve the current URL to a tab name.
     * @returns {string} Tab identifier
     */
    getTabFromLocation() {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');

        if (tabParam && this.components.has(tabParam)) {
            return tabParam;
        }

        const pathname = normalizePath(window.location.pathname);
        if (isOldSite()) {
            return PATH_TO_TAB.get(pathname.replace(/^\/old/, '') || '/') || 'work';
        }

        return PATH_TO_TAB.get(pathname) || 'work';
    },

    /**
     * Update the browser address bar for a tab.
     * @param {string} tabName - Tab identifier
     * @param {boolean} replace - Replace instead of push history
     */
    updateLocation(tabName, replace = false) {
        const path = isOldSite() ? `/old/?tab=${encodeURIComponent(tabName)}` : ROUTES[tabName];
        if (!path || normalizePath(window.location.pathname) === path) return;

        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({ tab: tabName }, '', path);
    },

    /**
     * Navigate to a specific tab
     * @param {string} tabName - Tab to navigate to
     * @param {Object} options - Navigation options
     * @param {boolean} options.updateUrl - Whether to push the browser URL
     * @param {boolean} options.replaceUrl - Whether to replace the current URL
     */
    async navigateTo(tabName, { updateUrl = true, replaceUrl = false } = {}) {
        if (AppState.isTransitioning) return;
        if (!this.components.has(tabName)) {
            console.warn(`Router: Unknown tab "${tabName}"`);
            return;
        }

        const isSameTab = tabName === AppState.currentTab && this.initialized.has(tabName);
        if (isSameTab) return;

        AppState.setState({ isTransitioning: true });

        // Cleanup current component
        if (this.currentComponent && this.currentComponent.cleanup) {
            this.currentComponent.cleanup();
        }

        // Get DOM elements (use #tab-{name} to get panel, not button)
        const currentPanel = document.querySelector('.tab-panel.active');
        const newPanel = document.getElementById(`tab-${tabName}`);

        if (currentPanel) {
            currentPanel.classList.remove('active');
        }

        // Wait for exit animation
        await new Promise(resolve => setTimeout(resolve, 150));

        // Activate new panel and wait for its CSS transition to finish
        if (newPanel) {
            newPanel.classList.add('active');
            await new Promise(resolve => {
                const onEnd = () => {
                    clearTimeout(fallback);
                    newPanel.removeEventListener('transitionend', onEnd);
                    resolve();
                };
                const fallback = setTimeout(onEnd, 350);
                newPanel.addEventListener('transitionend', onEnd, { once: true });
            });
        }

        // Activate new component (after transition completes)
        await this.activateTab(tabName);

        AppState.setState({
            currentTab: tabName,
            isTransitioning: false
        });

        if (updateUrl) {
            this.updateLocation(tabName, replaceUrl);
        }

        EventBus.emit(Events.TAB_CHANGED, { tab: tabName });
    },

    /**
     * Activate a tab's component
     * @param {string} tabName - Tab to activate
     */
    async activateTab(tabName) {
        const component = this.components.get(tabName);
        if (!component) return;

        const panel = document.getElementById(`tab-${tabName}`);
        const container = panel?.querySelector('.tab-panel__content');

        if (!container) {
            console.warn(`Router: No container found for tab "${tabName}"`);
            return;
        }

        // Initialize if not already done
        if (!this.initialized.has(tabName)) {
            await component.init(container);
            this.initialized.add(tabName);
        } else {
            // Update container reference for re-visits
            component.container = container;
        }

        component.render();
        this.currentComponent = component;
    },

    /**
     * Transition from landing to content view
     * @param {string} section - Section to navigate to
     */
    enterContent(section = 'work') {
        if (AppState.currentView === 'content') return;

        const landing = document.getElementById('landing-container');
        const content = document.getElementById('content-container');

        if (landing) {
            landing.classList.add('landing-fade-out');
        }

        setTimeout(() => {
            if (landing) {
                landing.classList.add('landing-hidden');
            }
            if (content) {
                content.style.display = 'block';
                content.style.opacity = '1';
            }

            AppState.setState({
                currentView: 'content',
                currentTab: section
            });

            // Initialize the target tab
            this.navigateTo(section);
        }, 500);
    }
};
