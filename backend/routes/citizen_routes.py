from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
import cv2
from pathlib import Path
from backend.models import db, PotholeReport, GarbageReport
from backend.utils.issue_validator import get_validator
from ultralytics import YOLO

citizen_bp = Blueprint('citizen', __name__)

# Lazy load YOLO model for validator
BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "ai_ml" / "models" / "best_civic_model.pt"
_validation_model = None

def get_validation_model():
    """Lazy load validation model only when needed"""
    global _validation_model
    if _validation_model is None:
        if MODEL_PATH.exists():
            _validation_model = YOLO(str(MODEL_PATH))
            print("✅ Validation Model Loaded for Citizen Routes")
        else:
            print(f"⚠️ Model not found at {MODEL_PATH}")
    return _validation_model

@citizen_bp.route('/report', methods=['POST'])
def submit_report():
    print("📝 Citizen Report Submission")
    print(f"   Files: {list(request.files.keys())}")
    print(f"   Form data: {dict(request.form)}")
    
    if 'image' not in request.files:
        print("❌ Missing 'image' in files")
        return jsonify({'error': 'No image provided', 'received_files': list(request.files.keys())}), 400
        
    file = request.files['image']
    issue_type = request.form.get('type')
    
    if not issue_type:
        print("❌ Missing 'type' in form data")
        return jsonify({'error': 'Missing issue type', 'hint': 'type should be pothole or garbage'}), 400
    
    if issue_type not in ['pothole', 'garbage']:
        print(f"❌ Invalid type: {issue_type}")
        return jsonify({'error': 'Invalid issue type', 'received': issue_type, 'allowed': ['pothole', 'garbage']}), 400

    # Save original temporarily
    ext = os.path.splitext(file.filename)[1]
    temp_filename = secure_filename(f"temp_{issue_type}_{uuid.uuid4().hex}{ext}")
    temp_path = os.path.join(current_app.config['UPLOAD_FOLDER'], temp_filename)
    file.save(temp_path)
    
    # Run detection and get annotated image
    print("🔍 Running detection on submitted image...")
    try:
        model = get_validation_model()
        results = model(temp_path, conf=0.25)
        annotated_img = results[0].plot()  # Get image with bounding boxes
        
        # Save annotated image as the main image
        filename = secure_filename(f"{issue_type}_{uuid.uuid4().hex}{ext}")
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        cv2.imwrite(save_path, annotated_img)
        print(f"📦 Saved annotated image with detections: {filename}")
        
        # Remove temp file
        os.remove(temp_path)
    except Exception as e:
        print(f"⚠️ Detection failed, using original image: {e}")
        # Fallback: use original if detection fails
        filename = secure_filename(f"{issue_type}_{uuid.uuid4().hex}{ext}")
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        os.rename(temp_path, save_path)
    
    # --- Issue Validation ---
    lat = request.form.get('lat', type=float)
    lng = request.form.get('lng', type=float)
    
    print(f"🔍 Validating: lat={lat}, lng={lng}, type={issue_type}")
    
    validator = get_validator(model=get_validation_model())
    validation = validator.validate_report(save_path, lat, lng, issue_type)
    
    print(f"   Validation result: {validation}")
    
    if validation['decision'] == 'rejected':
        os.remove(save_path)  # Cleanup rejected image
        print(f"❌ Report REJECTED: {validation['message']}")
        return jsonify({
            'error': validation['message'],
            'trust_score': validation['score']
        }), 400
    
    new_report = None
    if issue_type == 'pothole':
        new_report = PotholeReport(
            image_filename=filename,
            severity=request.form.get('severity', 'medium'),
            latitude=lat,
            longitude=lng,
            address=request.form.get('address')
        )
    else:
        new_report = GarbageReport(
            image_filename=filename,
            garbage_type=request.form.get('garbage_type', 'mixed'),
            latitude=lat,
            longitude=lng,
            address=request.form.get('address')
        )
        
    db.session.add(new_report)
    db.session.commit()
    
    return jsonify({
        'message': 'Report saved',
        'id': new_report.id,
        'trust_score': validation['score'],
        'validation_status': validation['decision']
    }), 201