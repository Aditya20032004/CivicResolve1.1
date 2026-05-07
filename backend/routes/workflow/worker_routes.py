from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from pathlib import Path
from backend.models import (
    db,
    PotholeReport,
    GarbageReport,
    DamagedRoadReport,
    IllegalParkingReport,
    BrokenSignReport,
    FallenTreeReport,
    VandalismReport,
    DeadAnimalReport,
    DamagedConcreteReport,
    DamagedWiresReport,
    Worker,
    VerificationLog,
)
from workflow.worker_workflow import release_worker_task
from workflow.verification_workflow import run_dual_verification
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
    """Return all active tasks assigned to a worker.

    This keeps the response as a simple list of incidents to avoid
    breaking the existing frontend contract.
    """
    report_models = [
        PotholeReport,
        GarbageReport,
        DamagedRoadReport,
        IllegalParkingReport,
        BrokenSignReport,
        FallenTreeReport,
        VandalismReport,
        DeadAnimalReport,
        DamagedConcreteReport,
        DamagedWiresReport,
    ]

    tasks: list[dict] = []
    for model in report_models:
        rows = model.query.filter_by(assigned_worker_id=worker_id, status='assigned').all()
        tasks.extend(r.to_dict() for r in rows)

    # Sort newest first for a stable ordering in the Worker UI.
    tasks.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    return jsonify(tasks), 200


@worker_bp.route('/profile/<worker_id>', methods=['GET'])
def get_worker_profile(worker_id):
    """Return basic performance metrics for a worker.

    Used by the Worker UI to display reward/penalty points and
    current load without requiring admin privileges.
    """
    worker = Worker.query.get(worker_id)
    if not worker:
        return jsonify({'error': 'Worker not found'}), 404
    return jsonify(worker.to_dict()), 200

@worker_bp.route('/complete', methods=['POST'])
def complete_task():
    print("✅ Worker Task Completion Request")
    print(f"   Files: {list(request.files.keys())}")
    print(f"   Form: {dict(request.form)}")
    
    max_bytes = 10 * 1024 * 1024  # 10 MB
    if request.content_length and request.content_length > max_bytes:
        return jsonify({'error': 'Image too large', 'max_bytes': max_bytes}), 413

    file = request.files.get('image')
    rid = request.form.get('id')
    rtype = request.form.get('type')
    
    if not file:
        print("❌ Missing 'image' file")
        return jsonify({'error': 'Missing resolved image', 'hint': 'Upload completed work photo'}), 400
    if not file.mimetype.startswith('image/'):
        return jsonify({'error': 'Invalid file type; only images are allowed'}), 400
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
    
    # Run detection to generate an annotated resolved image
    filename = secure_filename(f"resolved_{rtype}_{rid}_{file.filename}")
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

    if verification_model:
        try:
            print(f"🔍 Verifying resolved image for {rtype} #{rid}...")
            results = verification_model(temp_path, conf=0.25)

            # Save annotated image for worker+admin review
            import cv2
            annotated_img = results[0].plot()
            cv2.imwrite(path, annotated_img)
            print(f"📦 Saved annotated resolved image: {filename}")

            os.remove(temp_path)
        except Exception as e:
            print(f"⚠️ Detection failed on resolved image (annotating only): {e}")
            os.rename(temp_path, path)
    else:
        os.rename(temp_path, path)
    
    # Map API type strings back to their SQLAlchemy models so workers can
    # complete tasks for any of the supported civic issue classes.
    type_model_map = {
        'pothole': PotholeReport,
        'garbage': GarbageReport,
        'damaged_road': DamagedRoadReport,
        'illegal_parking': IllegalParkingReport,
        'broken_sign': BrokenSignReport,
        'fallen_tree': FallenTreeReport,
        'vandalism': VandalismReport,
        'dead_animal': DeadAnimalReport,
        'damaged_concrete': DamagedConcreteReport,
        'damaged_wires': DamagedWiresReport,
    }

    model_cls = type_model_map.get((rtype or '').strip().lower())
    if not model_cls:
        return jsonify({'error': 'Unsupported report type', 'type': rtype}), 400

    report = model_cls.query.get(rid)
    if not report:
        return jsonify({'error': 'Report not found'}), 404

    # Persist resolved image filename for downstream verification
    report.resolved_image = filename

    worker = None
    if report.assigned_worker_id:
        worker = Worker.query.get(report.assigned_worker_id)

    # Run full dual verification: worker upload vs original, plus
    # nearest camera frame for the same area, with similarity checks.
    verification = run_dual_verification(report, current_app.config['UPLOAD_FOLDER'])
    checks = verification.get('checks', {}) or {}
    similarity = (checks.get('similarity') or {}).get('worker_upload_vs_camera')
    conf = (checks.get('confidence') or {})
    camera_issue_conf = conf.get('camera_issue_confidence')

    approved = bool(verification.get('approved'))

    decision = 'verified' if approved else 'assigned'

    if approved:
        report.status = 'verified'
        report.resolved_at = datetime.utcnow()
        report.verification_notes = verification.get('reason')
        if worker:
            worker.reward_points = (worker.reward_points or 0) + 10
            # Free up one active task slot now that the fix is trusted.
            release_worker_task(worker.id, auto_commit=False)
    else:
        # Default: send the task back for rework, but only penalize when
        # we are confident the worker's proof is wrong for THIS area.
        report.status = 'assigned'
        report.verification_notes = verification.get('reason')

        penalize = False

        # 1) If the worker's resolved image still looks too similar to
        #    the original (no real change), treat as a bad completion.
        if checks.get('uploaded_proof_check') == 'failed':
            penalize = True
        # 2) If the camera re-check fails for a nearby camera AND the
        #    frame looks like the same area (similar enough) but still
        #    has high issue confidence, then the problem persists.
        elif checks.get('camera_recheck') == 'failed' and similarity is not None and camera_issue_conf is not None:
            if similarity >= 0.35 and camera_issue_conf > 0.20:
                penalize = True

        if worker and penalize:
            worker.penalty_points = (worker.penalty_points or 0) + 1

    # Write immutable audit log entry for this verification decision
    try:
        from json import dumps as _dumps
        log = VerificationLog(
            report_id=report.id,
            report_type=rtype,
            worker_id=report.assigned_worker_id,
            channel='worker_auto',
            decision=decision,
            reason=verification.get('reason'),
            details_json=_dumps(verification),
        )
        db.session.add(log)
    except Exception as _e:
        # Logging failures should not block core workflow
        print(f"⚠️ Failed to write verification log: {_e}")

    db.session.commit()

    # Surface a clearer message back to the worker UI so they
    # immediately see whether the proof was accepted or rejected.
    response_message = verification.get('reason') or (
        'Resolution verified and ticket closed.' if approved
        else 'Dual verification failed; task returned for rework.'
    )

    return jsonify({
        'message': response_message,
        'status': report.status,
        'verification': verification,
        'approved': approved,
    }), 200
