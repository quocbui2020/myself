# Dragon Hunter - 2D Game Portfolio Project

An interactive **2D pixel art game** built with vanilla JavaScript and HTML5 Canvas for a professional portfolio/resume website.

## 🎮 Game Overview

**Dragon Hunter** is a progressive difficulty game where you control a knight on horseback to chase and catch dragons across 10 floors.

### Game Features
- ✅ **Progressive Floors**: Start with 2 dragons on Floor 1, increase to 10+ on later floors
- 🐉 **Smart AI Enemies**: Dragons flee when you approach, wander when relaxed
- 🏰 **Boss Battle**: Defeat the ultimate dragon boss on Floor 10
- ℹ️ **Information Points**: Clickable elements scattered around the map
- 🎨 **Pixel Art Graphics**: Retro-inspired hand-drawn assets using Canvas
- ⌨️ **Keyboard Controls**: WASD or Arrow Keys to move
- 🎯 **Visual Feedback**: Particle effects, progress indicators, floor tracking
- 📱 **Responsive Design**: Works on desktop and tablets

## 🗂️ Project Structure

```
myself/
├── index.html              # Portfolio homepage with game showcase
├── game.html               # Main game page
├── CSS/
│   └── styles.css          # Portfolio styling
├── js/
│   ├── game.js             # Main game logic & Game class
│   ├── player.js           # Player (knight) class & movement
│   ├── enemy.js            # Enemy (dragon) AI & behavior
│   └── particle.js         # Particle effects system
├── images/                 # Portfolio images
└── README.md               # This file
```

## 🚀 How to Run

### Option 1: Direct File Open
1. Open `index.html` in your web browser
2. Click "Play Dragon Hunter" button
3. Use WASD or Arrow Keys to move

### Option 2: Web Server (Recommended)
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (with http-server)
npx http-server

# Using Live Server in VS Code
# Install "Live Server" extension, then right-click index.html → "Open with Live Server"
```

Then navigate to `http://localhost:8000` and click the game link.

## 🎮 Controls

| Key | Action |
|-----|--------|
| **W** / **↑** | Move Up |
| **A** / **←** | Move Left |
| **S** / **↓** | Move Down |
| **D** / **→** | Move Right |
| **Mouse Click** | Click info points to learn |

## 🎯 Gameplay Tips

1. **Chase Pattern**: When dragons see you, they run away. Keep chasing!
2. **Strategy**: Herd multiple dragons together to catch them more efficiently
3. **Info Points**: Learn about your programming journey by clicking blue info circles
4. **Progressive Difficulty**: Each floor adds more dragons to catch
5. **Boss Monster**: Floor 10 has a glowing red dragon boss that's harder to catch

## 💾 Game States

### Floor Progression
- **Floor 1**: 2 dragons
- **Floor 2**: 3 dragons
- **Floor 3**: 4 dragons
- ...
- **Floor 10**: Boss battle with enhanced dragon
- **Victory**: Win screen after completing Floor 10

### UI Elements
- **Progress Bar**: Shows how many dragons you've caught
- **Monster Indicators**: Visual checkmarks for caught dragons
- **Floor Level**: Current floor display
- **Info Panel**: Displays selected information or floor status

## 🎨 Class Structure

### Game Class
- Manages game state, floors, enemy spawning
- Handles collisions and catch detection
- Controls game loop and rendering

### Player Class
- Represents the knight on horseback
- Handles keyboard input and movement
- Collision detection with enemies

### Enemy Class
- Represents dragons with AI behavior
- Flees from player when too close
- Wanders randomly when peaceful
- Boss variant with enhanced stats

### ParticleSystem & Particle Classes
- Visual feedback for catching dragons
- Explosion effects at catch locations
- Self-managing particle lifecycle

## 🔧 Customization

### Change Dragon Colors
Edit `js/enemy.js`:
```javascript
// Line ~80 for regular dragons
ctx.fillStyle = '#8B008B'; // Change this color

// Line ~17 for boss dragon
ctx.fillStyle = '#FF4500'; // Change this color
```

### Adjust Difficulty
Edit `js/game.js`:
```javascript
// Line ~30 - enemies per floor formula
this.enemiesPerFloor = (floor) => 1 + floor; // Change formula here
```

### Modify Knight Appearance
Edit `js/player.js` - The `draw()` method contains all knight rendering code

### Add More Information Points
Edit `js/game.js` - Modify the `infoData` array in `generateInfoPoints()` method

## 📊 Technical Stack

- **Language**: Vanilla JavaScript (ES6+)
- **Graphics**: HTML5 Canvas API
- **Animation**: RequestAnimationFrame
- **Architecture**: Object-Oriented Programming (Classes)
- **Compatibility**: All modern browsers (Chrome, Firefox, Safari, Edge)

## 🎓 Learning Outcomes

This project demonstrates:
- ✅ Canvas API mastery (drawing, animations, transformations)
- ✅ Game loop implementation
- ✅ Collision detection algorithms
- ✅ AI pathfinding and behavior
- ✅ Event handling (keyboard, mouse)
- ✅ Object-Oriented design patterns
- ✅ Particle systems for visual effects
- ✅ Responsive UI design

## 📱 Browser Support

| Browser | Support |
|---------|---------|
| Chrome/Edge | ✅ Full |
| Firefox | ✅ Full |
| Safari | ✅ Full |
| Mobile Safari | ⚠️ Keyboard input limited |
| Chrome Mobile | ⚠️ Keyboard input limited |

## 🐛 Known Limitations

- Mobile touch controls not implemented (keyboard only)
- No sound/music (can be added with Web Audio API)
- No save/load system
- Single player only

## 🚀 Future Enhancements

Potential improvements:
- [ ] Touch controls for mobile
- [ ] Sound effects and background music
- [ ] Leaderboard system
- [ ] Power-ups and special items
- [ ] Different environment themes
- [ ] Multiplayer mode
- [ ] Save progress to localStorage

## 👨‍💻 About the Developer

This game was created by **Quoc Ngoc Bui** as a portfolio project showcasing web development skills and game programming expertise.

**Skills Demonstrated:**
- Game Development (Canvas API)
- JavaScript ES6+
- Object-Oriented Programming
- HTML5 & CSS3
- Problem Solving & Algorithm Design
- UI/UX Implementation

**Portfolio**: [View Full Portfolio](./index.html)

## 📄 License

This project is part of a personal portfolio and is provided as-is for educational and demonstration purposes.

---

**Last Updated**: 2026  
**Version**: 1.0  
**Status**: ✅ Fully Functional

---

**GitHub Pages**: [https://github.com/quocbui2020/myself](https://quocbui2020.github.io/myself/)  
**Settings > Pages** (left nav) -- This is where to publish your web app.
