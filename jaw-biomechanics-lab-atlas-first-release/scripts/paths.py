"""Resolve the separately installed, unmodified upstream release."""
from pathlib import Path
import os

ROOT = Path(os.environ.get('HYBRID_JAW_EXO_SIM_ROOT', str(
    Path.home() / 'Documents/Codex/tools/hybrid-jaw-exo-release/hybrid-jaw-exo-sim-0.1.0'
))).resolve()
MODEL_REL = 'assets/mjcf/exoskeleton/jaw/jaw_exo_model_rigid_skin_sep_compiled_wo_flex.xml'
REFERENCE_REL = 'data/jaw/jaw_ref_sub_skip_y_hinge_18_deg_ik_best.h5'
MODEL = ROOT / MODEL_REL
REFERENCE = ROOT / REFERENCE_REL
