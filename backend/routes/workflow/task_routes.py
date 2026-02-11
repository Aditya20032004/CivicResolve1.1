from flask import Blueprint, request, jsonify
from backend.models import db, PotholeReport, GarbageReport

task_bp = Blueprint('tasks', __name__)

@task_bp.route('/assign', methods=['POST'])
def assign_task():
    print("🔧 Task Assignment Request")
    data = request.json
    print(f"   Data: {data}")
    
    report_id = data.get('id')
    rtype = data.get('type')
    worker_id = data.get('worker_id')
    
    if not all([report_id, rtype, worker_id]):
        missing = []
        if not report_id: missing.append('id')
        if not rtype: missing.append('type')
        if not worker_id: missing.append('worker_id')
        print(f"❌ Missing required fields: {missing}")
        return jsonify({'error': 'Missing required fields', 'missing': missing}), 400
    
    report = None
    if rtype == 'pothole':
        report = PotholeReport.query.get(report_id)
    elif rtype == 'garbage':
        report = GarbageReport.query.get(report_id)
        
    if not report:
        return jsonify({'error': 'Report not found'}), 404
        
    report.assigned_worker_id = worker_id
    report.status = 'assigned'
    db.session.commit()
    
    return jsonify({'message': 'Task assigned successfully'}), 200