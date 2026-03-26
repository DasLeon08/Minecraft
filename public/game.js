import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateTexture } from './textures.js';
import * as UI from './ui.js';
import { noise } from './noise.js';

const socket = io(); // Connect to Socket.IO

// Basic setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Nice sky blue
scene.fog = new THREE.FogExp2(0x87CEEB, 0.015); // Better, more natural volumetric-looking fog

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Sun ---
const sunGeo = new THREE.BoxGeometry(8, 8, 8);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFFF88 }); // Bright yellow/white
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.set(100, 200, 50); // Matches directional light
scene.add(sunMesh);

// --- Clouds ---
const clouds = [];
const cloudGeo = new THREE.BoxGeometry(6, 2, 8);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6 });
for(let i=0; i<10; i++) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(Math.random() * 200 - 100, 40 + Math.random() * 10, Math.random() * 200 - 100);
    scene.add(cloud);
    clouds.push(cloud);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }); // Better z-fighting resolution
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better lighting colors
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- Selection Outline ---
const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)); // Slightly larger to prevent Z-fighting
const outlineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
const selectionOutline = new THREE.LineSegments(outlineGeo, outlineMat);
selectionOutline.visible = false;
scene.add(selectionOutline);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // slightly dimmer ambient
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffeedd, 1.0); // warmer light
directionalLight.position.set(100, 200, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096; // higher resolution shadows
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.bias = -0.0005; // fix shadow acne
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100; // expanded shadow area
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Hemisphere light for better outdoor lighting (blueish sky, greenish ground)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Materials Map
export const blockMaterials = {
    grass: [
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('grass_side')) }), // right
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('grass_side')) }), // left
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('grass_top')) }), // top
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('dirt')) }), // bottom
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('grass_side')) }), // front
        new THREE.MeshLambertMaterial({ map: textureLoader.load(generateTexture('grass_side')) })  // back
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

// --- Voxel Data Structure & Hidden Surface Removal ---
const geometry = new THREE.BoxGeometry(1, 1, 1);
const objects = []; // Active meshes for raycasting
export const worldData = new Map(); // x,y,z -> type
const renderedBlocks = new Map(); // x,y,z -> THREE.Mesh

const worldSize = 64; // 64x64 blocks
const worldDepth = -30; // generate down to this y-level

const transparentBlocks = ['glass', 'leaves', 'water'];

function getBlockKey(x, y, z) {
    return `${x},${y},${z}`;
}

// Add block to data but don't render yet
function setVoxelData(x, y, z, type) {
    worldData.set(getBlockKey(x, y, z), type);
}

function getVoxelData(x, y, z) {
    return worldData.get(getBlockKey(x, y, z));
}

function isTransparent(type) {
    if (!type) return true; // Air is transparent
    return transparentBlocks.includes(type);
}

function shouldRenderFace(x, y, z, dx, dy, dz) {
    const neighborType = getVoxelData(x + dx, y + dy, z + dz);
    return isTransparent(neighborType);
}

function shouldRenderBlock(x, y, z, type) {
    // Render if any adjacent block is transparent
    if (shouldRenderFace(x, y, z, 1, 0, 0)) return true;
    if (shouldRenderFace(x, y, z, -1, 0, 0)) return true;
    if (shouldRenderFace(x, y, z, 0, 1, 0)) return true;
    if (shouldRenderFace(x, y, z, 0, -1, 0)) return true;
    if (shouldRenderFace(x, y, z, 0, 0, 1)) return true;
    if (shouldRenderFace(x, y, z, 0, 0, -1)) return true;
    return false;
}

function renderBlock(x, y, z, type) {
    const key = getBlockKey(x, y, z);
    if (renderedBlocks.has(key)) return; // Already rendered

    const material = blockMaterials[type] || blockMaterials['dirt'];
    const voxel = new THREE.Mesh(geometry, material);
    voxel.position.set(x, y, z);
    voxel.receiveShadow = true;
    voxel.castShadow = true;
    voxel.userData.type = type;

    scene.add(voxel);
    objects.push(voxel);
    renderedBlocks.set(key, voxel);
}

function removeRenderedBlock(x, y, z) {
    const key = getBlockKey(x, y, z);
    const voxel = renderedBlocks.get(key);
    if (voxel) {
        scene.remove(voxel);
        objects.splice(objects.indexOf(voxel), 1);
        renderedBlocks.delete(key);
    }
}

function updateBlockVisibility(x, y, z) {
    const type = getVoxelData(x, y, z);
    if (!type) {
        removeRenderedBlock(x, y, z);
        return;
    }

    if (shouldRenderBlock(x, y, z, type)) {
        renderBlock(x, y, z, type);
    } else {
        removeRenderedBlock(x, y, z);
    }
}

function updateAdjacentBlocksVisibility(x, y, z) {
    updateBlockVisibility(x + 1, y, z);
    updateBlockVisibility(x - 1, y, z);
    updateBlockVisibility(x, y + 1, z);
    updateBlockVisibility(x, y - 1, z);
    updateBlockVisibility(x, y, z + 1);
    updateBlockVisibility(x, y, z - 1);
}

// Generate the initial world map
for (let x = -worldSize / 2; x < worldSize / 2; x++) {
    for (let z = -worldSize / 2; z < worldSize / 2; z++) {
        // Heightmap via 2D noise
        const noiseVal = noise.fbm2D(x * 0.05, z * 0.05, 4, 0.5, 2.0);
        const y = Math.floor(noiseVal * 10) - 5 + 0.5; // Offset to n.5 so top is at integer

        // Determine surface block type
        let surfaceBlock = 'grass';
        if (y < -3.5) {
            surfaceBlock = 'sand'; // Beach/ocean floor level
        } else if (y > 2.5) {
            surfaceBlock = 'stone'; // Mountain tops
        }

        // Generate deep world layer by layer
        // y is offset by 0.5 (e.g. 2.5), so the highest integer currentY reaches is Math.floor(y) = y - 0.5.
        const topY = y - 0.5;
        for (let currentY = worldDepth; currentY <= topY; currentY++) {
            let blockType = 'stone';

            // Bottom layer
            if (currentY === worldDepth) {
                blockType = 'bedrock';
            } else if (currentY === topY) {
                // Surface
                blockType = surfaceBlock;
            } else if (currentY > topY - 3 && surfaceBlock === 'grass') {
                blockType = 'dirt';
            } else if (currentY > topY - 2 && surfaceBlock === 'sand') {
                blockType = 'sand';
            } else {
                // Stone layer - check for caves and ores
                const caveNoise = noise.noise3D(x * 0.1, currentY * 0.1, z * 0.1);
                if (caveNoise > 0.65) {
                    continue; // Cave (air)
                }

                // Ores
                if (Math.random() < 0.04) {
                    const depthPercent = (currentY - worldDepth) / (y - worldDepth);
                    if (depthPercent < 0.2 && Math.random() < 0.1) blockType = 'diamond_ore';
                    else if (depthPercent < 0.4 && Math.random() < 0.2) blockType = 'gold_ore';
                    else if (depthPercent < 0.7 && Math.random() < 0.3) blockType = 'iron_ore';
                    else if (Math.random() < 0.5) blockType = 'coal_ore';
                }
            }

            setVoxelData(x, currentY, z, blockType);
        }

        // Generate Water
        const waterLevel = -3; // Needs to be integer
        // Fill water up to waterLevel if surface is below it
        for(let wy = topY + 1; wy <= waterLevel; wy++) {
            setVoxelData(x, wy, z, 'water');
        }

        // Procedural Trees (spawn only on grass, 2% chance)
        if (surfaceBlock === 'grass' && topY >= waterLevel && Math.random() < 0.02) {
            const treeHeight = Math.floor(Math.random() * 3) + 4; // 4-6 blocks tall
            for (let i = 1; i <= treeHeight; i++) {
                setVoxelData(x, topY + i, z, 'wood');
            }
            // Leaves
            for (let lx = -2; lx <= 2; lx++) {
                for (let lz = -2; lz <= 2; lz++) {
                    for (let ly = 0; ly <= 1; ly++) {
                        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 1) continue; // rounded corners
                        if (lx === 0 && lz === 0 && ly === 0) continue; // trunk space
                        setVoxelData(x + lx, y + treeHeight - 1 + ly, z + lz, 'leaves');
                    }
                }
            }
        }
    }
}

// Render visible blocks
worldData.forEach((type, key) => {
    const [x, y, z] = key.split(',').map(Number);
    if (shouldRenderBlock(x, y, z, type)) {
        renderBlock(x, y, z, type);
    }
});

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
    const x = Math.round(data.position.x);
    const y = data.position.y; // n.5
    const z = Math.round(data.position.z);

    if (data.action === 'remove') {
        worldData.delete(getBlockKey(x, y, z));
        updateBlockVisibility(x, y, z);
        updateAdjacentBlocksVisibility(x, y, z);
    } else if (data.action === 'add') {
        setVoxelData(x, y, z, data.blockType);
        updateBlockVisibility(x, y, z);
        updateAdjacentBlocksVisibility(x, y, z);
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

        if (intersects.length > 0 && intersects[0].distance < 8) {
            const intersect = intersects[0];

            // Left click (0) to remove, Right click (2) to place
            if (event.button === 0) {
                // Remove block
                // Don't allow breaking bedrock
                if (intersect.object !== scene && intersect.object.userData.type !== 'bedrock') {
                    const pos = intersect.object.position;
                    const x = Math.round(pos.x);
                    const y = pos.y;
                    const z = Math.round(pos.z);

                    worldData.delete(getBlockKey(x, y, z));
                    updateBlockVisibility(x, y, z);
                    updateAdjacentBlocksVisibility(x, y, z);
                    socket.emit('updateBlock', { action: 'remove', position: pos });
                }
            } else if (event.button === 2) {
                // Place block
                const placePos = intersect.point.clone().add(intersect.face.normal.clone().multiplyScalar(0.5));
                const x = Math.round(placePos.x);
                const y = Math.floor(placePos.y) + 0.5;
                const z = Math.round(placePos.z);

                const placeVec = new THREE.Vector3(x, y, z);

                // Don't place block inside player
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    controls.getObject().position,
                    new THREE.Vector3(0.8, 1.8, 0.8)
                );
                const blockBox = new THREE.Box3().setFromCenterAndSize(
                    placeVec,
                    new THREE.Vector3(1, 1, 1)
                );

                if (!playerBox.intersectsBox(blockBox)) {
                    setVoxelData(x, y, z, activeBlockType);
                    updateBlockVisibility(x, y, z);
                    updateAdjacentBlocksVisibility(x, y, z);
                    socket.emit('updateBlock', { action: 'add', blockType: activeBlockType, position: placeVec });
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

        // Update Selection Outline
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(objects, false);
        if (intersects.length > 0 && intersects[0].distance < 8) { // Minecraft reach is usually around 4.5-5 blocks
            selectionOutline.visible = true;
            selectionOutline.position.copy(intersects[0].object.position);
        } else {
            selectionOutline.visible = false;
        }

        // --- Fast Grid-Based Collision Detection ---
        const playerSize = new THREE.Vector3(0.8, 1.8, 0.8);
        const playerBox = new THREE.Box3();

        // We only need to check blocks immediately around the player (e.g. within a 2-block radius)
        const px = Math.round(controls.getObject().position.x);
        const py = Math.floor(controls.getObject().position.y);
        const pz = Math.round(controls.getObject().position.z);

        // Helper function to check collision against solid blocks in worldData
        const checkCollisions = () => {
            playerBox.setFromCenterAndSize(controls.getObject().position, playerSize);
            for (let bx = px - 1; bx <= px + 1; bx++) {
                for (let by = py - 2; by <= py + 2; by++) {
                    for (let bz = pz - 1; bz <= pz + 1; bz++) {
                        const type = getVoxelData(bx, by + 0.5, bz); // y is stored as n.5
                        if (type && type !== 'water') { // water is non-solid
                            const blockBox = new THREE.Box3().setFromCenterAndSize(
                                new THREE.Vector3(bx, by + 0.5, bz),
                                new THREE.Vector3(1, 1, 1)
                            );
                            if (playerBox.intersectsBox(blockBox)) {
                                return blockBox;
                            }
                        }
                    }
                }
            }
            return null;
        };

        // Y Collision (Gravity/Jumping)
        const hitY = checkCollisions();
        if (hitY) {
            if (velocity.y < 0) { // falling down
                controls.getObject().position.y = hitY.max.y + (playerSize.y / 2);
                velocity.y = 0;
                canJump = true;
            } else if (velocity.y > 0) { // jumping up into a block
                controls.getObject().position.y = hitY.min.y - (playerSize.y / 2);
                velocity.y = 0;
            }
        }

        // X/Z Collision (Walking into walls)
        const hitXZ = checkCollisions();
        if (hitXZ) {
            playerBox.setFromCenterAndSize(controls.getObject().position, playerSize);
            const overlapX = Math.min(playerBox.max.x - hitXZ.min.x, hitXZ.max.x - playerBox.min.x);
            const overlapZ = Math.min(playerBox.max.z - hitXZ.min.z, hitXZ.max.z - playerBox.min.z);

            if (overlapX < overlapZ) {
                if (playerBox.max.x > hitXZ.min.x && playerBox.min.x < hitXZ.min.x) {
                    controls.getObject().position.x -= overlapX;
                } else {
                    controls.getObject().position.x += overlapX;
                }
                velocity.x = 0;
            } else {
                if (playerBox.max.z > hitXZ.min.z && playerBox.min.z < hitXZ.min.z) {
                    controls.getObject().position.z -= overlapZ;
                } else {
                    controls.getObject().position.z += overlapZ;
                }
                velocity.z = 0;
            }
        }

        // If falling out of the world
        if (controls.getObject().position.y < worldDepth - 5) {
            velocity.y = 0;
            controls.getObject().position.set(0, 10, 0); // respawn
        }

        // Emit player movement
        if(velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) {
             socket.emit('playerMovement', {
                 position: controls.getObject().position,
                 rotation: controls.getObject().rotation // simplistic
             });
        }
    }

    // Move clouds slowly
    clouds.forEach(cloud => {
        cloud.position.x += 0.02;
        if (cloud.position.x > 100) {
            cloud.position.x = -100;
        }
    });

    prevTime = time;

    renderer.render(scene, camera);
}
animate();

// Export for use in other modules if needed, or just let it run
export { scene, camera, renderer };
