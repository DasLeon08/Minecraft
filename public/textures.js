// Texture generator using Canvas
export function generateTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // Base colors
    const colors = {
        dirt: ['#5E3A21', '#4A2E1A', '#724628'],
        grass_top: ['#55AA55', '#448844', '#66CC66'],
        stone: ['#888888', '#666666', '#AAAAAA'],
        wood_side: ['#5C4033', '#4A332A', '#6E4D3D'],
        wood_top: ['#8B5A2B', '#7A4A20', '#9C6A3B'],
        planks: ['#C19A6B', '#A68254', '#D1AC80']
    };

    const scheme = colors[type] || colors.dirt;

    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            // Randomly select one of the colors in the scheme
            const c = scheme[Math.floor(Math.random() * scheme.length)];
            ctx.fillStyle = c;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Special patterns
    if (type === 'planks') {
        ctx.fillStyle = '#8B5A2B'; // darker line
        for (let y = 0; y < 16; y += 4) {
            ctx.fillRect(0, y, 16, 1);
        }
        for (let x = 0; x < 16; x += 8) {
            ctx.fillRect(x, 0, 1, 16);
            ctx.fillRect(x + 4, 4, 1, 4);
            ctx.fillRect(x + 4, 12, 1, 4);
        }
    }

    const img = canvas.toDataURL('image/png');
    return img;
}
