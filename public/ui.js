import { generateTexture, generateIsometricBlockIcon, generateToolIcon } from './textures.js';
import { setActiveBlock } from './game.js';

// Available item types for the UI
export const availableItems = [
    'grass', 'dirt', 'stone', 'wood', 'planks',
    'leaves', 'sand', 'glass', 'cobblestone', 'brick',
    'gravel', 'bookshelf',
    'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore', 'redstone_ore',
    'water', 'lava', 'bedrock', 'snow', 'snow_dirt',
    'obsidian', 'netherrack', 'glowstone', 'nether_brick', 'soul_sand', 'quartz_ore'
];

export const availableTools = [
    'stick', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'gold_pickaxe', 'diamond_pickaxe',
    'wooden_axe', 'stone_axe', 'iron_axe', 'gold_axe', 'diamond_axe'
];

const hotbarSlots = new Array(9).fill(null);
// Initialize hotbar with some default items
hotbarSlots[0] = 'dirt';
hotbarSlots[1] = 'wooden_pickaxe';
hotbarSlots[2] = 'stone';
hotbarSlots[3] = 'wood';

// UI Elements
const hotbarEl = document.getElementById('hotbar');
const inventoryEl = document.getElementById('inventory');
const inventoryItemsEl = document.getElementById('inventory-items');
const craftSlots = document.querySelectorAll('#crafting-grid .craft-slot');
const craftResult = document.getElementById('crafting-result');

let activeHotbarIndex = 0;
let isInventoryOpen = false;
let draggedItem = null; // What are we currently dragging
let draggedElement = null;

// Cache generated data URLs so we don't recreate canvases every click
export const textureCache = {};
export const isoTextureCache = {};

// We use an async setup to generate the 3D icons because they require canvas composition
async function preloadTextures() {
    // Pre-generate standard 2D textures first
    const typesToGen = [...availableItems, 'grass_top', 'grass_side', 'wood_top', 'wood_side', 'dirt_snow_side', 'snow'];
    typesToGen.forEach(type => {
        textureCache[type] = generateTexture(type);
    });

    availableTools.forEach(tool => {
        isoTextureCache[tool] = generateToolIcon(tool);
    });

    // Generate 3D isometric icons
    for (const type of availableItems) {
        let top = type, side = type, front = type;
        if (type === 'grass') { top = 'grass_top'; side = 'grass_side'; front = 'grass_side'; }
        if (type === 'wood') { top = 'wood_top'; side = 'wood_side'; front = 'wood_side'; }
        if (type === 'snow_dirt') { top = 'snow'; side = 'dirt_snow_side'; front = 'dirt_snow_side'; }

        isoTextureCache[type] = await generateIsometricBlockIcon(textureCache[top], textureCache[side], textureCache[front]);
    }

    renderHotbar();
    renderStatusBars();
    setupInventoryItems();
    selectHotbarSlot(0);
}

// Setup Hotbar UI
function renderHotbar() {
    hotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const slot = document.createElement('div');
        slot.className = `hotbar-slot ${i === activeHotbarIndex ? 'active' : ''}`;
        slot.dataset.index = i;

        const num = document.createElement('div');
        num.className = 'slot-number';
        num.innerText = i + 1;
        slot.appendChild(num);

        if (hotbarSlots[i]) {
            const img = document.createElement('img');
            img.src = isoTextureCache[hotbarSlots[i]] || textureCache[hotbarSlots[i]];
            slot.appendChild(img);
        }

        // Select slot on click
        slot.addEventListener('click', () => {
            selectHotbarSlot(i);
        });

        // Drop item into hotbar
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem) {
                hotbarSlots[i] = draggedItem;
                renderHotbar();
                selectHotbarSlot(activeHotbarIndex); // trigger active block update
            }
        });

        hotbarEl.appendChild(slot);
    }
}

export function selectHotbarSlot(index) {
    activeHotbarIndex = index;
    renderHotbar();
    if (hotbarSlots[index]) {
        setActiveBlock(hotbarSlots[index]);
    }
}

// Setup Inventory available items
function setupInventoryItems() {
    const allItems = [...availableItems, ...availableTools];
    allItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.draggable = true;

        const img = document.createElement('img');
        img.src = isoTextureCache[item] || textureCache[item];
        div.appendChild(img);

        div.addEventListener('dragstart', (e) => {
            draggedItem = item;
            e.dataTransfer.setData('text/plain', item);
        });

        inventoryItemsEl.appendChild(div);
    });
}

// Setup Crafting Area
const craftingGrid = new Array(9).fill(null);

function getCraftingShape() {
    // Convert 3x3 to a compact string array representation, stripping empty rows/cols
    let gridStr = [];
    for(let i=0; i<9; i+=3) {
        gridStr.push(craftingGrid.slice(i, i+3).map(x => x || ' '));
    }

    // Remove empty top rows
    while(gridStr.length > 0 && gridStr[0].every(x => x === ' ')) gridStr.shift();
    // Remove empty bottom rows
    while(gridStr.length > 0 && gridStr[gridStr.length-1].every(x => x === ' ')) gridStr.pop();

    if (gridStr.length === 0) return null;

    // Remove empty left columns
    while(gridStr.every(row => row[0] === ' ')) {
        gridStr.forEach(row => row.shift());
    }
    // Remove empty right columns
    while(gridStr.every(row => row[row.length-1] === ' ')) {
        gridStr.forEach(row => row.pop());
    }

    return gridStr.map(row => row.join(',')).join('|');
}

function updateCrafting() {
    craftResult.innerHTML = '';

    const shape = getCraftingShape();
    if (!shape) return;

    // Determine recipe match
    let resultItem = null;

    // Recipes based on exact shape after trimming
    if (shape === 'wood') resultItem = 'planks';
    else if (shape === 'sand') resultItem = 'glass';
    else if (shape === 'stone') resultItem = 'cobblestone';
    else if (shape === 'cobblestone,cobblestone') resultItem = 'brick'; // 1x2 or 2x1
    else if (shape === 'planks|planks') resultItem = 'stick';

    // Pickaxes
    else if (shape === 'planks,planks,planks| ,stick, | ,stick, ') resultItem = 'wooden_pickaxe';
    else if (shape === 'cobblestone,cobblestone,cobblestone| ,stick, | ,stick, ') resultItem = 'stone_pickaxe';
    else if (shape === 'iron_ore,iron_ore,iron_ore| ,stick, | ,stick, ') resultItem = 'iron_pickaxe';
    else if (shape === 'gold_ore,gold_ore,gold_ore| ,stick, | ,stick, ') resultItem = 'gold_pickaxe';
    else if (shape === 'diamond_ore,diamond_ore,diamond_ore| ,stick, | ,stick, ') resultItem = 'diamond_pickaxe';

    // Axes (handles left and right orientation)
    else if (shape === 'planks,planks|planks,stick| ,stick' || shape === 'planks,planks|stick,planks|stick, ') resultItem = 'wooden_axe';
    else if (shape === 'cobblestone,cobblestone|cobblestone,stick| ,stick' || shape === 'cobblestone,cobblestone|stick,cobblestone|stick, ') resultItem = 'stone_axe';
    else if (shape === 'iron_ore,iron_ore|iron_ore,stick| ,stick' || shape === 'iron_ore,iron_ore|stick,iron_ore|stick, ') resultItem = 'iron_axe';
    else if (shape === 'gold_ore,gold_ore|gold_ore,stick| ,stick' || shape === 'gold_ore,gold_ore|stick,gold_ore|stick, ') resultItem = 'gold_axe';
    else if (shape === 'diamond_ore,diamond_ore|diamond_ore,stick| ,stick' || shape === 'diamond_ore,diamond_ore|stick,diamond_ore|stick, ') resultItem = 'diamond_axe';

    if (resultItem) {
        const img = document.createElement('img');
        img.src = isoTextureCache[resultItem] || textureCache[resultItem];
        img.draggable = true;

        img.addEventListener('dragstart', (e) => {
            draggedItem = resultItem;
            e.dataTransfer.setData('text/plain', resultItem);
            // When dragged out, consume materials
            setTimeout(() => {
                craftingGrid.fill(null);
                renderCraftingGrid();
                updateCrafting();
            }, 10);
        });

        craftResult.appendChild(img);
    }
}

function renderCraftingGrid() {
    craftSlots.forEach((slot, i) => {
        slot.innerHTML = '';
        if (craftingGrid[i]) {
            const img = document.createElement('img');
            img.src = isoTextureCache[craftingGrid[i]] || textureCache[craftingGrid[i]];
            slot.appendChild(img);
        }
    });
}

craftSlots.forEach((slot, i) => {
    slot.addEventListener('dragover', e => e.preventDefault());
    slot.addEventListener('drop', e => {
        e.preventDefault();
        if (draggedItem) { // allow anything, simplified prototype
            craftingGrid[i] = draggedItem;
            renderCraftingGrid();
            updateCrafting();
        }
    });

    // remove item from grid on click
    slot.addEventListener('click', () => {
        if(craftingGrid[i]) {
            craftingGrid[i] = null;
            renderCraftingGrid();
            updateCrafting();
        }
    });
});

export function toggleInventory(controls) {
    isInventoryOpen = !isInventoryOpen;
    if (isInventoryOpen) {
        controls.unlock();
        inventoryEl.style.display = 'block';
    } else {
        inventoryEl.style.display = 'none';
        controls.lock();
    }
}

// Health and Hunger
export let health = 20; // 20 half-hearts (10 full hearts)
export let hunger = 20; // 20 half-shanks (10 full shanks)

const healthBarEl = document.getElementById('health-bar');
const hungerBarEl = document.getElementById('hunger-bar');

function renderStatusBars() {
    healthBarEl.innerHTML = '';
    hungerBarEl.innerHTML = '';

    // Render 10 hearts
    for (let i = 0; i < 10; i++) {
        const heart = document.createElement('div');
        const heartValue = (i + 1) * 2;
        if (health >= heartValue) {
            heart.className = 'heart';
        } else if (health === heartValue - 1) {
            heart.className = 'heart half';
        } else {
            heart.className = 'heart empty';
        }
        healthBarEl.appendChild(heart);
    }

    // Render 10 hunger shanks (right-to-left visual order is usually handled by flex-direction or just appending normally)
    for (let i = 0; i < 10; i++) {
        const shank = document.createElement('div');
        const shankValue = (i + 1) * 2;
        if (hunger >= shankValue) {
            shank.className = 'hunger';
        } else if (hunger === shankValue - 1) {
            shank.className = 'hunger half';
        } else {
            shank.className = 'hunger empty';
        }
        hungerBarEl.appendChild(shank);
    }
}

// Optional: expose a method to update health/hunger from game.js
export function updatePlayerStatus(newHealth, newHunger) {
    if (newHealth !== undefined) health = Math.max(0, Math.min(20, newHealth));
    if (newHunger !== undefined) hunger = Math.max(0, Math.min(20, newHunger));
    renderStatusBars();
}

export function addItemToInventory(type) {
    // Check if it's already in the hotbar (simple prototype approach)
    // We don't have quantity numbers yet, so just fill empty slots
    let added = false;
    for (let i = 0; i < 9; i++) {
        if (!hotbarSlots[i]) {
            hotbarSlots[i] = type;
            added = true;
            break;
        } else if (hotbarSlots[i] === type) {
            added = true; // "Stacked" visually for now
            break;
        }
    }
    if (added) {
        renderHotbar();
    }
}

// Init
preloadTextures();
