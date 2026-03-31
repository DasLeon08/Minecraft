const fs = require('fs');

let code = fs.readFileSync('public/game.js', 'utf8');

// 1. Update Sky scattering for more realistic/vibrant sunsets and days
code = code.replace("skyUniforms['turbidity'].value = 10;", "skyUniforms['turbidity'].value = 8; // Clearer sky");
code = code.replace("skyUniforms['rayleigh'].value = 2;", "skyUniforms['rayleigh'].value = 1.2; // Softer atmosphere scattering");
code = code.replace("skyUniforms['mieCoefficient'].value = 0.005;", "skyUniforms['mieCoefficient'].value = 0.002; // Less haze");

// 2. Adjust Sun/Moon material color to glow harder under bloom
code = code.replace("const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffcf0, fog: false });", "const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee, fog: false }); // Brighter sun for bloom");

// 3. Improve Lighting
code = code.replace("const ambientLight = new THREE.AmbientLight(0xd9eaff, 0.45);", "const ambientLight = new THREE.AmbientLight(0xdee5ff, 0.6); // Slightly brighter, crisper ambient");
code = code.replace("const directionalLight = new THREE.DirectionalLight(0xfffaec, 2.0);", "const directionalLight = new THREE.DirectionalLight(0xfffaec, 2.5); // Brighter directional light");
code = code.replace("directionalLight.shadow.radius = 2;", "directionalLight.shadow.radius = 3; // Softer, more pleasant shadow edges");

// 4. Update WebGLRenderer and Post-processing
code = code.replace("renderer.toneMappingExposure = 1.0;", "renderer.toneMappingExposure = 1.15; // Slightly punchier exposure");

// Enhance SSAO for deeper, voxel-defining corners
code = code.replace("ssaoPass.kernelRadius = 16;", "ssaoPass.kernelRadius = 24; // Deeper ambient occlusion corners");
code = code.replace("ssaoPass.minDistance = 0.005;", "ssaoPass.minDistance = 0.003;");
code = code.replace("ssaoPass.maxDistance = 0.1;", "ssaoPass.maxDistance = 0.15;");

// Enhance Bloom for atmospheric glow
code = code.replace("bloomPass.threshold = 0.8;", "bloomPass.threshold = 0.7; // More things slightly glow (like sand in sun)");
code = code.replace("bloomPass.strength = 0.6;", "bloomPass.strength = 0.8; // Stronger dreamy glow");
code = code.replace("bloomPass.radius = 0.5;", "bloomPass.radius = 0.8; // Wider soft bloom radius");

fs.writeFileSync('public/game.js', code);
