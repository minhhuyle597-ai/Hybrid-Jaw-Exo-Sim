"""Render synchronized anatomical views and exact projected tendon polylines.

No new physics: each video uses the same saved qpos/qvel/act/ctrl.
Projection uses MuJoCo's actual mono camera/frustum, not hand-placed labels.
https://mujoco.readthedocs.io/en/3.4.0/APIreference/APItypes.html#mjvglcamera
"""
from pathlib import Path
import argparse, hashlib, json
import numpy as np
import mujoco
import imageio.v2 as imageio
from paths import MODEL, MODEL_REL, REFERENCE_REL

PROJECT=Path(__file__).resolve().parents[1]
PAIRS=[('#6f4dbb','#9c78dc'),('#445fc3','#7c94ef'),('#247bb5','#64b5df'),
       ('#008f83','#4fbbab'),('#ac650b','#e4a539'),('#bf4b18','#eb8752'),
       ('#bd234c','#ec6483'),('#a72b86','#d77cbd'),('#4c7133','#8ba75c'),
       ('#077eab','#47accf'),('#695149','#a18575'),('#9c6032','#c99a6b')]
LABELS=['颞肌后束','颞肌中束','颞肌前束','翼内肌','翼外肌上头','翼外肌下头','咬肌浅层','咬肌深层','颏舌骨肌','二腹肌前腹','下颌舌骨肌后部','下颌舌骨肌前部']
GROUPS=['颞肌']*3+['翼肌']*3+['咬肌']*2+['舌骨上肌群']*4
VIEWS=[{'id':'front','label':'前观','en':'Anterior','azimuth':180,'left':'R · 模型右','right':'L · 模型左'},
       {'id':'back','label':'后观','en':'Posterior','azimuth':0,'left':'L · 模型左','right':'R · 模型右'},
       {'id':'left','label':'左侧观','en':'Left lateral','azimuth':270,'left':'A · 前','right':'P · 后'},
       {'id':'right','label':'右侧观','en':'Right lateral','azimuth':90,'left':'P · 后','right':'A · 前'},
       {'id':'oblique','label':'左前斜观','en':'Left anterior oblique','azimuth':225,'left':'A / R','right':'P / L'}]

def project(points,scene,width,height):
    # Mono rendering averages the two eyes. Zero IPD avoids parallax disagreement.
    g=scene.camera[0]
    pos=(scene.camera[0].pos+scene.camera[1].pos)/2
    f=np.array(g.forward,dtype=float); f/=np.linalg.norm(f)
    u=np.array(g.up,dtype=float);u/=np.linalg.norm(u);r=np.cross(f,u)
    delta=points-pos;z=delta@f
    assert np.all(z>0)
    y=(delta@u)*g.frustum_near/z
    x=(delta@r)*g.frustum_near/z
    half_width=(g.frustum_top-g.frustum_bottom)*width/height/2
    return np.column_stack([(x/half_width+1)*width/2,(g.frustum_top-y)/(g.frustum_top-g.frustum_bottom)*height])

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--preview',action='store_true');args=ap.parse_args()
    public=PROJECT/'public';data=public/'data';out=public/'videos/views'
    out.mkdir(parents=True,exist_ok=True)
    record=np.load(data/'states.npz');frames=json.loads((data/'frames.json').read_text(encoding='utf-8'))
    m=mujoco.MjModel.from_xml_path(str(MODEL));d=mujoco.MjData(m)
    m.actuator_gainprm[24:]=0;m.actuator_biasprm[24:]=0
    m.vis.global_.offwidth=1280;m.vis.global_.offheight=720;m.vis.global_.ipd=0
    muscles=[]
    for i in range(24):
        color=PAIRS[i//2][i%2];side='左' if i%2==0 else '右'
        muscles.append({'id':i,'code':f'M{i+1:02}','name':m.actuator(i).name.lstrip('_'),'label':side+'侧'+LABELS[i//2],'group':GROUPS[i//2],'side':side,'color':color})
        tid=m.actuator_trnid[i,0]
        m.tendon_rgba[tid]=[int(color[j:j+2],16)/255 for j in (1,3,5)]+[1]
        m.tendon_width[tid]=.00115
    for i in range(m.ngeom):
        if any(s in (m.geom(i).name or '') for s in ['skin','exo']):m.geom_rgba[i,3]=0
    for i in range(24,m.nu):m.tendon_rgba[m.actuator_trnid[i,0],3]=0
    option=mujoco.MjvOption();option.sitegroup[:]=0
    option.flags[mujoco.mjtVisFlag.mjVIS_TENDON]=True
    option.flags[mujoco.mjtVisFlag.mjVIS_JOINT]=False
    option.flags[mujoco.mjtVisFlag.mjVIS_ACTUATOR]=False
    cam=mujoco.MjvCamera();cam.lookat[:]=[0,0,-.065];cam.distance=.57;cam.elevation=0
    renderer=mujoco.Renderer(m,height=720,width=1280)
    results=[]
    for view in VIEWS:
        cam.azimuth=view['azimuth'];polylines=[]
        target=out/(view['id']+'.mp4')
        if not args.preview and target.exists():raise FileExistsError(target)
        writer=None if args.preview else imageio.get_writer(target,fps=25,codec='libx264',quality=8,macro_block_size=16,ffmpeg_params=['-movflags','+faststart'])
        try:
            for k in ([25] if args.preview else range(len(record['time_s']))):
                for key in ['qpos','qvel','act','ctrl']:getattr(d,key)[:]=record[key][k]
                d.time=float(record['time_s'][k]);mujoco.mj_forward(m,d)
                renderer.update_scene(d,camera=cam,scene_option=option)
                pixels=renderer.render()
                if writer:writer.append_data(pixels)
                paths=[]
                for i in range(24):
                    tid=m.actuator_trnid[i,0];adr=int(d.ten_wrapadr[tid]);n=int(d.ten_wrapnum[tid])
                    world=d.wrap_xpos.reshape(-1,3)[adr:adr+n]
                    assert n>=2
                    xy=project(world,renderer.scene,1280,720)
                    assert np.all(np.isfinite(xy)) and np.all(xy[:,0]>0) and np.all(xy[:,0]<1280) and np.all(xy[:,1]>0) and np.all(xy[:,1]<720)
                    paths.append(np.round(xy,2).tolist())
                polylines.append(paths)
                if k==25:
                    imageio.imwrite(out/(view['id']+('.preview.png' if args.preview else '.png')),pixels)
                    if args.preview:
                        # Diagnostic projected paths for visual QA only, never published.
                        from PIL import Image,ImageDraw
                        im=Image.fromarray(pixels);draw=ImageDraw.Draw(im)
                        for i in [0,1,12,13,18,19]:
                            pts=[tuple(p) for p in paths[i]];draw.line(pts,fill=muscles[i]['color'],width=5)
                            draw.text(pts[-1],muscles[i]['code'],fill='black',stroke_width=1,stroke_fill='white')
                        qa=PROJECT/'.runtime';qa.mkdir(exist_ok=True)
                        im.save(qa/(view['id']+'-projection.png'))
                if k%150==0:print(view['id'],k,flush=True)
        finally:
            if writer:writer.close()
        if not args.preview:
            projection=data/(view['id']+'-paths.json')
            projection.write_text(json.dumps(polylines,separators=(',',':'),allow_nan=False),encoding='utf-8')
            results.append({**view,'video':'videos/views/'+target.name,'poster':'videos/views/'+view['id']+'.png','paths':'data/'+projection.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    renderer.close()
    if args.preview:return
    manifest={'width':1280,'height':720,'fps':25,'frame_count':len(record['time_s']),'camera':{'lookat':cam.lookat.tolist(),'distance':cam.distance,'elevation':0,'ipd':0},'muscles':muscles,'views':results,'annotation':'Camera-projected muscle-tendon paths. Overlay includes occluded structures; it is not surface segmentation.'}
    (data/'views.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    meta=frames['meta'];meta['model']=MODEL_REL;meta['reference']=REFERENCE_REL;meta.pop('video_sha256',None)
    meta['video_manifest']='data/views.json';meta['model_changes']={'exo_actuator_gainprm':'zero for indices 24:28','exo_actuator_biasprm':'zero for indices 24:28'}
    (data/'frames.json').write_text(json.dumps(frames,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    (data/'provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    print('DONE: 5 synchronized views and projected paths',flush=True)
if __name__=='__main__':main()
