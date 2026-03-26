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
        planks: ['#C19A6B', '#A68254', '#D1AC80'],
        leaves: ['#2E8B57', '#228B22', '#006400'], // Darker greens
        sand: ['#EEDC82', '#F4A460', '#DAA520'],
        glass: ['#ADD8E6', '#87CEFA', '#B0E0E6'], // light blues
        cobblestone: ['#777777', '#555555', '#666666'], // rougher stone
        brick: ['#B22222', '#8B0000', '#A52A2A'], // red brick
        coal_ore: ['#888888', '#666666', '#AAAAAA', '#111111', '#000000'], // stone with black flecks
        iron_ore: ['#888888', '#666666', '#AAAAAA', '#D2B48C', '#F5DEB3'], // stone with tan flecks
        gold_ore: ['#888888', '#666666', '#AAAAAA', '#FFD700', '#DAA520'], // stone with gold flecks
        diamond_ore: ['#888888', '#666666', '#AAAAAA', '#00FFFF', '#00CED1'] // stone with cyan flecks
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
    } else if (type === 'cobblestone') {
        ctx.fillStyle = '#444444'; // mortar lines
        for (let y = 0; y < 16; y += 4) {
             ctx.fillRect(0, y, 16, 1);
             ctx.fillRect(y + (y % 8 === 0 ? 0 : 4), y, 1, 4); // staggered verticals
        }
    } else if (type === 'brick') {
        ctx.fillStyle = '#DDDDDD'; // light mortar
        for (let y = 0; y < 16; y += 4) {
             ctx.fillRect(0, y, 16, 1);
             ctx.fillRect(y + (y % 8 === 0 ? 0 : 8), y, 1, 4); // staggered brick verticals
        }
    } else if (type === 'glass') {
        // clear middle with rim
        ctx.clearRect(1, 1, 14, 14);
        ctx.fillStyle = 'rgba(173, 216, 230, 0.3)'; // slightly blue center
        ctx.fillRect(1, 1, 14, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(2, 2, 2, 8); // reflection stripe
    } else if (type === 'leaves') {
         // make some pixels transparent for leafy look
         for(let i=0; i<64; i++) {
             ctx.clearRect(Math.floor(Math.random()*16), Math.floor(Math.random()*16), 1, 1);
         }
    }

    const img = canvas.toDataURL('image/png');
    return img;
}
