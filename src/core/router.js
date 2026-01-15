/**
 * Router - Client-side tab navigation
 *
 * Handles tab switching with transition animations.
 * No URL routing - purely client-side state.
 */

import { AppState } from './state.js';
import { EventBus, Events } from './events.js';

/**
 * Router singleton
 */
export const Router = {
    components: new Map(),
    currentComponent: null,

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
        EventBus.on(Events.TAB_CHANGE, ({ to }) => {
            this.navigateTo(to);
        });

        // Initialize default tab
        const defaultTab = AppState.currentTab;
        if (this.components.has(defaultTab)) {
            this.activateTab(defaultTab);
        }
    },

    /**
     * Navigate to a specific tab
     * @param {string} tabName - Tab to navigate to
     */
    navigateTo(tabName) {
        if (AppState.isTransitioning) return;
        if (!this.components.has(tabName)) {
            console.warn(`Router: Unknown tab "${tabName}"`);
            return;
        }
        if (tabName === AppState.currentTab) return;

        AppState.setState({ isTransitioning: true });

        // Cleanup current component
        if (this.currentComponent) {
            this.currentComponent.cleanup();
        }

        // Get DOM elements
        const currentPanel = document.querySelector('.tab-panel.active');
        const newPanel = document.querySelector(`[data-tab="${tabName}"]`);

        if (currentPanel) {
            currentPanel.classList.remove('active');
        }

        // Wait for exit animation
        setTimeout(() => {
            // Activate new panel
            if (newPanel) {
                newPanel.classList.add('active');
            }

            // Activate new component
            this.activateTab(tabName);

            AppState.setState({
                currentTab: tabName,
                isTransitioning: false
            });

            EventBus.emit(Events.TAB_CHANGED, { tab: tabName });
        }, 300);
    },

    /**
     * Activate a tab's component
     * @param {string} tabName - Tab to activate
     */
    activateTab(tabName) {
        const component = this.components.get(tabName);
        if (!component) return;

        const container = document.querySelector(`[data-tab="${tabName}"]`);
        if (!container) {
            console.warn(`Router: No container found for tab "${tabName}"`);
            return;
        }

        component.init(container);
        component.render();
        this.currentComponent = component;
    },

    /**
     * Transition from landing to content view
     */
    enterContent() {
        if (AppState.currentView === 'content') return;

        const landing = document.getElementById('landing-container');
        const content = document.getElementById('content-container');

        if (landing) {
            landing.style.opacity = '0';
            landing.style.pointerEvents = 'none';
        }

        setTimeout(() => {
            if (landing) landing.style.display = 'none';
            if (content) {
                content.style.display = 'block';
                content.style.opacity = '1';
            }

            AppState.setState({ currentView: 'content' });

            // Initialize default tab if not already done
            if (!this.currentComponent) {
                this.activateTab(AppState.currentTab);
            }
        }, 500);
    }
};
