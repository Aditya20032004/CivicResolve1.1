"""Laptop camera / IP-camera simulator wired into CivicResolve models.

Usage (example with Android "IP Webcam" app):

1. Install an app that exposes your phone camera as an HTTP/MJPEG stream.
   For many apps the stream URL looks like: ``http://PHONE_IP:8080/video``.
2. Make sure the phone and laptop are on the same Wi‑Fi network.
3. From the CivicResolvev1.1 root (or this folder), run:

   python -m laptop_integration.camera_simulator \
	   --url http://PHONE_IP:8080/video \
	   --camera-id phone_cam \
	   --lat 23.2599 --lng 77.4126

This will:
- Continuously read frames from the phone stream using OpenCV.
- Run YOLO detection on each sampled frame via camera_integration.detection_service.
- Store the latest annotated frame + metadata using record_camera_frame,
  so verification and camera-sweep workflows can see it as a live node.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Optional

import cv2

from camera_integration.detection_service import analyze_frame, record_camera_frame


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Stream phone camera into CivicResolve camera node")
	parser.add_argument(
		"--url",
		required=True,
		help="IP camera/video stream URL (e.g. http://PHONE_IP:8080/video)",
	)
	parser.add_argument(
		"--camera-id",
		default="phone_cam",
		help="Logical camera id to use when storing frames (default: phone_cam)",
	)
	parser.add_argument(
		"--lat",
		type=float,
		default=23.2599,
		help="Latitude to associate with this camera (default: 23.2599)",
	)
	parser.add_argument(
		"--lng",
		type=float,
		default=77.4126,
		help="Longitude to associate with this camera (default: 77.4126)",
	)
	parser.add_argument(
		"--interval",
		type=float,
		default=3.0,
		help="Seconds between sampled frames for detection (default: 3.0)",
	)
	return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
	args = parse_args(argv)

	print(f"📡 Connecting to phone stream at {args.url} ...")
	cap = cv2.VideoCapture(args.url)
	if not cap.isOpened():
		print("❌ Failed to open video stream. Check URL / phone app / Wi‑Fi.")
		return 1

	# Temp directory for saving frames before handing to record_camera_frame
	tmp_dir = Path("data/phone_frames")
	tmp_dir.mkdir(parents=True, exist_ok=True)

	last_sample_t = 0.0
	try:
		while True:
			ok, frame = cap.read()
			if not ok or frame is None:
				print("⚠️ Failed to read frame, retrying in 1s ...")
				time.sleep(1.0)
				continue

			now = time.time()
			if now - last_sample_t < args.interval:
				# Skip frames between samples to reduce load.
				continue
			last_sample_t = now

			# Run detection directly on the frame
			det = analyze_frame(frame)
			issue_class = det.get("issue_class")
			severity = det.get("severity")
			count = det.get("count")

			print(
				f"🖼  Frame @ {time.strftime('%H:%M:%S')} | "
				f"count={count}, class={issue_class}, severity={severity}"
			)

			# Persist this frame as the latest for this camera id so that
			# verification/camera-sweep workflows can consume it.
			tmp_path = tmp_dir / "latest_phone_frame.jpg"
			cv2.imwrite(str(tmp_path), frame)
			record_camera_frame(
				image_path=str(tmp_path),
				latitude=args.lat,
				longitude=args.lng,
				camera_id=args.camera_id,
				source="phone_stream",
			)

	except KeyboardInterrupt:
		print("\n🛑 Stopping phone camera simulator.")
	finally:
		cap.release()

	return 0


if __name__ == "__main__":  # pragma: no cover
	raise SystemExit(main(sys.argv[1:]))

