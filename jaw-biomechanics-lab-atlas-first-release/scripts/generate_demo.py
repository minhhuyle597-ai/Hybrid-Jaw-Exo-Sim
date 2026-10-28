"""Official rigid jaw + official muscle reference/PID; one state per video frame.
Sources: https://mujoco.readthedocs.io/en/3.4.0/APIreference/APItypes.html
https://github.com/paulotto/hybrid-jaw-exo-sim/tree/v0.1.0
"""
from pathlib import Path
import sys, json, hashlib, csv, argparse, time
import numpy as np
import mujoco
import imageio.v2 as imageio
from paths import ROOT, MODEL, REFERENCE, MODEL_REL, REFERENCE_REL
PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'src'))
from exoforge_control.tracking import ActuatorLengthReference, ActuatorLengthTracker, TrackerConfig, PIDConfig
MODEL = ROOT/'assets/mjcf/exoskeleton/jaw/jaw_exo_model_rigid_skin_sep_compiled_wo_flex.xml'
REFERENCE = ROOT/'data/jaw/jaw_ref_sub_skip_y_hinge_18_deg_ik_best.h5'
FPS = 25
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dense_moment(m,d):
    result=np.zeros((m.nu,m.nv))
    for i in range(m.nu):
        adr=int(d.moment_rowadr[i]); n=int(d.moment_rownnz[i])
        result[i,d.moment_colind[adr:adr+n]]=d.actuator_moment[adr:adr+n]
    return result
def main():

    out=PROJECT/'public'/'data'; out.mkdir(parents=True,exist_ok=True)
    if (out/'states.npz').exists(): raise FileExistsError('Archive existing simulation outputs before regenerating.')
    m=mujoco.MjModel.from_xml_path(str(MODEL)); d=mujoco.MjData(m)
    # Zero input alone leaves affine motor bias forces. Disable all four exo outputs.
    m.actuator_gainprm[24:]=0; m.actuator_biasprm[24:]=0
    ref=ActuatorLengthReference.load(REFERENCE)
    ids=np.flatnonzero(m.actuator_dyntype == mujoco.mjtDyn.mjDYN_MUSCLE)
    assert len(ids)==24 and list(ids)==list(ref.actuator_ids)
    assert [m.actuator(int(i)).name.lstrip('_') for i in ids]==ref.actuator_names
    assert np.allclose(m.actuator_gear[ids,0],1) and np.all(m.actuator_trntype[ids]==mujoco.mjtTrn.mjTRN_TENDON)
    d.qpos[:]=ref.joint_positions[0]; mujoco.mj_forward(m,d)
    # Check reference lengths against FK, including samples across the full motion.
    err=[]
    for k in np.linspace(0,len(ref.times)-1,30,dtype=int):
        d.qpos[:]=ref.joint_positions[k]; mujoco.mj_forward(m,d)
        err.append(float(np.max(np.abs(d.actuator_length[ids]-ref.lengths[k]))))
    assert max(err)<1e-6, f'Reference/model length mismatch: {max(err)}'
    d.qpos[:]=ref.joint_positions[0]; mujoco.mj_forward(m,d)
    config=TrackerConfig(pid_config=PIDConfig(kp=200,ki=50,kd=20,derivative_filter_tau=.01,output_limits=(0,1),invert_error=True),record_history=False)
    tracker=ActuatorLengthTracker.from_reference(m,d,ref,config=config)
    sid=m.site('_incisal_point').id
    states=[]; frames=[]; max_sum_error=0
    nframes=int(ref.times[-1]*FPS)+1
    print(f'Generating {nframes} frames; model/reference FK error {max(err):.3g} m',flush=True)
    for k in range(nframes):
        # Control is computed once per physics step; mj_forward at capture never updates PID.
        while d.time < k/FPS-1e-9:
            d.ctrl[ids]=tracker.step_manual().control; mujoco.mj_step(m,d)
        mujoco.mj_forward(m,d)
        moment=dense_moment(m,d); generalized=d.actuator_force[:,None]*moment
        max_sum_error=max(max_sum_error,float(np.max(np.abs(generalized.sum(axis=0)-d.qfrc_actuator))))
        assert np.all(np.isfinite(d.qpos)) and np.all(np.isfinite(generalized))
        assert np.max(np.abs(d.ctrl[24:]))==0 and np.max(np.abs(d.actuator_force[24:]))==0
        states.append({name:getattr(d,name).copy() for name in ['qpos','qvel','act','ctrl']})
        frames.append({'time_s':round(k/FPS,6),'simulation_time_s':float(d.time),'excitation':d.ctrl[ids].tolist(),'activation':d.act[:24].tolist(),'length_mm':(d.actuator_length[ids]*1000).tolist(),'signed_force_N':d.actuator_force[ids].tolist(),'moment_arm':moment[ids].tolist(),'generalized_force':generalized[ids].tolist(),'qpos':d.qpos.tolist(),'incisal_mm':(d.site_xpos[sid]*1000).tolist(),'target_length_mm':(tracker.get_target_at_time(d.time)*1000).tolist()})
    assert max_sum_error<1e-8
    print('SIM DONE', 'qpos ROM',np.ptp([f['qpos'] for f in frames],axis=0),'force max',np.max(np.abs([f['signed_force_N'] for f in frames])),flush=True)
    muscles=[{'id':int(i),'name':m.actuator(int(i)).name.lstrip('_'),'tendon':m.tendon(int(m.actuator_trnid[i,0])).name} for i in ids]
    dofs=[{'name':m.joint(i).name,'type':'rotation' if m.jnt_type[i]==3 else 'translation','unit':'N·m' if m.jnt_type[i]==3 else 'N'} for i in range(m.njnt)]
    meta={'schema_version':1,'fps':FPS,'duration_s':len(frames)/FPS,'muscles':muscles,'dofs':dofs,'model':MODEL_REL,'reference':REFERENCE_REL,'upstream':'https://github.com/paulotto/hybrid-jaw-exo-sim/tree/v0.1.0','release_commit':'f4d76c75be22c40eb0d1abdd1bde6a2c443df198','mujoco':mujoco.__version__,'model_sha256':sha(MODEL),'reference_sha256':sha(REFERENCE),'dt_s':m.opt.timestep,'pid':{'kp':200,'ki':50,'kd':20,'derivative_filter_tau':.01,'invert_error':True},'reference_fk_max_error_m':max(err),'force_sum_max_error':max_sum_error,'notes':['官方 wo_flex 刚体模型，24 肌肉 PID 跟踪；4 个外骨骼执行器输入及输出均为零。','不含柔性面罩，不是完整 BioRob 软体实验复现。','肌腱路径长度并非单独肌纤维长；执行器力保留 MuJoCo 符号。','旋转自由度显示 N·m，平移自由度显示 N；未计算牙齿咬合力或关节反作用力。']}
    (out/'frames.json').write_text(json.dumps({'meta':meta,'frames':frames},ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    np.savez_compressed(out/'states.npz',time_s=np.arange(len(states))/FPS,**{name:np.array([s[name] for s in states]) for name in states[0]})
    with (out/'muscles.csv').open('w',newline='',encoding='utf-8-sig') as file:
        w=csv.writer(file); w.writerow(['time_s','muscle','excitation','activation','path_length_mm','signed_force_N']+[j['name']+'_'+j['unit'] for j in dofs])
        for f in frames:
            for i,mu in enumerate(muscles): w.writerow([f['time_s'],mu['name'],f['excitation'][i],f['activation'][i],f['length_mm'][i],f['signed_force_N'][i],*f['generalized_force'][i]])
    (out/'provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    print('COMPLETE simulation data. Run scripts/render_views.py next.',flush=True)
if __name__=='__main__': main()
