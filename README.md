# CivicResolve v1.1 – AI-Powered Civic Issue Management

## Overview

CivicResolve detects, validates, routes, and tracks civic issues (potholes, garbage, vandalism, etc.) using a YOLOv8 model, a Flask backend, and a Next.js/React frontend.

The current version (v1.1) supports **all 10 classes** from the civic YOLO dataset and stores each in its **own database table**, with automatic worker dispatch and anti-fraud validation on citizen uploads.

### Key Capabilities

- **Camera & Citizen Detection**
	- YOLOv8-based detection for: Damaged roads, Potholes, Illegal parking, Broken signs, Fallen trees, Garbage/litter, Vandalism, Dead animals, Damaged concrete, Damaged wires.
	- Automatic detection via camera integration and manual citizen uploads.

- **Smart Validation & Anti-Fraud**
	- [backend/utils/issue_validator.py](backend/utils/issue_validator.py) inspects EXIF, GPS consistency, screenshot likelihood, and YOLO content.
	- Returns a trust score and decision: `approved`, `flagged`, or `rejected`.
	- Rejected uploads are not stored; approved ones continue into the workflow.

- **Per-Class Storage & Routing**
	- Each YOLO class maps to its own SQLAlchemy model in [backend/models.py](backend/models.py):
		- DamagedRoadReport (`damaged_roads`)
		- PotholeReport (`potholes`)
		- IllegalParkingReport (`illegal_parking`)
		- BrokenSignReport (`broken_signs`)
		- FallenTreeReport (`fallen_trees`)
		- GarbageReport (`garbage`)
		- VandalismReport (`vandalism`)
		- DeadAnimalReport (`dead_animals`)
		- DamagedConcreteReport (`damaged_concrete`)
		- DamagedWiresReport (`damaged_wires`)
	- All reports share the common BaseReport fields (location, images, status, worker assignment).

- **Deduplication & Worker Dispatch**
	- [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py):
		- Normalizes raw labels (e.g. "Vandalism Issues") into canonical types (e.g. `vandalism`).
		- Uses `_find_nearby_incident` to **deduplicate** within a small radius per class.
		- If a nearby open incident exists, the new report links to the existing ticket instead of creating a duplicate.
		- Otherwise, a new row is created in the correct table and passed to `assign_report_to_worker`.
	- [workflow/worker_workflow.py](workflow/worker_workflow.py):
		- Bootstraps a pool of 20 Bhopal workers.
		- Auto-selects the best worker based on distance, active tasks, and simple reliability score.
		- Assigns the report and updates `assigned_worker_id`, `status='assigned'`, and worker `active_tasks`.

- **Admin Dashboard & SLA View**
	- [backend/routes/admin_routes.py](backend/routes/admin_routes.py):
		- `/api/admin/reports` aggregates incidents from all report tables and returns a unified list.
		- `/api/admin/stats` returns counts per class plus a total.
	- [frontend_4/views/AdminView.tsx](frontend_4/views/AdminView.tsx):
		- Shows incident list, SLA-style age calculations, and verification queue.

## Tech Stack

- **Backend**: Flask, Flask-SQLAlchemy, Flask-CORS
- **Database**: SQLite (file: `database/civicresolve.db` created automatically)
- **AI/ML**: Ultralytics YOLOv8, PyTorch, OpenCV, Pillow
- **Frontend**: Next.js/React (TypeScript) in [frontend_4](frontend_4)

## Project Structure (High Level)

At the root of CivicResolvev1.1:

- [backend](backend) – Flask API, database models, routes, validators, and worker workflows.
- [ai_ml](ai_ml) – YOLO models, training scripts, and dataset preparation utilities.
- [workflow](workflow) – Python workflows that orchestrate detection, severity, worker assignment, and verification.
- [camera_integration](camera_integration) – Laptop/camera feed integration and real-time detection services.
- [frontend_4](frontend_4) – Next.js/React frontend for citizens, admins, and workers.
- [data](data) – Raw images, YOLO-formatted dataset, and archived config.
- [database](database) – Legacy PostgreSQL SQL scripts; SQLite DB file is created at `database/civicresolve.db`.
- [tests](tests) – Minimal test suite for backend and AI helpers.
- [docs](docs) – API and setup/deployment documentation.
- [logs](logs) – Training and runtime logs (if enabled).
- [runs](runs) and [ai_ml/runs](ai_ml/runs) – YOLO training runs and experiment artifacts.

## Project Tree (Condensed)

```text
.
├── README.md
├── requirements.txt
├── render-build.sh
├── render.yaml
├── run.sh
├── setup.sh
├── vercel.json
├── yolov8n.pt
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── models.py
│   ├── routes/
│   │   ├── citizen_routes.py
│   │   ├── admin_routes.py
│   │   ├── ai_routes.py
│   │   └── workflow/
│   │       ├── task_routes.py
│   │       ├── worker_routes.py
│   │       └── verification_routes.py
│   └── utils/
│       ├── issue_validator.py
│       └── severity_classifier.py
├── ai_ml/
│   ├── models/
│   │   ├── yolo_detector.py
│   │   ├── issue_classifier.py
│   │   └── severity_predictor.py
│   ├── training/
│   │   ├── data_preparation.py
│   │   └── train_yolo.py
│   └── utils/
├── workflow/
│   ├── issue_detection_workflow.py
│   ├── severity_workflow.py
│   ├── worker_workflow.py
│   └── verification_workflow.py
├── camera_integration/
│   ├── camera_feed.py
│   └── detection_service.py
├── laptop_integration/
│   ├── camera_simulator.py
│   ├── dev_setup.py
│   └── local_server.py
├── frontend_4/
│   ├── package.json
│   ├── tsconfig.json
│   ├── App.tsx
│   ├── app/
│   ├── views/
│   │   ├── LandingView.tsx
│   │   ├── CitizenView.tsx
│   │   ├── AdminView.tsx
│   │   └── WorkerView.tsx
│   └── components/
├── data/
│   ├── images/
│   ├── yolo_format/
│   └── archive/
├── database/
│   ├── civicresolve.db  (created at runtime)
│   ├── init.sql
│   └── sample_data.sql
├── tests/
│   ├── test_backend.py
│   ├── test_ai_models.py
│   └── ...
└── docs/
	├── API.md
	├── SETUP.md
	└── DEPLOYMENT.md
```

## Running the Backend Locally

### 1. Create/activate Python environment

You already have a venv under `tf/`. To reuse it:

- `cd CivicResolvev1.1`
- `source ../tf/bin/activate`

### 2. Install backend dependencies

From [CivicResolvev1.1](CivicResolvev1.1):

- `pip install -r requirements.txt`

### 3. Ensure YOLO model weights are available

- The citizen validator uses `ai_ml/models/best_civic_model.pt` (path referenced in citizen_routes).
- Place your trained civic YOLO weights at:
	- [ai_ml/models/best_civic_model.pt](ai_ml/models/best_civic_model.pt)

### 4. Run the Flask server

From [CivicResolvev1.1](CivicResolvev1.1):

- `python -m backend.app`

This will:

- Initialize SQLite at `database/civicresolve.db`.
- Create all report and worker tables via `db.create_all()`.
- Bootstrap the Bhopal worker pool.
- Expose APIs at `http://0.0.0.0:5000`.

Key routes:

- `/api/citizen/report` – citizen upload & validation.
- `/api/ai/predict` – raw YOLO detection helper.
- `/api/admin/reports` – aggregate incident list for the dashboard.
- `/api/admin/stats` – counts per class.

## Running the Frontend (Next.js)

The main UI is under [frontend_4](frontend_4).

### 1. Install Node dependencies

- `cd CivicResolvev1.1/frontend_4`
- `npm install`

### 2. Configure API URL (if needed)

- [frontend_4/lib/api.ts](frontend_4/lib/api.ts) points to the backend base URL.
- Ensure it matches where your Flask server is running (default `http://localhost:5000`).

### 3. Run the dev server

- `npm run dev`

Then open the URL printed by Next.js (typically `http://localhost:3000`).

Main views:

- [frontend_4/views/LandingView.tsx](frontend_4/views/LandingView.tsx) – public landing page with stats.
- [frontend_4/views/CitizenView.tsx](frontend_4/views/CitizenView.tsx) – citizen report submission UI.
- [frontend_4/views/AdminView.tsx](frontend_4/views/AdminView.tsx) – command center for admins.
- [frontend_4/views/WorkerView.tsx](frontend_4/views/WorkerView.tsx) – worker task list.

## How Citizen Reports Flow (Example: Vandalism)

1. Citizen uploads an image with `type="Vandalism Issues"`, plus `lat`, `lng`, `address`.
2. [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py):
	 - Saves a temp image.
	 - Runs YOLO via `get_validation_model()`; saves an **annotated** image.
	 - Calls `IssueValidator.validate_report` to compute trust score and decision.
3. If decision is `rejected`:
	 - Annotated image is deleted, and API returns HTTP 400 with `error` and `trust_score`.
4. If decision is `approved` or `flagged`:
	 - The type string is normalized; `"Vandalism Issues" → "vandalism"`.
	 - `_find_nearby_incident('vandalism', lat, lng)` checks for an open vandalism ticket nearby.
	 - If found, the report is **deduplicated** and linked to the existing ticket; API responds 200 with `duplicate_of`.
	 - If not found, a new `VandalismReport` row is created and passed to `assign_report_to_worker` for dispatch.
5. Admins see the result in `/api/admin/reports` and the AdminView dashboard.

## Evaluation & Sample Results

### YOLO Detection Example (Vandalism)

On a sample frame from the Bhopal Node camera, the `/api/ai/predict` + citizen flow produced logs similar to:

- `8 Vandalism Issuess` detected at 640x640.
- Example confidences: ~0.85, 0.84, 0.61, 0.47, 0.42, 0.33, 0.32, 0.26.
- Annotated image saved under [data/images](data/images) (e.g. `Vandalism_Issues_*.jpg`).

This confirms that the YOLO model consistently detects vandalism issues in the test scene.

### Validator Decision Example

For the same upload, [backend/utils/issue_validator.py](backend/utils/issue_validator.py) reported:

- `score: 85`, `decision: "approved"`, `message: "Report verified successfully."`.
- Checks summary:
	- `exif`: `status: "missing"` (no EXIF, small penalty).
	- `screenshot`: `status: "not_detected"`.
	- `content`: `status: "match"`, with detections `[{'class': 'Vandalism Issues', 'confidence': ...}, ...]` against claimed type `"Vandalism Issues"`.

Since the final score exceeded the approval threshold (80), the report was accepted and moved into the main workflow.

### Storage, Deduplication, and Dispatch Result

For the approved vandalism upload at `lat=23.2599`, `lng=77.4126`:

- `_normalize_issue_type("Vandalism Issues")` → `"vandalism"`.
- `_find_nearby_incident('vandalism', lat, lng)` checked for an open vandalism ticket in a small radius.
- If an existing incident was within range, logs contained:
	- `ℹ️ Deduplicated report: linking to existing vandalism #<id> at ~23.2599,77.4126`.
- If no duplicate existed, a new row was created in the `vandalism` table and passed to `assign_report_to_worker`, which:
	- Selected the nearest available worker from the Bhopal pool.
	- Set `status='assigned'` and incremented worker `active_tasks`.

These results demonstrate that vandalism issues are (a) detected by YOLO, (b) validated by the trust-scoring pipeline, and (c) either deduplicated onto an existing vandalism ticket or stored as a new `VandalismReport` with an assigned field worker.

## Repository Layout (CivicResolvev1.1)

- [backend](backend)
	- [app.py](backend/app.py) – Flask app factory and entrypoint.
	- [config.py](backend/config.py) – SQLite DB and upload folder configuration.
	- [models.py](backend/models.py) – all report tables, worker pool, verification logs, disputes.
	- [routes/citizen_routes.py](backend/routes/citizen_routes.py) – citizen upload, validation, deduplication, and report creation.
	- [routes/admin_routes.py](backend/routes/admin_routes.py) – admin reports and stats.
	- [routes/ai_routes.py](backend/routes/ai_routes.py) – direct YOLO inference endpoints.
	- [routes/workflow](backend/routes/workflow) – worker, task, and verification APIs.
	- [utils/issue_validator.py](backend/utils/issue_validator.py) – trust scoring and fraud checks.
	- [utils/severity_classifier.py](backend/utils/severity_classifier.py) – map YOLO detections to severity.

- [ai_ml](ai_ml)
	- [models/yolo_detector.py](ai_ml/models/yolo_detector.py) – detector wrapper.
	- [models/issue_classifier.py](ai_ml/models/issue_classifier.py) – high-level classification helpers.
	- [models/severity_predictor.py](ai_ml/models/severity_predictor.py) – severity model.
	- [training/data_preparation.py](ai_ml/training/data_preparation.py) – builds YOLO dataset.yaml from [data/archive/config.yaml](data/archive/config.yaml).
	- [training/train_yolo.py](ai_ml/training/train_yolo.py) – training entrypoint.
	- [runs](ai_ml/runs) – training logs and configs.

- [camera_integration](camera_integration)
	- [camera_feed.py](camera_integration/camera_feed.py) – webcam/camera integration.
	- [detection_service.py](camera_integration/detection_service.py) – real-time frame-level detection.

- [workflow](workflow)
	- [issue_detection_workflow.py](workflow/issue_detection_workflow.py) – camera-to-backend pipeline.
	- [severity_workflow.py](workflow/severity_workflow.py) – severity logic.
	- [worker_workflow.py](workflow/worker_workflow.py) – worker pool, `_haversine_km`, `assign_report_to_worker`.
	- [verification_workflow.py](workflow/verification_workflow.py) – completion verification flows.

- [frontend_4](frontend_4)
	- Next.js/React app (TypeScript) for citizen, admin, and worker views.
	- See [frontend_4/README.md](frontend_4/README.md) for basic AI Studio/Next.js run instructions.

- [database](database)
	- [init.sql](database/init.sql), [sample_data.sql](database/sample_data.sql) – legacy PostgreSQL scripts (current app uses SQLite by default).

- [tests](tests)
	- [test_backend.py](tests/test_backend.py) – helper tests for haversine, etc.
	- [test_ai_models.py](tests/test_ai_models.py) – smoke tests for AI components.

- [docs](docs)
	- [API.md](docs/API.md) – endpoint-level documentation (extend as you evolve APIs).
	- [SETUP.md](docs/SETUP.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md) – additional setup/deploy notes.

## Notes

- By default the system runs fully on your local machine (Flask + SQLite + YOLO weights in the repo).
- For production, you can switch the SQLAlchemy URI in [backend/config.py](backend/config.py) to PostgreSQL and reuse the existing schema ideas in [database/init.sql](database/init.sql).
- If you retrain YOLO with different classes, update:
	- [data/archive/config.yaml](data/archive/config.yaml) for the new names.
	- `_normalize_issue_type` and `ISSUE_MODEL_MAP` in [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py).