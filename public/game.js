import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const socket = io(); // Connect to Socket.IO

// Basic setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 200, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    instructions.style.display = 'block';
});
scene.add(controls.getObject());

// initial camera position
camera.position.set(0, 2, 0);

// Movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

const onKeyDown = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (canJump === true) velocity.y += 10;
            canJump = false;
            break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- Terrain (Voxel Generation) ---
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshLambertMaterial({ color: 0x55aa55 }); // Green color

const worldSize = 20; // 20x20 blocks
const objects = []; // Store blocks for collision/raycasting

for (let x = -worldSize / 2; x < worldSize / 2; x++) {
    for (let z = -worldSize / 2; z < worldSize / 2; z++) {
        const voxel = new THREE.Mesh(geometry, material);
        voxel.position.set(x, -0.5, z); // Center of block is 0, so -0.5 makes top flush with 0
        scene.add(voxel);
        objects.push(voxel);
    }
}

// --- Multiplayer Setup ---
const otherPlayers = {};
const playerGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for other players

function addOtherPlayer(playerInfo) {
    const mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    mesh.position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
    scene.add(mesh);
    otherPlayers[playerInfo.id] = mesh;
}

function removeOtherPlayer(playerId) {
    if (otherPlayers[playerId]) {
        scene.remove(otherPlayers[playerId]);
        delete otherPlayers[playerId];
    }
}

// Socket Events
socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id !== socket.id) {
            addOtherPlayer(players[id]);
        }
    });
});

socket.on('newPlayer', (playerInfo) => {
    addOtherPlayer(playerInfo);
});

socket.on('playerDisconnected', (playerId) => {
    removeOtherPlayer(playerId);
});

socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
        // Add rotation sync here later if needed
    }
});

// Sync initial world state
socket.on('worldState', (updates) => {
    updates.forEach(update => applyBlockUpdate(update));
});

socket.on('blockUpdated', (update) => {
    applyBlockUpdate(update);
});

function applyBlockUpdate(data) {
    if (data.type === 'remove') {
        const objToRemove = objects.find(obj =>
            Math.abs(obj.position.x - data.position.x) < 0.1 &&
            Math.abs(obj.position.y - data.position.y) < 0.1 &&
            Math.abs(obj.position.z - data.position.z) < 0.1
        );
        if (objToRemove) {
            scene.remove(objToRemove);
            objects.splice(objects.indexOf(objToRemove), 1);
        }
    } else if (data.type === 'add') {
        const voxel = new THREE.Mesh(geometry, placeMaterial);
        voxel.position.copy(data.position);
        scene.add(voxel);
        objects.push(voxel);
    }
}

// --- Voxel Interaction (Mining / Placing) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(); // Always center (0,0) for pointer lock
const placeMaterial = new THREE.MeshLambertMaterial({ color: 0x885522 }); // Brown for placed blocks

document.addEventListener('mousedown', (event) => {
    event.preventDefault(); // prevent context menu
    if (controls.isLocked === true) {
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(objects, false);

        if (intersects.length > 0) {
            const intersect = intersects[0];

            // Left click (0) to remove, Right click (2) to place
            if (event.button === 0) {
                // Remove block
                if (intersect.object !== scene) {
                    const pos = intersect.object.position;
                    scene.remove(intersect.object);
                    objects.splice(objects.indexOf(intersect.object), 1);
                    socket.emit('updateBlock', { type: 'remove', position: pos });
                }
            } else if (event.button === 2) {
                // Place block
                const voxel = new THREE.Mesh(geometry, placeMaterial);
                // Calculate correct position based on integer grid logic
                voxel.position.copy(intersect.point).add(intersect.face.normal.clone().multiplyScalar(0.5));

                // For a 1x1x1 cube, if the initial terrain is placed at (integer, -0.5, integer):
                // x and z should be rounded to the nearest integer.
                // y should be rounded to the nearest integer minus 0.5.
                voxel.position.x = Math.round(voxel.position.x);
                voxel.position.z = Math.round(voxel.position.z);
                voxel.position.y = Math.floor(voxel.position.y) + 0.5;

                // Don't place block inside player
                // We do a simple AABB check against the player's bounding box
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    controls.getObject().position,
                    new THREE.Vector3(0.8, 1.8, 0.8) // player size
                );

                const blockBox = new THREE.Box3().setFromCenterAndSize(
                    voxel.position,
                    new THREE.Vector3(1, 1, 1)
                );

                if (!playerBox.intersectsBox(blockBox)) {
                    scene.add(voxel);
                    objects.push(voxel);
                    socket.emit('updateBlock', { type: 'add', position: voxel.position });
                }
            }
        }
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        // Apply friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Apply gravity
        velocity.y -= 9.8 * 3.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Ensure consistent movement in all directions

        const speed = 50.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        controls.getObject().position.y += (velocity.y * delta); // new behavior

        // --- Collision Detection ---
        const playerPos = controls.getObject().position.clone();
        const playerSize = new THREE.Vector3(0.8, 1.8, 0.8);

        // We simulate movement and check for collision
        const nextPos = playerPos.clone();

        // Create player AABB
        const playerBox = new THREE.Box3();

        // Check Y collision first
        let onGround = false;
        playerBox.setFromCenterAndSize(nextPos, playerSize);

        for (let i = 0; i < objects.length; i++) {
            const blockBox = new THREE.Box3().setFromObject(objects[i]);
            if (playerBox.intersectsBox(blockBox)) {
                // If moving down
                if (velocity.y < 0) {
                    controls.getObject().position.y = blockBox.max.y + (playerSize.y / 2);
                    velocity.y = 0;
                    onGround = true;
                    canJump = true;
                } else if (velocity.y > 0) { // moving up
                    controls.getObject().position.y = blockBox.min.y - (playerSize.y / 2);
                    velocity.y = 0;
                }
            }
        }

        // If falling out of the world
        if (controls.getObject().position.y < -10) {
            velocity.y = 0;
            controls.getObject().position.set(0, 2, 0);
        }

        // We should really handle X/Z collisions, but this is a simple prototype
        // To prevent walking through walls, we'll do a simple check
        playerBox.setFromCenterAndSize(controls.getObject().position, playerSize);
        for (let i = 0; i < objects.length; i++) {
            const blockBox = new THREE.Box3().setFromObject(objects[i]);
            if (playerBox.intersectsBox(blockBox)) {
                // Push out of the block based on overlap
                const overlapX = Math.min(playerBox.max.x - blockBox.min.x, blockBox.max.x - playerBox.min.x);
                const overlapZ = Math.min(playerBox.max.z - blockBox.min.z, blockBox.max.z - playerBox.min.z);

                if (overlapX < overlapZ) {
                    if (playerBox.max.x > blockBox.min.x && playerBox.min.x < blockBox.min.x) {
                        controls.getObject().position.x -= overlapX;
                    } else {
                        controls.getObject().position.x += overlapX;
                    }
                    velocity.x = 0;
                } else {
                    if (playerBox.max.z > blockBox.min.z && playerBox.min.z < blockBox.min.z) {
                        controls.getObject().position.z -= overlapZ;
                    } else {
                        controls.getObject().position.z += overlapZ;
                    }
                    velocity.z = 0;
                }
            }
        }

        // Emit player movement
        if(velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) {
             socket.emit('playerMovement', {
                 position: controls.getObject().position,
                 rotation: controls.getObject().rotation // simplistic
             });
        }
    }

    prevTime = time;

    renderer.render(scene, camera);
}
animate();

// Export for use in other modules if needed, or just let it run
export { scene, camera, renderer };
