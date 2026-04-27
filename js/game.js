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
        this.preStartZoom = 1;

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
        this.maxMana = 100;
        this.mana = 0;
        this.shockwaveChargeMs = 3000;
        this.shockwaveDelayMs = 500;
        this.isChargingShockwave = false;
        this.isHolding = false;
        this.holdStartTime = 0;
        this.shockwaveRings = [];
        this.adminPanelOpen = false;
        this.adminOneHitKill = false;
        this.adminInfiniteMana = false;
        this.adminPanelEl = null;
        this.resumeRect = { x: 0, y: 0, width: 0, height: 0 };
        this.gameStarted = false;
        this.acceptButtonRect = null;
        this.resumeData = this.getEmbeddedResumeData() || this.getCachedResumeData();
        this.resumeLoadError = false;
        this.hudState = {
            floorLevel: '1',
            caughtCount: '--',
            progressPct: 0,
            manaText: '0%',
            manaPct: 0,
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
        this.createAdminPanel();
        this.applyGameStartedVisualState();
        this.updateHud();
        this.gameLoop();
    }

    bindEvents() {
        this.canvas.style.touchAction = 'none';
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

                const acceptRect = this.acceptButtonRect || this.getAcceptButtonRect();
                if (!this.gameStarted && acceptRect && this.isPointInRect(worldPos, acceptRect)) {
                    this.startGame();
                    return;
                }

                if (this.gameStarted) {
                    this.isHolding = true;
                    this.holdStartTime = performance.now();
                }
            }
        });

        window.addEventListener('mouseup', (event) => {
            if (event.button !== 0) return;
            if (this.gameStarted) {
                this.onInputRelease(event);
            } else {
                this.isHolding = false;
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
                const acceptRect = this.acceptButtonRect || this.getAcceptButtonRect();
                if (!this.gameStarted && acceptRect) {
                    const worldPos = this.screenToWorld(this.touchState.startX, this.touchState.startY);
                    // Slightly larger tap target on mobile for better reliability.
                    if (this.isPointInRect(worldPos, this.expandRect(acceptRect, 18))) {
                        this.startGame();
                        return;
                    }
                }

                // Start hold tracking for hammer / shockwave (in-game, single touch)
                if (this.gameStarted && event.touches.length === 1) {
                    this.isHolding = true;
                    this.holdStartTime = performance.now();
                    // Track touch position for aim
                    this.mouseX = this.touchState.startX;
                    this.mouseY = this.touchState.startY;
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
                        this.preStartWheelOffsetY -= deltaY * 0.75; // faster pre-start swipe
                        
                        // Apply horizontal scroll (X axis)
                        this.preStartWheelOffsetX -= deltaX * 0.75; // faster pre-start swipe
                        
                        const maxCameraX = Math.max(0, this.worldWidth - this.width);
                        const maxCameraY = Math.max(0, this.worldHeight - this.height);
                        this.preStartWheelOffsetX = Math.max(0, Math.min(this.preStartWheelOffsetX, maxCameraX));
                        this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));

                        // Use incremental deltas so swipe feels stable instead of compounding from first touch point.
                        this.touchState.startX = this.touchState.currentX;
                        this.touchState.startY = this.touchState.currentY;
                    } else {
                        // In-game: swipe to move player (cursor follows touch)
                        if (!this.isChargingShockwave) {
                            const worldPos = this.screenToWorld(this.touchState.currentX, this.touchState.currentY);
                            this.player.setTarget(worldPos.x, worldPos.y);
                            this.mouseX = this.touchState.currentX;
                            this.mouseY = this.touchState.currentY;
                            this.updateAimRing();
                        }
                    }
                }
                
                // Handle pinch zoom (two fingers)
                if (event.touches.length === 2) {
                    const touchA = event.touches[0];
                    const touchB = event.touches[1];
                    const x1 = touchA.clientX - rect.left;
                    const y1 = touchA.clientY - rect.top;
                    const x2 = touchB.clientX - rect.left;
                    const y2 = touchB.clientY - rect.top;
                    const currentDistance = Math.hypot(
                        x1 - x2,
                        y1 - y2
                    );

                    if (this.touchState.lastDistance === 0) {
                        // First pinch detection: initialize the baseline distance
                        this.touchState.lastDistance = currentDistance;
                    } else {
                        // Subsequent pinch: apply zoom ratio relative to previous frame.
                        const zoomRatio = currentDistance / this.touchState.lastDistance;
                        
                        if (!this.gameStarted) {
                            this.preStartZoom = Math.max(0.7, Math.min(this.preStartZoom * zoomRatio, 2.2));
                            const maxCameraX = Math.max(0, this.worldWidth - this.width / this.preStartZoom);
                            const maxCameraY = Math.max(0, this.worldHeight - this.height / this.preStartZoom);
                            this.preStartWheelOffsetX = Math.max(0, Math.min(this.preStartWheelOffsetX, maxCameraX));
                            this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));
                        } else {
                            // In-game: pinch could zoom camera (future enhancement)
                            // For now, just track it
                        }
                        this.touchState.lastDistance = currentDistance;
                    }
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            if (event.touches.length === 0 && this.gameStarted) {
                this.onInputRelease(null);
            } else if (event.touches.length > 0) {
                // Finger lifted but others remain — cancel hold without acting
                this.isHolding = false;
                this.isChargingShockwave = false;
            }
            this.touchState.touchCount = event.touches.length;
            this.touchState.lastDistance = 0;

            if (event.touches.length === 1) {
                // If a pinch ends with one finger still down, continue smooth one-finger swipe.
                const rect = this.canvas.getBoundingClientRect();
                const touch = event.touches[0];
                this.touchState.startX = touch.clientX - rect.left;
                this.touchState.startY = touch.clientY - rect.top;
                this.touchState.currentX = this.touchState.startX;
                this.touchState.currentY = this.touchState.startY;
                this.touchState.isActive = true;
            } else if (event.touches.length === 0) {
                this.touchState.isActive = false;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', () => {
            this.touchState.isActive = false;
            this.touchState.touchCount = 0;
            this.touchState.lastDistance = 0;
            this.isChargingShockwave = false;
            this.isHolding = false;
        }, { passive: false });

        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (event.ctrlKey && event.shiftKey && key === 'z') {
                event.preventDefault();
                this.toggleAdminPanel();
            } else if (key === 'r') {
                event.preventDefault();
                this.resetGame();
            } else if (key === 'b') {
                event.preventDefault();
                window.history.back();
            }
        });
    }

    createAdminPanel() {
        const panel = document.createElement('div');
        panel.id = 'adminPanel';
        panel.style.position = 'fixed';
        panel.style.top = '14px';
        panel.style.right = '14px';
        panel.style.zIndex = '9999';
        panel.style.width = '220px';
        panel.style.padding = '12px';
        panel.style.border = '2px solid #364152';
        panel.style.borderRadius = '10px';
        panel.style.background = 'rgba(245, 248, 255, 0.97)';
        panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
        panel.style.display = 'none';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.color = '#111827';

        panel.innerHTML = [
            '<div style="font-weight:700; font-size:14px; margin-bottom:8px;">Admin Panel</div>',
            '<label style="display:flex; align-items:center; gap:8px; margin:8px 0; font-size:13px;">',
            '<input id="adminOneHitKillToggle" type="checkbox" />',
            'One Hit Kill',
            '</label>',
            '<label style="display:flex; align-items:center; gap:8px; margin:8px 0; font-size:13px;">',
            '<input id="adminInfiniteManaToggle" type="checkbox" />',
            'Infinite Mama',
            '</label>',
            '<div style="font-size:11px; color:#4b5563; margin-top:8px;">Hotkey: Ctrl+Shift+Z</div>'
        ].join('');

        document.body.appendChild(panel);
        this.adminPanelEl = panel;

        const oneHitToggle = panel.querySelector('#adminOneHitKillToggle');
        const infiniteManaToggle = panel.querySelector('#adminInfiniteManaToggle');
        if (oneHitToggle) {
            oneHitToggle.checked = this.adminOneHitKill;
            oneHitToggle.addEventListener('change', (event) => {
                this.adminOneHitKill = !!event.target.checked;
            });
        }
        if (infiniteManaToggle) {
            infiniteManaToggle.checked = this.adminInfiniteMana;
            infiniteManaToggle.addEventListener('change', (event) => {
                this.adminInfiniteMana = !!event.target.checked;
                if (this.adminInfiniteMana) {
                    this.mana = this.maxMana;
                    this.updateHud();
                }
            });
        }
    }

    toggleAdminPanel() {
        this.adminPanelOpen = !this.adminPanelOpen;
        if (this.adminPanelEl) {
            this.adminPanelEl.style.display = this.adminPanelOpen ? 'block' : 'none';
        }
    }

    async loadResumeData() {
        try {
            // Skip fetch for file:// protocol (CORS blocked by browser)
            if (window.location.protocol === 'file:') {
                throw new Error('file:// protocol - using fallback');
            }
            
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
        const scale = this.gameStarted ? 1 : this.preStartZoom;
        return {
            x: (screenX - this.renderOffsetX) / scale + this.cameraX,
            y: (screenY - this.renderOffsetY) / scale + this.cameraY
        };
    }

    updateCamera() {
        if (!this.player) {
            this.cameraX = 0;
            this.cameraY = 0;
            return;
        }

        const scale = this.gameStarted ? 1 : this.preStartZoom;
        const viewportWorldWidth = this.width / scale;
        const viewportWorldHeight = this.height / scale;
        const maxCameraX = Math.max(0, this.worldWidth - viewportWorldWidth);
        const maxCameraY = Math.max(0, this.worldHeight - viewportWorldHeight);

        // Before the quest starts, keep navigation document-like:
        // allow both horizontal and vertical scrolling via swipe/wheel.
        if (!this.gameStarted) {
            this.preStartWheelOffsetX = Math.max(0, Math.min(this.preStartWheelOffsetX, maxCameraX));
            this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));
            this.cameraX = this.preStartWheelOffsetX;
            this.cameraY = this.preStartWheelOffsetY;

            const scaledWorldWidth = this.worldWidth * scale;
            const scaledWorldHeight = this.worldHeight * scale;
            this.renderOffsetX = this.width > scaledWorldWidth ? (this.width - scaledWorldWidth) * 0.5 : 0;
            this.renderOffsetY = this.height > scaledWorldHeight ? (this.height - scaledWorldHeight) * 0.5 : 0;
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

    getBossSlotIndexes(count, floor) {
        if (count <= 0) return new Set();

        // Floor 100+ => all slots are guaranteed bosses.
        if (floor >= 100) {
            return new Set(Array.from({ length: count }, (_, i) => i));
        }

        const indexes = Array.from({ length: count }, (_, i) => i);

        const pickUnique = (pickCount) => {
            const chosen = new Set();
            while (chosen.size < Math.min(pickCount, count)) {
                const idx = indexes[Math.floor(Math.random() * indexes.length)];
                chosen.add(idx);
            }
            return chosen;
        };

        if (floor === 5) {
            return pickUnique(1);
        }

        if (floor >= 10 && floor % 5 === 0) {
            return pickUnique(2);
        }

        // Non-milestone floors: per-slot boss chance equals floor percentage.
        const slotChance = Math.min(0.99, floor / 100);
        const chosen = new Set();
        for (let i = 0; i < count; i++) {
            if (Math.random() < slotChance) {
                chosen.add(i);
            }
        }
        return chosen;
    }

    spawnFloorEnemies() {
        this.currentEnemies = [];
        this.defeatedThisFloor = 0;
        // NOTE: resumeHealth does NOT reset on floor transition - only on game restart

        const count = this.getEnemyCountForFloor(this.currentFloor);
        const tier = this.getUpgradeTier(this.currentFloor);
        const bossSlotIndexes = this.getBossSlotIndexes(count, this.currentFloor);

        for (let i = 0; i < count; i++) {
            const isBoss = bossSlotIndexes.has(i);
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
                const damage = this.adminOneHitKill ? enemy.maxHp : this.hammerDamage;
                const dead = enemy.applyDamage(damage);
                this.particles.createDamage(e.x, e.y);
                if (dead) {
                    this.currentEnemies.splice(i, 1);
                    this.registerEnemyDefeat(enemy);
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
                const damage = this.adminOneHitKill ? enemy.maxHp : this.hammerDamage;
                const dead = enemy.applyDamage(damage);
                this.particles.createDamage(e.x, e.y);
                if (dead) {
                    this.currentEnemies.splice(i, 1);
                    this.registerEnemyDefeat(enemy);
                    this.particles.createCatch(e.x, e.y);
                }
            }
        }
    }

    registerEnemyDefeat(enemy) {
        this.defeatedThisFloor++;
        this.totalDefeated++;
        const manaGain = enemy && enemy.isBoss ? 10 : 5;
        this.mana = Math.min(this.maxMana, this.mana + manaGain);
    }

    onInputRelease(event) {
        if (!this.gameStarted || !this.isHolding) {
            this.isHolding = false;
            this.isChargingShockwave = false;
            return;
        }
        const now = performance.now();
        const elapsed = now - this.holdStartTime;
        this.isHolding = false;
        this.isChargingShockwave = false;

        const fullChargeTime = this.shockwaveDelayMs + this.shockwaveChargeMs;
        if (this.mana >= this.maxMana && elapsed >= fullChargeTime) {
            this.fireShockwave();
        } else if (event) {
            this.swingHammer(event);
        } else {
            const worldPos = this.screenToWorld(this.touchState.currentX, this.touchState.currentY);
            this.swingHammerAt(worldPos.x, worldPos.y);
        }
    }

    fireShockwave() {
        if (this.mana < this.maxMana) return;
        if (!this.adminInfiniteMana) {
            this.mana = 0;
        } else {
            this.mana = this.maxMana;
        }
        const center = this.player.getCenter();
        const maxRadius = Math.sqrt(this.worldWidth * this.worldWidth + this.worldHeight * this.worldHeight);
        this.shockwaveRings.push({
            x: center.x,
            y: center.y,
            radius: 10,
            speed: 14,
            maxRadius,
            hitEnemies: new Set()
        });
        this.particles.createExplosion(center.x, center.y, 36, '#ffe08a');
    }

    updateShockwaveRings() {
        for (let r = this.shockwaveRings.length - 1; r >= 0; r--) {
            const ring = this.shockwaveRings[r];
            ring.radius += ring.speed;
            const thickness = 24;
            for (let i = this.currentEnemies.length - 1; i >= 0; i--) {
                const enemy = this.currentEnemies[i];
                if (ring.hitEnemies.has(enemy)) continue;
                const ec = enemy.getCenter();
                const d = this.distance(ring.x, ring.y, ec.x, ec.y);
                if (d >= ring.radius - thickness && d <= ring.radius + thickness) {
                    ring.hitEnemies.add(enemy);
                    const damage = enemy.maxHp;
                    const dead = enemy.applyDamage(damage);
                    this.particles.createDamage(ec.x, ec.y);
                    if (dead) {
                        this.currentEnemies.splice(i, 1);
                        this.registerEnemyDefeat(enemy);
                        this.particles.createCatch(ec.x, ec.y);
                    }
                }
            }
            if (ring.radius > ring.maxRadius) {
                this.shockwaveRings.splice(r, 1);
            }
        }
    }

    drawShockwaveRings() {
        for (const ring of this.shockwaveRings) {
            const fade = Math.max(0, 1 - ring.radius / ring.maxRadius);
            this.ctx.save();
            this.ctx.shadowColor = '#ffe08a';
            this.ctx.shadowBlur = 20;
            this.ctx.strokeStyle = `rgba(255, 220, 80, ${fade * 0.9 + 0.05})`;
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            this.ctx.stroke();
            if (ring.radius > 30) {
                this.ctx.strokeStyle = `rgba(255, 140, 30, ${fade * 0.5})`;
                this.ctx.lineWidth = 2;
                this.ctx.shadowBlur = 6;
                this.ctx.beginPath();
                this.ctx.arc(ring.x, ring.y, ring.radius - 22, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
    }

    drawShockwaveChargeBar(now) {
        if (!this.isHolding || !this.gameStarted || this.mana < this.maxMana) return;
        const holdElapsed = now - this.holdStartTime;
        if (holdElapsed < this.shockwaveDelayMs) return;
        const chargeProgress = Math.min(1, (holdElapsed - this.shockwaveDelayMs) / this.shockwaveChargeMs);
        const center = this.player.getCenter();
        const barW = 64;
        const barH = 9;
        const barX = center.x - barW / 2;
        const barY = center.y - 58;
        this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
        this.ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        const hue = 50 - chargeProgress * 30;
        const fillColor = chargeProgress >= 1 ? '#ffffff' : `hsl(${hue}, 100%, 60%)`;
        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(barX, barY, barW * chargeProgress, barH);
        this.ctx.strokeStyle = chargeProgress >= 1 ? '#ffdd00' : 'rgba(255,255,255,0.7)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barW, barH);
        const label = chargeProgress >= 1 ? 'Release!' : 'Charging...';
        this.ctx.fillStyle = chargeProgress >= 1 ? '#ffdd00' : '#fff';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, center.x, barY - 3);
        this.ctx.textAlign = 'left';
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

        if (this.adminInfiniteMana) {
            this.mana = this.maxMana;
        }

        // Compute charging state dynamically: only after shockwaveDelayMs of holding with full mana.
        const holdElapsed = this.isHolding ? (now - this.holdStartTime) : 0;
        this.isChargingShockwave = this.isHolding && this.mana >= this.maxMana && holdElapsed >= this.shockwaveDelayMs;

        // Keep camera navigation responsive before quest acceptance by letting
        // the hidden player continue following the cursor target.
        if (!this.isChargingShockwave) {
            this.player.update(this.worldWidth, this.worldHeight);
        }

        this.updateShockwaveRings();

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
            this.hudState.manaText = `${Math.round(this.mana)}%`;
            this.hudState.manaPct = Math.max(0, this.mana);
            this.hudState.status = 'Read the resume, then click "Yes, I will protect your resume".';

            const floorLevelEl = document.getElementById('floorLevel');
            if (floorLevelEl) floorLevelEl.textContent = this.hudState.floorLevel;
            const caughtCountEl = document.getElementById('caughtCount');
            if (caughtCountEl) caughtCountEl.textContent = this.hudState.caughtCount;
            const progressBarEl = document.getElementById('progressBar');
            if (progressBarEl) progressBarEl.style.width = `${this.hudState.progressPct}%`;
            const manaTextEl = document.getElementById('manaText');
            if (manaTextEl) manaTextEl.textContent = this.hudState.manaText;
            const manaBarEl = document.getElementById('manaBar');
            if (manaBarEl) manaBarEl.style.width = `${this.hudState.manaPct}%`;
            const statusEl = document.getElementById('statusText');
            if (statusEl) statusEl.textContent = this.hudState.status;
            return;
        }

        const total = this.getEnemyCountForFloor(this.currentFloor);
        const progressPct = (this.defeatedThisFloor / total) * 100;

        const manaPct = Math.round(this.mana);

        let status = 'Resume Eating Bugs try to eat when you are far.';
        if (this.currentEnemies.length === 0) {
            status = `Floor cleared. Entering floor ${this.currentFloor + 1}...`;
        } else if (this.mana >= this.maxMana && this.isChargingShockwave) {
            status = 'Shockwave charging... release to detonate!';
        } else if (this.mana >= this.maxMana) {
            status = 'Power full! Hold press to charge shockwave, release to blast all bugs.';
        } else if (this.currentFloor >= 11) {
            status = `Bug upgrade active (Tier ${this.getUpgradeTier(this.currentFloor)}). Bugs are STRONGER!`;
        }

        this.hudState.floorLevel = String(this.currentFloor);
        this.hudState.caughtCount = `${this.defeatedThisFloor} / ${total}`;
        this.hudState.progressPct = progressPct;
        this.hudState.manaText = `${manaPct}%`;
        this.hudState.manaPct = Math.max(0, this.mana);
        this.hudState.status = status;

        const floorLevelEl = document.getElementById('floorLevel');
        if (floorLevelEl) floorLevelEl.textContent = this.hudState.floorLevel;
        const caughtCountEl = document.getElementById('caughtCount');
        if (caughtCountEl) caughtCountEl.textContent = this.hudState.caughtCount;
        const progressBarEl = document.getElementById('progressBar');
        if (progressBarEl) progressBarEl.style.width = `${this.hudState.progressPct}%`;
        const manaTextEl = document.getElementById('manaText');
        if (manaTextEl) manaTextEl.textContent = this.hudState.manaText;
        const manaBarEl = document.getElementById('manaBar');
        if (manaBarEl) manaBarEl.style.width = `${this.hudState.manaPct}%`;
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
            this.ctx.fillText(`Bugs: ${this.hudState.caughtCount}`, leftX + 18, topY + 76);

            // Floor progress bar (labeled)
            this.ctx.font = '10px Comic Sans MS';
            this.ctx.fillStyle = '#8c6b1a';
            this.ctx.fillText('Floor Progress:', leftX + 18, topY + 92);
            this.ctx.fillStyle = '#efe1a0';
            this.ctx.fillRect(leftX + 18, topY + 96, 220, 8);
            this.ctx.fillStyle = '#f08b4f';
            this.ctx.fillRect(leftX + 18, topY + 96, 220 * (this.hudState.progressPct / 100), 8);

            // Power bar (labeled)
            this.ctx.font = '14px Comic Sans MS';
            this.ctx.fillStyle = '#4b3a20';
            this.ctx.fillText(`Power: ${this.hudState.manaText}`, leftX + 18, topY + 120);
            const manaFull = this.hudState.manaPct >= 100;
            this.ctx.fillStyle = manaFull ? '#aad4ff' : '#dce8ff';
            this.ctx.fillRect(leftX + 18, topY + 125, 220, 8);
            this.ctx.fillStyle = manaFull ? '#00aaff' : '#4e9bff';
            this.ctx.fillRect(leftX + 18, topY + 125, 220 * (this.hudState.manaPct / 100), 8);
            if (manaFull) {
                this.ctx.strokeStyle = '#00ccff';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(leftX + 18, topY + 125, 220, 8);
                this.ctx.font = 'bold 10px Comic Sans MS';
                this.ctx.fillStyle = '#0077cc';
                this.ctx.fillText('FULL - Hold to charge shockwave!', leftX + 18, topY + 148);
            }
        }

        if (this.gameStarted) {
            this.drawStickyNote(this.resumeRect.x + this.resumeRect.width + 34, this.resumeRect.y + 90, 240, 172, '#d8f0ff', 0.06);
            this.ctx.fillStyle = '#2f3e49';
            this.ctx.font = 'bold 16px Comic Sans MS';
            this.ctx.fillText('Instructions', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 120);
            this.ctx.font = '13px Comic Sans MS';
            this.ctx.fillText('Move: Cursor / Touch', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 146);
            this.ctx.fillText('Attack: Click / Tap', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 166);
            this.ctx.fillText('Power Full: Hold, Release', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 186);
            this.ctx.fillText('R: Reset, B: Back', this.resumeRect.x + this.resumeRect.width + 52, this.resumeRect.y + 206);
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

    worldToScreen(worldX, worldY) {
        const scale = this.gameStarted ? 1 : this.preStartZoom;
        return {
            x: (worldX - this.cameraX) * scale + this.renderOffsetX,
            y: (worldY - this.cameraY) * scale + this.renderOffsetY
        };
    }

    getChargeShakeOffset(now) {
        if (!this.isChargingShockwave) return { x: 0, y: 0 };
        const chargingStart = this.holdStartTime + this.shockwaveDelayMs;
        const elapsed = Math.min(now - chargingStart, this.shockwaveChargeMs);
        const progress = Math.max(0, Math.min(1, elapsed / this.shockwaveChargeMs));
        // Keep shake subtle so the charge bar is still readable.
        const amplitude = 0.5 + progress * 2.0;
        const t = now * 0.018;
        return {
            x: Math.sin(t * 1.45) * amplitude,
            y: Math.cos(t * 1.95) * amplitude * 0.75
        };
    }

    drawOffscreenBugArrows() {
        if (!this.gameStarted || this.currentEnemies.length === 0) return;

        const cx = this.width * 0.5;
        const cy = this.height * 0.5;
        const edgePad = 28;
        const maxDx = Math.max(1, cx - edgePad);
        const maxDy = Math.max(1, cy - edgePad);

        for (const enemy of this.currentEnemies) {
            const center = enemy.getCenter();
            const screen = this.worldToScreen(center.x, center.y);
            const onScreen =
                screen.x >= 0 && screen.x <= this.width &&
                screen.y >= 0 && screen.y <= this.height;
            if (onScreen) continue;

            const dx = screen.x - cx;
            const dy = screen.y - cy;
            const angle = Math.atan2(dy, dx);
            const scaleToEdge = 1 / Math.max(Math.abs(dx) / maxDx, Math.abs(dy) / maxDy);
            const arrowX = cx + dx * scaleToEdge;
            const arrowY = cy + dy * scaleToEdge;

            this.ctx.save();
            this.ctx.translate(arrowX, arrowY);
            this.ctx.rotate(angle);
            this.ctx.fillStyle = '#ff3030';
            this.ctx.beginPath();
            this.ctx.moveTo(12, 0);
            this.ctx.lineTo(-8, -6);
            this.ctx.lineTo(-8, 6);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    draw() {
        const now = performance.now();
        const shake = this.getChargeShakeOffset(now);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);

        this.ctx.save();
        const scale = this.gameStarted ? 1 : this.preStartZoom;
        this.ctx.translate(this.renderOffsetX, this.renderOffsetY);
        this.ctx.scale(scale, scale);
        this.ctx.translate(-this.cameraX, -this.cameraY);

        this.drawResumeTerrain();
        this.drawWorldNotes();

        for (const enemy of this.currentEnemies) {
            enemy.draw(this.ctx, now);
        }

        this.drawProjectiles();
        if (this.gameStarted) {
            this.player.draw(this.ctx);
        }
        this.particles.draw(this.ctx);
        this.drawCracks();
        this.drawTornPapers();
        this.drawShockwaveRings();
        this.drawShockwaveChargeBar(now);

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

        this.drawOffscreenBugArrows();

        this.ctx.restore();
    }

    gameLoop = () => {
        this.update();
        this.draw();
        requestAnimationFrame(this.gameLoop);
    }

    resetGame() {
        this.resumeHealth = 100;
        this.mana = 0;
        this.isChargingShockwave = false;
        this.isHolding = false;
        this.shockwaveRings = [];
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
        this.preStartZoom = 1;
        this.preStartWheelOffsetX = 0;
        this.preStartWheelOffsetY = 0;
        this.mana = 0;
        this.isChargingShockwave = false;
        this.isHolding = false;
        this.shockwaveRings = [];
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

    getAcceptButtonRect() {
        const leftX = this.resumeRect.x - 290;
        const topY = this.resumeRect.y + 80;
        const noteCenterX = leftX + 130;
        const buttonW = 224;
        const buttonH = 28;
        const buttonX = noteCenterX - buttonW / 2;
        const buttonY = topY + 125;
        return { x: buttonX, y: buttonY, width: buttonW, height: buttonH };
    }

    expandRect(rect, pad) {
        return {
            x: rect.x - pad,
            y: rect.y - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2
        };
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