import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { generateTexture } from './textures.js';
import * as UI from './ui.js';
import { noise } from './noise.js';

const socket = io(); // Connect to Socket.IO

let currentDimension = 'overworld'; // 'overworld' or 'nether'

// Basic setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec0ee); // More realistic sky blue // Richer sky blue
scene.fog = new THREE.FogExp2(0x7ec0ee, 0.0035); // Decreased fog density for larger world size

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Day / Night Cycle Setup ---
let timeOfDay = 0; // 0 to Math.PI * 2
const dayDuration = 600; // seconds for a full day/night cycle

// --- Sun & Moon ---
const sunGeo = new THREE.BoxGeometry(10, 10, 10);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffcf0 }); // Bright warm white
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);

const moonGeo = new THREE.BoxGeometry(8, 8, 8);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff }); // Pale blue white
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
scene.add(moonMesh);

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

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" }); // Better z-fighting resolution and high perf
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Sharper rendering on high-DPI displays
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // Softer variance shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better lighting colors
renderer.toneMappingExposure = 1.0; // Balanced exposure
document.body.appendChild(renderer.domElement);

// --- Post-Processing Setup ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Screen Space Ambient Occlusion (SSAO) for deep corners and realistic voxel look
const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

// Bloom Pass for glowing lava and bright sun reflections
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.8; // Only very bright things glow
bloomPass.strength = 0.6; // Subtle glow
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

// Add OutputPass to fix colors and tone mapping with composer
const outputPass = new OutputPass();
composer.addPass(outputPass);

// Anti-Aliasing (FXAA) to smooth out jagged edges, especially post-SSAO
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * window.devicePixelRatio);
fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * window.devicePixelRatio);
composer.addPass(fxaaPass);

// --- Selection Outline ---
const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)); // Slightly larger to prevent Z-fighting
const outlineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
const selectionOutline = new THREE.LineSegments(outlineGeo, outlineMat);
selectionOutline.visible = false;
scene.add(selectionOutline);

// Lighting
const ambientLight = new THREE.AmbientLight(0xd9eaff, 0.45); // Cooler, softer ambient
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfffaec, 2.0); // Warmer, brighter sunlight
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096; // higher resolution shadows
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.bias = -0.0005; // reduced shadow acne
directionalLight.shadow.normalBias = 0.05; // reduces Peter-Panning and self-shadowing artifacts
directionalLight.shadow.radius = 2; // softer blur for VSM
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 1000;
directionalLight.shadow.camera.left = -300; // significantly expanded shadow area
directionalLight.shadow.camera.right = 300;
directionalLight.shadow.camera.top = 300;
directionalLight.shadow.camera.bottom = -300;
scene.add(directionalLight);

// Hemisphere light for better outdoor lighting
const hemiLight = new THREE.HemisphereLight(0xe6f2ff, 0x223322, 0.7); // Sky blue to deep green ground bounce
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

// Texture Loader

// Texture Loader with pixel-art settings

// Texture Loader with pixel-art settings
const textureLoader = new THREE.TextureLoader();
function loadTex(name) {
    const tex = textureLoader.load(generateTexture(name));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Materials Map
export const blockMaterials = {
    grass: [
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('grass_side') }), // right
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('grass_side') }), // left
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('grass_top') }), // top
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dirt') }), // bottom
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('grass_side') }), // front
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('grass_side') })  // back
    ],
    snow_dirt: [
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dirt_snow_side') }), // right
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dirt_snow_side') }), // left
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('snow') }),  // top (slightly less rough)
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dirt') }),       // bottom
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dirt_snow_side') }), // front
        new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dirt_snow_side') })  // back
    ],
    snow: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('snow') }),
    dirt: new THREE.MeshStandardMaterial({ roughness: 1.0, map: loadTex('dirt') }),
    stone: new THREE.MeshStandardMaterial({ roughness: 0.7, map: loadTex('stone') }),
    wood: [
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('wood_side') }), // right
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('wood_side') }), // left
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('wood_top') }), // top
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('wood_top') }), // bottom
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('wood_side') }), // front
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('wood_side') })  // back
    ],
    planks: new THREE.MeshStandardMaterial({ roughness: 0.6, map: loadTex('planks') }),
    leaves: new THREE.MeshStandardMaterial({ roughness: 1.0, map: loadTex('leaves'), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
    sand: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('sand') }),
    glass: new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.3, map: loadTex('glass'), transparent: true, opacity: 0.6 }),
    cobblestone: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('cobblestone') }),
    brick: new THREE.MeshStandardMaterial({ roughness: 0.7, map: loadTex('brick') }),
    gravel: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('gravel') }),
    bookshelf: [
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('bookshelf') }), // right
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('bookshelf') }), // left
        new THREE.MeshStandardMaterial({ roughness: 0.6, map: loadTex('planks') }), // top
        new THREE.MeshStandardMaterial({ roughness: 0.6, map: loadTex('planks') }), // bottom
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('bookshelf') }), // front
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('bookshelf') })  // back
    ],
    coal_ore: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('coal_ore') }),
    iron_ore: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.2, map: loadTex('iron_ore') }),
    gold_ore: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.4, map: loadTex('gold_ore') }),
    diamond_ore: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.5, map: loadTex('diamond_ore') }),
    lapis_ore: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3, map: loadTex('lapis_ore') }),
    redstone_ore: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.2, map: loadTex('redstone_ore') }),
    water: new THREE.MeshPhysicalMaterial({
        roughness: 0.05,
        transmission: 0.8, // glass-like transparency
        thickness: 0.5,
        map: loadTex('water'),
        transparent: true,
        side: THREE.DoubleSide
    }),
    lava: new THREE.MeshBasicMaterial({ map: loadTex('lava'), color: 0xffffff }), // Lava emits light visually so use Basic
    bedrock: new THREE.MeshStandardMaterial({ roughness: 1.0, map: loadTex('bedrock') }),
    obsidian: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.4, map: loadTex('obsidian') }),
    end_stone: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('end_stone') }),
    netherrack: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('netherrack') }),
    glowstone: new THREE.MeshBasicMaterial({ map: loadTex('glowstone'), color: 0xfffcc0 }), // Emits light like lava
    nether_brick: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('nether_brick') }),
    soul_sand: new THREE.MeshStandardMaterial({ roughness: 1.0, map: loadTex('soul_sand') }),
    quartz_ore: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('quartz_ore') }),
    redstone_dust: new THREE.MeshBasicMaterial({ map: loadTex('redstone_dust'), color: 0xffaaaa, transparent: true, opacity: 0.9 }), // Glows
    redstone_lamp: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2, map: loadTex('redstone_lamp') }),
    redstone_lamp_on: new THREE.MeshBasicMaterial({ map: loadTex('redstone_lamp'), color: 0xffdd88 }), // Emits light when active
    furnace: [
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('furnace_side') }), // right
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('furnace_side') }), // left
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('furnace_side') }), // top
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('furnace_side') }), // bottom
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('furnace_front') }), // front
        new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('furnace_side') })  // back
    ],
    iron_ingot: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8, map: loadTex('iron_ingot'), transparent: true }),
    gold_ingot: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 1.0, map: loadTex('gold_ingot'), transparent: true }),
    diamond: new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.8, map: loadTex('diamond'), transparent: true }),
    coal: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('coal'), transparent: true })
};

export const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const dustGeometry = new THREE.BoxGeometry(1, 0.1, 1); // flat wire


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

instructions.addEventListener('click', () => {
    if (inventoryEl.style.display !== 'block' && document.getElementById('start-screen').style.display === 'none') {
        controls.lock();
    }
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    inventoryEl.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    if (inventoryEl.style.display !== 'block' && document.getElementById('start-screen').style.display === 'none') {
        instructions.style.display = 'block';
    }
});

scene.add(controls.getObject());

// --- Start Screen Logic ---
const startScreen = document.getElementById('start-screen');
const hudContainer = document.getElementById('hud-container');
const crosshair = document.getElementById('crosshair');

function startGame(isMultiplayer) {
    startScreen.style.display = 'none';
    hudContainer.style.display = 'flex';
    crosshair.style.display = 'block';
    instructions.style.display = 'block';

    // In a real game, singleplayer might spin up a local worker or local state.
    // For this prototype, we'll connect to the same server but perhaps disable chat UI
    if (!isMultiplayer) {
        document.getElementById('chat-container').style.display = 'none';
    }
}

document.getElementById('btn-singleplayer').addEventListener('click', () => startGame(false));
document.getElementById('btn-multiplayer').addEventListener('click', () => startGame(true));


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
            case 'KeyF':
                // Check if looking at furnace
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(objects, false);
                if (intersects.length > 0 && intersects[0].distance < 8) {
                    if (intersects[0].object.userData.type === 'furnace') {
                        UI.toggleFurnace(controls);
                    }
                }
                break;
            case 'Space':
                // Check if in liquid for swimming
                const pPosJump = controls.getObject().position;
                const typeJump = getVoxelData(Math.floor(pPosJump.x), Math.floor(pPosJump.y - 0.5), Math.floor(pPosJump.z));
                if (typeJump === 'water' || typeJump === 'lava') {
                    velocity.y = 5; // Swim up
                } else if (canJump === true) {
                    velocity.y += 10;
                    canJump = false;
                }
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

    if (event.code === 'KeyE' && !isChatting) {
        if (controls.isLocked) {
            controls.unlock();
            inventoryEl.style.display = 'block';
        } else {
            inventoryEl.style.display = 'none';
            document.getElementById('furnace-ui').style.display = 'none';
            controls.lock();
        }
    }

    if (event.code === 'Escape') {
        inventoryEl.style.display = 'none';
        document.getElementById('furnace-ui').style.display = 'none';
    }

    if (event.code === 'KeyT' && controls.isLocked && !isChatting) {
        controls.unlock();
        isChatting = true;
        chatInput.style.display = 'block';
        chatInput.focus();
        event.preventDefault(); // Prevent 't' from typing in input immediately
    } else if (event.code === 'Enter' && isChatting) {
        const msg = chatInput.value.trim();
        if (msg) {
            if (msg.startsWith('/')) {
                socket.emit('chatCommand', msg);
            } else {
                socket.emit('chatMessage', msg);
            }
        }
        chatInput.value = '';
        chatInput.style.display = 'none';
        isChatting = false;
        controls.lock();
    } else if (event.code === 'Escape' && isChatting) {
        chatInput.value = '';
        chatInput.style.display = 'none';
        isChatting = false;
        controls.lock();
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
const objects = []; // Active meshes for raycasting
export const worldData = new Map(); // x,y,z -> type
const renderedBlocks = new Map(); // x,y,z -> THREE.Mesh

const worldSize = 96; // Increased from 64x64 to 96x96 blocks
const worldDepth = -30; // generate down to this y-level

const transparentBlocks = ['glass', 'leaves', 'water', 'lava'];

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
    const currentGeo = type === 'redstone_dust' ? dustGeometry : blockGeometry;
    const voxel = new THREE.Mesh(currentGeo, material);
    voxel.position.set(x, type === 'redstone_dust' ? y - 0.45 : y, z);
    voxel.receiveShadow = true;
    voxel.castShadow = type !== 'redstone_dust';
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

function generateTerrain(dimension) {
    // Generate the initial world map based on dimension
    for (let x = -worldSize / 2; x < worldSize / 2; x++) {
        for (let z = -worldSize / 2; z < worldSize / 2; z++) {
            if (dimension === 'the_end') {
                // End terrain: Large central floating island
                const distSq = x * x + z * z;
                const islandRadiusSq = 30 * 30; // 30 block radius island
                if (distSq < islandRadiusSq) {
                    // Taper the bottom of the island
                    const depthAtPoint = 10 - Math.sqrt(distSq) / 3;
                    const surfaceY = 25 + Math.floor(noise.fbm2D(x * 0.05, z * 0.05, 2, 0.5, 2.0) * 3);
                    for (let y = surfaceY - Math.floor(depthAtPoint); y <= surfaceY; y++) {
                        setVoxelData(x, y, z, 'end_stone');
                    }

                    // Add Obsidian Pillars
                    if (Math.random() < 0.005 && distSq > 10 * 10 && distSq < 25 * 25) {
                        const pillarHeight = 15 + Math.floor(Math.random() * 15);
                        for (let px = -2; px <= 2; px++) {
                            for (let pz = -2; pz <= 2; pz++) {
                                if (px*px + pz*pz <= 4) { // circular pillar
                                    for (let py = surfaceY + 1; py <= surfaceY + pillarHeight; py++) {
                                        setVoxelData(x + px, py, z + pz, 'obsidian');
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (dimension === 'nether') {
                // Nether terrain: ceiling and floor with massive caves
                for (let y = worldDepth; y <= 35; y++) {
                    // Bedrock at very bottom and very top
                    if (y === worldDepth || y === 35) {
                        setVoxelData(x, y, z, 'bedrock');
                        continue;
                    }

                    // 3D noise for cavernous generation
                    const caveNoise = noise.noise3D(x * 0.05, y * 0.05, z * 0.05);
                    if (caveNoise > 0.4) {
                        // Empty space (huge caves)
                        continue;
                    }

                    let blockType = 'netherrack';

                    // Add lava pools at the bottom
                    if (y <= worldDepth + 4 && caveNoise > 0.4) {
                        blockType = 'lava';
                    }

                    // Small clusters of other blocks
                    if (Math.random() < 0.05) blockType = 'quartz_ore';
                    else if (Math.random() < 0.02) blockType = 'glowstone';
                    else if (y < worldDepth + 10 && Math.random() < 0.03) blockType = 'soul_sand';
                    else if (Math.random() < 0.01) blockType = 'obsidian';

                    setVoxelData(x, y, z, blockType);
                }
            } else {
                // Overworld terrain
                // Heightmap via 2D noise with dramatic mountainous terrain
                const baseNoise = noise.fbm2D(x * 0.015, z * 0.015, 5, 0.5, 2.0); // Continental noise
                const detailNoise = noise.fbm2D(x * 0.05, z * 0.05, 4, 0.5, 2.0); // Detail bumps

                // Exponentiate the base noise to create flat valleys and steep mountains
                const elevation = Math.pow(Math.abs(baseNoise) * 2.5, 2.5) * Math.sign(baseNoise);

                // Combine low-frequency dramatic elevation with high-frequency detail
                let rawHeight = (elevation * 30) + (detailNoise * 8) - 10;

                // Oceans and Rivers noise layer
                // Macro noise for oceans: if it drops low enough, dig out a huge basin
                const oceanNoise = noise.fbm2D(x * 0.005 + 500, z * 0.005 + 500, 3, 0.5, 2.0);
                if (oceanNoise < -0.2) {
                    rawHeight -= Math.abs(oceanNoise + 0.2) * 50; // Deepen significantly
                }

                // River noise: ridged multifractal style (absolute value of noise)
                const riverNoise = Math.abs(noise.fbm2D(x * 0.008 + 1000, z * 0.008 + 1000, 4, 0.5, 2.0));
                // If riverNoise is very close to 0, dig a trench
                if (riverNoise < 0.08) {
                    const depthFactor = 1.0 - (riverNoise / 0.08); // 1 at center, 0 at edge
                    rawHeight -= depthFactor * 15; // Cut down by up to 15 blocks
                }

                // Flatten out deep ocean floors
                if (rawHeight < -12) {
                    rawHeight = -12 + (rawHeight + 12) * 0.1;
                }

                // Make sure it doesn't go below bedrock
                rawHeight = Math.max(rawHeight, worldDepth + 1);

                const y = Math.floor(rawHeight) + 0.5; // Offset to n.5 so top is at integer

                // Biome mapping via temperature/moisture 2D noise
                // fbm2D returns 0 to 1, so we map it to -1 to 1 for our logic
                const tempNoise = (noise.fbm2D(x * 0.02, z * 0.02, 3, 0.5, 2.0) * 2.0) - 1.0;
                const moistureNoise = (noise.fbm2D(x * 0.02 + 100, z * 0.02 + 100, 3, 0.5, 2.0) * 2.0) - 1.0;

                let biome = 'forest';
                if (tempNoise > 0.3 && moistureNoise < 0.2) {
                    biome = 'desert';
                } else if (tempNoise < -0.3) {
                    biome = 'snow';
                }

                // Determine surface block type based on height and biome
                let surfaceBlock = 'grass';
                if (y < -2.5) {
                    // Beach/ocean floor level - mix dirt, sand, and gravel for rivers/oceans
                    if (riverNoise < 0.08) {
                        surfaceBlock = Math.random() > 0.5 ? 'dirt' : 'gravel';
                    } else if (oceanNoise < -0.2 && y < -5.5) {
                        surfaceBlock = Math.random() > 0.7 ? 'gravel' : 'sand';
                    } else {
                        surfaceBlock = 'sand';
                    }
                } else if (y > 35.5) {
                    surfaceBlock = 'snow'; // Very high mountain peaks
                } else if (y > 22.5) {
                    surfaceBlock = 'snow_dirt'; // Lower mountain peaks / snow transition
                } else if (y > 15.5) {
                    surfaceBlock = 'stone'; // Rocky mountain sides
                } else {
                    // Apply biome mapping
                    if (biome === 'desert') surfaceBlock = 'sand';
                    if (biome === 'snow') surfaceBlock = 'snow';
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
                    } else if (currentY > topY - 3 && surfaceBlock === 'sand') {
                        blockType = 'sand';
                    } else if (currentY > topY - 3 && surfaceBlock === 'snow') {
                        blockType = 'dirt';
                    } else {
                        // Stone layer - check for caves and ores
                        const caveNoise = noise.noise3D(x * 0.1, currentY * 0.1, z * 0.1);
                        if (caveNoise > 0.65) {
                            // Lava pools at bottom of caves if very deep
                            if (currentY < worldDepth + 5 && currentY > worldDepth) {
                                setVoxelData(x, currentY, z, 'lava');
                            }
                            continue; // Cave (air)
                        }

                        // Ores and other underground blocks
                        if (Math.random() < 0.06) { // slightly increased frequency for new blocks
                            const depthPercent = (currentY - worldDepth) / (y - worldDepth);
                            if (depthPercent < 0.2 && Math.random() < 0.1) blockType = 'diamond_ore';
                            else if (depthPercent < 0.25 && Math.random() < 0.15) blockType = 'redstone_ore';
                            else if (depthPercent < 0.3 && Math.random() < 0.1) blockType = 'lapis_ore';
                            else if (depthPercent < 0.4 && Math.random() < 0.2) blockType = 'gold_ore';
                            else if (depthPercent < 0.7 && Math.random() < 0.3) blockType = 'iron_ore';
                            else if (Math.random() < 0.4) blockType = 'coal_ore';
                            else if (Math.random() < 0.3) blockType = 'gravel';
                            else if (Math.random() < 0.1) blockType = 'dirt'; // occasional dirt pocket underground
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

                // Procedural Trees (spawn only on grass or snow, frequency depends on biome)
                const isTreeSurface = surfaceBlock === 'grass' || (surfaceBlock === 'snow' && biome === 'forest');
                const treeChance = biome === 'forest' ? 0.05 : (biome === 'snow' ? 0.01 : 0.00); // No trees in desert
                if (isTreeSurface && topY >= waterLevel && Math.random() < treeChance) {
                    const treeHeight = Math.floor(Math.random() * 3) + 4; // 4-6 blocks tall

                    // Trunk
                    for(let i = 1; i <= treeHeight; i++) {
                        setVoxelData(x, topY + i, z, 'wood');
                    }

                    // Leaves (simple 3x3 box at the top, slightly randomized)
                    const leavesTop = topY + treeHeight;
                    for (let lx = -1; lx <= 1; lx++) {
                        for (let ly = -1; ly <= 1; ly++) {
                            for (let lz = -1; lz <= 1; lz++) {
                                // Skip corners for a more natural shape
                                if (Math.abs(lx) === 1 && Math.abs(ly) === 1 && Math.abs(lz) === 1) continue;
                                // Skip trunk location unless it's the very top leaf
                                if (lx === 0 && lz === 0 && ly < 1) continue;

                                setVoxelData(x + lx, leavesTop + ly, z + lz, 'leaves');
                            }
                        }
                    }
                }
            }
        }
    }
}

// Generate the initial world map
generateTerrain('overworld');

// Render visible blocks
worldData.forEach((type, key) => {
    const [x, y, z] = key.split(',').map(Number);
    if (shouldRenderBlock(x, y, z, type)) {
        renderBlock(x, y, z, type);
    }
});

// Adjust camera spawn height based on terrain center
const spawnBase = noise.fbm2D(0, 0, 5, 0.5, 2.0);
const spawnDetail = noise.fbm2D(0, 0, 4, 0.5, 2.0);
const spawnElev = Math.pow(Math.abs(spawnBase) * 2.5, 2.5) * Math.sign(spawnBase);
const spawnRawHeight = (spawnElev * 30) + (spawnDetail * 8) - 10;
const spawnY = Math.floor(Math.max(spawnRawHeight, -3)) + 5.5; // Safe spawn height (above water)
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

// Chat Events
socket.on('chatMessage', (msg) => {
    appendChatMessage(msg);
});

socket.on('chatCommandResponse', (msg) => {
    appendChatMessage("[Server] " + msg);
});

socket.on('gamemodeUpdated', (mode) => {
    setGamemode(mode);
    appendChatMessage(`[Server] Your gamemode has been updated to ${['Survival', 'Creative', 'Spectator'][mode]}.`);
});

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
    creeper: new THREE.BoxGeometry(0.8, 1.6, 0.8),
    ender_dragon: new THREE.BoxGeometry(8, 4, 16) // Huge box placeholder for dragon
};
const mobMaterials = {
    pig: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0xFFC0CB }),
    zombie: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0x006400 }),
    cow: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0x8B4513 }),
    creeper: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0x00FF00 }),
    ender_dragon: new THREE.MeshStandardMaterial({roughness: 0.2, color: 0x110022, emissive: 0x5500aa, emissiveIntensity: 0.2 })
};

socket.on('mobDamage', (data) => {
    if (currentGamemode === 0 && UI.health > 0) {
        UI.updatePlayerStatus(UI.health - data.amount);
        if (UI.health <= 0) {
            socket.emit('chatMessage', `was slain by ${data.type}`);
            controls.getObject().position.set(0, spawnY, 0); // respawn
            UI.updatePlayerStatus(20, 20); // reset health
        }
    }
});

socket.on('serverTick', (data) => {
    timeOfDay = data.timeOfDay;
    const serverMobs = data.mobs;

    const mobRaycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0);

    const syncYs = {}; // Store calculated Ys to send back to server

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

        // Snap to ground starting slightly above the mob's actual Y to allow them inside caves
        mobRaycaster.set(new THREE.Vector3(mesh.position.x, mesh.position.y + 1.0, mesh.position.z), downVector);
        const intersects = mobRaycaster.intersectObjects(objects, false);
        if (intersects.length > 0) {
            // Place mob exactly on top of block.
            const heightHalf = mesh.geometry.parameters.height / 2;
            // Prevent teleporting down massive distances instantly, but let them fall smoothly if far
            const targetY = intersects[0].point.y + heightHalf;
            if (mesh.position.y - targetY > 2.0) {
                mesh.position.y -= 0.4; // Fall quickly
            } else {
                mesh.position.y = targetY; // Snap
            }
        } else {
            // If they are falling (no ground immediately below), let them drop a bit
            mesh.position.y -= 0.4;
        }

        syncYs[id] = mesh.position.y;
    });

    // Send calculated Y positions back to server so the server knows their 3D distance
    socket.emit('syncMobY', syncYs);

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

socket.on('changeDimension', (data) => {
    console.log(`Switching to dimension: ${data.dimension}`);
    currentDimension = data.dimension;

    // Clear current world visually and functionally
    worldData.clear();
    const blocksToRemove = Array.from(renderedBlocks.keys());
    blocksToRemove.forEach(key => {
        const [bx, by, bz] = key.split(',').map(Number);
        removeRenderedBlock(bx, by, bz);
    });
    renderedBlocks.clear();

    // Reposition player
    camera.position.set(data.position.x, data.position.y, data.position.z);
    velocity.set(0, 0, 0);

    // Change lighting/environment based on dimension
    if (currentDimension === 'nether') {
        scene.background = new THREE.Color(0x3a0000); // Dark red
        scene.fog.color.setHex(0x3a0000);
        scene.fog.density = 0.015; // Thicker fog in nether, scaled for new render distance
        directionalLight.intensity = 0.1;
        hemiLight.color.setHex(0xff3333);
        hemiLight.groundColor.setHex(0x110000);
        hemiLight.intensity = 0.5;
    } else if (currentDimension === 'the_end') {
        scene.background = new THREE.Color(0x110022); // Dark purple/black void
        scene.fog.color.setHex(0x110022);
        scene.fog.density = 0.01;
        directionalLight.intensity = 0.05; // Very dim
        hemiLight.color.setHex(0xaa88cc); // Pale purple ambient
        hemiLight.groundColor.setHex(0x221133);
        hemiLight.intensity = 0.3;
    } else {
        scene.background = new THREE.Color(0x7ec0ee); // Sky blue
        scene.fog.color.setHex(0x7ec0ee);
        scene.fog.density = 0.0035;
        directionalLight.intensity = 0.8;
        hemiLight.color.setHex(0xffffff);
        hemiLight.groundColor.setHex(0x444444);
        hemiLight.intensity = 0.6;
    }

    // Generate base terrain for the new dimension locally
    generateTerrain(currentDimension);

    // Render the new base terrain
    worldData.forEach((type, key) => {
        const [x, y, z] = key.split(',').map(Number);
        if (shouldRenderBlock(x, y, z, type)) {
            renderBlock(x, y, z, type);
        }
    });

    // Request new chunks/data (handled by server broadcasting updates if needed,
    // or we can explicitly ask the server for worldState for this dimension)
    socket.emit('requestWorldState', currentDimension);
});

socket.on('dimensionWorldState', (updates) => {
    updates.forEach(update => applyBlockUpdate(update));
});

function applyBlockUpdate(data) {
    // Only apply updates for our current dimension
    if (data.dimension && data.dimension !== currentDimension) return;

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
export var activeBlockType = 'dirt'; // Default placeable block

// Simple function to change active block (used later by UI)
export function setActiveBlock(type) {
    activeBlockType = type;
}

// Game Mode System (0: Survival, 1: Creative, 2: Spectator)
export let currentGamemode = 0; // Default Survival

export function setGamemode(mode) {
    currentGamemode = mode;
    console.log("Gamemode set to " + mode);
}

// Chat system
export const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
let isChatting = false;

export function appendChatMessage(msgStr) {
    const el = document.createElement('div');
    el.className = 'chat-message';
    el.innerText = msgStr;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // keep only last 20 messages visually
    while (chatMessages.children.length > 20) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(); // Always center (0,0) for pointer lock

// Physical item drops
const itemDrops = [];

function spawnItemDrop(type, position) {
    const isTool = UI.availableTools.includes(type);
    let material;

    if (isTool) {
        // Sprite for tools
        const map = new THREE.TextureLoader().load(UI.isoTextureCache[type] || UI.textureCache[type] || '');
        map.magFilter = THREE.NearestFilter;
        material = new THREE.SpriteMaterial({ map: map });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.5, 0.5, 0.5);
        sprite.position.copy(position);
        sprite.position.y += 0.25; // Pop up a bit
        scene.add(sprite);

        itemDrops.push({
            mesh: sprite,
            type: type,
            velocity: new THREE.Vector3((Math.random()-0.5)*2, 2, (Math.random()-0.5)*2),
            timeAlive: 0
        });
    } else {
        // 3D Mini block
        const materials = blockMaterials[type] || blockMaterials['dirt'];
        const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.position.copy(position);
        scene.add(mesh);

        itemDrops.push({
            mesh: mesh,
            type: type,
            velocity: new THREE.Vector3((Math.random()-0.5)*2, 2, (Math.random()-0.5)*2),
            timeAlive: 0
        });
    }
}

function updateItemDrops(delta) {
    const playerPos = controls.getObject().position;
    for (let i = itemDrops.length - 1; i >= 0; i--) {
        const drop = itemDrops[i];
        drop.timeAlive += delta;

        // Physics
        drop.velocity.y -= 9.8 * delta; // Gravity
        drop.mesh.position.addScaledVector(drop.velocity, delta);

        // Floor collision (simple, just stops at y=current block level)
        const bx = Math.round(drop.mesh.position.x);
        const by = Math.floor(drop.mesh.position.y);
        const bz = Math.round(drop.mesh.position.z);
        if (getVoxelData(bx, by, bz)) {
            drop.mesh.position.y = by + 0.5 + (drop.mesh.geometry ? 0.125 : 0.25);
            drop.velocity.x *= 0.5;
            drop.velocity.z *= 0.5;
            drop.velocity.y = 0;
        }

        // Rotation
        if (drop.mesh.geometry) { // only rotate 3D blocks
            drop.mesh.rotation.y += delta;
        }

        // Pickup collision
        if (drop.timeAlive > 0.5 && drop.mesh.position.distanceTo(playerPos) < 1.5) {
            // Add to inventory (we'll just call a UI function)
            const added = UI.addItemToInventory(drop.type);
            if (added) {
                scene.remove(drop.mesh);
                itemDrops.splice(i, 1);
            }
        } else if (drop.timeAlive > 60) {
            // Despawn after 60s
            scene.remove(drop.mesh);
            itemDrops.splice(i, 1);
        }
    }
}

function canHarvest(blockType, activeTool) {
    if (currentGamemode === 1) return true; // Creative mode always harvests

    const needsPickaxe = ['stone', 'cobblestone', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore', 'redstone_ore', 'obsidian', 'netherrack', 'nether_brick', 'quartz_ore', 'brick'];
    if (needsPickaxe.includes(blockType)) {
        return activeTool && activeTool.includes('pickaxe');
    }
    // Simple for now: wood doesn't *require* an axe to drop, but breaks faster if we had breaking times.
    // For this implementation, we just require the correct tool to get the item drop for hard materials.
    return true;
}

document.addEventListener('mousedown', (event) => {
    if (controls.isLocked === true) {
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(objects, false);

        if (intersects.length > 0 && intersects[0].distance < 8) {
            const intersect = intersects[0];

            // Left click (0) to remove, Right click (2) to place
            if (event.button === 0) {
                // Remove block
                if (currentGamemode === 2) return; // Spectator cannot break blocks

                // Don't allow breaking bedrock
                if (intersect.object !== scene && intersect.object.userData.type !== 'bedrock') {
                    const pos = intersect.object.position;
                    const blockType = intersect.object.userData.type;
                    const x = Math.round(pos.x);
                    const y = pos.y;
                    const z = Math.round(pos.z);

                    if (canHarvest(blockType, activeBlockType)) {
                        // Spawn physical drop if in survival
                        if (currentGamemode === 0) {
                            spawnItemDrop(blockType, pos.clone());
                        }
                    }

                    worldData.delete(getBlockKey(x, y, z));
                    updateBlockVisibility(x, y, z);
                    updateAdjacentBlocksVisibility(x, y, z);
                    socket.emit('updateBlock', { action: 'remove', position: pos, dimension: currentDimension });
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

                // Only place block if player holds a block (not a tool/empty)
                if (activeBlockType && !activeBlockType.includes('pickaxe') && !activeBlockType.includes('axe') && activeBlockType !== 'stick') {
                    if (!playerBox.intersectsBox(blockBox)) {
                        setVoxelData(x, y, z, activeBlockType);
                        updateBlockVisibility(x, y, z);
                        updateAdjacentBlocksVisibility(x, y, z);
                        socket.emit('updateBlock', { action: 'add', blockType: activeBlockType, position: placeVec, dimension: currentDimension });

                        // Consume from inventory in survival mode
                        if (currentGamemode === 0) {
                             UI.removeItemFromHotbar();
                        }
                    }
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
    composer.setSize(window.innerWidth, window.innerHeight);
    ssaoPass.setSize(window.innerWidth, window.innerHeight);
    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
});

// Render loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Animate water and lava textures
    if (blockMaterials['water'].map) {
        blockMaterials['water'].map.offset.y += delta * 0.1;
        blockMaterials['water'].map.offset.x += delta * 0.05;
    }
    if (blockMaterials['lava'].map) {
        blockMaterials['lava'].map.offset.y += delta * 0.02;
    }

    if (controls.isLocked === true) {
        // Check if player is in liquid
        const pPos = controls.getObject().position;
        const currentBlockType = getVoxelData(Math.floor(pPos.x), Math.floor(pPos.y - 0.5), Math.floor(pPos.z));
        const inLiquid = currentBlockType === 'water' || currentBlockType === 'lava';

        // Apply friction
        const friction = inLiquid ? 5.0 : 10.0; // High friction/drag in liquid
        velocity.x -= velocity.x * friction * delta;
        velocity.z -= velocity.z * friction * delta;

        // Apply gravity and buoyancy
        const gravity = inLiquid ? 1.5 : 9.8 * 3.0; // Slower falling in liquid
        velocity.y -= gravity * delta;

        // Terminal velocity in liquid
        if (inLiquid && velocity.y < -1.5) velocity.y = -1.5;


        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Ensure consistent movement in all directions

        let speed = inLiquid ? 80.0 : 400.0; // Much slower in liquid
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
                        if (type && type !== 'water' && type !== 'lava') { // water and lava are non-solid
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
        const prevVelocityY = velocity.y;
        const hitY = checkCollisions();
        if (hitY) {
            if (velocity.y < 0) { // falling down
                controls.getObject().position.y = hitY.max.y + (playerSize.y / 2);
                velocity.y = 0;
                canJump = true;

                // Fall damage logic
                if (currentGamemode === 0 && prevVelocityY < -15.0 && !inLiquid) {
                    const fallDistance = Math.abs(prevVelocityY);
                    // arbitrary scaling for fall damage based on velocity
                    const damage = Math.floor((fallDistance - 15.0) / 2);
                    if (damage > 0) {
                        UI.updatePlayerStatus(UI.health - damage);
                        if (UI.health <= 0) {
                            // Player Death
                            socket.emit('chatMessage', `fell from a high place`);
                            controls.getObject().position.set(0, spawnY, 0); // respawn
                            UI.updatePlayerStatus(20, 20); // reset health
                        }
                    }
                }
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
                 rotation: controls.getObject().rotation, // simplistic
                 dimension: currentDimension
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

    // --- Day/Night Cycle ---
    // Smoothly interpolate time client-side between server ticks
    timeOfDay += (delta / dayDuration) * Math.PI * 2;
    if (timeOfDay > Math.PI * 2) timeOfDay -= Math.PI * 2;

    const sunDist = 300;
    // Calculate sun and moon positions
    const sunY = Math.sin(timeOfDay) * sunDist;
    const sunX = Math.cos(timeOfDay) * sunDist;
    sunMesh.position.set(sunX, sunY, 100);

    moonMesh.position.set(-sunX, -sunY, 100);

    // Calculate light intensities based on sun height
    if (currentDimension !== 'nether') {
        const normalizedSunHeight = Math.sin(timeOfDay); // 1 = noon, 0 = sunrise/sunset, -1 = midnight

        if (normalizedSunHeight > 0) {
            // Day
            directionalLight.position.copy(sunMesh.position);
            directionalLight.intensity = Math.max(0.1, normalizedSunHeight * 2.0);
            directionalLight.color.setHex(0xfffaec);
            ambientLight.intensity = Math.max(0.1, normalizedSunHeight * 0.45);
            hemiLight.intensity = Math.max(0.1, normalizedSunHeight * 0.7);

            // Sky colors (Blue -> Orange at horizon -> Blue)
            const skyR = Math.min(1.0, 0.49 + (1.0 - normalizedSunHeight) * 0.5); // Reddish at horizon
            const skyG = Math.max(0.4, 0.75 - (1.0 - normalizedSunHeight) * 0.3);
            const skyB = 0.93;
            scene.background.setRGB(skyR, skyG, skyB);
            scene.fog.color.setRGB(skyR, skyG, skyB);
        } else {
            // Night
            directionalLight.position.copy(moonMesh.position);
            directionalLight.intensity = Math.max(0.05, -normalizedSunHeight * 0.3); // Dim moonlight
            directionalLight.color.setHex(0xaaaaee);
            ambientLight.intensity = Math.max(0.05, -normalizedSunHeight * 0.1);
            hemiLight.intensity = 0.05;

            // Night Sky (Dark Blue/Black)
            const depth = -normalizedSunHeight; // 0 to 1
            scene.background.setRGB(0.02 * depth, 0.02 * depth, 0.05 * depth);
            scene.fog.color.setRGB(0.02 * depth, 0.02 * depth, 0.05 * depth);
        }
    }

    updateItemDrops(delta);

    prevTime = time;

    composer.render();
}
animate();

// Export for use in other modules if needed, or just let it run
export { scene, camera, renderer };
