import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateTexture } from './textures.js';
import * as UI from './ui.js';
import { noise } from './noise.js';

const socket = io(); // Connect to Socket.IO

// Basic setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // slightly dimmer ambient
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 200, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
scene.add(directionalLight);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Materials Map
export const blockMaterials = {
    grass: [
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) }), // right
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) }), // left
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('grass_top')) }), // top
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) }), // bottom
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) }), // front
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) })  // back
    ],
    dirt: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) }),
    stone: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('stone')) }),
    wood: [
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('wood_side')) }), // right
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('wood_side')) }), // left
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('wood_top')) }), // top
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('wood_top')) }), // bottom
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('wood_side')) }), // front
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('wood_side')) })  // back
    ],
    planks: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('planks')) }),
    leaves: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('leaves')), transparent: true, alphaTest: 0.1 }),
    sand: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('sand')) }),
    glass: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('glass')), transparent: true, opacity: 0.8 }),
    cobblestone: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('cobblestone')) }),
    brick: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('brick')) }),
    coal_ore: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('coal_ore')) }),
    iron_ore: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('iron_ore')) }),
    gold_ore: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('gold_ore')) }),
    diamond_ore: new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('diamond_ore')) })
};

// Set nearest filter for pixel art look
for (const key in blockMaterials) {
    if (Array.isArray(blockMaterials[key])) {
        blockMaterials[key].forEach(mat => {
            mat.map.magFilter = THREE.NearestFilter;
            mat.map.minFilter = THREE.NearestFilter;
        });
    } else {
        blockMaterials[key].map.magFilter = THREE.NearestFilter;
        blockMaterials[key].map.minFilter = THREE.NearestFilter;
    }
}

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');
const inventoryEl = document.getElementById('inventory');
const closeInvBtn = document.getElementById('close-inventory');

instructions.addEventListener('click', () => {
    if (inventoryEl.style.display !== 'block') {
        controls.lock();
    }
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    inventoryEl.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    if (inventoryEl.style.display !== 'block') {
        instructions.style.display = 'block';
    }
});

closeInvBtn.addEventListener('click', () => {
    controls.lock();
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
    if (controls.isLocked) {
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
            case 'Digit1': UI.selectHotbarSlot(0); break;
            case 'Digit2': UI.selectHotbarSlot(1); break;
            case 'Digit3': UI.selectHotbarSlot(2); break;
            case 'Digit4': UI.selectHotbarSlot(3); break;
            case 'Digit5': UI.selectHotbarSlot(4); break;
            case 'Digit6': UI.selectHotbarSlot(5); break;
            case 'Digit7': UI.selectHotbarSlot(6); break;
            case 'Digit8': UI.selectHotbarSlot(7); break;
            case 'Digit9': UI.selectHotbarSlot(8); break;
        }
    }

    if (event.code === 'KeyE') {
        if (controls.isLocked) {
            controls.unlock();
            inventoryEl.style.display = 'block';
        } else {
            inventoryEl.style.display = 'none';
            controls.lock();
        }
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

// --- Procedural Terrain Generation ---
const geometry = new THREE.BoxGeometry(1, 1, 1);
const objects = []; // Store blocks for collision/raycasting

const worldSize = 40; // 40x40 blocks

function createBlock(type, x, y, z) {
    const material = blockMaterials[type] || blockMaterials['dirt'];
    const voxel = new THREE.Mesh(geometry, material);
    voxel.position.set(x, y, z);
    voxel.receiveShadow = true;
    voxel.castShadow = true;
    voxel.userData.type = type;
    scene.add(voxel);
    objects.push(voxel);
}

for (let x = -worldSize / 2; x < worldSize / 2; x++) {
    for (let z = -worldSize / 2; z < worldSize / 2; z++) {
        // Heightmap via 2D noise
        // Smooth rolling hills, amplitude ~5
        const noiseVal = noise.fbm2D(x * 0.05, z * 0.05, 4, 0.5, 2.0);
        const y = Math.floor(noiseVal * 10) - 5 + 0.5; // Offset to n.5 so top is at integer

        // Determine surface block type
        let surfaceBlock = 'grass';
        if (y < -3.5) {
            surfaceBlock = 'sand'; // Beach/ocean floor level
        } else if (y > 2.5) {
            surfaceBlock = 'stone'; // Mountain tops
        }

        // Add top block
        createBlock(surfaceBlock, x, y, z);

        // Add some depth (dirt or stone)
        if (surfaceBlock === 'grass') {
            createBlock('dirt', x, y - 1, z);
            createBlock('stone', x, y - 2, z);
        } else if (surfaceBlock === 'sand') {
            createBlock('sand', x, y - 1, z);
            createBlock('stone', x, y - 2, z);
        } else {
            createBlock('stone', x, y - 1, z);
            createBlock('stone', x, y - 2, z);
        }

        // Procedural Trees (spawn only on grass, 5% chance)
        if (surfaceBlock === 'grass' && Math.random() < 0.05) {
            const treeHeight = Math.floor(Math.random() * 3) + 4; // 4-6 blocks tall
            for (let i = 1; i <= treeHeight; i++) {
                createBlock('wood', x, y + i, z);
            }
            // Leaves
            for (let lx = -2; lx <= 2; lx++) {
                for (let lz = -2; lz <= 2; lz++) {
                    for (let ly = 0; ly <= 1; ly++) {
                        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 1) continue; // rounded corners
                        if (lx === 0 && lz === 0 && ly === 0) continue; // trunk space
                        createBlock('leaves', x + lx, y + treeHeight - 1 + ly, z + lz);
                    }
                }
            }
        }
    }
}

// Adjust camera spawn height based on terrain center
const spawnNoise = noise.fbm2D(0, 0, 4, 0.5, 2.0);
const spawnY = Math.floor(spawnNoise * 10) - 5 + 2.5;
camera.position.set(0, spawnY, 0);

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

// --- Mobs Rendering ---
const renderedMobs = {};
const mobGeometries = {
    pig: new THREE.BoxGeometry(0.8, 0.8, 0.8),
    zombie: new THREE.BoxGeometry(0.8, 1.8, 0.8),
    cow: new THREE.BoxGeometry(1.2, 1.2, 1.2),
    creeper: new THREE.BoxGeometry(0.8, 1.6, 0.8)
};
const mobMaterials = {
    pig: new THREE.MeshLambertMaterial({ color: 0xFFC0CB }),
    zombie: new THREE.MeshLambertMaterial({ color: 0x006400 }),
    cow: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    creeper: new THREE.MeshLambertMaterial({ color: 0x00FF00 })
};

socket.on('mobsUpdate', (serverMobs) => {
    const mobRaycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0);

    // Update or add
    Object.keys(serverMobs).forEach(id => {
        const mobData = serverMobs[id];
        let mesh = renderedMobs[id];

        if (!mesh) {
            mesh = new THREE.Mesh(mobGeometries[mobData.type], mobMaterials[mobData.type]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            renderedMobs[id] = mesh;
            mesh.position.set(mobData.position.x, mobData.position.y, mobData.position.z);
        } else {
            // Smoothly move towards target in animation loop later, but hard snap for now
            mesh.position.x = mobData.position.x;
            mesh.position.z = mobData.position.z;
        }

        // Snap to ground
        mobRaycaster.set(new THREE.Vector3(mesh.position.x, 50, mesh.position.z), downVector);
        const intersects = mobRaycaster.intersectObjects(objects, false);
        if (intersects.length > 0) {
            // Place mob exactly on top of block.
            // e.g., if geometry is 1.8 high, center is at +0.9 from ground
            const heightHalf = mesh.geometry.parameters.height / 2;
            mesh.position.y = intersects[0].point.y + heightHalf;
        }
    });

    // Remove dead/missing
    Object.keys(renderedMobs).forEach(id => {
        if (!serverMobs[id]) {
            scene.remove(renderedMobs[id]);
            delete renderedMobs[id];
        }
    });
});

// Sync initial world state
socket.on('worldState', (updates) => {
    updates.forEach(update => applyBlockUpdate(update));
});

socket.on('blockUpdated', (update) => {
    applyBlockUpdate(update);
});

function applyBlockUpdate(data) {
    if (data.action === 'remove') {
        const objToRemove = objects.find(obj =>
            Math.abs(obj.position.x - data.position.x) < 0.1 &&
            Math.abs(obj.position.y - data.position.y) < 0.1 &&
            Math.abs(obj.position.z - data.position.z) < 0.1
        );
        if (objToRemove) {
            scene.remove(objToRemove);
            objects.splice(objects.indexOf(objToRemove), 1);
        }
    } else if (data.action === 'add') {
        const material = blockMaterials[data.blockType] || blockMaterials['dirt'];
        const voxel = new THREE.Mesh(geometry, material);
        voxel.position.copy(data.position);
        voxel.receiveShadow = true;
        voxel.castShadow = true;
        voxel.userData.type = data.blockType;
        scene.add(voxel);
        objects.push(voxel);
    }
}

// --- Voxel Interaction (Mining / Placing) ---
export let activeBlockType = 'dirt'; // Default placeable block

// Simple function to change active block (used later by UI)
export function setActiveBlock(type) {
    activeBlockType = type;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(); // Always center (0,0) for pointer lock

document.addEventListener('mousedown', (event) => {
    if (controls.isLocked === true) {
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(objects, false);

        if (intersects.length > 0) {
            const intersect = intersects[0];

            // Left click (0) to remove, Right click (2) to place
            if (event.button === 0) {
                // Remove block
                // Don't remove the bottommost dirt (y < -1) to prevent falling forever, or let them do it? Let's just limit y.
                if (intersect.object !== scene && intersect.object.position.y > -2) {
                    const pos = intersect.object.position;
                    scene.remove(intersect.object);
                    objects.splice(objects.indexOf(intersect.object), 1);
                    socket.emit('updateBlock', { action: 'remove', position: pos });
                }
            } else if (event.button === 2) {
                // Place block
                const material = blockMaterials[activeBlockType] || blockMaterials['dirt'];
                const voxel = new THREE.Mesh(geometry, material);
                voxel.receiveShadow = true;
                voxel.castShadow = true;
                voxel.userData.type = activeBlockType;

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
                    socket.emit('updateBlock', { action: 'add', blockType: activeBlockType, position: voxel.position });
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
