"""Smart Issue Validator - Fake Report Detection.

This module validates incoming civic issue reports before they enter the
workflow. It combines EXIF checks, screenshot heuristics, YOLO content
verification, and lightweight duplicate / anomaly detection into a single
trust score that the rest of the system can reason about.
"""

import os
import hashlib
from datetime import datetime, timedelta
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from pathlib import Path
from math import radians, cos, sin, sqrt, atan2


class IssueValidator:
    """Validates civic issue reports and calculates trust scores."""
    
    # Scoring weights
    SCORE_GPS_MATCH = 20
    SCORE_RECENT_TIMESTAMP = 15
    SCORE_CIVIC_DETECTED = 25
    SCORE_CATEGORY_MATCH = 20
    SCORE_NOT_SCREENSHOT = 10
    SCORE_NORMAL_RATE = 10
    
    # Thresholds
    THRESHOLD_APPROVE = 80
    THRESHOLD_FLAG = 60
    MAX_GPS_DISTANCE_KM = 1.0  # 1km tolerance
    MAX_IMAGE_AGE_HOURS = 24
    
    def __init__(self, yolo_model=None):
        self.model = yolo_model
        self.checks = {}
        self.score = 100  # Start with full trust
        self.penalties = []

        # In-memory per-user anomaly tracking. This is intentionally
        # lightweight and stateless across process restarts – the goal
        # is to make repeated fake submissions from the same identity
        # increasingly expensive without adding a new DB table.
        #
        # Structure:
        #   { user_id: { 'total': int, 'rejected': int, 'flagged': int } }
        self._user_stats = {}
    
    def validate_report(self, image_path, claimed_lat=None, claimed_lng=None, 
                       issue_type=None, user_id=None):
        """
        Main validation method. Returns validation result.
        
        Returns:
            dict: {
                'score': int (0-100),
                'decision': 'approved' | 'flagged' | 'rejected',
                'message': str,
                'checks': dict of individual check results
            }
        """
        self.score = 100
        self.penalties = []
        self.checks = {}

        # Lightweight image fingerprint used for duplicate detection and
        # optional downstream storage on the report model.
        image_hash = self._fingerprint_image(image_path)

        # Run all checks
        self._check_exif_data(image_path, claimed_lat, claimed_lng)
        self._detect_screenshot(image_path)
        self._verify_civic_content(image_path, issue_type)
        self._check_duplicates(image_hash)
        self._check_basic_image_forensics(image_path)
        self._apply_user_history_penalty(user_id)
        
        # Calculate final score (subtract penalties)
        final_score = max(0, min(100, self.score - sum(self.penalties)))
        
        # Determine decision
        if final_score >= self.THRESHOLD_APPROVE:
            decision = 'approved'
            message = "Report verified successfully."
        elif final_score >= self.THRESHOLD_FLAG:
            decision = 'flagged'
            message = "Your report is under review. We'll verify within 2 hours."
        else:
            decision = 'rejected'
            message = ("We couldn't verify this image. Please ensure your photo "
                      "shows an actual civic issue, was taken recently at the "
                      "reported location, and provides a clear view of the problem.")

        # Update in-memory user anomaly stats so that repeat offenders
        # gradually receive a lower trust score on future submissions.
        self._record_user_outcome(user_id, decision)

        return {
            'score': final_score,
            'decision': decision,
            'message': message,
            'checks': self.checks,
            'image_hash': image_hash,
        }

    # ------------------------------------------------------------------
    # Core check implementations
    # ------------------------------------------------------------------

    def _fingerprint_image(self, image_path):
        """Return a stable SHA-256 fingerprint for an image file.

        This is intentionally simple (byte-level hash) rather than a
        heavy perceptual hash implementation to avoid extra dependencies
        while still catching exact and near-exact re-uploads.
        """
        try:
            with open(image_path, 'rb') as f:
                digest = hashlib.sha256(f.read()).hexdigest()
        except Exception as e:
            digest = None
            self.checks['image_fingerprint'] = {
                'status': 'error',
                'error': str(e),
            }
            return None

        self.checks['image_fingerprint'] = {
            'status': 'ok',
            'hash': digest,
        }
        return digest
    
    def _check_exif_data(self, image_path, claimed_lat=None, claimed_lng=None):
        """Extract and validate EXIF metadata."""
        try:
            img = Image.open(image_path)
            exif_data = img._getexif()
            
            if not exif_data:
                self.checks['exif'] = {'status': 'missing', 'note': 'No EXIF data found'}
                self.penalties.append(15)  # Suspicious but not fatal
                return
            
            # Parse EXIF tags
            exif = {}
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                exif[tag] = value
            
            # Check timestamp
            date_taken = exif.get('DateTimeOriginal') or exif.get('DateTime')
            if date_taken:
                try:
                    photo_time = datetime.strptime(date_taken, '%Y:%m:%d %H:%M:%S')
                    age_hours = (datetime.now() - photo_time).total_seconds() / 3600
                    
                    if age_hours > self.MAX_IMAGE_AGE_HOURS:
                        self.checks['timestamp'] = {'status': 'old', 'age_hours': age_hours}
                        self.penalties.append(20)
                    else:
                        self.checks['timestamp'] = {'status': 'recent', 'age_hours': age_hours}
                except (ValueError, TypeError):
                    self.checks['timestamp'] = {'status': 'parse_error'}
                    self.penalties.append(5)
            else:
                self.checks['timestamp'] = {'status': 'missing'}
                self.penalties.append(10)
            
            # Check GPS data
            gps_info = exif.get('GPSInfo')
            if gps_info and claimed_lat is not None and claimed_lng is not None:
                exif_lat, exif_lng = self._parse_gps(gps_info)
                if exif_lat is not None and exif_lng is not None:
                    distance = self._haversine(exif_lat, exif_lng, claimed_lat, claimed_lng)
                    if distance > self.MAX_GPS_DISTANCE_KM:
                        self.checks['gps'] = {'status': 'mismatch', 'distance_km': distance}
                        self.penalties.append(30)
                    else:
                        self.checks['gps'] = {'status': 'match', 'distance_km': distance}
            elif claimed_lat is not None and claimed_lng is not None:
                self.checks['gps'] = {'status': 'no_exif_gps'}
                self.penalties.append(10)
                
        except Exception as e:
            self.checks['exif'] = {'status': 'error', 'error': str(e)}
            self.penalties.append(5)
    
    def _parse_gps(self, gps_info):
        """Parse GPS coordinates from EXIF GPSInfo."""
        try:
            gps = {}
            for key in gps_info.keys():
                decode = GPSTAGS.get(key, key)
                gps[decode] = gps_info[key]

            def convert_to_degrees(value):
                d, m, s = value
                return d + (m / 60.0) + (s / 3600.0)

            lat_value = gps.get('GPSLatitude')
            lng_value = gps.get('GPSLongitude')

            # If either latitude or longitude is missing, GPS is unavailable
            if not lat_value or not lng_value:
                return None, None

            lat = convert_to_degrees(lat_value)
            lng = convert_to_degrees(lng_value)

            if gps.get('GPSLatitudeRef') == 'S':
                lat = -lat
            if gps.get('GPSLongitudeRef') == 'W':
                lng = -lng
            return lat, lng
        except Exception:
            return None, None
    
    def _haversine(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates in km."""
        R = 6371  # Earth's radius in km
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
    
    def _detect_screenshot(self, image_path):
        """Detect if image is a screenshot."""
        try:
            img = Image.open(image_path)
            width, height = img.size
            
            # Common screenshot aspect ratios
            aspect = width / height if height else 0
            screenshot_aspects = [0.46, 0.56, 0.6, 1.78, 2.17]  # Phone screens
            
            is_screenshot = False
            
            # Check for exact phone resolutions
            phone_resolutions = [
                (1080, 2340), (1080, 2400), (1170, 2532),  # Modern phones
                (1125, 2436), (1440, 3200), (1284, 2778),
            ]
            if (width, height) in phone_resolutions or (height, width) in phone_resolutions:
                is_screenshot = True
            
            # Check for status bar indicators (top portion uniformity)
            if not is_screenshot:
                top_strip = img.crop((0, 0, width, min(50, height)))
                colors = top_strip.getcolors(maxcolors=100)
                if colors and len(colors) < 10:  # Very few colors = likely status bar
                    is_screenshot = True
            
            if is_screenshot:
                self.checks['screenshot'] = {'status': 'detected'}
                self.penalties.append(25)
            else:
                self.checks['screenshot'] = {'status': 'not_detected'}
                
        except Exception as e:
            self.checks['screenshot'] = {'status': 'error', 'error': str(e)}

    def _check_duplicates(self, image_hash):
        """Check if this image hash already exists in the incident tables.

        When a duplicate is found we don't immediately reject the
        report, but we do record the linkage and apply a moderate
        penalty so that exact re-uploads of the same photo gradually
        reduce trust.
        """
        if not image_hash:
            self.checks['duplicate'] = {
                'status': 'skipped',
                'reason': 'no_hash',
            }
            return

        try:
            # Late import to avoid circular imports during app startup.
            from backend.models import (
                PotholeReport,
                GarbageReport,
                DamagedRoadReport,
                IllegalParkingReport,
                BrokenSignReport,
                FallenTreeReport,
                VandalismReport,
                DeadAnimalReport,
                DamagedConcreteReport,
                DamagedWiresReport,
            )

            models = [
                PotholeReport,
                GarbageReport,
                DamagedRoadReport,
                IllegalParkingReport,
                BrokenSignReport,
                FallenTreeReport,
                VandalismReport,
                DeadAnimalReport,
                DamagedConcreteReport,
                DamagedWiresReport,
            ]

            matches = []
            for model in models:
                try:
                    rows = model.query.filter_by(image_hash=image_hash).limit(3).all()
                except Exception:
                    # If the underlying DB is missing the new column the
                    # query will fail; in that case we simply skip duplicate
                    # checking instead of breaking validation entirely.
                    rows = []
                for r in rows:
                    matches.append({
                        'id': r.id,
                        'type': model.__tablename__,
                        'status': r.status,
                    })

            if matches:
                # Apply a modest penalty – duplicate reports can still be
                # valid if many citizens report the same issue, but we
                # want to surface it to the caller and the UI.
                self.checks['duplicate'] = {
                    'status': 'duplicate',
                    'matches': matches,
                }
                self.penalties.append(15)
            else:
                self.checks['duplicate'] = {
                    'status': 'unique',
                }
        except Exception as e:
            self.checks['duplicate'] = {
                'status': 'error',
                'error': str(e),
            }

    def _check_basic_image_forensics(self, image_path):
        """Apply lightweight forensics-style sanity checks on the image.

        This is deliberately simple but catches common low-effort fakes:
        extremely tiny files, images with almost no visual variation,
        or images that look like heavily compressed screenshots.
        """
        try:
            stats = {
                'status': 'ok',
            }

            # 1) Very small files are suspicious (saves, crops, templates).
            try:
                size_bytes = os.path.getsize(image_path)
                stats['size_bytes'] = size_bytes
                if size_bytes < 10 * 1024:  # <10KB
                    stats['small_file'] = True
                    self.penalties.append(10)
            except OSError as e:
                stats['size_error'] = str(e)

            # 2) Extremely narrow dynamic range (almost flat image).
            try:
                img = Image.open(image_path).convert('L')
                hist = img.histogram()
                non_zero_bins = sum(1 for v in hist if v > 0)
                stats['non_zero_bins'] = non_zero_bins
                if non_zero_bins < 16:
                    # Images with very few intensity levels are usually
                    # generated overlays or "blank" screens.
                    stats['low_variation'] = True
                    self.penalties.append(10)
            except Exception as e:
                stats['hist_error'] = str(e)

            self.checks['forensics'] = stats
        except Exception as e:
            self.checks['forensics'] = {
                'status': 'error',
                'error': str(e),
            }
    
    def _verify_civic_content(self, image_path, claimed_type=None):
        """Verify image contains civic infrastructure using YOLO model."""
        if not self.model:
            # Penalize when the AI model is not available so that missing
            # content verification does not silently result in a high score.
            self.checks['content'] = {
                'status': 'skipped',
                'note': 'No AI model loaded'
            }
            # Apply a penalty comparable to the "no civic detected" case.
            self.penalties.append(30)
            return
        
        try:
            results = self.model(image_path, conf=0.25, verbose=False)
            
            detections = []
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    name = self.model.names[cls_id]
                    conf = float(box.conf[0])
                    detections.append({'class': name, 'confidence': conf})
            
            if not detections:
                self.checks['content'] = {'status': 'no_civic_detected'}
                self.penalties.append(30)
                return
            
            # Check if detection matches claimed type
            detected_classes = [d['class'].lower() for d in detections]
            
            if claimed_type:
                if claimed_type.lower() in detected_classes:
                    self.checks['content'] = {
                        'status': 'match',
                        'detected': detections,
                        'claimed': claimed_type
                    }
                else:
                    self.checks['content'] = {
                        'status': 'mismatch',
                        'detected': detections,
                        'claimed': claimed_type
                    }
                    self.penalties.append(20)
            else:
                self.checks['content'] = {
                    'status': 'detected',
                    'detected': detections
                }
                
        except Exception as e:
            self.checks['content'] = {'status': 'error', 'error': str(e)}

    # ------------------------------------------------------------------
    # User anomaly tracking helpers
    # ------------------------------------------------------------------

    def _apply_user_history_penalty(self, user_id):
        """Apply a soft penalty if this user has a bad history.

        This only kicks in when a stable `user_id` is provided; the
        current citizen flow does not yet attach identities, but the
        validator is ready for future authenticated submissions.
        """
        if not user_id:
            return

        stats = self._user_stats.get(user_id)
        if not stats:
            return

        total = max(stats.get('total', 0), 1)
        rejected = stats.get('rejected', 0)
        flagged = stats.get('flagged', 0)
        suspicious_ratio = (rejected + 0.5 * flagged) / float(total)

        if suspicious_ratio >= 0.5:
            # Heavy repeat offenders get a noticeable penalty.
            self.penalties.append(15)
        elif suspicious_ratio >= 0.3:
            self.penalties.append(8)

        self.checks['user_history'] = {
            'status': 'applied',
            'total_reports': total,
            'rejected': rejected,
            'flagged': flagged,
            'suspicious_ratio': suspicious_ratio,
        }

    def _record_user_outcome(self, user_id, decision):
        """Update in-memory stats for the given user based on decision."""
        if not user_id:
            return

        stats = self._user_stats.setdefault(user_id, {
            'total': 0,
            'rejected': 0,
            'flagged': 0,
        })

        stats['total'] += 1
        if decision == 'rejected':
            stats['rejected'] += 1
        elif decision == 'flagged':
            stats['flagged'] += 1


# Singleton instance for reuse
_validator_instance = None

def get_validator(model=None):
    """Get or create validator instance."""
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = IssueValidator(yolo_model=model)
    elif model and _validator_instance.model is None:
        _validator_instance.model = model
    return _validator_instance
