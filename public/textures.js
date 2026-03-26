// Texture generator using Canvas
export function generateTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // Base colors
    const colors = {
        dirt: ['#866043', '#79553a', '#966c4a'], // Classic brown dirt
        grass_top: ['#699e3a', '#5b8931', '#7ab845'], // Vibrant MC grass green
        grass_side: ['#866043', '#79553a', '#966c4a'], // Base is dirt, green added later
        stone: ['#7d7d7d', '#6e6e6e', '#8a8a8a'],
        wood_side: ['#50422d', '#423625', '#5e4e35'], // Dark oak/spruce-ish bark
        wood_top: ['#b59664', '#a68a5c', '#c4a26c'], // Lighter inside
        planks: ['#b38b55', '#a37e4d', '#c2975e'], // Oak planks
        leaves: ['#328227', '#2b7022', '#3a992d'], // Jungle/Oak leaves
        sand: ['#dbd3a0', '#c7c091', '#e8e0aa'],
        glass: ['#cbe8e8', '#b8d9d9', '#deffff'],
        cobblestone: ['#666666', '#555555', '#777777'],
        brick: ['#a35348', '#8f493f', '#b85e51'],
        coal_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#1a1a1a', '#2b2b2b'],
        iron_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#d9af86', '#e6c3a1'],
        gold_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#fcee4b', '#e6d845'],
        diamond_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#4aedd8', '#42d6c3']
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
    if (type === 'grass_side') {
        const grassColors = colors.grass_top;
        // Top 4 pixels are solid grass
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 4; y++) {
                ctx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                ctx.fillRect(x, y, 1, 1);
            }
            // Drip down effect for grass
            let dripLength = Math.floor(Math.random() * 3); // 0 to 2 extra pixels
            for (let y = 4; y < 4 + dripLength; y++) {
                ctx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (type === 'planks') {
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
