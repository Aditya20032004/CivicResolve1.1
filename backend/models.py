from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class BaseReport(db.Model):
    """Abstract base class for common fields."""
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    image_filename = db.Column(db.String(255), nullable=False)
    resolved_image = db.Column(db.String(255), nullable=True)
    
    # Location
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    address = db.Column(db.String(255))
    
    # Workflow
    status = db.Column(db.String(20), default='pending') # pending, assigned, completed, verified
    assigned_worker_id = db.Column(db.String(50), nullable=True)
    verification_notes = db.Column(db.String(500), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PotholeReport(BaseReport):
    __tablename__ = 'potholes'
    severity = db.Column(db.String(20), default='medium') # low, medium, high

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'pothole',
            'severity': self.severity,
            'status': self.status,
            'assigned_to': self.assigned_worker_id,
            'location': {'lat': self.latitude, 'lng': self.longitude, 'address': self.address},
            'images': {'original': self.image_filename, 'resolved': self.resolved_image},
            'created_at': self.created_at.isoformat()
        }

class GarbageReport(BaseReport):
    __tablename__ = 'garbage'
    garbage_type = db.Column(db.String(50), default='mixed') # plastic, organic

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'garbage',
            'garbage_type': self.garbage_type,
            'status': self.status,
            'assigned_to': self.assigned_worker_id,
            'location': {
                'lat': self.latitude,
                'lng': self.longitude,
                'address': self.address,
            },
            'images': {
                'original': self.image_filename,
                'resolved': self.resolved_image,
            },
            'created_at': self.created_at.isoformat(),
        }


class Worker(db.Model):
    __tablename__ = 'workers'

    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    is_available = db.Column(db.Boolean, default=True)
    active_tasks = db.Column(db.Integer, default=0)
    # Per-worker max concurrent tasks (worker capacity)
    max_tasks = db.Column(db.Integer, default=3)

    # Simple reward/penalty tracking for report honesty
    reward_points = db.Column(db.Integer, default=0)
    penalty_points = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'location': {
                'lat': self.latitude,
                'lng': self.longitude,
            },
            'is_available': self.is_available,
            'active_tasks': self.active_tasks,
            'max_tasks': self.max_tasks,
            'reward_points': self.reward_points,
            'penalty_points': self.penalty_points,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class VerificationLog(db.Model):
    """Immutable audit record of verification decisions for a report.

    Captures both automatic (worker AI + camera, camera sweep) and
    manual admin decisions so they can be reviewed later or disputed
    by workers.
    """

    __tablename__ = 'verification_logs'

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, nullable=False)
    report_type = db.Column(db.String(20), nullable=False)  # 'pothole' or 'garbage'
    worker_id = db.Column(db.String(50), nullable=True)
    channel = db.Column(db.String(50), nullable=False)  # 'worker_auto', 'admin_manual', 'camera_sweep'
    decision = db.Column(db.String(20), nullable=False)  # 'verified', 'assigned', 'rejected'
    reason = db.Column(db.String(500), nullable=True)
    details_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class DisputeTicket(db.Model):
    """Worker- or admin-initiated dispute against a verification log."""

    __tablename__ = 'disputes'

    id = db.Column(db.Integer, primary_key=True)
    log_id = db.Column(db.Integer, nullable=False)
    worker_id = db.Column(db.String(50), nullable=True)
    message = db.Column(db.String(500), nullable=False)
    status = db.Column(db.String(20), default='open')  # open, resolved
    resolution_notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
