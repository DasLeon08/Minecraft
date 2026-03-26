import { generateTexture } from './textures.js';
import { setActiveBlock } from './game.js';

// Available item types for the UI
const availableItems = [
    'grass', 'dirt', 'stone', 'wood', 'planks',
    'leaves', 'sand', 'glass', 'cobblestone', 'brick',
    'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore',
    'water', 'lava', 'bedrock'
];
const hotbarSlots = new Array(9).fill(null);
// Initialize hotbar with some default items
hotbarSlots[0] = 'dirt';
hotbarSlots[1] = 'grass';
hotbarSlots[2] = 'stone';
hotbarSlots[3] = 'wood';

// UI Elements
const hotbarEl = document.getElementById('hotbar');
const inventoryEl = document.getElementById('inventory');
const inventoryItemsEl = document.getElementById('inventory-items');
const closeInvBtn = document.getElementById('close-inventory');
const craftSlots = document.querySelectorAll('#crafting-grid .craft-slot');
const craftResult = document.getElementById('crafting-result');

let activeHotbarIndex = 0;
let isInventoryOpen = false;
let draggedItem = null; // What are we currently dragging
let draggedElement = null;

// Cache generated data URLs so we don't recreate canvases every click
const textureCache = {};
availableItems.forEach(type => {
    // For blocks with multiple sides, just use the main texture or top
    let texType = type;
    if (type === 'grass') texType = 'grass_top';
    if (type === 'wood') texType = 'wood_side';
    textureCache[type] = generateTexture(texType);
});

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
            img.src = textureCache[hotbarSlots[i]];
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
    availableItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.draggable = true;

        const img = document.createElement('img');
        img.src = textureCache[item];
        div.appendChild(img);

        div.addEventListener('dragstart', (e) => {
            draggedItem = item;
            e.dataTransfer.setData('text/plain', item);
        });

        inventoryItemsEl.appendChild(div);
    });
}

// Setup Crafting Area
const craftingGrid = [null, null, null, null];

const recipes = {
    // pattern: string representing grid -> result
    // We just do simple count-based recipes for prototype
    'wood': 'planks',
    'sand': 'glass', // normally furnace, but simple crafting here
    'stone': 'cobblestone',
    'cobblestone,cobblestone': 'brick', // generic recipe to get brick
};

function updateCrafting() {
    let counts = {};
    let empty = true;

    craftingGrid.forEach(slot => {
        if (slot !== null) {
            empty = false;
            counts[slot] = (counts[slot] || 0) + 1;
        }
    });

    craftResult.innerHTML = '';

    if (empty) return;

    // Determine recipe match
    let resultItem = null;

    if (counts['wood'] && Object.keys(counts).length === 1) {
        resultItem = 'planks';
    } else if (counts['sand'] && Object.keys(counts).length === 1) {
        resultItem = 'glass';
    } else if (counts['stone'] && Object.keys(counts).length === 1) {
        resultItem = 'cobblestone';
    } else if (counts['cobblestone'] === 2 && Object.keys(counts).length === 1) {
        resultItem = 'brick';
    }

    if (resultItem) {
        const img = document.createElement('img');
        img.src = textureCache[resultItem];
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
            img.src = textureCache[craftingGrid[i]];
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

closeInvBtn.addEventListener('click', () => {
    const controls = document.querySelector('canvas').__controls; // Hacky access or pass via game.js
    // We will trigger unlock natively via game.js keydown instead
});

// Health and Hunger
let health = 20; // 20 half-hearts (10 full hearts)
let hunger = 20; // 20 half-shanks (10 full shanks)

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

// Init
renderHotbar();
renderStatusBars();
setupInventoryItems();
selectHotbarSlot(0);
