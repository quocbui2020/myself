// Player class - Knight on horseback with hammer and gun.
class Player {
    constructor(x, y, options = {}) {
        const size = Number.isFinite(options.size) && options.size > 0 ? options.size : 64;
        const speed = Number.isFinite(options.speed) && options.speed > 0 ? options.speed : 20.0;
        this.x = x;
        this.y = y;
        this.width = size;
        this.height = Math.max(44, size * 0.9);
        this.speed = speed;
        this.targetX = x;
        this.targetY = y;
        this.angle = 0;
        this.hammerAnim = 0;
        this.gunAnim = 0;
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    triggerHammer() {
        this.hammerAnim = 12;
    }

    triggerGun() {
        this.gunAnim = 8;
    }

    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    update(mapWidth, mapHeight) {
        const center = this.getCenter();
        const dx = this.targetX - center.x;
        const dy = this.targetY - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1.5) {
            this.angle = Math.atan2(dy, dx);
            const step = Math.min(this.speed, distance);
            this.x += Math.cos(this.angle) * step;
            this.y += Math.sin(this.angle) * step;
        }

        this.hammerAnim = Math.max(0, this.hammerAnim - 1);
        this.gunAnim = Math.max(0, this.gunAnim - 1);

        this.x = Math.max(0, Math.min(this.x, mapWidth - this.width));
        this.y = Math.max(0, Math.min(this.y, mapHeight - this.height));
    }

    draw(ctx, yOffset = 0) {
        const center = this.getCenter();
        const visualScale = this.width / 64;
        const legOffset = Math.sin(Date.now() * 0.02) * 2;
        const hammerSwing = this.hammerAnim > 0 ? Math.sin((12 - this.hammerAnim) * 0.5) * 1.2 : 0;
        const gunKick = this.gunAnim > 0 ? (this.gunAnim / 8) * 4 : 0;

        ctx.save();
        ctx.translate(center.x, center.y + yOffset);
        ctx.rotate(this.angle);
        ctx.scale(visualScale, visualScale);

        // Horse body
        ctx.fillStyle = '#7a4a24';
        ctx.beginPath();
        ctx.ellipse(0, 6, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Horse head
        ctx.fillStyle = '#5f3718';
        ctx.beginPath();
        ctx.ellipse(20, 1, 11, 9, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(25, -7);
        ctx.lineTo(27, -16);
        ctx.lineTo(23, -8);
        ctx.closePath();
        ctx.fill();

        // Mane
        ctx.strokeStyle = '#2d1b11';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(13 + i * 4, -9);
            ctx.lineTo(12 + i * 4, -16);
            ctx.stroke();
        }

        // Knight torso
        ctx.fillStyle = '#cba84a';
        ctx.fillRect(-8, -12, 14, 16);

        // Shield
        ctx.fillStyle = '#bd2b2b';
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(-16, 2);
        ctx.lineTo(-10, 11);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#d6b34f';
        ctx.beginPath();
        ctx.arc(-1, -14, 5, 0, Math.PI * 2);
        ctx.fill();

        // Gun
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(8 - gunKick, -10);
        ctx.lineTo(22 - gunKick, -10);
        ctx.stroke();
        ctx.fillStyle = '#8b929b';
        ctx.fillRect(21 - gunKick, -12, 5, 4);

        // Hammer
        ctx.save();
        ctx.translate(6, 1);
        ctx.rotate(hammerSwing - 0.45);
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(12, 12);
        ctx.stroke();
        ctx.fillStyle = '#a1a1aa';
        ctx.fillRect(10, 10, 10, 6);
        ctx.restore();

        // Legs
        ctx.strokeStyle = '#2e2114';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 15);
        ctx.lineTo(-9, 27 + legOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(1, 15);
        ctx.lineTo(1, 27 - legOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(9, 15);
        ctx.lineTo(9, 27 + legOffset);
        ctx.stroke();

        ctx.restore();

        // Gun muzzle flash
        if (this.gunAnim > 0) {
            const muzzleX = center.x + Math.cos(this.angle) * 26 * visualScale;
            const muzzleY = center.y + Math.sin(this.angle) * 26 * visualScale;
            ctx.save();
            ctx.fillStyle = 'rgba(255, 230, 120, 0.65)';
            ctx.beginPath();
            ctx.arc(muzzleX, muzzleY, (7 + this.gunAnim * 0.4) * visualScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}