from pathlib import Path
import json, hashlib, sys
import numpy as np
import imageio.v2 as imageio
import mujoco
from generate_demo import ROOT, MODEL, dense_moment
P=Path(__file__).resolve().parents[1]; out=P/'public/data'
d=json.loads((out/'frames.json').read_text(encoding='utf-8')); meta=d['meta']; frames=d['frames']; s=np.load(out/'states.npz')
assert len(frames)==len(s['qpos'])==536
assert len(meta['muscles'])==24
assert np.allclose([f['time_s'] for f in frames],np.arange(536)/25)
manifest=json.loads((out/'views.json').read_text(encoding='utf-8'))
assert len(manifest['views'])==5 and len({m['color'] for m in manifest['muscles']})==24
for view in manifest['views']:
    path=P/'public'/view['video'];reader=imageio.get_reader(path);video=reader.get_meta_data()
    assert reader.count_frames()==536
    reader.close();video['nframes']=536
    assert video['fps']==25 and abs(video['duration']-536/25)<.001
    assert hashlib.sha256(path.read_bytes()).hexdigest()==view['sha256']
    paths=json.loads((P/'public'/view['paths']).read_text())
    assert len(paths)==536 and all(len(f)==24 for f in paths)
    arr=np.array(paths)
    assert np.isfinite(arr).all() and (arr[...,0]>=0).all() and (arr[...,0]<=1280).all() and (arr[...,1]>=0).all() and (arr[...,1]<=720).all()
assert manifest['views'][0]['azimuth']==180 and manifest['views'][1]['azimuth']==0
assert '_left' in manifest['muscles'][12]['name']

m=mujoco.MjModel.from_xml_path(str(MODEL)); m.actuator_gainprm[24:]=0;m.actuator_biasprm[24:]=0
state=mujoco.MjData(m); errors=[]
for k in [0,1,25,150,300,400,535]:
    for key in ['qpos','qvel','act','ctrl']:getattr(state,key)[:]=s[key][k]
    state.time=k/25; mujoco.mj_forward(m,state)
    moment=dense_moment(m,state)
    np.testing.assert_allclose(state.actuator_length[:24]*1000,frames[k]['length_mm'],atol=1e-9)
    np.testing.assert_allclose(state.actuator_force[:24],frames[k]['signed_force_N'],atol=1e-9)
    np.testing.assert_allclose((state.actuator_force[:,None]*moment)[:24],frames[k]['generalized_force'],atol=1e-9)
    assert np.all(state.actuator_force[24:]==0)
    # Finite-difference length Jacobian, independent of engine's sparse representation.
    q=state.qpos.copy(); analytic=moment.copy()
    for j in range(m.nv):
        state.qpos[:]=q;state.qpos[j]+=1e-7;mujoco.mj_forward(m,state);plus=state.actuator_length.copy()
        state.qpos[:]=q;state.qpos[j]-=1e-7;mujoco.mj_forward(m,state);minus=state.actuator_length.copy()
        errors.append(float(np.max(np.abs((plus-minus)/2e-7-analytic[:,j]))))
assert max(errors)<1e-5
lengths=np.array([f['length_mm'] for f in frames]); force=np.array([f['signed_force_N'] for f in frames]); q=np.array([f['qpos'] for f in frames])
assert np.all(np.isfinite(lengths)) and np.all(np.isfinite(force)) and np.max(np.abs(force))>1
assert np.ptp(q[:,3])>.1 and np.ptp(q[:,1])>.001
assert np.all((s['ctrl'][:,:24]>=0)&(s['ctrl'][:,:24]<=1))
report={'passed':True,'frames':len(frames),'video':video,'muscles':24,'max_jacobian_finite_difference_error':max(errors),'generalized_force_sum_max_error':meta['force_sum_max_error'],'qpos_range':np.ptp(q,axis=0).tolist(),'max_absolute_actuator_force_N':float(abs(force).max()),'path_length_tracking_rmse_mm':float(np.sqrt(np.mean((lengths-np.array([f['target_length_mm'] for f in frames]))**2))),'view_count':5,'checks':['All five MP4 frame counts, FPS, duration and hashes','All 536x24 projected paths finite and inside frame for each view','24 unique fixed muscle colors and stable IDs','MP4 frame count, FPS and duration','SHA256 matches provenance','Saved NPZ re-evaluation matches JSON lengths, forces and all 5 generalized-force contributions','Moment arm checked against numerical derivative','Four exo actuator outputs zero','24 muscle control inputs in [0,1]','Finite data and nontrivial jaw motion']}
(out/'multiview-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
for t in range(22):
 k=min(535,t*25);print('motion',t, np.round(q[k],4).tolist())
