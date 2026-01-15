/**
 * Component Interface Contract
 *
 * All tab components MUST implement this interface to ensure
 * consistent behavior across the application.
 *
 * @interface TabComponent
 */

/**
 * Example implementation:
 *
 * export const MyComponent = {
 *     container: null,
 *
 *     init(containerElement) {
 *         this.container = containerElement;
 *         // Set up event listeners, fetch data, etc.
 *         return this;
 *     },
 *
 *     render() {
 *         // Render content to this.container
 *         this.container.innerHTML = '...';
 *     },
 *
 *     cleanup() {
 *         // Remove event listeners, cancel animations, etc.
 *     }
 * };
 */

export const ComponentInterface = {
    /**
     * Initialize the component with its container element
     * @param {HTMLElement} containerElement - The DOM element to render into
     * @returns {Object} - Returns this for chaining
     */
    init: (containerElement) => {},

    /**
     * Render the component content
     * Called when the tab becomes active
     */
    render: () => {},

    /**
     * Cleanup when switching away from this tab
     * Remove event listeners, cancel animations, etc.
     */
    cleanup: () => {}
};

/**
 * Validates that a component implements the required interface
 * @param {Object} component - The component to validate
 * @returns {boolean} - True if valid
 */
export function validateComponent(component) {
    const required = ['init', 'render', 'cleanup'];
    return required.every(method => typeof component[method] === 'function');
}
