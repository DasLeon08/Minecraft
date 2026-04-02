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
        gravel: ['#807c7c', '#6e6b6b', '#918d8d', '#575555'],
        iron_block: ['#d8d8d8', '#cccccc', '#f0f0f0'], // White/Grey metallic
        gold_block: ['#f8d548', '#d6b334', '#ffea6d'], // Shiny yellow
        iron_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#d8d8d8', '#cca384'], // Stone with iron flakes


        red_sand: ['#b35f2d', '#a35526', '#c26633'], // Red mesa sand
        terracotta: ['#9c5c43', '#8e543d', '#a66448'], // Uncolored hardened clay
        orange_terracotta: ['#a15325', '#914920', '#b05928'],
        yellow_terracotta: ['#ba8523', '#a8781f', '#c48d25'],
        sandstone: ['#d1c890', '#c2b982', '#e0d899'],
        cactus_side: ['#0f5e14', '#0d5411', '#127318'],
        cactus_top: ['#127318', '#0f5e14', '#0d5411'], // Similar but we will draw stripes
        moss_block: ['#596e2d', '#4f6327', '#647c32'],
        mud: ['#3e2d26', '#382821', '#45322a'],
        bookshelf: ['#b38b55', '#a37e4d', '#c2975e'], // Oak planks base, books added later

        lapis_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#2954a3', '#1e3e7a'], // Blue specks
        redstone_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#a31e1e', '#e62e2e'], // Red specks
        coal_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#1a1a1a', '#2b2b2b'],
        iron_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#d9af86', '#e6c3a1'],
        gold_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#fcee4b', '#e6d845'],
        diamond_ore: ['#7d7d7d', '#6e6e6e', '#8a8a8a', '#4aedd8', '#42d6c3'],
        water: ['#3e6db5', '#335c9a', '#4c86d1'], // Water blues
        lava: ['#e85f1c', '#f58727', '#d63c0f', '#fce230'], // Lava reds/oranges
        bedrock: ['#333333', '#222222', '#111111', '#444444', '#000000'], // Very dark scattered
        snow: ['#ffffff', '#f2f2f2', '#e6e6e6', '#d9d9d9'], // Snow/Ice colors
        dirt_snow_side: ['#866043', '#79553a', '#966c4a'], // Base is dirt, snow top added later
        obsidian: ['#140f1a', '#1e1428', '#2d1e3d', '#3d284d'], // Dark purple/black
        end_stone: ['#e6e6b8', '#d9d9a3', '#cccc8f', '#b3b37a'], // Pale yellow porous stone
        netherrack: ['#612121', '#752b2b', '#8a3333', '#521c1c'], // Fleshy red/brown
        glowstone: ['#ffcc66', '#ffdb99', '#ffb366', '#ff9933'], // Bright yellow/orange
        nether_brick: ['#2e151b', '#3d1c24', '#4c232d'], // Dark purplish-red brick
        soul_sand: ['#544033', '#403026', '#30241d'], // Wavy dark brown
        quartz_ore: ['#612121', '#752b2b', '#8a3333', '#ffffff', '#e6e6e6'] // Netherrack + white
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
    } else if (type === 'brick' || type === 'nether_brick') {
        ctx.fillStyle = type === 'brick' ? '#DDDDDD' : '#221014'; // light or dark mortar
        for (let y = 0; y < 16; y += 4) {
             ctx.fillRect(0, y, 16, 1);
             ctx.fillRect(y + (y % 8 === 0 ? 0 : 8), y, 1, 4); // staggered brick verticals
        }
    } else if (type === 'bookshelf') {
        // Bookshelf styling over plank background
        ctx.fillStyle = '#4e3318'; // dark wood borders
        ctx.fillRect(0, 0, 16, 2);
        ctx.fillRect(0, 7, 16, 2);
        ctx.fillRect(0, 14, 16, 2);

        // Draw colorful books
        const bookColors = ['#9e2a2a', '#2a9e33', '#2a3b9e', '#9e8c2a', '#6a2a9e', '#9e672a', '#d9d9d9'];
        for (let y = 2; y <= 8; y += 7) { // Top shelf and bottom shelf start Y
            for (let x = 1; x < 15; x += 2 + Math.floor(Math.random() * 2)) {
                ctx.fillStyle = bookColors[Math.floor(Math.random() * bookColors.length)];
                ctx.fillRect(x, y, 2 + Math.floor(Math.random()*1), 5); // book width 2-3, height 5
            }
        }
    } else if (type === 'gravel') {
        // Gravel is a bit noisier than plain noise, maybe add bigger pebbles
        ctx.fillStyle = '#403d3d';
        for(let i=0; i<15; i++) {
            ctx.fillRect(Math.floor(Math.random()*15), Math.floor(Math.random()*15), 2, 2);
        }
    } else if (type === 'obsidian') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(2, 2, 2, 8); // fake glassy reflection
    } else if (type === 'soul_sand') {
        ctx.fillStyle = '#1f1610';
        for(let i=0; i<10; i++) {
             // fake little spooky faces
             ctx.fillRect(Math.floor(Math.random()*14), Math.floor(Math.random()*14), 2, 1);
             ctx.fillRect(Math.floor(Math.random()*14), Math.floor(Math.random()*14), 1, 2);
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


// Generate a simple bump/height map based on the lightness of the generated texture
export function generateBumpTexture(type) {
    const origUrl = generateTexture(type);
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, 16, 16);
            const data = imgData.data;
            // Convert to grayscale for height map (lighter = higher)
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Human eye luma
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;

                // Enhance contrast for stronger bump
                let bump = (luma - 128) * 1.5 + 128;
                bump = Math.max(0, Math.min(255, bump));

                data[i] = bump;
                data[i + 1] = bump;
                data[i + 2] = bump;
            }
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = origUrl;
    });
}
