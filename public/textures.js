// Helper to draw isometric blocks for inventory
export function generateIsometricBlockIcon(topSrc, sideSrc, frontSrc) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    return new Promise((resolve) => {
        let loaded = 0;
        const topImg = new Image();
        const sideImg = new Image();
        const frontImg = new Image();

        const onload = () => {
            loaded++;
            if (loaded === 3) {
                // Draw Isometric Cube
                ctx.save();

                // Top Face
                ctx.translate(16, 8);
                ctx.scale(1, 0.5);
                ctx.rotate(45 * Math.PI / 180);
                ctx.drawImage(topImg, -11.3, -11.3, 22.6, 22.6);
                ctx.restore();

                // Left (Side) Face
                ctx.save();
                ctx.translate(16, 8);
                ctx.transform(1, 0.5, 0, 1, 0, 0); // Skew Y
                ctx.scale(0.707, 1);
                // Draw slightly darker to fake shadow
                ctx.filter = 'brightness(75%)';
                ctx.drawImage(sideImg, -16, 0, 16, 16);
                ctx.restore();

                // Right (Front) Face
                ctx.save();
                ctx.translate(16, 8);
                ctx.transform(1, -0.5, 0, 1, 0, 0); // Skew -Y
                ctx.scale(0.707, 1);
                ctx.filter = 'brightness(50%)'; // Darkest
                ctx.drawImage(frontImg, 0, 0, 16, 16);
                ctx.restore();

                resolve(canvas.toDataURL('image/png'));
            }
        };

        topImg.onload = sideImg.onload = frontImg.onload = onload;
        topImg.src = topSrc;
        sideImg.src = sideSrc;
        frontImg.src = frontSrc;
    });
}

// Generate simple 2D tool pixel art
export function generateToolIcon(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // Colors
    const stickColor = '#79553a';
    const woodColor = '#a37e4d';
    const stoneColor = '#8a8a8a';
    const ironColor = '#d9d9d9';
    const goldColor = '#fcee4b';
    const diamondColor = '#4aedd8';

    const drawPixel = (x, y, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
    };

    const drawStick = () => {
        for (let i = 2; i <= 10; i++) {
            drawPixel(i, 15 - i, stickColor);
            drawPixel(i+1, 15 - i, '#5e4e35'); // shading
        }
    };

    let headColor;
    if (type.includes('wooden')) headColor = woodColor;
    else if (type.includes('stone')) headColor = stoneColor;
    else if (type.includes('iron')) headColor = ironColor;
    else if (type.includes('gold')) headColor = goldColor;
    else if (type.includes('diamond')) headColor = diamondColor;

    if (type === 'stick') {
        drawStick();
    } else if (type.includes('pickaxe')) {
        drawStick();
        // Head
        ctx.fillStyle = headColor;
        ctx.fillRect(8, 2, 6, 2); // right side
        ctx.fillRect(2, 8, 2, 6); // left side (rotated conceptually)
        // Diagonal curve approximation
        drawPixel(13, 3, headColor);
        drawPixel(14, 4, headColor);
        drawPixel(14, 5, headColor);
        drawPixel(3, 13, headColor);
        drawPixel(4, 14, headColor);
        drawPixel(5, 14, headColor);
        // Center bracket
        ctx.fillStyle = '#444'; // binding
        ctx.fillRect(10, 4, 2, 2);
    } else if (type.includes('axe')) {
        drawStick();
        // Axe head
        ctx.fillStyle = headColor;
        ctx.fillRect(8, 2, 5, 5);
        ctx.fillRect(10, 1, 3, 7);
        // binding
        ctx.fillStyle = '#444';
        ctx.fillRect(9, 5, 2, 2);
    }

    return canvas.toDataURL('image/png');
}

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
        diamond_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#4aedd8', '#42d6c3'],
        water: ['#3e6db5', '#335c9a', '#4c86d1'], // Water blues
        lava: ['#e85f1c', '#f58727', '#d63c0f', '#fce230'], // Lava reds/oranges
        bedrock: ['#333333', '#222222', '#111111', '#444444', '#000000'], // Very dark scattered
        snow: ['#ffffff', '#f2f2f2', '#e6e6e6', '#d9d9d9'], // Snow/Ice colors
        dirt_snow_side: ['#866043', '#79553a', '#966c4a'] // Base is dirt, snow top added later
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
    if (type === 'grass_side' || type === 'dirt_snow_side') {
        const topColors = type === 'grass_side' ? colors.grass_top : colors.snow;

        // Top 4 pixels are solid grass/snow
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 4; y++) {
                ctx.fillStyle = topColors[Math.floor(Math.random() * topColors.length)];
                ctx.fillRect(x, y, 1, 1);
            }
            // Drip down effect
            let dripLength = Math.floor(Math.random() * 3); // 0 to 2 extra pixels
            for (let y = 4; y < 4 + dripLength; y++) {
                ctx.fillStyle = topColors[Math.floor(Math.random() * topColors.length)];
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
    } else if (type === 'water') {
        // slightly transparent overall
        const imgData = ctx.getImageData(0, 0, 16, 16);
        for(let i=3; i<imgData.data.length; i+=4) {
            imgData.data[i] = 200; // 0-255 opacity
        }
        ctx.putImageData(imgData, 0, 0);
    }

    const img = canvas.toDataURL('image/png');
    return img;
}
