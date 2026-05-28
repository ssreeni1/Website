/**
 * State Management
 *
 * Simple centralized state with CustomEvent-based reactivity.
 * No external dependencies required.
 */

import { EventBus, Events } from './events.js';

/**
 * Application State
 *
 * Single source of truth for UI state.
 * Use setState() to update - never modify directly.
 */
export const AppState = {
    // Current view: 'landing' | 'content'
    currentView: 'landing',

    // Active tab: 'work' | 'writing' | 'fun'
    currentTab: 'work',

    // Blog state
    currentPost: null,      // Post slug when viewing single post
    blogView: 'list',       // 'list' | 'single'

    // UI state
    isTransitioning: false, // Prevents rapid navigation
    isLoading: false,       // Global loading state

    /**
     * Update state and emit change events
     * @param {Object} updates - Partial state updates
     */
    setState(updates) {
        const oldState = { ...this };

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (key !== 'setState' && key in this) {
                this[key] = updates[key];
            }
        });

        // Emit specific events based on what changed
        if ('currentTab' in updates && updates.currentTab !== oldState.currentTab) {
            EventBus.emit(Events.TAB_CHANGE, {
                from: oldState.currentTab,
                to: updates.currentTab
            });
        }

        if ('currentView' in updates && updates.currentView !== oldState.currentView) {
            if (updates.currentView === 'content') {
                EventBus.emit(Events.LANDING_COMPLETE);
            }
        }

        // Emit generic state change
        document.dispatchEvent(new CustomEvent('stateChange', {
            detail: { updates, oldState, newState: this }
        }));
    },

    /**
     * Get current state snapshot
     * @returns {Object} - Copy of current state
     */
    getState() {
        const { setState, getState, subscribe, ...state } = this;
        return { ...state };
    },

    /**
     * Subscribe to state changes
     * @param {Function} handler - Called with { updates, oldState, newState }
     * @returns {Function} - Unsubscribe function
     */
    subscribe(handler) {
        const wrappedHandler = (e) => handler(e.detail);
        document.addEventListener('stateChange', wrappedHandler);
        return () => document.removeEventListener('stateChange', wrappedHandler);
    }
};

// Freeze the state structure to prevent accidental property additions
// (setState can still modify existing properties)
Object.seal(AppState);
