from flask import Blueprint, jsonify, request
from backend.models import db, PotholeReport, GarbageReport, Worker

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/', methods=['GET'])
def admin_index():
    """Fixes 404 on /api/admin"""
    return jsonify({
        'message': 'CivicResolve Admin API',
        'status': 'active',
        'endpoints': {
            'stats': '/api/admin/stats',
            'reports': '/api/admin/reports'
        }
    }), 200

@admin_bp.route('/reports', methods=['GET'])
def get_all_reports():
    potholes = PotholeReport.query.all()
    garbage = GarbageReport.query.all()
    
    all_reports = [p.to_dict() for p in potholes] + [g.to_dict() for g in garbage]
    all_reports.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify(all_reports), 200

@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    p_count = PotholeReport.query.count()
    g_count = GarbageReport.query.count()
    
    return jsonify({
        'total': p_count + g_count,
        'potholes': p_count,
        'garbage': g_count
    }), 200


@admin_bp.route('/workers', methods=['GET'])
def list_workers():
    """List all workers in the Bhopal worker pool."""
    workers = Worker.query.order_by(Worker.id.asc()).all()
    return jsonify([w.to_dict() for w in workers]), 200


@admin_bp.route('/workers/<worker_id>', methods=['GET'])
def get_worker(worker_id):
    """Get a single worker by ID."""
    worker = Worker.query.get(worker_id)
    if not worker:
        return jsonify({'error': 'Worker not found'}), 404
    return jsonify(worker.to_dict()), 200


@admin_bp.route('/workers', methods=['POST'])
def create_worker():
    """Create a new worker or update if ID already exists.

    This lets admins expand the worker pool beyond the default 20
    or adjust an existing worker record explicitly.
    """
    data = request.json or {}
    worker_id = data.get('id')
    name = data.get('name')

    if not worker_id or not name:
        return jsonify({'error': 'Missing required fields', 'required': ['id', 'name']}), 400

    worker = Worker.query.get(worker_id)
    if not worker:
        worker = Worker(id=worker_id, name=name)
        db.session.add(worker)
    else:
        worker.name = name

    # Optional fields
    if 'latitude' in data:
        worker.latitude = data['latitude']
    if 'longitude' in data:
        worker.longitude = data['longitude']
    if 'is_available' in data:
        worker.is_available = bool(data['is_available'])
    if 'max_tasks' in data:
        worker.max_tasks = int(data['max_tasks'])

    db.session.commit()
    return jsonify(worker.to_dict()), 201


@admin_bp.route('/workers/<worker_id>', methods=['PATCH'])
def update_worker(worker_id):
    """Update editable fields for an existing worker."""
    worker = Worker.query.get(worker_id)
    if not worker:
        return jsonify({'error': 'Worker not found'}), 404

    data = request.json or {}

    if 'name' in data:
        worker.name = data['name']
    if 'latitude' in data:
        worker.latitude = data['latitude']
    if 'longitude' in data:
        worker.longitude = data['longitude']
    if 'is_available' in data:
        worker.is_available = bool(data['is_available'])
    if 'max_tasks' in data:
        worker.max_tasks = int(data['max_tasks'])
    if 'active_tasks' in data:
        # Allow admin to manually correct active task counts if needed
        worker.active_tasks = max(int(data['active_tasks']), 0)
    if 'reward_points' in data:
        worker.reward_points = int(data['reward_points'])
    if 'penalty_points' in data:
        worker.penalty_points = int(data['penalty_points'])

    db.session.commit()
    return jsonify(worker.to_dict()), 200
