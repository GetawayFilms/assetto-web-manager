let selectedServerId = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeServerList();
    setupEventListeners();
});

function initializeServerList() {
    const serverItems = document.querySelectorAll('.server-item');
    
    serverItems.forEach(item => {
        item.addEventListener('click', function() {
            const serverId = this.dataset.serverId;
            selectServer(serverId);
        });
    });
}

function selectServer(serverId) {
    // Remove previous selection
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked server
    document.querySelector(`[data-server-id="${serverId}"]`).classList.add('selected');
    
    selectedServerId = serverId;
    
    // Update main content
    showServerDetails(serverId);
    
    // Load server data
    loadServerData(serverId);
}

function showServerDetails(serverId) {
    // Hide welcome message
    document.getElementById('welcome-message').style.display = 'none';
    
    // Show server details
    document.getElementById('server-details').style.display = 'block';
    
    // Update header
    const serverName = document.querySelector(`[data-server-id="${serverId}"] .server-name`).textContent;
    document.getElementById('selected-server-name').textContent = serverName;
    
    // Show control buttons
    document.getElementById('start-btn').style.display = 'inline-block';
    document.getElementById('stop-btn').style.display = 'inline-block';
}

function loadServerData(serverId) {
    // Load console output
    fetch(`/api/server/${serverId}/console`)
        .then(response => response.json())
        .then(data => {
            updateConsoleOutput(data.logs);
        })
        .catch(error => {
            console.error('Error loading console:', error);
        });
    
    // Load player list
    fetch(`/api/server/${serverId}/players`)
        .then(response => response.json())
        .then(data => {
            updatePlayersList(data.players);
        })
        .catch(error => {
            console.error('Error loading players:', error);
        });
}

function updateConsoleOutput(logs) {
    const consoleOutput = document.getElementById('console-output');
    consoleOutput.innerHTML = '';
    
    logs.forEach(log => {
        const logLine = document.createElement('div');
        logLine.className = 'console-line';
        logLine.textContent = log;
        consoleOutput.appendChild(logLine);
    });
    
    // Auto-scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    if (players.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No players connected';
        emptyMessage.style.color = '#a3a3a3';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        playersList.appendChild(emptyMessage);
        return;
    }
    
    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        playerItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-car">${player.car}</span>
            <span class="player-time">${player.laptime}</span>
        `;
        
        playersList.appendChild(playerItem);
    });
}

function setupEventListeners() {
    // Start server button
    document.getElementById('start-btn').addEventListener('click', function() {
        if (selectedServerId) {
            startServer(selectedServerId);
        }
    });
    
    // Stop server button
    document.getElementById('stop-btn').addEventListener('click', function() {
        if (selectedServerId) {
            stopServer(selectedServerId);
        }
    });
}

function startServer(serverId) {
    fetch(`/api/server/${serverId}/start`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`Server started: ${data.message}`, 'success');
            // Update UI to show server is starting
            updateServerStatus(serverId, 'starting');
        }
    })
    .catch(error => {
        showNotification('Error starting server', 'error');
        console.error('Error:', error);
    });
}

function stopServer(serverId) {
    fetch(`/api/server/${serverId}/stop`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`Server stopped: ${data.message}`, 'success');
            // Update UI to show server is stopped
            updateServerStatus(serverId, 'stopped');
        }
    })
    .catch(error => {
        showNotification('Error stopping server', 'error');
        console.error('Error:', error);
    });
}

function updateServerStatus(serverId, status) {
    const statusDot = document.querySelector(`[data-server-id="${serverId}"] .status-dot`);
    
    // Remove all status classes
    statusDot.classList.remove('status-running', 'status-stopped', 'status-starting');
    
    // Add new status class
    statusDot.classList.add(`status-${status}`);
}

function showNotification(message, type) {
    // Simple notification - you could make this fancier later
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        background-color: ${type === 'success' ? '#22c55e' : '#ef4444'};
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Auto-refresh functionality (we'll add this later when we have real data)
function startAutoRefresh() {
    setInterval(() => {
        if (selectedServerId) {
            loadServerData(selectedServerId);
        }
    }, 5000); // Refresh every 5 seconds
}

// Uncomment this when you want auto-refresh
// startAutoRefresh();