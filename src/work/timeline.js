/**
 * Work About Component
 * Simple prose content replacing the timeline
 */

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>{}[]|;:~';
const DECODE_DURATION = 2500;  // total decode time in ms
const SETTLE_WINDOW = 150;     // ms of rapid cycling before a char resolves
const CYCLE_BUDGET = 20;       // max ambient random swaps per frame

// Pre-generated ring buffer of random characters to avoid Math.random() on the hot path
const RING_SIZE = 256;
const charRing = new Array(RING_SIZE);
for (let i = 0; i < RING_SIZE; i++) {
    charRing[i] = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}
let ringIdx = 0;

function randomChar() {
    const ch = charRing[ringIdx];
    ringIdx = (ringIdx + 1) & (RING_SIZE - 1);
    return ch;
}

export class Timeline {
    constructor() {
        this.container = null;
        this.aboutEl = null;
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

        this.aboutEl = this.container.querySelector('.work-about');
        this.scrambleDecode();
    }

    scrambleDecode() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        const aboutEl = this.aboutEl;
        if (!aboutEl) return;

        // --- Phase 1: instant scramble (no new DOM elements) ---
        const walker = document.createTreeWalker(aboutEl, NodeFilter.SHOW_TEXT);
        const textEntries = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const original = node.textContent;
            const scrambled = [];
            const charMap = [];
            for (let i = 0; i < original.length; i++) {
                const ch = original[i];
                const ws = /\s/.test(ch);
                scrambled.push(ws ? ch : randomChar());
                charMap.push({ original: ch, ws });
            }
            node.textContent = scrambled.join('');
            textEntries.push({ node, charMap });
        }

        // --- Phase 2: build span infrastructure after first paint ---
        this.animFrameId = requestAnimationFrame(() => {
            const slots = [];

            for (const { node, charMap } of textEntries) {
                const frag = document.createDocumentFragment();
                for (let i = 0; i < charMap.length; i++) {
                    const { original, ws } = charMap[i];
                    if (ws) {
                        frag.appendChild(document.createTextNode(original));
                    } else {
                        const span = document.createElement('span');
                        span.textContent = randomChar();
                        span.className = 'scramble-glyph';
                        // No per-span animationDelay — opacity driven by parent custom property
                        slots.push({ span, original });
                        frag.appendChild(span);
                    }
                }
                node.parentNode.replaceChild(frag, node);
            }

            // --- Phase 3: double-rAF then uniform-rate decode with settling Set ---
            for (const slot of slots) {
                slot.resolveAt = Math.random() * DECODE_DURATION;
                slot.settleAt = Math.max(0, slot.resolveAt - SETTLE_WINDOW);
            }
            slots.sort((a, b) => a.resolveAt - b.resolveAt);

            // Pre-sort a second index by settleAt for the settle cursor
            const bySettle = slots.map((_, i) => i);
            bySettle.sort((a, b) => slots[a].settleAt - slots[b].settleAt);

            // Build a Set of currently-settling slot indices for O(1) iteration
            const settlingSet = new Set();

            // Double-rAF: guarantees one full render cycle committed before animation starts
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const startTime = performance.now();
                    let cursor = 0;
                    let settleCursor = 0;

                    const tick = () => {
                        const now = performance.now();
                        const elapsed = now - startTime;

                        // Drive glyph pulse via single CSS custom property on parent
                        const opacity = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(elapsed / 2400 * Math.PI * 2));
                        aboutEl.style.setProperty('--glyph-opacity', opacity.toFixed(3));

                        // Advance settle cursor — add slots entering settle window
                        while (settleCursor < bySettle.length &&
                               slots[bySettle[settleCursor]].settleAt <= elapsed) {
                            settlingSet.add(bySettle[settleCursor]);
                            settleCursor++;
                        }

                        // Advance resolve cursor — finalize chars whose time has come
                        while (cursor < slots.length && slots[cursor].resolveAt <= elapsed) {
                            const slot = slots[cursor];
                            slot.span.textContent = slot.original;
                            slot.span.className = '';
                            settlingSet.delete(cursor);
                            cursor++;
                        }

                        // Settling chars cycle every frame (only ~70-80 items)
                        for (const idx of settlingSet) {
                            slots[idx].span.textContent = randomChar();
                        }

                        // Ambient unresolved chars: capped budget of random picks
                        let ambientBudget = CYCLE_BUDGET;
                        const remaining = slots.length - cursor;
                        if (remaining > 0 && ambientBudget > 0) {
                            for (let j = 0; j < ambientBudget; j++) {
                                const pick = cursor + Math.floor(Math.random() * remaining);
                                if (!settlingSet.has(pick)) {
                                    slots[pick].span.textContent = randomChar();
                                }
                            }
                        }

                        if (cursor < slots.length) {
                            this.animFrameId = requestAnimationFrame(tick);
                        } else {
                            // Decrypt complete — enable link glow, clean up custom property
                            aboutEl.style.removeProperty('--glyph-opacity');
                            aboutEl.classList.add('decrypt-done');
                            this.animFrameId = null;
                        }
                    };

                    this.animFrameId = requestAnimationFrame(tick);
                });
            });
        });
    }

    cleanup() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.aboutEl) {
            this.aboutEl.style.removeProperty('--glyph-opacity');
            this.aboutEl.classList.remove('decrypt-done');
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export default Timeline;
