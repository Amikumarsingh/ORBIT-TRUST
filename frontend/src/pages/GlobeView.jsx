import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchLive } from '../api';

const SCALE   = 1 / 1500;
const EARTH_R = 6371 * SCALE;
function eciToThree(x,y,z){ return new THREE.Vector3(x*SCALE,z*SCALE,y*SCALE); }

function makeSatTex(){
  const C=64,cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(C/2,C/2,2,C/2,C/2,C/2);
  g.addColorStop(0,'rgba(63,255,120,1)'); g.addColorStop(0.4,'rgba(63,200,90,0.6)'); g.addColorStop(1,'rgba(63,185,80,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='#dde5ee'; ctx.fillRect(C/2-4,C/2-2,8,5);
  ctx.fillStyle='#1a6fd4'; ctx.fillRect(C/2-14,C/2-1,9,3); ctx.fillRect(C/2+5,C/2-1,9,3);
  ctx.strokeStyle='#c9d1d9'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(C/2,C/2-2); ctx.lineTo(C/2,C/2-8); ctx.stroke();
  return new THREE.CanvasTexture(cv);
}

function makeDebrisTex(){
  const C=64,cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(C/2,C/2,2,C/2,C/2,C/2);
  g.addColorStop(0,'rgba(255,90,60,1)'); g.addColorStop(0.4,'rgba(220,60,40,0.5)'); g.addColorStop(1,'rgba(248,81,73,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='#9a9080'; ctx.beginPath();
  [[0,-7],[4,-3],[7,-5],[6,0],[9,3],[4,4],[2,8],[-2,6],[-7,7],[-5,1],[-8,0],[-4,-4]].forEach(([x,y],i)=>i===0?ctx.moveTo(C/2+x,C/2+y):ctx.lineTo(C/2+x,C/2+y));
  ctx.closePath(); ctx.fill();
  return new THREE.CanvasTexture(cv);
}

function makeCloudTex(){
  const C=256,cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d'); ctx.fillStyle='black'; ctx.fillRect(0,0,C,C);
  ctx.fillStyle='rgba(255,255,255,0.65)';
  for(let i=0;i<40;i++){ ctx.beginPath(); ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*40+6,Math.random()*14+2,Math.random()*Math.PI,0,Math.PI*2); ctx.fill(); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

function makePlanetTex(c1,c2,bands){
  const C=128,cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,C); g.addColorStop(0,c1); g.addColorStop(1,c2);
  ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
  if(bands) for(let i=0;i<6;i++){ ctx.fillStyle=`rgba(0,0,0,${0.06+Math.random()*0.08})`; ctx.fillRect(0,i*(C/6),C,C/12); }
  return new THREE.CanvasTexture(cv);
}

function makeSunTex(){
  const C=128,cv=document.createElement('canvas'); cv.width=C; cv.height=C;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(C/2,C/2,4,C/2,C/2,C/2);
  g.addColorStop(0,'#fff9c4'); g.addColorStop(0.3,'#ffee00'); g.addColorStop(0.7,'#ff8c00'); g.addColorStop(1,'#b22200');
  ctx.fillStyle=g; ctx.fillRect(0,0,C,C);
  return new THREE.CanvasTexture(cv);
}

function makeRingTex(rc){
  const W=256,H=24,cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');
  const g=ctx.createLinearGradient(0,0,W,0);
  g.addColorStop(0,`rgba(${rc},0)`); g.addColorStop(0.2,`rgba(${rc},0.7)`);
  g.addColorStop(0.5,`rgba(${rc},0.35)`); g.addColorStop(0.8,`rgba(${rc},0.7)`); g.addColorStop(1,`rgba(${rc},0)`);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  return new THREE.CanvasTexture(cv);
}

const PLANETS=[
  {name:'Mercury',r:0.5, dist:60, speed:0.0038, c1:'#b5b5b5',c2:'#888',   bands:false, info:{type:'Terrestrial Planet',diameter:'4,879 km',mass:'3.30×10²³ kg',distSun:'57.9M km',period:'88 days',moons:0,temp:'-180 to 430°C',gravity:'3.7 m/s²',desc:'Smallest planet. No atmosphere. Extreme temperature swings.'}},
  {name:'Venus',  r:0.9, dist:85, speed:0.0015, c1:'#e8c97a',c2:'#c8a050',bands:false, info:{type:'Terrestrial Planet',diameter:'12,104 km',mass:'4.87×10²⁴ kg',distSun:'108.2M km',period:'225 days',moons:0,temp:'462°C avg',gravity:'8.87 m/s²',desc:'Hottest planet. Runaway greenhouse effect. Rotates backwards.'}},
  {name:'Mars',   r:0.7, dist:120,speed:0.0008, c1:'#c1440e',c2:'#8b2500',bands:false, info:{type:'Terrestrial Planet',diameter:'6,779 km',mass:'6.39×10²³ kg',distSun:'227.9M km',period:'687 days',moons:2,temp:'-87 to -5°C',gravity:'3.72 m/s²',desc:'Home of Olympus Mons, tallest volcano in the solar system.'}},
  {name:'Jupiter',r:3.8, dist:195,speed:0.00035,c1:'#c88b3a',c2:'#a0522d',bands:true,  ring:false,info:{type:'Gas Giant',diameter:'139,820 km',mass:'1.90×10²⁷ kg',distSun:'778.5M km',period:'11.9 years',moons:95,temp:'-108°C',gravity:'24.79 m/s²',desc:'Largest planet. Great Red Spot storm raging 350+ years.'}},
  {name:'Saturn', r:3.2, dist:265,speed:0.00015,c1:'#e4d191',c2:'#c8a84b',bands:true,  ring:true,ri:1.45,ro:2.5,rc:'210,180,120',info:{type:'Gas Giant',diameter:'116,460 km',mass:'5.68×10²⁶ kg',distSun:'1.43B km',period:'29.5 years',moons:146,temp:'-138°C',gravity:'10.44 m/s²',desc:'Iconic ring system of ice and rock. Least dense planet.'}},
  {name:'Uranus', r:2.1, dist:335,speed:0.00005,c1:'#7de8e8',c2:'#4fc3c3',bands:false, ring:true,ri:1.3,ro:1.75,rc:'100,200,200',info:{type:'Ice Giant',diameter:'50,724 km',mass:'8.68×10²⁵ kg',distSun:'2.87B km',period:'84 years',moons:28,temp:'-195°C',gravity:'8.69 m/s²',desc:'Rotates on its side with 98° axial tilt.'}},
  {name:'Neptune',r:2.0, dist:400,speed:0.00002,c1:'#3f54ba',c2:'#1a237e',bands:false, info:{type:'Ice Giant',diameter:'49,244 km',mass:'1.02×10²⁶ kg',distSun:'4.50B km',period:'165 years',moons:16,temp:'-200°C',gravity:'11.15 m/s²',desc:'Strongest winds in the solar system — up to 2,100 km/h.'}},
  {name:'Pluto',  r:0.35,dist:450,speed:0.00001,c1:'#c8a882',c2:'#8b6a4a',bands:false, info:{type:'Dwarf Planet',diameter:'2,377 km',mass:'1.30×10²² kg',distSun:'5.91B km',period:'248 years',moons:5,temp:'-230°C',gravity:'0.62 m/s²',desc:'Heart-shaped nitrogen ice plain. Reclassified in 2006.'}},
];

const SUN_INFO={type:'G-type Main Sequence Star',diameter:'1,392,700 km',mass:'1.99×10³⁰ kg',distSun:'—',period:'—',moons:'8 planets',temp:'5,778 K surface',gravity:'274 m/s²',desc:'Contains 99.86% of solar system mass. Fuses 600M tons of hydrogen/second.'};
const PLANET_ICONS={Sun:'☀️',Mercury:'🪨',Venus:'🌫️',Mars:'🔴',Jupiter:'🟠',Saturn:'🪐',Uranus:'🔵',Neptune:'🌊',Pluto:'⚪'};

export default function GlobeView(){
  const mountRef=useRef(null), zoomRef=useRef(20);
  const [counts,setCounts]=useState({sats:0,debris:0});
  const [status,setStatus]=useState('Loading…');
  const [tooltip,setTooltip]=useState(null);

  useEffect(()=>{
    let animRaf=null,initRaf=null,renderer=null,mounted=true;

    initRaf=requestAnimationFrame(()=>{
      if(!mounted) return;
      const el=mountRef.current; if(!el) return;
      const W=el.offsetWidth||window.innerWidth, H=el.offsetHeight||(window.innerHeight-56);

      try{ renderer=new THREE.WebGLRenderer({antialias:true}); }
      catch(e){ console.error(e); return; }
      renderer.setSize(W,H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.1;
      el.appendChild(renderer.domElement);

      const scene=new THREE.Scene();
      scene.background=new THREE.Color(0x020509);
      const camera=new THREE.PerspectiveCamera(45,W/H,0.01,1500);
      camera.position.set(0,3,20);

      // Stars — reduced counts
      [[4000,350,0.45,0xffffff,0.55],[800,180,0.9,0xaaddff,0.75]].forEach(([n,rad,sz,col,op])=>{
        const v=[];
        for(let i=0;i<n;i++){
          const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=rad+Math.random()*80;
          v.push(r*Math.sin(ph)*Math.cos(th),r*Math.sin(ph)*Math.sin(th),r*Math.cos(ph));
        }
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
        scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:col,size:sz,transparent:true,opacity:op})));
      });

      // Milky Way band — 1500 points only
      const mwV=[];
      for(let i=0;i<1500;i++){
        const th=Math.random()*Math.PI*2,ph=(Math.random()-0.5)*0.15,r=280+Math.random()*50;
        mwV.push(r*Math.cos(ph)*Math.cos(th),r*Math.sin(ph),r*Math.cos(ph)*Math.sin(th));
      }
      const mwG=new THREE.BufferGeometry();
      mwG.setAttribute('position',new THREE.Float32BufferAttribute(mwV,3));
      scene.add(new THREE.Points(mwG,new THREE.PointsMaterial({color:0xccddff,size:0.55,transparent:true,opacity:0.15})));

      // Lights
      scene.add(new THREE.AmbientLight(0x223355,1.0));
      const sunLight=new THREE.DirectionalLight(0xfff8e8,2.8);
      sunLight.position.set(80,30,50); scene.add(sunLight);
      scene.add(new THREE.DirectionalLight(0x112244,0.4)).position.set(-80,-20,-50);

      // Earth
      const earthMat=new THREE.MeshPhongMaterial({specular:new THREE.Color(0x1a3a6a),shininess:35});
      const texLoader=new THREE.TextureLoader();
      texLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        t=>{earthMat.map=t;earthMat.needsUpdate=true;},undefined,
        ()=>{
          const C=512,cv=document.createElement('canvas');cv.width=C;cv.height=C;
          const ctx=cv.getContext('2d');
          const g=ctx.createLinearGradient(0,0,0,C);
          g.addColorStop(0,'#040d1f');g.addColorStop(0.5,'#071e45');g.addColorStop(1,'#040d1f');
          ctx.fillStyle=g;ctx.fillRect(0,0,C,C);
          ctx.fillStyle='rgba(0,80,180,0.18)';
          for(let i=0;i<60;i++){ctx.beginPath();ctx.ellipse(Math.random()*C,Math.random()*C,Math.random()*30+4,Math.random()*10+2,Math.random()*Math.PI,0,Math.PI*2);ctx.fill();}
          earthMat.map=new THREE.CanvasTexture(cv);earthMat.needsUpdate=true;
        }
      );
      const earth=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R,48,48),earthMat);
      scene.add(earth);

      const clouds=new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R*1.013,32,32),
        new THREE.MeshPhongMaterial({alphaMap:makeCloudTex(),transparent:true,opacity:0.28,color:0xffffff,depthWrite:false})
      );
      scene.add(clouds);
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.026,24,24),new THREE.MeshPhongMaterial({color:0x1144ff,transparent:true,opacity:0.055,side:THREE.FrontSide,depthWrite:false})));
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.10,24,24),new THREE.MeshPhongMaterial({color:0x0033cc,transparent:true,opacity:0.022,side:THREE.BackSide,depthWrite:false})));

      // Moon
      const moon=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*0.27,20,20),new THREE.MeshPhongMaterial({color:0xbbbbbb}));
      scene.add(moon); let moonAngle=0;

      // hoverList — planets + sun + orbital sprites
      const hoverList=[];

      // Sun
      const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(14,24,24),new THREE.MeshBasicMaterial({map:makeSunTex()}));
      sunMesh.position.set(220,40,-280); scene.add(sunMesh);
      sunMesh.userData={kind:'sun',name:'The Sun',info:SUN_INFO};
      hoverList.push(sunMesh);
      [1.15,1.4].forEach((s,i)=>{
        const g=new THREE.Mesh(new THREE.SphereGeometry(14*s,16,16),new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:0.05-i*0.015,side:THREE.BackSide}));
        g.position.copy(sunMesh.position); scene.add(g);
      });
      scene.add(Object.assign(new THREE.PointLight(0xfff5e0,0.5,800),{position:sunMesh.position}));

      // Planets
      const bgPlanets=PLANETS.map(p=>{
        const op=[];
        for(let i=0;i<=64;i++){const a=(i/64)*Math.PI*2;op.push(new THREE.Vector3(Math.cos(a)*p.dist,0,Math.sin(a)*p.dist));}
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(op),new THREE.LineBasicMaterial({color:0x1a2a3a,transparent:true,opacity:0.2})));
        const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.r,20,20),new THREE.MeshPhongMaterial({map:makePlanetTex(p.c1,p.c2,p.bands)}));
        mesh.position.set(p.dist,0,0);
        mesh.userData={kind:'planet',name:p.name,info:p.info};
        scene.add(mesh); hoverList.push(mesh);
        if(p.ring){
          const ring=new THREE.Mesh(new THREE.RingGeometry(p.r*p.ri,p.r*p.ro,48),new THREE.MeshBasicMaterial({map:makeRingTex(p.rc),side:THREE.DoubleSide,transparent:true,opacity:0.85}));
          ring.rotation.x=p.name==='Uranus'?Math.PI/2:Math.PI/3; mesh.add(ring);
        }
        if(p.name==='Jupiter'){
          const spot=new THREE.Mesh(new THREE.SphereGeometry(0.42,8,8),new THREE.MeshBasicMaterial({color:0xcc3300,transparent:true,opacity:0.6}));
          spot.position.set(p.r*0.95,-0.4,0); mesh.add(spot);
        }
        return {...p,mesh,angle:Math.random()*Math.PI*2};
      });

      // Asteroid belt — 600 points (was 2000)
      const abV=[],abC=[];
      for(let i=0;i<600;i++){
        const a=Math.random()*Math.PI*2,d=148+Math.random()*28,y=(Math.random()-0.5)*5;
        abV.push(Math.cos(a)*d,y,Math.sin(a)*d);
        const s=0.35+Math.random()*0.3; abC.push(s,s*0.9,s*0.8);
      }
      const abG=new THREE.BufferGeometry();
      abG.setAttribute('position',new THREE.Float32BufferAttribute(abV,3));
      abG.setAttribute('color',new THREE.Float32BufferAttribute(abC,3));
      scene.add(new THREE.Points(abG,new THREE.PointsMaterial({size:0.3,vertexColors:true,transparent:true,opacity:0.65})));

      // Kuiper belt — 500 points (was 1500)
      const kbV=[],kbC=[];
      for(let i=0;i<500;i++){
        const a=Math.random()*Math.PI*2,d=420+Math.random()*60,y=(Math.random()-0.5)*16;
        kbV.push(Math.cos(a)*d,y,Math.sin(a)*d);
        const s=0.3+Math.random()*0.2; kbC.push(s*0.8,s*0.9,s);
      }
      const kbG=new THREE.BufferGeometry();
      kbG.setAttribute('position',new THREE.Float32BufferAttribute(kbV,3));
      kbG.setAttribute('color',new THREE.Float32BufferAttribute(kbC,3));
      scene.add(new THREE.Points(kbG,new THREE.PointsMaterial({size:0.22,vertexColors:true,transparent:true,opacity:0.45})));

      // Comets — 3 simple heads + tails
      const comets=[[180,0.4],[260,0.7],[340,1.1]].map(([dist,inc],ci)=>{
        const head=new THREE.Mesh(new THREE.SphereGeometry(0.5,6,6),new THREE.MeshBasicMaterial({color:0xaaddff}));
        scene.add(head);
        const tail=new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(10+ci*3,0,0)]),
          new THREE.LineBasicMaterial({color:0x88ccff,transparent:true,opacity:0.4})
        );
        head.add(tail);
        return {head,dist,inc,angle:Math.random()*Math.PI*2,speed:0.00012-ci*0.00002};
      });

      // Orbital sprites
      const satTex=makeSatTex(), debrisTex=makeDebrisTex();
      const orbitMeshes=[];

      function addObjects(objs){
        objs.forEach(obj=>{
          const pos=eciToThree(obj.x,obj.y,obj.z), rad=pos.length();
          if(rad<EARTH_R*1.001||rad>80) return;
          const isDebris=obj.label===1;
          const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:isDebris?debrisTex:satTex,transparent:true,sizeAttenuation:true,depthWrite:false}));
          sp.scale.set(isDebris?0.22:0.28,isDebris?0.22:0.28,1);
          sp.position.copy(pos);
          sp.userData={kind:isDebris?'debris':'satellite',isDebris,name:obj.name,norad_id:obj.norad_id,type:obj.type,
            alt:obj.altitude?.toFixed(1),vel:obj.velocity_magnitude?.toFixed(3),
            confidence:obj.confidence,debris_prob:obj.debris_prob,
            ecc:obj.eccentricity?.toFixed(6),inc:(obj.inclination*180/Math.PI)?.toFixed(2),
            period:(obj.orbital_period/60)?.toFixed(1),sma:obj.semi_major_axis?.toFixed(1),
            perigee:obj.perigee?.toFixed(1),apogee:obj.apogee?.toFixed(1)};
          scene.add(sp); hoverList.push(sp);
          const vel=eciToThree(obj.vx,obj.vy,obj.vz);
          const axis=new THREE.Vector3().crossVectors(pos,vel).normalize();
          orbitMeshes.push({mesh:sp,axis,speed:vel.length()/rad*0.013,r:rad});
        });
      }

      // Raycaster
      const raycaster=new THREE.Raycaster();
      raycaster.params.Sprite={threshold:0.18};
      const mouse=new THREE.Vector2(-9999,-9999);
      const onMouseMove=e=>{
        const rect=renderer.domElement.getBoundingClientRect();
        mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
        mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
        raycaster.setFromCamera(mouse,camera);
        const hits=raycaster.intersectObjects(hoverList,false);
        setTooltip(hits.length>0?{...hits[0].object.userData,mx:e.clientX,my:e.clientY,_ts:Date.now()}:null);
      };
      renderer.domElement.addEventListener('mousemove',onMouseMove);

      // Drag & zoom
      const drag={active:false,px:0,py:0};
      let rotY=0.3,rotX=0.15,autoRot=0;
      renderer.domElement.addEventListener('mousedown',e=>{drag.active=true;drag.px=e.clientX;drag.py=e.clientY;});
      const onUp=()=>{drag.active=false;};
      const onDrag=e=>{if(!drag.active)return;rotY+=(e.clientX-drag.px)*0.005;drag.px=e.clientX;rotX+=(e.clientY-drag.py)*0.005;drag.py=e.clientY;rotX=Math.max(-1.3,Math.min(1.3,rotX));};
      window.addEventListener('mouseup',onUp);
      window.addEventListener('mousemove',onDrag);
      renderer.domElement.addEventListener('wheel',e=>{zoomRef.current=Math.max(6,Math.min(80,zoomRef.current+e.deltaY*0.02));},{passive:true});

      // Fetch live data — one source at a time, staggered
      let sc=0,dc=0;
      const sources=['stations','cosmos_1408','fengyun_1c','iridium_33','cosmos_2251'];
      let si=0;
      const fetchNext=()=>{
        if(!mounted||si>=sources.length){setCounts({sats:sc,debris:dc});setStatus('');return;}
        fetchLive(sources[si++],100).then(r=>{
          if(!mounted)return;
          const o=r.data.objects||[];
          addObjects(o);
          sc+=o.filter(x=>x.label===0).length;
          dc+=o.filter(x=>x.label===1).length;
          setStatus(`Loading source ${si}/${sources.length}…`);
          setTimeout(fetchNext,200);
        }).catch(()=>setTimeout(fetchNext,200));
      };
      fetchNext();

      // Animation
      const quat=new THREE.Quaternion();
      const animate=()=>{
        animRaf=requestAnimationFrame(animate);
        if(!drag.active) autoRot+=0.0007;
        earth.rotation.y+=0.0004; clouds.rotation.y+=0.0006;
        moonAngle+=0.002;
        moon.position.set(Math.cos(moonAngle)*EARTH_R*8,Math.sin(moonAngle*0.3)*EARTH_R*1.5,Math.sin(moonAngle)*EARTH_R*8);
        moon.rotation.y+=0.001;
        bgPlanets.forEach(p=>{p.angle+=p.speed;p.mesh.position.x=Math.cos(p.angle)*p.dist;p.mesh.position.z=Math.sin(p.angle)*p.dist;p.mesh.rotation.y+=0.002;});
        comets.forEach(c=>{c.angle+=c.speed;c.head.position.x=Math.cos(c.angle)*c.dist;c.head.position.z=Math.sin(c.angle)*c.dist;c.head.position.y=Math.sin(c.angle*2)*c.dist*c.inc*0.08;});
        sunMesh.rotation.y+=0.0002;
        orbitMeshes.forEach(({mesh,axis,speed,r})=>{quat.setFromAxisAngle(axis,speed);mesh.position.applyQuaternion(quat);mesh.position.setLength(r);});
        const ry=rotY+autoRot,z=zoomRef.current;
        camera.position.set(z*Math.sin(ry)*Math.cos(rotX),z*Math.sin(rotX),z*Math.cos(ry)*Math.cos(rotX));
        camera.lookAt(0,0,0);
        renderer.render(scene,camera);
      };
      animate();

      const onResize=()=>{const w=el.offsetWidth,h=el.offsetHeight||window.innerHeight-56;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);};
      window.addEventListener('resize',onResize);
      initRaf=()=>{cancelAnimationFrame(animRaf);window.removeEventListener('resize',onResize);window.removeEventListener('mouseup',onUp);window.removeEventListener('mousemove',onDrag);renderer.domElement.removeEventListener('mousemove',onMouseMove);renderer.dispose();if(el.contains(renderer.domElement))el.removeChild(renderer.domElement);};
    });

    return()=>{mounted=false;if(typeof initRaf==='function')initRaf();else cancelAnimationFrame(initRaf);};
  },[]);

  const zoom=dir=>{zoomRef.current=Math.max(6,Math.min(80,zoomRef.current+dir*2.5));};

  const renderTooltip=()=>{
    if(!tooltip) return null;
    const isPlanet=tooltip.kind==='planet'||tooltip.kind==='sun';
    const isDebris=tooltip.isDebris;
    const accent=isPlanet?(tooltip.kind==='sun'?'#ffcc00':'#58a6ff'):(isDebris?'#f85149':'#3fb950');
    const border=isPlanet?(tooltip.kind==='sun'?'rgba(255,200,0,0.5)':'rgba(88,166,255,0.45)'):(isDebris?'rgba(248,81,73,0.45)':'rgba(63,185,80,0.45)');
    const icon=isPlanet?(PLANET_ICONS[tooltip.name]||'🪐'):(isDebris?'💥':'🛰');
    const rows=isPlanet?[
      ['Type',tooltip.info?.type],['Diameter',tooltip.info?.diameter],['Mass',tooltip.info?.mass],
      ['Dist from Sun',tooltip.info?.distSun],['Orbital Period',tooltip.info?.period],
      ['Moons',tooltip.info?.moons],['Temperature',tooltip.info?.temp],['Gravity',tooltip.info?.gravity],
    ]:[
      ['NORAD ID',tooltip.norad_id],['Altitude',`${tooltip.alt} km`],['Velocity',`${tooltip.vel} km/s`],
      ['Period',`${tooltip.period} min`],['Inclination',`${tooltip.inc}°`],['Eccentricity',tooltip.ecc],
      ['Semi-Major Axis',`${tooltip.sma} km`],['Perigee',`${tooltip.perigee} km`],
      ['Apogee',`${tooltip.apogee} km`],['Debris Prob',`${tooltip.debris_prob}%`],['Confidence',`${tooltip.confidence}%`],
    ];
    return(
      <div key={tooltip._ts} style={{position:'fixed',left:Math.min(tooltip.mx+16,window.innerWidth-272),top:Math.max(tooltip.my-10,10),width:262,background:'rgba(2,5,9,0.97)',border:`1px solid ${border}`,borderRadius:10,padding:'12px 14px',pointerEvents:'none',zIndex:9999,boxShadow:`0 8px 40px rgba(0,0,0,0.8),0 0 22px ${border}`,backdropFilter:'blur(10px)',animation:'tfx 0.3s ease-out'}}>
        <style>{`@keyframes tfx{0%{opacity:0;transform:scale(0.88) translateY(6px)}45%{opacity:1;transform:scale(1.04) translateY(-2px)}75%{transform:scale(0.98)}100%{transform:scale(1) translateY(0)}}`}</style>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,borderBottom:'1px solid #1e2530',paddingBottom:8}}>
          <span style={{fontSize:'1.4rem'}}>{icon}</span>
          <div>
            <div style={{fontWeight:700,color:'#e6edf3',fontSize:'0.84rem',lineHeight:1.2}}>{tooltip.name}</div>
            <div style={{fontSize:'0.6rem',color:accent,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:2}}>{isPlanet?tooltip.info?.type:tooltip.type}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px',marginBottom:isPlanet?10:10}}>
          {rows.map(([k,v])=>(
            <div key={k}>
              <div style={{fontSize:'0.53rem',color:'#6e7681',textTransform:'uppercase',letterSpacing:0.5}}>{k}</div>
              <div style={{fontSize:'0.73rem',color:'#c9d1d9',fontWeight:600}}>{v??'—'}</div>
            </div>
          ))}
        </div>
        {isPlanet&&tooltip.info?.desc&&<div style={{borderTop:'1px solid #1e2530',paddingTop:8,fontSize:'0.69rem',color:'#8b949e',lineHeight:1.55}}>{tooltip.info.desc}</div>}
        {!isPlanet&&(
          <div style={{borderTop:'1px solid #1e2530',paddingTop:8}}>
            <div style={{fontSize:'0.53rem',color:'#6e7681',textTransform:'uppercase',letterSpacing:0.5,marginBottom:5}}>Debris Probability</div>
            <div style={{background:'#1e2530',borderRadius:4,height:6,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:4,width:`${tooltip.debris_prob}%`,background:tooltip.debris_prob>70?'#f85149':tooltip.debris_prob>30?'#d29922':'#3fb950',transition:'width 0.3s'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
              <span style={{fontSize:'0.53rem',color:'#3fb950'}}>Safe</span>
              <span style={{fontSize:'0.53rem',color:'#d29922'}}>Medium</span>
              <span style={{fontSize:'0.53rem',color:'#f85149'}}>High Risk</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return(
    <div style={{position:'relative',width:'100%',height:'100%',background:'#020509',overflow:'hidden'}}>
      <div ref={mountRef} style={{width:'100%',height:'100%',cursor:'grab'}}/>

      <div style={{position:'absolute',top:16,left:20,pointerEvents:'none'}}>
        <div style={{fontSize:'1.1rem',fontWeight:700,color:'#c9d1d9'}}>🛰 ORBIT-TRUST</div>
        <div style={{fontSize:'0.67rem',color:'#8b949e',marginTop:2}}>Real-time NASA/NORAD · Full Solar System · Live orbital positions</div>
      </div>

      <div style={{position:'absolute',top:16,right:20,display:'flex',flexDirection:'column',gap:6,pointerEvents:'none'}}>
        <div style={{background:'rgba(63,185,80,0.07)',border:'1px solid rgba(63,185,80,0.2)',borderRadius:6,padding:'7px 12px',textAlign:'right'}}>
          <div style={{fontSize:'1.2rem',fontWeight:700,color:'#3fb950'}}>{counts.sats}</div>
          <div style={{fontSize:'0.62rem',color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.4px'}}>Active Satellites</div>
        </div>
        <div style={{background:'rgba(248,81,73,0.07)',border:'1px solid rgba(248,81,73,0.2)',borderRadius:6,padding:'7px 12px',textAlign:'right'}}>
          <div style={{fontSize:'1.2rem',fontWeight:700,color:'#f85149'}}>{counts.debris}</div>
          <div style={{fontSize:'0.62rem',color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.4px'}}>Debris Objects</div>
        </div>
        {status&&<div style={{background:'rgba(88,166,255,0.06)',border:'1px solid rgba(88,166,255,0.15)',borderRadius:6,padding:'5px 10px',textAlign:'right'}}><div style={{fontSize:'0.65rem',color:'#58a6ff',fontStyle:'italic'}}>{status}</div></div>}
      </div>

      <div style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:5}}>
        {[{label:'+',dir:-1},{label:'−',dir:1}].map(({label,dir})=>(
          <button key={label} onClick={()=>zoom(dir)} style={{width:34,height:34,borderRadius:6,background:'rgba(2,5,9,0.9)',border:'1px solid #30363d',color:'#8b949e',fontSize:'1rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.color='#c9d1d9';e.currentTarget.style.borderColor='#58a6ff';}}
            onMouseLeave={e=>{e.currentTarget.style.color='#8b949e';e.currentTarget.style.borderColor='#30363d';}}
          >{label}</button>
        ))}
        <button onClick={()=>{zoomRef.current=20;}} style={{width:34,height:34,borderRadius:6,background:'rgba(2,5,9,0.9)',border:'1px solid #30363d',color:'#8b949e',fontSize:'0.55rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>e.currentTarget.style.color='#c9d1d9'} onMouseLeave={e=>e.currentTarget.style.color='#8b949e'}
        >RST</button>
      </div>

      <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',display:'flex',gap:14,background:'rgba(2,5,9,0.88)',border:'1px solid #1e2530',borderRadius:8,padding:'6px 16px',pointerEvents:'none',backdropFilter:'blur(10px)',whiteSpace:'nowrap'}}>
        <span style={{fontSize:'0.7rem',color:'#8b949e'}}><span style={{color:'#3fb950',marginRight:3}}>🛰</span>Satellite</span>
        <span style={{fontSize:'0.7rem',color:'#8b949e'}}><span style={{color:'#f85149',marginRight:3}}>💥</span>Debris</span>
        <span style={{fontSize:'0.7rem',color:'#8b949e'}}><span style={{marginRight:3}}>🪐</span>Planet</span>
        <span style={{fontSize:'0.7rem',color:'#6e7681'}}>Drag · Scroll · Hover</span>
      </div>

      {renderTooltip()}
    </div>
  );
}
