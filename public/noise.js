// Simple 2D Perlin-like noise function based on value noise
// Since we want simple procedural generation without external libraries

class SimpleNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            this.p[i] = Math.floor(Math.random() * 256);
        }
        // Duplicate array for overflow
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    grad3(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const a = this.perm[X] + Y;
        const b = this.perm[X + 1] + Y;

        const res = this.lerp(v,
            this.lerp(u, this.grad(this.perm[a], x, y), this.grad(this.perm[b], x - 1, y)),
            this.lerp(u, this.grad(this.perm[a + 1], x, y - 1), this.grad(this.perm[b + 1], x - 1, y - 1))
        );

        return (res + 1) / 2; // Normalize to 0-1
    }

    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.perm[X] + Y;
        const AA = this.perm[A] + Z;
        const AB = this.perm[A + 1] + Z;

        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B] + Z;
        const BB = this.perm[B + 1] + Z;

        const res = this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad3(this.perm[AA], x, y, z), this.grad3(this.perm[BA], x - 1, y, z)),
                this.lerp(u, this.grad3(this.perm[AB], x, y - 1, z), this.grad3(this.perm[BB], x - 1, y - 1, z))
            ),
            this.lerp(v,
                this.lerp(u, this.grad3(this.perm[AA + 1], x, y, z - 1), this.grad3(this.perm[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad3(this.perm[AB + 1], x, y - 1, z - 1), this.grad3(this.perm[BB + 1], x - 1, y - 1, z - 1))
            )
        );

        return (res + 1) / 2; // Normalize to 0-1
    }

    // FBM (Fractal Brownian Motion) for more natural terrain
    fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;  // Used for normalizing result to 0.0 - 1.0

        for(let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }
}

export const noise = new SimpleNoise(42); // fixed seed for consistency in prototype
