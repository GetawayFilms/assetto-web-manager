from flask import Flask, render_template, jsonify
import os
from config import SERVER_CONFIG

app = Flask(__name__)

@app.route('/')
def dashboard():
    return render_template('index.html', servers=SERVER_CONFIG)

@app.route('/api/server/<server_id>/status')
def server_status(server_id):
    # Placeholder - we'll implement real status checking later
    return jsonify({
        'status': 'running',
        'players': 3,
        'uptime': '2h 15m'
    })

@app.route('/api/server/<server_id>/start', methods=['POST'])
def start_server(server_id):
    # Placeholder - we'll implement real server starting later
    return jsonify({'success': True, 'message': f'Starting {server_id}'})

@app.route('/api/server/<server_id>/stop', methods=['POST'])
def stop_server(server_id):
    # Placeholder - we'll implement real server stopping later
    return jsonify({'success': True, 'message': f'Stopping {server_id}'})

@app.route('/api/server/<server_id>/console')
def server_console(server_id):
    # Placeholder - we'll implement real console streaming later
    return jsonify({
        'logs': [
            'AssettoServer started successfully',
            'Loading track: spa',
            'Player John connected',
            'Player Mike connected',
            'Session started: Practice'
        ]
    })

@app.route('/api/server/<server_id>/players')
def server_players(server_id):
    # Placeholder - we'll implement real player listing later
    return jsonify({
        'players': [
            {'name': 'John', 'car': 'bmw_m3_e30', 'laptime': '2:15.432'},
            {'name': 'Mike', 'car': 'ks_ferrari_488_gt3', 'laptime': '2:16.891'}
        ]
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)