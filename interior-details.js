import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared upholstery geometry, with rounded volume and shallow compression.
export function furnishedSofa({home,M,box,cyl}){
 const g=new THREE.Group();g.position.set(2,0,10.3);home.add(g);
 function cushion(w,h,d,x,y,z,m,back=false,tilt=0){
  const root=new THREE.Group();root.position.set(x,y,z);root.rotation.x=tilt;g.add(root);
  const geo=new RoundedBoxGeometry(w,h,d,5,Math.min(.085,h*.36,d*.3));
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
   const xx=p.getX(i),yy=p.getY(i),zz=p.getZ(i);
   if(back){
    const face=Math.max(0,zz/(d/2));
    const bulge=.022*Math.cos(xx/w*Math.PI)*Math.cos(yy/h*Math.PI);
    const crease=.006*Math.sin(xx*37+yy*11)*Math.pow(Math.abs(yy)/(h/2),5);
    p.setZ(i,zz+face*(bulge+crease));
   }else{
    const top=Math.max(0,yy/(h/2));
    const dip=.018*Math.exp(-((xx/(w*.32))**2+(zz/(d*.35))**2));
    p.setY(i,yy-top*dip);
   }
  }
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  // Welt follows each cushion's own perimeter, leaving a visible seam.
  const a=w/2-.025,b=(back?h:d)/2-.025,r=.065,pts=[];
  for(const [cx,cy,start] of [[a-r,b-r,0],[-a+r,b-r,Math.PI/2],[-a+r,-b+r,Math.PI],[a-r,-b+r,Math.PI*1.5]]){
   for(let j=0;j<=10;j++){const t=start+j/10*Math.PI/2;
    const u=cx+r*Math.cos(t),v=cy+r*Math.sin(t);
    pts.push(back?new THREE.Vector3(u,v,d/2-.015):new THREE.Vector3(u,h/2-.025,v));
   }
  }
  const curve=new THREE.CatmullRomCurve3(pts,true,'centripetal');
  const seam=new THREE.Mesh(new THREE.TubeGeometry(curve,72,.003,4,true),M.seam);
  seam.castShadow=false;root.add(seam);return root;
 }
 for(const x of [-1.49,1.49])for(const z of [-.29,.32])cyl(.021,.014,.16,x,.08,z,M.darkWood,g);
 for(const x of [-1.49,-.83])cyl(.021,.014,.16,x,.08,1.16,M.darkWood,g);
 box(3.22,.17,.86,0,.225,0,M.linen,.055,g);
 box(3.25,.46,.16,0,.57,-.36,M.linen,.055,g);
 for(const x of [-1.58,1.58])box(.18,.42,.9,x,.43,.02,M.linen,.06,g);
 box(.92,.17,1.19,-1.1,.225,.82,M.linen,.055,g);
 cushion(.96,.18,1.76,-1.1,.4,.46,M.whiteFabric);
 cushion(1.03,.18,.73,-.035,.4,.055,M.whiteFabric);
 cushion(1.03,.18,.73,1.04,.4,.055,M.whiteFabric);
 for(const [x,tilt] of [[-1.08,-.12],[-.015,-.16],[1.07,-.13]])cushion(1.015,.51,.19,x,.71,-.235,M.whiteFabric,true,tilt);
 const p1=cushion(.42,.4,.14,-1.19,.7,-.025,M.sage,true,-.23);p1.rotation.z=.13;
 const p2=cushion(.41,.39,.14,1.1,.68,.035,M.clay,true,-.3);p2.rotation.z=-.17;
 return g;
}

// Low-cost static contact occlusion. No textures, sampling noise or per-frame passes.
export function contactShadows(home){
 const mat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
  uniforms:{opacity:{value:.22}},
  vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 v; uniform float opacity; void main(){vec2 q=abs(v*2.-1.);float r=pow(pow(q.x,6.)+pow(q.y,6.),1./6.);float a=(1.-smoothstep(.45,1.,r))*opacity;gl_FragColor=vec4(.16,.12,.085,a);}'
 });
 for(const [x,z,w,d,y] of [[2,10.3,3.48,1.08,.047],[.9,11.1,1.06,1.38,.047],[2.26,11.68,.86,.83,.048],[3.72,11.76,.68,.68,.048],[2.04,8.3,2.25,1,.025]]){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.renderOrder=1;home.add(mesh);
 }
}
