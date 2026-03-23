from flask import Blueprint, request, jsonify
from backend.models import PotholeReport, GarbageReport
from workflow.worker_workflow import assign_report_to_worker

task_bp = Blueprint('tasks', __name__)

@task_bp.route('/assign', methods=['POST'])
def assign_task():
    print("🔧 Task Assignment Request")
    data = request.json
    print(f"   Data: {data}")
    
    report_id = data.get('id')
    rtype = data.get('type')
    worker_id = data.get('worker_id')  # Optional for auto-assignment

    if not all([report_id, rtype]):
        missing = []
        if not report_id:
            missing.append('id')
        if not rtype:
            missing.append('type')
        print(f"❌ Missing required fields: {missing}")
        return jsonify({'error': 'Missing required fields', 'missing': missing}), 400
    
    report = None
    if rtype == 'pothole':
        report = PotholeReport.query.get(report_id)
    elif rtype == 'garbage':
        report = GarbageReport.query.get(report_id)
        
    if not report:
        return jsonify({'error': 'Report not found'}), 404

    # Use worker workflow to respect per-worker max limits and proximity
    assignment = assign_report_to_worker(
        report,
        preferred_worker_id=worker_id,
        auto_commit=True,
    )

    if not assignment:
        return jsonify({'error': 'No eligible worker available'}), 409

    return jsonify({'message': 'Task assigned successfully', 'assignment': assignment}), 200
