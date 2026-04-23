// Player class - Knight on horseback
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.vx = 0;
        this.vy = 0;
        this.speed = 4;
        this.keys = {};
        this.angle = 0;

        // Setup keyboard listeners
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    update(mapWidth, mapHeight) {
        // Reset velocity
        this.vx = 0;
        this.vy = 0;

        // Handle movement with WASD or Arrow keys
        if (this.keys['w'] || this.keys['arrowup']) {
            this.vy = -this.speed;
            this.angle = -Math.PI / 2;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.vy = this.speed;
            this.angle = Math.PI / 2;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.vx = -this.speed;
            this.angle = Math.PI;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.vx = this.speed;
            this.angle = 0;
        }

        // Diagonal movement angle adjustment
        if (this.vx !== 0 && this.vy !== 0) {
            this.vx *= 0.7;
            this.vy *= 0.7;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Boundary collision
        this.x = Math.max(0, Math.min(this.x, mapWidth - this.width));
        this.y = Math.max(0, Math.min(this.y, mapHeight - this.height));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Draw horse body
        ctx.fillStyle = '#8B4513'; // Brown
        ctx.beginPath();
        ctx.ellipse(0, 5, 20, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw horse head
        ctx.fillStyle = '#654321'; // Darker brown
        ctx.beginPath();
        ctx.ellipse(18, 0, 12, 10, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Draw horse ears
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.moveTo(22, -8);
        ctx.lineTo(26, -18);
        ctx.lineTo(24, -10);
        ctx.closePath();
        ctx.fill();

        // Draw horse mane
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(15 + i * 4, -10);
            ctx.lineTo(14 + i * 4, -18);
            ctx.stroke();
        }

        // Draw knight body
        ctx.fillStyle = '#FFD700'; // Gold armor
        ctx.fillRect(-6, -8, 12, 14);

        // Draw shield
        ctx.fillStyle = '#DC143C'; // Crimson
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-8, 10);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();

        // Draw helmet/head
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, -10, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw spear/sword
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.lineTo(15, -15);
        ctx.stroke();

        // Draw spear tip
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(15, -15);
        ctx.lineTo(17, -19);
        ctx.lineTo(18, -14);
        ctx.closePath();
        ctx.fill();

        // Draw horse legs (simple animation)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        const legOffset = Math.sin(Date.now() * 0.01) * 2;
        ctx.beginPath();
        ctx.moveTo(-8, 15);
        ctx.lineTo(-8, 28 + legOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(0, 28 - legOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(8, 15);
        ctx.lineTo(8, 28 + legOffset);
        ctx.stroke();

        ctx.restore();
    }

    getCollisionBox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    checkCollisionWithPoint(x, y, radius = 20) {
        const dx = (this.x + this.width / 2) - x;
        const dy = (this.y + this.height / 2) - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.width / 2 + radius);
    }
}
