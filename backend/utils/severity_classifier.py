"""Severity and class estimator for civic issue images.

Uses YOLO model detections to infer the dominant issue class
(e.g., pothole or garbage) and an approximate severity level
(low, medium, high) based on how much of the image is covered
by the detected issue.
"""

from typing import Any, Dict, List, Optional


def classify_issue_from_results(results: Any, model: Any) -> Dict[str, Any]:
    """Classify issue type and severity from YOLO results.

    Args:
        results: Ultralytics YOLO results list (model(image_path)).
        model:   Loaded YOLO model (for names lookup).

    Returns:
        dict with keys:
            - issue_class: 'pothole' | 'garbage' | None
            - severity: 'low' | 'medium' | 'high' | None
            - stats: raw aggregation stats used for the decision
    """

    if results is None or len(results) == 0 or model is None:
        return {"issue_class": None, "severity": None, "stats": {}}

    r = results[0]
    try:
        height, width = r.orig_shape[:2]
    except Exception:
        height, width = None, None

    total_area_by_class: Dict[str, float] = {}
    count_by_class: Dict[str, int] = {}

    for box in getattr(r, "boxes", []) or []:
        try:
            cls_id = int(box.cls[0])
            name = str(model.names[cls_id]).lower()
        except Exception:
            continue

        if name not in {"pothole", "garbage"}:
            continue

        try:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            area = max((x2 - x1), 0) * max((y2 - y1), 0)
        except Exception:
            area = 0.0

        total_area_by_class[name] = total_area_by_class.get(name, 0.0) + float(area)
        count_by_class[name] = count_by_class.get(name, 0) + 1

    if not total_area_by_class:
        return {"issue_class": None, "severity": None, "stats": {}}

    # Pick the class with the largest total area (or count as tiebreaker)
    candidates: List[str] = list(total_area_by_class.keys())
    dominant = max(
        candidates,
        key=lambda cls: (total_area_by_class.get(cls, 0.0), count_by_class.get(cls, 0)),
    )

    total_area = total_area_by_class[dominant]
    image_area: Optional[float]
    if height and width:
        image_area = float(height * width)
    else:
        image_area = None

    coverage_ratio: Optional[float]
    if image_area and image_area > 0:
        coverage_ratio = total_area / image_area
    else:
        coverage_ratio = None

    # Heuristic thresholds for severity based on coverage of image
    severity: Optional[str]
    if coverage_ratio is None:
        # Fall back to count-based heuristic
        count = count_by_class.get(dominant, 0)
        if count <= 1:
            severity = "low"
        elif count == 2:
            severity = "medium"
        else:
            severity = "high"
    else:
        if coverage_ratio < 0.02:
            severity = "low"
        elif coverage_ratio < 0.08:
            severity = "medium"
        else:
            severity = "high"

    return {
        "issue_class": dominant,
        "severity": severity,
        "stats": {
            "total_area_by_class": total_area_by_class,
            "count_by_class": count_by_class,
            "coverage_ratio": coverage_ratio,
        },
    }
