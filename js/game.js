// Main game logic
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.cameraX = 0;
        this.cameraY = 0;
        this.renderOffsetX = 0;
        this.renderOffsetY = 0;
        this.cameraDeadzoneX = 0;
        this.cameraDeadzoneY = 0;

        // Keep world dimensions fixed regardless of browser zoom or viewport size.
        this.fixedWorldWidth = 1600;
        this.fixedWorldHeight = 1200;
        this.preStartWheelOffsetX = 0;
        this.preStartWheelOffsetY = 0;

        this.currentFloor = 1;
        this.currentEnemies = [];
        this.defeatedThisFloor = 0;
        this.totalDefeated = 0;
        this.floorTransitionTicks = 0;

        this.mouseX = 0;
        this.mouseY = 0;
        this.projectiles = [];
        this.cracks = [];
        this.torePapers = [];

        this.lastHammerTime = 0;
        this.hammerCooldownMs = 220;
        this.hammerRange = 90;
        this.hammerDamage = 1;
        this.stunMs = 2200;
        this.resumeHealth = 100;
        this.resumeRect = { x: 0, y: 0, width: 0, height: 0 };
        this.gameStarted = false;
        this.acceptButtonRect = null;
        this.resumeData = this.getEmbeddedResumeData() || this.getCachedResumeData();
        this.resumeLoadError = false;
        this.hudState = {
            floorLevel: '1',
            caughtCount: '--',
            progressPct: 0,
            resumeHpText: '100%',
            resumeHpPct: 100,
            status: 'Review the resume first, then click or tap the yellow button to accept the quest.'
        };

        this.deskImage = new Image();
        this.deskImageLoaded = false;
        this.deskImage.onload = () => {
            this.deskImageLoaded = true;
        };
        this.deskImage.src = 'images/desk-texture.svg';
        this.loadResumeData();

        // Touch tracking for swipe and pinch gestures
        this.touchState = {
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isActive: false,
            touchCount: 0,
            lastDistance: 0
        };

        this.particles = new ParticleSystem();

        this.resizeCanvas();
        this.player = new Player(this.worldWidth * 0.5, this.worldHeight * 0.5);
        this.player.setTarget(this.worldWidth * 0.5, this.worldHeight * 0.5);
        this.centerCameraOnPlayer();

        this.bindEvents();
        this.applyGameStartedVisualState();
        this.updateHud();
        this.gameLoop();
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());

        this.canvas.addEventListener('mousemove', (event) => {
            const pos = this.getMousePosition(event);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            const worldPos = this.screenToWorld(pos.x, pos.y);
            this.player.setTarget(worldPos.x, worldPos.y);
            this.updateAimRing();
        });

        this.canvas.addEventListener('mousedown', (event) => {
            if (event.button === 0) {
                const pos = this.getMousePosition(event);
                const worldPos = this.screenToWorld(pos.x, pos.y);

                if (!this.gameStarted && this.acceptButtonRect && this.isPointInRect(worldPos, this.acceptButtonRect)) {
                    this.startGame();
                    return;
                }

                if (this.gameStarted) {
                    this.swingHammer(event);
                }
            }
        });

        this.canvas.addEventListener('wheel', (event) => {
            // Preserve browser zoom shortcuts (Ctrl + wheel).
            if (event.ctrlKey) return;
            if (this.gameStarted) return;
            event.preventDefault();
            this.preStartWheelOffsetY += event.deltaY;
        }, { passive: false });

        // Touch events for mobile controls
        this.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            if (event.touches.length > 0) {
                const touch = event.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.touchState.startX = touch.clientX - rect.left;
                this.touchState.startY = touch.clientY - rect.top;
                this.touchState.currentX = this.touchState.startX;
                this.touchState.currentY = this.touchState.startY;
                this.touchState.isActive = true;
                this.touchState.touchCount = event.touches.length;
                
                // For 2-finger pinch, record initial distance
                if (event.touches.length === 2) {
                    const touch2 = event.touches[1];
                    const x2 = touch2.clientX - rect.left;
                    const y2 = touch2.clientY - rect.top;
                    this.touchState.lastDistance = Math.hypot(
                        this.touchState.startX - x2,
                        this.touchState.startY - y2
                    );
                }

                // Check for quest button tap (pre-game)
                if (!this.gameStarted && this.acceptButtonRect) {
                    const worldPos = this.screenToWorld(this.touchState.startX, this.touchState.startY);
                    if (this.isPointInRect(worldPos, this.acceptButtonRect)) {
                        this.startGame();
                        return;
                    }
                }

                // Hammer attack on tap (in-game)
                if (this.gameStarted && event.touches.length === 1) {
                    const now = performance.now();
                    if (now - this.lastHammerTime >= this.hammerCooldownMs) {
                        const worldPos = this.screenToWorld(this.touchState.startX, this.touchState.startY);
                        this.swingHammerAt(worldPos.x, worldPos.y);
                    }
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (event) => {
            event.preventDefault();
            if (event.touches.length > 0) {
                const rect = this.canvas.getBoundingClientRect();
                const touch = event.touches[0];
                this.touchState.currentX = touch.clientX - rect.left;
                this.touchState.currentY = touch.clientY - rect.top;
                this.touchState.touchCount = event.touches.length;

                // Handle swipe movement (single touch)
                if (event.touches.length === 1) {
                    if (!this.gameStarted) {
                        // Pre-game: swipe to scroll the resume (push semantics)
                        // Swipe up (negative deltaY) = scroll down (positive offset)
                        // Swipe down (positive deltaY) = scroll up (negative offset)
                        // Swipe left (negative deltaX) = scroll right (positive offset)
                        // Swipe right (positive deltaX) = scroll left (negative offset)
                        const deltaY = this.touchState.currentY - this.touchState.startY;
                        const deltaX = this.touchState.currentX - this.touchState.startX;
                        
                        // Apply vertical scroll (Y axis)
                        this.preStartWheelOffsetY -= deltaY * 0.5; // sensitivity factor
                        
                        // Apply horizontal scroll (X axis)
                        this.preStartWheelOffsetX -= deltaX * 0.5; // sensitivity factor
                        
                        const maxCameraX = Math.max(0, this.worldWidth - this.width);
                        const maxCameraY = Math.max(0, this.worldHeight - this.height);
                        this.preStartWheelOffsetX = Math.max(0, Math.min(this.preStartWheelOffsetX, maxCameraX));
                        this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));
                    } else {
                        // In-game: swipe to move player (cursor follows touch)
                        const worldPos = this.screenToWorld(this.touchState.currentX, this.touchState.currentY);
                        this.player.setTarget(worldPos.x, worldPos.y);
                        this.mouseX = this.touchState.currentX;
                        this.mouseY = this.touchState.currentY;
                        this.updateAimRing();
                    }
                }
                
                // Handle pinch zoom (two fingers)
                if (event.touches.length === 2) {
                    const touch2 = event.touches[1];
                    const x2 = touch2.clientX - rect.left;
                    const y2 = touch2.clientY - rect.top;
                    const currentDistance = Math.hypot(
                        this.touchState.currentX - x2,
                        this.touchState.currentY - y2
                    );

                    if (this.touchState.lastDistance > 0) {
                        const deltaDist = currentDistance - this.touchState.lastDistance;
                        const sensitivity = 2; // Adjust for zoom speed
                        
                        if (!this.gameStarted) {
                            // Pre-game: use pinch to scroll resume
                            // Pinch in (fingers closer, deltaDist negative) = zoom out = scroll down (increase offset)
                            // Pinch out (fingers apart, deltaDist positive) = zoom in = scroll up (decrease offset)
                            this.preStartWheelOffsetY -= deltaDist * sensitivity;
                            const maxCameraY = Math.max(0, this.worldHeight - this.height);
                            this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));
                        } else {
                            // In-game: pinch could zoom camera (future enhancement)
                            // For now, just track it
                        }
                    }
                    this.touchState.lastDistance = currentDistance;
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.touchState.isActive = false;
            this.touchState.touchCount = 0;
            this.touchState.lastDistance = 0;
        }, { passive: false });

        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'r') {
                event.preventDefault();
                this.resetGame();
            } else if (key === 'b') {
                event.preventDefault();
                window.history.back();
            }
        });
    }

    async loadResumeData() {
        try {
            const response = await fetch(`resume.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('resume.json not reachable');
            this.resumeData = await response.json();
            this.resumeLoadError = false;
            try {
                localStorage.setItem('resumeDataCache', JSON.stringify(this.resumeData));
            } catch (_) {
                // Ignore storage failures (private mode / storage disabled).
            }
        } catch (_) {
            if (!this.resumeData) {
                this.resumeData = this.getEmbeddedResumeData() || this.getCachedResumeData();
            }
            this.resumeLoadError = !this.resumeData;
        }
    }

    getEmbeddedResumeData() {
        try {
            const node = document.getElementById('embeddedResumeData');
            if (!node) return null;
            return JSON.parse(node.textContent || 'null');
        } catch (_) {
            return null;
        }
    }

    getCachedResumeData() {
        try {
            const raw = localStorage.getItem('resumeDataCache');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    updateAimRing() {
        const ring = document.getElementById('aimRing');
        if (!ring) return;

        if (!this.gameStarted) {
            ring.style.display = 'none';
            return;
        }

        ring.style.display = 'block';
        ring.style.left = `${this.mouseX}px`;
        ring.style.top = `${this.mouseY}px`;
    }

    applyGameStartedVisualState() {
        const ring = document.getElementById('aimRing');
        if (this.gameStarted) {
            this.canvas.style.cursor = 'none';
            if (ring) ring.style.display = 'block';
        } else {
            this.canvas.style.cursor = 'default';
            if (ring) ring.style.display = 'none';
        }
    }

    resizeCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.worldWidth = this.fixedWorldWidth;
        this.worldHeight = this.fixedWorldHeight;
        this.cameraDeadzoneX = this.width * 0.22;
        this.cameraDeadzoneY = this.height * 0.2;
        this.updateResumeRect();

        if (this.player) {
            this.player.x = Math.min(this.player.x, this.worldWidth - this.player.width);
            this.player.y = Math.min(this.player.y, this.worldHeight - this.player.height);
            this.player.x = Math.max(0, this.player.x);
            this.player.y = Math.max(0, this.player.y);
        }

        for (const enemy of this.currentEnemies) {
            enemy.x = Math.min(enemy.x, this.worldWidth - enemy.width);
            enemy.y = Math.min(enemy.y, this.worldHeight - enemy.height);
            enemy.x = Math.max(0, enemy.x);
            enemy.y = Math.max(0, enemy.y);
        }

        this.updateCamera();
    }

    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.cameraX - this.renderOffsetX,
            y: screenY + this.cameraY - this.renderOffsetY
        };
    }

    updateCamera() {
        if (!this.player) {
            this.cameraX = 0;
            this.cameraY = 0;
            return;
        }

        const maxCameraX = Math.max(0, this.worldWidth - this.width);
        const maxCameraY = Math.max(0, this.worldHeight - this.height);

        // Before the quest starts, keep navigation document-like:
        // allow both horizontal and vertical scrolling via swipe/wheel.
        if (!this.gameStarted) {
            this.preStartWheelOffsetX = Math.max(0, Math.min(this.preStartWheelOffsetX, maxCameraX));
            this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));
            this.cameraX = this.preStartWheelOffsetX;
            this.cameraY = this.preStartWheelOffsetY;

            this.renderOffsetX = this.width > this.worldWidth ? (this.width - this.worldWidth) * 0.5 : 0;
            this.renderOffsetY = this.height > this.worldHeight ? (this.height - this.worldHeight) * 0.5 : 0;
            return;
        }

        const center = this.player.getCenter();

        const playerScreenX = center.x - this.cameraX;
        const playerScreenY = center.y - this.cameraY;

        if (playerScreenX < this.cameraDeadzoneX) {
            this.cameraX = center.x - this.cameraDeadzoneX;
        } else if (playerScreenX > this.width - this.cameraDeadzoneX) {
            this.cameraX = center.x - (this.width - this.cameraDeadzoneX);
        }

        if (playerScreenY < this.cameraDeadzoneY) {
            this.cameraY = center.y - this.cameraDeadzoneY;
        } else if (playerScreenY > this.height - this.cameraDeadzoneY) {
            this.cameraY = center.y - (this.height - this.cameraDeadzoneY);
        }

        this.cameraX = Math.max(0, Math.min(this.cameraX, maxCameraX));
        this.cameraY = Math.max(0, Math.min(this.cameraY, maxCameraY));

        this.renderOffsetX = this.width > this.worldWidth ? (this.width - this.worldWidth) * 0.5 : 0;
        this.renderOffsetY = this.height > this.worldHeight ? (this.height - this.worldHeight) * 0.5 : 0;
    }

    centerCameraOnPlayer() {
        if (!this.player) return;
        const center = this.player.getCenter();
        this.cameraX = center.x - this.width / 2;
        this.cameraY = center.y - this.height / 2;
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - this.width));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - this.height));
    }

    updateResumeRect() {
        const pageW = Math.min(760, this.worldWidth * 0.52);
        const pageH = Math.min(1040, this.worldHeight * 0.82);
        const x = (this.worldWidth - pageW) / 2;
        const y = (this.worldHeight - pageH) / 2;
        this.resumeRect = { x, y, width: pageW, height: pageH };
    }

    getEnemyCountForFloor(floor) {
        if (floor === 1) return 2;
        if (floor === 2) return 4;
        if (floor === 3) return 6;
        return Math.min(6, floor + 3);
    }

    getUpgradeTier(floor) {
        return Math.floor((floor - 1) / 10);
    }

    spawnFloorEnemies() {
        this.currentEnemies = [];
        this.defeatedThisFloor = 0;
        // NOTE: resumeHealth does NOT reset on floor transition - only on game restart

        const count = this.getEnemyCountForFloor(this.currentFloor);
        const tier = this.getUpgradeTier(this.currentFloor);
        const bossIndex = this.currentFloor % 10 === 0 ? count - 1 : -1;

        for (let i = 0; i < count; i++) {
            const isBoss = i === bossIndex;
            let x = 0;
            let y = 0;
            let attempts = 0;
            do {
                x = Math.random() * (this.worldWidth - 120) + 60;
                y = Math.random() * (this.worldHeight - 120) + 60;
                attempts++;
            } while (this.distance(x, y, this.player.x, this.player.y) < 180 && attempts < 25);

            this.currentEnemies.push(new Enemy(x, y, { isBoss, upgradeTier: tier }));
        }
    }

    shootGun(event) {
        const pos = this.getMousePosition(event);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        const worldPos = this.screenToWorld(pos.x, pos.y);
        this.player.setTarget(worldPos.x, worldPos.y);
        this.player.triggerGun();

        const center = this.player.getCenter();
        const dx = worldPos.x - center.x;
        const dy = worldPos.y - center.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 11;

        this.projectiles.push({
            x: center.x + (dx / len) * 24,
            y: center.y + (dy / len) * 24,
            vx: (dx / len) * speed,
            vy: (dy / len) * speed,
            life: 60,
            radius: 5
        });

        this.particles.createExplosion(center.x, center.y, 8, '#ffdca8');
    }

    swingHammer(event) {
        const now = performance.now();
        if (now - this.lastHammerTime < this.hammerCooldownMs) return;
        this.lastHammerTime = now;

        const pos = this.getMousePosition(event);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        const worldPos = this.screenToWorld(pos.x, pos.y);
        this.player.setTarget(worldPos.x, worldPos.y);
        this.player.triggerHammer();

        const center = this.player.getCenter();
        const dirX = worldPos.x - center.x;
        const dirY = worldPos.y - center.y;
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const impactX = center.x + (dirX / dirLen) * 60;
        const impactY = center.y + (dirY / dirLen) * 60;

        this.addCrack(impactX, impactY);
        this.particles.createExplosion(impactX, impactY, 12, '#dbeafe');

        for (let i = this.currentEnemies.length - 1; i >= 0; i--) {
            const enemy = this.currentEnemies[i];
            const e = enemy.getCenter();
            const d = this.distance(impactX, impactY, e.x, e.y);
            if (d <= this.hammerRange) {
                const dead = enemy.applyDamage(this.hammerDamage);
                this.particles.createDamage(e.x, e.y);
                if (dead) {
                    this.currentEnemies.splice(i, 1);
                    this.defeatedThisFloor++;
                    this.totalDefeated++;
                    this.particles.createCatch(e.x, e.y);
                }
            }
        }
    }

    swingHammerAt(worldX, worldY) {
        const now = performance.now();
        if (now - this.lastHammerTime < this.hammerCooldownMs) return;
        this.lastHammerTime = now;

        this.player.setTarget(worldX, worldY);
        this.player.triggerHammer();

        const center = this.player.getCenter();
        const dirX = worldX - center.x;
        const dirY = worldY - center.y;
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const impactX = center.x + (dirX / dirLen) * 60;
        const impactY = center.y + (dirY / dirLen) * 60;

        this.addCrack(impactX, impactY);
        this.particles.createExplosion(impactX, impactY, 12, '#dbeafe');

        for (let i = this.currentEnemies.length - 1; i >= 0; i--) {
            const enemy = this.currentEnemies[i];
            const e = enemy.getCenter();
            const d = this.distance(impactX, impactY, e.x, e.y);
            if (d <= this.hammerRange) {
                const dead = enemy.applyDamage(this.hammerDamage);
                this.particles.createDamage(e.x, e.y);
                if (dead) {
                    this.currentEnemies.splice(i, 1);
                    this.defeatedThisFloor++;
                    this.totalDefeated++;
                    this.particles.createCatch(e.x, e.y);
                }
            }
        }
    }

    addCrack(x, y) {
        const branches = [];
        const branchCount = 8 + Math.floor(Math.random() * 4);
        for (let i = 0; i < branchCount; i++) {
            const angle = (Math.PI * 2 * i) / branchCount + (Math.random() - 0.5) * 0.45;
            const length = 40 + Math.random() * 70;
            const segments = 5 + Math.floor(Math.random() * 3);
            const points = [{ x, y }];
            for (let s = 1; s <= segments; s++) {
                const t = s / segments;
                const jitter = (Math.random() - 0.5) * 10;
                points.push({
                    x: x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI / 2) * jitter,
                    y: y + Math.sin(angle) * length * t + Math.sin(angle + Math.PI / 2) * jitter
                });
            }
            branches.push(points);
        }

        this.cracks.push({ branches, life: 240 });
        if (this.cracks.length > 180) {
            this.cracks.shift();
        }
    }

    addTornPaper(x, y) {
        const size = 8 + Math.random() * 16;
        const rotation = Math.random() * Math.PI * 2;
        const decay = 300 + Math.random() * 200;
        this.torePapers.push({
            x,
            y,
            size,
            rotation,
            life: decay,
            maxLife: decay,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -0.5 - Math.random() * 1.2
        });
    }

    updateProjectiles(now) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const bullet = this.projectiles[i];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.life -= 1;

            let hitEnemy = false;
            for (const enemy of this.currentEnemies) {
                const e = enemy.getCenter();
                if (this.distance(bullet.x, bullet.y, e.x, e.y) < enemy.width * 0.5 + bullet.radius) {
                    enemy.stun(this.stunMs, now);
                    this.particles.createExplosion(e.x, e.y, 8, '#93c5fd');
                    hitEnemy = true;
                    break;
                }
            }

            const out = bullet.x < 0 || bullet.x > this.worldWidth || bullet.y < 0 || bullet.y > this.worldHeight;
            if (hitEnemy || out || bullet.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    update() {
        const now = performance.now();

        // Keep camera navigation responsive before quest acceptance by letting
        // the hidden player continue following the cursor target.
        this.player.update(this.worldWidth, this.worldHeight);

        if (!this.gameStarted) {
            this.particles.update();
            this.updateCamera();
            this.updateHud();
            return;
        }

        this.updateProjectiles(now);

        let dpsFromEnemies = 0;
        for (const enemy of this.currentEnemies) {
            enemy.update(now, this.player, this.worldWidth, this.worldHeight, this.currentEnemies, this.resumeRect);
            if (enemy.eatingResume) {
                dpsFromEnemies += enemy.eatDps;
                const center = enemy.getCenter();
                if (Math.random() < 0.08) {
                    this.addTornPaper(center.x + (Math.random() - 0.5) * 25, center.y + (Math.random() - 0.5) * 25);
                }
            }
        }

        if (dpsFromEnemies > 0) {
            this.resumeHealth = Math.max(0, this.resumeHealth - dpsFromEnemies / 60);
        }

        this.particles.update();
        for (const crack of this.cracks) {
            crack.life -= 1;
        }
        this.cracks = this.cracks.filter((c) => c.life > 0);

        if (this.currentEnemies.length === 0) {
            this.floorTransitionTicks++;
            if (this.floorTransitionTicks > 75) {
                this.currentFloor++;
                this.floorTransitionTicks = 0;
                this.spawnFloorEnemies();
            }
        } else {
            this.floorTransitionTicks = 0;
        }

        this.updateCamera();
        this.updateHud();
    }

    updateHud() {
        if (!this.gameStarted) {
            this.hudState.floorLevel = '1';
            this.hudState.caughtCount = '--';
            this.hudState.progressPct = 0;
            this.hudState.resumeHpText = `${Math.round(this.resumeHealth)}%`;
            this.hudState.resumeHpPct = Math.max(0, this.resumeHealth);
            this.hudState.status = 'Read the resume, then click "Yes, I will protect your resume".';

            const floorLevelEl = document.getElementById('floorLevel');
            if (floorLevelEl) floorLevelEl.textContent = this.hudState.floorLevel;
            const caughtCountEl = document.getElementById('caughtCount');
            if (caughtCountEl) caughtCountEl.textContent = this.hudState.caughtCount;
            const progressBarEl = document.getElementById('progressBar');
            if (progressBarEl) progressBarEl.style.width = `${this.hudState.progressPct}%`;
            const resumeHpTextEl = document.getElementById('resumeHpText');
            if (resumeHpTextEl) resumeHpTextEl.textContent = this.hudState.resumeHpText;
            const resumeHpBarEl = document.getElementById('resumeHpBar');
            if (resumeHpBarEl) resumeHpBarEl.style.width = `${this.hudState.resumeHpPct}%`;
            const statusEl = document.getElementById('statusText');
            if (statusEl) statusEl.textContent = this.hudState.status;
            return;
        }

        const total = this.getEnemyCountForFloor(this.currentFloor);
        const progressPct = (this.defeatedThisFloor / total) * 100;

        const hpPct = Math.round(this.resumeHealth);

        let status = '🐛 Resume Eating Bugs try to eat when you are far.';
        if (this.currentEnemies.length === 0) {
            status = `✅ Floor cleared. Entering floor ${this.currentFloor + 1}...`;
        } else if (this.resumeHealth <= 20) {
            status = '🚨 CRITICAL! Stun and hammer the bugs away NOW!';
        } else if (this.currentFloor >= 11) {
            status = `🔥 Bug upgrade active (Tier ${this.getUpgradeTier(this.currentFloor)}). Bugs are STRONGER!`;
        }

        this.hudState.floorLevel = String(this.currentFloor);
        this.hudState.caughtCount = `${this.defeatedThisFloor} / ${total}`;
        this.hudState.progressPct = progressPct;
        this.hudState.resumeHpText = `${hpPct}%`;
        this.hudState.resumeHpPct = Math.max(0, this.resumeHealth);
        this.hudState.status = status;

        const floorLevelEl = document.getElementById('floorLevel');
        if (floorLevelEl) floorLevelEl.textContent = this.hudState.floorLevel;
        const caughtCountEl = document.getElementById('caughtCount');
        if (caughtCountEl) caughtCountEl.textContent = this.hudState.caughtCount;
        const progressBarEl = document.getElementById('progressBar');
        if (progressBarEl) progressBarEl.style.width = `${this.hudState.progressPct}%`;
        const resumeHpTextEl = document.getElementById('resumeHpText');
        if (resumeHpTextEl) resumeHpTextEl.textContent = this.hudState.resumeHpText;
        const resumeHpBarEl = document.getElementById('resumeHpBar');
        if (resumeHpBarEl) resumeHpBarEl.style.width = `${this.hudState.resumeHpPct}%`;
        const statusEl = document.getElementById('statusText');
        if (statusEl) statusEl.textContent = this.hudState.status;
    }

    drawStickyNote(x, y, width, height, color, angle) {
        this.ctx.save();
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(-width / 2 + 6, -height / 2 + 7, width, height);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(-width / 2, -height / 2, width, height);
        this.ctx.strokeStyle = 'rgba(96, 77, 45, 0.25)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(-width / 2, -height / 2, width, height);
        this.ctx.restore();
    }

    getWrappedLines(text, maxWidth) {
        const source = String(text || '').trim();
        if (!source) return [];
        const words = source.split(/\s+/);
        const lines = [];
        let line = '';

        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (this.ctx.measureText(next).width <= maxWidth) {
                line = next;
            } else {
                if (line) lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
        const lines = this.getWrappedLines(text, maxWidth);
        const count = Math.min(lines.length, maxLines);
        for (let i = 0; i < count; i++) {
            this.ctx.fillText(lines[i], x, y);
            y += lineHeight;
        }
        return y;
    }

    drawRightAlignedText(text, rightX, y) {
        const str = String(text || '');
        const width = this.ctx.measureText(str).width;
        this.ctx.fillText(str, rightX - width, y);
    }

    drawSectionTitle(text, x, y, width) {
        this.ctx.fillStyle = '#2b2b2b';
        this.ctx.font = 'bold 19px Georgia';
        this.ctx.fillText(text, x, y);
        this.ctx.strokeStyle = 'rgba(70, 70, 70, 0.25)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 6);
        this.ctx.lineTo(x + width, y + 6);
        this.ctx.stroke();
    }

    drawSkillEntry(label, items, x, y, maxWidth, lineHeight) {
        const safeLabel = String(label || '').trim();
        const itemText = Array.isArray(items) ? items.join(', ') : String(items || '');

        this.ctx.fillStyle = '#2f2a22';
        this.ctx.font = 'bold 12px Georgia';
        this.ctx.fillText(`${safeLabel}:`, x, y);

        // Draw underline under the skill category label for a resume-like emphasis.
        const labelWidth = this.ctx.measureText(safeLabel).width;
        this.ctx.strokeStyle = '#2f2a22';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 2);
        this.ctx.lineTo(x + labelWidth, y + 2);
        this.ctx.stroke();

        const valueX = x + this.ctx.measureText(`${safeLabel}: `).width;
        const firstLineWidth = Math.max(80, maxWidth - (valueX - x));
        const remainingLinesWidth = Math.max(80, maxWidth - 18);

        this.ctx.fillStyle = '#4a4438';
        this.ctx.font = '12px Georgia';

        const words = itemText.split(/\s+/).filter(Boolean);
        let line = '';
        let currentY = y;

        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            const widthLimit = currentY === y ? firstLineWidth : remainingLinesWidth;
            const nextWidth = this.ctx.measureText(next).width;
            if (nextWidth <= widthLimit) {
                line = next;
            } else {
                const drawX = currentY === y ? valueX : x + 18;
                this.ctx.fillText(line, drawX, currentY);
                currentY += lineHeight;
                line = word;
            }
        }

        if (line) {
            const drawX = currentY === y ? valueX : x + 18;
            this.ctx.fillText(line, drawX, currentY);
            currentY += lineHeight;
        }

        return currentY;
    }

    drawWorldNotes() {
        const leftX = this.resumeRect.x - 290;
        const topY = this.resumeRect.y + 80;
        const noteCenterX = leftX + 130;

        this.drawStickyNote(leftX, topY, 260, 180, '#fff2a8', -0.05);
        this.ctx.fillStyle = '#4b3a20';
        if (!this.gameStarted) {
            this.ctx.font = 'bold 16px Comic Sans MS';
            this.ctx.fillText('Resume Defense Mission', leftX + 14, topY + 30);
            this.ctx.font = '12px Comic Sans MS';
            const questText = 'I need a brave hero like you to protect my resume from evil resume-eating bugs. My career prospects depend on this. Will you accept the task?';
            let questY = topY + 50;
            const questLines = this.getWrappedLines(questText, 232);
            for (let i = 0; i < questLines.length && i < 6; i++) {
                this.ctx.fillText(questLines[i], leftX + 14, questY);
                questY += 17;
            }

            const buttonW = 224;
            const buttonH = 28;
            const buttonX = noteCenterX - buttonW / 2;
            const buttonY = topY + 125;
            this.acceptButtonRect = { x: buttonX, y: buttonY, width: buttonW, height: buttonH };

            this.ctx.fillStyle = '#ffe07a';
            this.ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
            this.ctx.strokeStyle = '#8c6b1a';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(buttonX, buttonY, buttonW, buttonH);
            this.ctx.fillStyle = '#4b3a20';
            this.ctx.font = 'bold 12px Comic Sans MS';
            this.ctx.fillText('Yes, I will protect your resume', buttonX + 25, buttonY + 18);
        } else {
            this.acceptButtonRect = null;
            this.ctx.font = 'bold 18px Comic Sans MS';
            this.ctx.fillText('Protect My Resume', leftX + 18, topY + 32);
            this.ctx.font = '14px Comic Sans MS';
            this.ctx.fillText(`Floor: ${this.hudState.floorLevel}`, leftX + 18, topY + 58);
            this.ctx.fillText(`Bugs: ${this.hudState.caughtCount}`, leftX + 18, topY + 80);
            this.ctx.fillText(`HP: ${this.hudState.resumeHpText}`, leftX + 18, topY + 102);

            this.ctx.fillStyle = '#efe1a0';
            this.ctx.fillRect(leftX + 18, topY + 118, 220, 9);
            this.ctx.fillStyle = '#f08b4f';
            this.ctx.fillRect(leftX + 18, topY + 118, 220 * (this.hudState.progressPct / 100), 9);

            this.ctx.fillStyle = '#e6d78f';
            this.ctx.fillRect(leftX + 18, topY + 136, 220, 9);
            this.ctx.fillStyle = '#63c57a';
            this.ctx.fillRect(leftX + 18, topY + 136, 220 * (this.hudState.resumeHpPct / 100), 9);
        }

        if (this.gameStarted) {
            this.drawStickyNote(this.resumeRect.x + this.resumeRect.width + 34, this.resumeRect.y + 90, 240, 150, '#d8f0ff', 0.06);
            this.ctx.fillStyle = '#2f3e49';
            this.ctx.font = 'bold 16px Comic Sans MS';
            this.ctx.fillText('Instructions', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 120);
            this.ctx.font = '13px Comic Sans MS';
            this.ctx.fillText('Move: Cursor / Touch', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 146);
            this.ctx.fillText('Attack: Click / Tap', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 166);
            this.ctx.fillText('R: Reset, B: Back', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 186);
        }
    }

    drawResumeTerrain() {
        const x = this.resumeRect.x;
        const y = this.resumeRect.y;
        const pageW = this.resumeRect.width;
        const pageH = this.resumeRect.height;

        if (this.deskImageLoaded) {
            const pattern = this.ctx.createPattern(this.deskImage, 'repeat');
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
        } else {
            this.ctx.fillStyle = '#6e4a28';
            this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
        }

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        this.ctx.fillRect(x + 14, y + 20, pageW, pageH);

        this.ctx.fillStyle = '#f2e7cf';
        this.ctx.fillRect(x, y, pageW, pageH);

        this.ctx.strokeStyle = '#d0bea0';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x, y, pageW, pageH);

        const padX = 34;
        const top = y + 56;
        const left = x + padX;
        const right = x + pageW - padX;
        const contentW = pageW - padX * 2;
        let cursorY = top;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(left, y + 14, contentW, pageH - 28);
        this.ctx.clip();

        if (this.resumeData && this.resumeData.personal) {
            const p = this.resumeData.personal;

            this.ctx.fillStyle = '#2f2921';
            this.ctx.font = 'bold 31px Georgia';
            const name = String((p.name || '').toUpperCase());
            const nameW = this.ctx.measureText(name).width;
            this.ctx.fillText(name, x + (pageW - nameW) / 2, cursorY);
            cursorY += 34;

            this.ctx.font = 'bold 19px Georgia';
            const title = String(p.title || 'Software Developer');
            const titleW = this.ctx.measureText(title).width;
            this.ctx.fillText(title, x + (pageW - titleW) / 2, cursorY);
            cursorY += 27;

            this.ctx.font = 'italic 13px Georgia';
            this.ctx.fillStyle = '#4c4336';
            const github = String(p.github || '').replace('https://', '');
            const contact = `${p.email || ''} || ${github}`;
            const contactW = this.ctx.measureText(contact).width;
            this.ctx.fillText(contact, x + (pageW - contactW) / 2, cursorY);
            cursorY += 21;

            this.drawSectionTitle('SUMMARY', left, cursorY, contentW);
            cursorY += 23;
            this.ctx.font = '12px Georgia';
            this.ctx.fillStyle = '#4a4438';
            cursorY = this.drawWrappedText(this.resumeData.summary || '', left, cursorY, contentW, 17, 4);
            cursorY += 14;

            this.drawSectionTitle('TECHNICAL SKILLS', left, cursorY, contentW);
            cursorY += 23;
            const skills = Array.isArray(this.resumeData.technicalSkills) ? this.resumeData.technicalSkills : [];
            for (const skill of skills.slice(0, 4)) {
                cursorY = this.drawSkillEntry(skill.label, skill.items || [], left, cursorY, contentW, 17);
                cursorY += 4;
                if (cursorY > y + pageH - 520) break;
            }
            cursorY += 14;

            this.drawSectionTitle('WORK EXPERIENCES', left, cursorY, contentW);
            cursorY += 25;
            const jobs = Array.isArray(this.resumeData.workExperience) ? this.resumeData.workExperience : [];
            const educationReserve = 260;
            for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
                const job = jobs[jobIndex];
                if (cursorY > y + pageH - educationReserve) break;
                this.ctx.fillStyle = '#2f2a22';
                this.ctx.font = 'bold 14px Georgia';
                const jobDate = String(job.dateRange || '');
                const jobDateWidth = this.ctx.measureText(jobDate).width;
                const jobTitleMaxWidth = Math.max(120, contentW - jobDateWidth - 20);
                cursorY = this.drawWrappedText(job.title || '', left, cursorY, jobTitleMaxWidth, 17, 2);
                this.drawRightAlignedText(jobDate, right, cursorY - 17);
                cursorY += 3;

                this.ctx.font = 'italic 12px Georgia';
                this.ctx.fillStyle = '#4c4336';
                this.ctx.fillText(job.company || '', left, cursorY);
                cursorY += 17;

                this.ctx.font = '12px Georgia';
                const highlights = Array.isArray(job.highlights) ? job.highlights : [];
                // Preserve the strongest first-role impact while ensuring later roles
                // still show representative bullet details.
                const maxBullets = jobIndex === 0 ? 3 : (jobIndex === 1 ? 1 : 3);
                for (let b = 0; b < highlights.length && b < maxBullets; b++) {
                    const bullet = highlights[b];
                    if (cursorY > y + pageH - educationReserve + 30) break;
                    this.ctx.fillText('•', left + 4, cursorY);
                    cursorY = this.drawWrappedText(bullet, left + 18, cursorY, contentW - 18, 16, 2);
                    cursorY += 1;
                }
                cursorY += 5;
            }

            if (cursorY < y + pageH - 120) {
                cursorY += 10;
                this.drawSectionTitle('EDUCATION', left, cursorY, contentW);
                cursorY += 23;
                this.ctx.font = '12px Georgia';
                this.ctx.fillStyle = '#4a4438';
                const edu = Array.isArray(this.resumeData.education) ? this.resumeData.education : [];
                for (const item of edu) {
                    if (cursorY > y + pageH - 55) break;
                    this.ctx.font = 'bold 12px Georgia';
                    this.ctx.fillStyle = '#2f2a22';
                    const eduDate = String(item.dateRange || '');
                    const eduDateWidth = this.ctx.measureText(eduDate).width;
                    const eduTitleMaxWidth = Math.max(120, contentW - eduDateWidth - 18);
                    cursorY = this.drawWrappedText(item.degree || '', left, cursorY, eduTitleMaxWidth, 16, 2);
                    this.drawRightAlignedText(eduDate, right, cursorY - 16);
                    cursorY += 2;
                    this.ctx.font = '12px Georgia';
                    this.ctx.fillStyle = '#4a4438';
                    cursorY = this.drawWrappedText(item.institution || '', left, cursorY, contentW, 16, 2);

                    const eduHighlights = Array.isArray(item.highlights) ? item.highlights.slice(0, 2) : [];
                    if (eduHighlights.length > 0) {
                        cursorY += 2;
                        this.ctx.font = '12px Georgia';
                        this.ctx.fillStyle = '#4a4438';
                        for (const bullet of eduHighlights) {
                            if (cursorY > y + pageH - 35) break;
                            this.ctx.fillText('•', left + 4, cursorY);
                            cursorY = this.drawWrappedText(bullet, left + 18, cursorY, contentW - 18, 16, 2);
                            cursorY += 2;
                        }
                    }

                    cursorY += 8;
                }
            }
        } else {
            this.ctx.font = '18px Georgia';
            this.ctx.fillStyle = '#6f5e44';
            this.ctx.fillText('Resume data unavailable in this session.', left, y + 100);
            if (this.resumeLoadError) {
                this.ctx.font = '15px Georgia';
                this.ctx.fillText('Tip: open index.html once or run with Live Server, then return to game.', left, y + 130);
            }
        }

        this.ctx.restore();

        const healthGlow = Math.max(0, 1 - this.resumeHealth / 100);
        if (healthGlow > 0.05) {
            this.ctx.strokeStyle = `rgba(230, 75, 60, ${0.2 + healthGlow * 0.45})`;
            this.ctx.lineWidth = 10;
            this.ctx.strokeRect(x - 2, y - 2, pageW + 4, pageH + 4);
        }
    }

    drawCracks() {
        this.ctx.save();
        for (const crack of this.cracks) {
            const alpha = Math.min(0.85, crack.life / 240);
            this.ctx.strokeStyle = `rgba(210, 228, 255, ${alpha})`;
            this.ctx.lineWidth = 1.6;
            for (const branch of crack.branches) {
                this.ctx.beginPath();
                this.ctx.moveTo(branch[0].x, branch[0].y);
                for (let i = 1; i < branch.length; i++) {
                    this.ctx.lineTo(branch[i].x, branch[i].y);
                }
                this.ctx.stroke();
            }
        }
        this.ctx.restore();
    }

    drawTornPapers() {
        for (const paper of this.torePapers) {
            const alpha = paper.life / paper.maxLife;
            this.ctx.save();
            this.ctx.globalAlpha = alpha * 0.8;
            this.ctx.translate(paper.x, paper.y);
            this.ctx.rotate(paper.rotation);
            this.ctx.fillStyle = '#f5e8d4';
            this.ctx.fillRect(-paper.size / 2, -paper.size / 2, paper.size, paper.size);
            this.ctx.strokeStyle = '#d4c5a8';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-paper.size / 2, -paper.size / 2, paper.size, paper.size);
            this.ctx.restore();
        }
    }

    drawProjectiles() {
        for (const bullet of this.projectiles) {
            this.ctx.fillStyle = '#bfe3ff';
            this.ctx.beginPath();
            this.ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = 'rgba(179, 229, 252, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(bullet.x, bullet.y);
            this.ctx.lineTo(bullet.x - bullet.vx * 1.2, bullet.y - bullet.vy * 1.2);
            this.ctx.stroke();
        }
    }

    draw() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(-this.cameraX + this.renderOffsetX, -this.cameraY + this.renderOffsetY);

        this.drawResumeTerrain();
        this.drawWorldNotes();

        for (const enemy of this.currentEnemies) {
            enemy.draw(this.ctx, performance.now());
        }

        this.drawProjectiles();
        if (this.gameStarted) {
            this.player.draw(this.ctx);
        }
        this.particles.draw(this.ctx);
        this.drawCracks();
        this.drawTornPapers();

        // Update torn papers
        for (let i = this.torePapers.length - 1; i >= 0; i--) {
            const paper = this.torePapers[i];
            paper.x += paper.vx;
            paper.y += paper.vy;
            paper.vy += 0.04;
            paper.life -= 1;
            if (paper.life <= 0) {
                this.torePapers.splice(i, 1);
            }
        }

        this.ctx.restore();
    }

    gameLoop = () => {
        this.update();
        this.draw();
        requestAnimationFrame(this.gameLoop);
    }

    resetGame() {
        this.resumeHealth = 100;
        this.currentFloor = 1;
        this.defeatedThisFloor = 0;
        this.totalDefeated = 0;
        this.cracks = [];
        this.torePapers = [];
        this.projectiles = [];
        this.player.x = this.worldWidth * 0.5;
        this.player.y = this.worldHeight * 0.5;
        this.player.setTarget(this.player.x, this.player.y);
        this.centerCameraOnPlayer();

        if (this.gameStarted) {
            this.spawnFloorEnemies();
        } else {
            this.currentEnemies = [];
            this.floorTransitionTicks = 0;
        }
    }

    startGame() {
        if (this.gameStarted) return;
        this.gameStarted = true;
        this.preStartWheelOffsetY = 0;
        this.applyGameStartedVisualState();
        this.resumeHealth = 100;
        this.currentFloor = 1;
        this.defeatedThisFloor = 0;
        this.totalDefeated = 0;
        this.floorTransitionTicks = 0;
        this.cracks = [];
        this.torePapers = [];
        this.projectiles = [];
        this.spawnFloorEnemies();
    }

    isPointInRect(point, rect) {
        return (
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height
        );
    }

    distance(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    new Game(canvas);
});