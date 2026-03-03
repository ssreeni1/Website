/**
 * Work About Component
 * Simple prose content replacing the timeline
 */

const SCRAMBLE_CHARS = '·~-=+*.:><[]{}|;^~·*=+-.:';
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

        // Snapshot the DOM structure so we can rebuild it each frame
        // We walk all text nodes, recording their parent and position
        const entries = [];
        let totalChars = 0;

        const walker = document.createTreeWalker(aboutEl, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const original = node.textContent;
            const chars = [];
            for (let i = 0; i < original.length; i++) {
                const ch = original[i];
                const isWhitespace = /\s/.test(ch);
                if (!isWhitespace) totalChars++;
                chars.push({ original: ch, isWhitespace });
            }
            entries.push({ node, chars });
        }

        // Initial scramble: replace all non-whitespace with random orange glyphs
        for (const entry of entries) {
            const span = document.createElement('span');
            span.innerHTML = entry.chars
                .map(c => c.isWhitespace ? c.original : `<span style="color:#ff4500;opacity:0.8">${randomChar()}</span>`)
                .join('');
            entry.node.parentNode.replaceChild(span, entry.node);
            entry.wrapper = span;
        }

        let resolved = 0;

        const tick = () => {
            resolved += CHARS_PER_FRAME;

            let charIndex = 0;
            for (const entry of entries) {
                let html = '';
                for (const c of entry.chars) {
                    if (c.isWhitespace) {
                        html += c.original;
                    } else {
                        if (charIndex < resolved) {
                            html += c.original;
                        } else {
                            html += `<span style="color:#ff4500;opacity:0.8">${randomChar()}</span>`;
                        }
                        charIndex++;
                    }
                }
                entry.wrapper.innerHTML = html;
            }

            if (resolved < totalChars) {
                this.animFrameId = requestAnimationFrame(tick);
            } else {
                // Clean up: unwrap spans, leaving just text
                for (const entry of entries) {
                    const text = document.createTextNode(
                        entry.chars.map(c => c.original).join('')
                    );
                    entry.wrapper.parentNode.replaceChild(text, entry.wrapper);
                }
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
