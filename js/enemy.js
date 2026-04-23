// Enemy class - Dragons that flee, can be stunned, and require hammer hits.
class Enemy {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.isBoss = Boolean(options.isBoss);
        this.upgradeTier = options.upgradeTier || 0;

        this.width = this.isBoss ? 74 : 50;
        this.height = this.isBoss ? 74 : 50;

        this.baseSpeed = (this.isBoss ? 2.1 : 2.7) + this.upgradeTier * 0.2;
        this.speed = this.baseSpeed;
        this.vx = 0;
        this.vy = 0;

        this.panicDistance = (this.isBoss ? 280 : 220) + this.upgradeTier * 10;
        this.fleeing = false;
        this.stunnedUntil = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;

        this.maxHp = (this.isBoss ? 10 : 3) + this.upgradeTier;
        this.hp = this.maxHp;
        this.eatingResume = false;
        this.eatDps = (this.isBoss ? 6 : 2.2) + this.upgradeTier * 0.8;
    }

    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    isStunned(now) {
        return now < this.stunnedUntil;
    }

    stun(durationMs, now) {
        this.stunnedUntil = Math.max(this.stunnedUntil, now + durationMs);
    }

    applyDamage(amount) {
        this.hp -= amount;
        return this.hp <= 0;
    }

    update(now, player, mapWidth, mapHeight, enemies, resumeRect) {
        this.eatingResume = false;

        if (this.isStunned(now)) {
            this.vx *= 0.84;
            this.vy *= 0.84;
        } else {
            const playerCenter = player.getCenter();
            const myCenter = this.getCenter();
            const dx = playerCenter.x - myCenter.x;
            const dy = playerCenter.y - myCenter.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.panicDistance) {
                this.fleeing = true;
                const fleeAngle = Math.atan2(dy, dx) + Math.PI;
                this.vx = Math.cos(fleeAngle) * this.speed;
                this.vy = Math.sin(fleeAngle) * this.speed;
            } else {
                this.fleeing = false;

                const targetX = Math.max(resumeRect.x, Math.min(myCenter.x, resumeRect.x + resumeRect.width));
                const targetY = Math.max(resumeRect.y, Math.min(myCenter.y, resumeRect.y + resumeRect.height));
                const tx = targetX - myCenter.x;
                const ty = targetY - myCenter.y;
                const tDist = Math.sqrt(tx * tx + ty * ty);

                if (tDist < 18) {
                    this.eatingResume = true;
                    this.vx *= 0.6;
                    this.vy *= 0.6;
                } else {
                    this.vx = (tx / Math.max(1, tDist)) * this.speed * 0.85;
                    this.vy = (ty / Math.max(1, tDist)) * this.speed * 0.85;
                }
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.x <= 0 || this.x + this.width >= mapWidth) {
            this.vx *= -0.9;
            this.x = Math.max(0, Math.min(this.x, mapWidth - this.width));
        }
        if (this.y <= 0 || this.y + this.height >= mapHeight) {
            this.vy *= -0.9;
            this.y = Math.max(0, Math.min(this.y, mapHeight - this.height));
        }

        for (const other of enemies) {
            if (other === this) continue;
            const a = this.getCenter();
            const b = other.getCenter();
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = (this.width + other.width) * 0.45;
            if (dist > 0 && dist < minDist) {
                const push = (minDist - dist) * 0.25;
                this.x -= (dx / dist) * push;
                this.y -= (dy / dist) * push;
            }
        }
    }

    draw(ctx, now) {
        const center = this.getCenter();
        const stunned = this.isStunned(now);

        ctx.save();
        ctx.translate(center.x, center.y);

        if (this.isBoss) {
            ctx.fillStyle = stunned ? '#8da4be' : '#d6461f';
            ctx.beginPath();
            ctx.ellipse(0, 0, 21, 16, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = stunned ? '#7f91a5' : '#bf2f0f';
            ctx.beginPath();
            ctx.ellipse(18, 0, 14, 10, 0.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f4d03f';
            ctx.beginPath();
            ctx.arc(23, -4, 3, 0, Math.PI * 2);
            ctx.arc(23, 4, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = stunned ? 'rgba(165, 195, 224, 0.85)' : 'rgba(255, 183, 77, 0.65)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, 28, 22, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = stunned ? '#8aa0b6' : '#7b3fc9';
            ctx.beginPath();
            ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = stunned ? '#90a6bc' : '#8f4be0';
            ctx.beginPath();
            ctx.ellipse(13, 0, 10, 8, 0.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#93f06b';
            ctx.beginPath();
            ctx.arc(18, -3, 2, 0, Math.PI * 2);
            ctx.arc(18, 3, 2, 0, Math.PI * 2);
            ctx.fill();

            if (stunned) {
                ctx.strokeStyle = 'rgba(166, 205, 240, 0.85)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        ctx.restore();

        // Health bar
        const barW = 36;
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(center.x - barW / 2, center.y - this.height / 2 - 12, barW, 5);
        ctx.fillStyle = pct > 0.35 ? '#67d183' : '#e16565';
        ctx.fillRect(center.x - barW / 2, center.y - this.height / 2 - 12, barW * pct, 5);

        if (this.eatingResume && !stunned) {
            ctx.fillStyle = '#ffd166';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('EATING', center.x, center.y - this.height / 2 - 16);
        }
    }
}