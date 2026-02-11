from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
from pathlib import Path
from backend.models import db, PotholeReport, GarbageReport
from ultralytics import YOLO

worker_bp = Blueprint('worker', __name__)

# Load YOLO model for verification
BASE_DIR = Path(__file__).resolve().parents[3]
MODEL_PATH = BASE_DIR / "ai_ml" / "models" / "best_civic_model.pt"
verification_model = None

try:
    if MODEL_PATH.exists():
        verification_model = YOLO(str(MODEL_PATH))
        print("✅ Verification Model Loaded for Worker Routes")
except Exception as e:
    print(f"⚠️ Verification model not available: {e}")

@worker_bp.route('/my-tasks/<worker_id>', methods=['GET'])
def get_worker_tasks(worker_id):
    p_tasks = PotholeReport.query.filter_by(assigned_worker_id=worker_id, status='assigned').all()
    g_tasks = GarbageReport.query.filter_by(assigned_worker_id=worker_id, status='assigned').all()
    
    tasks = [p.to_dict() for p in p_tasks] + [g.to_dict() for g in g_tasks]
    return jsonify(tasks), 200

@worker_bp.route('/complete', methods=['POST'])
def complete_task():
    print("✅ Worker Task Completion Request")
    print(f"   Files: {list(request.files.keys())}")
    print(f"   Form: {dict(request.form)}")
    
    file = request.files.get('image')
    rid = request.form.get('id')
    rtype = request.form.get('type')
    
    if not file:
        print("❌ Missing 'image' file")
        return jsonify({'error': 'Missing resolved image', 'hint': 'Upload completed work photo'}), 400
    if not rid:
        print("❌ Missing 'id' field")
        return jsonify({'error': 'Missing report id'}), 400
    if not rtype:
        print("❌ Missing 'type' field")
        return jsonify({'error': 'Missing report type'}), 400

    # Save temp and run detection
    temp_filename = secure_filename(f"temp_resolved_{rtype}_{rid}_{file.filename}")
    temp_path = os.path.join(current_app.config['UPLOAD_FOLDER'], temp_filename)
    file.save(temp_path)
    
    # Run detection to verify work
    filename = secure_filename(f"resolved_{rtype}_{rid}_{file.filename}")
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    
    if verification_model:
        try:
            print(f"🔍 Verifying resolved image for {rtype} #{rid}...")
            results = verification_model(temp_path, conf=0.25)
            
            # Save annotated image
            import cv2
            annotated_img = results[0].plot()
            cv2.imwrite(path, annotated_img)
            print(f"📦 Saved annotated resolved image: {filename}")
            
            # Check if issue still detected (should be empty/reduced)
            detections = len(results[0].boxes)
            print(f"   Detections in resolved image: {detections}")
            
            os.remove(temp_path)
        except Exception as e:
            print(f"⚠️ Detection failed on resolved image: {e}")
            os.rename(temp_path, path)
    else:
        os.rename(temp_path, path)
    
    report = None
    if rtype == 'pothole':
        report = PotholeReport.query.get(rid)
    elif rtype == 'garbage':
        report = GarbageReport.query.get(rid)
        
    if report:
        report.resolved_image = filename
        report.status = 'completed'
        db.session.commit()
        return jsonify({'message': 'Task marked completed'}), 200
        
    return jsonify({'error': 'Report not found'}), 404