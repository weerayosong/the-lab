class CollaborativeCounter {
    constructor() {
        this.counter = 0;
        this.userId = this.generateUserId();
        this.userName = `User-${this.userId.slice(0, 4)}`;
        this.roomId = null;
        this.channel = null;
        this.onlineUsers = new Map();
        this.historyLog = [];
        this.isOptimistic = true; // เปิด Optimistic UI
        
        this.init();
    }

    generateUserId() {
        return Math.random().toString(36).substring(2, 15);
    }

    init() {
        // Auto-join with default room
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        if (roomFromUrl) {
            document.getElementById('roomId').value = roomFromUrl;
            this.joinRoom(roomFromUrl);
        }
    }

    joinRoom(roomId) {
        if (!roomId) {
            roomId = document.getElementById('roomId').value.trim();
            if (!roomId) return this.showStatus('⚠️ กรุณาใส่ Room ID', 'text-yellow-500');
        }

        // Leave previous room if any
        if (this.channel) {
            this.channel.close();
            this.sendMessage({ type: 'user-left', userId: this.userId });
        }

        this.roomId = roomId;
        this.channel = new BroadcastChannel(`counter-room-${roomId}`);
        
        // Update URL for sharing
        window.history.pushState({}, '', `?room=${roomId}`);
        document.getElementById('roomId').value = roomId;

        this.setupMessageHandlers();
        this.announcePresence();
        this.showStatus('🟢 เชื่อมต่อแล้ว', 'text-green-500');
    }

    setupMessageHandlers() {
        this.channel.onmessage = (event) => {
            const message = event.data;
            
            // Ignore own messages
            if (message.senderId === this.userId) return;

            switch (message.type) {
                case 'counter-update':
                    this.handleCounterUpdate(message);
                    break;
                case 'user-joined':
                    this.handleUserJoined(message);
                    break;
                case 'user-left':
                    this.handleUserLeft(message);
                    break;
                case 'sync-request':
                    this.sendFullSync();
                    break;
                case 'full-sync':
                    this.handleFullSync(message);
                    break;
            }
        };

        // Request sync when joining
        this.sendMessage({ type: 'sync-request' });
    }

    // CORE: Counter Update with Optimistic UI
    updateCounter(delta) {
        if (!this.roomId) {
            return this.showStatus('⚠️ กรุณาเชื่อมต่อห้องก่อน', 'text-yellow-500');
        }

        const previousValue = this.counter;
        
        // Optimistic Update - อัปเดต UI ทันที
        if (this.isOptimistic) {
            this.counter += delta;
            this.updateUI();
        }

        // Send update to other clients
        const updateMessage = {
            type: 'counter-update',
            senderId: this.userId,
            userName: this.userName,
            delta: delta,
            timestamp: Date.now(),
            // ส่งทั้ง delta และค่าที่ควรจะเป็น (ใช้ตรวจสอบ conflict)
            suggestedValue: previousValue + delta
        };

        this.sendMessage(updateMessage);
        this.addHistory(`${this.userName}: ${delta > 0 ? '+' : ''}${delta}`, 'text-blue-400');
    }

    handleCounterUpdate(message) {
        // Apply delta from other users
        const beforeValue = this.counter;
        this.counter += message.delta;
        
        // Simple Conflict Detection
        if (this.isOptimistic && beforeValue + message.delta !== this.counter) {
            console.warn('⚠️ Potential conflict detected, requesting sync');
            this.sendMessage({ type: 'sync-request' });
        }

        this.updateUI();
        this.addHistory(`${message.userName}: ${message.delta > 0 ? '+' : ''}${message.delta}`, 'text-purple-400');
        
        // Animation effect for remote updates
        this.animateCounter();
    }

    // PRESENCE: Track online users
    announcePresence() {
        this.onlineUsers.set(this.userId, {
            id: this.userId,
            name: this.userName,
            lastSeen: Date.now()
        });

        this.sendMessage({
            type: 'user-joined',
            userId: this.userId,
            userName: this.userName
        });

        this.updateOnlineUsers();
    }

    handleUserJoined(message) {
        if (!this.onlineUsers.has(message.userId)) {
            this.onlineUsers.set(message.userId, {
                id: message.userId,
                name: message.userName,
                lastSeen: Date.now()
            });
            this.updateOnlineUsers();
            this.addHistory(`👋 ${message.userName} เข้าร่วมห้อง`, 'text-green-400');
        }
    }

    handleUserLeft(message) {
        if (this.onlineUsers.has(message.userId)) {
            const user = this.onlineUsers.get(message.userId);
            this.onlineUsers.delete(message.userId);
            this.updateOnlineUsers();
            this.addHistory(`👋 ${user.name} ออกจากห้อง`, 'text-red-400');
        }
    }

    // SYNC: Full state synchronization
    sendFullSync() {
        this.sendMessage({
            type: 'full-sync',
            senderId: this.userId,
            counter: this.counter,
            onlineUsers: Array.from(this.onlineUsers.entries())
        });
    }

    handleFullSync(message) {
        // ใช้ค่าที่ latest ที่สุด (timestamp-based resolution)
        this.counter = Math.max(this.counter, message.counter);
        
        // Merge online users
        message.onlineUsers.forEach(([id, user]) => {
            if (!this.onlineUsers.has(id) && id !== this.userId) {
                this.onlineUsers.set(id, user);
            }
        });

        this.updateUI();
        this.updateOnlineUsers();
    }

    // UTILITY: Send message to all clients
    sendMessage(message) {
        if (this.channel) {
            this.channel.postMessage(message);
        }
    }

    // UI UPDATES
    updateUI() {
        const counterElement = document.getElementById('counter');
        counterElement.textContent = this.counter;
        
        // Color based on value
        if (this.counter > 0) {
            counterElement.className = 'text-7xl font-bold text-green-400 mb-4 transition-all duration-200';
        } else if (this.counter < 0) {
            counterElement.className = 'text-7xl font-bold text-red-400 mb-4 transition-all duration-200';
        } else {
            counterElement.className = 'text-7xl font-bold text-white mb-4 transition-all duration-200';
        }
    }

    animateCounter() {
        const counterElement = document.getElementById('counter');
        counterElement.classList.add('scale-125');
        setTimeout(() => counterElement.classList.remove('scale-125'), 200);
    }

    updateOnlineUsers() {
        document.getElementById('onlineCount').textContent = this.onlineUsers.size;
        
        const userList = document.getElementById('userList');
        userList.innerHTML = '';
        
        this.onlineUsers.forEach((user) => {
            const userBadge = document.createElement('span');
            userBadge.className = user.id === this.userId 
                ? 'bg-blue-600 text-white px-3 py-1 rounded-full text-xs'
                : 'bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-xs';
            userBadge.textContent = user.name + (user.id === this.userId ? ' (คุณ)' : '');
            userList.appendChild(userBadge);
        });
    }

    addHistory(message, colorClass = 'text-gray-400') {
        const log = document.getElementById('historyLog');
        const entry = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        entry.className = colorClass;
        entry.textContent = `[${time}] ${message}`;
        
        log.insertBefore(entry, log.firstChild);
        
        // Keep last 50 entries
        if (log.children.length > 50) {
            log.removeChild(log.lastChild);
        }
        
        // Remove placeholder
        const placeholder = log.querySelector('.text-gray-600');
        if (placeholder) placeholder.remove();
    }

    showStatus(message, className) {
        const status = document.getElementById('status');
        status.innerHTML = `<span class="${className}">${message}</span>`;
    }
}

// Initialize
const app = new CollaborativeCounter();

// Global functions for HTML
function joinRoom(roomId) {
    app.joinRoom(roomId);
}

function updateCounter(delta) {
    app.updateCounter(delta);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === '+') {
        e.preventDefault();
        updateCounter(1);
    } else if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault();
        updateCounter(-1);
    }
});