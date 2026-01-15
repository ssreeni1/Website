/**
 * Tab Navigation Component
 *
 * Handles tab button clicks and visual state.
 */

import { AppState } from '../core/state.js';
import { EventBus, Events } from '../core/events.js';

export const TabNav = {
    container: null,
    buttons: [],

    /**
     * Initialize tab navigation
     */
    init() {
        this.container = document.getElementById('tab-nav');
        if (!this.container) {
            console.warn('[TabNav] No tab-nav container found');
            return;
        }

        this.render();
        this.bindEvents();

        // Listen for tab changes to update button states
        EventBus.on(Events.TAB_CHANGED, ({ tab }) => {
            this.updateActiveState(tab);
        });
    },

    /**
     * Render tab buttons
     */
    render() {
        const tabs = [
            { id: 'work', label: 'Work' },
            { id: 'writing', label: 'Writing' },
            { id: 'fun', label: 'Fun' }
        ];

        this.container.innerHTML = `
            <div class="nav-tabs" role="tablist">
                ${tabs.map(tab => `
                    <button
                        class="nav-tabs__button ${tab.id === AppState.currentTab ? 'nav-tabs__button--active' : ''}"
                        data-tab="${tab.id}"
                        role="tab"
                        aria-selected="${tab.id === AppState.currentTab}"
                        aria-controls="tab-${tab.id}"
                    >
                        <span class="nav-tabs__label">${tab.label}</span>
                        <span class="nav-tabs__indicator"></span>
                    </button>
                `).join('')}
            </div>
        `;

        this.buttons = this.container.querySelectorAll('.nav-tabs__button');
    },

    /**
     * Bind click events
     */
    bindEvents() {
        this.buttons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                if (tab && tab !== AppState.currentTab) {
                    EventBus.emit(Events.TAB_CHANGE, {
                        from: AppState.currentTab,
                        to: tab
                    });
                }
            });
        });
    },

    /**
     * Update active button state
     * @param {string} activeTab - Currently active tab
     */
    updateActiveState(activeTab) {
        this.buttons.forEach(button => {
            const isActive = button.dataset.tab === activeTab;
            button.classList.toggle('nav-tabs__button--active', isActive);
            button.setAttribute('aria-selected', isActive);
        });
    }
};
