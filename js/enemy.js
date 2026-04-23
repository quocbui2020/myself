// Enemy class - Dragons that run away from player
class Enemy {
    constructor(x, y, isBoss = false) {
        this.x = x;
        this.y = y;
        this.width = isBoss ? 50 : 35;
        this.height = isBoss ? 50 : 35;
        this.vx = 0;
        this.vy = 0;
        this.speed = isBoss ? 2 : 3;
        this.isBoss = isBoss;
        this.angle = Math.random() * Math.PI * 2;
        this.panicDistance = isBoss ? 250 : 200;
        this.fleeing = false;
        this.fleeDirection = 0;
        this.stuckCounter = 0;
        this.lastX = x;
        this.lastY = y;
    }

    update(player, mapWidth, mapHeight, enemies) {
        // Calculate distance to player
        const dx = player.x + player.width / 2 - (this.x + this.width / 2);
        const dy = player.y + player.height / 2 - (this.y + this.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Flee from player if close enough
        if (distance < this.panicDistance) {
            this.fleeing = true;
            // Run away from player
            const fleeAngle = Math.atan2(dy, dx);
            this.fleeDirection = fleeAngle + Math.PI; // Opposite direction
            this.vx = Math.cos(this.fleeDirection) * this.speed;
            this.vy = Math.sin(this.fleeDirection) * this.speed;
        } else {
            this.fleeing = false;
            // Wander around randomly when not fleeing
            if (Math.random() < 0.02) {
                this.angle = Math.random() * Math.PI * 2;
                this.vx = Math.cos(this.angle) * (this.speed * 0.5);
                this.vy = Math.sin(this.angle) * (this.speed * 0.5);
            }
        }

        // Check if stuck (not moving due to obstacles/boundaries)
        if (Math.abs(this.x - this.lastX) < 0.5 && Math.abs(this.y - this.lastY) < 0.5) {
            this.stuckCounter++;
            if (this.stuckCounter > 20) {
                this.angle = Math.random() * Math.PI * 2;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
                this.stuckCounter = 0;
            }
        } else {
            this.stuckCounter = 0;
        }

        // Update position
        this.lastX = this.x;
        this.lastY = this.y;

        this.x += this.vx;
        this.y += this.vy;

        // Boundary collision with bouncing
        if (this.x <= 0 || this.x + this.width >= mapWidth) {
            this.vx *= -0.8;
            this.x = Math.max(0, Math.min(this.x, mapWidth - this.width));
        }
        if (this.y <= 0 || this.y + this.height >= mapHeight) {
            this.vy *= -0.8;
            this.y = Math.max(0, Math.min(this.y, mapHeight - this.height));
        }

        // Collision with other enemies
        for (let other of enemies) {
            if (other !== this) {
                const ex = other.x + other.width / 2;
                const ey = other.y + other.height / 2;
                const mx = this.x + this.width / 2;
                const my = this.y + this.height / 2;
                const edx = ex - mx;
                const edy = ey - my;
                const edist = Math.sqrt(edx * edx + edy * edy);
                const minDist = (this.width + other.width) / 2;

                if (edist < minDist) {
                    // Separate enemies
                    const angle = Math.atan2(edy, edx);
                    this.x -= Math.cos(angle) * (minDist - edist) / 2;
                    this.y -= Math.sin(angle) * (minDist - edist) / 2;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        if (this.isBoss) {
            // Draw boss dragon
            // Body
            ctx.fillStyle = '#FF4500'; // Orange-red
            ctx.beginPath();
            ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
            ctx.fill();

            // Boss glow effect
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, 25, 20, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Head
            ctx.fillStyle = '#CC3300';
            ctx.beginPath();
            ctx.ellipse(18, 0, 13, 11, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Eyes (glowing)
            ctx.fillStyle = '#FFFF00';
            ctx.beginPath();
            ctx.arc(24, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(24, 4, 3, 0, Math.PI * 2);
            ctx.fill();

            // Teeth
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(23 + i * 3, -2, 2, 4);
            }

            // Wings
            ctx.fillStyle = 'rgba(139, 0, 0, 0.7)';
            ctx.beginPath();
            ctx.moveTo(-5, -10);
            ctx.lineTo(-20, -20);
            ctx.lineTo(-15, -5);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(5, -10);
            ctx.lineTo(20, -20);
            ctx.lineTo(15, -5);
            ctx.closePath();
            ctx.fill();

            // Tail
            ctx.strokeStyle = '#CC3300';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.quadraticCurveTo(-30, 5, -35, 0);
            ctx.stroke();

            // Spikes
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(-5 + i * 4, -15);
                ctx.lineTo(-5 + i * 4, -22);
                ctx.stroke();
            }
        } else {
            // Draw regular dragon
            // Body
            ctx.fillStyle = '#8B008B'; // Dark magenta
            ctx.beginPath();
            ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = '#9932CC'; // Dark orchid
            ctx.beginPath();
            ctx.ellipse(14, 0, 10, 8, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#00FF00';
            ctx.beginPath();
            ctx.arc(20, -3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(20, 3, 2, 0, Math.PI * 2);
            ctx.fill();

            // Nostrils
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(23, -2, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(23, 2, 1, 0, Math.PI * 2);
            ctx.fill();

            // Wings
            ctx.fillStyle = 'rgba(153, 50, 204, 0.6)';
            ctx.beginPath();
            ctx.moveTo(-3, -8);
            ctx.lineTo(-15, -15);
            ctx.lineTo(-10, -3);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(3, -8);
            ctx.lineTo(15, -15);
            ctx.lineTo(10, -3);
            ctx.closePath();
            ctx.fill();

            // Tail
            ctx.strokeStyle = '#9932CC';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-16, 0);
            ctx.quadraticCurveTo(-24, 4, -28, 0);
            ctx.stroke();

            // Spikes
            ctx.strokeStyle = '#9932CC';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(-3 + i * 5, -12);
                ctx.lineTo(-3 + i * 5, -18);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    checkCollisionWithPoint(x, y, radius = 15) {
        const dx = (this.x + this.width / 2) - x;
        const dy = (this.y + this.height / 2) - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.width / 2 + radius);
    }
}
