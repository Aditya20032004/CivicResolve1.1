import os
import cv2
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from ultralytics import YOLO
from backend.utils.severity_classifier import classify_issue_from_results

ai_bp = Blueprint('ai', __name__)

# --- LAZY MODEL LOADING (reduce startup memory) ---
BASE_DIR = Path(__file__).resolve().parents[2] # Points to CivicResolve/
MODEL_PATH = BASE_DIR / "ai_ml" / "models" / "best_civic_model.pt"

_model = None

def get_model():
    """Lazy load model only when first needed"""
    global _model
    if _model is None:
        print(f"🔍 Loading model from: {MODEL_PATH}")
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
        _model = YOLO(str(MODEL_PATH))
        print("✅ AI Model Loaded Successfully")
    return _model

@ai_bp.route('/predict', methods=['POST'])
def predict():
    print("⚡ Incoming Prediction Request...") # Debug Print

    try:
        model = get_model()
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return jsonify({'error': 'AI Model not ready'}), 503
    
    if not model:
        print("⚠️ Prediction failed: Model not loaded.")
        return jsonify({'error': 'AI Model not ready'}), 503
        
    if 'image' not in request.files:
        print("⚠️ Prediction failed: No image in request.")
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # 1. Verify Upload Folder Exists
        upload_folder = current_app.config['UPLOAD_FOLDER']
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            print(f"📂 Created missing upload folder: {upload_folder}")

        # 2. Save Temp File
        filename = secure_filename(f"temp_pred_{file.filename}")
        temp_path = os.path.join(upload_folder, filename)
        file.save(temp_path)
        print(f"💾 Saved temp image to: {temp_path}")

        # 3. Run Inference
        print("🧠 Running YOLO Inference...")
        results = model(temp_path, conf=0.25)
        
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                name = model.names[cls_id]
                
                print(f"   ➤ Found: {name} ({conf:.2f})") # Debug Print
                
                detections.append({
                    'class': name,
                    'confidence': conf,
                    'box': box.xyxy[0].tolist()
                })

        # Auto class + severity estimation for camera-side use
        classification = classify_issue_from_results(results, model)
        
        # 4. Save annotated image with bounding boxes
        annotated_filename = None
        if detections:
            annotated_img = results[0].plot()  # Get image with boxes drawn
            annotated_filename = secure_filename(f"detected_{file.filename}")
            annotated_path = os.path.join(upload_folder, annotated_filename)
            cv2.imwrite(annotated_path, annotated_img)
            print(f"📦 Saved annotated image: {annotated_filename}")
        
        # 5. Cleanup temp file
        os.remove(temp_path)
        
        print(f"✅ Success! Returning {len(detections)} detections.")
        return jsonify({
            'detections': detections,
            'count': len(detections),
            'predictions': detections,
            'annotated_image': annotated_filename,
            'issue_class': classification.get('issue_class'),
            'severity': classification.get('severity'),
            'severity_stats': classification.get('stats'),
        }), 200

    except Exception as e:
        # THIS IS THE IMPORTANT PART: Print the specific error to terminal
        print(f"❌ PREDICTION CRASHED: {str(e)}")
        import traceback
        traceback.print_exc() # Print full error trace
        return jsonify({'error': str(e)}), 500