import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchLive } from '../api';

const EARTH_R  = 5.0;
const EARTH_KM = 6371.0;          // real Earth radius in km
const SCALE    = EARTH_R / EARTH_KM;  // 1 km → scene units, so 6371 km = EARTH_R
function eci(x,y,z){ return new THREE.Vector3(x*SCALE, z*SCALE, y*SCALE); }

function makeSatTex(){
  const C=64, cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(C/2,C/2,1,C/2,C/2,C/2);
  g.addColorStop(0,'rgba(80,255,140,1)'); g.addColorStop(0.4,'rgba(50,200,100,0.5)'); g.addColorStop(1,'rgba(30,160,80,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='#dde5ee'; ctx.fillRect(C/2-4,C/2-2,8,4);
  ctx.fillStyle='#2a7fd4'; ctx.fillRect(C/2-13,C/2-1,8,3); ctx.fillRect(C/2+5,C/2-1,8,3);
  return new THREE.CanvasTexture(cv);
}

function makeDebrisTex(){
  const C=64, cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(C/2,C/2,1,C/2,C/2,C/2);
  g.addColorStop(0,'rgba(255,100,60,1)'); g.addColorStop(0.4,'rgba(220,60,40,0.5)'); g.addColorStop(1,'rgba(200,40,20,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='#9a9080'; ctx.beginPath();
  [[0,-6],[4,-2],[7,-4],[6,1],[8,4],[3,5],[1,8],[-3,6],[-6,7],[-4,1],[-7,0],[-3,-4]]
    .forEach(([x,y],i)=>i===0?ctx.moveTo(C/2+x,C/2+y):ctx.lineTo(C/2+x,C/2+y));
  ctx.closePath(); ctx.fill();
  return new THREE.CanvasTexture(cv);
}

function makeCloudTex(){
  const C=512, cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='black'; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='rgba(255,255,255,0.6)';
  for(let i=0;i<70;i++){
    ctx.beginPath();
    ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*55+8,Math.random()*18+3,Math.random()*Math.PI,0,Math.PI*2);
    ctx.fill();
  }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

export default function GlobeView(){
  const mountRef = useRef(null);
  const zoomRef  = useRef(18);
  const [counts, setCounts] = useState({sats:0, debris:0});
  const [status, setStatus] = useState('Loading…');
  const [tooltip, setTooltip] = useState(null);

  useEffect(()=>{
    let raf=null, cleanupFn=null, renderer=null, mounted=true;

    const init = requestAnimationFrame(()=>{
      if(!mounted) return;
      const el = mountRef.current; if(!el) return;
      const W = el.offsetWidth||window.innerWidth;
      const H = el.offsetHeight||(window.innerHeight-56);

      try{ renderer = new THREE.WebGLRenderer({antialias:true}); }
      catch(e){ console.error(e); return; }
      renderer.setSize(W,H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      el.appendChild(renderer.domElement);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W/H, 0.01, 800);
      camera.position.set(0,2,18);

      /* ── STARS ── */
      [
        [3000, 300, 0.7, 0xffffff,  0.85],
        [600,  220, 1.3, 0xbbddff,  0.65],
        [200,  180, 2.2, 0xffeedd,  0.45],
      ].forEach(([n,rad,sz,col,op])=>{
        const v=[];
        for(let i=0;i<n;i++){
          const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
          const r=rad+Math.random()*80;
          v.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph));
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
          color:col, size:sz, transparent:true, opacity:op, sizeAttenuation:false
        })));
      });

      /* ── MILKY WAY band ── */
      const mwV=[];
      for(let i=0;i<1200;i++){
        const th=Math.random()*Math.PI*2, ph=(Math.random()-0.5)*0.2, r=320+Math.random()*50;
        mwV.push(r*Math.cos(ph)*Math.cos(th), r*Math.sin(ph), r*Math.cos(ph)*Math.sin(th));
      }
      const mwGeo=new THREE.BufferGeometry();
      mwGeo.setAttribute('position', new THREE.Float32BufferAttribute(mwV,3));
      scene.add(new THREE.Points(mwGeo, new THREE.PointsMaterial({
        color:0xddeeff, size:0.9, transparent:true, opacity:0.2, sizeAttenuation:false
      })));

      /* ── LIGHTS ── */
      scene.add(new THREE.AmbientLight(0x0d1b3e, 2.0));
      const sun = new THREE.DirectionalLight(0xfff4e0, 5.0);
      sun.position.set(-6, 4, 10); scene.add(sun);
      const rim = new THREE.DirectionalLight(0x1a3a8a, 1.0);
      rim.position.set(6,-3,-10); scene.add(rim);

      /* ── EARTH ── */
      const earthMat = new THREE.MeshPhongMaterial({
        specular: new THREE.Color(0x224488),
        shininess: 55,
      });
      new THREE.TextureLoader().load(
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        t=>{ earthMat.map=t; earthMat.needsUpdate=true; },
        undefined,
        ()=>{
          // Procedural fallback
          const C=1024, cv=document.createElement('canvas'); cv.width=C; cv.height=C;
          const ctx=cv.getContext('2d');
          const g=ctx.createLinearGradient(0,0,0,C);
          g.addColorStop(0,'#030e22'); g.addColorStop(0.5,'#06204a'); g.addColorStop(1,'#030e22');
          ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
          ctx.fillStyle='rgba(0,50,160,0.2)';
          for(let i=0;i<100;i++){
            ctx.beginPath();
            ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*40+5,Math.random()*14+3,Math.random()*Math.PI,0,Math.PI*2);
            ctx.fill();
          }
          ctx.fillStyle='rgba(35,75,25,0.65)';
          [[200,200,130,80],[580,170,110,70],[760,290,85,60],[310,360,95,65],[510,410,75,50]].forEach(([x,y,rx,ry])=>{
            ctx.beginPath(); ctx.ellipse(x,y,rx,ry,Math.random()*Math.PI,0,Math.PI*2); ctx.fill();
          });
          earthMat.map=new THREE.CanvasTexture(cv); earthMat.needsUpdate=true;
        }
      );
      const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R,64,64), earthMat);
      scene.add(earth);

      /* Clouds */
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.012, 48, 48),
        new THREE.MeshPhongMaterial({alphaMap:makeCloudTex(), transparent:true, opacity:0.38, color:0xffffff, depthWrite:false})
      );
      scene.add(clouds);

      /* Atmosphere — inner blue glow */
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.025,32,32),
        new THREE.MeshPhongMaterial({color:0x1166ff, transparent:true, opacity:0.055, side:THREE.FrontSide, depthWrite:false})
      ));
      /* Atmosphere — outer rim halo */
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.14,32,32),
        new THREE.MeshPhongMaterial({color:0x0044cc, transparent:true, opacity:0.04, side:THREE.BackSide, depthWrite:false})
      ));
      /* Atmosphere — soft outer shell */
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.28,24,24),
        new THREE.MeshBasicMaterial({color:0x002299, transparent:true, opacity:0.015, side:THREE.BackSide, depthWrite:false})
      ));

      /* Moon */
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*0.27,24,24),
        new THREE.MeshPhongMaterial({color:0xaaaaaa, shininess:5})
      );
      scene.add(moon);
      let moonAngle=0.8;

      /* ── ORBITAL SPRITES ── */
      const satTex=makeSatTex(), debTex=makeDebrisTex();
      const hoverList=[], orbitMeshes=[];

      function addObjects(objs){
        objs.forEach(obj=>{
          const pos=eci(obj.x,obj.y,obj.z), r=pos.length();
          // valid LEO–GEO range: just above surface up to ~42000 km
          if(r<EARTH_R*1.001||r>EARTH_R*7) return;
          const isDebris=obj.label===1;
          const sp=new THREE.Sprite(new THREE.SpriteMaterial({
            map:isDebris?debTex:satTex, transparent:true, sizeAttenuation:true, depthWrite:false
          }));
          const sz=isDebris?0.28:0.35;
          sp.scale.set(sz,sz,1);
          sp.position.copy(pos);
          sp.userData={
            kind:isDebris?'debris':'satellite', isDebris,
            name:obj.name, norad_id:obj.norad_id, type:obj.type,
            alt:obj.altitude?.toFixed(1), vel:obj.velocity_magnitude?.toFixed(3),
            confidence:obj.confidence, debris_prob:obj.debris_prob,
            ecc:obj.eccentricity?.toFixed(6),
            inc:(obj.inclination*180/Math.PI)?.toFixed(2),
            period:(obj.orbital_period/60)?.toFixed(1),
            sma:obj.semi_major_axis?.toFixed(1),
            perigee:obj.perigee?.toFixed(1), apogee:obj.apogee?.toFixed(1),
          };
          scene.add(sp); hoverList.push(sp);
          const vel=eci(obj.vx,obj.vy,obj.vz);
          const axis=new THREE.Vector3().crossVectors(pos,vel).normalize();
          orbitMeshes.push({mesh:sp, axis, speed:vel.length()/r*0.012, r});
        });
      }

      /* ── RAYCASTER ── */
      const raycaster=new THREE.Raycaster();
      raycaster.params.Sprite={threshold:0.15};
      const mouse=new THREE.Vector2(-9999,-9999);
      const onMove=e=>{
        const rect=renderer.domElement.getBoundingClientRect();
        mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
        mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
        raycaster.setFromCamera(mouse,camera);
        const hits=raycaster.intersectObjects(hoverList,false);
        setTooltip(hits.length?{...hits[0].object.userData, mx:e.clientX, my:e.clientY, _ts:Date.now()}:null);
      };
      renderer.domElement.addEventListener('mousemove',onMove);

      /* ── DRAG & ZOOM ── */
      const drag={on:false,px:0,py:0};
      let rotY=0.4, rotX=0.18, autoRot=0;
      renderer.domElement.addEventListener('mousedown',e=>{drag.on=true;drag.px=e.clientX;drag.py=e.clientY;});
      const onUp=()=>{drag.on=false;};
      const onDrag=e=>{
        if(!drag.on) return;
        rotY+=(e.clientX-drag.px)*0.005; drag.px=e.clientX;
        rotX+=(e.clientY-drag.py)*0.004; drag.py=e.clientY;
        rotX=Math.max(-1.2,Math.min(1.2,rotX));
      };
      window.addEventListener('mouseup',onUp);
      window.addEventListener('mousemove',onDrag);
      renderer.domElement.addEventListener('wheel',e=>{
        zoomRef.current=Math.max(7,Math.min(80,zoomRef.current+e.deltaY*0.02));
      },{passive:true});

      /* ── LIVE FETCH ── */
      let sc=0,dc=0,si=0;
      const sources=['stations','cosmos_1408','fengyun_1c','iridium_33','cosmos_2251'];
      const fetchNext=()=>{
        if(!mounted||si>=sources.length){setCounts({sats:sc,debris:dc});setStatus('');return;}
        fetchLive(sources[si++],100).then(r=>{
          if(!mounted) return;
          const o=r.data.objects||[];
          addObjects(o);
          sc+=o.filter(x=>x.label===0).length;
          dc+=o.filter(x=>x.label===1).length;
          setStatus(`Syncing ${si}/${sources.length}…`);
          setTimeout(fetchNext,200);
        }).catch(()=>setTimeout(fetchNext,200));
      };
      fetchNext();

      /* ── ANIMATION LOOP ── */
      const quat=new THREE.Quaternion();
      const animate=()=>{
        raf=requestAnimationFrame(animate);
        if(!drag.on) autoRot+=0.00055;
        earth.rotation.y+=0.00025;
        clouds.rotation.y+=0.00038;
        moonAngle+=0.0014;
        moon.position.set(
          Math.cos(moonAngle)*EARTH_R*9,
          Math.sin(moonAngle*0.4)*EARTH_R*1.8,
          Math.sin(moonAngle)*EARTH_R*9
        );
        moon.rotation.y+=0.0007;
        orbitMeshes.forEach(({mesh,axis,speed,r})=>{
          quat.setFromAxisAngle(axis,speed);
          mesh.position.applyQuaternion(quat);
          mesh.position.setLength(r);
        });
        const ry=rotY+autoRot, z=zoomRef.current;
        camera.position.set(z*Math.sin(ry)*Math.cos(rotX), z*Math.sin(rotX), z*Math.cos(ry)*Math.cos(rotX));
        camera.lookAt(0,0,0);
        renderer.render(scene,camera);
      };
      animate();

      const onResize=()=>{
        const w=el.offsetWidth, h=el.offsetHeight||window.innerHeight-56;
        camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
      };
      window.addEventListener('resize',onResize);

      cleanupFn=()=>{
        cancelAnimationFrame(raf);
        window.removeEventListener('resize',onResize);
        window.removeEventListener('mouseup',onUp);
        window.removeEventListener('mousemove',onDrag);
        renderer.domElement.removeEventListener('mousemove',onMove);
        renderer.dispose();
        if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      };
    });

    return()=>{
      mounted=false;
      if(typeof cleanupFn==='function') cleanupFn();
      else cancelAnimationFrame(init);
    };
  },[]);

  const zoom=dir=>{ zoomRef.current=Math.max(7,Math.min(80,zoomRef.current+dir*2)); };

  const renderTooltip=()=>{
    if(!tooltip) return null;
    const isDebris=tooltip.isDebris;
    const accent=isDebris?'#f87171':'#4ade80';
    const glow=isDebris?'rgba(248,113,113,0.2)':'rgba(74,222,128,0.2)';
    const icon=isDebris?'💥':'🛰️';
    const rows=[
      ['NORAD ID',tooltip.norad_id],
      ['Altitude',`${tooltip.alt} km`],
      ['Velocity',`${tooltip.vel} km/s`],
      ['Period',`${tooltip.period} min`],
      ['Inclination',`${tooltip.inc}°`],
      ['Eccentricity',tooltip.ecc],
      ['Semi-Major Axis',`${tooltip.sma} km`],
      ['Perigee',`${tooltip.perigee} km`],
      ['Apogee',`${tooltip.apogee} km`],
      ['Debris Prob',`${tooltip.debris_prob}%`],
      ['Confidence',`${tooltip.confidence}%`],
    ];
    return(
      <div key={tooltip._ts} style={{
        position:'fixed',
        left:Math.min(tooltip.mx+18,window.innerWidth-278),
        top:Math.max(tooltip.my-8,8),
        width:265,
        background:'linear-gradient(145deg,rgba(4,8,18,0.97),rgba(6,12,26,0.97))',
        border:`1px solid ${accent}44`,
        borderRadius:14,
        padding:'13px 15px',
        pointerEvents:'none',
        zIndex:9999,
        boxShadow:`0 16px 48px rgba(0,0,0,0.9),0 0 28px ${glow},inset 0 1px 0 rgba(255,255,255,0.04)`,
        backdropFilter:'blur(18px)',
        animation:'tfx 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        fontFamily:'"Inter",system-ui,sans-serif',
      }}>
        <style>{`@keyframes tfx{0%{opacity:0;transform:scale(0.84) translateY(10px)}60%{opacity:1;transform:scale(1.03) translateY(-2px)}100%{transform:scale(1) translateY(0)}}`}</style>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:11,paddingBottom:10,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{width:34,height:34,borderRadius:9,background:`${accent}18`,border:`1px solid ${accent}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0}}>
            {icon}
          </div>
          <div>
            <div style={{fontWeight:700,color:'#f0f6ff',fontSize:'0.86rem',lineHeight:1.2}}>{tooltip.name||'Unknown Object'}</div>
            <div style={{fontSize:'0.57rem',color:accent,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',marginTop:2}}>{tooltip.type||'Orbital Object'}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 8px',marginBottom:10}}>
          {rows.map(([k,v])=>(
            <div key={k} style={{background:'rgba(255,255,255,0.03)',borderRadius:6,padding:'5px 7px'}}>
              <div style={{fontSize:'0.49rem',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:1}}>{k}</div>
              <div style={{fontSize:'0.71rem',color:'#d1d5db',fontWeight:600}}>{v??'—'}</div>
            </div>
          ))}
        </div>
        <div style={{borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:9}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
            <span style={{fontSize:'0.52rem',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.5px'}}>Debris Risk</span>
            <span style={{fontSize:'0.68rem',fontWeight:700,color:tooltip.debris_prob>70?'#f87171':tooltip.debris_prob>30?'#fbbf24':'#4ade80'}}>{tooltip.debris_prob}%</span>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)',borderRadius:6,height:6,overflow:'hidden'}}>
            <div style={{
              height:'100%',borderRadius:6,
              width:`${tooltip.debris_prob}%`,
              background:tooltip.debris_prob>70?'linear-gradient(90deg,#dc2626,#f87171)':tooltip.debris_prob>30?'linear-gradient(90deg,#d97706,#fbbf24)':'linear-gradient(90deg,#16a34a,#4ade80)',
              transition:'width 0.4s',
            }}/>
          </div>
        </div>
      </div>
    );
  };

  return(
    <div style={{position:'relative',width:'100%',height:'100%',background:'#000810',overflow:'hidden',fontFamily:'"Inter",system-ui,sans-serif'}}>
      <div ref={mountRef} style={{width:'100%',height:'100%',cursor:'grab'}}/>

      {/* Branding */}
      <div style={{position:'absolute',top:18,left:22,pointerEvents:'none',display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#1d4ed8,#0ea5e9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',boxShadow:'0 4px 18px rgba(14,165,233,0.45)'}}>🛰️</div>
        <div>
          <div style={{fontSize:'1rem',fontWeight:800,color:'#f0f6ff',letterSpacing:'0.4px',lineHeight:1.1}}>ORBIT-TRUST</div>
          <div style={{fontSize:'0.57rem',color:'#60a5fa',marginTop:1,letterSpacing:'0.2px'}}>Live Space Debris Tracker</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{position:'absolute',top:18,right:22,display:'flex',flexDirection:'column',gap:7,pointerEvents:'none'}}>
        <div style={{background:'linear-gradient(135deg,rgba(5,46,22,0.92),rgba(6,78,59,0.75))',border:'1px solid rgba(74,222,128,0.22)',borderRadius:10,padding:'8px 14px',textAlign:'right',backdropFilter:'blur(12px)',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,color:'#4ade80',lineHeight:1}}>{counts.sats}</div>
          <div style={{fontSize:'0.57rem',color:'#86efac',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:2}}>Active Satellites</div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(69,10,10,0.92),rgba(127,29,29,0.75))',border:'1px solid rgba(248,113,113,0.22)',borderRadius:10,padding:'8px 14px',textAlign:'right',backdropFilter:'blur(12px)',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,color:'#f87171',lineHeight:1}}>{counts.debris}</div>
          <div style={{fontSize:'0.57rem',color:'#fca5a5',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:2}}>Debris Objects</div>
        </div>
        {status&&(
          <div style={{background:'rgba(14,165,233,0.07)',border:'1px solid rgba(14,165,233,0.18)',borderRadius:8,padding:'5px 10px',textAlign:'right',backdropFilter:'blur(8px)'}}>
            <div style={{fontSize:'0.6rem',color:'#38bdf8',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:5}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#38bdf8',display:'inline-block',animation:'pulse 1s infinite'}}/>
              {status}
            </div>
          </div>
        )}
      </div>

      {/* Zoom */}
      <div style={{position:'absolute',right:22,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:5}}>
        {[{l:'+',d:-1},{l:'−',d:1}].map(({l,d})=>(
          <button key={l} onClick={()=>zoom(d)} style={{width:36,height:36,borderRadius:8,background:'rgba(4,8,18,0.88)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8',fontSize:'1.1rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}
            onMouseEnter={e=>{e.currentTarget.style.color='#f0f6ff';e.currentTarget.style.borderColor='rgba(96,165,250,0.5)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='#94a3b8';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';}}
          >{l}</button>
        ))}
        <button onClick={()=>{zoomRef.current=18;}} style={{width:36,height:36,borderRadius:8,background:'rgba(4,8,18,0.88)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8',fontSize:'0.5rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',letterSpacing:'0.5px'}}
          onMouseEnter={e=>{e.currentTarget.style.color='#f0f6ff';e.currentTarget.style.borderColor='rgba(96,165,250,0.5)';}}
          onMouseLeave={e=>{e.currentTarget.style.color='#94a3b8';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';}}
        >RST</button>
      </div>

      {/* Legend */}
      <div style={{position:'absolute',bottom:18,left:'50%',transform:'translateX(-50%)',display:'flex',gap:16,alignItems:'center',background:'rgba(4,8,18,0.88)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'7px 20px',pointerEvents:'none',backdropFilter:'blur(12px)',boxShadow:'0 4px 24px rgba(0,0,0,0.6)',whiteSpace:'nowrap'}}>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.67rem',color:'#94a3b8'}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'#4ade80',display:'inline-block',boxShadow:'0 0 6px #4ade80'}}/>Satellite
        </span>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.67rem',color:'#94a3b8'}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'#f87171',display:'inline-block',boxShadow:'0 0 6px #f87171'}}/>Debris
        </span>
        <span style={{width:1,height:12,background:'rgba(255,255,255,0.1)'}}/>
        <span style={{fontSize:'0.6rem',color:'#4b5563'}}>Drag · Scroll · Hover</span>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
      {renderTooltip()}
    </div>
  );
}
