import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchLive } from '../api';

const SCALE   = 1 / 1500;
const EARTH_R = 6371 * SCALE;

function eciToThree(x, y, z) {
  return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
}

// ── Sprite canvas helpers ────────────────────────────────────────────────────

function makeSatelliteSprite() {
  const C = 128, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  // glow
  const g = ctx.createRadialGradient(C/2,C/2,4,C/2,C/2,C/2);
  g.addColorStop(0,  'rgba(63,255,120,1)');
  g.addColorStop(0.3,'rgba(63,220,100,0.8)');
  g.addColorStop(1,  'rgba(63,185,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
  // body
  ctx.fillStyle = '#c9d1d9';
  ctx.fillRect(C/2-5, C/2-3, 10, 6);
  // solar panels
  ctx.fillStyle = '#58a6ff';
  ctx.fillRect(C/2-18, C/2-2, 10, 4);
  ctx.fillRect(C/2+8,  C/2-2, 10, 4);
  // antenna
  ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(C/2, C/2-3); ctx.lineTo(C/2, C/2-10); ctx.stroke();
  return new THREE.CanvasTexture(cv);
}

function makeDebrisSprite() {
  const C = 128, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  // glow
  const g = ctx.createRadialGradient(C/2,C/2,3,C/2,C/2,C/2);
  g.addColorStop(0,  'rgba(255,80,60,1)');
  g.addColorStop(0.35,'rgba(220,60,40,0.7)');
  g.addColorStop(1,  'rgba(248,81,73,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
  // jagged rock shape
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  const pts = [[0,-8],[5,-3],[9,-6],[7,1],[10,5],[4,4],[2,9],[-3,6],[-8,8],[-6,2],[-10,-1],[-5,-4]];
  ctx.moveTo(C/2+pts[0][0], C/2+pts[0][1]);
  pts.slice(1).forEach(([x,y]) => ctx.lineTo(C/2+x, C/2+y));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(C/2+2, C/2-1, 2.5, 0, Math.PI*2); ctx.fill();
  return new THREE.CanvasTexture(cv);
}

// ── Solar system planet builder ──────────────────────────────────────────────

function makePlanetTexture(color1, color2, bands = false, spots = false) {
  const C = 256, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0,0,C,C);
  g.addColorStop(0, color1); g.addColorStop(1, color2);
  ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
  if (bands) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random()*0.1})`;
      ctx.fillRect(0, i*(C/8), C, C/16);
    }
  }
  if (spots) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,255,255,0.06)`;
      ctx.beginPath();
      ctx.ellipse(Math.random()*C, Math.random()*C, 20+Math.random()*30, 8+Math.random()*12, Math.random()*Math.PI, 0, Math.PI*2);
      ctx.fill();
    }
  }
  return new THREE.CanvasTexture(cv);
}

function makeSunTexture() {
  const C = 256, cv = document.createElement('canvas');
  cv.width = C; cv.height = C;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(C/2,C/2,10,C/2,C/2,C/2);
  g.addColorStop(0,   '#fff7a0');
  g.addColorStop(0.3, '#ffdd00');
  g.addColorStop(0.7, '#ff8800');
  g.addColorStop(1,   '#cc4400');
  ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,200,0,${0.03+Math.random()*0.07})`;
    ctx.beginPath();
    ctx.ellipse(C/2+(-0.5+Math.random())*C*0.7, C/2+(-0.5+Math.random())*C*0.7,
      10+Math.random()*30, 4+Math.random()*10, Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(cv);
}

function makeSaturnRingTexture() {
  const W = 512, H = 64, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0,0,W,0);
  g.addColorStop(0,    'rgba(210,180,120,0)');
  g.addColorStop(0.15, 'rgba(210,180,120,0.6)');
  g.addColorStop(0.4,  'rgba(180,150,90,0.4)');
  g.addColorStop(0.6,  'rgba(210,180,120,0.7)');
  g.addColorStop(0.85, 'rgba(180,150,90,0.3)');
  g.addColorStop(1,    'rgba(210,180,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  return new THREE.CanvasTexture(cv);
}

// ── Planet definitions ───────────────────────────────────────────────────────
const PLANETS = [
  { name:'Mercury', r:0.6,  dist:55,  speed:0.0041, color1:'#b5b5b5', color2:'#888', bands:false, spots:false },
  { name:'Venus',   r:1.1,  dist:80,  speed:0.0016, color1:'#e8c97a', color2:'#c8a050', bands:false, spots:true  },
  { name:'Mars',    r:0.8,  dist:130, speed:0.0009, color1:'#c1440e', color2:'#8b2500', bands:false, spots:true  },
  { name:'Jupiter', r:4.5,  dist:210, speed:0.0004, color1:'#c88b3a', color2:'#a0522d', bands:true,  spots:true  },
  { name:'Saturn',  r:3.8,  dist:290, speed:0.00018,color1:'#e4d191', color2:'#c8a84b', bands:true,  spots:false, rings:true },
  { name:'Uranus',  r:2.5,  dist:370, speed:0.00006,color1:'#7de8e8', color2:'#4fc3c3', bands:false, spots:false },
  { name:'Neptune', r:2.3,  dist:440, speed:0.00003,color1:'#3f54ba', color2:'#1a237e', bands:false, spots:true  },
];

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
    let mounted  = true;

    initRaf = requestAnimationFrame(() => {
      if (!mounted) return;
      const el = mountRef.current;
      if (!el) return;

      const W = el.offsetWidth  || window.innerWidth;
      const H = el.offsetHeight || (window.innerHeight - 56);

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
      catch(e) { console.error('WebGL failed:', e); return; }

      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      el.appendChild(renderer.domElement);

      const scene  = new THREE.Scene();
      scene.background = new THREE.Color(0x020408);
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 2000);
      camera.position.set(0, 3, 20);

      // ── Stars ──────────────────────────────────────────────────────────────
      [10000, 3000].forEach((n, li) => {
        const verts = [];
        for (let i = 0; i < n; i++) {
          const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
          const rad = li===0 ? 600+Math.random()*200 : 300+Math.random()*100;
          verts.push(rad*Math.sin(ph)*Math.cos(th), rad*Math.sin(ph)*Math.sin(th), rad*Math.cos(ph));
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
          color: li===0 ? 0xffffff : 0xaaddff,
          size:  li===0 ? 0.5 : 1.0,
          transparent: true, opacity: li===0 ? 0.6 : 0.9,
        })));
      });

      // ── Sun (far background) ───────────────────────────────────────────────
      const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(18, 32, 32),
        new THREE.MeshBasicMaterial({ map: makeSunTexture() })
      );
      sunMesh.position.set(350, 60, -400);
      scene.add(sunMesh);
      // sun glow
      const sunGlow = new THREE.Mesh(
        new THREE.SphereGeometry(22, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.08, side: THREE.BackSide })
      );
      sunGlow.position.copy(sunMesh.position);
      scene.add(sunGlow);

      // ── Solar system planets ───────────────────────────────────────────────
      const planetMeshes = PLANETS.map(p => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(p.r, 32, 32),
          new THREE.MeshPhongMaterial({ map: makePlanetTexture(p.color1, p.color2, p.bands, p.spots) })
        );
        mesh.position.set(p.dist, 0, 0);
        scene.add(mesh);

        if (p.rings) {
          const ringGeo = new THREE.RingGeometry(p.r * 1.4, p.r * 2.4, 64);
          const ringMat = new THREE.MeshBasicMaterial({
            map: makeSaturnRingTexture(), side: THREE.DoubleSide, transparent: true, opacity: 0.85,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 3;
          mesh.add(ring);
        }

        // orbit path
        const orbitPts = [];
        for (let i = 0; i <= 128; i++) {
          const a = (i / 128) * Math.PI * 2;
          orbitPts.push(new THREE.Vector3(Math.cos(a)*p.dist, 0, Math.sin(a)*p.dist));
        }
        const orbitLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(orbitPts),
          new THREE.LineBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.3 })
        );
        scene.add(orbitLine);

        return { mesh, ...p, angle: Math.random() * Math.PI * 2 };
      });

      // ── Earth — real NASA Blue Marble texture ──────────────────────────────
      const texLoader = new THREE.TextureLoader();
      const earthMat  = new THREE.MeshPhongMaterial({
        specular: new THREE.Color(0x112255), shininess: 25,
      });
      texLoader.load(
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        tex => { earthMat.map = tex; earthMat.needsUpdate = true; },
        undefined,
        () => {
          // fallback: procedural blue marble
          const C = 1024, cv = document.createElement('canvas');
          cv.width = C; cv.height = C;
          const ctx = cv.getContext('2d');
          const g = ctx.createLinearGradient(0,0,0,C);
          g.addColorStop(0,'#040d1f'); g.addColorStop(0.5,'#071e45'); g.addColorStop(1,'#040d1f');
          ctx.fillStyle = g; ctx.fillRect(0,0,C,C);
          ctx.fillStyle = 'rgba(0,80,180,0.18)';
          for (let i=0;i<120;i++){
            ctx.beginPath();
            ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*40+5,Math.random()*14+3,Math.random()*Math.PI,0,Math.PI*2);
            ctx.fill();
          }
          const continents=[
            {pts:[[80,160],[200,140],[230,200],[210,280],[160,300],[90,260],[60,200]],c:'#1a6b2a'},
            {pts:[[170,290],[210,280],[220,380],[190,430],[155,400],[145,330]],c:'#1d7a30'},
            {pts:[[280,140],[380,120],[400,200],[370,280],[310,300],[270,240],[260,180]],c:'#1e7535'},
            {pts:[[380,280],[430,260],[450,340],[410,380],[370,350],[360,300]],c:'#1a6b2a'},
            {pts:[[400,120],[560,100],[600,180],[580,240],[500,260],[420,220],[390,160]],c:'#1d7a30'},
            {pts:[[560,200],[640,180],[680,240],[660,300],[600,310],[550,260]],c:'#1e7535'},
            {pts:[[620,280],[680,260],[700,320],[670,360],[630,340]],c:'#1a6b2a'},
          ];
          continents.forEach(({pts,c})=>{
            ctx.fillStyle=c; ctx.beginPath();
            ctx.moveTo(pts[0][0]*C/720,pts[0][1]*C/512);
            pts.slice(1).forEach(([x,y])=>ctx.lineTo(x*C/720,y*C/512));
            ctx.closePath(); ctx.fill();
          });
          earthMat.map = new THREE.CanvasTexture(cv);
          earthMat.needsUpdate = true;
        }
      );

      // cloud texture
      const cloudTex = (() => {
        const C=512, cv=document.createElement('canvas');
        cv.width=C; cv.height=C;
        const ctx=cv.getContext('2d');
        ctx.fillStyle='black'; ctx.fillRect(0,0,C,C);
        ctx.fillStyle='rgba(255,255,255,0.7)';
        for(let i=0;i<80;i++){
          ctx.beginPath();
          ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*60+10,Math.random()*20+4,Math.random()*Math.PI,0,Math.PI*2);
          ctx.fill();
        }
        const t=new THREE.CanvasTexture(cv);
        t.wrapS=t.wrapT=THREE.RepeatWrapping;
        return t;
      })();

      const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 64), earthMat);
      scene.add(earth);

      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.012, 32, 32),
        new THREE.MeshPhongMaterial({ alphaMap: cloudTex, transparent: true, opacity: 0.28, color: 0xffffff, depthWrite: false })
      );
      scene.add(clouds);

      // atmosphere
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.025,32,32), new THREE.MeshPhongMaterial({color:0x0033ff,transparent:true,opacity:0.05,side:THREE.FrontSide})));
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.08,32,32),  new THREE.MeshPhongMaterial({color:0x0055ff,transparent:true,opacity:0.03,side:THREE.BackSide})));

      // ── Lights ─────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x223355, 1.2));
      const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.8);
      sunLight.position.set(60, 20, 40);
      scene.add(sunLight);

      // ── Orbital object sprites ─────────────────────────────────────────────
      const satTex    = makeSatelliteSprite();
      const debrisTex = makeDebrisSprite();
      const meshes    = [];

      function addObjects(objs) {
        objs.forEach(obj => {
          const pos = eciToThree(obj.x, obj.y, obj.z);
          const rad = pos.length();
          if (rad < EARTH_R * 1.001 || rad > 80) return;
          const isDebris = obj.label === 1;

          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: isDebris ? debrisTex : satTex,
            transparent: true,
            sizeAttenuation: true,
            depthWrite: false,
          }));
          const sz = isDebris ? 0.22 : 0.30;
          sprite.scale.set(sz, sz, 1);
          sprite.position.copy(pos);
          sprite.userData = {
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
          scene.add(sprite);

          const vel  = eciToThree(obj.vx, obj.vy, obj.vz);
          const axis = new THREE.Vector3().crossVectors(pos, vel).normalize();
          const spd  = vel.length() / rad * 0.013;
          meshes.push({ mesh: sprite, axis, speed: spd, r: rad });
        });
      }

      // ── Raycaster (sprites) ────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      raycaster.params.Sprite = { threshold: 0.15 };
      const mouse = new THREE.Vector2(-9999, -9999);
      const onMouseMove = e => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes.map(m => m.mesh));
        setTooltip(hits.length > 0 ? { ...hits[0].object.userData, mx: e.clientX, my: e.clientY } : null);
      };
      renderer.domElement.addEventListener('mousemove', onMouseMove);

      // ── Drag rotation ──────────────────────────────────────────────────────
      const dragRef = { active: false, px: 0, py: 0 };
      let rotY = 0.3, rotX = 0.15, autoRot = 0;
      renderer.domElement.addEventListener('mousedown', e => { dragRef.active=true; dragRef.px=e.clientX; dragRef.py=e.clientY; });
      const onMouseUp  = () => { dragRef.active = false; };
      const onDragMove = e => {
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

      // ── Fetch live data ────────────────────────────────────────────────────
      const SOURCES = ['stations','cosmos_1408','fengyun_1c','iridium_33','cosmos_2251'];
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

      // ── Animation loop ─────────────────────────────────────────────────────
      const quat = new THREE.Quaternion();
      const animate = () => {
        animRaf = requestAnimationFrame(animate);
        if (!dragRef.active) autoRot += 0.0007;
        earth.rotation.y  += 0.0004;
        clouds.rotation.y += 0.0006;
        sunMesh.rotation.y += 0.0002;

        // orbit planets
        planetMeshes.forEach(p => {
          p.angle += p.speed;
          p.mesh.position.x = Math.cos(p.angle) * p.dist;
          p.mesh.position.z = Math.sin(p.angle) * p.dist;
          p.mesh.rotation.y += 0.003;
        });

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

      // ── Resize ─────────────────────────────────────────────────────────────
      const onResize = () => {
        const w = el.offsetWidth, h = el.offsetHeight || window.innerHeight - 56;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

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

  const zoom = dir => { zoomRef.current = Math.max(8, Math.min(60, zoomRef.current + dir * 2.5)); };

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#020408', overflow:'hidden' }}>
      <div ref={mountRef} style={{ width:'100%', height:'100%', cursor:'grab' }} />

      {/* Top-left label */}
      <div style={{ position:'absolute', top:16, left:20, pointerEvents:'none' }}>
        <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#c9d1d9' }}>🛰 ORBIT-TRUST</div>
        <div style={{ fontSize:'0.7rem', color:'#8b949e', marginTop:2 }}>Real-time NASA/NORAD · SGP4 · Live orbital positions</div>
      </div>

      {/* Top-right counters */}
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

      {/* Zoom controls */}
      <div style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:5 }}>
        {[{label:'+',dir:-1},{label:'−',dir:1}].map(({label,dir}) => (
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

      {/* Legend */}
      <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', gap:16, background:'rgba(2,4,8,0.85)', border:'1px solid #30363d', borderRadius:8, padding:'6px 16px', pointerEvents:'none', backdropFilter:'blur(10px)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:'0.73rem', color:'#8b949e' }}><span style={{ color:'#3fb950', marginRight:4 }}>🛰</span>Active Satellite</span>
        <span style={{ fontSize:'0.73rem', color:'#8b949e' }}><span style={{ color:'#f85149', marginRight:4 }}>💥</span>Space Debris</span>
        <span style={{ fontSize:'0.73rem', color:'#6e7681' }}>Drag · Scroll to zoom · Hover to inspect</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position:'fixed',
          left: Math.min(tooltip.mx+14, window.innerWidth-250),
          top:  Math.max(tooltip.my-10, 10),
          width:238,
          background:'rgba(2,4,8,0.97)',
          border:`1px solid ${tooltip.label===1?'rgba(248,81,73,0.4)':'rgba(63,185,80,0.4)'}`,
          borderRadius:8, padding:'11px 13px',
          pointerEvents:'none', zIndex:9999,
          boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8, borderBottom:'1px solid #21262d', paddingBottom:7 }}>
            <span style={{ fontSize:'1.2rem' }}>{tooltip.label===1?'💥':'🛰'}</span>
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
