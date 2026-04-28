// Player class - Knight on horseback with sword and gun.
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
        this.hammerAnimTotal = 12;
        this.gunAnim = 0;
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    triggerHammer(frames = 12) {
        this.hammerAnimTotal = Math.max(1, Math.floor(frames));
        this.hammerAnim = this.hammerAnimTotal;
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
        const hammerTotalFrames = Math.max(1, this.hammerAnimTotal || 12);
        const swingProgress = this.hammerAnim > 0
            ? (hammerTotalFrames - this.hammerAnim) / hammerTotalFrames
            : 0;
        const hammerSwing = this.hammerAnim > 0 ? Math.sin(swingProgress * Math.PI) * 2.2 : 0;
        const gunKick = this.gunAnim > 0 ? (this.gunAnim / 8) * 4 : 0;

        ctx.save();
        ctx.translate(center.x, center.y + yOffset);
        ctx.rotate(this.angle);
        ctx.scale(visualScale, visualScale);

        // Horse body and saddle
        ctx.fillStyle = '#8a5630';
        ctx.beginPath();
        ctx.ellipse(0, 7, 24, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#6d3f22';
        ctx.beginPath();
        ctx.ellipse(-1, 3, 18, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4b2a16';
        ctx.fillRect(-10, -2, 16, 8);

        ctx.strokeStyle = '#c8a163';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(-4, 12);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 12);
        ctx.stroke();

        // Horse head
        ctx.fillStyle = '#6b3d1f';
        ctx.beginPath();
        ctx.ellipse(21, 1, 11, 9, 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Muzzle
        ctx.fillStyle = '#4b2a16';
        ctx.beginPath();
        ctx.ellipse(27, 3, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#f7f1dc';
        ctx.beginPath();
        ctx.arc(24, -2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(24.6, -2, 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(25, -7);
        ctx.lineTo(27, -16);
        ctx.lineTo(23, -8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(21, -7);
        ctx.lineTo(22, -14);
        ctx.lineTo(19, -8);
        ctx.closePath();
        ctx.fill();

        // Mane
        ctx.strokeStyle = '#2b1a10';
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(13 + i * 4, -9);
            ctx.lineTo(12 + i * 4, -16);
            ctx.stroke();
        }

        // Tail
        ctx.strokeStyle = '#2b1a10';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-23, 6);
        ctx.quadraticCurveTo(-30, 10, -28, 20 + legOffset * 0.5);
        ctx.stroke();

        // Knight torso (armor + tabard)
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(-9, -14, 16, 18);
        ctx.fillStyle = '#c49a3a';
        ctx.fillRect(-3, -12, 5, 16);

        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(6, -8);
        ctx.moveTo(-7, -2);
        ctx.lineTo(5, -2);
        ctx.stroke();

        // Shield
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.moveTo(-13, -6);
        ctx.lineTo(-19, 2);
        ctx.lineTo(-12, 13);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#fee2e2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-12, -3);
        ctx.lineTo(-11, 9);
        ctx.moveTo(-16, 3);
        ctx.lineTo(-8, 3);
        ctx.stroke();

        // Helmet + plume
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.arc(-1, -15, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9f1239';
        ctx.beginPath();
        ctx.moveTo(-1, -20);
        ctx.quadraticCurveTo(2, -23, 5, -19);
        ctx.quadraticCurveTo(2, -17, -1, -20);
        ctx.fill();

        ctx.fillStyle = '#111827';
        ctx.fillRect(-3, -15, 4, 2);

        // Gun
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(8 - gunKick, -11);
        ctx.lineTo(24 - gunKick, -11);
        ctx.stroke();
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(10 - gunKick, -10, 5, 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(23 - gunKick, -13, 5, 5);

        // Giant Hammer
        ctx.save();
        ctx.translate(7, 0);
        ctx.rotate(Math.PI / 1 + hammerSwing);

        // Shaft (handle)
        ctx.strokeStyle = '#5b3a1f';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(4, 28);
        ctx.stroke();

        // Handle grip wrap with leather texture
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2.5;
        for (let gStep = 0; gStep < 8; gStep++) {
            ctx.beginPath();
            ctx.moveTo(-0.5, 2 + gStep * 3);
            ctx.lineTo(3.5, 2 + gStep * 3);
            ctx.stroke();
        }

        // Grip accent/binding
        ctx.strokeStyle = '#6b3a1f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-1.5, 0);
        ctx.lineTo(4.5, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-1.5, 24);
        ctx.lineTo(4.5, 24);
        ctx.stroke();

        // Pommel (larger)
        ctx.fillStyle = '#d4a574';
        ctx.beginPath();
        ctx.arc(2, -3, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b6f47';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pommel detail
        ctx.fillStyle = '#e5b896';
        ctx.beginPath();
        ctx.arc(2, -3, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Hammer head - main striking surface (rounded shape)
        ctx.fillStyle = '#a8b3bd';
        ctx.beginPath();
        // Top left curve
        ctx.moveTo(-6, 26);
        ctx.quadraticCurveTo(-9, 26, -9, 29);
        // Left side
        ctx.lineTo(-9, 37);
        // Bottom left curve
        ctx.quadraticCurveTo(-9, 40, -6, 40);
        // Bottom side
        ctx.lineTo(9, 40);
        // Bottom right curve
        ctx.quadraticCurveTo(9, 40, 9, 37);
        // Right side
        ctx.lineTo(9, 29);
        // Top right curve
        ctx.quadraticCurveTo(9, 26, 6, 26);
        ctx.closePath();
        ctx.fill();

        // Hammer head side (3D effect - bottom)
        ctx.fillStyle = '#8b9aaa';
        ctx.beginPath();
        ctx.moveTo(-9, 37);
        ctx.quadraticCurveTo(-9, 40, -6, 40);
        ctx.lineTo(9, 40);
        ctx.quadraticCurveTo(9, 40, 9, 37);
        ctx.lineTo(-9, 37);
        ctx.closePath();
        ctx.fill();

        // Hammer head shadow/depth on front (top edge)
        ctx.fillStyle = '#7a8899';
        ctx.beginPath();
        ctx.moveTo(-6, 26);
        ctx.quadraticCurveTo(-9, 26, -9, 29);
        ctx.lineTo(-9, 31);
        ctx.quadraticCurveTo(-7, 28, -6, 28);
        ctx.closePath();
        ctx.fill();

        // Hammer head crosshatch detail (forged metal)
        ctx.strokeStyle = '#6b7a8a';
        ctx.lineWidth = 1;
        for (let hx = -6; hx <= 6; hx += 3) {
            ctx.beginPath();
            ctx.moveTo(hx, 29);
            ctx.lineTo(hx, 37);
            ctx.stroke();
        }
        for (let hy = 29; hy <= 37; hy += 3) {
            ctx.beginPath();
            ctx.moveTo(-7, hy);
            ctx.lineTo(7, hy);
            ctx.stroke();
        }

        // Hammer head highlight (worn metal shine - top)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(-5, 27);
        ctx.quadraticCurveTo(-8, 27, -8, 29);
        ctx.lineTo(-8, 31);
        ctx.quadraticCurveTo(-5, 28, -5, 27);
        ctx.closePath();
        ctx.fill();

        // Hammer head highlight (mid shine)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(-5, 32);
        ctx.lineTo(5, 32);
        ctx.lineTo(5, 34);
        ctx.lineTo(-5, 34);
        ctx.closePath();
        ctx.fill();

        // Hammer head edge accent (rounded outline)
        ctx.strokeStyle = '#5a6a7a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // Top left curve
        ctx.moveTo(-6, 26);
        ctx.quadraticCurveTo(-9, 26, -9, 29);
        // Left side
        ctx.lineTo(-9, 37);
        // Bottom left curve
        ctx.quadraticCurveTo(-9, 40, -6, 40);
        // Bottom side
        ctx.lineTo(9, 40);
        // Bottom right curve
        ctx.quadraticCurveTo(9, 40, 9, 37);
        // Right side
        ctx.lineTo(9, 29);
        // Top right curve
        ctx.quadraticCurveTo(9, 26, 6, 26);
        ctx.stroke();

        ctx.restore();

        // Reins
        ctx.strokeStyle = '#e5c07b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(6, -8);
        ctx.quadraticCurveTo(13, -9, 20, -5);
        ctx.stroke();

        // Legs
        ctx.strokeStyle = '#2e2114';
        ctx.lineWidth = 2.3;
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
            ctx.fillStyle = 'rgba(255, 232, 122, 0.72)';
            ctx.beginPath();
            ctx.arc(muzzleX, muzzleY, (7 + this.gunAnim * 0.4) * visualScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 250, 200, 0.92)';
            ctx.beginPath();
            ctx.arc(muzzleX, muzzleY, (3 + this.gunAnim * 0.22) * visualScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}