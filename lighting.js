import * as THREE from 'three';

// No path tracing, screen-space passes, or background render loop when the view is still.
export function createEfficientRenderer(renderer,scene,camera){
 let dirty=true,drawn=0;const matrix=new THREE.Matrix4(),projection=new THREE.Matrix4();
 return {
  invalidateScene(){dirty=true;},
  get state(){return {mode:'cached-shadows',drawnFrames:drawn,pathTracing:false};},
  render(){camera.updateMatrixWorld();if(!dirty&&matrix.equals(camera.matrixWorld)&&projection.equals(camera.projectionMatrix))return;
   matrix.copy(camera.matrixWorld);projection.copy(camera.projectionMatrix);renderer.render(scene,camera);drawn++;dirty=false;
  }
 };
}
