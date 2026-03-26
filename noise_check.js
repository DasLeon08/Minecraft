const fs = require('fs');
const content = fs.readFileSync('public/game.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// Helper for procedural generation')) {
        for (let j = i; j < i + 30; j++) {
            console.log(lines[j]);
        }
        break;
    }
}
