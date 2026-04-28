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

        // Centralized layout config for easy tuning of world and resume size.
        this.layoutConfig = {
            world: {
                width: 2400,
                height: 2400
            },
            resume: {
                widthRatio: 0.72,
                heightRatio: 0.94,
                maxWidth: 1280,
                maxHeight: 2200
            }
        };

        // Centralized typography config so font sizes can be adjusted from game_resume.json.
        this.resumeTypography = {
            family: 'Georgia',
            nameSize: 48,
            titleSize: 30,
            contactSize: 20,
            sectionTitleSize: 24,
            summarySize: 18,
            summaryLineHeight: 26,
            technicalSkills: {
                labelSize: 16,
                itemSize: 16,
                lineHeight: 24,
                itemGap: 6
            },
            workExperience: {
                titleSize: 21,
                titleLineHeight: 28,
                companySize: 17,
                highlightSize: 16,
                highlightLineHeight: 24,
                jobGap: 8
            },
            education: {
                bodySize: 17,
                titleSize: 21,
                titleLineHeight: 28,
                institutionLineHeight: 24,
                highlightSize: 16,
                highlightLineHeight: 24,
                itemGap: 10
            }
        };

        this.gameplaySettings = {
            playerSize: 64,
            playerSpeed: 20,
            bugSize: 50,
            bugBossSize: 74,
            bugSpeed: 2.7,
            bugBossSpeed: 4.05,
            bugHealth: 3,
            bugBossHealth: 10
        };

        // Keep world dimensions fixed regardless of browser zoom or viewport size.
        this.fixedWorldWidth = this.layoutConfig.world.width;
        this.fixedWorldHeight = this.layoutConfig.world.height;
        this.preStartWheelOffsetX = 0;
        this.preStartWheelOffsetY = 0;
        this.preStartZoom = 1;
        this.preStartScrollbarDrag = {
            axis: null,
            startPointer: 0,
            startOffset: 0
        };

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
        this.maxPower = 100;
        this.power = 0;
        this.shockwaveChargeMs = 3000;
        this.shockwaveDelayMs = 500;
        this.isChargingShockwave = false;
        this.isHolding = false;
        this.holdStartTime = 0;
        this.shockwaveRings = [];
        this.ropePullAnim = null;
        this.skillAnimation = 'shockwave';
        this.adminPanelOpen = false;
        this.adminOneHitKill = false;
        this.adminInfinitePower = false;
        this.adminPanelEl = null;
        this.resumeRect = { x: 0, y: 0, width: 0, height: 0 };
        this.gameStarted = false;
        this.acceptButtonRect = null;
        this.resumeData = null;
        this.resumeDataSource = 'none';
        this.applyResumeLayoutOverrides();
        this.resumeLoadError = false;
        this.resumeLoadErrorMessage = '';
        this.hudState = {
            floorLevel: '1',
            caughtCount: '--',
            progressPct: 0,
            powerText: '0%',
            powerPct: 0,
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
        this.player = new Player(this.worldWidth * 0.5, this.worldHeight * 0.5, {
            size: this.gameplaySettings.playerSize,
            speed: this.gameplaySettings.playerSpeed
        });
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

            if (this.updatePreStartScrollbarDrag(pos)) {
                this.updateAimRing();
                return;
            }

            this.mouseX = pos.x;
            this.mouseY = pos.y;
            const worldPos = this.screenToWorld(pos.x, pos.y);
            this.player.setTarget(worldPos.x, worldPos.y);
            this.updateAimRing();
        });

        this.canvas.addEventListener('mousedown', (event) => {
            if (event.button === 0) {
                const pos = this.getMousePosition(event);

                if (!this.gameStarted && this.beginPreStartScrollbarDrag(pos)) {
                    return;
                }

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

            if (this.endPreStartScrollbarDrag()) {
                return;
            }

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

            // Support trackpad horizontal scroll and Shift+wheel horizontal fallback.
            const panX = event.shiftKey ? event.deltaY : event.deltaX;
            const panY = event.deltaY;
            this.preStartWheelOffsetX += panX;
            this.preStartWheelOffsetY += panY;

            const maxCameraX = Math.max(0, this.worldWidth - this.width / this.preStartZoom);
            const maxCameraY = Math.max(0, this.worldHeight - this.height / this.preStartZoom);
            this.preStartWheelOffsetX = Math.max(0, Math.min(this.preStartWheelOffsetX, maxCameraX));
            this.preStartWheelOffsetY = Math.max(0, Math.min(this.preStartWheelOffsetY, maxCameraY));
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
            '<input id="adminInfinitePowerToggle" type="checkbox" />',
            'Infinite Power',
            '</label>',
            '<div style="margin:8px 0;">',
            '<div style="font-size:12px; font-weight:600; margin-bottom:4px;">Skill Animation</div>',
            '<select id="adminSkillAnimSelect" style="width:100%; font-size:12px; padding:3px 4px; border-radius:4px; border:1px solid #9ca3af;">',
            '<option value="shockwave">Shockwave</option>',
            '<option value="ropepull">Rope Pull</option>',
            '</select>',
            '</div>',
            '<div style="margin:8px 0;">',
            '<div style="font-size:12px; font-weight:600; margin-bottom:4px;">Jump to Floor</div>',
            '<div style="display:flex; gap:6px; align-items:center;">',
            '<input id="adminFloorInput" type="number" min="1" value="1" style="width:60px; font-size:12px; padding:3px 6px; border-radius:4px; border:1px solid #9ca3af;" />',
            '<button id="adminFloorJump" style="font-size:12px; padding:3px 8px; border-radius:4px; border:none; background:#3b82f6; color:#fff; cursor:pointer;">Go</button>',
            '</div>',
            '</div>',
            '<div style="font-size:11px; color:#4b5563; margin-top:8px;">Hotkey: Ctrl+Shift+Z</div>',
            '<div style="margin:8px 0;">',
            '<div style="font-size:12px; font-weight:600; margin-bottom:4px;">Spawn Enemy</div>',
            '<div style="display:flex; gap:6px;">',
            '<button id="adminSpawnBug" style="flex:1; font-size:12px; padding:4px 0; border-radius:4px; border:none; background:#16a34a; color:#fff; cursor:pointer;">+ Bug</button>',
            '<button id="adminSpawnBoss" style="flex:1; font-size:12px; padding:4px 0; border-radius:4px; border:none; background:#b91c1c; color:#fff; cursor:pointer;">+ Boss</button>',
            '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(panel);
        this.adminPanelEl = panel;

        const oneHitToggle = panel.querySelector('#adminOneHitKillToggle');
        const infinitePowerToggle = panel.querySelector('#adminInfinitePowerToggle');
        const skillAnimSelect = panel.querySelector('#adminSkillAnimSelect');
        const floorInput = panel.querySelector('#adminFloorInput');
        const floorJumpBtn = panel.querySelector('#adminFloorJump');
        const spawnBugBtn = panel.querySelector('#adminSpawnBug');
        const spawnBossBtn = panel.querySelector('#adminSpawnBoss');

        if (oneHitToggle) {
            oneHitToggle.checked = this.adminOneHitKill;
            oneHitToggle.addEventListener('change', (event) => {
                this.adminOneHitKill = !!event.target.checked;
            });
        }
        if (infinitePowerToggle) {
            infinitePowerToggle.checked = this.adminInfinitePower;
            infinitePowerToggle.addEventListener('change', (event) => {
                this.adminInfinitePower = !!event.target.checked;
                if (this.adminInfinitePower) {
                    this.power = this.maxPower;
                    this.updateHud();
                }
            });
        }
        if (skillAnimSelect) {
            skillAnimSelect.value = this.skillAnimation;
            skillAnimSelect.addEventListener('change', (event) => {
                const val = event.target.value;
                if (val === 'shockwave' || val === 'ropepull') {
                    this.skillAnimation = val;
                }
            });
        }
        if (floorJumpBtn) {
            floorJumpBtn.addEventListener('click', () => {
                if (!this.gameStarted) return;
                const raw = parseInt(floorInput ? floorInput.value : '1', 10);
                const target = Number.isFinite(raw) && raw > 0 ? raw : 1;
                this.currentFloor = target;
                this.defeatedThisFloor = 0;
                this.floorTransitionTicks = 0;
                this.ropePullAnim = null;
                this.shockwaveRings = [];
                this.currentEnemies = [];
                this.spawnFloorEnemies();
                this.updateHud();
            });
        }

        const spawnOne = (isBoss) => {
            if (!this.gameStarted) return;
            const tier = this.getUpgradeTier(this.currentFloor);
            let x = 0, y = 0, attempts = 0;
            do {
                x = Math.random() * (this.worldWidth - 120) + 60;
                y = Math.random() * (this.worldHeight - 120) + 60;
                attempts++;
            } while (this.distance(x, y, this.player.x, this.player.y) < 180 && attempts < 25);
            this.currentEnemies.push(new Enemy(x, y, {
                isBoss,
                upgradeTier: tier,
                bugSize: this.gameplaySettings.bugSize,
                bugBossSize: this.gameplaySettings.bugBossSize,
                bugSpeed: this.gameplaySettings.bugSpeed,
                bugBossSpeed: this.gameplaySettings.bugBossSpeed,
                bugHealth: this.gameplaySettings.bugHealth,
                bugBossHealth: this.gameplaySettings.bugBossHealth
            }));
            this.updateHud();
        };
        if (spawnBugBtn) spawnBugBtn.addEventListener('click', () => spawnOne(false));
        if (spawnBossBtn) spawnBossBtn.addEventListener('click', () => spawnOne(true));
    }

    toggleAdminPanel() {
        this.adminPanelOpen = !this.adminPanelOpen;
        if (this.adminPanelEl) {
            this.adminPanelEl.style.display = this.adminPanelOpen ? 'block' : 'none';
            if (this.adminPanelOpen) {
                const sel = this.adminPanelEl.querySelector('#adminSkillAnimSelect');
                if (sel) sel.value = this.skillAnimation;
                const floorInput = this.adminPanelEl.querySelector('#adminFloorInput');
                if (floorInput) floorInput.value = String(this.currentFloor);
            }
        }
    }

    async loadResumeData() {
        try {
            if (window.location.protocol === 'file:') {
                throw new Error('Blocked by browser: file:// cannot fetch game_resume.json. Use a local HTTP server (Live Server).');
            }
            const response = await fetch(`game_resume.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('game_resume.json not reachable');
            this.resumeData = await response.json();
            this.resumeDataSource = 'game_resume.json';
            this.applyResumeLayoutOverrides();
            this.applyResumeTypographyOverrides();
            this.applyGameplaySettingsOverrides();
            this.resumeLoadError = false;
            this.resumeLoadErrorMessage = '';
        } catch (error) {
            this.resumeData = null;
            this.resumeDataSource = 'none';
            this.resumeLoadError = true;
            this.resumeLoadErrorMessage = error && error.message ? error.message : 'Unknown error while loading game_resume.json.';
            console.error('Failed to load game_resume.json:', error);
        }
    }

    getResumeDataSourceLabel() {
        if (this.resumeDataSource === 'game_resume.json') return 'game_resume.json';
        return 'Unavailable';
    }

    applyResumeLayoutOverrides() {
        const layout = this.resumeData && this.resumeData.resumeLayout ? this.resumeData.resumeLayout : null;
        if (!layout) return;

        const width = Number(layout.width);
        const height = Number(layout.height);

        if (Number.isFinite(width) && width > 0) {
            this.layoutConfig.resume.maxWidth = width;
            this.layoutConfig.resume.widthRatio = 1;
        }
        if (Number.isFinite(height) && height > 0) {
            this.layoutConfig.resume.maxHeight = height;
            this.layoutConfig.resume.heightRatio = 1;
        }

        this.fixedWorldWidth = this.layoutConfig.world.width;
        this.fixedWorldHeight = this.layoutConfig.world.height;
        this.worldWidth = this.fixedWorldWidth;
        this.worldHeight = this.fixedWorldHeight;
        this.updateResumeRect();
        this.updateCamera();
    }

    applyResumeTypographyOverrides() {
        const typography = this.resumeData && this.resumeData.resumeTypography ? this.resumeData.resumeTypography : null;
        if (!typography || typeof typography !== 'object') return;

        const mergeTypography = (target, source) => {
            for (const key of Object.keys(source)) {
                const next = source[key];
                const current = target[key];

                if (
                    next && typeof next === 'object' && !Array.isArray(next) &&
                    current && typeof current === 'object' && !Array.isArray(current)
                ) {
                    mergeTypography(current, next);
                } else if (typeof next === 'number' && Number.isFinite(next) && next > 0) {
                    target[key] = next;
                } else if (typeof next === 'string' && typeof current === 'string' && next.trim()) {
                    target[key] = next.trim();
                }
            }
        };

        mergeTypography(this.resumeTypography, typography);
    }

    applyGameplaySettingsOverrides() {
        const source = this.resumeData && this.resumeData.gameplaySettings ? this.resumeData.gameplaySettings : null;
        if (!source || typeof source !== 'object') return;

        const keys = [
            'playerSize',
            'playerSpeed',
            'bugSize',
            'bugBossSize',
            'bugSpeed',
            'bugBossSpeed',
            'bugHealth',
            'bugBossHealth'
        ];

        for (const key of keys) {
            const value = Number(source[key]);
            if (Number.isFinite(value) && value > 0) {
                this.gameplaySettings[key] = value;
            }
        }

        if (this.player) {
            this.player.width = this.gameplaySettings.playerSize;
            this.player.height = Math.max(44, this.gameplaySettings.playerSize * 0.9);
            this.player.speed = this.gameplaySettings.playerSpeed;
            this.player.x = Math.max(0, Math.min(this.player.x, this.worldWidth - this.player.width));
            this.player.y = Math.max(0, Math.min(this.player.y, this.worldHeight - this.player.height));
        }

        if (source.defaultSkillAnimation === 'shockwave' || source.defaultSkillAnimation === 'ropepull') {
            this.skillAnimation = source.defaultSkillAnimation;
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

        // Render at device pixel ratio for crisper text and less blur.
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        this.canvas.width = Math.floor(this.width * dpr);
        this.canvas.height = Math.floor(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

    getPreStartScrollbarModel() {
        if (this.gameStarted) return null;

        const scale = this.preStartZoom;
        const viewportWorldWidth = this.width / scale;
        const viewportWorldHeight = this.height / scale;
        const maxCameraX = Math.max(0, this.worldWidth - viewportWorldWidth);
        const maxCameraY = Math.max(0, this.worldHeight - viewportWorldHeight);

        const showH = maxCameraX > 0.5;
        const showV = maxCameraY > 0.5;
        if (!showH && !showV) return null;

        const padding = 12;
        const thickness = 12;
        const gap = 4;
        const rightInset = showV ? thickness + gap : 0;
        const bottomInset = showH ? thickness + gap : 0;

        let h = null;
        if (showH) {
            const trackX = padding;
            const trackY = this.height - padding - thickness;
            const trackW = Math.max(40, this.width - padding * 2 - rightInset);
            const thumbW = Math.max(36, trackW * (viewportWorldWidth / this.worldWidth));
            const travel = Math.max(1, trackW - thumbW);
            const ratio = maxCameraX <= 0 ? 0 : (this.preStartWheelOffsetX / maxCameraX);
            const thumbX = trackX + travel * Math.max(0, Math.min(1, ratio));
            h = {
                axis: 'x',
                max: maxCameraX,
                track: { x: trackX, y: trackY, width: trackW, height: thickness },
                thumb: { x: thumbX, y: trackY + 1, width: thumbW, height: thickness - 2 },
                travel
            };
        }

        let v = null;
        if (showV) {
            const trackX = this.width - padding - thickness;
            const trackY = padding;
            const trackH = Math.max(40, this.height - padding * 2 - bottomInset);
            const thumbH = Math.max(36, trackH * (viewportWorldHeight / this.worldHeight));
            const travel = Math.max(1, trackH - thumbH);
            const ratio = maxCameraY <= 0 ? 0 : (this.preStartWheelOffsetY / maxCameraY);
            const thumbY = trackY + travel * Math.max(0, Math.min(1, ratio));
            v = {
                axis: 'y',
                max: maxCameraY,
                track: { x: trackX, y: trackY, width: thickness, height: trackH },
                thumb: { x: trackX + 1, y: thumbY, width: thickness - 2, height: thumbH },
                travel
            };
        }

        return { h, v };
    }

    isPointInScreenRect(point, rect) {
        return (
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height
        );
    }

    beginPreStartScrollbarDrag(pos) {
        const model = this.getPreStartScrollbarModel();
        if (!model) return false;

        if (model.h && this.isPointInScreenRect(pos, model.h.track)) {
            this.preStartScrollbarDrag.axis = 'x';
            this.preStartScrollbarDrag.startPointer = pos.x;
            this.preStartScrollbarDrag.startOffset = this.preStartWheelOffsetX;
            this.canvas.style.cursor = 'grabbing';
            return true;
        }

        if (model.v && this.isPointInScreenRect(pos, model.v.track)) {
            this.preStartScrollbarDrag.axis = 'y';
            this.preStartScrollbarDrag.startPointer = pos.y;
            this.preStartScrollbarDrag.startOffset = this.preStartWheelOffsetY;
            this.canvas.style.cursor = 'grabbing';
            return true;
        }

        return false;
    }

    updatePreStartScrollbarDrag(pos) {
        if (this.gameStarted) return false;
        const axis = this.preStartScrollbarDrag.axis;
        if (!axis) return false;

        const model = this.getPreStartScrollbarModel();
        if (!model) return false;

        if (axis === 'x' && model.h) {
            const delta = pos.x - this.preStartScrollbarDrag.startPointer;
            const ratio = delta / model.h.travel;
            this.preStartWheelOffsetX = this.preStartScrollbarDrag.startOffset + ratio * model.h.max;
        } else if (axis === 'y' && model.v) {
            const delta = pos.y - this.preStartScrollbarDrag.startPointer;
            const ratio = delta / model.v.travel;
            this.preStartWheelOffsetY = this.preStartScrollbarDrag.startOffset + ratio * model.v.max;
        }

        this.updateCamera();
        return true;
    }

    endPreStartScrollbarDrag() {
        if (!this.preStartScrollbarDrag.axis) return false;
        this.preStartScrollbarDrag.axis = null;
        if (!this.gameStarted) {
            this.canvas.style.cursor = 'default';
        }
        return true;
    }

    drawPreStartScrollbars() {
        const model = this.getPreStartScrollbarModel();
        if (!model) return;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(30, 41, 59, 0.18)';
        this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        this.ctx.lineWidth = 1;

        if (model.h) {
            const t = model.h.track;
            this.ctx.fillRect(t.x, t.y, t.width, t.height);
            this.ctx.strokeRect(t.x, t.y, t.width, t.height);
            const thumb = model.h.thumb;
            this.ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
            this.ctx.fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
            this.ctx.fillStyle = 'rgba(30, 41, 59, 0.18)';
        }

        if (model.v) {
            const t = model.v.track;
            this.ctx.fillRect(t.x, t.y, t.width, t.height);
            this.ctx.strokeRect(t.x, t.y, t.width, t.height);
            const thumb = model.v.thumb;
            this.ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
            this.ctx.fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
        }

        this.ctx.restore();
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
        const resumeLayout = this.layoutConfig.resume;
        const pageW = Math.min(resumeLayout.maxWidth, this.worldWidth * resumeLayout.widthRatio);
        const pageH = Math.min(resumeLayout.maxHeight, this.worldHeight * resumeLayout.heightRatio);
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

            this.currentEnemies.push(new Enemy(x, y, {
                isBoss,
                upgradeTier: tier,
                bugSize: this.gameplaySettings.bugSize,
                bugBossSize: this.gameplaySettings.bugBossSize,
                bugSpeed: this.gameplaySettings.bugSpeed,
                bugBossSpeed: this.gameplaySettings.bugBossSpeed,
                bugHealth: this.gameplaySettings.bugHealth,
                bugBossHealth: this.gameplaySettings.bugBossHealth
            }));
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
        const powerGain = enemy && enemy.isBoss ? 10 : 5;
        this.power = Math.min(this.maxPower, this.power + powerGain);
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
        if (this.power >= this.maxPower && elapsed >= fullChargeTime) {
            this.fireSkill();
        } else if (event) {
            this.swingHammer(event);
        } else {
            const worldPos = this.screenToWorld(this.touchState.currentX, this.touchState.currentY);
            this.swingHammerAt(worldPos.x, worldPos.y);
        }
    }

    fireShockwave() {
        if (this.power < this.maxPower) return;
        if (!this.adminInfinitePower) {
            this.power = 0;
        } else {
            this.power = this.maxPower;
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
        if (!this.isHolding || !this.gameStarted || this.power < this.maxPower) return;
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

    fireSkill() {
        if (this.skillAnimation === 'ropepull') {
            this.fireRopePull();
        } else {
            this.fireShockwave();
        }
    }

    fireRopePull() {
        if (this.power < this.maxPower) return;
        if (!this.adminInfinitePower) {
            this.power = 0;
        } else {
            this.power = this.maxPower;
        }
        const count = this.currentEnemies.length;
        const playerRadius = this.player.width * 0.5;
        const bugs = this.currentEnemies.map((e, i) => {
            // Space bugs evenly in a ring whose radius prevents overlap with player and each other.
            const ringRadius = Math.max(
                playerRadius + e.width * 0.5 + 10,
                (e.width * 0.75 * count) / (2 * Math.PI)
            );
            const angle = (2 * Math.PI * i) / Math.max(1, count);
            return { enemy: e, startX: e.x, startY: e.y, ringRadius, angle };
        });
        this.ropePullAnim = {
            phase: 'pull',
            startTime: performance.now(),
            bugs,
            pullDuration: 700,
            jumpDuration: 350,
            slamDuration: 500
        };
    }

    updateRopePull() {
        if (!this.ropePullAnim) return;
        const now = performance.now();
        const anim = this.ropePullAnim;
        const elapsed = now - anim.startTime;
        const center = this.player.getCenter();

        if (anim.phase === 'pull') {
            const t = Math.min(1, elapsed / anim.pullDuration);
            const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            for (const b of anim.bugs) {
                if (!b.enemy) continue;
                // Recompute target each frame from current player center so ring follows player.
                const targetX = center.x + Math.cos(b.angle) * b.ringRadius - b.enemy.width * 0.5;
                const targetY = center.y + Math.sin(b.angle) * b.ringRadius - b.enemy.height * 0.5;
                b.enemy.x = b.startX + (targetX - b.startX) * eased;
                b.enemy.y = b.startY + (targetY - b.startY) * eased;
            }
            if (elapsed >= anim.pullDuration) {
                anim.phase = 'jump';
                anim.startTime = now;
            }
        } else if (anim.phase === 'jump') {
            if (elapsed >= anim.jumpDuration) {
                this.executeSlamKill();
                anim.phase = 'slam';
                anim.startTime = now;
            }
        } else if (anim.phase === 'slam') {
            if (elapsed >= anim.slamDuration) {
                this.ropePullAnim = null;
            }
        }
    }

    executeSlamKill() {
        const center = this.player.getCenter();
        for (let i = 0; i < 4; i++) {
            this.addCrack(
                center.x + (Math.random() - 0.5) * 60,
                center.y + (Math.random() - 0.5) * 60
            );
        }
        const killed = [...this.currentEnemies];
        this.currentEnemies = [];
        for (const enemy of killed) {
            this.registerEnemyDefeat(enemy);
            const ec = enemy.getCenter();
            this.particles.createCatch(ec.x, ec.y);
            this.particles.createExplosion(ec.x, ec.y, 10, '#ffe08a');
        }
        const maxRadius = 360;
        this.shockwaveRings.push({
            x: center.x,
            y: center.y,
            radius: 10,
            speed: 22,
            maxRadius,
            hitEnemies: new Set()
        });
        this.particles.createExplosion(center.x, center.y, 48, '#ffe08a');
        this.player.triggerHammer();
    }

    getRopePullPlayerYOffset() {
        if (!this.ropePullAnim) return 0;
        const anim = this.ropePullAnim;
        const elapsed = performance.now() - anim.startTime;
        if (anim.phase === 'jump') {
            const t = Math.min(1, elapsed / anim.jumpDuration);
            return -70 * Math.sin(t * Math.PI);
        }
        if (anim.phase === 'slam') {
            const t = Math.min(1, elapsed / anim.slamDuration);
            return t < 0.15 ? 12 * (t / 0.15) : 12 * (1 - (t - 0.15) / 0.85);
        }
        return 0;
    }

    drawRopePull() {
        if (!this.ropePullAnim) return;
        const anim = this.ropePullAnim;
        if (anim.phase !== 'pull' && anim.phase !== 'jump') return;
        const now = performance.now();
        const elapsed = now - anim.startTime;
        const center = this.player.getCenter();
        const yOffset = this.getRopePullPlayerYOffset();
        const anchorY = center.y + yOffset;

        let t = 1;
        if (anim.phase === 'pull') {
            t = Math.min(1, elapsed / anim.pullDuration);
        }

        for (const b of anim.bugs) {
            if (!b.enemy) continue;
            const bc = b.enemy.getCenter();
            const dx = bc.x - center.x;
            const dy = bc.y - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sag = dist * 0.18 * (1 - t);
            const mx = (center.x + bc.x) * 0.5;
            const my = (anchorY + bc.y) * 0.5 + sag;
            const alpha = 0.5 + t * 0.5;

            this.ctx.save();
            this.ctx.strokeStyle = `rgba(139, 90, 43, ${alpha})`;
            this.ctx.lineWidth = 2 + t * 3;
            this.ctx.lineCap = 'round';
            this.ctx.shadowColor = 'rgba(255, 180, 60, 0.5)';
            this.ctx.shadowBlur = 5;
            this.ctx.beginPath();
            this.ctx.moveTo(center.x, anchorY);
            this.ctx.quadraticCurveTo(mx, my, bc.x, bc.y);
            this.ctx.stroke();
            this.ctx.restore();
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

        if (this.adminInfinitePower) {
            this.power = this.maxPower;
        }

        // Compute charging state dynamically: only after shockwaveDelayMs of holding with full power.
        const holdElapsed = this.isHolding ? (now - this.holdStartTime) : 0;
        this.isChargingShockwave = this.isHolding && this.power >= this.maxPower && holdElapsed >= this.shockwaveDelayMs;

        // Keep camera navigation responsive before quest acceptance by letting
        // the hidden player continue following the cursor target.
        if (!this.isChargingShockwave && !(this.ropePullAnim && (this.ropePullAnim.phase === 'jump' || this.ropePullAnim.phase === 'slam'))) {
            this.player.update(this.worldWidth, this.worldHeight);
        }

        this.updateShockwaveRings();
        this.updateRopePull();

        if (!this.gameStarted) {
            this.particles.update();
            this.updateCamera();
            this.updateHud();
            return;
        }

        this.updateProjectiles(now);

        if (!this.ropePullAnim) {
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

        // Resolve player-enemy overlap: push enemies away from player.
        const pCenter = this.player.getCenter();
        const pRadius = this.player.width * 0.5;
        for (const enemy of this.currentEnemies) {
            const ec = enemy.getCenter();
            const dx = ec.x - pCenter.x;
            const dy = ec.y - pCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const minDist = pRadius + enemy.width * 0.45;
            if (dist < minDist) {
                const push = minDist - dist;
                enemy.x += (dx / dist) * push;
                enemy.y += (dy / dist) * push;
            }
        }
        }

        this.particles.update();
        for (const crack of this.cracks) {
            crack.life -= 1;
        }
        this.cracks = this.cracks.filter((c) => c.life > 0);

        if (this.currentEnemies.length === 0 && !this.ropePullAnim) {
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
            this.hudState.powerText = `${Math.round(this.power)}%`;
            this.hudState.powerPct = Math.max(0, this.power);
            this.hudState.status = 'Read the resume, then click "Yes, I will protect your resume".';

            const floorLevelEl = document.getElementById('floorLevel');
            if (floorLevelEl) floorLevelEl.textContent = this.hudState.floorLevel;
            const caughtCountEl = document.getElementById('caughtCount');
            if (caughtCountEl) caughtCountEl.textContent = this.hudState.caughtCount;
            const progressBarEl = document.getElementById('progressBar');
            if (progressBarEl) progressBarEl.style.width = `${this.hudState.progressPct}%`;
            const powerTextEl = document.getElementById('powerText');
            if (powerTextEl) powerTextEl.textContent = this.hudState.powerText;
            const powerBarEl = document.getElementById('powerBar');
            if (powerBarEl) powerBarEl.style.width = `${this.hudState.powerPct}%`;
            const statusEl = document.getElementById('statusText');
            if (statusEl) statusEl.textContent = this.hudState.status;
            return;
        }

        const total = this.getEnemyCountForFloor(this.currentFloor);
        const progressPct = (this.defeatedThisFloor / total) * 100;

        const powerPct = Math.round(this.power);

        let status = 'Resume Eating Bugs try to eat when you are far.';
        if (this.currentEnemies.length === 0 && !this.ropePullAnim) {
            status = `Floor cleared. Entering floor ${this.currentFloor + 1}...`;
        } else if (this.ropePullAnim) {
            if (this.ropePullAnim.phase === 'pull') status = 'Reeling in all bugs...';
            else if (this.ropePullAnim.phase === 'jump') status = 'SLAM!!!';
            else status = 'All bugs crushed!';
        } else if (this.power >= this.maxPower && this.isChargingShockwave) {
            status = 'Shockwave charging... release to detonate!';
        } else if (this.power >= this.maxPower) {
            status = 'Power full! Hold press to charge shockwave, release to blast all bugs.';
        } else if (this.currentFloor >= 11) {
            status = `Bug upgrade active (Tier ${this.getUpgradeTier(this.currentFloor)}). Bugs are STRONGER!`;
        }

        this.hudState.floorLevel = String(this.currentFloor);
        this.hudState.caughtCount = `${this.defeatedThisFloor} / ${total}`;
        this.hudState.progressPct = progressPct;
        this.hudState.powerText = `${powerPct}%`;
        this.hudState.powerPct = Math.max(0, this.power);
        this.hudState.status = status;

        const floorLevelEl = document.getElementById('floorLevel');
        if (floorLevelEl) floorLevelEl.textContent = this.hudState.floorLevel;
        const caughtCountEl = document.getElementById('caughtCount');
        if (caughtCountEl) caughtCountEl.textContent = this.hudState.caughtCount;
        const progressBarEl = document.getElementById('progressBar');
        if (progressBarEl) progressBarEl.style.width = `${this.hudState.progressPct}%`;
        const powerTextEl = document.getElementById('powerText');
        if (powerTextEl) powerTextEl.textContent = this.hudState.powerText;
        const powerBarEl = document.getElementById('powerBar');
        if (powerBarEl) powerBarEl.style.width = `${this.hudState.powerPct}%`;
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
        const typo = this.resumeTypography;
        this.ctx.fillStyle = '#2b2b2b';
        this.ctx.font = `bold ${typo.sectionTitleSize}px ${typo.family}`;
        this.ctx.fillText(text, x, y);
        this.ctx.strokeStyle = 'rgba(70, 70, 70, 0.25)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 8);
        this.ctx.lineTo(x + width, y + 8);
        this.ctx.stroke();
    }

    drawSkillEntry(label, items, x, y, maxWidth, lineHeight) {
        const typo = this.resumeTypography;
        const safeLabel = String(label || '').trim();
        const itemText = Array.isArray(items) ? items.join(', ') : String(items || '');

        this.ctx.fillStyle = '#2f2a22';
        this.ctx.font = `bold ${typo.technicalSkills.labelSize}px ${typo.family}`;
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
        this.ctx.font = `${typo.technicalSkills.itemSize}px ${typo.family}`;

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
        const leftNoteW = 340;
        const leftNoteH = 230;
        const rightNoteW = 320;
        const rightNoteH = 230;
        const leftX = this.resumeRect.x - (leftNoteW + 40);
        const topY = this.resumeRect.y + 80;
        const noteCenterX = leftX + leftNoteW * 0.5;

        this.drawStickyNote(leftX, topY, leftNoteW, leftNoteH, '#fff2a8', -0.05);
        this.ctx.fillStyle = '#4b3a20';
        if (!this.gameStarted) {
            this.ctx.font = 'bold 24px Georgia';
            this.ctx.fillText('Resume Defense Mission', leftX + 18, topY + 38);
            this.ctx.font = '16px Georgia';
            const questText = 'I need a brave hero like you to protect my resume from evil resume-eating bugs. My career prospects depend on this. Will you accept the task?';
            let questY = topY + 66;
            const questLines = this.getWrappedLines(questText, leftNoteW - 32);
            for (let i = 0; i < questLines.length && i < 7; i++) {
                this.ctx.fillText(questLines[i], leftX + 18, questY);
                questY += 20;
            }

            const buttonW = leftNoteW - 36;
            const buttonH = 34;
            const buttonX = noteCenterX - buttonW / 2;
            const buttonY = topY + 166;
            this.acceptButtonRect = { x: buttonX, y: buttonY, width: buttonW, height: buttonH };

            this.ctx.fillStyle = '#ffe07a';
            this.ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
            this.ctx.strokeStyle = '#8c6b1a';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(buttonX, buttonY, buttonW, buttonH);
            this.ctx.fillStyle = '#4b3a20';
            this.ctx.font = 'bold 14px Georgia';
            this.ctx.fillText('Yes, I will protect your resume', buttonX + 45, buttonY + 22);
            this.ctx.font = '12px Georgia';
            this.ctx.fillStyle = '#5b4d2f';
            this.ctx.fillText(`Data: ${this.getResumeDataSourceLabel()}`, leftX + 18, topY + 215);
        } else {
            this.acceptButtonRect = null;
            this.ctx.font = 'bold 28px Georgia';
            this.ctx.fillText('Protect My Resume', leftX + 20, topY + 42);
            this.ctx.font = '18px Georgia';
            this.ctx.fillText(`Floor: ${this.hudState.floorLevel}`, leftX + 20, topY + 72);
            this.ctx.fillText(`Bugs: ${this.hudState.caughtCount}`, leftX + 20, topY + 96);

            // Floor progress bar (labeled)
            this.ctx.font = '13px Georgia';
            this.ctx.fillStyle = '#8c6b1a';
            this.ctx.fillText('Floor Progress:', leftX + 20, topY + 116);
            this.ctx.fillStyle = '#efe1a0';
            this.ctx.fillRect(leftX + 20, topY + 122, leftNoteW - 40, 10);
            this.ctx.fillStyle = '#f08b4f';
            this.ctx.fillRect(leftX + 20, topY + 122, (leftNoteW - 40) * (this.hudState.progressPct / 100), 10);

            // Power bar (labeled)
            this.ctx.font = '18px Georgia';
            this.ctx.fillStyle = '#4b3a20';
            this.ctx.fillText(`Power: ${this.hudState.powerText}`, leftX + 20, topY + 154);
            const powerFull = this.hudState.powerPct >= 100;
            this.ctx.fillStyle = powerFull ? '#aad4ff' : '#dce8ff';
            this.ctx.fillRect(leftX + 20, topY + 160, leftNoteW - 40, 10);
            this.ctx.fillStyle = powerFull ? '#00aaff' : '#4e9bff';
            this.ctx.fillRect(leftX + 20, topY + 160, (leftNoteW - 40) * (this.hudState.powerPct / 100), 10);
            if (powerFull) {
                this.ctx.strokeStyle = '#00ccff';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(leftX + 20, topY + 160, leftNoteW - 40, 10);
                this.ctx.font = 'bold 13px Georgia';
                this.ctx.fillStyle = '#0077cc';
                this.ctx.fillText('FULL - Hold to charge shockwave!', leftX + 20, topY + 186);
            }
            this.ctx.font = '12px Georgia';
            this.ctx.fillStyle = '#5b4d2f';
            this.ctx.fillText(`Data: ${this.getResumeDataSourceLabel()}`, leftX + 20, topY + 210);
        }

        if (this.gameStarted) {
            this.drawStickyNote(this.resumeRect.x + this.resumeRect.width + 34, this.resumeRect.y + 90, rightNoteW, rightNoteH, '#d8f0ff', 0.06);
            this.ctx.fillStyle = '#2f3e49';
            this.ctx.font = 'bold 24px Georgia';
            this.ctx.fillText('Instructions', this.resumeRect.x + this.resumeRect.width + 54, this.resumeRect.y + 130);
            this.ctx.font = '17px Georgia';
            this.ctx.fillText('Move: Cursor / Touch', this.resumeRect.x + this.resumeRect.width + 54, this.resumeRect.y + 166);
            this.ctx.fillText('Attack: Click / Tap', this.resumeRect.x + this.resumeRect.width + 54, this.resumeRect.y + 194);
            this.ctx.fillText('Power Full: Hold, Release', this.resumeRect.x + this.resumeRect.width + 54, this.resumeRect.y + 222);
            this.ctx.fillText('R: Reset, B: Back', this.resumeRect.x + this.resumeRect.width + 54, this.resumeRect.y + 250);
        }
    }

    drawResumeTerrain() {
        const typo = this.resumeTypography;
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
            this.ctx.font = `bold ${typo.nameSize}px ${typo.family}`;
            const name = String((p.name || '').toUpperCase());
            const nameW = this.ctx.measureText(name).width;
            this.ctx.fillText(name, x + (pageW - nameW) / 2, cursorY);
            cursorY += 52;

            this.ctx.font = `bold ${typo.titleSize}px ${typo.family}`;
            const title = String(p.title || 'Software Developer');
            const titleW = this.ctx.measureText(title).width;
            this.ctx.fillText(title, x + (pageW - titleW) / 2, cursorY);
            cursorY += 40;

            this.ctx.font = `italic ${typo.contactSize}px ${typo.family}`;
            this.ctx.fillStyle = '#4c4336';
            const github = String(p.github || '').replace('https://', '');
            const contact = `${p.email || ''} || ${github}`;
            const contactW = this.ctx.measureText(contact).width;
            this.ctx.fillText(contact, x + (pageW - contactW) / 2, cursorY);
            cursorY += 34;

            this.drawSectionTitle('SUMMARY', left, cursorY, contentW);
            cursorY += 30;
            this.ctx.font = `${typo.summarySize}px ${typo.family}`;
            this.ctx.fillStyle = '#4a4438';
            cursorY = this.drawWrappedText(this.resumeData.summary || '', left, cursorY, contentW, typo.summaryLineHeight);
            cursorY += 20;

            this.drawSectionTitle('TECHNICAL SKILLS', left, cursorY, contentW);
            cursorY += 30;
            const skills = Array.isArray(this.resumeData.technicalSkills) ? this.resumeData.technicalSkills : [];
            for (const skill of skills) {
                cursorY = this.drawSkillEntry(
                    skill.label,
                    skill.items || [],
                    left,
                    cursorY,
                    contentW,
                    typo.technicalSkills.lineHeight
                );
                cursorY += typo.technicalSkills.itemGap;
            }
            cursorY += 20;

            this.drawSectionTitle('WORK EXPERIENCES', left, cursorY, contentW);
            cursorY += 32;
            const jobs = Array.isArray(this.resumeData.workExperience) ? this.resumeData.workExperience : [];
            const educationReserve = 220;
            for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
                const job = jobs[jobIndex];
                if (cursorY > y + pageH - educationReserve) break;
                this.ctx.fillStyle = '#2f2a22';
                this.ctx.font = `bold ${typo.workExperience.titleSize}px ${typo.family}`;
                const jobDate = String(job.dateRange || '');
                const jobDateWidth = this.ctx.measureText(jobDate).width;
                const jobTitleMaxWidth = Math.max(120, contentW - jobDateWidth - 20);
                cursorY = this.drawWrappedText(
                    job.title || '',
                    left,
                    cursorY,
                    jobTitleMaxWidth,
                    typo.workExperience.titleLineHeight,
                    2
                );
                this.drawRightAlignedText(jobDate, right, cursorY - typo.workExperience.titleLineHeight);
                cursorY += 5;

                this.ctx.font = `italic ${typo.workExperience.companySize}px ${typo.family}`;
                this.ctx.fillStyle = '#4c4336';
                this.ctx.fillText(job.company || '', left, cursorY);
                cursorY += 25;

                this.ctx.font = `${typo.workExperience.highlightSize}px ${typo.family}`;
                const highlights = Array.isArray(job.highlights) ? job.highlights : [];
                for (let b = 0; b < highlights.length; b++) {
                    const bullet = highlights[b];
                    if (cursorY > y + pageH - educationReserve + 8) break;
                    this.ctx.fillText('•', left + 4, cursorY);
                    cursorY = this.drawWrappedText(
                        bullet,
                        left + 22,
                        cursorY,
                        contentW - 22,
                        typo.workExperience.highlightLineHeight
                    );
                    cursorY += 3;
                }
                cursorY += typo.workExperience.jobGap;
            }

            if (cursorY < y + pageH - 120) {
                cursorY += 10;
                this.drawSectionTitle('EDUCATION', left, cursorY, contentW);
                cursorY += 30;
                this.ctx.font = `${typo.education.bodySize}px ${typo.family}`;
                this.ctx.fillStyle = '#4a4438';
                const edu = Array.isArray(this.resumeData.education) ? this.resumeData.education : [];
                for (const item of edu) {
                    if (cursorY > y + pageH - 100) break;
                    this.ctx.font = `bold ${typo.education.titleSize}px ${typo.family}`;
                    this.ctx.fillStyle = '#2f2a22';
                    const eduDate = String(item.dateRange || '');
                    const eduDateWidth = this.ctx.measureText(eduDate).width;
                    const eduTitleMaxWidth = Math.max(120, contentW - eduDateWidth - 18);
                    cursorY = this.drawWrappedText(
                        item.degree || '',
                        left,
                        cursorY,
                        eduTitleMaxWidth,
                        typo.education.titleLineHeight,
                        2
                    );
                    this.drawRightAlignedText(eduDate, right, cursorY - typo.education.titleLineHeight);
                    cursorY += 5;
                    this.ctx.font = `${typo.education.bodySize}px ${typo.family}`;
                    this.ctx.fillStyle = '#4a4438';
                    cursorY = this.drawWrappedText(
                        item.institution || '',
                        left,
                        cursorY,
                        contentW,
                        typo.education.institutionLineHeight,
                        2
                    );

                    const eduHighlights = Array.isArray(item.highlights) ? item.highlights : [];
                    if (eduHighlights.length > 0) {
                        cursorY += 4;
                        this.ctx.font = `${typo.education.highlightSize}px ${typo.family}`;
                        this.ctx.fillStyle = '#4a4438';
                        for (const bullet of eduHighlights) {
                            if (cursorY > y + pageH - 45) break;
                            this.ctx.fillText('•', left + 4, cursorY);
                            cursorY = this.drawWrappedText(
                                bullet,
                                left + 22,
                                cursorY,
                                contentW - 22,
                                typo.education.highlightLineHeight
                            );
                            cursorY += 3;
                        }
                    }

                    cursorY += typo.education.itemGap;
                }
            }
        } else {
            this.ctx.font = '18px Georgia';
            this.ctx.fillStyle = '#6f5e44';
            this.ctx.fillText('Resume data unavailable in this session.', left, y + 100);
            if (this.resumeLoadError) {
                this.ctx.font = '15px Georgia';
                this.ctx.fillText('Tip: run the project with Live Server / localhost.', left, y + 130);
                if (this.resumeLoadErrorMessage) {
                    this.ctx.font = '13px Georgia';
                    this.ctx.fillText(`Load error: ${this.resumeLoadErrorMessage}`, left, y + 156);
                }
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
        this.drawRopePull();
        if (this.gameStarted) {
            this.player.draw(this.ctx, this.getRopePullPlayerYOffset());
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

        if (!this.gameStarted) {
            this.drawPreStartScrollbars();
        }
    }

    gameLoop = () => {
        this.update();
        this.draw();
        requestAnimationFrame(this.gameLoop);
    }

    resetGame() {
        this.resumeHealth = 100;
        this.power = 0;
        this.isChargingShockwave = false;
        this.isHolding = false;
        this.shockwaveRings = [];
        this.ropePullAnim = null;
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
        this.power = 0;
        this.isChargingShockwave = false;
        this.isHolding = false;
        this.shockwaveRings = [];
        this.ropePullAnim = null;
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