import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { furnishedSofa, contactShadows } from './interior-details.js';
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEfficientRenderer } from './lighting.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $=s=>document.querySelector(s), scene=new THREE.Scene();
scene.background=new THREE.Color('#e9e9df');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.5));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.0;
$('#scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.06,180);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=7;orbit.maxDistance=42;orbit.maxPolarAngle=Math.PI*.47;orbit.target.set(3.5,0,9.2);
// Neutral room fill approximates diffuse bounce without noisy lightmaps.
const hemi=new THREE.HemisphereLight(0xf5f3ee,0xd5cbbb,.7);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0da,3.6);sun.position.set(-12,8,2);sun.target.position.set(3,0,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:50});sun.shadow.normalBias=.008;sun.shadow.bias=-.000015;sun.shadow.radius=3;scene.add(sun,sun.target);
RectAreaLightUniformsLib.init();
const windowFill=new THREE.RectAreaLight(0xffeed9,4,1.5,1.5);
windowFill.position.set(.22,1.85,11.8);windowFill.lookAt(3.1,.8,10.5);scene.add(windowFill);
let physical=null,lightmapsReady=false;const bakedMeshes=[];
const home=new THREE.Group();scene.add(home);const ceiling=new THREE.Group();home.add(ceiling);

const collision=[],walls=[],roomLights=[],windowGroups=[],skyLights=[];
let mode='overview',night=false,yaw=0,pitch=0;let activePalette='sage';
const manager=new THREE.LoadingManager();let assetErrors=[];manager.onProgress=(u,n,total)=>$('#load-status').textContent=`載入真實材質 ${n} / ${total}`;manager.onError=u=>assetErrors.push(u);
const loader=new THREE.TextureLoader(manager);
let sky=null;new RGBELoader(manager).load('./assets/sky.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;sky=t;scene.environment=t;scene.environmentIntensity=.65;if(mode==='walk')scene.background=sky;});
function texture(file,rx=1,ry=1,color=false){const t=loader.load('./assets/textures/'+file+(file==='whitewashed-oak'?'.png':'.jpg'));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
const oakMap=texture('whitewashed-oak',1,1,true),oakBump=texture('pale-oak-normal'),oakRough=texture('pale-oak-rough');
const marbleMap=texture('marble',1,1,true),fabricNorm=texture('linen-normal',12,12),tileMap=texture('tile',1,1,true),tileNorm=texture('tile-normal');
const mat=(color,roughness=.7,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
const M={wall:mat('#dedbd3',.88),trim:mat('#e6e3d9'),wood:mat('#ffffff',.6,{map:oakMap}),darkWood:mat('#786046',.55,{map:oakMap}),stone:mat('#e7e3d8',.3,{roughnessMap:texture('marble-rough'),bumpMap:marbleMap,bumpScale:.001}),tile:mat('#c6c2b8',.75,{normalMap:tileNorm,normalScale:new THREE.Vector2(.035,.035)}),linen:mat('#d9d4c5',.95,{normalMap:fabricNorm,normalScale:new THREE.Vector2(.25,.25)}),whiteFabric:mat('#ddd9cf',1,{normalMap:fabricNorm,normalScale:new THREE.Vector2(.2,.2)}),sage:mat('#87947d',.93,{normalMap:fabricNorm}),clay:mat('#aa735b',.93,{normalMap:fabricNorm}),black:mat('#2b302d',.4),metal:mat('#9c9b90',.27,{metalness:.8}),brass:mat('#b8a275',.3,{metalness:.75}),ceramic:mat('#f8f5ed',.22),glass:new THREE.MeshPhysicalMaterial({color:0xf3faf8,roughness:.035,metalness:0,transmission:0,ior:1.45,thickness:0,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}),mirror:mat('#b3c8cc',.06,{metalness:.97}),light:mat('#fff5d9',.3,{emissive:0xffdfab,emissiveIntensity:2}),storage:mat('#b7bbaa',.78),storageWarm:mat('#d4cfc3',.75),soil:mat('#453e2c'),leaf:mat('#526a39',.7),screen:mat('#172127',.12,{metalness:.4})};
// Cloth responds softly at grazing angles; fine normal detail stays subtle.
for(const name of ['linen','whiteFabric','sage','clay']){
 const old=M[name];
 M[name]=new THREE.MeshPhysicalMaterial({color:old.color,roughness:.96,normalMap:fabricNorm,normalScale:new THREE.Vector2(.09,.09),sheen:.65,sheenColor:0xf1e7d7,sheenRoughness:.85});
}
M.seam=mat('#a99c85',1);
M.livingWall=mat('#657362',.95);
M.diningWall=mat('#c9bba5',.96);
M.bedroomWall=mat('#9b9f8c',.96);
M.ceiling=mat('#faf5e9',1);

function box(w,h,d,x,y,z,m=M.wall,r=0,parent=home){const mesh=new THREE.Mesh(r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cyl(rt,rb,h,x,y,z,m=M.wood,parent=home){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,24),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function ball(x,y,z,sx,sy,sz,m,parent=home){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function block(x1,z1,x2,z2){collision.push({x1,z1,x2,z2});}
function floor(x1,z1,x2,z2,m){box(x2-x1,.12,z2-z1,(x1+x2)/2,-.07,(z1+z2)/2,m);}
function plankFloor(x1,z1,x2,z2){
 // One pale grain field per full-length board, no parquet image repeated on every short block.
 floor(x1,z1,x2,z2,mat('#c9bfae'));
 const width=.22, gap=.0012;
 for(let x=x1;x<x2-.001;x+=width){const w=Math.min(width,x2-x);const plank=box(w-gap,.018,z2-z1-.002,x+w/2,.004,(z1+z2)/2,M.wood);
  const uv=plank.geometry.attributes.uv,position=plank.geometry.attributes.position;
  for(let i=0;i<uv.count;i++){uv.setXY(i,(x-x1+position.getX(i)+w/2)/1.15,(position.getZ(i)+(z2-z1)/2)/4.8);}
  uv.needsUpdate=true;
 }
}
function tileFloor(x1,z1,x2,z2,step=.8,m=M.stone){floor(x1,z1,x2,z2,M.trim);for(let x=x1;x<x2-.01;x+=step)for(let z=z1;z<z2-.01;z+=step){const w=Math.min(step,x2-x),d=Math.min(step,z2-z);box(w-.007,.016,d-.007,x+w/2,.002,z+d/2,m);}}
function wall(x1,z1,x2,z2,h=3.0,y=0,m=M.wall,collide=true){const dx=x2-x1,dz=z2-z1;const ob=box(Math.hypot(dx,dz),h,.12,(x1+x2)/2,y+h/2,(z1+z2)/2,m);ob.rotation.y=-Math.atan2(dz,dx);walls.push(ob);if(collide&&y<1.7)block(Math.min(x1,x2)-.06,Math.min(z1,z2)-.06,Math.max(x1,x2)+.06,Math.max(z1,z2)+.06);if(y===0){const base=box(Math.hypot(dx,dz),.085,.145,(x1+x2)/2,.045,(z1+z2)/2,M.trim);base.rotation.y=ob.rotation.y;}}
function xWall(x,z1,z2,openings=[]){let start=z1;for(const [a,b] of openings){if(a>start)wall(x,start,x,a);wall(x,a,x,b,.8,2.2,M.wall,false);start=b;}if(start<z2)wall(x,start,x,z2);}
function zWall(z,x1,x2,openings=[]){let start=x1;for(const [a,b] of openings){if(a>start)wall(start,z,a,z);wall(a,z,b,z,.8,2.2,M.wall,false);start=b;}if(start<x2)wall(start,z,x2,z);}
function windowWall(x,z,len,axis='z',sill=.65){const g=new THREE.Group();g.position.set(x,0,z);if(axis==='x')g.rotation.y=Math.PI/2;home.add(g);box(.14,sill,len,0,sill/2,0,M.wall,0,g);box(.14,.55,len,0,2.725,0,M.wall,0,g);box(.05,2.45-sill,len,0,(sill+2.45)/2,0,M.glass,0,g);for(const zz of [-len/2,0,len/2])box(.11,2.45-sill,.045,0,(sill+2.45)/2,zz,M.metal,0,g);for(const yy of [sill,2.45])box(.17,.055,len,0,yy,0,M.trim,0,g);for(const zz of [-len/2+.025,len/2-.025])box(.13,2.45-sill,.018,0,(sill+2.45)/2,zz,M.black,.003,g);box(.23,.035,len+.08,.035,sill-.022,0,M.stone,.008,g);block(x-(axis==='z'?.08:len/2),z-(axis==='z'?len/2:.08),x+(axis==='z'?.08:len/2),z+(axis==='z'?len/2:.08));windowGroups.push(g);}
function ceilingRect(x1,z1,x2,z2){box(x2-x1,.1,z2-z1,(x1+x2)/2,2.85,(z1+z2)/2,M.ceiling,0,ceiling);}
function downlight(x,z){roomLight(x,z);cyl(.07,.07,.018,x,2.788,z,M.brass,ceiling);cyl(.052,.052,.022,x,2.773,z,M.light,ceiling);}
function roomLight(x,z){
 const l=new THREE.SpotLight(0xffdcb1,0,0,Math.PI*.36,.8,2);l.position.set(x,2.94,z);l.target.position.set(x,0,z);l.shadow.mapSize.set(512,512);l.shadow.bias=-.0001;l.shadow.normalBias=.012;l.shadow.camera.near=.08;l.shadow.camera.far=8;home.add(l,l.target);roomLights.push(l);
}
// Plan coordinates in metres. Origin = upper-left corner of the left drawing.
tileFloor(0,3.2,7,13.9);tileFloor(3.4,0,5.15,3.2,.6,M.tile);
plankFloor(0,0,3.4,4);plankFloor(0,4,3.4,6.7);plankFloor(0,13.9,5.4,17);plankFloor(0,17,4.4,18.7);plankFloor(5.4,13.9,7,15.6);tileFloor(5.4,15.6,7,18.7,.5,M.tile);tileFloor(4.4,17,5.4,18.7,.5,M.tile);
// External envelope. West-facing windows follow the supplied plan.
let edge=0;for(const [a,b,sill] of [[.75,2.35,1.1],[4.05,4.9,1.1],[5.85,6.6,.9],[7,8.5,.9],[11.05,12.7,.9],[14.25,15.9,1.1],[17.2,18.05,1.1]]){if(a>edge)wall(0,edge,0,a);windowWall(0,(a+b)/2,b-a,'z',sill);edge=b;}wall(0,edge,0,18.7);
zWall(0,0,3.45);windowWall(3.95,0,.9,'x',1.45);zWall(0,4.4,5.15);
xWall(5.15,0,3.2);zWall(3.2,5.15,7,[[5.35,6.2]]);
xWall(7,3.2,18.7,[[8.4,9.95]]);zWall(18.7,0,7,[[.65,1.75]]);
windowWall(6.25,18.7,.85,'x',1.5); // Bath glazing mounted on the end wall.
// Internal walls and open doorways.
xWall(3.4,0,6.7,[[2.85,3.75],[4.0,4.85]]);zWall(4,0,3.4,[[2.35,3.4]]);zWall(6.7,0,3.4);zWall(2.95,3.4,5.15,[[3.55,4.35]]);
zWall(13.9,0,7,[[4.05,5.0]]);xWall(5.4,10.75,17,[[11.55,12.4],[14.35,15.2]]);zWall(10.75,5.4,7);zWall(15.6,5.4,7);zWall(17,0,5.4,[[3.35,4.35]]);xWall(4.4,17,18.7,[[17.16,18.02]]);
ceilingRect(0,0,5.15,3.2);ceilingRect(0,3.2,7,18.7);ceiling.visible=false;
for(const [x,z] of [[1.7,1.8],[4.3,1.7],[1.7,5.3],[4.8,4.2],[4.8,6.3],[1.4,8.2],[4.8,8.2],[1.4,11.2],[4.3,11.2],[1.4,12.7],[4.3,12.7],[2,15.3],[4.4,15.3],[2,17.9],[6.2,12],[6.2,14.7],[6.2,17.4]])downlight(x,z);

function cabinet(x,z,w,d,h=2.3,rot=0,m=M.storageWarm,handle=M.brass){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;home.add(g);box(w,.09,d-.1,0,.065,0,M.darkWood,.006,g);box(w,h-.11,d,0,(h+.11)/2,0,M.trim,.009,g);const count=Math.max(1,Math.round(w/.55));for(let i=0;i<count;i++){box(w/count-.012,h-.16,.024,-w/2+(i+.5)*w/count,h/2+.02,d/2+.016,m,.004,g);box(.018,Math.min(.25,h*.32),.028,-w/2+(i+1)*w/count-.07,Math.min(1.1,h*.58),d/2+.036,handle,.005,g);}return g;}
function bed(x,z,w=1.5,d=2.05,accent=M.sage){const g=new THREE.Group();g.position.set(x,0,z);home.add(g);box(w+.12,.28,d+.1,0,.22,0,M.wood,.05,g);box(w,.24,d,0,.47,0,M.whiteFabric,.09,g);box(w+.15,.98,.12,0,.55,d/2+.08,M.linen,.035,g);box(w-.01,.075,d*.66,0,.63,-d*.15,M.whiteFabric,.035,g);box(w+.025,.045,.62,0,.69,-d*.32,accent,.018,g);for(const xx of w>1.3?[-w*.25,w*.25]:[0]){const p=box(w>.0?w*.43:.4,.14,.4,xx,.68,d*.32,M.whiteFabric,.07,g);p.rotation.x=-.07;}block(x-w/2-.04,z-d/2-.05,x+w/2+.04,z+d/2+.13);}
function chair(x,z,rot=0,material=M.linen,high=false){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;home.add(g);const y=high?.7:.43;box(.43,.09,.43,0,y,0,material,.045,g);box(.43,.38,.08,0,y+.21,.19,material,.04,g);for(const a of [-.16,.16])for(const b of [-.16,.16]){const leg=cyl(.016,.021,y,a,y/2,b,M.darkWood,g);leg.rotation.z=a>0?-.045:.045;}if(high)box(.35,.023,.023,0,.28,-.16,M.metal,0,g);return g;}
function desk(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;home.add(g);box(1.35,.055,.55,0,.74,0,M.wood,.012,g);box(.36,.69,.5,.47,.365,0,M.wall,.015,g);for(const xx of [-.58])box(.045,.72,.47,xx,.36,0,M.wood,0,g);box(.38,.26,.025,-.12,.94,-.13,M.black,.015,g);box(.05,.12,.05,-.12,.79,-.13,M.metal,0,g);box(.3,.015,.19,-.12,.78,.11,M.metal,.012,g);return g;}
function lamp(x,z,y=1.3){cyl(.15,.18,.03,x,.035,z,M.brass);cyl(.013,.013,y,x,y/2,z,M.brass);cyl(.2,.28,.3,x,y,z,M.whiteFabric);cyl(.16,.2,.01,x,y-.145,z,M.light);}
function vase(x,y,z,m=M.ceramic){cyl(.09,.07,.25,x,y+.125,z,m);cyl(.045,.085,.09,x,y+.29,z,m);}
// Children's rooms: beds on the west, desks on the east, paired wardrobe banks.
bed(1.0,1.2,1.4,2.0,M.sage);desk(2.65,.43);chair(2.5,1.2,0);cabinet(1.1,3,1.9,.56,2.4);cabinet(1.1,3.65,1.9,.56,2.4,Math.PI);
bed(1.0,5.65,1.4,1.9,M.clay);desk(2.67,6.3,Math.PI);chair(2.55,5.55,Math.PI);cabinet(2.97,5.03,.68,.55,.7,Math.PI/2);
// Kitchen wall, continuous stone worktop, integrated appliances.
cabinet(6.68,5.45,3.8,.62,.86,-Math.PI/2);box(.68,.055,3.8,6.67,.9,5.45,M.stone,.015);block(6.32,3.55,7,7.38);
cabinet(6.73,5.1,2.9,.43,.7,-Math.PI/2).position.y=1.63;box(.025,.58,3.4,6.94,1.25,5.25,M.stone);box(.045,.025,2.9,6.48,1.64,5.1,M.light);
box(.49,.023,.65,6.62,.945,4.05,M.black,.015);for(const zz of [3.85,4.23]){cyl(.12,.12,.012,6.62,.963,zz,M.metal);cyl(.095,.095,.012,6.62,.975,zz,M.black);}box(.4,.13,.7,6.76,1.8,4.05,M.metal,.025);
box(.48,.012,.63,6.62,.938,6.2,M.metal,.025);box(.35,.02,.49,6.61,.95,6.2,M.black,.08);box(.31,.021,.44,6.61,.952,6.2,M.metal,.065);cyl(.018,.018,.32,6.87,1.08,6.2,M.metal);const tap=box(.2,.032,.032,6.78,1.24,6.2,M.metal,.012);
cabinet(6.65,7.85,.88,.66,2.35,-Math.PI/2,M.wall);box(.025,1.15,.73,6.298,1.58,7.85,M.metal,.015);box(.025,.85,.73,6.298,.54,7.85,M.metal,.015);box(.03,.49,.023,6.27,1.47,7.59,M.black,.008);
cabinet(4.94,5.35,.78,2.05,.87,0);box(.86,.065,2.15,4.94,.93,5.35,M.stone,.025);block(4.51,4.27,5.37,6.43);for(const z of [4.55,5.3,6.05])chair(4.1,z,-Math.PI/2,M.linen,true);vase(4.95,.966,4.62);
// Dining and mahjong areas, matching the left drawing.
const dining=box(2.38,.095,1.05,2.04,.77,8.3,M.wood,.23);for(const xx of [1.35,2.73])box(.13,.73,.6,xx,.365,8.3,M.darkWood,.025);block(.85,7.78,3.23,8.82);for(const x of [1.28,2.04,2.8]){chair(x,7.53,Math.PI);chair(x,9.07);}vase(2.05,.82,8.3,M.clay);
box(1.03,.085,1.03,4.95,.76,7.8,M.darkWood,.04);box(.87,.02,.87,4.95,.812,7.8,M.sage,.018);for(const x of [4.57,5.33])for(const z of [7.42,8.18])box(.055,.73,.055,x,.365,z,M.darkWood);for(const [x,z,r] of [[4.95,7,Math.PI],[4.95,8.6,0],[4.14,7.8,-Math.PI/2],[5.76,7.8,Math.PI/2]])chair(x,z,r,M.sage);block(4.42,7.27,5.48,8.33);
// Entry console and storage.
cabinet(6.14,10.32,1.55,.55,.85,Math.PI);box(1.6,.035,.59,6.14,.89,10.32,M.stone,.015);vase(6.36,.91,10.27);box(.72,1,.035,6.17,1.72,10.63,M.mirror,.1);box(.7,.03,1.05,6.35,.025,9.26,M.linen,.1);
// Living area. Sofa faces the TV wall; open circulation on east side.
box(3.9,.025,2.65,2.68,.026,11.63,M.linen,.08);
furnishedSofa({home,M,box,cyl});block(.26,9.84,3.75,10.82);block(.34,10.82,1.32,11.62);
const coffee=box(1.15,.085,.7,2.26,.4,11.68,M.stone,.15);coffee.rotation.y=.35;cyl(.25,.34,.35,2.26,.2,11.68,M.darkWood);box(.31,.027,.22,2.32,.459,11.63,M.clay,.005);vase(2.05,.448,11.64);box(.63,.43,.63,3.72,.25,11.76,M.linen,.11);block(1.65,11.23,2.88,12.1);
box(3.95,.35,.39,2.18,.23,13.63,M.wood,.025);box(3.95,.035,.43,2.18,.427,13.62,M.stone,.012);box(3.1,2.3,.065,2.18,1.54,13.8,M.livingWall,.015);box(1.65,.96,.055,2.18,1.52,13.747,M.black,.025);box(1.58,.89,.012,2.18,1.52,13.711,M.screen,.012);for(let x=.42;x<.72;x+=.07)box(.031,2.55,.075,x,1.35,13.8,M.wood);vase(3.86,.45,13.6);lamp(3.88,10.17,1.55);
// Joinery, reveals and objects at real scale.
for(let i=0;i<5;i++)box(.77,.26,.023,.62+i*.78,.24,13.42,M.storageWarm,.005);
box(3.79,.045,.30,2.18,.065,13.65,M.darkWood,.008);
for(let i=0;i<3;i++){const book=box(.28-i*.015,.018,.2,2.38,.48+i*.02,11.65,i===1?M.whiteFabric:M.clay,.002);book.rotation.y=.22+i*.07;}
cyl(.115,.115,.012,2.02,.451,11.67,M.darkWood);
// Primary suite and closets.
bed(1.87,15.68,1.8,2.04,M.sage);for(const x of [.48,3.19]){cabinet(x,16.43,.57,.47,.46);lamp(x,16.43,.99);}box(3.8,.025,2.5,2.3,.024,15.6,M.linen,.06); // beneath bed frame
cabinet(6.63,12.44,2.65,.6,2.45,-Math.PI/2,M.storage,M.black);cabinet(6.19,13.5,1.42,.52,2.3,Math.PI,M.storageWarm,M.black);block(6.29,11.1,7,13.85);
cabinet(6.65,14.74,1.58,.6,2.4,-Math.PI/2);block(6.32,13.95,7,15.55);
cabinet(2.89,18.37,2.76,.58,2.45,Math.PI);block(1.5,18.03,4.32,18.7);box(.64,.42,.64,1.01,.24,17.66,M.linen,.08);box(.025,1.55,.68,4.3,1.3,17.7,M.mirror,.02);
function vessel(x,y,z,rx,rz,parent=home){
 const points=[[0,0],[.08,0],[.2,.025],[.27,.075],[.28,.13],[.25,.135],[.235,.095],[.16,.045],[0,.035]].map(p=>new THREE.Vector2(...p));
 const bowl=new THREE.Mesh(new THREE.LatheGeometry(points,48),M.ceramic);bowl.position.set(x,y,z);bowl.scale.set(rx/.28,1,rz/.28);bowl.castShadow=true;bowl.receiveShadow=true;parent.add(bowl);cyl(.023,.023,.008,x,y+.039,z,M.metal,parent);
}
function toilet(x,z,rot=0){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;home.add(g);
 box(.36,.6,.17,0,.4,.22,M.ceramic,.065,g);box(.38,.04,.19,0,.716,.22,M.ceramic,.015,g);
 box(.25,.22,.31,0,.12,-.04,M.ceramic,.055,g);
 const profile=[[0,.16],[.12,.16],[.185,.27],[.225,.4],[.23,.425],[.172,.425],[.153,.35],[.07,.29],[0,.29]].map(p=>new THREE.Vector2(...p));
 const bowl=new THREE.Mesh(new THREE.LatheGeometry(profile,48),M.ceramic);bowl.position.z=-.07;bowl.scale.z=1.35;bowl.castShadow=true;bowl.receiveShadow=true;g.add(bowl);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.203,.023,10,48),M.whiteFabric);rim.rotation.x=Math.PI/2;rim.scale.y=1.37;rim.position.set(0,.447,-.07);rim.castShadow=true;g.add(rim);
 box(.33,.04,.15,0,.455,.19,M.whiteFabric,.025,g);box(.075,.009,.045,0,.741,.22,M.metal,.008,g);
 cyl(.065,.065,.007,0,.297,-.07,M.mirror,g);
}
function vanity(x,z,w=.65,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;home.add(g);box(w,.48,.43,0,.51,0,M.storageWarm,.015,g);box(w+.035,.055,.47,0,.78,0,M.stone,.012,g);vessel(0,.808,-.035,Math.min(.3,w*.42),.18,g);cyl(.014,.014,.25,0,.95,.17,M.metal,g);box(.033,.026,.17,0,1.07,.09,M.metal,.012,g);box(w,.95,.027,0,1.59,.24,M.mirror,.04,g);}
function shower(x,z,w,d){box(w,.055,d,x,.035,z,M.tile,.015);box(w,.035,.035,x,2.2,z,M.metal);box(.028,1.94,d*.6,x-w/2,.99,z+d*.2,M.glass);cyl(.016,.016,1.3,x,1.55,z-d/2+.08,M.metal);box(.26,.027,.26,x,2.2,z-d/2+.2,M.metal,.035);box(.12,.075,.07,x,1,z-d/2+.08,M.metal,.02);box(.12,.008,.12,x,.067,z,M.metal,.008);}
shower(4.25,.55,1.56,.96);toilet(4.76,1.52,Math.PI/2);vanity(4.81,2.58,.65,Math.PI/2);shower(6.18,16.15,1.43,.95);toilet(4.94,18.25,0);vanity(6.08,18.35,1.35);box(.54,2.1,.018,5.69,1.05,17,M.glass);box(.28,2.1,.018,6.84,1.05,17,M.glass);box(1.56,.025,.025,6.2,2.1,17,M.metal);box(.025,2.1,.025,5.42,1.05,17,M.metal);block(5.4,16.97,5.96,17.03);
// Curtains are modeled fabric folds, not flat image planes.
for(const [z,len] of [[7.75,1.5],[11.88,1.65],[15.07,1.65]]){box(.07,.055,len+.2,.16,2.62,z,M.trim);for(const sign of [-1,1])for(let i=0;i<7;i++){const zz=z+sign*(len/2-.12)+i*.03;cyl(.035,.039,2.15,.17,1.5,zz,M.whiteFabric);}}
// Both user-identified balconies, including narrow returns.
tileFloor(5.15,-.45,8.2,3.2,.45,M.tile);tileFloor(7,3.2,8.2,5.1,.45,M.tile);
tileFloor(-.55,16.85,0,19.35,.4,M.tile);tileFloor(0,18.7,4.4,19.35,.4,M.tile);
function railing(x1,z1,x2,z2){const len=Math.hypot(x2-x1,z2-z1),g=new THREE.Group();g.position.set((x1+x2)/2,0,(z1+z2)/2);g.rotation.y=-Math.atan2(z2-z1,x2-x1);home.add(g);box(len,.18,.13,0,.08,0,M.trim,0,g);box(len,.035,.05,0,1.1,0,M.metal,.01,g);box(len-.06,.86,.015,0,.58,0,M.glass,0,g);for(let i=0;i<=Math.ceil(len/1.1);i++)box(.035,1.08,.05,-len/2+i*len/Math.ceil(len/1.1),.56,0,M.metal,0,g);block(Math.min(x1,x2)-.04,Math.min(z1,z2)-.04,Math.max(x1,x2)+.04,Math.max(z1,z2)+.04);}
railing(5.15,-.45,8.2,-.45);railing(8.2,-.45,8.2,5.1);railing(7,5.1,8.2,5.1);railing(5.15,-.45,5.15,0);
railing(-.55,16.85,-.55,19.35);railing(-.55,19.35,4.4,19.35);railing(4.4,18.7,4.4,19.35);railing(-.55,16.85,0,16.85);
box(1.4,3.2,1.4,8.2,1.5,-.45,M.trim);block(7.5,-1.15,8.9,.25);box(1.4,3.2,1.4,-.55,1.5,19.35,M.trim);block(-1.25,18.65,.15,20.05);
function ac(x,z){box(.48,.7,1.0,x,.48,z,M.ceramic,.055);box(.028,.58,.89,x-.255,.49,z,M.metal,.01);for(let i=0;i<14;i++)box(.035,.018,.82,x-.277,.235+i*.038,z,M.trim);for(const zz of [z-.35,z+.35])box(.54,.12,.08,x,.06,zz,M.black,.005);}
ac(7.58,3.72);ac(7.58,4.62);cyl(.3,.3,.045,6.5,.72,1.5,M.wood);cyl(.055,.07,.7,6.5,.35,1.5,M.black);chair(6.52,2.16);chair(6.52,.86,Math.PI);
function plant(x,z,s=1){cyl(.2*s,.145*s,.4*s,x,.2*s,z,M.ceramic);cyl(.18*s,.18*s,.015,x,.405*s,z,M.soil);for(let i=0;i<11;i++){const a=i*2.4,r=.17*s;const yy=(.67+i*.045)*s;const leaf=ball(x+Math.cos(a)*r,yy,z+Math.sin(a)*r,.09*s,.25*s,.035*s,M.leaf);leaf.rotation.set(Math.sin(a)*.8,a,Math.cos(a)*.75);} }
plant(5.62,.5,1.3);plant(7.65,2.7);plant(3.94,19.01,.66);plant(.49,12.83,1.25);
// Pendant lights.
function pendant(x,z,r=.25){cyl(.012,.012,.63,x,2.46,z,M.black,ceiling);cyl(r*.6,r,.22,x,2.07,z,M.whiteFabric,ceiling);cyl(r*.9,r*.9,.013,x,1.964,z,M.light,ceiling);}
pendant(2.04,8.3,.4);for(const z of [4.72,5.92])pendant(4.94,z,.18);
// Soft neutral site context, below the 13F cutaway.
const ground=box(200,.1,200,3,-.62,9,mat('#e4e5db',1));ground.castShadow=false;
// Feature paint follows the existing walls, preserving openings and plan dimensions.
for(const mesh of walls){
 const {x,z}=mesh.position;
 if(Math.abs(z-13.9)<.01&&x<4.05)mesh.material=M.livingWall;
 else if(Math.abs(x)<.01&&z>8.5&&z<11.05)mesh.material=M.diningWall;
 else if(Math.abs(z-17)<.01&&x<3.35)mesh.material=M.bedroomWall;
}
// Batch static geometry by material to keep mobile draw calls low.
function batchStatic(root,skip=null){root.updateWorldMatrix(true,true);const groups=new Map();const meshes=[];root.traverse(o=>{if(!o.isMesh)return;let p=o;while(p){if(p===skip)return;p=p.parent;}meshes.push(o);const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(geometry);});for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}for(const [material,geometries] of groups){const combined=mergeGeometries(geometries);const mesh=new THREE.Mesh(combined,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}}
batchStatic(home,ceiling);batchStatic(ceiling);ceiling.position.y=.2;contactShadows(home);
const rooms=[
 {name:'客廳',x:4.35,z:12.4,yaw:.78}, {name:'餐廳',x:3.8,z:9.1,yaw:1.1},
 {name:'廚房',x:5.8,z:6.6,yaw:.1}, {name:'麻將區',x:5.8,z:9.05,yaw:.55},
 {name:'小孩房 A',x:2.65,z:2.2,yaw:1.3}, {name:'小孩房 B',x:2.5,z:5.18,yaw:1.9},
 {name:'主臥室',x:4.4,z:15.3,yaw:1.7}, {name:'更衣間',x:2.2,z:17.55,yaw:Math.PI},
 {name:'儲藏室',x:5.8,z:11.45,yaw:-2.1}, {name:'內更衣間',x:5.86,z:14.65,yaw:-1.5},
 {name:'客衛浴',x:3.85,z:2.35,yaw:-.6}, {name:'主衛浴',x:4.8,z:17.45,yaw:-2.45,pitch:-.3},
 {name:'廚房陽台',x:6.55,z:2.65,yaw:0}, {name:'轉角陽台',x:2.4,z:19.0,yaw:1.5}
];
for(const [i,r] of rooms.entries()){const b=document.createElement('button');b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${r.name}`;b.onclick=()=>enterRoom(i);$('#rooms').append(b);}
function setMode(next){mode=next;const walking=next==='walk';scene.background=walking&&sky?sky:new THREE.Color(night?'#48545a':'#e9e9df');scene.backgroundIntensity=night?.018:.65;orbit.enabled=!walking;ceiling.visible=walking;document.body.classList.toggle('walking',walking);$('#overview').classList.toggle('active',!walking);$('#walk').classList.toggle('active',walking);$('#crosshair').hidden=!walking;$('#walk-hint').hidden=!walking;$('#walk-hint').textContent=matchMedia('(pointer:coarse)').matches?'左下搖桿移動 · 滑動畫面轉頭 · 上方導覽可左右滑動':'拖曳畫面轉頭 · W A S D / 方向鍵走動 · Shift 加速 · Esc 釋放滑鼠';$('#lock').hidden=!walking;$('#joystick').hidden=!walking||!matchMedia('(pointer:coarse)').matches;ground.visible=!walking;applyLighting();physical?.invalidateScene();if(!walking&&document.pointerLockElement)document.exitPointerLock();}
function overview(){setMode('overview');camera.fov=43;camera.updateProjectionMatrix();const mobile=innerWidth<760;orbit.maxDistance=mobile?100:60;camera.position.set(mobile?17:24,mobile?58:29,mobile?40:28);orbit.target.set(mobile?3.8:2.3,0,9.5);orbit.update();$('#location').textContent='整屋視角';$('#rooms').querySelectorAll('button').forEach(b=>b.classList.remove('selected'));}
function enterRoom(i){const r=rooms[i];setMode('walk');camera.fov=70;camera.updateProjectionMatrix();camera.position.set(r.x,1.62,r.z);yaw=r.yaw;pitch=r.pitch??-.1;updateLook();applyLighting();$('#location').textContent=r.name;$('#rooms').querySelectorAll('button').forEach((b,j)=>b.classList.toggle('selected',i===j));}
function updateLook(){camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
$('#overview').onclick=overview;$('#walk').onclick=()=>enterRoom(0);$('#lock').onclick=()=>renderer.domElement.requestPointerLock?.();
$('#plan-button').onclick=()=>$('#plan-dialog').showModal();$('#help').onclick=()=>$('#help-dialog').showModal();for(const b of document.querySelectorAll('.close'))b.onclick=()=>b.closest('dialog').close();
function applyLighting(){renderer.shadowMap.needsUpdate=true;windowFill.intensity=night||mode!=='walk'?0:10;
 sun.intensity=night?.02:(lightmapsReady&&mode==='walk'?0:3.6);hemi.intensity=night?.03:.55;scene.environmentIntensity=night?.035:(lightmapsReady?.12:.38);scene.backgroundIntensity=night?.018:.65;
 renderer.toneMappingExposure=night?1.25:1.0;
 roomLights.forEach(l=>{const interior=l.position.x>5.4||l.position.z<3&&l.position.x>3.4;l.intensity=mode==='walk'?(night?32:interior?12:0):0;l.visible=l.intensity>0;});
 M.light.emissiveIntensity=night?4:.25;bakedMeshes?.forEach(o=>{if(o.material.lightMap)o.material.lightMapIntensity=night?.15:Math.PI;});
 const closest=[...roomLights].sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position)).slice(0,2);
 roomLights.forEach(l=>l.castShadow=l.intensity>0&&closest.includes(l));
}
$('#light-button').onclick=()=>{night=!night;applyLighting();if(mode==='overview')scene.background=new THREE.Color(night?'#48545a':'#e9e9df');$('#light-button').textContent=night?'☾ 夜景':'☀ 日光';physical?.invalidateScene();};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#help-dialog').showModal();}};
const keys=new Set();window.addEventListener('keydown',e=>{if(mode==='walk'&&!document.querySelector('dialog[open]')&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();joy.x=joy.y=0;drag=null;});
let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='walk')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointermove',e=>{if(mode!=='walk')return;let dx=0,dy=0;if(document.pointerLockElement===renderer.domElement){dx=e.movementX;dy=e.movementY;}else if(drag?.id===e.pointerId){dx=e.clientX-drag.x;dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;}else return;yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-1.2,1.2);updateLook();});for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,()=>drag=null);
const joy={x:0,y:0};let joyPointer=null;function stickMove(e){const rect=$('#joystick').getBoundingClientRect();let x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;const len=Math.hypot(x,y);if(len>34){x*=34/len;y*=34/len;}joy.x=x/34;joy.y=-y/34;$('#stick').style.transform=`translate(${x}px,${y}px)`;}
$('#joystick').addEventListener('pointerdown',e=>{joyPointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);stickMove(e);});$('#joystick').addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)stickMove(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#joystick').addEventListener(event,()=>{joyPointer=null;joy.x=joy.y=0;$('#stick').style.transform='';});
const areas=[[0,0,5.15,3.2],[0,3.2,7,18.7],[5.15,-.45,8.2,3.2],[7,3.2,8.2,5.1],[-.55,16.85,0,19.35],[0,18.7,4.4,19.35]];
function allowed(x,z){const r=.16;if(!areas.some(([x1,z1,x2,z2])=>x>=x1&&x<=x2&&z>=z1&&z<=z2))return false;return !collision.some(b=>x>b.x1-r&&x<b.x2+r&&z>b.z1-r&&z<b.z2+r);}
function move(dx,dz){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.07));for(let i=0;i<n;i++){if(allowed(camera.position.x+dx/n,camera.position.z))camera.position.x+=dx/n;if(allowed(camera.position.x,camera.position.z+dz/n))camera.position.z+=dz/n;}}
let last=performance.now(),fpsCount=0;function animate(t){const dt=Math.min((t-last)/1000,.05);last=t;if(mode==='overview')orbit.update();else if(!document.querySelector('dialog[open]')){let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))+joy.y;let s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joy.x;const mag=Math.max(1,Math.hypot(f,s));f/=mag;s/=mag;const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?2.8:1.65)*dt;move((-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed);}if(physical)physical.render(t);else renderer.render(scene,camera);fpsCount++;}
renderer.setAnimationLoop(animate);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);physical?.invalidateScene();if(mode==='overview')overview();if(mode==='walk')$('#joystick').hidden=!matchMedia('(pointer:coarse)').matches;});
manager.onLoad=()=>{if(assetErrors.length){$('#load-status').textContent='部分材質載入失敗，請重新整理。';$('#loading').addEventListener('click',()=>location.reload());}else {physical=createEfficientRenderer(renderer,scene,camera);applyLighting();applyPalette(activePalette);$('#render-status').textContent='柔和日光 · 靜止時不重繪';$('#loading').classList.add('done');}};
overview();
// Read-only diagnostics for repeatable browser verification.
window.home3D={get state(){return {mode,lightmapsReady,palette:activePalette,lighting:physical?.state??null,position:camera.position.toArray(),yaw,pitch,assetErrors,frames:fpsCount,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,rooms:rooms.map(r=>({name:r.name,x:r.x,z:r.z,clear:allowed(r.x,r.z)}))};},allowed};

// Authoring export is exposed only when explicitly opening the bake URL.
home.traverse(o=>{if(o.isMesh&&o!==ground&&!o.material.transparent&&!o.material.isShaderMaterial){o.userData.bakeId='m'+String(bakedMeshes.length).padStart(2,'0');bakedMeshes.push(o);}});
if(new URLSearchParams(location.search).has('bake'))window.exportBake=()=>{home.updateWorldMatrix(true,true);return bakedMeshes.map(o=>{const g=o.geometry.clone().applyMatrix4(o.matrixWorld);return {id:o.userData.bakeId,materialName:Object.entries(M).find(([k,v])=>v===o.material)?.[0]??'other',positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),color:o.material.color.toArray(),roughness:o.material.roughness};});};

const palettes={
 cream:{name:'奶油侘寂',subtitle:'柔和・安定・留白',colors:['#eee7db','#a99a84','#d1bea5','#927d65'],materials:{livingWall:'#a99a84',diningWall:'#d1bea5',bedroomWall:'#b9ac98',wall:'#eee7db',trim:'#d3cec1',linen:'#c6bcaa',whiteFabric:'#e2ddcf',sage:'#b4ad96',clay:'#af9179',storage:'#c2baa8',storageWarm:'#ded6c6',darkWood:'#8c7355'}},
 sage:{name:'鼠尾草自然',subtitle:'清爽・自然・有層次',colors:['#ebe8dc','#63745f','#c9b79a','#9ca78e'],materials:{livingWall:'#63745f',diningWall:'#c9b79a',bedroomWall:'#9ca78e',wall:'#ebe8dc',trim:'#d4d3c8',linen:'#c7c4b4',whiteFabric:'#dedacd',sage:'#9ca98d',clay:'#b78d73',storage:'#a5b29a',storageWarm:'#ded8c9',darkWood:'#75624a'}},
 urban:{name:'暖灰都會',subtitle:'俐落・沉穩・精緻',colors:['#e5e0d7','#535f61','#aaa296','#828d8c'],materials:{livingWall:'#535f61',diningWall:'#aaa296',bedroomWall:'#828d8c',wall:'#e5e0d7',trim:'#c6c0b7',linen:'#9b9b93',whiteFabric:'#d4d0c7',sage:'#667471',clay:'#a4957d',storage:'#777f77',storageWarm:'#c7c2b8',darkWood:'#584331'}},
 terra:{name:'陶土暖居',subtitle:'溫暖・柔潤・生活感',colors:['#eee2d1','#a36850','#d2b292','#b98e76'],materials:{livingWall:'#a36850',diningWall:'#d2b292',bedroomWall:'#b98e76',wall:'#eee2d1',trim:'#d0c4b5',linen:'#c5b39b',whiteFabric:'#e4d8c5',sage:'#a5ad8b',clay:'#ba8064',storage:'#b2ad98',storageWarm:'#d7c8b4',darkWood:'#7a5741'}}
};
function applyPalette(key){const palette=palettes[key]??palettes.sage;activePalette=palettes[key]?key:'sage';for(const [name,color] of Object.entries(palette.materials)){M[name].color.set(color);bakedMeshes.forEach(mesh=>{if(mesh.userData.sourceMaterial===M[name])mesh.material.color.set(color);});}document.querySelectorAll('[data-palette]').forEach(button=>button.classList.toggle('selected',button.dataset.palette===activePalette));try{localStorage.setItem('home3D-palette',activePalette);}catch{}physical?.invalidateScene();}
for(const [key,p] of Object.entries(palettes)){const button=document.createElement('button');button.dataset.palette=key;button.innerHTML=`<span class="swatches">${p.colors.map(color=>`<i style="background:${color}"></i>`).join('')}</span><strong>${p.name}</strong><small>${p.subtitle}</small>`;button.onclick=()=>{applyPalette(key);$('#palette-dialog').close();};$('#palette-options').append(button);}
$('#palette-button').onclick=()=>$('#palette-dialog').showModal();$('#palette-dialog .close').onclick=()=>$('#palette-dialog').close();
try{activePalette=localStorage.getItem('home3D-palette')||'sage';}catch{}applyPalette(activePalette);
