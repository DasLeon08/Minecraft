const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const players = {};
let hostId = null; // Track who is the host
const ops = new Set(); // Player IDs with OP perms

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
        // Spawn randomly within the world
        position: {
            x: Math.floor(Math.random() * 60) - 30,
            y: 35, // Drop from sky
            z: Math.floor(Math.random() * 60) - 30
        },
        targetPosition: null
    };
}

// Initial mobs
for (let i = 0; i < 5; i++) {
    spawnMob();
}

// --- Server Time (Day/Night) ---
let timeOfDay = 0; // 0 to Math.PI * 2
const dayDuration = 600; // seconds for a full day/night cycle
let lastTime = Date.now();

// Mob wandering & chasing loop
setInterval(() => {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    // Advance time of day
    timeOfDay += (delta / dayDuration) * Math.PI * 2;
    if (timeOfDay > Math.PI * 2) timeOfDay -= Math.PI * 2;

    const normalizedSunHeight = Math.sin(timeOfDay);
    const isNight = normalizedSunHeight < 0;

    const playerIds = Object.keys(players);
    Object.values(mobs).forEach(mob => {
        if (mob.type === 'zombie' || mob.type === 'creeper') {
            // Find closest player
            let closestDist = Infinity;
            let closestPlayer = null;
            playerIds.forEach(id => {
                const p = players[id];
                if (p.gamemode !== 0) return; // Only chase Survival players
                const dx = p.position.x - mob.position.x;
                const dy = p.position.y - mob.position.y;
                const dz = p.position.z - mob.position.z;
                // Full 3D distance check to prevent sky/cave attacking
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (dist < closestDist && dist < 15) { // Agro range
                    closestDist = dist;
                    closestPlayer = p;
                }
            });

            if (closestPlayer) {
                // Chase (mostly horizontal movement, let client raycast handle gravity)
                const dx = closestPlayer.position.x - mob.position.x;
                const dy = closestPlayer.position.y - mob.position.y;
                const dz = closestPlayer.position.z - mob.position.z;

                const flatLength = Math.sqrt(dx*dx + dz*dz);
                if (flatLength > 0.5) {
                    mob.position.x += (dx / flatLength) * 0.5;
                    mob.position.z += (dz / flatLength) * 0.5;
                }

                // Damage Player requires they are genuinely close in 3D space
                const trueLength = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (trueLength < 1.5) { // Slightly increased radius for collision bounding box
                    io.to(closestPlayer.id).emit('mobDamage', { amount: 2, type: mob.type });
                }
            } else {
                // Wander
                if (Math.random() < 0.2) {
                    mob.position.x += (Math.random() * 2) - 1;
                    mob.position.z += (Math.random() * 2) - 1;
                }
            }
        } else {
            // Passive mobs wander
            if (Math.random() < 0.2) {
                mob.position.x += (Math.random() * 2) - 1;
                mob.position.z += (Math.random() * 2) - 1;
            }
        }

        // Let the client dictate the mob's true Y position through a new client event
        // to sync gravity for server distance checks

        // basic bounds check
        if(mob.position.x > 30) mob.position.x = 30;
        if(mob.position.x < -30) mob.position.x = -30;
        if(mob.position.z > 30) mob.position.z = 30;
        if(mob.position.z < -30) mob.position.z = -30;
    });

    // Periodically spawn new mobs at night or randomly
    if (isNight && Math.random() < 0.1 && Object.keys(mobs).length < 25) {
        spawnMob();
    } else if (!isNight && Math.random() < 0.02 && Object.keys(mobs).length < 15) {
        // Spawn passive mobs during the day
        spawnMob();
    }

    // Broadcast mob and time update to all clients
    io.emit('serverTick', { mobs, timeOfDay });
}, 1000); // 1 tick per second for simple prototype

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // First player is host
    if (Object.keys(players).length === 0) {
        hostId = socket.id;
        ops.add(socket.id);
        console.log(`Player ${socket.id} is the new host and OP.`);
    }

    // Create new player
    players[socket.id] = {
        id: socket.id,
        position: { x: 0, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        gamemode: 0 // 0: Survival, 1: Creative, 2: Spectator
    };

    if (socket.id === hostId) {
        socket.emit('chatCommandResponse', "You are the server host. You have OP permissions. Try /gamemode 1");
    }

    // Send current players and world state to the new client
    socket.emit('currentPlayers', players);
    socket.emit('serverTick', { mobs, timeOfDay });
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

    // The host client simulates physics for the server's mobs and sends back the true Y coordinates
    socket.on('syncMobY', (data) => {
        if (socket.id === hostId) {
            Object.keys(data).forEach(id => {
                if (mobs[id]) {
                    mobs[id].position.y = data[id];
                }
            });
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

    // Chat handling
    socket.on('chatMessage', (msg) => {
        const outMsg = `<${socket.id.substring(0, 5)}> ${msg}`;
        io.emit('chatMessage', outMsg);
    });

    socket.on('chatCommand', (cmdStr) => {
        if (!ops.has(socket.id)) {
            socket.emit('chatCommandResponse', "You do not have permission to use commands.");
            return;
        }

        const args = cmdStr.split(' ');
        const cmd = args[0].toLowerCase();

        if (cmd === '/gamemode' || cmd === '/gm') {
            let mode = parseInt(args[1]);
            let targetId = socket.id;
            if (args[2] && players[args[2]]) {
                targetId = args[2];
            }
            if (!isNaN(mode) && mode >= 0 && mode <= 2) {
                players[targetId].gamemode = mode;
                if (targetId === socket.id) {
                    socket.emit('gamemodeUpdated', mode);
                } else {
                    io.to(targetId).emit('gamemodeUpdated', mode);
                    socket.emit('chatCommandResponse', `Set gamemode of ${targetId.substring(0,5)} to ${mode}`);
                }
            } else {
                socket.emit('chatCommandResponse', "Usage: /gamemode <0|1|2> [player]");
            }
        } else if (cmd === '/op') {
            const targetId = args[1];
            if (players[targetId]) {
                ops.add(targetId);
                socket.emit('chatCommandResponse', `Opped ${targetId.substring(0,5)}`);
                io.to(targetId).emit('chatCommandResponse', "You are now an OP.");
            } else {
                socket.emit('chatCommandResponse', "Player not found.");
            }
        } else {
            socket.emit('chatCommandResponse', "Unknown command.");
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        delete players[socket.id];
        ops.delete(socket.id);
        if (socket.id === hostId) {
            hostId = null; // Host disconnected
            const remainingPlayers = Object.keys(players);
            if (remainingPlayers.length > 0) {
                hostId = remainingPlayers[0]; // Assign new host
                ops.add(hostId);
                io.to(hostId).emit('chatCommandResponse', "You are the new server host (OP).");
            }
        }
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
