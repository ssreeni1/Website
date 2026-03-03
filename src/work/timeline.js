/**
 * Work About Component
 * Simple prose content replacing the timeline
 */

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>{}[]|;:~';
const CHARS_PER_FRAME = 10;

function randomChar() {
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

export class Timeline {
    constructor() {
        this.container = null;
        this.animFrameId = null;
    }

    async init(container) {
        this.container = container;
        return this;
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="work-about">
                <p>Hi, I'm Saneel. The through-line of my <a href="https://www.linkedin.com/in/snlsrn/" target="_blank" rel="noopener noreferrer">work</a> is a simple question: what happens when genuinely new technology meets genuinely old industries?</p>

                <p>I've explored this by building (<a href="https://ritual.net" target="_blank" rel="noopener noreferrer">Ritual</a>, <a href="https://alkimiya.io" target="_blank" rel="noopener noreferrer">Alkimiya</a>), by investing at the earliest stages (<a href="https://accomplice.co" target="_blank" rel="noopener noreferrer">Accomplice</a>, <a href="https://dragonfly.xyz" target="_blank" rel="noopener noreferrer">Dragonfly</a>, <a href="https://polychain.capital" target="_blank" rel="noopener noreferrer">Polychain</a>), and by trading public markets. I have been immensely fortunate to work with and learn from some pretty exceptional people through these things, and that remains a core driving factor for me. All my work has primarily been in crypto and AI, but I'm now dedicating more of my time to branch out.</p>

                <p>What I'm thinking about now:</p>
                <ul>
                    <li>the adaptation of AI to legacy services, not by replacing them, but by making them unrecognizable</li>
                    <li>compounders in the age of software and labor automation, marketplaces in particular, which age like almost nothing else</li>
                    <li><a href="https://superpositioned.co" target="_blank" rel="noopener noreferrer">quantum computing</a></li>
                    <li>the convergence of payment and asset rails with blockchains, finance re-plumbed from below</li>
                    <li>the enduring, compounding value of live experiences: the Amans, the Vail Resorts, the things no algorithm can intermediate</li>
                    <li>operating with <a href="https://quartr.com/insights/business-philosophy/the-brunello-cucinelli-story-combining-elegance-and-ethics" target="_blank" rel="noopener noreferrer">taste and aesthetics</a>, the Cucinelli ethos that elegance and ethics aren't at odds</li>
                    <li>becoming like the people I look up to: my parents, Lee Kuan Yew, <a href="https://quartr.com/insights/investment-strategy/reece-duca-the-manager-who-outperformed-buffett" target="_blank" rel="noopener noreferrer">Reece Duca</a>, Swedish House Mafia, Ralph Lauren</li>
                    <li>wisdom from long history and anthropology, the Bhagavad Gita, the Bible, Girard's mimetic theory, the Meditations of Marcus Aurelius, etc.</li>
                </ul>
            </div>
        `;

        this.scrambleDecode();
    }

    scrambleDecode() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        const aboutEl = this.container.querySelector('.work-about');
        if (!aboutEl) return;

        // Collect all text nodes and build a flat array of character slots
        const slots = []; // { span, original, phaseOffset, resolved }
        const walker = document.createTreeWalker(aboutEl, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        for (const node of textNodes) {
            const original = node.textContent;
            const wrapper = document.createDocumentFragment();

            for (let i = 0; i < original.length; i++) {
                const ch = original[i];
                const isWhitespace = /\s/.test(ch);

                if (isWhitespace) {
                    wrapper.appendChild(document.createTextNode(ch));
                } else {
                    const span = document.createElement('span');
                    span.textContent = randomChar();
                    span.style.color = '#ff4500';
                    slots.push({
                        span,
                        original: ch,
                        phaseOffset: slots.length * 0.15,
                        resolved: false
                    });
                    wrapper.appendChild(span);
                }
            }

            node.parentNode.replaceChild(wrapper, node);
        }

        let resolved = 0;
        const startTime = performance.now();

        const tick = (time) => {
            // Resolve characters progressively
            const newResolved = Math.min(resolved + CHARS_PER_FRAME, slots.length);
            for (let i = resolved; i < newResolved; i++) {
                const slot = slots[i];
                slot.resolved = true;
                slot.span.textContent = slot.original;
                slot.span.style.color = '';
                slot.span.style.textShadow = '';
                slot.span.style.opacity = '';
            }
            resolved = newResolved;

            // Animate unresolved characters — JS-driven pulse like the orbs
            const elapsed = time - startTime;
            for (let i = resolved; i < slots.length; i++) {
                const slot = slots[i];
                // Cycle character
                if (Math.random() < 0.3) {
                    slot.span.textContent = randomChar();
                }
                // Smooth sinusoidal pulse matching orb rhythm
                const pulse = Math.sin(elapsed * 0.005 + slot.phaseOffset) * 0.5 + 0.5;
                const blur = 2 + pulse * 8;
                const alpha = 0.15 + pulse * 0.4;
                const opacity = 0.65 + pulse * 0.35;
                slot.span.style.textShadow = `0 0 ${blur}px rgba(255, 69, 0, ${alpha})`;
                slot.span.style.opacity = opacity;
            }

            if (resolved < slots.length) {
                this.animFrameId = requestAnimationFrame(tick);
            } else {
                this.animFrameId = null;
            }
        };

        this.animFrameId = requestAnimationFrame(tick);
    }

    cleanup() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export default Timeline;
