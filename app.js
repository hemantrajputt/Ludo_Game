// Family Game Configuration
const GAME_CONFIG = {
    colors: {
        red: "#FF4444",
        blue: "#4444FF", 
        green: "#44FF44",
        yellow: "#FFFF44",
        orange: "#FF8844",
        purple: "#8844FF"
    },
    boardSize: 600,
    tokenSize: 18,
    // Safe zones: starting squares + star-marked squares
    safeZones: {
        starting: [1, 14, 27, 40], // Starting squares with arrows
        star: [9, 22, 35, 48] // Star-marked safe squares
    },
    startingPositions: {
        red: 1,
        blue: 14,
        green: 27,
        yellow: 40,
        orange: 6,
        purple: 19
    },
    animations: {
        diceRoll: 1000,
        tokenMove: 800,
        capture: 500,
        celebration: 2000
    }
};

// Particle Effects System
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.container = document.getElementById('particles-container');
    }

    createParticle(x, y, color = '#FFD700', size = 6) {
        if (!this.container) return;
        
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.backgroundColor = color;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        this.container.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 3000);
    }

    createExplosion(x, y, color = '#FFD700') {
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const offsetX = (Math.random() - 0.5) * 100;
                const offsetY = (Math.random() - 0.5) * 100;
                this.createParticle(x + offsetX, y + offsetY, color, Math.random() * 8 + 4);
            }, i * 50);
        }
    }

    createCelebration() {
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                const color = colors[Math.floor(Math.random() * colors.length)];
                this.createParticle(x, y, color, Math.random() * 10 + 5);
            }, i * 100);
        }
    }
}

// Family Game State
class GameState {
    constructor() {
        this.rooms = new Map();
        this.currentRoom = null;
        this.currentPlayer = null;
        this.gameStarted = false;
        this.roundCounter = 1;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createRoom(hostName) {
        const code = this.generateRoomCode();
        const room = {
            code,
            host: hostName,
            players: [{ name: hostName, color: 'red', isHost: true }],
            maxPlayers: 4,
            gameState: null,
            isGameStarted: false
        };
        this.rooms.set(code, room);
        this.currentRoom = room;
        this.currentPlayer = room.players[0];
        return room;
    }

    joinRoom(code, playerName) {
        const room = this.rooms.get(code);
        if (!room) return null;
        if (room.players.length >= room.maxPlayers) return null;
        if (room.isGameStarted) return null;

        // Check if player name already exists in room
        if (room.players.some(p => p.name === playerName)) {
            return null;
        }

        const colors = Object.keys(GAME_CONFIG.colors);
        const usedColors = room.players.map(p => p.color);
        const availableColor = colors.find(c => !usedColors.includes(c));

        const player = { 
            name: playerName, 
            color: availableColor || colors[room.players.length % colors.length],
            isHost: false 
        };
        room.players.push(player);
        this.currentRoom = room;
        this.currentPlayer = player;
        return room;
    }

    leaveRoom() {
        if (!this.currentRoom) return;
        
        const playerIndex = this.currentRoom.players.findIndex(p => p.name === this.currentPlayer.name);
        if (playerIndex !== -1) {
            this.currentRoom.players.splice(playerIndex, 1);
        }

        if (this.currentRoom.players.length === 0) {
            this.rooms.delete(this.currentRoom.code);
        } else if (this.currentPlayer.isHost && this.currentRoom.players.length > 0) {
            this.currentRoom.players[0].isHost = true;
            this.currentRoom.host = this.currentRoom.players[0].name;
        }

        this.currentRoom = null;
        this.currentPlayer = null;
    }
}

// Family Ludo Game Logic
class LudoGame {
    constructor(players, canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.players = players;
        this.currentPlayerIndex = 0;
        this.diceValue = 1;
        this.gameBoard = this.initializeBoard();
        this.tokens = this.initializeTokens();
        this.selectedToken = null;
        this.gameOver = false;
        this.rankings = []; // Track completion order
        this.finishedPlayers = new Set(); // Track who has finished
        this.extraTurn = false;
        this.hasRolled = false;
        this.particleSystem = new ParticleSystem();
        this.roundCounter = 1;
        
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.drawBoard();
    }

    initializeBoard() {
        const board = [];
        for (let i = 0; i < 52; i++) {
            board.push({ occupied: false, color: null, tokenId: null });
        }
        return board;
    }

    initializeTokens() {
        const tokens = {};
        this.players.forEach((player, playerIndex) => {
            tokens[player.color] = [];
            for (let i = 0; i < 4; i++) {
                tokens[player.color].push({
                    id: `${player.color}-${i}`,
                    position: -1,
                    isHome: false,
                    isInPlay: false,
                    homePosition: -1,
                    isSafe: false
                });
            }
        });
        return tokens;
    }

    drawBoard() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw board background with gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawCrossBoard();
        this.drawStartingAreas();
        this.drawHomeAreas();
        this.drawSafeZones();
        this.drawTokens();
    }

    drawCrossBoard() {
        const size = this.canvas.width;
        const cellSize = size / 15;
        
        // Draw the main cross paths with family-friendly styling
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 3;
        
        // Vertical path
        const verticalGradient = this.ctx.createLinearGradient(6 * cellSize, 0, 9 * cellSize, 0);
        verticalGradient.addColorStop(0, '#ffffff');
        verticalGradient.addColorStop(1, '#f8f9fa');
        this.ctx.fillStyle = verticalGradient;
        this.ctx.fillRect(6 * cellSize, 0, 3 * cellSize, size);
        this.ctx.strokeRect(6 * cellSize, 0, 3 * cellSize, size);
        
        // Horizontal path
        const horizontalGradient = this.ctx.createLinearGradient(0, 6 * cellSize, 0, 9 * cellSize);
        horizontalGradient.addColorStop(0, '#ffffff');
        horizontalGradient.addColorStop(1, '#f8f9fa');
        this.ctx.fillStyle = horizontalGradient;
        this.ctx.fillRect(0, 6 * cellSize, size, 3 * cellSize);
        this.ctx.strokeRect(0, 6 * cellSize, size, 3 * cellSize);
        
        // Draw colored tracks
        this.drawColoredTracks(cellSize);
        
        // Draw grid lines
        this.ctx.strokeStyle = '#dee2e6';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i <= 15; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * cellSize, 0);
            this.ctx.lineTo(i * cellSize, size);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * cellSize);
            this.ctx.lineTo(size, i * cellSize);
            this.ctx.stroke();
        }
    }

    drawColoredTracks(cellSize) {
        const tracks = [
            { color: 'red', positions: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }] },
            { color: 'blue', positions: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }] },
            { color: 'green', positions: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }] },
            { color: 'yellow', positions: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }] }
        ];
        
        tracks.forEach(track => {
            if (this.players.some(p => p.color === track.color)) {
                this.ctx.fillStyle = GAME_CONFIG.colors[track.color];
                this.ctx.globalAlpha = 0.3;
                track.positions.forEach(pos => {
                    this.ctx.fillRect(pos.x * cellSize, pos.y * cellSize, cellSize, cellSize);
                });
                this.ctx.globalAlpha = 1;
            }
        });
    }

    drawStartingAreas() {
        const size = this.canvas.width;
        const cellSize = size / 15;
        
        const startingAreas = [
            { x: 1, y: 1, color: 'red' },
            { x: 9, y: 1, color: 'blue' },
            { x: 9, y: 9, color: 'green' },
            { x: 1, y: 9, color: 'yellow' }
        ];
        
        if (this.players.length > 4) {
            startingAreas.push({ x: 1, y: 5, color: 'orange' });
        }
        if (this.players.length > 5) {
            startingAreas.push({ x: 9, y: 5, color: 'purple' });
        }
        
        startingAreas.forEach(area => {
            if (this.players.some(p => p.color === area.color)) {
                // Draw gradient background
                const gradient = this.ctx.createRadialGradient(
                    (area.x + 2) * cellSize, (area.y + 2) * cellSize, 0,
                    (area.x + 2) * cellSize, (area.y + 2) * cellSize, 2 * cellSize
                );
                gradient.addColorStop(0, GAME_CONFIG.colors[area.color] + '40');
                gradient.addColorStop(1, GAME_CONFIG.colors[area.color] + '10');
                
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(area.x * cellSize, area.y * cellSize, 4 * cellSize, 4 * cellSize);
                
                // Draw border
                this.ctx.strokeStyle = GAME_CONFIG.colors[area.color];
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(area.x * cellSize, area.y * cellSize, 4 * cellSize, 4 * cellSize);
                
                // Draw arrow indicating starting position
                this.drawArrow(area.x * cellSize + 2 * cellSize, area.y * cellSize + 2 * cellSize, area.color);
            }
        });
    }

    drawArrow(x, y, color) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.fillStyle = GAME_CONFIG.colors[color];
        this.ctx.beginPath();
        this.ctx.moveTo(0, -15);
        this.ctx.lineTo(10, 0);
        this.ctx.lineTo(0, 15);
        this.ctx.lineTo(-10, 0);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    drawHomeAreas() {
        const size = this.canvas.width;
        const cellSize = size / 15;
        
        const homeAreas = [
            { x: 7, y: 1, color: 'red', dir: 'down' },
            { x: 13, y: 7, color: 'blue', dir: 'left' },
            { x: 7, y: 13, color: 'green', dir: 'up' },
            { x: 1, y: 7, color: 'yellow', dir: 'right' }
        ];
        
        homeAreas.forEach(area => {
            if (this.players.some(p => p.color === area.color)) {
                const gradient = this.ctx.createRadialGradient(
                    (area.x + 0.5) * cellSize, (area.y + 0.5) * cellSize, 0,
                    (area.x + 0.5) * cellSize, (area.y + 0.5) * cellSize, cellSize
                );
                gradient.addColorStop(0, GAME_CONFIG.colors[area.color] + '80');
                gradient.addColorStop(1, GAME_CONFIG.colors[area.color] + '20');
                
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                
                const centerX = (area.x + 0.5) * cellSize;
                const centerY = (area.y + 0.5) * cellSize;
                
                switch (area.dir) {
                    case 'down':
                        this.ctx.moveTo(centerX, area.y * cellSize);
                        this.ctx.lineTo(area.x * cellSize, (area.y + 1) * cellSize);
                        this.ctx.lineTo((area.x + 1) * cellSize, (area.y + 1) * cellSize);
                        break;
                    case 'left':
                        this.ctx.moveTo((area.x + 1) * cellSize, centerY);
                        this.ctx.lineTo(area.x * cellSize, area.y * cellSize);
                        this.ctx.lineTo(area.x * cellSize, (area.y + 1) * cellSize);
                        break;
                    case 'up':
                        this.ctx.moveTo(centerX, (area.y + 1) * cellSize);
                        this.ctx.lineTo(area.x * cellSize, area.y * cellSize);
                        this.ctx.lineTo((area.x + 1) * cellSize, area.y * cellSize);
                        break;
                    case 'right':
                        this.ctx.moveTo(area.x * cellSize, centerY);
                        this.ctx.lineTo((area.x + 1) * cellSize, area.y * cellSize);
                        this.ctx.lineTo((area.x + 1) * cellSize, (area.y + 1) * cellSize);
                        break;
                }
                
                this.ctx.closePath();
                this.ctx.fill();
            }
        });
    }

    drawSafeZones() {
        const size = this.canvas.width;
        const cellSize = size / 15;
        
        // Starting safe zones (with shield icons)
        const startingSafePositions = [
            { x: 6, y: 1 }, { x: 8, y: 1 }, // Red starting zone
            { x: 13, y: 6 }, { x: 13, y: 8 }, // Blue starting zone
            { x: 6, y: 13 }, { x: 8, y: 13 }, // Green starting zone
            { x: 1, y: 6 }, { x: 1, y: 8 } // Yellow starting zone
        ];
        
        // Star safe zones
        const starSafePositions = [
            { x: 6, y: 2 }, { x: 8, y: 6 }, { x: 12, y: 8 }, { x: 6, y: 12 }
        ];
        
        // Draw shield safe zones
        this.ctx.fillStyle = '#3498db';
        this.ctx.strokeStyle = '#2980b9';
        this.ctx.lineWidth = 2;
        
        startingSafePositions.forEach(pos => {
            this.drawShield((pos.x + 0.5) * cellSize, (pos.y + 0.5) * cellSize, cellSize * 0.3);
        });
        
        // Draw star safe zones
        this.ctx.fillStyle = '#f39c12';
        this.ctx.strokeStyle = '#e67e22';
        
        starSafePositions.forEach(pos => {
            this.drawStar((pos.x + 0.5) * cellSize, (pos.y + 0.5) * cellSize, cellSize * 0.3);
        });
    }

    drawShield(x, y, size) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.quadraticCurveTo(size * 0.8, -size, size * 0.8, -size * 0.3);
        this.ctx.quadraticCurveTo(size * 0.8, size * 0.8, 0, size);
        this.ctx.quadraticCurveTo(-size * 0.8, size * 0.8, -size * 0.8, -size * 0.3);
        this.ctx.quadraticCurveTo(-size * 0.8, -size, 0, -size);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawStar(x, y, size) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.beginPath();
        
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x1 = Math.cos(angle) * size;
            const y1 = Math.sin(angle) * size;
            
            const angle2 = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
            const x2 = Math.cos(angle2) * size * 0.5;
            const y2 = Math.sin(angle2) * size * 0.5;
            
            if (i === 0) {
                this.ctx.moveTo(x1, y1);
            } else {
                this.ctx.lineTo(x1, y1);
            }
            this.ctx.lineTo(x2, y2);
        }
        
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawTokens() {
        const size = this.canvas.width;
        const cellSize = size / 15;
        
        // Draw tokens with family-friendly 3D effect
        this.players.forEach(player => {
            const playerTokens = this.tokens[player.color];
            playerTokens.forEach((token, index) => {
                if (token.position === -1) {
                    this.drawTokenInStartingArea(player.color, index, cellSize);
                } else if (token.isHome) {
                    this.drawTokenInHomeArea(player.color, token.homePosition, cellSize);
                } else {
                    this.drawTokenOnBoard(player.color, token.position, cellSize, token.isSafe);
                }
            });
        });
    }

    drawTokenInStartingArea(color, tokenIndex, cellSize) {
        const startingPositions = {
            red: { x: 1, y: 1 },
            blue: { x: 9, y: 1 },
            green: { x: 9, y: 9 },
            yellow: { x: 1, y: 9 },
            orange: { x: 1, y: 5 },
            purple: { x: 9, y: 5 }
        };
        
        const start = startingPositions[color];
        if (!start) return;
        
        const tokenPositions = [
            { x: 0.7, y: 0.7 }, { x: 3.3, y: 0.7 },
            { x: 0.7, y: 3.3 }, { x: 3.3, y: 3.3 }
        ];
        
        const pos = tokenPositions[tokenIndex];
        const x = (start.x + pos.x) * cellSize;
        const y = (start.y + pos.y) * cellSize;
        
        this.drawFamilyToken(x, y, color, false);
    }

    drawTokenInHomeArea(color, homePosition, cellSize) {
        const homePositions = {
            red: [{ x: 7.5, y: 2 }, { x: 7.5, y: 3 }, { x: 7.5, y: 4 }, { x: 7.5, y: 5 }],
            blue: [{ x: 12, y: 7.5 }, { x: 11, y: 7.5 }, { x: 10, y: 7.5 }, { x: 9, y: 7.5 }],
            green: [{ x: 7.5, y: 12 }, { x: 7.5, y: 11 }, { x: 7.5, y: 10 }, { x: 7.5, y: 9 }],
            yellow: [{ x: 2, y: 7.5 }, { x: 3, y: 7.5 }, { x: 4, y: 7.5 }, { x: 5, y: 7.5 }]
        };
        
        const positions = homePositions[color];
        if (!positions || homePosition >= positions.length) return;
        
        const pos = positions[homePosition];
        const x = pos.x * cellSize;
        const y = pos.y * cellSize;
        
        this.drawFamilyToken(x, y, color, false, true);
    }

    drawTokenOnBoard(color, position, cellSize, isSafe = false) {
        const boardPositions = this.getBoardPositions(cellSize);
        if (position < 0 || position >= boardPositions.length) return;
        
        const pos = boardPositions[position];
        this.drawFamilyToken(pos.x, pos.y, color, isSafe);
    }

    drawFamilyToken(x, y, color, isSafe = false, isHome = false) {
        const size = GAME_CONFIG.tokenSize;
        
        // Draw shadow
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x + 2, y + 2, size + 2, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.restore();
        
        // Draw token base
        const gradient = this.ctx.createRadialGradient(x - size/2, y - size/2, 0, x, y, size);
        gradient.addColorStop(0, this.lightenColor(GAME_CONFIG.colors[color], 40));
        gradient.addColorStop(1, GAME_CONFIG.colors[color]);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw token border
        this.ctx.strokeStyle = this.darkenColor(GAME_CONFIG.colors[color], 30);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw highlight
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.beginPath();
        this.ctx.arc(x - size/3, y - size/3, size/3, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.restore();
        
        // Draw safe zone indicator
        if (isSafe) {
            this.ctx.save();
            this.ctx.strokeStyle = '#f39c12';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(x, y, size + 6, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.restore();
        }
        
        // Draw home indicator
        if (isHome) {
            this.ctx.save();
            this.ctx.strokeStyle = '#27ae60';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
            (G > 0 ? G : 0) * 0x100 + (B > 0 ? B : 0)).toString(16).slice(1);
    }

    getBoardPositions(cellSize) {
        const positions = [];
        
        // Define the 52 positions around the board
        const pathPositions = [
            // Bottom row of vertical path (positions 0-5)
            { x: 6.5, y: 14.5 }, { x: 6.5, y: 13.5 }, { x: 6.5, y: 12.5 }, 
            { x: 6.5, y: 11.5 }, { x: 6.5, y: 10.5 }, { x: 6.5, y: 9.5 },
            // Turn to horizontal path (positions 6-12)
            { x: 5.5, y: 8.5 }, { x: 4.5, y: 8.5 }, { x: 3.5, y: 8.5 }, 
            { x: 2.5, y: 8.5 }, { x: 1.5, y: 8.5 }, { x: 0.5, y: 8.5 },
            { x: 0.5, y: 7.5 },
            // Left column (positions 13-18)
            { x: 0.5, y: 6.5 }, { x: 1.5, y: 6.5 }, { x: 2.5, y: 6.5 }, 
            { x: 3.5, y: 6.5 }, { x: 4.5, y: 6.5 }, { x: 5.5, y: 6.5 },
            // Turn up (positions 19-25)
            { x: 6.5, y: 5.5 }, { x: 6.5, y: 4.5 }, { x: 6.5, y: 3.5 }, 
            { x: 6.5, y: 2.5 }, { x: 6.5, y: 1.5 }, { x: 6.5, y: 0.5 },
            { x: 7.5, y: 0.5 },
            // Top row (positions 26-31)
            { x: 8.5, y: 0.5 }, { x: 8.5, y: 1.5 }, { x: 8.5, y: 2.5 }, 
            { x: 8.5, y: 3.5 }, { x: 8.5, y: 4.5 }, { x: 8.5, y: 5.5 },
            // Turn right (positions 32-38)
            { x: 9.5, y: 6.5 }, { x: 10.5, y: 6.5 }, { x: 11.5, y: 6.5 }, 
            { x: 12.5, y: 6.5 }, { x: 13.5, y: 6.5 }, { x: 14.5, y: 6.5 },
            { x: 14.5, y: 7.5 },
            // Right column (positions 39-44)
            { x: 14.5, y: 8.5 }, { x: 13.5, y: 8.5 }, { x: 12.5, y: 8.5 }, 
            { x: 11.5, y: 8.5 }, { x: 10.5, y: 8.5 }, { x: 9.5, y: 8.5 },
            // Turn down (positions 45-51)
            { x: 8.5, y: 9.5 }, { x: 8.5, y: 10.5 }, { x: 8.5, y: 11.5 }, 
            { x: 8.5, y: 12.5 }, { x: 8.5, y: 13.5 }, { x: 8.5, y: 14.5 },
            { x: 7.5, y: 14.5 }
        ];
        
        return pathPositions.map(pos => ({
            x: pos.x * cellSize,
            y: pos.y * cellSize
        }));
    }

    rollDice() {
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        this.extraTurn = this.diceValue === 6;
        this.hasRolled = true;
        return this.diceValue;
    }

    canMoveToken(color, tokenIndex) {
        const token = this.tokens[color][tokenIndex];
        if (token.isHome) return false;
        
        if (token.position === -1) {
            return this.diceValue === 6;
        }
        
        return true;
    }

    isSafePosition(position) {
        const allSafePositions = [
            ...GAME_CONFIG.safeZones.starting,
            ...GAME_CONFIG.safeZones.star
        ];
        return allSafePositions.includes(position);
    }

    moveToken(color, tokenIndex) {
        const token = this.tokens[color][tokenIndex];
        if (!this.canMoveToken(color, tokenIndex)) return false;
        
        if (token.position === -1) {
            token.position = GAME_CONFIG.startingPositions[color];
            token.isInPlay = true;
            token.isSafe = this.isSafePosition(token.position);
        } else {
            const newPosition = (token.position + this.diceValue) % 52;
            
            if (this.shouldEnterHome(color, token.position, this.diceValue)) {
                token.isHome = true;
                token.homePosition = this.getHomePosition(color, token.position, this.diceValue);
                token.position = -1;
                token.isSafe = false;
                
                // Create celebration particles
                const rect = this.canvas.getBoundingClientRect();
                this.particleSystem.createExplosion(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                    GAME_CONFIG.colors[color]
                );
            } else {
                const capturedToken = this.checkCapture(color, newPosition);
                if (capturedToken) {
                    // Create capture explosion
                    const boardPositions = this.getBoardPositions(this.canvas.width / 15);
                    const pos = boardPositions[newPosition];
                    const rect = this.canvas.getBoundingClientRect();
                    this.particleSystem.createExplosion(
                        rect.left + pos.x,
                        rect.top + pos.y,
                        '#ff6b6b'
                    );
                }
                
                token.position = newPosition;
                token.isSafe = this.isSafePosition(newPosition);
            }
        }
        
        this.drawBoard();
        this.hasRolled = false;
        return true;
    }

    shouldEnterHome(color, currentPosition, diceValue) {
        const homeEntries = {
            red: 51,
            blue: 12,
            green: 25,
            yellow: 38
        };
        
        const homeEntry = homeEntries[color];
        if (!homeEntry) return false;
        
        const newPosition = currentPosition + diceValue;
        return newPosition >= homeEntry && currentPosition < homeEntry;
    }

    getHomePosition(color, currentPosition, diceValue) {
        const homeEntries = {
            red: 51,
            blue: 12,
            green: 25,
            yellow: 38
        };
        
        const homeEntry = homeEntries[color];
        return Math.min(3, currentPosition + diceValue - homeEntry);
    }

    checkCapture(color, position) {
        if (this.isSafePosition(position)) return null;
        
        for (const playerColor in this.tokens) {
            if (playerColor === color) continue;
            
            const opponentTokens = this.tokens[playerColor];
            for (let i = 0; i < opponentTokens.length; i++) {
                const token = opponentTokens[i];
                if (token.position === position && !token.isSafe) {
                    token.position = -1;
                    token.isInPlay = false;
                    token.isSafe = false;
                    this.showMessage(`${this.getPlayerName(color)} captured ${this.getPlayerName(playerColor)}'s token!`);
                    return token;
                }
            }
        }
        return null;
    }

    getPlayerName(color) {
        const player = this.players.find(p => p.color === color);
        return player ? player.name : color;
    }

    checkPlayerFinished(color) {
        const tokens = this.tokens[color];
        const allHome = tokens.every(token => token.isHome);
        
        if (allHome && !this.finishedPlayers.has(color)) {
            this.finishedPlayers.add(color);
            const player = this.players.find(p => p.color === color);
            this.rankings.push({
                position: this.rankings.length + 1,
                name: player.name,
                color: color
            });
            this.showMessage(`${player.name} finished! Well played!`);
        }
        
        return allHome;
    }

    checkGameEnd() {
        // Check if any new players finished
        this.players.forEach(player => {
            this.checkPlayerFinished(player.color);
        });
        
        // Game ends when only 1 player remains (hasn't finished)
        const activePlayers = this.players.length - this.finishedPlayers.size;
        
        if (activePlayers <= 1) {
            this.gameOver = true;
            
            // Add the last remaining player to rankings
            const lastPlayer = this.players.find(p => !this.finishedPlayers.has(p.color));
            if (lastPlayer) {
                this.rankings.push({
                    position: this.rankings.length + 1,
                    name: lastPlayer.name,
                    color: lastPlayer.color
                });
            }
            
            return true;
        }
        
        return false;
    }

    nextPlayer() {
        if (!this.extraTurn) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            if (this.currentPlayerIndex === 0) {
                this.roundCounter++;
                this.updateRoundCounter();
            }
        }
        this.extraTurn = false;
        this.hasRolled = false;
    }

    updateRoundCounter() {
        const roundElement = document.getElementById('round-counter');
        if (roundElement) {
            roundElement.textContent = this.roundCounter;
        }
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getMovableTokens(color) {
        const tokens = this.tokens[color];
        const movableTokens = [];
        
        for (let i = 0; i < tokens.length; i++) {
            if (this.canMoveToken(color, i)) {
                movableTokens.push(i);
            }
        }
        
        return movableTokens;
    }

    handleCanvasClick(event) {
        if (this.gameOver || !this.hasRolled) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const currentPlayer = this.getCurrentPlayer();
        const movableTokens = this.getMovableTokens(currentPlayer.color);
        
        if (movableTokens.length === 0) return;
        
        const clickedToken = this.getTokenAtPosition(x, y, currentPlayer.color);
        if (clickedToken !== -1 && movableTokens.includes(clickedToken)) {
            this.moveToken(currentPlayer.color, clickedToken);
            
            if (this.checkGameEnd()) {
                this.particleSystem.createCelebration();
                setTimeout(() => {
                    this.showRankings();
                }, 1000);
            } else {
                this.nextPlayer();
                this.updateUI();
            }
        }
    }

    getTokenAtPosition(x, y, color) {
        const cellSize = this.canvas.width / 15;
        const tokens = this.tokens[color];
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            let tokenX, tokenY;
            
            if (token.position === -1) {
                const startingPositions = {
                    red: { x: 1, y: 1 },
                    blue: { x: 9, y: 1 },
                    green: { x: 9, y: 9 },
                    yellow: { x: 1, y: 9 },
                    orange: { x: 1, y: 5 },
                    purple: { x: 9, y: 5 }
                };
                
                const start = startingPositions[color];
                if (!start) continue;
                
                const tokenPositions = [
                    { x: 0.7, y: 0.7 }, { x: 3.3, y: 0.7 },
                    { x: 0.7, y: 3.3 }, { x: 3.3, y: 3.3 }
                ];
                
                const pos = tokenPositions[i];
                tokenX = (start.x + pos.x) * cellSize;
                tokenY = (start.y + pos.y) * cellSize;
            } else {
                const boardPositions = this.getBoardPositions(cellSize);
                const pos = boardPositions[token.position];
                tokenX = pos.x;
                tokenY = pos.y;
            }
            
            const distance = Math.sqrt((x - tokenX) ** 2 + (y - tokenY) ** 2);
            if (distance <= GAME_CONFIG.tokenSize + 5) {
                return i;
            }
        }
        
        return -1;
    }

    showMessage(message) {
        const messageElement = document.getElementById('game-messages');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.style.animation = 'messageFlash 0.5s ease-in-out';
            setTimeout(() => {
                messageElement.style.animation = '';
            }, 500);
        }
    }

    showRankings() {
        const modal = document.getElementById('winner-modal');
        const rankingsDisplay = document.getElementById('rankings-display');
        
        if (modal && rankingsDisplay) {
            rankingsDisplay.innerHTML = '';
            
            const medals = ['🥇', '🥈', '🥉', '👏', '👏', '👏'];
            
            this.rankings.forEach((ranking, index) => {
                const rankingItem = document.createElement('div');
                rankingItem.className = 'ranking-item';
                rankingItem.innerHTML = `
                    <div class="ranking-position">${ranking.position}</div>
                    <div class="ranking-name">${ranking.name}</div>
                    <div class="ranking-medal">${medals[index] || '👏'}</div>
                `;
                rankingsDisplay.appendChild(rankingItem);
            });
            
            modal.classList.remove('hidden');
        }
    }

    updateUI() {
        const currentPlayer = this.getCurrentPlayer();
        const nameElement = document.getElementById('current-player-name');
        const colorElement = document.getElementById('player-color-indicator');
        const messageElement = document.getElementById('game-messages');
        
        if (nameElement) {
            nameElement.textContent = currentPlayer.name;
        }
        
        if (colorElement) {
            colorElement.style.backgroundColor = GAME_CONFIG.colors[currentPlayer.color];
        }
        
        if (messageElement) {
            if (this.hasRolled) {
                const movableTokens = this.getMovableTokens(currentPlayer.color);
                if (movableTokens.length > 0) {
                    messageElement.textContent = `${currentPlayer.name}, you rolled ${this.diceValue}! Click a token to move.`;
                } else {
                    messageElement.textContent = `${currentPlayer.name}, you rolled ${this.diceValue}. No moves available.`;
                    setTimeout(() => {
                        this.nextPlayer();
                        this.updateUI();
                        window.ludoApp.updateRollDiceButton();
                    }, 2000);
                }
            } else {
                messageElement.textContent = `${currentPlayer.name}, your turn! Roll the dice.`;
            }
        }
        
        this.updatePlayersList();
    }

    updatePlayersList() {
        const listElement = document.getElementById('game-players-list');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        this.players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'game-player-card';
            if (index === this.currentPlayerIndex) {
                playerCard.classList.add('current-player');
            }
            
            const homeTokens = this.tokens[player.color].filter(token => token.isHome).length;
            const statusIcon = this.finishedPlayers.has(player.color) ? '✅' : '';
            
            playerCard.innerHTML = `
                <div class="game-player-color color-${player.color}"></div>
                <div class="game-player-name">${player.name} ${statusIcon}</div>
                <div class="game-player-tokens">${homeTokens}/4</div>
            `;
            
            listElement.appendChild(playerCard);
        });
    }
}

// Family Application Controller
class LudoApp {
    constructor() {
        this.gameState = new GameState();
        this.currentGame = null;
        this.particleSystem = new ParticleSystem();
        this.initializeEventListeners();
        this.showLoadingOverlay(false);
    }

    initializeEventListeners() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.attachEventListeners();
            });
        } else {
            this.attachEventListeners();
        }
    }

    attachEventListeners() {
        // Main menu events
        const createBtn = document.getElementById('create-room-btn');
        const joinBtn = document.getElementById('join-room-btn');
        
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createRoom());
        }
        
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinRoom());
        }
        
        // Room setup events
        const shareBtn = document.getElementById('share-code-btn');
        const startBtn = document.getElementById('start-game-btn');
        const leaveBtn = document.getElementById('leave-room-btn');
        const playerCountSelect = document.getElementById('player-count-select');
        
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareRoomCode());
        }
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }
        
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leaveRoom());
        }
        
        if (playerCountSelect) {
            playerCountSelect.addEventListener('change', (e) => this.updatePlayerCount(e.target.value));
        }
        
        // Game events
        const rollDiceBtn = document.getElementById('roll-dice-btn');
        const leaveGameBtn = document.getElementById('leave-game-btn');
        
        if (rollDiceBtn) {
            rollDiceBtn.addEventListener('click', () => this.rollDice());
        }
        
        if (leaveGameBtn) {
            leaveGameBtn.addEventListener('click', () => this.leaveGame());
        }
        
        // Modal events
        const newGameBtn = document.getElementById('new-game-btn');
        const backToMenuBtn = document.getElementById('back-to-menu-btn');
        
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.startNewGame());
        }
        
        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', () => this.backToMenu());
        }
    }

    showLoadingOverlay(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    createRoom() {
        const playerNameInput = document.getElementById('player-name');
        if (!playerNameInput) return;
        
        const playerName = playerNameInput.value.trim();
        
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }

        this.showLoadingOverlay(true);
        
        setTimeout(() => {
            const room = this.gameState.createRoom(playerName);
            this.showRoomSetup(room);
            this.showLoadingOverlay(false);
        }, 500);
    }

    joinRoom() {
        const playerNameInput = document.getElementById('player-name');
        const roomCodeInput = document.getElementById('room-code-input');
        
        if (!playerNameInput || !roomCodeInput) return;
        
        const playerName = playerNameInput.value.trim();
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }
        
        if (!roomCode || roomCode.length !== 4) {
            this.showNotification('Please enter a valid room code', 'error');
            return;
        }

        this.showLoadingOverlay(true);
        
        setTimeout(() => {
            const room = this.gameState.joinRoom(roomCode, playerName);
            if (!room) {
                this.showNotification('Room not found, full, or name already taken', 'error');
                this.showLoadingOverlay(false);
                return;
            }

            this.showRoomSetup(room);
            this.showLoadingOverlay(false);
        }, 500);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            border-radius: 8px;
            z-index: 3000;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            font-weight: 500;
            transform: translateX(100%);
            transition: transform 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showRoomSetup(room) {
        this.showScreen('room-setup');
        
        const roomCodeDisplay = document.getElementById('room-code-display');
        if (roomCodeDisplay) {
            roomCodeDisplay.textContent = room.code;
        }
        
        this.updateRoomDisplay();
    }

    updateRoomDisplay() {
        const room = this.gameState.currentRoom;
        if (!room) return;

        const membersList = document.getElementById('members-list');
        const memberCountText = document.getElementById('member-count-text');
        const startBtn = document.getElementById('start-game-btn');
        const waitingMessage = document.getElementById('waiting-message');
        
        // Update members list with enhanced display
        if (membersList) {
            membersList.innerHTML = '';

            room.players.forEach((player, index) => {
                const memberItem = document.createElement('div');
                memberItem.className = 'member-item';
                memberItem.innerHTML = `
                    <div class="member-dot"></div>
                    <div class="member-name">${player.name}</div>
                    ${player.isHost ? '<div class="member-role">HOST</div>' : '<div class="member-role">MEMBER</div>'}
                `;
                
                // Add slide-in animation
                memberItem.style.animation = `slideIn 0.3s ease-out ${index * 0.1}s both`;
                membersList.appendChild(memberItem);
            });
        }

        // Update member count
        if (memberCountText) {
            memberCountText.textContent = `${room.players.length}/${room.maxPlayers} family members connected`;
        }

        // Handle start button and waiting message
        const isHost = this.gameState.currentPlayer && this.gameState.currentPlayer.isHost;
        const hasEnoughPlayers = room.players.length >= 2;
        
        if (startBtn && waitingMessage) {
            if (isHost) {
                startBtn.classList.remove('hidden');
                startBtn.style.display = 'flex';
                waitingMessage.classList.add('hidden');
                
                startBtn.disabled = !hasEnoughPlayers;
                
                if (hasEnoughPlayers) {
                    startBtn.innerHTML = '<span class="btn-icon">🚀</span>Start Game';
                } else {
                    startBtn.innerHTML = '<span class="btn-icon">⏳</span>Need at least 2 family members';
                }
            } else {
                startBtn.classList.add('hidden');
                startBtn.style.display = 'none';
                waitingMessage.classList.remove('hidden');
            }
        }
    }

    updatePlayerCount(count) {
        if (this.gameState.currentRoom) {
            this.gameState.currentRoom.maxPlayers = parseInt(count);
            this.updateRoomDisplay();
        }
    }

    shareRoomCode() {
        const roomCode = this.gameState.currentRoom.code;
        if (navigator.share) {
            navigator.share({
                title: 'Join our Ludo game!',
                text: `Join our Ludo game with room code: ${roomCode}`,
                url: window.location.href
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(roomCode).then(() => {
                this.showNotification('Room code copied!', 'success');
            }).catch(() => {
                this.fallbackCopyToClipboard(roomCode);
            });
        } else {
            this.fallbackCopyToClipboard(roomCode);
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            this.showNotification('Room code copied!', 'success');
        } catch (err) {
            this.showNotification(`Room code: ${text}`, 'info');
        }
        document.body.removeChild(textArea);
    }

    startGame() {
        if (!this.gameState.currentRoom || !this.gameState.currentPlayer.isHost) {
            return;
        }

        this.showLoadingOverlay(true);
        
        setTimeout(() => {
            const canvas = document.getElementById('game-board');
            if (!canvas) {
                this.showLoadingOverlay(false);
                return;
            }
            
            this.currentGame = new LudoGame(this.gameState.currentRoom.players, canvas);
            this.gameState.currentRoom.isGameStarted = true;

            this.showScreen('game-screen');
            this.currentGame.updateUI();
            this.updateRollDiceButton();
            this.showLoadingOverlay(false);
        }, 1000);
    }

    rollDice() {
        if (!this.currentGame || this.currentGame.gameOver) return;

        const diceValue = this.currentGame.rollDice();
        const diceElement = document.getElementById('dice-display');
        const diceFace = diceElement.querySelector('.dice-face');
        const rollButton = document.getElementById('roll-dice-btn');

        if (!diceElement || !rollButton) return;

        diceElement.classList.add('rolling');
        rollButton.disabled = true;

        setTimeout(() => {
            if (diceFace) {
                diceFace.textContent = diceValue;
            }
            diceElement.classList.remove('rolling');
            
            const currentPlayer = this.currentGame.getCurrentPlayer();
            const movableTokens = this.currentGame.getMovableTokens(currentPlayer.color);
            
            this.currentGame.updateUI();
            
            if (movableTokens.length === 0) {
                setTimeout(() => {
                    this.currentGame.nextPlayer();
                    this.currentGame.updateUI();
                    this.updateRollDiceButton();
                }, 2000);
            } else {
                rollButton.disabled = true;
            }
        }, GAME_CONFIG.animations.diceRoll);
    }

    updateRollDiceButton() {
        const rollButton = document.getElementById('roll-dice-btn');
        if (!rollButton || !this.currentGame) return;
        
        const currentPlayer = this.currentGame.getCurrentPlayer();
        const isCurrentPlayerTurn = currentPlayer.name === this.gameState.currentPlayer.name;
        const hasRolled = this.currentGame.hasRolled;
        
        rollButton.disabled = !isCurrentPlayerTurn || hasRolled;
        
        if (!isCurrentPlayerTurn) {
            rollButton.innerHTML = '<span class="btn-icon">⏳</span>Wait for your turn';
        } else if (hasRolled) {
            rollButton.innerHTML = '<span class="btn-icon">👆</span>Select a token';
        } else {
            rollButton.innerHTML = '<span class="btn-icon">🎲</span>Roll Dice';
        }
    }

    leaveRoom() {
        this.gameState.leaveRoom();
        this.showMainMenu();
    }

    leaveGame() {
        this.gameState.leaveRoom();
        this.showMainMenu();
    }

    showMainMenu() {
        this.showScreen('main-menu');
        
        const playerNameInput = document.getElementById('player-name');
        const roomCodeInput = document.getElementById('room-code-input');
        
        if (playerNameInput) playerNameInput.value = '';
        if (roomCodeInput) roomCodeInput.value = '';
    }

    startNewGame() {
        const modal = document.getElementById('winner-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        if (this.gameState.currentRoom) {
            this.startGame();
        }
    }

    backToMenu() {
        const modal = document.getElementById('winner-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.leaveGame();
    }
}

// Initialize the application
let ludoApp;
document.addEventListener('DOMContentLoaded', () => {
    ludoApp = new LudoApp();
    window.ludoApp = ludoApp;
});