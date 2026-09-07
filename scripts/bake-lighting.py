import bpy, json, math, os, struct, time
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT,'tmp/lighting/scene.json')) as f:data=json.load(f)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=4
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='METAL';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='METAL'
scene.cycles.device='GPU'
print('DEVICES',[(d.name,d.use) for d in prefs.devices],flush=True)
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=False;scene.render.bake.margin=5
scene.world.use_nodes=True;nodes=scene.world.node_tree.nodes;links=scene.world.node_tree.links;nodes.clear()
env=nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(os.path.join(ROOT,'assets/sky.hdr'))
bg=nodes.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=.65
out=nodes.new('ShaderNodeOutputWorld');links.new(env.outputs['Color'],bg.inputs['Color']);links.new(bg.outputs[0],out.inputs[0])
# Match the western sun, with realistic angular size.
sunData=bpy.data.lights.new('Daylight','SUN');sunData.energy=3.6;sunData.angle=math.radians(2.5);sunData.color=(1,.94,.83)
sun=bpy.data.objects.new('Daylight',sunData);scene.collection.objects.link(sun);sun.rotation_euler=Vector((15,-8,-8)).to_track_quat('-Z','Y').to_euler()
# Exact fixture locations, used for the windowless storage and bath zones.
for x,z in [(4.3,1.7),(6.2,12),(6.2,14.7),(6.2,17.4)]:
 ld=bpy.data.lights.new('Interior fixture','AREA');ld.energy=35;ld.color=(1,.84,.66);ld.shape='DISK';ld.size=.16
 ob=bpy.data.objects.new('Interior fixture',ld);scene.collection.objects.link(ob);ob.location=(x,-z,2.94)
items=[]
for d in data:
 verts=[];normals=[];faces=[];face_map=[];lookup={};p=d['positions'];n=d['normals']
 for start in range(0,len(p),9):
  face=[]
  for i in range(start,start+9,3):
   pos=(p[i],-p[i+2],p[i+1]);normal=(n[i],-n[i+2],n[i+1]);key=tuple(round(v,6) for v in (*pos,*normal))
   if key not in lookup:lookup[key]=len(verts);verts.append(pos);normals.append(normal)
   face.append(lookup[key])
  if len(set(face))==3 and (Vector(verts[face[1]])-Vector(verts[face[0]])).cross(Vector(verts[face[2]])-Vector(verts[face[0]])).length_squared>1e-16:
   faces.append(face);face_map.append(start//9)
 mesh=bpy.data.meshes.new(d['id']);mesh.from_pydata(verts,[],faces);mesh.update()
 obj=bpy.data.objects.new(d['id'],mesh);scene.collection.objects.link(obj)
 for polygon in mesh.polygons:polygon.use_smooth=True
 try:mesh.normals_split_custom_set_from_vertices(normals)
 except Exception:pass
 material=bpy.data.materials.new(d['id']);material.use_nodes=True;bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*d['color'],1);bsdf.inputs['Roughness'].default_value=d['roughness']
 # Bake diffuse illumination for reflective materials too, so runtime can keep the same atlas.
 bsdf.inputs['Metallic'].default_value=0
 obj.data.materials.append(material);bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 mesh.uv_layers.new(name='Lightmap');bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.002,area_weight=.8,correct_aspect=True);bpy.ops.object.mode_set(mode='OBJECT')
 print('UV READY',d['id'],flush=True)
 size=2048 if d['id']=='m00' else 1024
 image=bpy.data.images.new(d['id']+'_day',width=size,height=size,alpha=False,float_buffer=True);image.colorspace_settings.name='Linear Rec.709'
 tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.nodes.active=tex
 items.append((obj,image,d,face_map))
print('READY',len(items),flush=True)
manifest=[]
for obj,image,d,face_map in items:
 if d['materialName'] not in ['wall','stone','wood','whiteFabric','linen','sage','storageWarm','storage','tile']:continue
 if d['id']=='m00':
  manifest.append({'id':d['id'],'material':d['materialName'],'size':2048,'vertexCount':len(d['positions'])//3});print('REUSE m00',flush=True);continue
 t=time.time();bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 bpy.ops.object.bake(type='DIFFUSE')
 # Save linear irradiance without the display view transform. PNG stores RGB encoded as sRGB.
 image.file_format='PNG';image.filepath_raw=os.path.join(ROOT,'assets/lighting',d['id']+'.png');image.save()
 uv=obj.data.uv_layers['Lightmap'].data;coords=[0.]*(len(d['positions'])//3*2)
 for polygon in obj.data.polygons:
  offset=face_map[polygon.index]*6
  for i,idx in enumerate(polygon.loop_indices):coords[offset+i*2:offset+i*2+2]=uv[idx].uv[:]
 with open(os.path.join(ROOT,'assets/lighting',d['id']+'.uv'),'wb') as f:f.write(struct.pack('<'+'f'*len(coords),*coords))
 manifest.append({'id':d['id'],'material':d['materialName'],'size':image.size[0],'vertexCount':len(coords)//2})
 print('BAKED',d['id'],d['materialName'],round(time.time()-t,1),flush=True)
with open(os.path.join(ROOT,'assets/lighting/manifest.json'),'w') as f:json.dump(manifest,f)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'tmp/lighting/lighting.blend'))
print('BAKE COMPLETE',flush=True)
