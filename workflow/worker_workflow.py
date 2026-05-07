"""Worker assignment and task management workflow.

This module maintains a pool of Bhopal-based workers and assigns
reports to them based on proximity to the issue and each worker's
per-worker maximum concurrent task limit.
"""

import os
from math import radians, cos, sin, sqrt, atan2

from backend.models import db, Worker


# Default Bhopal worker pool (20 workers around Bhopal city)
# Coordinates are clustered around the Bhopal city centre.
DEFAULT_WORKERS = [
	{"id": "worker_001", "name": "Ravi Kumar", "lat": 23.2599, "lng": 77.4126, "max_tasks": 4},
	{"id": "worker_002", "name": "Aman Singh", "lat": 23.2710, "lng": 77.4250, "max_tasks": 3},
	{"id": "worker_003", "name": "Neha Verma", "lat": 23.2480, "lng": 77.4017, "max_tasks": 3},
	{"id": "worker_004", "name": "Priya Sharma", "lat": 23.2700, "lng": 77.4400, "max_tasks": 4},
	{"id": "worker_005", "name": "Sanjay Patel", "lat": 23.2520, "lng": 77.3900, "max_tasks": 3},
	{"id": "worker_006", "name": "Anita Joshi", "lat": 23.2660, "lng": 77.4300, "max_tasks": 3},
	{"id": "worker_007", "name": "Deepak Singh", "lat": 23.2620, "lng": 77.4200, "max_tasks": 4},
	{"id": "worker_008", "name": "Meera Gupta", "lat": 23.2550, "lng": 77.4050, "max_tasks": 3},
	{"id": "worker_009", "name": "Vivek Tiwari", "lat": 23.2450, "lng": 77.4200, "max_tasks": 3},
	{"id": "worker_010", "name": "Kiran Rao", "lat": 23.2750, "lng": 77.4100, "max_tasks": 4},
	{"id": "worker_011", "name": "Rohit Jain", "lat": 23.2600, "lng": 77.4300, "max_tasks": 3},
	{"id": "worker_012", "name": "Shweta Mishra", "lat": 23.2680, "lng": 77.4450, "max_tasks": 3},
	{"id": "worker_013", "name": "Manoj Yadav", "lat": 23.2500, "lng": 77.4350, "max_tasks": 3},
	{"id": "worker_014", "name": "Pooja Das", "lat": 23.2720, "lng": 77.3950, "max_tasks": 4},
	{"id": "worker_015", "name": "Arun Nair", "lat": 23.2580, "lng": 77.4500, "max_tasks": 3},
	{"id": "worker_016", "name": "Sonia Reddy", "lat": 23.2640, "lng": 77.4050, "max_tasks": 3},
	{"id": "worker_017", "name": "Gaurav Kulkarni", "lat": 23.2540, "lng": 77.4180, "max_tasks": 3},
	{"id": "worker_018", "name": "Nidhi Pandey", "lat": 23.2470, "lng": 77.4090, "max_tasks": 3},
	{"id": "worker_019", "name": "Ashish Mehta", "lat": 23.2730, "lng": 77.4220, "max_tasks": 4},
	{"id": "worker_020", "name": "Lakshmi Iyer", "lat": 23.2615, "lng": 77.4375, "max_tasks": 3},
]


# Fallback max tasks if worker.max_tasks is not set
DEFAULT_MAX_TASKS = int(os.environ.get('WORKER_MAX_ACTIVE_TASKS', '3'))


def _haversine_km(lat1, lon1, lat2, lon2):
	"""Calculate distance between two coordinates in KM."""
	if None in (lat1, lon1, lat2, lon2):
		return 9999.0

	earth_radius_km = 6371.0
	lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
	d_lat = lat2 - lat1
	d_lon = lon2 - lon1

	a = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
	c = 2 * atan2(sqrt(a), sqrt(1 - a))
	return earth_radius_km * c


def bootstrap_workers():
	"""Ensure a Bhopal-local worker pool exists in the database.

	If a worker already exists, keep its dynamic fields but refresh core
	location metadata to stay aligned with the configured pool.
	"""
	for worker in DEFAULT_WORKERS:
		existing = Worker.query.get(worker["id"])
		if existing:
			existing.name = worker["name"]
			existing.latitude = worker["lat"]
			existing.longitude = worker["lng"]
			if existing.is_available is None:
				existing.is_available = True
			if existing.active_tasks is None:
				existing.active_tasks = 0
			if existing.max_tasks is None:
				existing.max_tasks = worker.get("max_tasks") or DEFAULT_MAX_TASKS
		else:
			max_tasks = worker.get("max_tasks") or DEFAULT_MAX_TASKS
			db.session.add(
				Worker(
					id=worker["id"],
					name=worker["name"],
					latitude=worker["lat"],
					longitude=worker["lng"],
					is_available=True,
					active_tasks=0,
					max_tasks=max_tasks,
				)
			)
	db.session.flush()


def get_worker_pool_snapshot():
	"""Return current worker pool from the database as dictionaries."""
	bootstrap_workers()
	workers = Worker.query.order_by(Worker.id.asc()).all()
	return [worker.to_dict() for worker in workers]


def _select_best_worker(report_lat=None, report_lng=None):
	"""Choose nearest eligible worker based on distance and load.

	Eligibility rules:
	- is_available must be True
	- active_tasks must be below worker.max_tasks (or DEFAULT_MAX_TASKS)
	"""
	bootstrap_workers()
	candidates = Worker.query.filter_by(is_available=True).all()
	if not candidates:
		return None

	scored = []
	for worker in candidates:
		max_tasks = worker.max_tasks or DEFAULT_MAX_TASKS
		current_tasks = worker.active_tasks or 0
		if current_tasks >= max_tasks:
			continue

		distance = _haversine_km(worker.latitude, worker.longitude, report_lat, report_lng)

		# Composite reliability score from the Worker model combines
		# reward/penalty history with long-term performance metrics.
		try:
			reliability = float(worker.compute_reliability_score())
		except Exception:
			# Fallback to a neutral score if anything goes wrong.
			reliability = 50.0

		# Score: closer distance and fewer active tasks are better. A
		# higher reliability score slightly reduces the effective cost so
		# that two nearby workers are ordered by long-term performance.
		performance_bias = -(reliability / 40.0)
		score = distance + (current_tasks * 2.0) + performance_bias
		scored.append((score, distance, current_tasks, worker))

	if not scored:
		return None

	scored.sort(key=lambda item: (item[0], item[1], item[2], item[3].id))
	return scored[0][3]


def assign_report_to_worker(report, preferred_worker_id=None, auto_commit=True):
	"""Assign a report to a worker based on availability and proximity.

	If preferred_worker_id is provided, try to honor it while still
	respecting the worker's max task limit. Otherwise automatically
	select the best worker near the issue location.
	"""
	bootstrap_workers()

	worker = None
	if preferred_worker_id:
		worker = Worker.query.get(preferred_worker_id)
		if worker is None:
			return None
		max_tasks = worker.max_tasks or DEFAULT_MAX_TASKS
		current_tasks = worker.active_tasks or 0
		if (not worker.is_available) or current_tasks >= max_tasks:
			return None
	else:
		worker = _select_best_worker(report.latitude, report.longitude)

	if not worker:
		return None

	report.assigned_worker_id = worker.id
	report.status = 'assigned'
	worker.active_tasks = (worker.active_tasks or 0) + 1
	worker.total_assigned = (worker.total_assigned or 0) + 1

	if auto_commit:
		db.session.commit()
	else:
		db.session.flush()

	return {
		'worker_id': worker.id,
		'worker_name': worker.name,
		'active_tasks': worker.active_tasks,
		'max_tasks': worker.max_tasks or DEFAULT_MAX_TASKS,
	}


def release_worker_task(worker_id, auto_commit=True):
	"""Decrease worker active task count after verification or cancellation."""
	if not worker_id:
		return

	worker = Worker.query.get(worker_id)
	if not worker:
		return

	worker.active_tasks = max((worker.active_tasks or 0) - 1, 0)

	if auto_commit:
		db.session.commit()
	else:
		db.session.flush()

