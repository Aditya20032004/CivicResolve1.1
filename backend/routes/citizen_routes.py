from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
import cv2
from pathlib import Path
from backend.models import db, PotholeReport, GarbageReport
from backend.utils.issue_validator import get_validator
from backend.utils.severity_classifier import classify_issue_from_results
from workflow.worker_workflow import assign_report_to_worker, _haversine_km
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


def _find_nearby_incident(issue_type, lat, lng, max_distance_km=0.08):
    """Return an existing open incident near the given location, if any.

    This provides basic deduplication so repeated reports for the same
    pothole/garbage patch in a small radius are linked to one case
    instead of creating many separate incidents.
    """
    if lat is None or lng is None:
        return None

    if issue_type == 'pothole':
        query = PotholeReport.query
    else:
        query = GarbageReport.query

    # Consider only non-verified incidents as potential duplicates.
    candidates = query.filter(~PotholeReport.status.in_(['verified']) if issue_type == 'pothole' else ~GarbageReport.status.in_(['verified'])).all()

    nearest = None
    nearest_dist = max_distance_km
    for r in candidates:
        d = _haversine_km(lat, lng, r.latitude, r.longitude)
        if d < nearest_dist:
            nearest = r
            nearest_dist = d

    return nearest

@citizen_bp.route('/report', methods=['POST'])
def submit_report():
    print("📝 Citizen Report Submission")
    print(f"   Files: {list(request.files.keys())}")
    print(f"   Form data: {dict(request.form)}")
    
    max_bytes = 10 * 1024 * 1024  # 10 MB
    if request.content_length and request.content_length > max_bytes:
        return jsonify({'error': 'Image too large', 'max_bytes': max_bytes}), 413

    if 'image' not in request.files:
        print("❌ Missing 'image' in files")
        return jsonify({'error': 'No image provided', 'received_files': list(request.files.keys())}), 400
        
    file = request.files['image']
    if not file.mimetype.startswith('image/'):
        return jsonify({'error': 'Invalid file type; only images are allowed'}), 400
    # Issue type can be user-provided or auto-detected from the image
    issue_type = request.form.get('type')

    # Save original temporarily
    ext = os.path.splitext(file.filename)[1]
    temp_filename = secure_filename(f"temp_{issue_type}_{uuid.uuid4().hex}{ext}")
    temp_path = os.path.join(current_app.config['UPLOAD_FOLDER'], temp_filename)
    file.save(temp_path)
    
    # Run detection and get annotated image
    print("🔍 Running detection on submitted image...")
    classification = None

    try:
        model = get_validation_model()
        results = model(temp_path, conf=0.25)
        annotated_img = results[0].plot()  # Get image with bounding boxes

        # Auto-detect dominant issue class & severity from the photo
        classification = classify_issue_from_results(results, model)
        
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
    
    # If model detected a clear issue class, prefer it when user did not
    # provide a valid type. Fallback to user-provided type for compatibility.
    auto_type = classification.get('issue_class') if classification else None

    if not issue_type and auto_type:
        issue_type = auto_type

    if issue_type not in ['pothole', 'garbage']:
        print(f"❌ Invalid or undetected type: {issue_type}")
        os.remove(save_path)
        return jsonify({
            'error': 'Could not determine issue type from image',
            'received_type': issue_type,
            'auto_detected_type': auto_type,
        }), 400

    auto_severity = classification.get('severity') if classification else None

    # --- Basic deduplication: check if an open incident already exists nearby ---
    existing = _find_nearby_incident(issue_type, lat, lng)
    if existing is not None:
        # We already saved the annotated image; it's safe to keep or
        # could be cleaned up here. To avoid confusing duplicates in
        # the DB, we simply link the citizen to the existing incident.
        print(f"ℹ️ Deduplicated report: linking to existing {issue_type} #{existing.id} at ~{existing.latitude},{existing.longitude}")
        return jsonify({
            'message': 'Similar issue already reported nearby; linking to existing incident.',
            'id': existing.id,
            'detected_type': issue_type,
            'auto_severity': auto_severity,
            'duplicate_of': existing.id,
            'trust_score': validation['score'],
            'validation_status': validation['decision'],
        }), 200

    new_report = None
    if issue_type == 'pothole':
        severity = auto_severity or request.form.get('severity', 'medium')
        new_report = PotholeReport(
            image_filename=filename,
            severity=severity,
            latitude=lat,
            longitude=lng,
            address=request.form.get('address'),
        )
    else:
        new_report = GarbageReport(
            image_filename=filename,
            garbage_type=request.form.get('garbage_type', 'mixed'),
            latitude=lat,
            longitude=lng,
            address=request.form.get('address'),
        )

    db.session.add(new_report)
    db.session.flush()

    # Auto-assign to the best available worker in Bhopal
    assignment = assign_report_to_worker(new_report, auto_commit=False)

    db.session.commit()

    return jsonify({
        'message': 'Report saved',
        'id': new_report.id,
        'detected_type': issue_type,
        'auto_severity': auto_severity,
        'trust_score': validation['score'],
        'validation_status': validation['decision'],
        'assignment': assignment,
    }), 201