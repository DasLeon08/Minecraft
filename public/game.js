import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { generateTexture, generateBumpTexture } from './textures.js';
import * as UI from './ui.js';
import { noise } from './noise.js';

const socket = io(); // Connect to Socket.IO

let currentDimension = 'overworld'; // 'overworld' or 'nether'

// Basic setup
const scene = new THREE.Scene();
scene.background = null; // Controlled by Sky addon
scene.fog = new THREE.FogExp2(0x7ec0ee, 0.0035); // Decreased fog density for larger world size

let currentFov = 75;
const camera = new THREE.PerspectiveCamera(currentFov, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Day / Night Cycle Setup ---
let timeOfDay = 0; // 0 to Math.PI * 2
const dayDuration = 600; // seconds for a full day/night cycle

// --- Sky & Environment ---
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

// --- Voxel Clouds ---
const cloudGroup = new THREE.Group();
const cloudGeo = new THREE.BoxGeometry(10, 5, 10);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
// Generate a field of clouds
for (let i = 0; i < 50; i++) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(
        (Math.random() - 0.5) * 400,
        120 + Math.random() * 10,
        (Math.random() - 0.5) * 400
    );
    // Make some clouds bigger
    cloud.scale.set(1 + Math.random() * 3, 1, 1 + Math.random() * 3);
    cloud.castShadow = true;
    cloud.receiveShadow = true;
    cloudGroup.add(cloud);
}
scene.add(cloudGroup);


const sunPosition = new THREE.Vector3();

// We will use the sky uniforms to simulate daylight
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 8; // Clearer sky
skyUniforms['rayleigh'].value = 1.2; // Softer atmosphere scattering
skyUniforms['mieCoefficient'].value = 0.002; // Less haze
skyUniforms['mieDirectionalG'].value = 0.8;

// --- Sun & Moon ---
const sunGeo = new THREE.BoxGeometry(10, 10, 10);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee, fog: false }); // Brighter sun for bloom // Bright warm white, no fog so it pops
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);

const moonGeo = new THREE.BoxGeometry(8, 8, 8);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff, fog: false }); // Pale blue white
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
scene.add(moonMesh);

// --- Clouds ---
// const clouds
// old cloudGeo
// old cloudMat
for(let i=0; i<10; i++) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(Math.random() * 200 - 100, 40 + Math.random() * 10, Math.random() * 200 - 100);
    scene.add(cloud);
    // clouds.push removed
}

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" }); // Better z-fighting resolution and high perf
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Sharper rendering on high-DPI displays
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // Softer variance shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better lighting colors
renderer.toneMappingExposure = 1.15; // Slightly punchier exposure // Balanced exposure
document.body.appendChild(renderer.domElement);

// --- Weather System ---
let weatherState = 'clear'; // 'clear', 'rain', 'snow'
let weatherTime = 0;
const weatherParticlesGeometry = new THREE.BufferGeometry();
const particleCount = 5000;
const posArray = new Float32Array(particleCount * 3);
const velArray = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
    posArray[i * 3] = (Math.random() - 0.5) * 40;     // x
    posArray[i * 3 + 1] = Math.random() * 40;         // y
    posArray[i * 3 + 2] = (Math.random() - 0.5) * 40; // z

    velArray[i * 3] = (Math.random() - 0.5) * 2;      // vx
    velArray[i * 3 + 1] = -5 - Math.random() * 10;    // vy (falling down)
    velArray[i * 3 + 2] = (Math.random() - 0.5) * 2;  // vz
}

weatherParticlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
weatherParticlesGeometry.setAttribute('velocity', new THREE.BufferAttribute(velArray, 3));

const rainMaterial = new THREE.PointsMaterial({
    size: 0.1,
    color: 0xaaaaee,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
});

const snowMaterial = new THREE.PointsMaterial({
    size: 0.2,
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.NormalBlending
});

const weatherParticles = new THREE.Points(weatherParticlesGeometry, rainMaterial);
weatherParticles.visible = false;
scene.add(weatherParticles);

function updateWeather(delta) {
    weatherTime += delta;

    // Change weather randomly every ~60 seconds
    if (weatherTime > 60) {
        weatherTime = 0;
        const r = Math.random();
        if (r < 0.6) weatherState = 'clear';
        else weatherState = 'active'; // biome determines if rain or snow
    }

    if (weatherState === 'clear') {
        weatherParticles.visible = false;
        return;
    }

    // Determine biome to set rain vs snow
    const px = Math.floor(controls.getObject().position.x);
    const pz = Math.floor(controls.getObject().position.z);

    // Rough biome check based on noise
    const t = noise.perlin2D(px * 0.005, pz * 0.005);
    const isSnow = t < -0.15; // snow biome threshold from generation
    const isDesert = t > 0.4;

    if (isDesert) {
        // No rain in desert
        weatherParticles.visible = false;
        return;
    }

    weatherParticles.visible = true;
    weatherParticles.material = isSnow ? snowMaterial : rainMaterial;

    // Update particle positions
    const positions = weatherParticles.geometry.attributes.position.array;
    const velocities = weatherParticles.geometry.attributes.velocity.array;

    // Follow player
    weatherParticles.position.x = controls.getObject().position.x;
    weatherParticles.position.z = controls.getObject().position.z;
    // Keep relative Y height for continuous falling effect

    for (let i = 0; i < particleCount; i++) {
        // Slow down snow
        const speedMult = isSnow ? 0.3 : 1.0;

        positions[i * 3] += velocities[i * 3] * delta * speedMult;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * speedMult;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * speedMult;

        // Reset if too low
        if (positions[i * 3 + 1] < -20) {
            positions[i * 3 + 1] = 20 + Math.random() * 20;
            positions[i * 3] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
    }
    weatherParticles.geometry.attributes.position.needsUpdate = true;
}

// --- Environment Reflections ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
let envMapGenerated = false;


// --- Post-Processing Setup ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Screen Space Ambient Occlusion (SSAO) for deep corners and realistic voxel look
const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 24; // Deeper ambient occlusion corners
ssaoPass.minDistance = 0.003;
ssaoPass.maxDistance = 0.15;
composer.addPass(ssaoPass);

// Bloom Pass for glowing lava and bright sun reflections
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.7; // More things slightly glow (like sand in sun)
bloomPass.strength = 0.8; // Stronger dreamy glow
bloomPass.radius = 0.8; // Wider soft bloom radius
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
const ambientLight = new THREE.AmbientLight(0xdee5ff, 0.6); // Slightly brighter, crisper ambient // Cooler, softer ambient
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfffaec, 2.5); // Brighter directional light // Warmer, brighter sunlight
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096; // higher resolution shadows
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.bias = -0.0005; // reduced shadow acne
directionalLight.shadow.normalBias = 0.05; // reduces Peter-Panning and self-shadowing artifacts
directionalLight.shadow.radius = 3; // Softer, more pleasant shadow edges // softer blur for VSM
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

const texCache = {};
const bumpCache = {};

function loadTex(name) {
    if (texCache[name]) return texCache[name];
    const tex = textureLoader.load(generateTexture(name));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache[name] = tex;
    return tex;
}

function loadBump(name) {
    if (bumpCache[name]) return bumpCache[name];
    const tex = new THREE.Texture();
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    generateBumpTexture(name).then(url => {
        const img = new Image();
        img.onload = () => {
            tex.image = img;
            tex.needsUpdate = true;
        };
        img.src = url;
    });
    bumpCache[name] = tex;
    return tex;
}

function createMat(name, options = {}) {
    const defaultOptions = {
        roughness: 0.8,
        metalness: 0.05, // slightly shiny
        map: loadTex(name),
        bumpMap: loadBump(name),
        bumpScale: 0.05, // deep pixel bump map
    };
    return new THREE.MeshStandardMaterial({ ...defaultOptions, ...options });
}

function createPhysicalMat(name, options = {}) {
    const defaultOptions = {
        roughness: 0.8,
        metalness: 0.05,
        map: loadTex(name),
        bumpMap: loadBump(name),
        bumpScale: 0.05,
    };
    return new THREE.MeshPhysicalMaterial({ ...defaultOptions, ...options });
}


// Materials Map
export const blockMaterials = {
    red_sand: createMat('red_sand'),
    terracotta: createMat('terracotta'),
    orange_terracotta: createMat('orange_terracotta'),
    yellow_terracotta: createMat('yellow_terracotta'),
    sandstone: createMat('sandstone'),
    moss_block: createMat('moss_block'),
    mud: createMat('mud'),
    bookshelf: createMat('bookshelf'),
    cactus_side: createMat('cactus_side'),
    cactus_top: createMat('cactus_top'),
    cactus: [
        createMat('cactus_side'),
        createMat('cactus_side'),
        createMat('cactus_top'),
        createMat('cactus_top'),
        createMat('cactus_side'),
        createMat('cactus_side')
    ],
    grass: [
        createMat('grass_side'), // right
        createMat('grass_side'), // left
        createMat('grass_top'), // top
        createMat('dirt'), // bottom
        createMat('grass_side'), // front
        createMat('grass_side')  // back
    ],
    snow_dirt: [
        createMat('dirt_snow_side'), // right
        createMat('dirt_snow_side'), // left
        createMat('snow'),  // top (slightly less rough)
        createMat('dirt'),       // bottom
        createMat('dirt_snow_side'), // front
        createMat('dirt_snow_side')  // back
    ],
    snow: createMat('snow'),
    dirt: createMat('dirt'),
    stone: createMat('stone'),
    wood: [
        createMat('wood_side'), // right
        createMat('wood_side'), // left
        createMat('wood_top'), // top
        createMat('wood_top'), // bottom
        createMat('wood_side'), // front
        createMat('wood_side')  // back
    ],
    planks: createMat('planks'),
    leaves: new THREE.MeshStandardMaterial({ roughness: 1.0, map: loadTex('leaves'), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
    sand: createMat('sand'),
    glass: new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.3, map: loadTex('glass'), transparent: true, opacity: 0.6 }),
    cobblestone: createMat('cobblestone'),
    brick: createMat('brick'),
    gravel: createMat('gravel'),
    bookshelf: [
        createMat('bookshelf'), // right
        createMat('bookshelf'), // left
        createMat('planks'), // top
        createMat('planks'), // bottom
        createMat('bookshelf'), // front
        createMat('bookshelf')  // back
    ],
    coal_ore: createMat('coal_ore'),
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
    bedrock: createMat('bedrock'),
    obsidian: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.4, map: loadTex('obsidian') }),
    end_stone: createMat('end_stone'),
    netherrack: createMat('netherrack'),
    glowstone: new THREE.MeshBasicMaterial({ map: loadTex('glowstone'), color: 0xfffcc0 }), // Emits light like lava
    nether_brick: createMat('nether_brick'),
    soul_sand: createMat('soul_sand'),
    quartz_ore: createMat('quartz_ore'),
    redstone_dust: new THREE.MeshBasicMaterial({ map: loadTex('redstone_dust'), color: 0xffaaaa, transparent: true, opacity: 0.9 }), // Glows
    redstone_lamp: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2, map: loadTex('redstone_lamp') }),
    redstone_lamp_on: new THREE.MeshBasicMaterial({ map: loadTex('redstone_lamp'), color: 0xffdd88 }), // Emits light when active
    furnace: [
        createMat('furnace_side'), // right
        createMat('furnace_side'), // left
        createMat('furnace_side'), // top
        createMat('furnace_side'), // bottom
        createMat('furnace_front'), // front
        createMat('furnace_side')  // back
    ],
    iron_ingot: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8, map: loadTex('iron_ingot'), transparent: true }),
    gold_ingot: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 1.0, map: loadTex('gold_ingot'), transparent: true }),
    diamond: new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.8, map: loadTex('diamond'), transparent: true }),
    coal: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('coal'), transparent: true }),

    emerald_block: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, map: loadTex('emerald_block') }),
    emerald_ore: new THREE.MeshStandardMaterial({ roughness: 0.7, map: loadTex('emerald_ore') }),
    emerald: new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.5, map: loadTex('emerald_block'), transparent: true }),
    lapis_block: new THREE.MeshStandardMaterial({ roughness: 0.4, map: loadTex('lapis_block') }),
    glass: new THREE.MeshPhysicalMaterial({ roughness: 0.1, transmission: 0.9, transparent: true, opacity: 0.4, map: loadTex('glass') }),
    glowstone: new THREE.MeshStandardMaterial({ roughness: 0.8, emissive: 0xffdb58, emissiveIntensity: 0.5, map: loadTex('glowstone') }),
    sea_lantern: new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xb3ffff, emissiveIntensity: 0.6, map: loadTex('sea_lantern') }),
    quartz_block: new THREE.MeshStandardMaterial({ roughness: 0.3, map: loadTex('quartz_block') }),
    purpur_block: new THREE.MeshStandardMaterial({ roughness: 0.6, map: loadTex('purpur_block') }),

    leaves_birch: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('leaves_birch'), transparent: true }),
    leaves_spruce: new THREE.MeshStandardMaterial({ roughness: 0.8, map: loadTex('leaves_spruce'), transparent: true }),
    log_birch: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('log_birch') }),
    log_spruce: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('log_spruce') }),
    tall_grass: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('tall_grass'), transparent: true, side: THREE.DoubleSide }),
    fern: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('fern'), transparent: true, side: THREE.DoubleSide }),
    dandelion: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('dandelion'), transparent: true, side: THREE.DoubleSide }),
    poppy: new THREE.MeshStandardMaterial({ roughness: 0.9, map: loadTex('poppy'), transparent: true, side: THREE.DoubleSide }),

    tnt_side: createMat('tnt_side'),
    tnt_top: createMat('tnt_top'),
    tnt_bottom: createMat('tnt_bottom')
};

// Map arrays for directional textures
blockMaterials['tnt'] = [
    blockMaterials['tnt_side'],
    blockMaterials['tnt_side'],
    blockMaterials['tnt_top'],
    blockMaterials['tnt_bottom'],
    blockMaterials['tnt_side'],
    blockMaterials['tnt_side']
];

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

let isGameRunning = false;
let pauseMenuSource = 'start'; // 'start' or 'pause'


controls.addEventListener('unlock', () => {
    if (inventoryEl.style.display !== 'block' && document.getElementById('furnace-ui').style.display !== 'flex') {
        if (isGameRunning) {
            document.getElementById('pause-screen').style.display = 'flex';
        } else {
            document.getElementById('start-screen').style.display = 'flex';
        }
    }
});


scene.add(controls.getObject());

// --- Start Screen Logic ---
const startScreen = document.getElementById('start-screen');
const hudContainer = document.getElementById('hud-container');
const crosshair = document.getElementById('crosshair');

let isSingleplayer = false;
function startGame(isMultiplayer) {
    isSingleplayer = !isMultiplayer;
    startScreen.style.display = 'none';
    hudContainer.style.display = 'flex';
    crosshair.style.display = 'block';
    isGameRunning = true;
    instructions.style.display = 'block';

    // In a real game, singleplayer might spin up a local worker or local state.
    // For this prototype, we'll connect to the same server but perhaps disable chat UI
    if (!isMultiplayer) {
        document.getElementById('chat-container').style.display = 'none';
    }
}

document.getElementById('btn-singleplayer').addEventListener('click', () => startGame(false));
document.getElementById('btn-multiplayer').addEventListener('click', () => startGame(true));

// WASD to start
document.addEventListener('keydown', (e) => {
    if (startScreen.style.display !== 'none') {
        const key = e.code;
        if (key === 'KeyW' || key === 'KeyA' || key === 'KeyS' || key === 'KeyD') {
            startGame(false); // Default to singleplayer on quick start
            // Slight delay to allow DOM to update before locking
            setTimeout(() => controls.lock(), 100);
        }
    }
});

// initial camera position
camera.position.set(0, 2, 0);

// Movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let canJump = false;
let isFlying = false;

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
                // Only allow flight in creative mode
                if (currentGamemode === 1) {
                    isFlying = !isFlying;
                    if (!isFlying) {
                        moveUp = false;
                        moveDown = false;
                    } else {
                        velocity.y = 0; // stop falling
                    }
                }

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
                if (isFlying) {
                    moveUp = true;
                    break;
                }
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
            case 'ShiftLeft':
                if (isFlying) {
                    moveDown = true;
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
        case 'Space':
            moveUp = false;
            break;
        case 'ShiftLeft':
            moveDown = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- Voxel Data Structure & Hidden Surface Removal ---
const objects = []; // Active meshes for raycasting
export const worldData = new Map(); // x,y,z -> type
const renderedBlocks = new Map(); // x,y,z -> THREE.Mesh

let worldSize = 64; // Increased from 64x64 to 96x96 blocks
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

function explode(cx, cy, cz, radius) {
    const rSq = radius * radius;
    // Basic explosion effect: remove blocks in a sphere
    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                if (x*x + y*y + z*z <= rSq) {
                    const bx = cx + x;
                    const by = cy + y;
                    const bz = cz + z;
                    const key = getBlockKey(bx, by, bz);
                    const bType = worldData.get(key);

                    if (bType && bType !== 'bedrock') {
                        worldData.delete(key);
                        updateBlockVisibility(bx, by, bz);
                        socket.emit('updateBlock', { action: 'remove', position: {x:bx, y:by, z:bz}, dimension: currentDimension });
                    }
                }
            }
        }
    }

    // Update neighbors to recalculate mesh visibility
    for (let x = -radius - 1; x <= radius + 1; x++) {
        for (let y = -radius - 1; y <= radius + 1; y++) {
            for (let z = -radius - 1; z <= radius + 1; z++) {
                updateBlockVisibility(cx + x, cy + y, cz + z);
            }
        }
    }

    // Simple flash effect
    const flash = new THREE.PointLight(0xffffff, 5, 20);
    flash.position.set(cx, cy, cz);
    scene.add(flash);
    setTimeout(() => {
        scene.remove(flash);
    }, 100);
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
                // Overworld terrain - 1.18 Style Spline/FBM generation

                // 1. Continentalness (determines oceans vs landmasses)
                const continentalness = noise.fbm2D(x * 0.005, z * 0.005, 4, 0.5, 2.0);

                // 2. Erosion (determines flat plains vs jagged mountains)
                const erosion = noise.fbm2D(x * 0.01 + 1000, z * 0.01 + 1000, 3, 0.5, 2.0);

                // 3. Peaks and Valleys (adds jagged high-frequency elevation)
                const pv = noise.fbm2D(x * 0.03 + 2000, z * 0.03 + 2000, 5, 0.5, 2.0);

                let baseHeight = 0;

                // Deep Ocean basin
                if (continentalness < -0.1) {
                    baseHeight = -15 + continentalness * 30; // Deep down
                }
                // Continental land
                else {
                    baseHeight = 5 + (continentalness * 20);

                    // High erosion = flatter, low erosion = mountains
                    if (erosion < 0.1) {
                        // High mountains
                        baseHeight += Math.pow(Math.abs(pv) * 2.5, 3.0) * 25.0;
                    } else {
                        // Rolling hills/plains
                        baseHeight += pv * 8;
                    }
                }

                // River noise: ridged multifractal style carving
                const riverNoise = Math.abs(noise.fbm2D(x * 0.008 + 5000, z * 0.008 + 5000, 4, 0.5, 2.0));
                if (riverNoise < 0.06 && baseHeight > -5) {
                    const depthFactor = 1.0 - (riverNoise / 0.06);
                    baseHeight -= depthFactor * 25; // Cut deep river ravines
                }

                // Make sure it doesn't go below bedrock
                let rawHeight = Math.max(baseHeight, worldDepth + 1);
                // Cap extreme mountain heights
                rawHeight = Math.min(rawHeight, 60);

                const y = Math.floor(rawHeight) + 0.5; // Offset to n.5 so top is at integer

                // Biome mapping via temperature/moisture 2D noise (scaled up for vast biomes)
                // Use a lower frequency for larger distinct biome regions
                const tempNoiseRaw = noise.fbm2D(x * 0.005, z * 0.005, 4, 0.5, 2.0);
                const moistureNoise = noise.fbm2D(x * 0.005 + 100, z * 0.005 + 100, 4, 0.5, 2.0);

                // Add a very high-frequency noise map to dither the borders of biomes to create smooth visual transitions
                const ditherNoise = noise.noise2D(x * 0.5, z * 0.5) * 0.15; // ±0.15 perturbation
                const tempNoise = tempNoiseRaw + ditherNoise; // Smooth blending between borders

                let biome = 'forest';
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
                if (biome === 'swamp' && (y - 0.5) > -3 && (y - 0.5) <= 0) {
                    // Make it watery mud
                    surfaceBlock = Math.random() > 0.5 ? 'water' : 'mud';
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
                        else blockType = 'terracotta';
                    } else {
                        // Stone layer - check for caves and ores
                        // 1.18 Style "Cheese" Caves (large sprawling openings)
                        const cheeseCaveNoise = noise.noise3D(x * 0.03, currentY * 0.03, z * 0.03);
                        // 1.18 Style "Spaghetti" Caves (long winding tunnels)
                        const spaghettiCaveNoise = Math.abs(noise.noise3D(x * 0.05 + 100, currentY * 0.05 + 100, z * 0.05 + 100));

                        // Mix the noises. If the combination exceeds thresholds, dig a cave
                        if (cheeseCaveNoise > 0.4 || spaghettiCaveNoise < 0.05) {
                            // Lava pools at bottom of caves if very deep
                            if (currentY < worldDepth + 5 && currentY > worldDepth) {
                                setVoxelData(x, currentY, z, 'lava');
                            }
                            continue; // Cave (air)
                        }

                        // Deepslate transition
                        if (currentY < -15) {
                            blockType = 'cobblestone'; // Use cobblestone as deepslate
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

                            if (biome === 'snow' || biome === 'mesa') {
                                // Simulate mountains by spawning emeralds in high altitudes or specific biomes
                                if (depthPercent < 0.5 && Math.random() < 0.05) blockType = 'emerald_ore';
                            }
                        }

                        // Underground Dungeons
                        if (currentY < 10 && currentY > worldDepth + 5 && Math.random() < 0.0005) {
                            // Dig out a 5x5x4 room
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dy = 0; dy <= 3; dy++) {
                                    for (let dz = -2; dz <= 2; dz++) {
                                        // Walls
                                        if (Math.abs(dx) === 2 || Math.abs(dz) === 2 || dy === 0 || dy === 3) {
                                            setVoxelData(x + dx, currentY + dy, z + dz, 'cobblestone');
                                        } else {
                                            // Empty interior
                                            setVoxelData(x + dx, currentY + dy, z + dz, null);
                                        }
                                    }
                                }
                            }
                            // Treasure & Spawner
                            setVoxelData(x, currentY + 1, z, 'iron_block'); // Placeholder spawner
                            setVoxelData(x, currentY + 1, z + 1, 'wood'); // Placeholder chest
                            setVoxelData(x, currentY + 1, z - 1, 'wood'); // Placeholder chest
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

                // Procedural Structures: Mineshafts
                // Use 3D noise to create intersecting long corridors
                const shaftNoise1 = Math.abs(noise.noise3D(x * 0.05, 100, z * 0.05));
                const shaftNoise2 = Math.abs(noise.noise3D(x * 0.05 + 1000, 200, z * 0.05 + 1000));

                // If we are in a mineshaft grid
                if ((shaftNoise1 < 0.03 || shaftNoise2 < 0.03) && topY > waterLevel) {
                    const msY = worldDepth + 15; // fixed level for mineshafts
                    // Carve tunnel
                    for (let cx = -1; cx <= 1; cx++) {
                        for (let cy = 0; cy <= 2; cy++) {
                            for (let cz = -1; cz <= 1; cz++) {
                                setVoxelData(x + cx, msY + cy, z + cz, null); // Air
                            }
                        }
                    }
                    // Place supports occasionally
                    if (Math.random() < 0.1) {
                        for (let cy = 0; cy <= 2; cy++) {
                            setVoxelData(x - 1, msY + cy, z, 'wood');
                            setVoxelData(x + 1, msY + cy, z, 'wood');
                        }
                        setVoxelData(x, msY + 2, z, 'wood'); // Top support
                    } else if (Math.random() < 0.02) {
                        // Place cobwebs (using glass as placeholder for cobweb if none exists, let's use leaves as they are transparent and slow movement might not be implemented but looks ok)
                        setVoxelData(x, msY + 1, z, 'leaves');
                    } else if (Math.random() < 0.1) {
                        // Place rails (using gravel as a placeholder ground texture for rails for now)
                        setVoxelData(x, msY - 1, z, 'planks'); // planks floor
                    }
                }

                // Procedural Vegetation (spawn frequency depends on biome)
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

                // Procedural Structures: Villages
                // We use a low-frequency noise to define "village zones" on flat plains/deserts
                const villageZone = noise.fbm2D(x * 0.01 + 500, z * 0.01 + 500, 2, 0.5, 2.0);
                const isVillageBiome = (biome === 'forest' || biome === 'desert') && topY >= waterLevel && topY < 15; // relatively flat surface
                const isFlat = erosion > 0.1; // Make sure it's not a mountain

                if (villageZone > 0.4 && isVillageBiome && isFlat) {
                    // Inside a village zone, randomly place paths or buildings
                    const villageDetail = noise.noise2D(x * 0.2, z * 0.2);

                    if (villageDetail > 0.6) {
                        // Path
                        setVoxelData(x, topY, z, 'gravel');
                    } else if (villageDetail < -0.6) {
                        // Small house base
                        const buildingMat = biome === 'desert' ? 'sand' : 'cobblestone';
                        const wallMat = biome === 'desert' ? 'sand' : 'planks';
                        const roofMat = biome === 'desert' ? 'sand' : 'wood';

                        // We generate a simple 3x3 column to act as a house segment.
                        // Because this runs per-column, dense areas of noise create blocky houses
                        for (let h = 1; h <= 3; h++) {
                            setVoxelData(x, topY + h, z, wallMat);
                        }
                        // Roof
                        setVoxelData(x, topY + 4, z, roofMat);
                        // Clear space inside if it's thick enough (simplification)
                    }

                } else if (biome === 'desert' && topY >= waterLevel && Math.random() < 0.001) {
                    // Desert Pyramid (9x9 base)
                    // We build it from the top down to easily create the stepped shape
                    const baseHalf = 4;
                    for (let h = 0; h <= baseHalf; h++) {
                        const stepRadius = h;
                        const levelY = topY + baseHalf - h + 1; // Pyramid points up
                        for (let px = -stepRadius; px <= stepRadius; px++) {
                            for (let pz = -stepRadius; pz <= stepRadius; pz++) {
                                // Hollow inside
                                if (Math.abs(px) < stepRadius && Math.abs(pz) < stepRadius && h > 0) {
                                    if (h === baseHalf && px === 0 && pz === 0) {
                                        setVoxelData(x, levelY, z, 'gold_block'); // Treasure
                                    } else {
                                        setVoxelData(x + px, levelY, z + pz, null); // Air inside
                                    }
                                } else {
                                    setVoxelData(x + px, levelY, z + pz, 'sand'); // Sandstone equivalent
                                }
                            }
                        }
                    }
                    // Fill beneath
                    for (let px = -baseHalf; px <= baseHalf; px++) {
                        for (let pz = -baseHalf; pz <= baseHalf; pz++) {
                            for (let uy = topY; uy > topY - 3; uy--) {
                                if (!getVoxelData(x + px, uy, z + pz)) {
                                    setVoxelData(x + px, uy, z + pz, 'sand');
                                }
                            }
                        }
                    }
                } else if (topY >= waterLevel && Math.random() < 0.001) {
                    // Ruined Portal
                    // Base platform
                    for (let px = -2; px <= 2; px++) {
                        for (let pz = -2; pz <= 2; pz++) {
                            setVoxelData(x + px, topY, z + pz, Math.random() > 0.3 ? 'netherrack' : 'obsidian');
                        }
                    }
                    setVoxelData(x, topY, z, 'lava'); // Center lava

                    // Upright frame (4x5)
                    for (let fx = -1; fx <= 2; fx++) {
                        for (let fy = 1; fy <= 4; fy++) {
                            // Only outline
                            if (fx > -1 && fx < 2 && fy > 1 && fy < 4) continue;

                            // Missing blocks randomly
                            if (Math.random() < 0.3) continue;

                            setVoxelData(x + fx, topY + fy, z, 'obsidian');
                        }
                    }
                    // A single gold block nearby
                    if (Math.random() < 0.5) setVoxelData(x + 2, topY + 1, z + 2, 'gold_block');
                    else setVoxelData(x - 2, topY + 1, z - 2, 'gold_block');

                } else if (isTreeSurface && topY >= waterLevel && Math.random() < treeChance) {
                    const treeHeight = Math.floor(Math.random() * 3) + 4; // 4-6 blocks tall

                    let logType = 'wood';
                    let leafType = 'leaves';
                    if (biome === 'snow') {
                        logType = 'log_spruce';
                        leafType = 'leaves_spruce';
                    } else if (biome === 'forest' && Math.random() < 0.3) {
                        logType = 'log_birch';
                        leafType = 'leaves_birch';
                    } else if (biome === 'swamp') {
                        // Swamp trees are made of standard wood/leaves but usually generate vines
                    }

                    // Trunk
                    for(let i = 1; i <= treeHeight; i++) {
                        setVoxelData(x, topY + i, z, logType);
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

                                setVoxelData(x + lx, leavesTop + ly, z + lz, leafType);
                            }
                        }
                    }
                } else if (isTreeSurface && topY >= waterLevel && Math.random() < 0.1) {
                    // Small vegetation (tall grass, ferns, flowers)
                    let vegType = 'tall_grass';
                    const r = Math.random();
                    if (biome === 'forest') {
                        if (r < 0.2) vegType = 'dandelion';
                        else if (r < 0.4) vegType = 'poppy';
                        else if (r < 0.6) vegType = 'fern';
                    } else if (biome === 'snow') {
                        vegType = 'fern';
                    } else if (biome === 'swamp') {
                        vegType = r < 0.5 ? 'tall_grass' : 'fern';
                    }
                    setVoxelData(x, topY + 1, z, vegType);
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

function addOtherPlayer(playerInfo) { if (isSingleplayer) return;
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

socket.on('playerMoved', (playerInfo) => { if (isSingleplayer) return;
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
    sheep: new THREE.BoxGeometry(1.0, 1.0, 1.0),
    skeleton: new THREE.BoxGeometry(0.8, 1.8, 0.8),
    spider: new THREE.BoxGeometry(1.5, 0.6, 1.5),
    ender_dragon: new THREE.BoxGeometry(8, 4, 16) // Huge box placeholder for dragon
};
const mobMaterials = {
    pig: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0xFFC0CB }),
    zombie: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0x006400 }),
    cow: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0x8B4513 }),
    creeper: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0x00FF00 }),
    sheep: new THREE.MeshStandardMaterial({roughness: 0.9, color: 0xE8E8E8 }), // Off-white wool color
    skeleton: new THREE.MeshStandardMaterial({roughness: 0.8, color: 0xD3D3D3 }), // Light gray bone color
    spider: new THREE.MeshStandardMaterial({roughness: 0.6, color: 0x333333, emissive: 0x440000, emissiveIntensity: 0.4 }), // Dark grey with red glowing eyes
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
        sky.visible = false;
    } else if (currentDimension === 'the_end') {
        scene.background = new THREE.Color(0x110022); // Dark purple/black void
        scene.fog.color.setHex(0x110022);
        scene.fog.density = 0.01;
        directionalLight.intensity = 0.05; // Very dim
        hemiLight.color.setHex(0xaa88cc); // Pale purple ambient
        hemiLight.groundColor.setHex(0x221133);
        hemiLight.intensity = 0.3;
        sky.visible = false;
    } else {
        scene.background = null; // Let the Sky box handle it
        scene.fog.color.setHex(0x7ec0ee);
        scene.fog.density = 0.0035;
        directionalLight.intensity = 0.8;
        hemiLight.color.setHex(0xffffff);
        hemiLight.groundColor.setHex(0x444444);
        hemiLight.intensity = 0.6;
        sky.visible = true;
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

                    // TNT interaction
                    if (blockType === 'tnt') {
                        // Ignite TNT
                        // Change color to white temporarily to simulate flashing
                        intersect.object.material = new THREE.MeshBasicMaterial({color: 0xffffff});

                        setTimeout(() => {
                            explode(x, y, z, 4);
                        }, 3000);
                        return;
                    }

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

// --- Mobs ---
const mobs = [];

function spawnMob(type, x, y, z) {
    // If we have custom geometries/materials from the multiplayer system, use them, otherwise fallback to simple boxes
    const geometry = mobGeometries[type] || new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const material = mobMaterials[type] || new THREE.MeshStandardMaterial({ color: type === 'pig' ? 0xffaacc : 0x00aa00, roughness: 0.8 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    mobs.push({
        mesh: mesh,
        type: type,
        velocity: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        speed: type === 'pig' ? 2 : 1,
        lastTurn: performance.now()
    });
}

function updateMobs(delta) {
    const now = performance.now();
    for (let i = 0; i < mobs.length; i++) {
        const mob = mobs[i];

        // Gravity
        mob.velocity.y -= 20 * delta; // standard gravity

        // Randomly change direction
        if (now - mob.lastTurn > 3000 + Math.random() * 5000) {
            mob.direction.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            mob.lastTurn = now;

            // Randomly jump
            if (Math.random() < 0.3 && mob.velocity.y === 0) { // simple grounded check
                mob.velocity.y = 6;
            }
        }

        // Move horizontally
        const moveX = mob.direction.x * mob.speed * delta;
        const moveZ = mob.direction.z * mob.speed * delta;

        mob.mesh.position.x += moveX;
        mob.mesh.position.y += mob.velocity.y * delta;
        mob.mesh.position.z += moveZ;

        // Simple floor collision (prevent falling below y=0 or ground if we check voxels)
        // For simplicity we just ensure they don't fall forever, real voxel collision is better
        let cx = Math.floor(mob.mesh.position.x);
        let cy = Math.floor(mob.mesh.position.y);
        let cz = Math.floor(mob.mesh.position.z);
        let blockBelow = getVoxelData(cx, cy, cz);

        if (blockBelow) {
            mob.mesh.position.y = cy + 1;
            mob.velocity.y = 0;
        } else if (mob.mesh.position.y < -10) {
            // reset if fell
            mob.mesh.position.y = 100;
        }
    }
}

// Spawn some initial mobs
setTimeout(() => {
    for (let i = 0; i < 10; i++) {
        spawnMob('pig', Math.random() * 40 - 20, 50, Math.random() * 40 - 20);
        spawnMob('zombie', Math.random() * 40 - 20, 50, Math.random() * 40 - 20);
        spawnMob('cow', Math.random() * 40 - 20, 50, Math.random() * 40 - 20);
        spawnMob('creeper', Math.random() * 40 - 20, 50, Math.random() * 40 - 20);
        spawnMob('skeleton', Math.random() * 40 - 20, 50, Math.random() * 40 - 20);
        spawnMob('spider', Math.random() * 40 - 20, 50, Math.random() * 40 - 20);
    }
}, 5000);

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
        const friction = (inLiquid || isFlying) ? 5.0 : 10.0; // High friction/drag in liquid and air
        velocity.x -= velocity.x * friction * delta;
        velocity.z -= velocity.z * friction * delta;

        if (isFlying) {
            velocity.y -= velocity.y * friction * delta;
            if (moveUp) velocity.y = 15;
            if (moveDown) velocity.y = -15;
        } else {
            // Apply gravity and buoyancy
            const gravity = inLiquid ? 1.5 : 9.8 * 3.0; // Slower falling in liquid
            velocity.y -= gravity * delta;

            // Terminal velocity in liquid
            if (inLiquid && velocity.y < -1.5) velocity.y = -1.5;
        }

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Ensure consistent movement in all directions

        let speed = inLiquid ? 80.0 : (isFlying ? 600.0 : 400.0); // Slower in liquid, faster flying
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
                if (isFlying) isFlying = false; // Land when hitting ground

                // Fall damage logic
                if (currentGamemode === 0 && prevVelocityY < -15.0 && !inLiquid && !isFlying) {
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
    // old cloud animation removed

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
    if (currentDimension === 'overworld') {
        const normalizedSunHeight = Math.sin(timeOfDay); // 1 = noon, 0 = sunrise/sunset, -1 = midnight

        // Update Sky addon uniform position
        // timeOfDay goes from 0 to PI*2 (0 = sunrise, PI/2 = noon)
        // Convert to elevation and azimuth for sky shader
        const elevation = Math.sin(timeOfDay) * 90;
        const azimuth = Math.cos(timeOfDay) * 180;

        const phi = THREE.MathUtils.degToRad( 90 - elevation );
        const theta = THREE.MathUtils.degToRad( azimuth );

        sunPosition.setFromSphericalCoords( 1, phi, theta );
        sky.material.uniforms[ 'sunPosition' ].value.copy( sunPosition );

        if (normalizedSunHeight > 0) {
            // Day
            directionalLight.position.copy(sunMesh.position);
            directionalLight.intensity = Math.max(0.1, normalizedSunHeight * 2.0);
            directionalLight.color.setHex(0xfffaec);
            ambientLight.intensity = Math.max(0.1, normalizedSunHeight * 0.45);
            hemiLight.intensity = Math.max(0.1, normalizedSunHeight * 0.7);

            // Link fog to sun height
            const skyR = Math.min(1.0, 0.49 + (1.0 - normalizedSunHeight) * 0.5);
            const skyG = Math.max(0.4, 0.75 - (1.0 - normalizedSunHeight) * 0.3);
            const skyB = 0.93;
            scene.fog.color.setRGB(skyR, skyG, skyB);

            // Keep background visible so sky sphere shows behind it (scene.background overridden by sky)
        } else {
            // Night
            directionalLight.position.copy(moonMesh.position);
            directionalLight.intensity = Math.max(0.05, -normalizedSunHeight * 0.3); // Dim moonlight
            directionalLight.color.setHex(0xaaaaee);
            ambientLight.intensity = Math.max(0.05, -normalizedSunHeight * 0.1);
            hemiLight.intensity = 0.05;

            // Night Sky Fog (Dark Blue/Black)
            const depth = -normalizedSunHeight; // 0 to 1
            scene.fog.color.setRGB(0.02 * depth, 0.02 * depth, 0.05 * depth);
        }
    }

    updateItemDrops(delta);

    updateMobs(delta);

    updateWeather(delta);

    prevTime = time;

    composer.render();
}
animate();

// Export for use in other modules if needed, or just let it run
export { scene, camera, renderer };


// --- Settings & Menus ---
const btnOptionsMain = document.getElementById('btn-options-main');
const btnOptionsPause = document.getElementById('btn-options-pause');
const btnOptionsDone = document.getElementById('btn-options-done');
const mainMenuButtons = document.getElementById('main-menu-buttons');
const optionsMenuButtons = document.getElementById('options-menu-buttons');
const pauseScreen = document.getElementById('pause-screen');

btnOptionsMain.addEventListener('click', () => {
    pauseMenuSource = 'start';
    mainMenuButtons.style.display = 'none';
    optionsMenuButtons.style.display = 'flex';
});

btnOptionsPause.addEventListener('click', () => {
    pauseMenuSource = 'pause';
    pauseScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    document.querySelector('.title-container').style.display = 'none';
    document.querySelector('.menu-footer').style.display = 'none';
    mainMenuButtons.style.display = 'none';
    optionsMenuButtons.style.display = 'flex';
});

btnOptionsDone.addEventListener('click', () => {
    optionsMenuButtons.style.display = 'none';
    if (pauseMenuSource === 'start') {
        mainMenuButtons.style.display = 'flex';
    } else {
        startScreen.style.display = 'none';
        document.querySelector('.title-container').style.display = 'block';
        document.querySelector('.menu-footer').style.display = 'block';
        pauseScreen.style.display = 'flex';
    }
});

// Pause Menu Buttons
document.getElementById('btn-resume').addEventListener('click', () => {
    pauseScreen.style.display = 'none';
    controls.lock();
});
document.getElementById('btn-disconnect').addEventListener('click', () => {
    location.reload(); // Quickest way to clean state and return to title
});

// Setting Sliders
document.getElementById('slider-render').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('val-render').innerText = val + " Chunks";
    worldSize = val;
    scene.fog.density = 0.5 / val;
});
document.getElementById('slider-fov').addEventListener('input', (e) => {
    currentFov = parseInt(e.target.value);
    document.getElementById('val-fov').innerText = currentFov;
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
});
document.getElementById('slider-gui').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    let scaleStr = val === 2 ? "Auto" : "x" + val;
    document.getElementById('val-gui').innerText = scaleStr;
    const scaleFactor = val * 0.5;
    const hud = document.getElementById('hud-container');
    const crosshair = document.getElementById('crosshair');
    const chat = document.getElementById('chat-container');
    if (hud) { hud.style.transform = `scale(${scaleFactor})`; hud.style.transformOrigin = 'bottom center'; }
    if (crosshair) crosshair.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
    if (chat) { chat.style.transform = `scale(${scaleFactor})`; chat.style.transformOrigin = 'bottom left'; }
});
document.getElementById('slider-sens').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('val-sens').innerText = val.toFixed(1);
    controls.pointerSpeed = val;
});

// Toggles
let shadowsEnabled = true;
const btnToggleShadows = document.getElementById('btn-toggle-shadows');
btnToggleShadows.addEventListener('click', () => {
    shadowsEnabled = !shadowsEnabled;
    btnToggleShadows.innerText = "Shadows: " + (shadowsEnabled ? "ON" : "OFF");
    renderer.shadowMap.enabled = shadowsEnabled;
    directionalLight.castShadow = shadowsEnabled;
    scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = shadowsEnabled;
            child.receiveShadow = shadowsEnabled;
        }
    });
});

let bloomEnabled = true;
const btnToggleBloom = document.getElementById('btn-toggle-bloom');
btnToggleBloom.addEventListener('click', () => {
    bloomEnabled = !bloomEnabled;
    btnToggleBloom.innerText = "Bloom: " + (bloomEnabled ? "ON" : "OFF");
    // We can't easily remove/add passes directly, so we just set strength to 0
    if (bloomPass) bloomPass.strength = bloomEnabled ? 0.8 : 0.0;
});
