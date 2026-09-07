import * as THREE from 'three';

export function createEfficientRenderer(renderer,scene,camera,onStatus=()=>{}){
 let dirty=true,drawn=0,wanted=false,building=false,tracer=null,traceScene=null;
 let sceneDirty=true,lastMove=0,lastDraw=0,capture=null;
 const matrix=new THREE.Matrix4(),projection=new THREE.Matrix4(),limit=128;
 function message(text){onStatus(text);}
 function buildScene(){
  if(traceScene)traceScene.traverse(o=>{if(o.isMesh)o.material.dispose();});
  traceScene=scene.clone(true);
  const remove=[];
  traceScene.traverse(o=>{
   if(o.isMesh){
    if(o.material.isShaderMaterial){remove.push(o);return;}
    o.material=o.material.clone();
    if(o.material.transparent&&o.material.opacity<.2){
     o.material.opacity=.04;o.material.transmission=0;o.material.thickness=0;
     o.material.transparent=true;o.material.depthWrite=false;
    }
   }
   // Window area lights remain physical emitters; the tracer handles their occlusion and bounces.
  });
  remove.forEach(o=>o.removeFromParent());
  traceScene.environmentIntensity=.65;
  tracer.setScene(traceScene,camera);sceneDirty=false;
 }
 async function setReal(enabled){
  wanted=enabled;dirty=true;
  if(!enabled){message('柔和日光 · 靜止時不重繪');return;}
  if(building)return;
  building=true;message('真實光照 · 準備場景，可再次按鈕關閉');
  try{
   if(!tracer){
    const [{WebGLPathTracer,DenoiseMaterial},{FullScreenQuad}]=await Promise.all([import('./vendor/pathtracer/build/index.module.js'),import('three/addons/postprocessing/Pass.js')]);
    if(!wanted)return;
    tracer=new WebGLPathTracer(renderer);
    const denoise=new FullScreenQuad(new DenoiseMaterial({sigma:3,threshold:1.2,kSigma:1}));
    tracer.renderToCanvasCallback=target=>{denoise.material.map=target.texture;denoise.render(renderer);};
    tracer.bounces=6;tracer.transmissiveBounces=4;tracer.filterGlossyFactor=.5;
    tracer.tiles.set(3,3);tracer.textureSize.set(512,512);
    tracer.renderScale=matchMedia('(pointer:coarse)').matches?.5:.75;
    tracer.dynamicLowRes=false;tracer.minSamples=8;tracer.fadeDuration=0;
    tracer.renderDelay=0;
    tracer.rasterizeSceneCallback=()=>renderer.render(scene,camera);
   }
   if(wanted){buildScene();lastMove=performance.now();message('真實光照 · 停下後逐步清晰');}
  }catch(error){wanted=false;dirty=true;message('真實光照無法啟用，已恢復輕量模式');console.error(error);}
  finally{building=false;}
 }
 function finishCapture(){
  if(!capture)return;
  const pending=capture;capture=null;
  renderer.domElement.toBlob(blob=>blob?pending.resolve(blob):pending.reject(new Error('照片匯出失敗')),'image/png');
 }
 return {
  invalidateScene(){dirty=true;sceneDirty=true;},
  setReal,
  capture(){return new Promise((resolve,reject)=>{if(capture){reject(new Error('正在匯出'));return;}capture={resolve,reject};dirty=true;});},
  get state(){return {mode:wanted?'path-tracing':'cached-shadows',drawnFrames:drawn,pathTracing:wanted,building,samples:tracer?.samples??0,maxSamples:limit};},
  render(t=performance.now()){
   camera.updateMatrixWorld();
   const moved=!matrix.equals(camera.matrixWorld)||!projection.equals(camera.projectionMatrix);
   if(moved){matrix.copy(camera.matrixWorld);projection.copy(camera.projectionMatrix);lastMove=t;if(tracer)tracer.updateCamera();}
   if(wanted&&tracer&&!building&&sceneDirty){
    try{buildScene();lastMove=t;}catch(error){wanted=false;message('真實光照無法更新，已恢復輕量模式');console.error(error);}
   }
   if(!wanted||building||!tracer||moved||t-lastMove<350){
    if(dirty||moved||capture){renderer.render(scene,camera);drawn++;dirty=false;finishCapture();}
    return;
   }
   if(document.hidden&&!capture)return;
   const complete=tracer.samples>=limit;
   if(complete&&!dirty&&!capture)return;
   if(t-lastDraw<33&&!capture)return;
   tracer.pausePathTracing=complete;
   tracer.renderSample();lastDraw=t;drawn++;dirty=false;
   message(tracer.isCompiling?'真實光照 · 首次準備中':tracer.samples>=limit?'真實光照 · 降噪完成，停止計算':`真實光照 · ${Math.floor(tracer.samples)} / ${limit} · 可匯出目前畫面`);
   finishCapture();
  }
 };
}
