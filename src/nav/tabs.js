/**
 * Tab Navigation Component
 *
 * Handles tab button clicks and visual state.
 */

import { AppState } from '../core/state.js';
import { EventBus, Events } from '../core/events.js';
import { Router } from '../core/router.js';
import { Landing } from '../landing/landing.js';

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
            { id: 'writing', label: 'Writing/Projects' },
            { id: 'fun', label: 'Fun' }
        ];

        this.container.innerHTML = `
            <div class="nav-tabs" role="tablist">
                <button class="nav-tabs__home" data-action="home" aria-label="Go to home">
                    SS
                </button>
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
        // Tab buttons
        this.buttons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                if (tab && tab !== AppState.currentTab) {
                    Router.navigateTo(tab);
                }
            });
        });

        // Home button
        const homeButton = this.container.querySelector('[data-action="home"]');
        if (homeButton) {
            homeButton.addEventListener('click', () => {
                this.goToLanding();
            });
        }
    },

    /**
     * Go to landing page (ASCII animation)
     */
    goToLanding() {
        const landingEl = document.getElementById('landing-container');
        const content = document.getElementById('content-container');

        if (content) {
            content.style.opacity = '0';
        }

        setTimeout(() => {
            if (content) {
                content.style.display = 'none';
            }
            if (landingEl) {
                landingEl.classList.remove('landing-hidden', 'landing-fade-out');
                landingEl.style.display = 'flex';
                landingEl.innerHTML = '';
            }

            AppState.setState({ currentView: 'landing' });

            // Initialize and render landing
            const landing = new Landing();
            landing.init(landingEl);
            landing.render();

            // Add back button to return to content
            const backBtn = document.createElement('button');
            backBtn.className = 'landing-back-btn';
            backBtn.textContent = 'Back';
            backBtn.addEventListener('click', () => {
                landing.cleanup();
                landingEl.classList.add('landing-fade-out');
                setTimeout(() => {
                    landingEl.classList.add('landing-hidden');
                    if (content) {
                        content.style.display = 'block';
                        content.style.opacity = '1';
                    }
                    AppState.setState({ currentView: 'content' });
                }, 300);
            });
            landingEl.appendChild(backBtn);
        }, 300);
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
