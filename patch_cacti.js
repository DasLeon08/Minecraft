const fs = require('fs');

let code = fs.readFileSync('public/game.js', 'utf8');

// Add cactus placement to the vegetation logic
const vegStart = "                // Procedural Trees (spawn only on grass or snow, frequency depends on biome)";
const vegEnd = "                // Procedural Structures: Villages";

const startIdx = code.indexOf(vegStart);
const endIdx = code.indexOf(vegEnd);

const oldVeg = code.substring(startIdx, endIdx);

const newVeg = `                // Procedural Vegetation (spawn frequency depends on biome)
                const isTreeSurface = surfaceBlock === 'grass' || surfaceBlock === 'mud' || (surfaceBlock === 'snow' && biome === 'forest');
                let treeChance = 0.05;
                if (biome === 'desert' || biome === 'mesa') treeChance = 0.0;
                else if (biome === 'snow') treeChance = 0.01;
                else if (biome === 'jungle') treeChance = 0.25;
                else if (biome === 'swamp') treeChance = 0.10;
                else if (biome === 'savanna') treeChance = 0.005;

                // Add cacti on sand
                if ((biome === 'desert' || biome === 'mesa') && topY > waterLevel && surfaceBlock === 'sand' && Math.random() < 0.02) {
                    const cactusHeight = Math.floor(Math.random() * 3) + 1; // 1-3 blocks tall
                    for (let cy = 1; cy <= cactusHeight; cy++) {
                        setVoxelData(x, topY + cy, z, cy === cactusHeight ? 'cactus_top' : 'cactus_side');
                    }
                }

                // Cacti on red_sand
                if ((biome === 'desert' || biome === 'mesa') && topY > waterLevel && surfaceBlock === 'red_sand' && Math.random() < 0.02) {
                    const cactusHeight = Math.floor(Math.random() * 3) + 1;
                    for (let cy = 1; cy <= cactusHeight; cy++) {
                        setVoxelData(x, topY + cy, z, cy === cactusHeight ? 'cactus_top' : 'cactus_side');
                    }
                }

`;

code = code.substring(0, startIdx) + newVeg + code.substring(endIdx);
fs.writeFileSync('public/game.js', code);
console.log('patched cacti');
