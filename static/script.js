let selectedServerId = null;
let socket = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeServerList();
    setupEventListeners();
    initializeWebSocket();
});

function initializeWebSocket() {
    socket = io();
    
    socket.on('console_update', function(data) {
        if (data.server_id === selectedServerId) {
            appendConsoleOutput(data.log_line);
        }
    });
    
    socket.on('server_status_update', function(data) {
        updateServerStatus(data.server_id, data.status);
    });
    
    socket.on('players_update', function(data) {
        if (data.server_id === selectedServerId) {
            updatePlayersList(data.players);
        }
		
		updatePlayerCount(data.server_id, data.players.length);
    });
    
    socket.on('connect', function() {
        checkAllServerStatuses();
    });
}

function checkAllServerStatuses() {
    document.querySelectorAll('.server-item').forEach(item => {
        const serverId = item.dataset.serverId;
        fetch(`/api/server/${serverId}/status`)
            .then(response => response.json())
            .then(data => {
                updateServerStatus(serverId, data.status);
            })
            .catch(error => {
                console.error('Error checking server status:', error);
                updateServerStatus(serverId, 'stopped');
            });
    });
}

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
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    document.querySelector(`[data-server-id="${serverId}"]`).classList.add('selected');
    
    selectedServerId = serverId;
    
    showServerDetails(serverId);
    loadServerData(serverId);
}

function showServerDetails(serverId) {
    document.getElementById('welcome-message').style.display = 'none';
    document.getElementById('server-details').style.display = 'block';
    
    const serverName = document.querySelector(`[data-server-id="${serverId}"] .server-name`).textContent;
    document.getElementById('selected-server-name').textContent = serverName;
    
    document.getElementById('start-btn').style.display = 'inline-block';
    document.getElementById('stop-btn').style.display = 'inline-block';
}

function loadServerData(serverId) {
    loadConsoleOutput(serverId);
    
    fetch(`/api/server/${serverId}/players`)
        .then(response => response.json())
        .then(data => {
            updatePlayersList(data.players);
        })
        .catch(error => {
            console.error('Error loading players:', error);
        });
}

function loadConsoleOutput(serverId) {
    fetch(`/api/server/${serverId}/console`)
        .then(response => response.json())
        .then(data => {
            updateConsoleOutput(data.logs);
        })
        .catch(error => {
            console.error('Error loading console:', error);
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
    
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function appendConsoleOutput(logLine) {
    const consoleOutput = document.getElementById('console-output');
    const logElement = document.createElement('div');
    logElement.className = 'console-line';
    logElement.textContent = logLine;
    consoleOutput.appendChild(logElement);
    
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

function updatePlayerCount(serverId, count) {
    const serverItem = document.querySelector(`[data-server-id="${serverId}"]`);
    if (serverItem) {
        const playerCountElement = serverItem.querySelector('.player-count');
        if (playerCountElement) {
            const playerText = count === 1 ? 'player' : 'players';
            playerCountElement.textContent = `${count} ${playerText}`;
        }
    }
}

function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', function() {
        if (selectedServerId) {
            startServer(selectedServerId);
        }
    });
    
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
            updateServerStatus(serverId, 'starting');
            
            document.getElementById('console-output').innerHTML = '';
        } else {
            showNotification(`Error: ${data.message}`, 'error');
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
            updateServerStatus(serverId, 'stopped');
        } else {
            showNotification(`Error: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        showNotification('Error stopping server', 'error');
        console.error('Error:', error);
    });
}

function updateServerStatus(serverId, status) {
    const statusDot = document.querySelector(`[data-server-id="${serverId}"] .status-dot`);
    if (statusDot) {
        statusDot.classList.remove('status-running', 'status-stopped', 'status-starting');
        statusDot.classList.add(`status-${status}`);
    }
}

function showNotification(message, type) {
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
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}