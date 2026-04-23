// Main game logic
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Game states
        this.currentFloor = 1;
        this.totalFloors = 10;
        this.enemiesPerFloor = (floor) => 1 + floor; // 2 on floor 1, 3 on floor 2, etc.
        this.currentEnemies = [];
        this.caughtEnemies = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.floorClearedTime = 0;

        // Initialize player
        this.player = new Player(this.width / 2, this.height / 2);

        // Initialize particle system
        this.particles = new ParticleSystem();

        // Information points (scattered around the map)
        this.infoPoints = this.generateInfoPoints();

        // Selected info point
        this.selectedInfo = null;

        // Initialize enemies
        this.initializeFloor();

        // Canvas click handler for info points
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Start game loop
        this.gameLoop();
    }

    generateInfoPoints() {
        const points = [];
        const infoData = [
            { name: "Knight's Tale", info: "A skilled warrior training to become a legendary dragon slayer." },
            { name: "Ancient Dragon", info: "Legends speak of an ancient dragon guarding the knowledge realm." },
            { name: "Sacred Sword", info: "A legendary sword forged with ancient magic, waiting to be discovered." },
            { name: "Mystical Library", info: "Contains scrolls of programming wisdom and code enchantments." },
            { name: "Forest of Algorithms", info: "A place where optimization and logic dance together." },
            { name: "Tower of Knowledge", info: "Reaching the top grants understanding of all digital realms." },
            { name: "Code Crystals", info: "Rare gems that power the magic of computation." },
            { name: "Developer's Tavern", info: "Where programmers share tales of bugs and victories." },
            { name: "JavaScript Spell", info: "A powerful incantation that brings interactivity to the web." },
            { name: "Canvas Enchantment", info: "Magic that allows drawing and animation in the digital realm." }
        ];

        for (let i = 0; i < 5; i++) {
            const data = infoData[i];
            points.push({
                x: Math.random() * (this.width - 80) + 40,
                y: Math.random() * (this.height - 80) + 40,
                radius: 15,
                ...data
            });
        }
        return points;
    }

    initializeFloor() {
        this.currentEnemies = [];
        this.caughtEnemies = 0;

        const enemyCount = this.enemiesPerFloor(this.currentFloor);
        
        for (let i = 0; i < enemyCount; i++) {
            let x, y;
            let validPosition = false;

            // Generate random position away from player
            while (!validPosition) {
                x = Math.random() * (this.width - 50);
                y = Math.random() * (this.height - 50);
                const dx = x - this.player.x;
                const dy = y - this.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 150) {
                    validPosition = true;
                }
            }

            // Boss on floor 10
            const isBoss = this.currentFloor === this.totalFloors;
            this.currentEnemies.push(new Enemy(x, y, isBoss));
        }
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked on info point
        for (let point of this.infoPoints) {
            const dx = point.x - x;
            const dy = point.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < point.radius + 5) {
                this.selectedInfo = point;
                this.updateInfoDisplay();
                return;
            }
        }

        // Clicking elsewhere clears selection
        this.selectedInfo = null;
        this.updateInfoDisplay();
    }

    updateInfoDisplay() {
        const infoDisplay = document.getElementById('infoDisplay');
        if (this.selectedInfo) {
            infoDisplay.innerHTML = `
                <div class="info-panel">
                    <div class="info-title">ℹ️ ${this.selectedInfo.name}</div>
                    <p>${this.selectedInfo.info}</p>
                </div>
            `;
        } else {
            infoDisplay.innerHTML = '';
        }
    }

    update() {
        if (this.gameOver || this.gameWon) return;

        // Update player
        this.player.update(this.width, this.height);

        // Update enemies
        for (let enemy of this.currentEnemies) {
            enemy.update(this.player, this.width, this.height, this.currentEnemies);
        }

        // Check collisions with player
        for (let i = 0; i < this.currentEnemies.length; i++) {
            const enemy = this.currentEnemies[i];
            if (this.player.checkCollisionWithPoint(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                Math.max(enemy.width, enemy.height) / 2
            )) {
                // Enemy caught!
                this.particles.createCatch(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                this.currentEnemies.splice(i, 1);
                this.caughtEnemies++;
                i--;
            }
        }

        // Update particles
        this.particles.update();

        // Check if floor is cleared
        if (this.currentEnemies.length === 0 && this.caughtEnemies > 0) {
            if (this.currentFloor === this.totalFloors) {
                this.gameWon = true;
            } else {
                this.floorClearedTime++;
                if (this.floorClearedTime > 120) {
                    this.nextFloor();
                }
            }
        }

        // Update UI
        this.updateUI();
    }

    nextFloor() {
        this.currentFloor++;
        this.initializeFloor();
        this.floorClearedTime = 0;
        this.particles.clear();
    }

    updateUI() {
        document.getElementById('floorLevel').textContent = this.currentFloor;
        document.getElementById('caughtCount').textContent = `${this.caughtEnemies} / ${this.enemiesPerFloor(this.currentFloor)}`;

        // Progress bar
        const progress = (this.caughtEnemies / this.enemiesPerFloor(this.currentFloor)) * 100;
        document.getElementById('progressBar').style.width = progress + '%';

        // Monster indicators
        const indicatorsDiv = document.getElementById('monsterIndicators');
        indicatorsDiv.innerHTML = '';
        const totalMonsters = this.enemiesPerFloor(this.currentFloor);
        for (let i = 0; i < totalMonsters; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'monster-indicator' + (i < this.caughtEnemies ? ' caught' : '');
            indicator.textContent = i < this.caughtEnemies ? '✓' : '🐉';
            indicatorsDiv.appendChild(indicator);
        }

        // Floor clear message
        const infoDisplay = document.getElementById('infoDisplay');
        if (this.currentEnemies.length === 0 && this.caughtEnemies > 0) {
            if (this.gameWon) {
                infoDisplay.innerHTML = `
                    <div class="floor-clear" style="background: linear-gradient(135deg, #FFD700, #FFA500);">
                        🏆 GAME WON! 🏆<br>
                        <small>You defeated all dragons!</small>
                    </div>
                `;
            } else {
                infoDisplay.innerHTML = `
                    <div class="floor-clear">
                        ✅ Floor Cleared!<br>
                        <small>Next floor incoming...</small>
                    </div>
                `;
            }
        } else if (!this.selectedInfo && !this.gameWon && this.currentEnemies.length > 0) {
            infoDisplay.innerHTML = `
                <div class="info-panel">
                    <div class="info-title">📋 Status</div>
                    <p>Catch all dragons to progress!<br>Click info points to learn more.</p>
                </div>
            `;
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(135, 206, 235, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw grid background
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.height);
            this.ctx.stroke();
        }
        for (let i = 0; i < this.height; i += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.width, i);
            this.ctx.stroke();
        }

        // Draw info points
        for (let point of this.infoPoints) {
            const isSelected = this.selectedInfo === point;
            this.ctx.fillStyle = isSelected ? '#FFD700' : '#64C8FF';
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Glow effect
            this.ctx.strokeStyle = isSelected ? 'rgba(255, 215, 0, 0.5)' : 'rgba(100, 200, 255, 0.3)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, point.radius + 5, 0, Math.PI * 2);
            this.ctx.stroke();

            // Draw info icon
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('ℹ️', point.x, point.y);
        }

        // Draw enemies
        for (let enemy of this.currentEnemies) {
            enemy.draw(this.ctx);

            // Draw distance indicator when fleeing
            if (enemy.fleeing) {
                this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.panicDistance, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }

        // Draw player
        this.player.draw(this.ctx);

        // Draw particles
        this.particles.draw(this.ctx);

        // Draw floor number
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, 10, 150, 40);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Floor: ${this.currentFloor}/10`, 20, 35);
    }

    gameLoop = () => {
        this.update();
        this.draw();
        requestAnimationFrame(this.gameLoop);
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    new Game(canvas);
});
