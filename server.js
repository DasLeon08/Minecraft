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
