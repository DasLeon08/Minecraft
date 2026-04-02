const fs = require('fs');

let code = fs.readFileSync('public/game.js', 'utf8');

// Replace biome logic again to be robust and add Mesa and Swamp
const oldBiomeStart = "                let biome = 'forest';\n                if (tempNoise > 0.3 && moistureNoise < 0.2) {";
const oldBiomeEnd = "                } else {\n                    // Apply biome mapping\n                    if (biome === 'desert') surfaceBlock = 'sand';\n                    if (biome === 'snow') surfaceBlock = 'snow';\n                }";

// We'll replace by finding the index.
const startIdx = code.indexOf(oldBiomeStart);
const endIdx = code.indexOf(oldBiomeEnd) + oldBiomeEnd.length;

if (startIdx === -1 || endIdx === -1) {
    console.error("COULD NOT FIND BIOME MARKERS");
    process.exit(1);
}

const newBiomeLogic = `                let biome = 'forest';
                if (tempNoise > 0.4 && moistureNoise < 0.1) {
                    biome = 'mesa'; // Hot and very dry
                } else if (tempNoise > 0.3 && moistureNoise < 0.3) {
                    biome = 'desert';
                } else if (tempNoise < -0.3) {
                    biome = 'snow';
                } else if (tempNoise > 0.1 && moistureNoise > 0.4) {
                    biome = 'swamp';
                } else if (tempNoise > 0.2 && moistureNoise >= 0.2 && moistureNoise <= 0.4) {
                    biome = 'savanna';
                } else if (tempNoise > -0.1 && moistureNoise > 0.3) {
                    biome = 'jungle';
                }

                // Determine surface block type based on height and biome
                let surfaceBlock = 'grass';
                if (y < -2.5) {
                    if (riverNoise < 0.06) surfaceBlock = Math.random() > 0.5 ? 'dirt' : 'gravel';
                    else if (continentalness < -0.1 && y < -5.5) surfaceBlock = Math.random() > 0.7 ? 'gravel' : 'sand';
                    else surfaceBlock = 'sand';
                } else if (y > 45.5) {
                    surfaceBlock = 'snow'; // Very high mountain peaks
                } else if (y > 35.5) {
                    const elevDither = noise.noise2D(x * 0.3, z * 0.3) * 3;
                    if (y > 38.5 + elevDither) surfaceBlock = 'snow_dirt';
                    else surfaceBlock = 'stone';
                } else if (y > 25.5) {
                    const elevDither = noise.noise2D(x * 0.4, z * 0.4) * 2;
                    if (y > 28.5 + elevDither) surfaceBlock = 'stone';
                    else {
                        if (biome === 'desert') surfaceBlock = 'sand';
                        else if (biome === 'mesa') surfaceBlock = 'red_sand';
                        else if (biome === 'snow') surfaceBlock = 'snow';
                        else if (biome === 'swamp') surfaceBlock = 'mud';
                        else surfaceBlock = 'grass';
                    }
                } else {
                    if (biome === 'desert') surfaceBlock = 'sand';
                    else if (biome === 'mesa') surfaceBlock = 'red_sand';
                    else if (biome === 'snow') surfaceBlock = 'snow';
                    else if (biome === 'swamp') surfaceBlock = 'mud';
                }

                // If Swamp, override water level locally by filling more blocks with water or creating muddy surface
                if (biome === 'swamp' && topY > -3 && topY <= 0) {
                    // Make it watery mud
                    surfaceBlock = Math.random() > 0.5 ? 'water' : 'mud';
                }`;

code = code.substring(0, startIdx) + newBiomeLogic + code.substring(endIdx);

// Now handle the inner layer logic to add Mesa strata and Moss block transition
const oldLayerLogic = `                    } else if (currentY === topY) {
                        // Surface
                        blockType = surfaceBlock;
                    } else if (currentY > topY - 3 && surfaceBlock === 'grass') {
                        blockType = 'dirt';
                    } else if (currentY > topY - 3 && surfaceBlock === 'sand') {
                        blockType = 'sand';
                    } else if (currentY > topY - 3 && surfaceBlock === 'snow') {
                        blockType = 'dirt';`;

const newLayerLogic = `                    } else if (currentY === topY) {
                        // Surface
                        blockType = surfaceBlock;
                    } else if (currentY > topY - 3 && surfaceBlock === 'grass') {
                        blockType = 'dirt';
                    } else if (currentY > topY - 3 && surfaceBlock === 'sand') {
                        blockType = 'sandstone';
                    } else if (currentY > topY - 3 && surfaceBlock === 'red_sand') {
                        blockType = 'orange_terracotta';
                    } else if (currentY > topY - 3 && surfaceBlock === 'mud') {
                        blockType = 'dirt';
                    } else if (currentY > topY - 3 && surfaceBlock === 'snow') {
                        blockType = 'dirt';
                    } else if (biome === 'mesa' && currentY > 10) {
                        // Horizontal strata for Mesa (terracotta layers based on Y level)
                        if (currentY % 7 === 0) blockType = 'yellow_terracotta';
                        else if (currentY % 5 === 0) blockType = 'orange_terracotta';
                        else blockType = 'terracotta';`;

code = code.replace(oldLayerLogic, newLayerLogic);

fs.writeFileSync('public/game.js', code);
console.log("patched biome logic");
