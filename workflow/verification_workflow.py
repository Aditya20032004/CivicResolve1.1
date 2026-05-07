"""Verification workflow for worker completion and camera re-check.

This module verifies a worker's completion photo in two stages:
- Compare the worker's resolved image against the original report image
  using the YOLO model (issue confidence) and/or visual similarity.
- Cross-check the resolved image against the nearest camera frame for
  the same geographic area, again using YOLO confidence and similarity.

The result is a detailed decision payload that upstream routes can use
to reward or penalize workers fairly.
"""

from pathlib import Path

import cv2
from ultralytics import YOLO

from camera_integration.detection_service import get_latest_camera_frame


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "ai_ml" / "models" / "best_civic_model.pt"

_model = None
_model_load_attempted = False


def _get_model():
	global _model
	global _model_load_attempted

	if _model_load_attempted:
		return _model

	_model_load_attempted = True
	if MODEL_PATH.exists():
		try:
			_model = YOLO(str(MODEL_PATH))
		except Exception:
			_model = None
	return _model


def _max_issue_confidence(image_path, issue_type):
	"""Return the maximum YOLO confidence for the target issue type in an image.

	If the model or detections are unavailable, returns None so that
	callers can fall back to a pure-vision similarity check instead.
	"""
	model = _get_model()
	if not model:
		return None

	results = model(str(image_path), conf=0.20, verbose=False)
	max_conf = 0.0
	target = (issue_type or "").strip().lower()

	for result in results:
		for box in result.boxes:
			class_id = int(box.cls[0])
			class_name = str(model.names.get(class_id, "")).lower()
			confidence = float(box.conf[0])
			if class_name == target:
				max_conf = max(max_conf, confidence)

	return max_conf


def _compute_similarity(path_a, path_b):
	"""Return color-histogram correlation similarity in [0, 1]."""
	image_a = cv2.imread(str(path_a))
	image_b = cv2.imread(str(path_b))

	if image_a is None or image_b is None:
		return 0.0

	image_a = cv2.resize(image_a, (256, 256))
	image_b = cv2.resize(image_b, (256, 256))

	hist_a = cv2.calcHist([image_a], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3)
	hist_b = cv2.calcHist([image_b], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3)

	cv2.normalize(hist_a, hist_a)
	cv2.normalize(hist_b, hist_b)
	score = cv2.compareHist(hist_a, hist_b, cv2.HISTCMP_CORREL)
	return float(max(0.0, min(1.0, score)))


def run_dual_verification(report, upload_folder):
	"""Verify completion using both worker upload and nearest camera frame.

	This checks:
	- The worker's resolved image vs the original report image, requiring
	  a substantial drop in YOLO confidence for the issue, or falling
	  back to a simple similarity check when the model is unavailable.
	- The worker's resolved image vs the latest nearby camera frame for
	  the same geographic area, ensuring we don't unfairly compare to a
	  camera pointing in a completely different direction.

	Returns a dict with an ``approved`` boolean, a human-readable
	``reason``, and a nested ``checks`` structure with confidence and
	similarity metrics that the caller can use for reward/penalty logic.
	"""
	original_path = Path(upload_folder) / report.image_filename
	resolved_path = Path(upload_folder) / report.resolved_image

	if not original_path.exists() or not resolved_path.exists():
		return {
			"approved": False,
			"reason": "Missing original or resolved image for verification.",
			"checks": {
				"uploaded_proof_check": "failed",
				"camera_recheck": "skipped",
			},
		}

	issue_type = "pothole" if getattr(report, "__tablename__", "") == "potholes" else "garbage"
	original_conf = _max_issue_confidence(original_path, issue_type)
	resolved_conf = _max_issue_confidence(resolved_path, issue_type)

	# Always compute similarity between original and resolved images so we
	# can reject both "no-change" proofs and obviously unrelated scenes.
	similarity = _compute_similarity(original_path, resolved_path)

	uploaded_ok = False
	if original_conf is None or resolved_conf is None:
		# Model not available: require the resolved image to look like the
		# same area (not completely different) but also not be effectively
		# identical. Very low similarity => probably a different scene;
		# very high similarity => no real change.
		if 0.40 <= similarity <= 0.98:
			uploaded_ok = True
	else:
		# Require a clear reduction in issue confidence after fix upload
		# AND a change in appearance in a realistic range. If the model
		# never saw the issue in the original, fall back to the same
		# similarity window check as the model-unavailable path.
		issue_threshold = 0.30
		if original_conf >= issue_threshold:
			reduction_ratio = 0.50
			conf_ok = resolved_conf <= max(0.15, original_conf * reduction_ratio)
			# Same-scene but changed: reject both nearly identical and
			# totally different/global scenes.
			visual_change_ok = 0.40 <= similarity <= 0.98
			uploaded_ok = bool(conf_ok and visual_change_ok)
		else:
			if 0.40 <= similarity <= 0.98:
				uploaded_ok = True

	camera_match = get_latest_camera_frame(
		latitude=report.latitude,
		longitude=report.longitude,
		max_distance_km=3.0,
	)

	# In environments without camera nodes, fall back to trusting the
	# worker upload alone; camera_ok starts as True and is only tightened
	# when a nearby frame is actually available.
	camera_ok = True
	camera_similarity = 0.0
	camera_issue_conf = None
	camera_note = "Camera recheck skipped; no nearby frame found"

	if camera_match:
		camera_path = Path(camera_match["path"])
		camera_similarity = _compute_similarity(resolved_path, camera_path)
		camera_issue_conf = _max_issue_confidence(camera_path, issue_type)

		if camera_issue_conf is None:
			# When the model cannot confidently detect the issue at all in the
			# camera frame, rely primarily on similarity to ensure it is the
			# same area / orientation.
			camera_ok = camera_similarity >= 0.35
		else:
			# For a fair comparison, we only trust the camera when it looks
			# like the same area (similarity threshold) and the issue
			# confidence is low, indicating the problem is gone.
			camera_ok = camera_similarity >= 0.35 and camera_issue_conf <= 0.20
		camera_note = f"Camera frame matched at {camera_match['distance_km']:.2f} km"

	approved = uploaded_ok and camera_ok
	reason = (
		"Resolution verified by worker upload + camera re-check."
		if approved
		else "Dual verification failed; task returned for rework."
	)

	return {
		"approved": approved,
		"reason": reason,
		"checks": {
			"uploaded_proof_check": "passed" if uploaded_ok else "failed",
			"camera_recheck": "passed" if camera_ok else "failed",
			"camera_note": camera_note,
			"similarity": {
				"worker_upload_vs_original": round(similarity, 4),
				"worker_upload_vs_camera": round(camera_similarity, 4),
			},
			"confidence": {
				"original_issue_confidence": original_conf,
				"resolved_issue_confidence": resolved_conf,
				"camera_issue_confidence": camera_issue_conf,
			},
		},
	}
