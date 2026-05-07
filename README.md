# CivicResolve v1.1 - AI-Powered Civic Issue Management

## Overview

CivicResolve v1.1 is an end-to-end civic issue management system that detects, validates, routes, and tracks public infrastructure and cleanliness problems using computer vision, a Flask backend, and a Next.js frontend.

The platform is designed for two major intake paths:

- Camera-based detection for continuous monitoring.
- Citizen-submitted reports with validation, deduplication, and worker dispatch.

Version 1.1 supports all 10 civic issue classes from the YOLO dataset and stores each issue type in its own database table. This makes the system easier to query, route, and report on while keeping the workflow organized by category.

## Core Features

### 1. Multi-class civic issue detection

The system recognizes the following issue types:

- Damaged roads
- Potholes
- Illegal parking
- Broken signs
- Fallen trees
- Garbage and litter
- Vandalism
- Dead animals
- Damaged concrete
- Damaged wires

Detection is powered by YOLOv8 and is available through both backend inference endpoints and the camera integration workflow.

### 2. Citizen report validation and anti-fraud checks

Citizen uploads are not accepted blindly. The validator in [backend/utils/issue_validator.py](backend/utils/issue_validator.py) examines:

- EXIF metadata presence and consistency
- Location plausibility based on GPS and address fields
- Whether the image looks like a screenshot or manipulated upload
- Whether the YOLO detections match the claimed issue type

Each submission receives a trust score and a final decision:

- `approved`
- `flagged`
- `rejected`

Rejected reports stop immediately. Approved and flagged reports continue into the workflow.

### 3. Per-class storage model

Each civic issue type maps to its own SQLAlchemy model in [backend/models.py](backend/models.py). That means reports are not stored in a single generic table; instead, the application keeps separate records for each class while sharing a common base report structure.

This structure supports:

- Cleaner filtering and reporting
- Easier admin analytics
- Better routing by issue type
- Simpler future schema growth

### 4. Deduplication of nearby incidents

The citizen intake route in [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py) normalizes raw labels into canonical issue names and checks for nearby open incidents before creating a new record.

If a matching incident already exists within the configured radius, the new submission is linked to the existing report instead of creating a duplicate ticket.

### 5. Automated worker assignment

The workflow in [workflow/worker_workflow.py](workflow/worker_workflow.py) bootstraps a worker pool and assigns reports using simple dispatch logic based on:

- Geographic distance
- Current active task count
- A basic reliability score

When a worker is assigned, the report status is updated and the worker workload is incremented automatically.

### 6. Admin dashboard and SLA-style oversight

The admin routes in [backend/routes/admin_routes.py](backend/routes/admin_routes.py) aggregate report tables into one unified view and expose issue statistics by class.

The frontend admin view in [frontend_4/views/AdminView.tsx](frontend_4/views/AdminView.tsx) is designed as an operational dashboard for:

- Incident monitoring
- Age and SLA-style tracking
- Verification queue inspection
- Class-wise distribution review

### 7. Frontend views for multiple roles

The Next.js app in [frontend_4](frontend_4) includes distinct interfaces for:

- Citizens submitting reports
- Admins reviewing and managing incidents
- Workers handling assigned tasks

## How It Works

### Citizen report flow

1. A citizen submits an image with issue type, latitude, longitude, and address.
2. [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py) stores a temporary image and runs YOLO validation.
3. The validator generates a trust score and decision.
4. If the decision is `rejected`, the API returns an error and the image is discarded.
5. If the decision is `approved` or `flagged`, the issue type is normalized and checked against nearby open incidents.
6. If a duplicate exists, the submission is linked to the existing ticket.
7. If no duplicate exists, a new issue record is created and passed to worker assignment.

### Camera detection flow

1. A camera source or simulator feeds frames into the system.
2. [camera_integration/detection_service.py](camera_integration/detection_service.py) and the workflow layer process detections.
3. Valid detections are routed into the same operational pipeline used for citizen reports.
4. Admins and workers can then act on the resulting incidents.

## Tech Stack

- Backend: Flask, Flask-SQLAlchemy, Flask-CORS
- Database: SQLite by default, with schema ideas that can be adapted for PostgreSQL
- AI and ML: Ultralytics YOLOv8, PyTorch, OpenCV, Pillow
- Frontend: Next.js, React, TypeScript
- Supporting workflow layer: Python orchestration scripts for assignment, verification, and detection

## Repository Structure

The main folders in CivicResolve v1.1 are:

- [backend](backend) - Flask API, models, routes, validators, and app bootstrap.
- [ai_ml](ai_ml) - YOLO models, training helpers, and dataset preparation utilities.
- [workflow](workflow) - Detection, severity, worker assignment, and verification orchestration.
- [camera_integration](camera_integration) - Live camera and frame-processing helpers.
- [laptop_integration](laptop_integration) - Local simulator and development support scripts.
- [frontend_4](frontend_4) - Next.js frontend for citizens, admins, and workers.
- [data](data) - Images, YOLO-format assets, and archived dataset materials.
- [database](database) - SQL scripts and runtime database artifacts.
- [docs](docs) - API, setup, and deployment documentation.
- [tests](tests) - Smoke tests and helper tests.
- [logs](logs) - Runtime or training logs when enabled.
- [runs](runs) and [ai_ml/runs](ai_ml/runs) - YOLO experiments and output artifacts.

## Condensed Project Tree

```text
.
├── README.md
├── requirements.txt
├── run.sh
├── setup.sh
├── render-build.sh
├── render.yaml
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
│   ├── App.tsx
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── views/
│   │   ├── LandingView.tsx
│   │   ├── CitizenView.tsx
│   │   ├── AdminView.tsx
│   │   └── WorkerView.tsx
│   └── package.json
├── data/
│   ├── images/
│   ├── yolo_format/
│   └── archive/
├── database/
│   ├── init.sql
│   └── sample_data.sql
├── tests/
└── docs/
```

## Setup and Run

### Backend

1. Activate your Python environment.
2. Install dependencies with `pip install -r requirements.txt` from the project root.
3. Make sure the trained civic YOLO weights are available at [ai_ml/models/best_civic_model.pt](ai_ml/models/best_civic_model.pt).
4. Start the backend with `python -m backend.app`.

When the backend starts, it:

- Initializes SQLite at `database/civicresolve.db`
- Creates the required tables
- Boots the worker pool
- Exposes APIs on port 5000

### Frontend

1. Move into [frontend_4](frontend_4).
2. Install dependencies with `npm install`.
3. Confirm the API base URL in [frontend_4/lib/api.ts](frontend_4/lib/api.ts) matches your backend.
4. Start the development server with `npm run dev`.

The active Next.js entrypoint is [frontend_4/app/page.tsx](frontend_4/app/page.tsx), which switches between landing, login, citizen, admin, worker, and camera views. Session state is persisted in browser local storage.

## Main API Endpoints

- `/api/citizen/report` - citizen image upload, validation, and dispatch
- `/api/ai/predict` - raw YOLO inference helper
- `/api/admin/reports` - unified incident feed for the dashboard
- `/api/admin/stats` - class-wise counts and totals
- `/api/admin/workers` - worker list and worker administration
- `/api/workflow/tasks/assign` - task assignment endpoint
- `/api/workflow/worker/my-tasks/<workerId>` - worker task list
- `/api/workflow/worker/profile/<workerId>` - worker profile data
- `/api/workflow/worker/complete` - task completion reporting
- `/api/workflow/verify/verify` - verification action
- `/api/workflow/verify/logs` - verification logs
- `/api/workflow/verify/disputes` - dispute records
- `/api/workflow/verify/camera-sweep` - camera sweep verification

## File Guide

### Backend

- [backend/app.py](backend/app.py) - application startup and route registration.
- [backend/config.py](backend/config.py) - database and upload configuration.
- [backend/models.py](backend/models.py) - report tables, worker state, verification data, and disputes.
- [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py) - citizen intake, validation, deduplication, and persistence.
- [backend/routes/admin_routes.py](backend/routes/admin_routes.py) - administrative views and stats.
- [backend/routes/ai_routes.py](backend/routes/ai_routes.py) - direct inference endpoints.
- [backend/utils/issue_validator.py](backend/utils/issue_validator.py) - trust scoring and fraud checks.
- [backend/utils/severity_classifier.py](backend/utils/severity_classifier.py) - severity mapping from detections.

### AI and ML

- [ai_ml/models/yolo_detector.py](ai_ml/models/yolo_detector.py) - detector wrapper.
- [ai_ml/models/issue_classifier.py](ai_ml/models/issue_classifier.py) - higher-level classification helpers.
- [ai_ml/models/severity_predictor.py](ai_ml/models/severity_predictor.py) - severity-related prediction utilities.
- [ai_ml/training/data_preparation.py](ai_ml/training/data_preparation.py) - prepares YOLO dataset configuration.
- [ai_ml/training/train_yolo.py](ai_ml/training/train_yolo.py) - training entry point.

### Workflow

- [workflow/issue_detection_workflow.py](workflow/issue_detection_workflow.py) - routes detections into the backend workflow.
- [workflow/severity_workflow.py](workflow/severity_workflow.py) - severity handling and escalation logic.
- [workflow/worker_workflow.py](workflow/worker_workflow.py) - worker pool management and assignment.
- [workflow/verification_workflow.py](workflow/verification_workflow.py) - completion verification flow.

### Frontend

- [frontend_4/views/LandingView.tsx](frontend_4/views/LandingView.tsx) - landing page and summary stats.
- [frontend_4/views/CitizenView.tsx](frontend_4/views/CitizenView.tsx) - citizen submission UI.
- [frontend_4/views/AdminView.tsx](frontend_4/views/AdminView.tsx) - admin command center.
- [frontend_4/views/WorkerView.tsx](frontend_4/views/WorkerView.tsx) - worker task dashboard.

## Sample Report Flow: Vandalism

1. A citizen submits an image with type set to vandalism issues along with location details.
2. The backend validates the image and produces an annotated detection result.
3. The trust score determines whether the report is approved, flagged, or rejected.
4. If approved, the type is normalized to vandalism.
5. The system checks for a nearby open vandalism report to avoid duplication.
6. If a duplicate exists, the report is linked to the existing ticket.
7. If not, a new vandalism record is created and assigned to a worker.
8. The incident becomes visible in the admin dashboard and workflow views.

## Future Scope

The current system is functional, but there are several strong directions for future expansion:

- Add a richer mobile-first citizen experience with push notifications and report tracking.
- Introduce real-time map visualization for open incidents, hotspots, and worker movement.
- Replace the basic worker assignment heuristic with a smarter optimization model.
- Expand the verification workflow with photo evidence comparison and completion confidence scoring.
- Support multi-city deployment with configurable zones, wards, and jurisdiction-based routing.
- Add role-based authentication and audit logs for citizens, workers, supervisors, and admins.
- Extend analytics with trend forecasting, class-wise SLA breaches, and seasonal issue patterns.
- Support multilingual reporting to improve accessibility for citizens.
- Add stronger offline capture and delayed sync support for field devices.
- Make the inference pipeline easier to swap between local models, cloud models, and edge devices.

## Notes

- The system runs locally by default with Flask, SQLite, and the YOLO weights included in the project workflow.
- If you migrate to PostgreSQL, the schema ideas in [database/init.sql](database/init.sql) can help as a starting point.
- If you retrain the model with different class names, update [data/archive/config.yaml](data/archive/config.yaml) and the issue normalization logic in [backend/routes/citizen_routes.py](backend/routes/citizen_routes.py).