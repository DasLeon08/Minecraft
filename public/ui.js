import { generateTexture, generateIsometricBlockIcon, generateToolIcon } from './textures.js';
import { setActiveBlock } from './game.js';

// Available item types for the UI
export const availableItems = ['red_sand', 'terracotta', 'orange_terracotta', 'yellow_terracotta', 'sandstone', 'moss_block', 'mud', 'bookshelf', 'cactus',
    'grass', 'dirt', 'stone', 'wood', 'planks',
    'leaves', 'sand', 'glass', 'cobblestone', 'brick',
    'gravel', 'bookshelf',
    'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore', 'redstone_ore', 'emerald_ore',
    'water', 'lava', 'bedrock', 'snow', 'snow_dirt',
    'obsidian', 'netherrack', 'glowstone', 'nether_brick', 'soul_sand', 'quartz_ore',
    'glass', 'sea_lantern', 'quartz_block', 'purpur_block', 'emerald_block', 'lapis_block',
    'log_birch', 'log_spruce', 'leaves_birch', 'leaves_spruce', 'tall_grass', 'fern', 'dandelion', 'poppy', 'tnt'
];

export const availableTools = [
    'stick', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'gold_pickaxe', 'diamond_pickaxe',
    'wooden_axe', 'stone_axe', 'iron_axe', 'gold_axe', 'diamond_axe'
];

// Player's actual inventory (3 rows of 9 slots)
export const inventorySlots = new Array(27).fill(null);
const inventoryCounts = new Array(27).fill(0); // Optional: if we want to add stack numbers later, just keeping data parallel for now

// Hotbar is separate from main inventory for this simple implementation
export const hotbarSlots = new Array(9).fill(null);
export const hotbarCounts = new Array(9).fill(0);

// Initialize hotbar with some default items so player isn't completely empty
hotbarSlots[0] = 'dirt';
hotbarCounts[0] = 64;
hotbarSlots[1] = 'wooden_pickaxe';
hotbarCounts[1] = 1;

// UI Elements
const hotbarEl = document.getElementById('hotbar');
const inventoryEl = document.getElementById('inventory');
const inventoryItemsEl = document.getElementById('inventory-items');
const craftSlots = document.querySelectorAll('#crafting-grid .craft-slot');
const craftResult = document.getElementById('crafting-result');

// Furnace Elements
const furnaceInput = document.getElementById('furnace-input');
const furnaceFuel = document.getElementById('furnace-fuel');
const furnaceFlame = document.getElementById('furnace-flame');
const furnaceResult = document.getElementById('furnace-result');

let furnaceState = { input: null, fuel: null, result: null };

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
    renderInventorySlots();
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

            img.draggable = true;
            img.dataset.source = 'hotbar';
            img.dataset.index = i;
            img.addEventListener('dragstart', (e) => {
                draggedItem = hotbarSlots[i];
                draggedElement = img;
            });
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
                // Remove from old slot if moving within inventory/hotbar
                if (draggedElement && draggedElement.dataset.source === 'inventory') {
                    const idx = parseInt(draggedElement.dataset.index);
                    inventorySlots[idx] = null;
                } else if (draggedElement && draggedElement.dataset.source === 'hotbar') {
                    const idx = parseInt(draggedElement.dataset.index);
                    hotbarSlots[idx] = null;
                } else if (draggedElement && draggedElement.dataset.source === 'crafting_result') {
                    craftingGrid.fill(null);
                    renderCraftingGrid();
                    updateCrafting();
                }

                // If dropping onto an existing item, swap them (simplified)
                if (hotbarSlots[i] && draggedElement) {
                     if (draggedElement.dataset.source === 'inventory') {
                          inventorySlots[parseInt(draggedElement.dataset.index)] = hotbarSlots[i];
                     } else if (draggedElement.dataset.source === 'hotbar') {
                          hotbarSlots[parseInt(draggedElement.dataset.index)] = hotbarSlots[i];
                     }
                }

                hotbarSlots[i] = draggedItem;
                renderHotbar();
                renderInventorySlots();
                selectHotbarSlot(activeHotbarIndex); // trigger active block update
                draggedItem = null;
                draggedElement = null;
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
    } else {
        setActiveBlock(null);
    }
}

// Setup Inventory actual slots
function renderInventorySlots() {
    inventoryItemsEl.innerHTML = '';

    // Add player's personal 3x9 grid
    for (let i = 0; i < 27; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.index = i;

        if (inventorySlots[i]) {
            const item = inventorySlots[i];
            const img = document.createElement('img');
            img.src = isoTextureCache[item] || textureCache[item];
            img.draggable = true;
            img.dataset.source = 'inventory';
            img.dataset.index = i;

            img.addEventListener('dragstart', (e) => {
                draggedItem = item;
                draggedElement = img;
            });
            slot.appendChild(img);
        }

        // Drop logic
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem) {
                // Clear original slot
                if (draggedElement && draggedElement.dataset.source === 'inventory') {
                    const idx = parseInt(draggedElement.dataset.index);
                    inventorySlots[idx] = null;
                } else if (draggedElement && draggedElement.dataset.source === 'hotbar') {
                    const idx = parseInt(draggedElement.dataset.index);
                    hotbarSlots[idx] = null;
                } else if (draggedElement && draggedElement.dataset.source === 'crafting_result') {
                    craftingGrid.fill(null);
                    renderCraftingGrid();
                    updateCrafting();
                }

                // If dropping onto an existing item, swap
                if (inventorySlots[i] && draggedElement) {
                     if (draggedElement.dataset.source === 'inventory') {
                          inventorySlots[parseInt(draggedElement.dataset.index)] = inventorySlots[i];
                     } else if (draggedElement.dataset.source === 'hotbar') {
                          hotbarSlots[parseInt(draggedElement.dataset.index)] = inventorySlots[i];
                     }
                }

                inventorySlots[i] = draggedItem;
                renderInventorySlots();
                renderHotbar();
                draggedItem = null;
                draggedElement = null;
            }
        });

        inventoryItemsEl.appendChild(slot);
    }
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

// --- Furnace Logic ---
function updateFurnaceVisuals() {
    furnaceInput.innerHTML = '';
    furnaceFuel.innerHTML = '';
    furnaceResult.innerHTML = '';

    if (furnaceState.input) {
        const img = document.createElement('img');
        img.src = isoTextureCache[furnaceState.input] || textureCache[furnaceState.input];
        img.draggable = true;
        img.dataset.source = 'furnace_input';
        img.addEventListener('dragstart', (e) => {
            draggedItem = furnaceState.input;
            draggedElement = img;
        });
        furnaceInput.appendChild(img);
    }
    if (furnaceState.fuel) {
        const img = document.createElement('img');
        img.src = isoTextureCache[furnaceState.fuel] || textureCache[furnaceState.fuel];
        img.draggable = true;
        img.dataset.source = 'furnace_fuel';
        img.addEventListener('dragstart', (e) => {
            draggedItem = furnaceState.fuel;
            draggedElement = img;
        });
        furnaceFuel.appendChild(img);
    }
    if (furnaceState.result) {
        const img = document.createElement('img');
        img.src = isoTextureCache[furnaceState.result] || textureCache[furnaceState.result];
        img.draggable = true;
        img.dataset.source = 'furnace_result';
        img.addEventListener('dragstart', (e) => {
            draggedItem = furnaceState.result;
            draggedElement = img;
            // Clear result when dragged out
            setTimeout(() => {
                furnaceState.result = null;
                updateFurnaceVisuals();
            }, 0);
        });
        furnaceResult.appendChild(img);
    }
}

function processSmelting() {
    if (!furnaceState.fuel || furnaceState.fuel !== 'coal') return;
    if (furnaceState.result) return; // Wait until result is cleared

    let res = null;
    if (furnaceState.input === 'iron_ore') res = 'iron_ingot';
    if (furnaceState.input === 'gold_ore') res = 'gold_ingot';
    if (furnaceState.input === 'sand') res = 'glass';
    if (furnaceState.input === 'cobblestone') res = 'stone';
    if (furnaceState.input === 'diamond_ore') res = 'diamond';
    if (furnaceState.input === 'wood') res = 'coal'; // Charcoal technically, mapping to coal

    if (res) {
        furnaceState.input = null; // consume input
        furnaceState.fuel = null; // consume fuel
        furnaceState.result = res;
        updateFurnaceVisuals();
    }
}

furnaceInput.addEventListener('dragover', e => e.preventDefault());
furnaceInput.addEventListener('drop', e => {
    e.preventDefault();
    if (draggedItem) {
        if (draggedElement && draggedElement.dataset.source === 'inventory') inventorySlots[parseInt(draggedElement.dataset.index)] = null;
        else if (draggedElement && draggedElement.dataset.source === 'hotbar') hotbarSlots[parseInt(draggedElement.dataset.index)] = null;
        furnaceState.input = draggedItem;
        draggedItem = null;
        renderInventorySlots();
        renderHotbar();
        updateFurnaceVisuals();
    }
});

furnaceFuel.addEventListener('dragover', e => e.preventDefault());
furnaceFuel.addEventListener('drop', e => {
    e.preventDefault();
    if (draggedItem) {
        if (draggedElement && draggedElement.dataset.source === 'inventory') inventorySlots[parseInt(draggedElement.dataset.index)] = null;
        else if (draggedElement && draggedElement.dataset.source === 'hotbar') hotbarSlots[parseInt(draggedElement.dataset.index)] = null;
        furnaceState.fuel = draggedItem;
        draggedItem = null;
        renderInventorySlots();
        renderHotbar();
        updateFurnaceVisuals();
    }
});

furnaceFlame.addEventListener('click', processSmelting);

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
    else if (shape === 'iron_ingot,iron_ingot,iron_ingot| ,stick, | ,stick, ') resultItem = 'iron_pickaxe';
    else if (shape === 'gold_ingot,gold_ingot,gold_ingot| ,stick, | ,stick, ') resultItem = 'gold_pickaxe';
    else if (shape === 'diamond,diamond,diamond| ,stick, | ,stick, ') resultItem = 'diamond_pickaxe';

    // Axes (handles left and right orientation)
    else if (shape === 'planks,planks|planks,stick| ,stick' || shape === 'planks,planks|stick,planks|stick, ') resultItem = 'wooden_axe';
    else if (shape === 'cobblestone,cobblestone|cobblestone,stick| ,stick' || shape === 'cobblestone,cobblestone|stick,cobblestone|stick, ') resultItem = 'stone_axe';
    else if (shape === 'iron_ingot,iron_ingot|iron_ingot,stick| ,stick' || shape === 'iron_ingot,iron_ingot|stick,iron_ingot|stick, ') resultItem = 'iron_axe';
    else if (shape === 'gold_ingot,gold_ingot|gold_ingot,stick| ,stick' || shape === 'gold_ingot,gold_ingot|stick,gold_ingot|stick, ') resultItem = 'gold_axe';
    else if (shape === 'diamond,diamond|diamond,stick| ,stick' || shape === 'diamond,diamond|stick,diamond|stick, ') resultItem = 'diamond_axe';

    // Furnace
    else if (shape === 'cobblestone,cobblestone,cobblestone|cobblestone, ,cobblestone|cobblestone,cobblestone,cobblestone') resultItem = 'furnace';

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
        document.getElementById('furnace-ui').style.display = 'none'; // Close furnace too
        controls.lock();
    }
}

export function toggleFurnace(controls) {
    const furnaceUI = document.getElementById('furnace-ui');
    if (furnaceUI.style.display === 'none') {
        controls.unlock();
        inventoryEl.style.display = 'block'; // Open inventory to drag from
        furnaceUI.style.display = 'block';
        isInventoryOpen = true;
    } else {
        furnaceUI.style.display = 'none';
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
    let added = false;

    // First try to add to an existing stack in the hotbar
    for (let i = 0; i < 9; i++) {
        if (hotbarSlots[i] === type) {
            // (Assuming we might implement stack counts later, for now just consuming the drop)
            added = true;
            break;
        }
    }

    // Then try empty hotbar slots
    if (!added) {
        for (let i = 0; i < 9; i++) {
            if (!hotbarSlots[i]) {
                hotbarSlots[i] = type;
                added = true;
                break;
            }
        }
    }

    // Then try to add to an existing stack in main inventory
    if (!added) {
        for (let i = 0; i < 27; i++) {
            if (inventorySlots[i] === type) {
                added = true;
                break;
            }
        }
    }

    // Then try empty main inventory slots
    if (!added) {
        for (let i = 0; i < 27; i++) {
            if (!inventorySlots[i]) {
                inventorySlots[i] = type;
                added = true;
                break;
            }
        }
    }

    if (added) {
        renderHotbar();
        renderInventorySlots();
    }

    return added; // Can be used by game.js to decide if item despawns or stays on ground
}

export function removeItemFromHotbar() {
    // If the active item is consumed
    if (hotbarSlots[activeHotbarIndex]) {
        // Without stack sizes, simply empty it
        hotbarSlots[activeHotbarIndex] = null;
        renderHotbar();
        selectHotbarSlot(activeHotbarIndex);
    }
}

// Init
preloadTextures();
