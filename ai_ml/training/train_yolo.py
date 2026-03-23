import shutil
import sys
import torch
from pathlib import Path
from ultralytics import YOLO
import matplotlib.pyplot as plt
import pandas as pd
import cv2
import numpy as np


project_root = Path(__file__).resolve().parents[2]
sys.path.append(str(project_root))

from ai_ml.utils.logger import setup_logger

class CivicModelTrainer:
    def __init__(self):
        self.logger = setup_logger("model_trainer")
        self.root = project_root
        
        self.paths = {
            'dataset': self.root / "data" / "yolo_format" / "dataset.yaml",
            'models': self.root / "ai_ml" / "models",
            'runs': self.root / "ai_ml" / "runs"
        }
        
        self.paths['models'].mkdir(parents=True, exist_ok=True)
        self.paths['visualizations'] = self.root / "ai_ml" / "runs" / "visualizations"
        self.paths['visualizations'].mkdir(parents=True, exist_ok=True)
        self.device = '0' if torch.cuda.is_available() else 'cpu'

    def train(self, epochs=50, imgsz=640, batch=8):
        if not self.paths['dataset'].exists():
            self.logger.error(f"Dataset config missing: {self.paths['dataset']}")
            return

        self.logger.info(f"Starting Training on {self.device}...")
        self.logger.info(f"Image size: {imgsz}, Batch size: {batch}")
        
        try:
            model = YOLO('yolov8m.pt') 
            
            # Train
            results = model.train(
                data=str(self.paths['dataset']),
                epochs=epochs,
                imgsz=imgsz,
                batch=batch,
                device=self.device,
                project=str(self.paths['runs']),
                name='civic_resolve',
                exist_ok=True,
                verbose=True,
                lr0=0.005,
                cos_lr=True,
            )
            
            # Extract and log training metrics
            self.logger.info("\n" + "="*60)
            self.logger.info("📊 TRAINING RESULTS & METRICS")
            self.logger.info("="*60)
            
            # Get metrics from results
            metrics = results.results_dict if hasattr(results, 'results_dict') else {}
            
            if metrics:
                self.logger.info(f"mAP50: {metrics.get('metrics/mAP50(B)', 'N/A'):.4f}" if isinstance(metrics.get('metrics/mAP50(B)'), (int, float)) else "mAP50: N/A")
                self.logger.info(f"mAP50-95: {metrics.get('metrics/mAP50-95(B)', 'N/A'):.4f}" if isinstance(metrics.get('metrics/mAP50-95(B)'), (int, float)) else "mAP50-95: N/A")
                self.logger.info(f"Precision: {metrics.get('metrics/precision(B)', 'N/A'):.4f}" if isinstance(metrics.get('metrics/precision(B)'), (int, float)) else "Precision: N/A")
                self.logger.info(f"Recall: {metrics.get('metrics/recall(B)', 'N/A'):.4f}" if isinstance(metrics.get('metrics/recall(B)'), (int, float)) else "Recall: N/A")
            
            # Save final best model to main models dir
            best_weight = Path(results.save_dir) / "weights" / "best.pt"
            target_path = self.paths['models'] / "best_civic_model.pt"
            
            if best_weight.exists():
                shutil.copy(best_weight, target_path)
                self.logger.info(f"\n✅ Model saved: {target_path}")
                
                # Load best model and validate
                self.logger.info("\n" + "="*60)
                self.logger.info("🔍 VALIDATION ANALYSIS")
                self.logger.info("="*60)
                
                best_model = YOLO(str(target_path))
                val_results = best_model.val(
                    data=str(self.paths['dataset']),
                    imgsz=imgsz,
                    batch=batch,
                    device=self.device
                )
                
                # Display validation metrics
                self.logger.info(f"Validation mAP50: {val_results.box.map50:.4f}")
                self.logger.info(f"Validation mAP50-95: {val_results.box.map:.4f}")
                self.logger.info(f"Validation Precision: {val_results.box.mp:.4f}")
                self.logger.info(f"Validation Recall: {val_results.box.mr:.4f}")
                
                # Per-class metrics if available
                if hasattr(val_results.box, 'maps') and len(val_results.box.maps) > 0:
                    self.logger.info("\n📋 Per-Class mAP50-95:")
                    for idx, class_map in enumerate(val_results.box.maps):
                        class_name = val_results.names.get(idx, f"Class_{idx}") if hasattr(val_results, 'names') else f"Class_{idx}"
                        self.logger.info(f"  {class_name}: {class_map:.4f}")
                
                self.logger.info("\n" + "="*60)
                
                # Generate visualizations
                self.create_visualizations(results, val_results, target_path)
            
        except Exception as e:
            self.logger.error(f"Training failed: {e}")
    
    def create_visualizations(self, train_results, val_results, model_path):
        """Generate and save training/validation visualizations"""
        self.logger.info("\n" + "="*60)
        self.logger.info("📈 GENERATING VISUALIZATIONS")
        self.logger.info("="*60)
        
        try:
            viz_dir = self.paths['visualizations']
            
            # 1. Training curves from results.csv
            results_csv = Path(train_results.save_dir) / "results.csv"
            if results_csv.exists():
                df = pd.read_csv(results_csv)
                df.columns = df.columns.str.strip()
                
                fig, axes = plt.subplots(2, 2, figsize=(15, 10))
                fig.suptitle('Training Metrics Over Epochs', fontsize=16, fontweight='bold')
                
                # Plot losses
                if 'train/box_loss' in df.columns:
                    axes[0, 0].plot(df['epoch'], df['train/box_loss'], label='Box Loss', marker='o')
                    axes[0, 0].plot(df['epoch'], df['train/cls_loss'], label='Class Loss', marker='s')
                    axes[0, 0].plot(df['epoch'], df['train/dfl_loss'], label='DFL Loss', marker='^')
                    axes[0, 0].set_xlabel('Epoch')
                    axes[0, 0].set_ylabel('Loss')
                    axes[0, 0].set_title('Training Losses')
                    axes[0, 0].legend()
                    axes[0, 0].grid(True, alpha=0.3)
                
                # Plot mAP
                if 'metrics/mAP50(B)' in df.columns:
                    axes[0, 1].plot(df['epoch'], df['metrics/mAP50(B)'], label='mAP@0.5', marker='o', color='green')
                    axes[0, 1].plot(df['epoch'], df['metrics/mAP50-95(B)'], label='mAP@0.5:0.95', marker='s', color='blue')
                    axes[0, 1].set_xlabel('Epoch')
                    axes[0, 1].set_ylabel('mAP')
                    axes[0, 1].set_title('Mean Average Precision')
                    axes[0, 1].legend()
                    axes[0, 1].grid(True, alpha=0.3)
                
                # Plot Precision & Recall
                if 'metrics/precision(B)' in df.columns:
                    axes[1, 0].plot(df['epoch'], df['metrics/precision(B)'], label='Precision', marker='o', color='purple')
                    axes[1, 0].plot(df['epoch'], df['metrics/recall(B)'], label='Recall', marker='s', color='orange')
                    axes[1, 0].set_xlabel('Epoch')
                    axes[1, 0].set_ylabel('Score')
                    axes[1, 0].set_title('Precision & Recall')
                    axes[1, 0].legend()
                    axes[1, 0].grid(True, alpha=0.3)
                
                # Summary metrics table
                axes[1, 1].axis('off')
                final_metrics = [
                    ['Metric', 'Value'],
                    ['Final mAP50', f"{df['metrics/mAP50(B)'].iloc[-1]:.4f}"],
                    ['Final mAP50-95', f"{df['metrics/mAP50-95(B)'].iloc[-1]:.4f}"],
                    ['Final Precision', f"{df['metrics/precision(B)'].iloc[-1]:.4f}"],
                    ['Final Recall', f"{df['metrics/recall(B)'].iloc[-1]:.4f}"],
                    ['Best Epoch', f"{df['metrics/mAP50-95(B)'].idxmax() + 1}"]
                ]
                table = axes[1, 1].table(cellText=final_metrics, cellLoc='left', loc='center',
                                        colWidths=[0.5, 0.3])
                table.auto_set_font_size(False)
                table.set_fontsize(10)
                table.scale(1, 2)
                
                # Style header row
                for i in range(2):
                    table[(0, i)].set_facecolor('#4CAF50')
                    table[(0, i)].set_text_props(weight='bold', color='white')
                
                plt.tight_layout()
                curves_path = viz_dir / "training_curves.png"
                plt.savefig(curves_path, dpi=300, bbox_inches='tight')
                plt.close()
                self.logger.info(f"✅ Training curves saved: {curves_path}")
            
            # 2. Copy confusion matrix if it exists
            confusion_matrix = Path(train_results.save_dir) / "confusion_matrix.png"
            if confusion_matrix.exists():
                cm_target = viz_dir / "confusion_matrix.png"
                shutil.copy(confusion_matrix, cm_target)
                self.logger.info(f"✅ Confusion matrix saved: {cm_target}")
            
            # 3. Copy PR curve
            pr_curve = Path(train_results.save_dir) / "PR_curve.png"
            if pr_curve.exists():
                pr_target = viz_dir / "PR_curve.png"
                shutil.copy(pr_curve, pr_target)
                self.logger.info(f"✅ PR curve saved: {pr_target}")
            
            # 4. Copy F1 curve
            f1_curve = Path(train_results.save_dir) / "F1_curve.png"
            if f1_curve.exists():
                f1_target = viz_dir / "F1_curve.png"
                shutil.copy(f1_curve, f1_target)
                self.logger.info(f"✅ F1 curve saved: {f1_target}")
            
            # 5. Run inference on validation samples and visualize
            self.visualize_predictions(model_path, viz_dir)
            
            self.logger.info(f"\n📁 All visualizations saved in: {viz_dir}")
            self.logger.info("="*60)
            
        except Exception as e:
            self.logger.warning(f"Visualization generation failed: {e}")
    
    def visualize_predictions(self, model_path, viz_dir, num_samples=6):
        """Run inference on validation images and save visualizations"""
        try:
            val_images_dir = self.root / "data" / "yolo_format" / "images" / "val"
            if not val_images_dir.exists():
                return
            
            # Get sample images
            image_files = list(val_images_dir.glob("*.jpg")) + list(val_images_dir.glob("*.png"))
            if not image_files:
                return
            
            sample_images = image_files[:min(num_samples, len(image_files))]
            model = YOLO(str(model_path))
            
            fig, axes = plt.subplots(2, 3, figsize=(18, 12))
            fig.suptitle('Validation Predictions Sample', fontsize=16, fontweight='bold')
            axes = axes.flatten()
            
            for idx, img_path in enumerate(sample_images):
                if idx >= 6:
                    break
                    
                # Run prediction
                results = model.predict(str(img_path), conf=0.25, verbose=False)
                
                # Get annotated image
                annotated = results[0].plot()
                annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
                
                axes[idx].imshow(annotated_rgb)
                axes[idx].axis('off')
                axes[idx].set_title(f"{img_path.name}\nDetections: {len(results[0].boxes)}", fontsize=10)
            
            # Hide unused subplots
            for idx in range(len(sample_images), 6):
                axes[idx].axis('off')
            
            plt.tight_layout()
            pred_path = viz_dir / "validation_predictions.png"
            plt.savefig(pred_path, dpi=300, bbox_inches='tight')
            plt.close()
            self.logger.info(f"✅ Validation predictions saved: {pred_path}")
            
        except Exception as e:
            self.logger.warning(f"Could not generate prediction visualizations: {e}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--imgsz", type=int, default=640, help="Image size for training")
    parser.add_argument("--batch", type=int, default=4, help="Batch size")
    args = parser.parse_args()

    trainer = CivicModelTrainer()
    trainer.train(epochs=args.epochs, imgsz=args.imgsz, batch=args.batch)