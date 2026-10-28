from pathlib import Path
import sys, json
import h5py, mujoco, numpy as np
from paths import ROOT
sys.path.insert(0, str(ROOT / 'src'))
model = mujoco.MjModel.from_xml_path(str(ROOT/'assets/mjcf/exoskeleton/jaw/jaw_exo_model_rigid_skin_sep_compiled_wo_flex.xml'))
data = mujoco.MjData(model)
mujoco.mj_forward(model,data)
print('MODEL', model.nq, model.nv, model.nu, model.nflex, model.opt.timestep)
print('ACTUATORS', [(model.actuator(i).name,int(model.actuator_dyntype[i]),int(model.actuator_trntype[i])) for i in range(model.nu)])
print('JOINTS', [(model.joint(i).name,int(model.jnt_type[i])) for i in range(model.njnt)])
with h5py.File(ROOT/'data/jaw/jaw_ref_sub_skip_y_hinge_18_deg_ik_best.h5') as f:
    f.visititems(lambda n,o: print(n, o.shape if isinstance(o,h5py.Dataset) else dict(o.attrs)))
from exoforge_control.tracking import ActuatorLengthReference
r = ActuatorLengthReference.load(ROOT/'data/jaw/jaw_ref_sub_skip_y_hinge_18_deg_ik_best.h5')
print('REF',r.times[0],r.times[-1],r.actuator_names, 'joint range',np.ptp(r.joint_positions,axis=0))
