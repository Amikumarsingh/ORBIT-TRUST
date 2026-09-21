import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchLive } from '../api';

const SCALE   = 1 / 1500;
const EARTH_R = 6371 * SCALE;

function eciToThree(x, y, z) {
  return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
}

function makeSatelliteSprite() {
  const C = 128, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(C/2,C/2,4,C/2,C/2,C/2);
  g.addColorStop(0,'rgba(63,255,120,1)');
  g.addColorStop(0.3,'rgba(63,220,100,0.7)');
  g.addColorStop(1,'rgba(63,185,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
  // body
  ctx.fillStyle = '#dde5ee'; ctx.fillRect(C/2-6,C/2-3,12,7);
  // solar panels
  ctx.fillStyle = '#1a6fd4'; ctx.fillRect(C/2-22,C/2-2,13,5); ctx.fillRect(C/2+9,C/2-2,13,5);
  // panel grid lines
  ctx.strokeStyle='rgba(100,180,255,0.6)'; ctx.lineWidth=0.8;
  [C/2-16,C/2-12].forEach(x=>{ ctx.beginPath(); ctx.moveTo(x,C/2-2); ctx.lineTo(x,C/2+3); ctx.stroke(); });
  [C/2+13,C/2+17].forEach(x=>{ ctx.beginPath(); ctx.moveTo(x,C/2-2); ctx.lineTo(x,C/2+3); ctx.stroke(); });
  // antenna
  ctx.strokeStyle='#c9d1d9'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(C/2,C/2-3); ctx.lineTo(C/2,C/2-12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(C/2,C/2-12); ctx.lineTo(C/2-4,C/2-16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(C/2,C/2-12); ctx.lineTo(C/2+4,C/2-16); ctx.stroke();
  return new THREE.CanvasTexture(cv);
}

function makeDebrisSprite() {
  const C = 128, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(C/2,C/2,3,C/2,C/2,C/2);
  g.addColorStop(0,'rgba(255,90,60,1)');
  g.addColorStop(0.3,'rgba(220,60,40,0.6)');
  g.addColorStop(1,'rgba(248,81,73,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
  // jagged rock
  ctx.fillStyle = '#9a9080';
  ctx.beginPath();
  const pts=[[0,-9],[4,-4],[8,-7],[7,0],[11,4],[5,5],[3,10],[-2,7],[-8,9],[-7,2],[-11,0],[-6,-5]];
  pts.forEach(([x,y],i)=>i===0?ctx.moveTo(C/2+x,C/2+y):ctx.lineTo(C/2+x,C/2+y));
  ctx.closePath(); ctx.fill();
  // craters
  ctx.fillStyle='rgba(0,0,0,0.25)';
  [[2,-1,2.5],[−4,3,1.8],[3,5,1.5]].forEach(([x,y,r])=>{ ctx.beginPath(); ctx.arc(C/2+x,C/2+y,r,0,Math.PI*2); ctx.fill(); });
  return new THREE.CanvasTexture(cv);
}

function makeCloudTexture() {
  const C=512, cv=document.createElement('canvas');
  cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='black'; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='rgba(255,255,255,0.72)';
  for(let i=0;i<90;i++){
    ctx.beginPath();
    ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*55+8,Math.random()*18+3,Math.random()*Math.PI,0,Math.PI*2);
    ctx.fill();
  }
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}

export default function GlobeView() {
  const mountRef = useRef(null);
  const zoomRef  = useRef(20);
  const [counts,  setCounts]  = useState({ sats: 0, debris: 0 });
  const [status,  setStatus]  = useState('Loading live orbital data…');
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    let animRaf = null, initRaf = null, renderer = null;
    let mounted = true;

    initRaf = requestAnimationFrame(() => {
      if (!mounted) return;
      const el = mountRef.current;
      if (!el) return;
      const W = el.offsetWidth  || window.innerWidth;
      const H = el.offsetHeight || (window.innerHeight - 56);

      try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
      catch(e) { console.error('WebGL failed:', e); return; }
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      el.appendChild(renderer.domElement);

      const scene  = new THREE.Scene();
      scene.background = new THREE.Color(0x020509);
      const camera = new THREE.PerspectiveCamera(45, W/H, 0.01, 500);
      camera.position.set(0, 3, 20);

      // ── Stars (3 layers for depth) ─────────────────────────────────────────
      [[12000,350,0.45,0xffffff,0.55],[3000,200,0.9,0xaaddff,0.8],[600,120,1.6,0xffeecc,0.9]].forEach(([n,rad,sz,col,op])=>{
        const v=[];
        for(let i=0;i<n;i++){
          const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), r=rad+Math.random()*80;
          v.push(r*Math.sin(ph)*Math.cos(th),r*Math.sin(ph)*Math.sin(th),r*Math.cos(ph));
        }
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
        scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:col,size:sz,transparent:true,opacity:op})));
      });

      // ── Milky Way band (faint) ─────────────────────────────────────────────
      const mwV=[];
      for(let i=0;i<5000;i++){
        const th=Math.random()*Math.PI*2;
        const ph=(Math.random()-0.5)*0.18;
        const r=280+Math.random()*60;
        mwV.push(r*Math.cos(ph)*Math.cos(th),r*Math.sin(ph),r*Math.cos(ph)*Math.sin(th));
      }
      const mwG=new THREE.BufferGeometry();
      mwG.setAttribute('position',new THREE.Float32BufferAttribute(mwV,3));
      scene.add(new THREE.Points(mwG,new THREE.PointsMaterial({color:0xccddff,size:0.6,transparent:true,opacity:0.18})));

      // ── Lights ─────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x223355, 1.0));
      const sunLight = new THREE.DirectionalLight(0xfff8e8, 2.8);
      sunLight.position.set(80, 30, 50);
      scene.add(sunLight);
      // subtle fill from opposite side (earthshine)
      const fillLight = new THREE.DirectionalLight(0x112244, 0.4);
      fillLight.position.set(-80, -20, -50);
      scene.add(fillLight);

      // ── Earth ──────────────────────────────────────────────────────────────
      const earthMat = new THREE.MeshPhongMaterial({ specular: new THREE.Color(0x1a3a6a), shininess: 35 });
      const texLoader = new THREE.TextureLoader();
      texLoader.load(
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        tex => { earthMat.map = tex; earthMat.needsUpdate = true; },
        undefined,
        () => {
          // fallback procedural
          const C=1024, cv=document.createElement('canvas'); cv.width=C; cv.height=C;
          const ctx=cv.getContext('2d');
          const g=ctx.createLinearGradient(0,0,0,C);
          g.addColorStop(0,'#040d1f'); g.addColorStop(0.5,'#071e45'); g.addColorStop(1,'#040d1f');
          ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
          ctx.fillStyle='rgba(0,80,180,0.18)';
          for(let i=0;i<120;i++){ ctx.beginPath(); ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*40+5,Math.random()*14+3,Math.random()*Math.PI,0,Math.PI*2); ctx.fill(); }
          const continents=[
            {pts:[[80,160],[200,140],[230,200],[210,280],[160,300],[90,260],[60,200]],c:'#1a6b2a'},
            {pts:[[170,290],[210,280],[220,380],[190,430],[155,400],[145,330]],c:'#1d7a30'},
            {pts:[[280,140],[380,120],[400,200],[370,280],[310,300],[270,240],[260,180]],c:'#1e7535'},
            {pts:[[380,280],[430,260],[450,340],[410,380],[370,350],[360,300]],c:'#1a6b2a'},
            {pts:[[400,120],[560,100],[600,180],[580,240],[500,260],[420,220],[390,160]],c:'#1d7a30'},
            {pts:[[560,200],[640,180],[680,240],[660,300],[600,310],[550,260]],c:'#1e7535'},
            {pts:[[620,280],[680,260],[700,320],[670,360],[630,340]],c:'#1a6b2a'},
          ];
          continents.forEach(({pts,c})=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(pts[0][0]*C/720,pts[0][1]*C/512); pts.slice(1).forEach(([x,y])=>ctx.lineTo(x*C/720,y*C/512)); ctx.closePath(); ctx.fill(); });
          earthMat.map=new THREE.CanvasTexture(cv); earthMat.needsUpdate=true;
        }
      );

      // specular map (oceans bright, land dark)
      const specC=512, specCv=document.createElement('canvas'); specCv.width=specC; specCv.height=specC;
      const specCtx=specCv.getContext('2d'); specCtx.fillStyle='#334466'; specCtx.fillRect(0,0,specC,specC);
      earthMat.specularMap=new THREE.CanvasTexture(specCv);

      const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R,64,64), earthMat);
      scene.add(earth);

      // clouds
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.013,48,48),
        new THREE.MeshPhongMaterial({ alphaMap:makeCloudTexture(), transparent:true, opacity:0.30, color:0xffffff, depthWrite:false })
      );
      scene.add(clouds);

      // atmosphere inner glow
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.026,32,32),
        new THREE.MeshPhongMaterial({color:0x1144ff,transparent:true,opacity:0.06,side:THREE.FrontSide,depthWrite:false})));
      // atmosphere outer halo
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.10,32,32),
        new THREE.MeshPhongMaterial({color:0x0033cc,transparent:true,opacity:0.025,side:THREE.BackSide,depthWrite:false})));

      // Moon
      const moonMat = new THREE.MeshPhongMaterial({ color:0xbbbbbb });
      texLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg',
        t=>{ moonMat.map=t; moonMat.needsUpdate=true; }, undefined, ()=>{}
      );
      const moon = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*0.27,32,32), moonMat);
      scene.add(moon);
      let moonAngle = 0;

      // ── Orbital object sprites ─────────────────────────────────────────────
      const satTex    = makeSatelliteSprite();
      const debrisTex = makeDebrisSprite();
      const orbitMeshes = [];
      const hoverList   = [];

      function addObjects(objs) {
        objs.forEach(obj => {
          const pos = eciToThree(obj.x, obj.y, obj.z);
          const rad = pos.length();
          if(rad < EARTH_R*1.001 || rad > 80) return;
          const isDebris = obj.label === 1;
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: isDebris ? debrisTex : satTex,
            transparent:true, sizeAttenuation:true, depthWrite:false,
          }));
          sprite.scale.set(isDebris?0.22:0.30, isDebris?0.22:0.30, 1);
          sprite.position.copy(pos);
          sprite.userData = {
            isOrbital:   true,
            isDebris,
            name:        obj.name,
            norad_id:    obj.norad_id,
            type:        obj.type,
            alt:         obj.altitude?.toFixed(1),
            vel:         obj.velocity_magnitude?.toFixed(3),
            confidence:  obj.confidence,
            debris_prob: obj.debris_prob,
            ecc:         obj.eccentricity?.toFixed(6),
            inc:         (obj.inclination*180/Math.PI)?.toFixed(2),
            period:      (obj.orbital_period/60)?.toFixed(1),
            sma:         obj.semi_major_axis?.toFixed(1),
            perigee:     obj.perigee?.toFixed(1),
            apogee:      obj.apogee?.toFixed(1),
          };
          scene.add(sprite);
          hoverList.push(sprite);
          const vel  = eciToThree(obj.vx, obj.vy, obj.vz);
          const axis = new THREE.Vector3().crossVectors(pos, vel).normalize();
          orbitMeshes.push({ mesh:sprite, axis, speed:vel.length()/rad*0.013, r:rad });
        });
      }

      // ── Raycaster ─────────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      raycaster.params.Sprite = { threshold: 0.18 };
      const mouse = new THREE.Vector2(-9999,-9999);
      const onMouseMove = e => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x =  ((e.clientX-rect.left)/rect.width)*2-1;
        mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(hoverList, false);
        setTooltip(hits.length>0 ? { ...hits[0].object.userData, mx:e.clientX, my:e.clientY } : null);
      };
      renderer.domElement.addEventListener('mousemove', onMouseMove);

      // ── Drag & zoom ───────────────────────────────────────────────────────
      const drag = { active:false, px:0, py:0 };
      let rotY=0.3, rotX=0.15, autoRot=0;
      renderer.domElement.addEventListener('mousedown', e=>{ drag.active=true; drag.px=e.clientX; drag.py=e.clientY; });
      const onUp   = ()=>{ drag.active=false; };
      const onDrag = e=>{ if(!drag.active)return; rotY+=(e.clientX-drag.px)*0.005; drag.px=e.clientX; rotX+=(e.clientY-drag.py)*0.005; drag.py=e.clientY; rotX=Math.max(-1.3,Math.min(1.3,rotX)); };
      window.addEventListener('mouseup',   onUp);
      window.addEventListener('mousemove', onDrag);
      renderer.domElement.addEventListener('wheel', e=>{ zoomRef.current=Math.max(6,Math.min(60,zoomRef.current+e.deltaY*0.02)); },{ passive:true });

      // ── Fetch live data ────────────────────────────────────────────────────
      let sc=0, dc=0;
      Promise.allSettled(['stations','cosmos_1408','fengyun_1c','iridium_33','cosmos_2251'].map(s=>fetchLive(s,300))).then(res=>{
        if(!mounted) return;
        res.forEach(r=>{ if(r.status!=='fulfilled')return; const o=r.value.data.objects||[]; addObjects(o); sc+=o.filter(x=>x.label===0).length; dc+=o.filter(x=>x.label===1).length; });
        setCounts({ sats:sc, debris:dc });
        setStatus('');
      });

      // ── Animation ─────────────────────────────────────────────────────────
      const quat = new THREE.Quaternion();
      const animate = () => {
        animRaf = requestAnimationFrame(animate);
        if(!drag.active) autoRot+=0.0007;
        earth.rotation.y  +=0.0004;
        clouds.rotation.y +=0.0006;
        moonAngle+=0.002;
        moon.position.set(Math.cos(moonAngle)*EARTH_R*8, Math.sin(moonAngle*0.3)*EARTH_R*1.5, Math.sin(moonAngle)*EARTH_R*8);
        moon.rotation.y+=0.001;
        orbitMeshes.forEach(({mesh,axis,speed,r})=>{ quat.setFromAxisAngle(axis,speed); mesh.position.applyQuaternion(quat); mesh.position.setLength(r); });
        const ry=rotY+autoRot, z=zoomRef.current;
        camera.position.set(z*Math.sin(ry)*Math.cos(rotX), z*Math.sin(rotX), z*Math.cos(ry)*Math.cos(rotX));
        camera.lookAt(0,0,0);
        renderer.render(scene, camera);
      };
      animate();

      const onResize=()=>{ const w=el.offsetWidth,h=el.offsetHeight||window.innerHeight-56; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); };
      window.addEventListener('resize', onResize);

      initRaf=()=>{ cancelAnimationFrame(animRaf); window.removeEventListener('resize',onResize); window.removeEventListener('mouseup',onUp); window.removeEventListener('mousemove',onDrag); renderer.domElement.removeEventListener('mousemove',onMouseMove); renderer.dispose(); if(el.contains(renderer.domElement))el.removeChild(renderer.domElement); };
    });

    return ()=>{ mounted=false; if(typeof initRaf==='function')initRaf(); else cancelAnimationFrame(initRaf); };
  }, []);

  const zoom = dir => { zoomRef.current=Math.max(6,Math.min(60,zoomRef.current+dir*2.5)); };

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#020509', overflow:'hidden' }}>
      <div ref={mountRef} style={{ width:'100%', height:'100%', cursor:'grab' }} />

      <div style={{ position:'absolute', top:16, left:20, pointerEvents:'none' }}>
        <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#c9d1d9' }}>🛰 ORBIT-TRUST</div>
        <div style={{ fontSize:'0.68rem', color:'#8b949e', marginTop:2 }}>Real-time NASA/NORAD · SGP4 · Live orbital positions</div>
      </div>

      <div style={{ position:'absolute', top:16, right:20, display:'flex', flexDirection:'column', gap:6, pointerEvents:'none' }}>
        <div style={{ background:'rgba(63,185,80,0.07)', border:'1px solid rgba(63,185,80,0.2)', borderRadius:6, padding:'7px 12px', textAlign:'right' }}>
          <div style={{ fontSize:'1.2rem', fontWeight:700, color:'#3fb950' }}>{counts.sats}</div>
          <div style={{ fontSize:'0.62rem', color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.4px' }}>Active Satellites</div>
        </div>
        <div style={{ background:'rgba(248,81,73,0.07)', border:'1px solid rgba(248,81,73,0.2)', borderRadius:6, padding:'7px 12px', textAlign:'right' }}>
          <div style={{ fontSize:'1.2rem', fontWeight:700, color:'#f85149' }}>{counts.debris}</div>
          <div style={{ fontSize:'0.62rem', color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.4px' }}>Debris Objects</div>
        </div>
        {status && (
          <div style={{ background:'rgba(88,166,255,0.06)', border:'1px solid rgba(88,166,255,0.15)', borderRadius:6, padding:'5px 10px', textAlign:'right' }}>
            <div style={{ fontSize:'0.66rem', color:'#58a6ff', fontStyle:'italic' }}>{status}</div>
          </div>
        )}
      </div>

      <div style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:5 }}>
        {[{label:'+',dir:-1},{label:'−',dir:1}].map(({label,dir})=>(
          <button key={label} onClick={()=>zoom(dir)} style={{ width:34,height:34,borderRadius:6,background:'rgba(2,5,9,0.9)',border:'1px solid #30363d',color:'#8b949e',fontSize:'1rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}
            onMouseEnter={e=>{e.currentTarget.style.color='#c9d1d9';e.currentTarget.style.borderColor='#58a6ff';}}
            onMouseLeave={e=>{e.currentTarget.style.color='#8b949e';e.currentTarget.style.borderColor='#30363d';}}
          >{label}</button>
        ))}
        <button onClick={()=>{zoomRef.current=20;}} style={{ width:34,height:34,borderRadius:6,background:'rgba(2,5,9,0.9)',border:'1px solid #30363d',color:'#8b949e',fontSize:'0.55rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}
          onMouseEnter={e=>e.currentTarget.style.color='#c9d1d9'} onMouseLeave={e=>e.currentTarget.style.color='#8b949e'}
        >RST</button>
      </div>

      <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', gap:16, background:'rgba(2,5,9,0.88)', border:'1px solid #1e2530', borderRadius:8, padding:'6px 16px', pointerEvents:'none', backdropFilter:'blur(10px)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:'0.72rem', color:'#8b949e' }}><span style={{ color:'#3fb950', marginRight:4 }}>🛰</span>Active Satellite</span>
        <span style={{ fontSize:'0.72rem', color:'#8b949e' }}><span style={{ color:'#f85149', marginRight:4 }}>💥</span>Space Debris</span>
        <span style={{ fontSize:'0.72rem', color:'#6e7681' }}>Drag · Scroll to zoom · Hover to inspect</span>
      </div>

      {tooltip && (
        <div style={{
          position:'fixed',
          left:Math.min(tooltip.mx+16, window.innerWidth-270),
          top: Math.max(tooltip.my-10, 10),
          width:258,
          background:'rgba(2,5,9,0.97)',
          border:`1px solid ${tooltip.isDebris?'rgba(248,81,73,0.45)':'rgba(63,185,80,0.45)'}`,
          borderRadius:10, padding:'12px 14px',
          pointerEvents:'none', zIndex:9999,
          boxShadow:`0 8px 40px rgba(0,0,0,0.7), 0 0 18px ${tooltip.isDebris?'rgba(248,81,73,0.12)':'rgba(63,185,80,0.12)'}`,
          backdropFilter:'blur(8px)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, borderBottom:'1px solid #1e2530', paddingBottom:8 }}>
            <span style={{ fontSize:'1.3rem' }}>{tooltip.isDebris?'💥':'🛰'}</span>
            <div>
              <div style={{ fontWeight:700, color:'#e6edf3', fontSize:'0.82rem', lineHeight:1.2 }}>{tooltip.name}</div>
              <div style={{ fontSize:'0.62rem', color:tooltip.isDebris?'#f85149':'#3fb950', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:2 }}>{tooltip.type}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', marginBottom:10 }}>
            {[
              ['NORAD ID',      tooltip.norad_id],
              ['Altitude',      `${tooltip.alt} km`],
              ['Velocity',      `${tooltip.vel} km/s`],
              ['Orbital Period',`${tooltip.period} min`],
              ['Inclination',   `${tooltip.inc}°`],
              ['Eccentricity',  tooltip.ecc],
              ['Semi-Major Axis',`${tooltip.sma} km`],
              ['Perigee',       `${tooltip.perigee} km`],
              ['Apogee',        `${tooltip.apogee} km`],
              ['Debris Prob',   `${tooltip.debris_prob}%`],
              ['Confidence',    `${tooltip.confidence}%`],
            ].map(([k,v])=>(
              <div key={k}>
                <div style={{ fontSize:'0.54rem', color:'#6e7681', textTransform:'uppercase', letterSpacing:0.5 }}>{k}</div>
                <div style={{ fontSize:'0.74rem', color:'#c9d1d9', fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop:'1px solid #1e2530', paddingTop:8 }}>
            <div style={{ fontSize:'0.54rem', color:'#6e7681', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 }}>Debris Probability</div>
            <div style={{ background:'#1e2530', borderRadius:4, height:6, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:4, width:`${tooltip.debris_prob}%`, background:tooltip.debris_prob>70?'#f85149':tooltip.debris_prob>30?'#d29922':'#3fb950', transition:'width 0.3s' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
              <span style={{ fontSize:'0.54rem', color:'#3fb950' }}>Safe</span>
              <span style={{ fontSize:'0.54rem', color:'#d29922' }}>Medium</span>
              <span style={{ fontSize:'0.54rem', color:'#f85149' }}>High Risk</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
