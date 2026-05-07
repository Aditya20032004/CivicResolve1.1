from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class BaseReport(db.Model):
    """Abstract base class for common fields."""
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    image_filename = db.Column(db.String(255), nullable=False)
    # Stable fingerprint of the original image used for duplicate
    # detection and basic anti-fraud analytics.
    image_hash = db.Column(db.String(64), nullable=True)
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
    # When the worker's fix was first marked as verified.
    resolved_at = db.Column(db.DateTime, nullable=True)

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


class DamagedRoadReport(BaseReport):
    """Reports for generic damaged road issues (non-pothole)."""

    __tablename__ = 'damaged_roads'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'damaged_road',
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


class IllegalParkingReport(BaseReport):
    """Reports for illegal parking issues."""

    __tablename__ = 'illegal_parking'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'illegal_parking',
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


class BrokenSignReport(BaseReport):
    """Reports for broken road sign issues."""

    __tablename__ = 'broken_signs'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'broken_sign',
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


class FallenTreeReport(BaseReport):
    """Reports for fallen tree incidents."""

    __tablename__ = 'fallen_trees'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'fallen_tree',
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


class VandalismReport(BaseReport):
    """Reports for vandalism-related civic issues."""

    __tablename__ = 'vandalism'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'vandalism',
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


class DeadAnimalReport(BaseReport):
    """Reports for dead animal pollution issues."""

    __tablename__ = 'dead_animals'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'dead_animal',
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


class DamagedConcreteReport(BaseReport):
    """Reports for damaged concrete structures."""

    __tablename__ = 'damaged_concrete'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'damaged_concrete',
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


class DamagedWiresReport(BaseReport):
    """Reports for damaged electric wires and poles."""

    __tablename__ = 'damaged_wires'

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'damaged_wires',
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

    # Long-term performance metrics used for composite reliability.
    total_assigned = db.Column(db.Integer, default=0)
    total_completed = db.Column(db.Integer, default=0)
    total_verified = db.Column(db.Integer, default=0)
    total_rejected = db.Column(db.Integer, default=0)
    total_sla_breaches = db.Column(db.Integer, default=0)
    total_disputes = db.Column(db.Integer, default=0)
    avg_resolution_minutes = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def compute_reliability_score(self) -> float:
        """Compute a composite reliability score for this worker.

        The score is intentionally bounded between 0 and 100 and
        combines raw reward/penalty points with long-term metrics such
        as completion rate, SLA compliance, and dispute rate.
        """
        base = 50.0

        # Reward / penalty influence
        reward = float(self.reward_points or 0)
        penalty = float(self.penalty_points or 0)
        base += 0.5 * reward
        base -= 2.0 * penalty

        assigned = float(self.total_assigned or 0)
        verified = float(self.total_verified or 0)
        breaches = float(self.total_sla_breaches or 0)
        disputes = float(self.total_disputes or 0)

        if assigned > 0:
            completion_rate = verified / assigned
            # Strongly reward high completion rate
            base += (completion_rate - 0.6) * 40.0

            sla_compliance = max(0.0, 1.0 - (breaches / assigned))
            base += (sla_compliance - 0.8) * 30.0

        # Frequent disputes lower trust slightly even if verified.
        if verified > 0 and disputes > 0:
            dispute_rate = disputes / verified
            base -= dispute_rate * 20.0

        # Bound to a sane range.
        return max(0.0, min(100.0, base))

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
            'metrics': {
                'total_assigned': self.total_assigned,
                'total_completed': self.total_completed,
                'total_verified': self.total_verified,
                'total_rejected': self.total_rejected,
                'total_sla_breaches': self.total_sla_breaches,
                'total_disputes': self.total_disputes,
                'avg_resolution_minutes': self.avg_resolution_minutes,
                'reliability_score': self.compute_reliability_score(),
            },
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
