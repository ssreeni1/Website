/**
 * Event Bus - Cross-component communication
 *
 * Provides a simple pub/sub system using native CustomEvents
 * for decoupled communication between components.
 */

// Event name constants - use these instead of strings
export const Events = {
    // Navigation events
    TAB_CHANGE: 'tab:change',
    TAB_CHANGED: 'tab:changed',

    // Landing page events
    LANDING_COMPLETE: 'landing:complete',
    LANDING_ENTER: 'landing:enter',

    // Content events
    CONTENT_LOADED: 'content:loaded',
    CONTENT_ERROR: 'content:error',

    // Animation events
    ANIMATION_START: 'animation:start',
    ANIMATION_END: 'animation:end',

    // Blog events
    POST_SELECTED: 'post:selected',
    POST_CLOSED: 'post:closed'
};

/**
 * EventBus - Simple event emitter using native CustomEvents
 */
export const EventBus = {
    /**
     * Emit an event with optional data
     * @param {string} event - Event name (use Events constants)
     * @param {*} data - Optional data to pass to handlers
     */
    emit(event, data = null) {
        window.dispatchEvent(new CustomEvent(event, {
            detail: data,
            bubbles: true
        }));
    },

    /**
     * Subscribe to an event
     * @param {string} event - Event name (use Events constants)
     * @param {Function} handler - Handler function receives event.detail
     * @returns {Function} - Unsubscribe function
     */
    on(event, handler) {
        const wrappedHandler = (e) => handler(e.detail);
        window.addEventListener(event, wrappedHandler);

        // Return unsubscribe function
        return () => window.removeEventListener(event, wrappedHandler);
    },

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} handler - Handler function
     */
    once(event, handler) {
        const wrappedHandler = (e) => {
            handler(e.detail);
            window.removeEventListener(event, wrappedHandler);
        };
        window.addEventListener(event, wrappedHandler);
    },

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} handler - Original handler function
     */
    off(event, handler) {
        window.removeEventListener(event, handler);
    }
};
