import os
import sys
from pathlib import Path
from flask import Flask, jsonify, send_from_directory  # <--- Import send_from_directory
from flask_cors import CORS
from backend.config import config
from backend.models import db

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

def create_app(config_name='default'):
    app = Flask(__name__)
    
    # Load Config
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # Extensions
    CORS(app)
    db.init_app(app)

    # Ensure tables exist and bootstrap worker pool
    from workflow.worker_workflow import bootstrap_workers

    with app.app_context():
        db.create_all()
        bootstrap_workers()

    # --- 1. ROOT ROUTE (To fix 404 on home page) ---
    @app.route('/')
    def index():
        return jsonify({
            "message": "CivicResolve Backend is Running!",
            "status": "online"
        }), 200

    # --- 2. NEW: IMAGE SERVING ROUTE (Paste this INSIDE create_app) ---
    @app.route('/data/images/<path:filename>')
    def serve_image(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    # ------------------------------------------------------------------

    # Register Blueprints
    from backend.routes.citizen_routes import citizen_bp
    from backend.routes.admin_routes import admin_bp
    from backend.routes.ai_routes import ai_bp
    from backend.routes.workflow.task_routes import task_bp
    from backend.routes.workflow.worker_routes import worker_bp
    from backend.routes.workflow.verification_routes import verify_bp
    
    app.register_blueprint(citizen_bp, url_prefix='/api/citizen')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(task_bp, url_prefix='/api/workflow/tasks')
    app.register_blueprint(worker_bp, url_prefix='/api/workflow/worker')
    app.register_blueprint(verify_bp, url_prefix='/api/workflow/verify')

    # Create Tables
    with app.app_context():
        db.create_all()
        
    return app

# Create app instance for gunicorn
app = create_app()

if __name__ == '__main__':
    print("🚀 CivicResolve Server Running on http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)