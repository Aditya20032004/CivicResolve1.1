from flask import Blueprint, request, jsonify
from backend.models import db, PotholeReport, GarbageReport

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
        
    db.session.commit()
    return jsonify({'message': f'Task {decision}d'}), 200