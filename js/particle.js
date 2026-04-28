/*
 Particle Module

 Lightweight particle effects used by game.js for combat and feedback cues.

 Design notes:
 - Particle: one visual point with velocity, gravity, and life decay
 - ParticleSystem: pooled list with helper emitters (explosion/catch/damage)
 - update() and draw() are called once per frame by Game
*/
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life--;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (this.life / this.maxLife), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isAlive() {
        return this.life > 0;
    }
}

class ParticleSystem {
    constructor() {
        // Flat list is sufficient here and keeps update/draw cache-friendly.
        this.particles = [];
    }

    createExplosion(x, y, count = 12, color = '#FFD700') {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 3 + Math.random() * 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = 20 + Math.random() * 20;
            this.particles.push(new Particle(x, y, vx, vy, color, life));
        }
    }

    createCatch(x, y) {
        this.createExplosion(x, y, 15, '#4CAF50');
    }

    createDamage(x, y) {
        this.createExplosion(x, y, 10, '#FF4444');
    }

    update() {
        this.particles = this.particles.filter(p => {
            p.update();
            return p.isAlive();
        });
    }

    draw(ctx) {
        for (let particle of this.particles) {
            particle.draw(ctx);
        }
    }

    clear() {
        this.particles = [];
    }
}
