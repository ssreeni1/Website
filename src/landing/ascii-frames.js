/**
 * ASCII Ouroboros Frame Data
 * 12 frames showing a rotating snake eating its tail
 */

export const FRAME_DURATION = 150; // ms per frame
export const TOTAL_FRAMES = 12;

// Each frame is a multi-line ASCII art string
// The snake rotates clockwise, head position advances 30 degrees per frame
export const OUROBOROS_FRAMES = [
    // Frame 0 - Head at top
    `
        .---.
      .'     '.
     /    @    \\
    |    V      |
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 1
    `
        .---.
      .'  @  '.
     /    V    \\
    |           |
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 2 - Head at top-right
    `
        .---.
      .'     '.@
     /       V \\
    |           |
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 3
    `
        .---.
      .'     '.
     /         \\@
    |          V|
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 4 - Head at right
    `
        .---.
      .'     '.
     /         \\
    |           |@
    |           V
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 5
    `
        .---.
      .'     '.
     /         \\
    |           |
    |           |
    |           |@
     \\        V/
      '.     .'
        '---'
    `,
    // Frame 6 - Head at bottom
    `
        .---.
      .'     '.
     /         \\
    |           |
    |           |
    |           |
     \\         /
      '.  V  .'
        '@--'
    `,
    // Frame 7
    `
        .---.
      .'     '.
     /         \\
    |           |
    |           |
    |           |
     \\V       /
      '@    .'
        '---'
    `,
    // Frame 8 - Head at left
    `
        .---.
      .'     '.
     /         \\
    |           |
    V           |
    @           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 9
    `
        .---.
      .'     '.
     V         \\
    @           |
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 10 - Head at top-left
    `
        .---.
      @'     '.
     V         \\
    |           |
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `,
    // Frame 11
    `
       V.---.
      @'     '.
     /         \\
    |           |
    |           |
    |           |
     \\         /
      '.     .'
        '---'
    `
];

// Simplified version for smaller displays
export const SIMPLE_FRAMES = OUROBOROS_FRAMES.map(frame =>
    frame.split('\n').slice(1, -1).join('\n')
);

export default OUROBOROS_FRAMES;
