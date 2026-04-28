/*
 Enemy Module

 Enemy implements both regular bugs and boss bugs.

 Behavior model:
 - If near player: flee
 - Otherwise: navigate toward resume sheet and damage it when in contact
 - Can be stunned by projectiles and damaged by hammer/shockwave systems

 Scaling model:
 - Size, speed, and hp are parameterized from gameplay settings
 - Boss and regular variants share logic but render differently

 Rendering model:
 - Procedural bug art (body, legs, eyes, effects)
 - Boss variant includes crown and aura visuals
 - Health bar and eating indicator are drawn in world space
*/
class Enemy {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.isBoss = Boolean(options.isBoss);
        this.upgradeTier = options.upgradeTier || 0;

        const regularSize = Number.isFinite(options.bugSize) && options.bugSize > 0 ? options.bugSize : 50;
        const bossSize = Number.isFinite(options.bugBossSize) && options.bugBossSize > 0 ? options.bugBossSize : 74;
        const regularBaseHealth = Number.isFinite(options.bugHealth) && options.bugHealth > 0 ? options.bugHealth : 3;
        const bossBaseHealth = Number.isFinite(options.bugBossHealth) && options.bugBossHealth > 0 ? options.bugBossHealth : 10;

        this.width = this.isBoss ? bossSize : regularSize;
        this.height = this.isBoss ? bossSize : regularSize;

        const regularBaseSpeed = Number.isFinite(options.bugSpeed) && options.bugSpeed > 0
            ? options.bugSpeed
            : (2.7 + this.upgradeTier * 0.2);
        const bossBaseSpeed = Number.isFinite(options.bugBossSpeed) && options.bugBossSpeed > 0
            ? options.bugBossSpeed
            : regularBaseSpeed * 1.5;
        this.baseSpeed = this.isBoss ? bossBaseSpeed : regularBaseSpeed;
        this.speed = this.baseSpeed;
        this.vx = 0;
        this.vy = 0;

        this.panicDistance = (this.isBoss ? 280 : 220) + this.upgradeTier * 10;
        this.fleeing = false;
        this.stunnedUntil = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;

        this.maxHp = (this.isBoss ? bossBaseHealth : regularBaseHealth) + this.upgradeTier;
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
        const visualScale = this.width / (this.isBoss ? 74 : 50);
        const bob = Math.sin(now * 0.01 + this.wanderAngle) * 0.8;

        ctx.save();
        ctx.translate(center.x, center.y + bob * visualScale);
        ctx.scale(visualScale, visualScale);

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 16, this.isBoss ? 26 : 20, this.isBoss ? 7 : 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.isBoss) {
            const shell = stunned ? '#6f859a' : '#b42318';
            const body = stunned ? '#8ea1b3' : '#e24634';
            const head = stunned ? '#7f94a9' : '#c73224';

            // Legs
            ctx.strokeStyle = stunned ? '#607387' : '#7a1f16';
            ctx.lineWidth = 3;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 9, 8);
                ctx.lineTo(i * 11, 18 + Math.abs(i));
                ctx.stroke();
            }

            // Body
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.ellipse(-1, 0, 24, 16, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shell plate
            ctx.fillStyle = shell;
            ctx.beginPath();
            ctx.ellipse(-4, -3, 18, 11, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = head;
            ctx.beginPath();
            ctx.ellipse(20, 1, 14, 10, 0.12, 0, Math.PI * 2);
            ctx.fill();

            // Horns
            ctx.strokeStyle = stunned ? '#a3afbf' : '#fde68a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(25, -6);
            ctx.lineTo(30, -11);
            ctx.moveTo(24, 6);
            ctx.lineTo(30, 11);
            ctx.stroke();

            // Eyes
            ctx.fillStyle = stunned ? '#c8d7e4' : '#fef08a';
            ctx.beginPath();
            ctx.arc(24, -3, 3, 0, Math.PI * 2);
            ctx.arc(24, 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.beginPath();
            ctx.arc(24.8, -3, 1.1, 0, Math.PI * 2);
            ctx.arc(24.8, 3, 1.1, 0, Math.PI * 2);
            ctx.fill();

            // Crown
            ctx.fillStyle = '#daa520';
            ctx.beginPath();
            ctx.arc(20, -12, 8.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Crown points
            ctx.fillStyle = '#ffd700';
            const crownPoints = [14, 18, 22, 26, 30];
            for (let cp = 0; cp < crownPoints.length; cp++) {
                const px = crownPoints[cp];
                ctx.beginPath();
                ctx.moveTo(px - 2.5, -12);
                ctx.lineTo(px, -20);
                ctx.lineTo(px + 2.5, -12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            // Crown inner edge
            ctx.strokeStyle = '#daa520';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(20, -12, 6, 0, Math.PI * 2);
            ctx.stroke();

            // Aura ring
            ctx.strokeStyle = stunned ? 'rgba(166, 205, 240, 0.75)' : 'rgba(251, 146, 60, 0.65)';
            ctx.lineWidth = 2.7;
            ctx.beginPath();
            ctx.ellipse(0, 0, 29, 22, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const shell = stunned ? '#70859e' : '#5f2fa8';
            const body = stunned ? '#89a1b8' : '#7b3fc9';
            const head = stunned ? '#94abc3' : '#8f4be0';

            // Legs
            ctx.strokeStyle = stunned ? '#607387' : '#41206f';
            ctx.lineWidth = 2.1;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 7, 6);
                ctx.lineTo(i * 8.5, 13 + Math.abs(i) * 0.6);
                ctx.stroke();
            }

            // Body
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shell plate
            ctx.fillStyle = shell;
            ctx.beginPath();
            ctx.ellipse(-3, -2, 13, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = head;
            ctx.beginPath();
            ctx.ellipse(13, 0, 10, 8, 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = stunned ? '#d5e4ef' : '#a3e635';
            ctx.beginPath();
            ctx.arc(18, -3, 2.2, 0, Math.PI * 2);
            ctx.arc(18, 3, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.beginPath();
            ctx.arc(18.5, -3, 0.8, 0, Math.PI * 2);
            ctx.arc(18.5, 3, 0.8, 0, Math.PI * 2);
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
        const barW = Math.max(36, this.width * 0.72);
        const pct = Math.max(0, this.hp / this.maxHp);
        const barX = center.x - barW / 2;
        const barY = center.y - this.height / 2 - 13;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(barX, barY, barW, 5);
        ctx.fillStyle = pct > 0.35 ? '#34d399' : '#f87171';
        ctx.fillRect(barX, barY, barW * pct, 5);

        if (this.eatingResume && !stunned) {
            ctx.fillStyle = '#ffd166';
            ctx.font = `bold ${Math.max(12, Math.round(12 * visualScale))}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('EATING', center.x, center.y - this.height / 2 - 18);
        }
    }
}