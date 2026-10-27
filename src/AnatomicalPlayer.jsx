import React,{useEffect,useRef,useState} from 'react';
import {frameIndex} from './timeline.mjs';
const asset=p=>import.meta.env.BASE_URL+p;

export default function AnatomicalPlayer({manifest,videoRef,index,onFrame,onPlaying,onError,selected,onSelect,rate,onBusy}){
 const [viewId,setViewId]=useState('front'),[paths,setPaths]=useState(null),[ready,setReady]=useState(false),[switching,setSwitching]=useState(true),[labels,setLabels]=useState(true),[zoom,setZoom]=useState(1),[center,setCenter]=useState([640,360]);
 const pending=useRef(true),restore=useRef({time:0,play:false}),cache=useRef(new Map()),drag=useRef(null),stage=useRef(null);
 const view=manifest.views.find(v=>v.id===viewId);
 useEffect(()=>onBusy(switching),[switching]);
 useEffect(()=>{let cancelled=false;setPaths(null);
   const load=cache.current.has(viewId)?Promise.resolve(cache.current.get(viewId)):fetch(asset(view.paths)).then(r=>{if(!r.ok)throw Error('肌肉标注加载失败');return r.json();});
   load.then(p=>{if(p.length!==manifest.frame_count)throw Error('标注帧数不匹配');cache.current.set(viewId,p);if(!cancelled)setPaths(p);}).catch(e=>{if(!cancelled)onError(e.message);});
   return()=>{cancelled=true;};
 },[viewId,manifest]);
 useEffect(()=>{const v=videoRef.current;let handle;
   const sync=t=>{if(!pending.current)onFrame(frameIndex(t,manifest.fps,manifest.frame_count));};
   const callback=(_,m)=>{sync(m.mediaTime);handle=v.requestVideoFrameCallback(callback);};
   const update=()=>sync(v.currentTime);
   if(v.requestVideoFrameCallback)handle=v.requestVideoFrameCallback(callback);
   v.addEventListener('timeupdate',update);v.addEventListener('seeked',update);
   return()=>{if(handle)v.cancelVideoFrameCallback(handle);v.removeEventListener('timeupdate',update);v.removeEventListener('seeked',update);};
 },[manifest]);
 useEffect(()=>{if(!ready||!paths||!pending.current)return;
   const v=videoRef.current;pending.current=false;setSwitching(false);onFrame(frameIndex(v.currentTime,manifest.fps,manifest.frame_count));v.playbackRate=rate;
   if(restore.current.play)v.play().catch(e=>onError(e.message));
 },[ready,paths]);
 const switchView=id=>{if(id===viewId)return;const v=videoRef.current;
   restore.current={time:pending.current?restore.current.time:v.currentTime,play:pending.current?restore.current.play:!v.paused};
   pending.current=true;v.pause();setReady(false);setSwitching(true);setViewId(id);
 };
 const onLoaded=()=>{const v=videoRef.current;v.playbackRate=rate;v.currentTime=Math.min(restore.current.time,(manifest.frame_count-1)/manifest.fps);if(restore.current.time===0)setReady(true);};
 const visible=paths?.[index];
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const focus=()=>{if(!visible)return;const pts=selected.flatMap(id=>visible[id]);setCenter([pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length]);setZoom(2.2);};
 const exportFrame=()=>{
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const c=canvas.getContext('2d');
   c.fillStyle='white';c.fillRect(0,0,1280,720);c.save();c.translate(640,360);c.scale(zoom,zoom);c.translate(-center[0],-center[1]);c.drawImage(videoRef.current,0,0,1280,720);
   if(labels&&visible)selected.forEach(id=>{const mu=manifest.muscles[id];c.strokeStyle=mu.color;c.lineWidth=4/zoom;c.setLineDash([7/zoom,4/zoom]);c.beginPath();visible[id].forEach((p,k)=>k?c.lineTo(...p):c.moveTo(...p));c.stroke();});c.restore();
   c.fillStyle='#fff';c.fillRect(0,0,1280,56);c.fillStyle='#164d42';c.font='22px sans-serif';c.fillText(`${view.label} / ${view.en} · ${(index/manifest.fps).toFixed(2)} s · 投影标注含遮挡结构`,24,36);
   if(labels)selected.forEach((id,k)=>{const m=manifest.muscles[id];c.fillStyle='#ffffffed';c.fillRect(20,65+k*36,380,32);c.fillStyle=m.color;c.fillText(`${m.code} ${m.label}`,30,89+k*36);});
   canvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`jaw-${viewId}-frame-${index}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
 };
 return <>
  <nav className="view-tabs" aria-label="解剖观察方向">{manifest.views.map(v=><button key={v.id} aria-pressed={viewId===v.id} onClick={()=>switchView(v.id)}>{v.label}<small>{v.en}</small></button>)}</nav>
  <div className="view-tools"><button onClick={()=>{setZoom(1);setCenter([640,360]);}}>全景复位</button><button disabled={!visible||switching} onClick={focus}>聚焦所选肌肉</button><label>放大 <input aria-label="画面放大倍率" type="range" min="1" max="3" step="0.1" value={zoom} onChange={e=>setZoom(+e.target.value)}/> {zoom.toFixed(1)}×</label><label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> 肌肉标注</label><button disabled={switching} onClick={exportFrame}>保存当前帧</button></div>
  <div className="anatomy-stage" ref={stage} onPointerDown={e=>{if(zoom<=1||e.target.closest('[data-muscle]'))return;drag.current={x:e.clientX,y:e.clientY,center};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const w=e.currentTarget.clientWidth;setCenter([clamp(drag.current.center[0]-(e.clientX-drag.current.x)*1280/w/zoom,0,1280),clamp(drag.current.center[1]-(e.clientY-drag.current.y)*1280/w/zoom,0,720)]);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <div className="anatomy-content" style={{transform:`translate(${(640-center[0])*zoom/1280*100}%, ${(360-center[1])*zoom/720*100}%) scale(${zoom})`}}>
    <video ref={videoRef} src={asset(view.video)} poster={asset(view.poster)} playsInline preload="auto" onLoadedMetadata={onLoaded} onSeeked={()=>{if(pending.current)setReady(true);}} onPlay={()=>onPlaying(true)} onPause={()=>onPlaying(false)} onEnded={()=>onPlaying(false)} onError={()=>onError('视角视频加载失败，请重试或检查网络')}/>
    {labels&&visible&&!switching&&<svg className="muscle-overlay" viewBox="0 0 1280 720" aria-label="肌肉路径投影，包含被骨骼遮挡部分">
     {selected.map(id=>{const m=manifest.muscles[id],ps=visible[id];return <g key={id}><polyline points={ps.map(p=>p.join(',')).join(' ')} stroke="white" strokeWidth="7"/><polyline points={ps.map(p=>p.join(',')).join(' ')} stroke={m.color} strokeWidth="3" strokeDasharray="7 4"/>{ps.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="4" fill={m.color} stroke="white"/>)}</g>;})}
    </svg>}
   </div>
   {labels&&visible&&!switching&&<svg className="callout-overlay" viewBox="0 0 1280 720" aria-label="肌肉名称与对应路径">
    {selected.map((id,k)=>{const m=manifest.muscles[id],ps=visible[id],last=ps.at(-1),x=640+(last[0]-center[0])*zoom,y=360+(last[1]-center[1])*zoom,right=x>=640,lane=selected.slice(0,k).filter(i=>(640+(visible[i].at(-1)[0]-center[0])*zoom>=640)===right).length,bx=right?942:18,by=100+lane*90;return <g data-muscle={id} key={id} role="button" tabIndex="0" aria-label={`单选${m.label}`} onClick={()=>onSelect([id])} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect([id]);}}}><line x1={right?bx:bx+320} y1={by+28} x2={x} y2={y} stroke={m.color} strokeWidth="2"/><rect x={bx} y={by} width="320" height="56" rx="8" fill="#fffffff2" stroke={m.color} strokeWidth="2"/><circle cx={bx+18} cy={by+28} r="6" fill={m.color}/><text x={bx+34} y={by+35} fontSize="21" fill={m.color}>{m.code} {m.label}</text></g>;})}
   </svg>}
   <div className="orientation"><span>{view.left}</span><b>{view.label} · {view.en}</b><span>{view.right}</span></div>
   <div className="stage-caption">{labels?'虚线 = 所选肌肉路径投影（含遮挡结构）':'实线颜色 = 固定肌肉编号'} · {zoom>1?'拖动平移局部':'完整观察视野'}</div>
   {switching&&<div className="view-loading">载入{view.label}，保持当前时间…</div>}
  </div>
  <div className="view-download"><a href={asset(view.video)} target="_blank" rel="noreferrer">打开{view.label} MP4 ↗</a><span>左右均指模型自身方向 · 非影像学切片</span></div>
 </>;
}
