from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit
import os
import subprocess
import signal
import psutil
import threading
import datetime
import re
from config import SERVER_CONFIG

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store running server processes, their output, and connected players
server_processes = {}
server_outputs = {}
server_players = {}

def scan_existing_servers():
    """Scan for existing AssettoServer processes and adopt them"""
    for proc in psutil.process_iter(['pid', 'name', 'cwd', 'cmdline']):
        try:
            if proc.info['name'] == 'AssettoServer' or (proc.info['cmdline'] and './AssettoServer' in proc.info['cmdline']):
                cwd = proc.info['cwd']
                
                # Try to match this process to one of our configured servers
                for server_id, config in SERVER_CONFIG.items():
                    if cwd == config['directory']:
                        print(f"Found existing server: {server_id} (PID: {proc.info['pid']})")
                        server_processes[server_id] = proc.info['pid']
                        server_outputs[server_id] = [f"[Adopted] Existing server process (PID: {proc.info['pid']})"]
                        server_players[server_id] = []
                        break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

def parse_player_events(server_id, line):
    """Parse player join/leave events from console output"""
    
    # Look for " has connected" and work backwards to find the player name
    if " has connected" in line:
        # Extract everything before " has connected"
        before_connected = line.split(" has connected")[0]
        
        # Look for the pattern: PlayerName (stuff) 
        # Work backwards from the end to find the player name
        match = re.search(r'\]\s+(.+?)\s+\(', before_connected)
        if match:
            player_name = match.group(1).strip()
            
            # Extract car - look for the innermost parentheses with the car name
            car_match = re.search(r'\(([^()]*wdts_[^()]*|[^()]*-[^()]*)\)', line)
            if car_match:
                car = car_match.group(1).split('/')[0]  # Take part before /ABAH
            else:
                car = 'Unknown Car'
            
            # Add player to list if not already there
            if not any(p['name'] == player_name for p in server_players[server_id]):
                player_data = {
                    'name': player_name,
                    'car': car,
                    'laptime': '--:--:---'
                }
                server_players[server_id].append(player_data)
                
                # Broadcast player list update
                socketio.emit('players_update', {
                    'server_id': server_id,
                    'players': server_players[server_id]
                })
    
    # Look for disconnections - simpler approach
    if " has disconnected" in line:
        
        # Simple approach: extract everything between "] " and " has disconnected"
        parts = line.split('] ')
        if len(parts) > 1:
            after_bracket = parts[1]  # Everything after the "] "
            player_name = after_bracket.replace(' has disconnected', '').strip()
            
            # Remove player from list
            original_count = len(server_players[server_id])
            server_players[server_id] = [p for p in server_players[server_id] if p['name'] != player_name]
            new_count = len(server_players[server_id])
            
            # Broadcast player list update
            socketio.emit('players_update', {
                'server_id': server_id,
                'players': server_players[server_id]
            })

def is_server_running(server_id):
    """Check if server is running by looking for the process"""
    if server_id in server_processes:
        pid = server_processes[server_id]
        try:
            # Check if process still exists
            process = psutil.Process(pid)
            return process.is_running()
        except psutil.NoSuchProcess:
            # Process died, clean up
            del server_processes[server_id]
            if server_id in server_outputs:
                del server_outputs[server_id]
            if server_id in server_players:
                del server_players[server_id]
            return False
    return False

def get_player_count(server_id):
    """Get current player count"""
    if server_id in server_players:
        return len(server_players[server_id])
    return 0

def get_server_uptime(server_id):
    """Get server uptime - placeholder for now"""
    return "Unknown"

# Scan for existing servers when app starts
scan_existing_servers()

@app.route('/')
def dashboard():
    return render_template('index.html', servers=SERVER_CONFIG)

@app.route('/api/server/<server_id>/status')
def server_status(server_id):
    if server_id not in SERVER_CONFIG:
        return jsonify({'error': 'Server not found'}), 404
    
    is_running = is_server_running(server_id)
    
    return jsonify({
        'status': 'running' if is_running else 'stopped',
        'players': get_player_count(server_id) if is_running else 0,
        'uptime': get_server_uptime(server_id) if is_running else None
    })

@app.route('/api/server/<server_id>/start', methods=['POST'])
def start_server(server_id):
    if server_id not in SERVER_CONFIG:
        return jsonify({'error': 'Server not found'}), 404
    
    # Check if already running
    if is_server_running(server_id):
        return jsonify({'success': False, 'message': 'Server is already running'})
    
    server_config = SERVER_CONFIG[server_id]
    
    try:
        # Initialize output storage and player tracking for this server
        server_outputs[server_id] = []
        server_players[server_id] = []
        
        # Change to server directory and start the process
        process = subprocess.Popen(
            [server_config['executable']],
            cwd=server_config['directory'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            universal_newlines=True,
            bufsize=1,  # Line buffered
            preexec_fn=os.setsid
        )
        
        # Store the process
        server_processes[server_id] = process.pid
        
        # Start a thread to read output and broadcast via WebSocket
        def read_output():
            for line in process.stdout:
                line = line.strip()
                if line:
                    log_entry = line
                    server_outputs[server_id].append(log_entry)
                    
                    # Broadcast new log line via WebSocket
                    socketio.emit('console_update', {
                        'server_id': server_id,
                        'log_line': log_entry
                    })
                    
                    # Check if server has finished starting (look for AssettoServer startup completion)
                    if 'starting update loop' in line.lower():
                        socketio.emit('server_status_update', {
                            'server_id': server_id,
                            'status': 'running'
                        })
                    
                    # Parse player connections and disconnections
                    parse_player_events(server_id, line)
                    
                    # Keep only last 100 lines to prevent memory issues
                    if len(server_outputs[server_id]) > 100:
                        server_outputs[server_id] = server_outputs[server_id][-100:]
        
        threading.Thread(target=read_output, daemon=True).start()
        
        return jsonify({
            'success': True, 
            'message': f'{server_config["display_name"]} started successfully',
            'pid': process.pid
        })
        
    except Exception as e:
        return jsonify({
            'success': False, 
            'message': f'Failed to start server: {str(e)}'
        }), 500

@app.route('/api/server/<server_id>/stop', methods=['POST'])
def stop_server(server_id):
    if server_id not in SERVER_CONFIG:
        return jsonify({'error': 'Server not found'}), 404
    
    # Check if running
    if not is_server_running(server_id):
        return jsonify({'success': False, 'message': 'Server is not running'})
    
    server_config = SERVER_CONFIG[server_id]
    
    try:
        pid = server_processes[server_id]
        
        # Try to get the process
        process = psutil.Process(pid)
        
        # Terminate the process (like Ctrl+C)
        process.terminate()
        
        # Wait a bit for graceful shutdown
        try:
            process.wait(timeout=5)
        except psutil.TimeoutExpired:
            # Force kill if it doesn't shut down gracefully
            process.kill()
        
        # Clean up
        del server_processes[server_id]
        
        # Clear the output buffer and player list when server stops
        if server_id in server_outputs:
            del server_outputs[server_id]
        if server_id in server_players:
            del server_players[server_id]
        
        return jsonify({
            'success': True, 
            'message': f'{server_config["display_name"]} stopped successfully'
        })
        
    except psutil.NoSuchProcess:
        # Process already dead, just clean up
        if server_id in server_processes:
            del server_processes[server_id]
        if server_id in server_outputs:
            del server_outputs[server_id]
        if server_id in server_players:
            del server_players[server_id]
        return jsonify({
            'success': True, 
            'message': f'{server_config["display_name"]} was already stopped'
        })
        
    except Exception as e:
        # Try to clean up anyway
        if server_id in server_processes:
            del server_processes[server_id]
        if server_id in server_outputs:
            del server_outputs[server_id]
        if server_id in server_players:
            del server_players[server_id]
            
        return jsonify({
            'success': False, 
            'message': f'Error stopping server: {str(e)}'
        }), 500

@app.route('/api/server/<server_id>/console')
def server_console(server_id):
    if server_id not in SERVER_CONFIG:
        return jsonify({'error': 'Server not found'}), 404
    
    # Return real console output if available
    if server_id in server_outputs:
        return jsonify({'logs': server_outputs[server_id]})
    else:
        return jsonify({'logs': ['Server not started through web interface']})

@app.route('/api/server/<server_id>/players')
def server_players_api(server_id):
    if server_id not in SERVER_CONFIG:
        return jsonify({'error': 'Server not found'}), 404
    
    # Return real player data if available
    if server_id in server_players:
        return jsonify({'players': server_players[server_id]})
    else:
        return jsonify({'players': []})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)