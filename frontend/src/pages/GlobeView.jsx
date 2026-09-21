import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchLive } from '../api';

const SCALE   = 1 / 1500;
const EARTH_R = 6371 * SCALE;

function eciToThree(x, y, z) {
  return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
}

function buildEarthTexture() {
  const C = 1024, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, C);
  g.addColorStop(0, '#040d1f'); g.addColorStop(0.5, '#071e45'); g.addColorStop(1, '#040d1f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, C, C);
  ctx.fillStyle = 'rgba(0,80,180,0.15)';
  for (let i = 0; i < 120; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random()*C, Math.random()*C, Math.random()*40+5, Math.random()*14+3, Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  const continents = [
    { pts:[[80,160],[200,140],[230,200],[210,280],[160,300],[90,260],[60,200]], c:'#1a6b2a' },
    { pts:[[170,290],[210,280],[220,380],[190,430],[155,400],[145,330]],       c:'#1d7a30' },
    { pts:[[280,140],[380,120],[400,200],[370,280],[310,300],[270,240],[260,180]], c:'#1e7535' },
    { pts:[[380,280],[430,260],[450,340],[410,380],[370,350],[360,300]],       c:'#1a6b2a' },
    { pts:[[400,120],[560,100],[600,180],[580,240],[500,260],[420,220],[390,160]], c:'#1d7a30' },
    { pts:[[560,200],[640,180],[680,240],[660,300],[600,310],[550,260]],       c:'#1e7535' },
    { pts:[[620,280],[680,260],[700,320],[670,360],[630,340]],                 c:'#1a6b2a' },
  ];
  continents.forEach(({ pts, c }) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(pts[0][0]*C/720, pts[0][1]*C/512);
    pts.slice(1).forEach(([x,y]) => ctx.lineTo(x*C/720, y*C/512));
    ctx.closePath(); ctx.fill();
  });
  ctx.strokeStyle = 'rgba(0,180,255,0.05)'; ctx.lineWidth = 1;
  for (let i=0;i<=12;i++){ctx.beginPath();ctx.moveTo(i*C/12,0);ctx.lineTo(i*C/12,C);ctx.stroke();}
  for (let i=0;i<=6;i++){ctx.beginPath();ctx.moveTo(0,i*C/6);ctx.lineTo(C,i*C/6);ctx.stroke();}
  return new THREE.CanvasTexture(cv);
}

function buildCloudTexture() {
  const C = 512, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'black'; ctx.fillRect(0,0,C,C);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i=0;i<80;i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random()*C, Math.random()*C, Math.random()*60+10, Math.random()*20+4, Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export default function GlobeView() {
  const mountRef = useRef(null);
  const zoomRef  = useRef(20);
  const [counts,  setCounts]  = useState({ sats: 0, debris: 0 });
  const [status,  setStatus]  = useState('Loading live orbital data…');
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    let animRaf = null;
    let initRaf = null;
    let renderer = null;
    let mounted = true;

    initRaf = requestAnimationFrame(() => {
      if (!mounted) return;
      const el = mountRef.current;
      if (!el) return;

      const W = el.offsetWidth  || window.innerWidth;
      const H = el.offsetHeight || (window.innerHeight - 56);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch(e) {
        console.error('WebGL failed:', e);
        return;
      }

      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      el.appendChild(renderer.domElement);

      const scene  = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1117);
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 2000);
      camera.position.set(0, 3, 20);

      // Stars
      [8000, 2000].forEach((n, li) => {
        const v = [];
        for (let i = 0; i < n; i++) {
          const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
          const r  = li===0 ? 350+Math.random()*150 : 180+Math.random()*80;
          v.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph));
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        scene.add(new THREE.Points(g, new THREE.PointsMaterial({
          color: li===0 ? 0xffffff : 0xaaddff,
          size:  li===0 ? 0.4 : 0.8,
          transparent: true, opacity: li===0 ? 0.55 : 0.85,
        })));
      });

      // Earth
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R, 64, 64),
        new THREE.MeshPhongMaterial({ map: buildEarthTexture(), specular: new THREE.Color(0x112255), shininess: 20 })
      );
      scene.add(earth);

      // Clouds
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.012, 32, 32),
        new THREE.MeshPhongMaterial({ alphaMap: buildCloudTexture(), transparent: true, opacity: 0.28, color: 0xffffff, depthWrite: false })
      );
      scene.add(clouds);

      // Atmosphere
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.025,32,32), new THREE.MeshPhongMaterial({color:0x0033ff,transparent:true,opacity:0.05,side:THREE.FrontSide})));
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.08,32,32),  new THREE.MeshPhongMaterial({color:0x0055ff,transparent:true,opacity:0.03,side:THREE.BackSide})));

      // Lights
      scene.add(new THREE.AmbientLight(0x223355, 1.3));
      const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
      sun.position.set(60, 20, 40);
      scene.add(sun);

      // Orbital objects
      const meshes = [];
      const satMat    = new THREE.MeshBasicMaterial({ color: 0x3fb950 });
      const debrisMat = new THREE.MeshBasicMaterial({ color: 0xf85149 });

      function addObjects(objs) {
        objs.forEach(obj => {
          const pos = eciToThree(obj.x, obj.y, obj.z);
          const r   = pos.length();
          if (r < EARTH_R * 1.001 || r > 80) return;
          const isDebris = obj.label === 1;
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(isDebris ? 0.034 : 0.048, 5, 5),
            (isDebris ? debrisMat : satMat).clone()
          );
          mesh.position.copy(pos);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            color: isDebris ? 0xf85149 : 0x3fb950, transparent: true, opacity: 0.15, sizeAttenuation: true,
          }));
          sp.scale.set(isDebris ? 0.2 : 0.28, isDebris ? 0.2 : 0.28, 1);
          mesh.add(sp);
          mesh.userData = {
            name:        obj.name,
            norad_id:    obj.norad_id,
            type:        obj.type,
            label:       obj.label,
            alt:         obj.altitude?.toFixed(1),
            vel:         obj.velocity_magnitude?.toFixed(3),
            confidence:  obj.confidence,
            debris_prob: obj.debris_prob,
            ecc:         obj.eccentricity?.toFixed(6),
            inc:         (obj.inclination * 180 / Math.PI)?.toFixed(2),
            period:      (obj.orbital_period / 60)?.toFixed(1),
          };
          const vel   = eciToThree(obj.vx, obj.vy, obj.vz);
          const axis  = new THREE.Vector3().crossVectors(pos, vel).normalize();
          const speed = vel.length() / r * 0.013;
          meshes.push({ mesh, axis, speed, r });
          scene.add(mesh);
        });
      }

      // Raycaster for hover
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(-9999, -9999);
      const onMouseMove = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes.map(m => m.mesh));
        if (hits.length > 0) {
          setTooltip({ ...hits[0].object.userData, mx: e.clientX, my: e.clientY });
        } else {
          setTooltip(null);
        }
      };
      renderer.domElement.addEventListener('mousemove', onMouseMove);

      // Drag rotation — use ref so animate closure always sees current value
      const dragRef = { active: false, px: 0, py: 0 };
      let rotY = 0.3, rotX = 0.15, autoRot = 0;

      renderer.domElement.addEventListener('mousedown', e => { dragRef.active = true; dragRef.px = e.clientX; dragRef.py = e.clientY; });
      const onMouseUp  = () => { dragRef.active = false; };
      const onDragMove = (e) => {
        if (!dragRef.active) return;
        rotY += (e.clientX - dragRef.px) * 0.005; dragRef.px = e.clientX;
        rotX += (e.clientY - dragRef.py) * 0.005; dragRef.py = e.clientY;
        rotX = Math.max(-1.3, Math.min(1.3, rotX));
      };
      window.addEventListener('mouseup',   onMouseUp);
      window.addEventListener('mousemove', onDragMove);
      renderer.domElement.addEventListener('wheel', e => {
        zoomRef.current = Math.max(8, Math.min(60, zoomRef.current + e.deltaY * 0.02));
      }, { passive: true });

      // Fetch live data
      const SOURCES = ['stations', 'cosmos_1408', 'fengyun_1c', 'iridium_33', 'cosmos_2251'];
      let sc = 0, dc = 0;
      Promise.allSettled(SOURCES.map(s => fetchLive(s, 300))).then(results => {
        if (!mounted) return;
        results.forEach(res => {
          if (res.status !== 'fulfilled') return;
          const objs = res.value.data.objects || [];
          addObjects(objs);
          sc += objs.filter(o => o.label === 0).length;
          dc += objs.filter(o => o.label === 1).length;
        });
        setCounts({ sats: sc, debris: dc });
        setStatus('');
      });

      // Animation loop — single raf variable, no shadowing
      const quat = new THREE.Quaternion();
      const animate = () => {
        animRaf = requestAnimationFrame(animate);
        if (!dragRef.active) autoRot += 0.0007;
        earth.rotation.y  += 0.0004;
        clouds.rotation.y += 0.0006;
        const ry   = rotY + autoRot;
        const zoom = zoomRef.current;
        camera.position.x = zoom * Math.sin(ry) * Math.cos(rotX);
        camera.position.y = zoom * Math.sin(rotX);
        camera.position.z = zoom * Math.cos(ry) * Math.cos(rotX);
        camera.lookAt(0, 0, 0);
        meshes.forEach(({ mesh, axis, speed, r }) => {
          quat.setFromAxisAngle(axis, speed);
          mesh.position.applyQuaternion(quat);
          mesh.position.setLength(r);
        });
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const onResize = () => {
        const w = el.offsetWidth;
        const h = el.offsetHeight || window.innerHeight - 56;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      // Store cleanup
      initRaf = () => {
        cancelAnimationFrame(animRaf);
        window.removeEventListener('resize',    onResize);
        window.removeEventListener('mouseup',   onMouseUp);
        window.removeEventListener('mousemove', onDragMove);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.dispose();
        if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      };
    });

    return () => {
      mounted = false;
      if (typeof initRaf === 'function') initRaf();
      else cancelAnimationFrame(initRaf);
    };
  }, []);

  const zoom = (dir) => { zoomRef.current = Math.max(8, Math.min(60, zoomRef.current + dir * 2.5)); };

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#0d1117', overflow:'hidden' }}>
      <div ref={mountRef} style={{ width:'100%', height:'100%', cursor:'grab' }} />

      <div style={{ position:'absolute', top:16, left:20, pointerEvents:'none' }}>
        <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#c9d1d9' }}>🛰 ORBIT-TRUST</div>
        <div style={{ fontSize:'0.7rem', color:'#8b949e', marginTop:2 }}>Real-time NASA/NORAD · SGP4 · Live orbital positions</div>
      </div>

      <div style={{ position:'absolute', top:16, right:20, display:'flex', flexDirection:'column', gap:6, pointerEvents:'none' }}>
        <div style={{ background:'rgba(63,185,80,0.07)', border:'1px solid rgba(63,185,80,0.2)', borderRadius:6, padding:'7px 12px', textAlign:'right' }}>
          <div style={{ fontSize:'1.2rem', fontWeight:700, color:'#3fb950' }}>{counts.sats}</div>
          <div style={{ fontSize:'0.65rem', color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.4px' }}>Active Satellites</div>
        </div>
        <div style={{ background:'rgba(248,81,73,0.07)', border:'1px solid rgba(248,81,73,0.2)', borderRadius:6, padding:'7px 12px', textAlign:'right' }}>
          <div style={{ fontSize:'1.2rem', fontWeight:700, color:'#f85149' }}>{counts.debris}</div>
          <div style={{ fontSize:'0.65rem', color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.4px' }}>Debris Objects</div>
        </div>
        {status && (
          <div style={{ background:'rgba(88,166,255,0.06)', border:'1px solid rgba(88,166,255,0.15)', borderRadius:6, padding:'5px 10px', textAlign:'right' }}>
            <div style={{ fontSize:'0.68rem', color:'#58a6ff', fontStyle:'italic' }}>{status}</div>
          </div>
        )}
      </div>

      <div style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:5 }}>
        {[{label:'+', dir:-1},{label:'−', dir:1}].map(({label,dir}) => (
          <button key={label} onClick={() => zoom(dir)} style={{
            width:34, height:34, borderRadius:6,
            background:'rgba(13,17,23,0.88)', border:'1px solid #30363d',
            color:'#8b949e', fontSize:'1rem', fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
          onMouseEnter={e=>{e.currentTarget.style.color='#c9d1d9';e.currentTarget.style.borderColor='#58a6ff';}}
          onMouseLeave={e=>{e.currentTarget.style.color='#8b949e';e.currentTarget.style.borderColor='#30363d';}}
          >{label}</button>
        ))}
        <button onClick={() => { zoomRef.current = 20; }} style={{
          width:34, height:34, borderRadius:6,
          background:'rgba(13,17,23,0.88)', border:'1px solid #30363d',
          color:'#8b949e', fontSize:'0.58rem', fontWeight:700, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}
        onMouseEnter={e=>e.currentTarget.style.color='#c9d1d9'}
        onMouseLeave={e=>e.currentTarget.style.color='#8b949e'}
        >RST</button>
      </div>

      <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', gap:16, background:'rgba(13,17,23,0.82)', border:'1px solid #30363d', borderRadius:8, padding:'6px 16px', pointerEvents:'none', backdropFilter:'blur(10px)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:'0.73rem', color:'#8b949e' }}><span style={{ color:'#3fb950', marginRight:4 }}>●</span>Active Satellite</span>
        <span style={{ fontSize:'0.73rem', color:'#8b949e' }}><span style={{ color:'#f85149', marginRight:4 }}>●</span>Space Debris</span>
        <span style={{ fontSize:'0.73rem', color:'#6e7681' }}>Drag · Scroll to zoom · Hover to inspect</span>
      </div>

      {tooltip && (
        <div style={{
          position:'fixed',
          left: Math.min(tooltip.mx+14, window.innerWidth-250),
          top:  Math.max(tooltip.my-10, 10),
          width:238,
          background:'rgba(13,17,23,0.97)',
          border:`1px solid ${tooltip.label===1?'rgba(248,81,73,0.4)':'rgba(63,185,80,0.4)'}`,
          borderRadius:8, padding:'11px 13px',
          pointerEvents:'none', zIndex:9999,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8, borderBottom:'1px solid #21262d', paddingBottom:7 }}>
            <span>{tooltip.label===1?'🔴':'🟢'}</span>
            <div>
              <div style={{ fontWeight:700, color:'#c9d1d9', fontSize:'0.8rem' }}>{tooltip.name}</div>
              <div style={{ fontSize:'0.65rem', color:tooltip.label===1?'#f85149':'#3fb950', fontWeight:600 }}>{tooltip.type}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px' }}>
            {[
              ['NORAD ID',    tooltip.norad_id],
              ['Altitude',    `${tooltip.alt} km`],
              ['Velocity',    `${tooltip.vel} km/s`],
              ['Period',      `${tooltip.period} min`],
              ['Inclination', `${tooltip.inc}°`],
              ['Eccentricity',tooltip.ecc],
              ['Debris Prob', `${tooltip.debris_prob}%`],
              ['Confidence',  `${tooltip.confidence}%`],
            ].map(([k,v]) => (
              <div key={k}>
                <div style={{ fontSize:'0.57rem', color:'#6e7681', textTransform:'uppercase', letterSpacing:0.4 }}>{k}</div>
                <div style={{ fontSize:'0.76rem', color:'#c9d1d9', fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, borderTop:'1px solid #21262d', paddingTop:7 }}>
            <div style={{ fontSize:'0.57rem', color:'#6e7681', textTransform:'uppercase', letterSpacing:0.4, marginBottom:4 }}>Debris Probability</div>
            <div style={{ background:'#21262d', borderRadius:3, height:5, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:3, width:`${tooltip.debris_prob}%`, background: tooltip.debris_prob>70?'#f85149':tooltip.debris_prob>30?'#d29922':'#3fb950' }}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
