from flask import Blueprint, request, jsonify
from backend.models import db, PotholeReport, GarbageReport, VerificationLog, DisputeTicket
from camera_integration.detection_service import get_latest_camera_frame
from workflow.verification_workflow import _max_issue_confidence

verify_bp = Blueprint('verification', __name__)

@verify_bp.route('/verify', methods=['POST'])
def verify_fix():
    print("🔍 Verification Request")
    data = request.json
    print(f"   Data: {data}")
    
    rid = data.get('id')
    rtype = data.get('type')
    decision = data.get('decision') # 'approve' or 'reject'
    notes = data.get('notes', '')
    
    if not all([rid, rtype, decision]):
        missing = []
        if not rid: missing.append('id')
        if not rtype: missing.append('type')
        if not decision: missing.append('decision')
        print(f"❌ Missing fields: {missing}")
        return jsonify({'error': 'Missing required fields', 'missing': missing}), 400
    
    report = None
    if rtype == 'pothole':
        report = PotholeReport.query.get(rid)
    elif rtype == 'garbage':
        report = GarbageReport.query.get(rid)
        
    if not report:
        return jsonify({'error': 'Report not found'}), 404
        
    if decision == 'approve':
        report.status = 'verified'
        report.verification_notes = notes
    else:
        report.status = 'assigned' # Send back to worker
        report.verification_notes = f"REJECTED: {notes}"

    # Manual admin audit log
    try:
        log = VerificationLog(
            report_id=report.id,
            report_type=rtype,
            worker_id=report.assigned_worker_id,
            channel='admin_manual',
            decision='verified' if decision == 'approve' else 'assigned',
            reason=notes,
        )
        db.session.add(log)
    except Exception as _e:
        print(f"⚠️ Failed to create admin verification log: {_e}")

    db.session.commit()
    return jsonify({'message': f'Task {decision}d'}), 200


@verify_bp.route('/camera-sweep', methods=['POST'])
def camera_sweep():
    """Run a camera-based sweep over open incidents and auto-close some.

    For each non-verified incident, this checks the nearest latest
    camera frame; if the model sees low confidence for the issue type
    in that frame, the incident is marked as verified with a note.
    """
    payload = request.json or {}
    max_distance_km = float(payload.get('max_distance_km', 3.0))
    threshold = float(payload.get('max_issue_conf', 0.20))

    updated = 0
    scanned = 0

    open_potholes = PotholeReport.query.filter(PotholeReport.status != 'verified').all()
    open_garbage = GarbageReport.query.filter(GarbageReport.status != 'verified').all()

    for report, issue_type in [(r, 'pothole') for r in open_potholes] + [(r, 'garbage') for r in open_garbage]:
        match = get_latest_camera_frame(latitude=report.latitude, longitude=report.longitude, max_distance_km=max_distance_km)
        if not match:
            continue
        scanned += 1

        frame_path = match.get('path')
        if not frame_path:
            continue

        conf = _max_issue_confidence(frame_path, issue_type)
        if conf is None:
            continue

        if conf <= threshold:
            report.status = 'verified'
            note = f"Auto-verified via camera sweep at ~{match.get('distance_km', 0):.2f} km; max issue confidence={conf:.3f}"
            if report.verification_notes:
                report.verification_notes += f" | {note}"
            else:
                report.verification_notes = note

            try:
                log = VerificationLog(
                    report_id=report.id,
                    report_type=issue_type,
                    worker_id=report.assigned_worker_id,
                    channel='camera_sweep',
                    decision='verified',
                    reason=note,
                )
                db.session.add(log)
            except Exception as _e:
                print(f"⚠️ Failed to create camera sweep log: {_e}")

            updated += 1

    if updated:
        db.session.commit()

    return jsonify({
        'message': 'Camera sweep completed',
        'scanned_incidents': scanned,
        'auto_verified': updated,
        'max_distance_km': max_distance_km,
        'threshold': threshold,
    }), 200


@verify_bp.route('/logs', methods=['GET'])
def list_logs():
    """List recent verification logs for admin review."""
    limit = int(request.args.get('limit', 100))
    logs = VerificationLog.query.order_by(VerificationLog.created_at.desc()).limit(limit).all()
    return jsonify([
        {
            'id': l.id,
            'report_id': l.report_id,
            'report_type': l.report_type,
            'worker_id': l.worker_id,
            'channel': l.channel,
            'decision': l.decision,
            'reason': l.reason,
            'created_at': l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]), 200


@verify_bp.route('/disputes', methods=['POST'])
def create_dispute():
    """Create a dispute ticket against a verification log.

    Intended to be called from a worker-facing UI; for now, minimal
    validation is applied and auth is not enforced.
    """
    data = request.json or {}
    log_id = data.get('log_id')
    message = data.get('message')
    worker_id = data.get('worker_id')

    if not log_id or not message:
        return jsonify({'error': 'Missing required fields', 'required': ['log_id', 'message']}), 400

    dispute = DisputeTicket(
        log_id=log_id,
        worker_id=worker_id,
        message=message,
    )
    db.session.add(dispute)
    db.session.commit()

    return jsonify({'id': dispute.id, 'status': dispute.status}), 201


@verify_bp.route('/disputes', methods=['GET'])
def list_disputes():
    """List dispute tickets for admin review."""
    tickets = DisputeTicket.query.order_by(DisputeTicket.created_at.desc()).all()
    return jsonify([
        {
            'id': t.id,
            'log_id': t.log_id,
            'worker_id': t.worker_id,
            'message': t.message,
            'status': t.status,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'resolved_at': t.resolved_at.isoformat() if t.resolved_at else None,
        }
        for t in tickets
    ]), 200