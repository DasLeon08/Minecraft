const fs = require('fs');

let gameJs = fs.readFileSync('public/game.js', 'utf8');

const matsAnchor = "    sand: [";
const newMats = `    red_sand: [
        createMat('red_sand', { roughness: 1.0 }),
        createMat('red_sand', { roughness: 1.0 }),
        createMat('red_sand', { roughness: 1.0 }),
        createMat('red_sand', { roughness: 1.0 }),
        createMat('red_sand', { roughness: 1.0 }),
        createMat('red_sand', { roughness: 1.0 })
    ],
    terracotta: [
        createMat('terracotta', { roughness: 1.0 }),
        createMat('terracotta', { roughness: 1.0 }),
        createMat('terracotta', { roughness: 1.0 }),
        createMat('terracotta', { roughness: 1.0 }),
        createMat('terracotta', { roughness: 1.0 }),
        createMat('terracotta', { roughness: 1.0 })
    ],
    orange_terracotta: [
        createMat('orange_terracotta', { roughness: 1.0 }),
        createMat('orange_terracotta', { roughness: 1.0 }),
        createMat('orange_terracotta', { roughness: 1.0 }),
        createMat('orange_terracotta', { roughness: 1.0 }),
        createMat('orange_terracotta', { roughness: 1.0 }),
        createMat('orange_terracotta', { roughness: 1.0 })
    ],
    yellow_terracotta: [
        createMat('yellow_terracotta', { roughness: 1.0 }),
        createMat('yellow_terracotta', { roughness: 1.0 }),
        createMat('yellow_terracotta', { roughness: 1.0 }),
        createMat('yellow_terracotta', { roughness: 1.0 }),
        createMat('yellow_terracotta', { roughness: 1.0 }),
        createMat('yellow_terracotta', { roughness: 1.0 })
    ],
    sandstone: [
        createMat('sandstone', { roughness: 1.0 }),
        createMat('sandstone', { roughness: 1.0 }),
        createMat('sandstone', { roughness: 1.0 }),
        createMat('sandstone', { roughness: 1.0 }),
        createMat('sandstone', { roughness: 1.0 }),
        createMat('sandstone', { roughness: 1.0 })
    ],
    cactus: [
        createMat('cactus_side', { roughness: 1.0 }),
        createMat('cactus_side', { roughness: 1.0 }),
        createMat('cactus_top', { roughness: 1.0 }),
        createMat('cactus_top', { roughness: 1.0 }),
        createMat('cactus_side', { roughness: 1.0 }),
        createMat('cactus_side', { roughness: 1.0 })
    ],
    moss_block: [
        createMat('moss_block', { roughness: 1.0 }),
        createMat('moss_block', { roughness: 1.0 }),
        createMat('moss_block', { roughness: 1.0 }),
        createMat('moss_block', { roughness: 1.0 }),
        createMat('moss_block', { roughness: 1.0 }),
        createMat('moss_block', { roughness: 1.0 })
    ],
    mud: [
        createMat('mud', { roughness: 0.9, bumpScale: 0.1 }),
        createMat('mud', { roughness: 0.9, bumpScale: 0.1 }),
        createMat('mud', { roughness: 0.9, bumpScale: 0.1 }),
        createMat('mud', { roughness: 0.9, bumpScale: 0.1 }),
        createMat('mud', { roughness: 0.9, bumpScale: 0.1 }),
        createMat('mud', { roughness: 0.9, bumpScale: 0.1 })
    ],
    sand: [`;

if (!gameJs.includes('red_sand: [')) {
    gameJs = gameJs.replace(matsAnchor, newMats);
}

fs.writeFileSync('public/game.js', gameJs);
console.log('patched game.js with new materials');
