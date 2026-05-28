/**
 * Text Scramble Animation
 * Characters cycle randomly before revealing final text
 */

export class TextScramble {
    constructor(element, options = {}) {
        this.element = element;
        this.chars = options.chars || '!<>-_\\/[]{}—=+*^?#@$%&()~';
        this.speed = options.speed || 30;
        this.queue = [];
        this.frame = 0;
        this.frameRequest = null;
        this.resolve = null;
    }

    /**
     * Animate text change
     */
    setText(newText) {
        const oldText = this.element.innerText;
        const length = Math.max(oldText.length, newText.length);

        return new Promise((resolve) => {
            this.resolve = resolve;
            this.queue = [];

            for (let i = 0; i < length; i++) {
                const from = oldText[i] || '';
                const to = newText[i] || '';
                const start = Math.floor(Math.random() * 40);
                const end = start + Math.floor(Math.random() * 40);
                this.queue.push({ from, to, start, end });
            }

            cancelAnimationFrame(this.frameRequest);
            this.frame = 0;
            this.update();
        });
    }

    /**
     * Update animation frame
     */
    update() {
        let output = '';
        let complete = 0;

        for (let i = 0; i < this.queue.length; i++) {
            const { from, to, start, end, char } = this.queue[i];

            if (this.frame >= end) {
                complete++;
                output += to;
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) {
                    this.queue[i].char = this.randomChar();
                }
                output += `<span class="scramble-char">${this.queue[i].char}</span>`;
            } else {
                output += from;
            }
        }

        this.element.innerHTML = output;

        if (complete === this.queue.length) {
            this.resolve();
        } else {
            this.frameRequest = requestAnimationFrame(() => this.update());
            this.frame++;
        }
    }

    /**
     * Get random character
     */
    randomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }

    /**
     * Stop animation
     */
    stop() {
        cancelAnimationFrame(this.frameRequest);
    }
}

/**
 * Scramble all elements matching selector
 */
export async function scrambleElements(selector, options = {}) {
    const elements = document.querySelectorAll(selector);
    const scramblers = [];

    for (const element of elements) {
        const text = element.dataset.scrambleText || element.innerText;
        element.innerText = '';

        const scrambler = new TextScramble(element, options);
        scramblers.push(scrambler.setText(text));

        // Stagger if multiple elements
        if (options.stagger) {
            await new Promise(r => setTimeout(r, options.stagger));
        }
    }

    return Promise.all(scramblers);
}

export default TextScramble;
