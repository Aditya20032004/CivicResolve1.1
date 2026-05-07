import shutil
import sys
from pathlib import Path

import torch
from ultralytics import YOLO

project_root = Path(__file__).resolve().parents[2]
sys.path.append(str(project_root))

from ai_ml.utils.logger import setup_logger


class CivicModelTrainerTwoStage:
    """Two-stage fine-tuning of YOLOv8m on CivicResolve dataset for better detection.

    Stage 1: Train mainly the detection head (freeze early backbone layers).
    Stage 2: Unfreeze the whole model and fine-tune at a lower learning rate.

    This is proper transfer learning on the detector itself, so mAP/boxes improve.
    """

    def __init__(self):
        self.logger = setup_logger("yolo_two_stage_trainer")
        self.root = project_root
        self.paths = {
            "dataset": self.root / "data" / "yolo_format" / "dataset.yaml",
            "models": self.root / "ai_ml" / "models",
            "runs": self.root / "ai_ml" / "runs",
        }
        self.paths["models"].mkdir(parents=True, exist_ok=True)
        self.device = "0" if torch.cuda.is_available() else "cpu"

    def train_two_stage(
        self,
        head_epochs: int = 10,
        finetune_epochs: int = 40,
        imgsz: int = 640,
        batch: int = 16,
        head_lr: float = 0.005,
        finetune_lr: float = 0.003,
        freeze_layers: int = 10,
    ):
        """Run two-stage fine-tuning and validate the resulting detector.

        Args:
            head_epochs: epochs for head-focused phase (frozen backbone)
            finetune_epochs: epochs for full fine-tune phase
            imgsz: training image size
            batch: batch size
            head_lr: LR for head-focused stage
            finetune_lr: LR for full fine-tune stage
            freeze_layers: number of low-level layers to freeze in stage 1
        """
        if not self.paths["dataset"].exists():
            self.logger.error(f"Dataset config missing: {self.paths['dataset']}")
            return

        self.logger.info(f"Device: {self.device}")
        self.logger.info(
            "Two-stage YOLO fine-tune: "
            f"head_epochs={head_epochs}, finetune_epochs={finetune_epochs}, "
            f"imgsz={imgsz}, batch={batch}, freeze_layers={freeze_layers}"
        )

        try:
            model = YOLO("yolov8m.pt")

            # --------------------
            # Stage 1: head-focused training (frozen backbone)
            # --------------------
            self.logger.info("\n" + "=" * 60)
            self.logger.info("STAGE 1: Head-focused training (frozen backbone)")
            self.logger.info("=" * 60)

            stage1_results = model.train(
                data=str(self.paths["dataset"]),
                epochs=head_epochs,
                imgsz=imgsz,
                batch=batch,
                device=self.device,
                project=str(self.paths["runs"]),
                name="civic_resolve_two_stage",
                exist_ok=True,
                verbose=True,
                lr0=head_lr,
                cos_lr=True,
                freeze=freeze_layers,
            )

            # Get best weights from Stage 1 and re-initialize a fresh model for Stage 2
            stage1_best = Path(stage1_results.save_dir) / "weights" / "best.pt"
            if not stage1_best.exists():
                self.logger.error(f"Stage 1 best weights not found at {stage1_best}")
                return

            stage2_model = YOLO(str(stage1_best))

            # --------------------
            # Stage 2: full-model fine-tune (unfreeze)
            # --------------------
            self.logger.info("\n" + "=" * 60)
            self.logger.info("🧠 STAGE 2: Full-model fine-tuning")
            self.logger.info("=" * 60)

            stage2_results = stage2_model.train(
                data=str(self.paths["dataset"]),
                epochs=finetune_epochs,
                imgsz=imgsz,
                batch=batch,
                device=self.device,
                project=str(self.paths["runs"]),
                name="civic_resolve_two_stage_stage2",
                exist_ok=True,
                verbose=True,
                lr0=finetune_lr,
                cos_lr=True,
                freeze=0,
            )

            results = stage2_results

            # Save best detector and run validation
            best_weight = Path(results.save_dir) / "weights" / "best.pt"
            target_path = self.paths["models"] / "best_civic_model_two_stage.pt"

            if best_weight.exists():
                shutil.copy(best_weight, target_path)
                self.logger.info(f"\n✅ Two-stage finetuned model saved: {target_path}")

                self.logger.info("\n" + "=" * 60)
                self.logger.info("🔍 VALIDATION (two-stage finetuned detector)")
                self.logger.info("=" * 60)

                best_model = YOLO(str(target_path))
                val_results = best_model.val(
                    data=str(self.paths["dataset"]),
                    imgsz=imgsz,
                    batch=batch,
                    device=self.device,
                )

                self.logger.info(f"Validation mAP50: {val_results.box.map50:.4f}")
                self.logger.info(f"Validation mAP50-95: {val_results.box.map:.4f}")
                self.logger.info(f"Validation Precision: {val_results.box.mp:.4f}")
                self.logger.info(f"Validation Recall: {val_results.box.mr:.4f}")

                if hasattr(val_results.box, "maps") and len(val_results.box.maps) > 0:
                    self.logger.info("\n📋 Per-Class mAP50-95 (two-stage):")
                    for idx, class_map in enumerate(val_results.box.maps):
                        class_name = (
                            val_results.names.get(idx, f"Class_{idx}")
                            if hasattr(val_results, "names")
                            else f"Class_{idx}"
                        )
                        self.logger.info(f"  {class_name}: {class_map:.4f}")

            else:
                self.logger.error(f"Best weights not found at {best_weight}")

        except Exception as e:
            self.logger.error(f"Two-stage YOLO training failed: {e}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Two-stage YOLOv8m fine-tuning for better detection on CivicResolve dataset",
    )
    parser.add_argument("--head-epochs", type=int, default=10, help="Epochs for head-focused stage")
    parser.add_argument(
        "--finetune-epochs", type=int, default=40, help="Epochs for full-model fine-tuning stage"
    )
    parser.add_argument("--imgsz", type=int, default=640, help="Image size for training")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    parser.add_argument("--head-lr", type=float, default=0.005, help="LR for head-focused stage")
    parser.add_argument("--finetune-lr", type=float, default=0.003, help="LR for fine-tune stage")
    parser.add_argument(
        "--freeze-layers", type=int, default=10, help="Number of low-level layers to freeze in Stage 1"
    )

    args = parser.parse_args()

    trainer = CivicModelTrainerTwoStage()
    trainer.train_two_stage(
        head_epochs=args.head_epochs,
        finetune_epochs=args.finetune_epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        head_lr=args.head_lr,
        finetune_lr=args.finetune_lr,
        freeze_layers=args.freeze_layers,
    )
