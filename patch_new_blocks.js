const fs = require('fs');

let tex = fs.readFileSync('public/textures.js', 'utf8');

const anchor = "bookshelf: ['#b38b55', '#a37e4d', '#c2975e'], // Oak planks base, books added later";
const newColors = `
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
`;

if (!tex.includes('red_sand')) {
    tex = tex.replace(anchor, newColors);
}

// Special drawing rules for cactus
const drawAnchor = "if (type === 'bookshelf') {";
const newDrawing = `if (type === 'cactus_side') {
        // Draw vertical stripes
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = 0.3;
        for (let i = 2; i < 16; i += 4) {
            ctx.fillRect(i, 0, 1, 16);
        }
        ctx.globalAlpha = 1.0;
    } else if (type === 'cactus_top') {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        // Inner circle
        ctx.fillRect(2, 2, 12, 12);
        ctx.globalAlpha = 1.0;
    } else if (type === 'sandstone') {
        ctx.fillStyle = '#bfae54';
        ctx.fillRect(0, 0, 16, 2); // Top border
        ctx.fillRect(0, 14, 16, 2); // Bottom border
    } else if (type === 'bookshelf') {`;

if (!tex.includes('cactus_side')) {
    tex = tex.replace(drawAnchor, newDrawing);
}

fs.writeFileSync('public/textures.js', tex);
console.log('patched new block textures');
