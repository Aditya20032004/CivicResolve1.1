"""Camera detection, storage, and retrieval helpers.

This module serves two roles:

- Real-time detection on camera frames using the shared YOLO model,
  returning detections plus severity/class information.
- Lightweight persistence of the latest frame per camera, along with
  GPS metadata, so verification workflows can fetch the nearest camera
  view for a given report location.
"""

import json
import shutil
from datetime import datetime
from math import radians, cos, sin, sqrt, atan2
from pathlib import Path
from typing import Any, Dict

import cv2
from ultralytics import YOLO

from backend.utils.severity_classifier import classify_issue_from_results


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "ai_ml" / "models" / "best_civic_model.pt"
CAMERA_DIR = BASE_DIR / "data" / "camera_feeds"

_camera_model: YOLO | None = None


def _ensure_camera_dir() -> None:
	CAMERA_DIR.mkdir(parents=True, exist_ok=True)


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
	"""Return great-circle distance between two points in km.

	If any coordinate is missing, returns a large sentinel distance so
	those candidates are effectively ignored.
	"""
	if None in (lat1, lon1, lat2, lon2):
		return 9999.0

	earth_radius_km = 6371.0
	lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
	d_lat = lat2 - lat1
	d_lon = lon2 - lon1
	a = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
	c = 2 * atan2(sqrt(a), sqrt(1 - a))
	return earth_radius_km * c


def record_camera_frame(
	image_path: str,
	latitude: float | None = None,
	longitude: float | None = None,
	camera_id: str = "cam_local",
	source: str = "simulator",
) -> Dict[str, Any]:
	"""Store a camera frame and metadata as the latest capture for a camera.

	This lets downstream verification logic retrieve the most recent view
	for the area around a report, ensuring we compare a worker's upload
	against the correct physical location.
	"""
	_ensure_camera_dir()
	src = Path(image_path)
	if not src.exists():
		raise FileNotFoundError(f"Camera source image not found: {image_path}")

	ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
	ext = src.suffix or ".jpg"
	dest_name = f"{camera_id}_{ts}{ext}"
	dest_path = CAMERA_DIR / dest_name
	shutil.copy2(src, dest_path)

	metadata = {
		"camera_id": camera_id,
		"path": str(dest_path),
		"latitude": latitude,
		"longitude": longitude,
		"source": source,
		"captured_at": datetime.utcnow().isoformat(),
	}

	metadata_path = CAMERA_DIR / f"latest_{camera_id}.json"
	with metadata_path.open("w", encoding="utf-8") as fp:
		json.dump(metadata, fp)

	return metadata


def get_latest_camera_frame(
	latitude: float | None = None,
	longitude: float | None = None,
	max_distance_km: float = 3.0,
) -> Dict[str, Any] | None:
	"""Return the closest latest camera frame metadata for the location.

	Frames are filtered by distance using haversine distance so that a
	report is only compared against cameras that are geographically close
	to the reported issue, avoiding unfair checks against unrelated areas.
	"""
	_ensure_camera_dir()
	metadata_files = sorted(CAMERA_DIR.glob("latest_*.json"))
	if not metadata_files:
		return None

	candidates: list[Dict[str, Any]] = []
	for file_path in metadata_files:
		try:
			data = json.loads(file_path.read_text(encoding="utf-8"))
			frame_path = Path(data.get("path", ""))
			if not frame_path.exists():
				continue

			distance = _haversine_km(
				latitude,
				longitude,
				data.get("latitude"),
				data.get("longitude"),
			)
			data["distance_km"] = distance
			candidates.append(data)
		except Exception:
			continue

	if not candidates:
		return None

	candidates.sort(key=lambda row: row.get("distance_km", 9999.0))
	nearest = candidates[0]

	if nearest.get("distance_km", 9999.0) > max_distance_km:
		return None
	return nearest


def get_camera_model() -> Any:
	"""Lazy-load YOLO model for camera-side detection."""
	global _camera_model
	if _camera_model is None and MODEL_PATH.exists():
		_camera_model = YOLO(str(MODEL_PATH))
		print("✅ Camera detection model loaded")
	return _camera_model


def analyze_frame(frame) -> Dict[str, Any]:
	"""Run detection + severity on a single camera frame.

	Returns a dictionary compatible with the /api/ai/predict
	endpoint so the frontend can treat both uniformly.
	"""
	model = get_camera_model()
	if not model:
		return {"error": "Camera AI model not available"}

	results = model(frame, conf=0.25)
	detections = []
	for r in results:
		for box in getattr(r, "boxes", []) or []:
			cls_id = int(box.cls[0])
			conf = float(box.conf[0])
			name = model.names[cls_id]
			detections.append({
				"class": name,
				"confidence": conf,
				"box": box.xyxy[0].tolist(),
			})

	classification = classify_issue_from_results(results, model)

	annotated = results[0].plot()
	# Caller can decide how to display or store annotated frames.
	return {
		"detections": detections,
		"count": len(detections),
		"issue_class": classification.get("issue_class"),
		"severity": classification.get("severity"),
		"annotated_frame": annotated,
	}

