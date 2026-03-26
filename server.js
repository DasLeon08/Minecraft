const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const players = {};
// Store world state as a map of blocks to prevent memory leaks from infinite lists
// Map key: "x,y,z", value: type (e.g., 'add')
const worldBlocks = new Map();

// --- Server-Side Mobs ---
const mobs = {};
const mobTypes = ['pig', 'zombie', 'cow', 'creeper'];

function spawnMob() {
    const id = Math.random().toString(36).substr(2, 9);
    mobs[id] = {
        id: id,
        type: mobTypes[Math.floor(Math.random() * mobTypes.length)],
        // Spawn randomly within the 40x40 world
        position: {
            x: Math.floor(Math.random() * 30) - 15,
            y: 10, // Drop from sky
            z: Math.floor(Math.random() * 30) - 15
        },
        targetPosition: null
    };
}

// Initial mobs
for (let i = 0; i < 5; i++) {
    spawnMob();
}

// Mob wandering loop
setInterval(() => {
    Object.values(mobs).forEach(mob => {
        // Move randomly
        if (Math.random() < 0.2) {
            mob.position.x += (Math.random() * 2) - 1;
            mob.position.z += (Math.random() * 2) - 1;

            // basic bounds check
            if(mob.position.x > 20) mob.position.x = 20;
            if(mob.position.x < -20) mob.position.x = -20;
            if(mob.position.z > 20) mob.position.z = 20;
            if(mob.position.z < -20) mob.position.z = -20;
        }
    });
    // Broadcast mob positions
    io.emit('mobsUpdate', mobs);
}, 1000); // 1 tick per second for simple prototype

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Create new player
    players[socket.id] = {
        id: socket.id,
        position: { x: 0, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    };

    // Send current players and world state to the new client
    socket.emit('currentPlayers', players);
    socket.emit('mobsUpdate', mobs);
    // Convert map to array for initial sync
    const currentWorld = Array.from(worldBlocks.entries()).map(([key, value]) => {
        const [x, y, z] = key.split(',').map(Number);
        if (value === 'remove') {
             return { action: 'remove', position: { x, y, z } };
        } else {
             return { action: 'add', blockType: value, position: { x, y, z } };
        }
    });
    socket.emit('worldState', currentWorld);

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (movementData) => {
        if(players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].rotation = movementData.rotation;

            // Broadcast movement to others
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('updateBlock', (blockData) => {
        // blockData: { action: 'add'/'remove', position: {x,y,z}, blockType: 'grass' }
        const key = `${blockData.position.x},${blockData.position.y},${blockData.position.z}`;

        if (blockData.action === 'add') {
            worldBlocks.set(key, blockData.blockType);
        } else if (blockData.action === 'remove') {
            // Store the removal so late joiners also remove initial terrain
            worldBlocks.set(key, 'remove');
        }

        // Broadcast to everyone else
        socket.broadcast.emit('blockUpdated', blockData);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
