# Texture sources

Poly Haven photographic PBR textures (CC0):
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_01/marble_01_diff_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_01/marble_01_nor_gl_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_01/marble_01_rough_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_nor_gl_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_rough_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/large_grey_tiles/large_grey_tiles_diff_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/large_grey_tiles/large_grey_tiles_nor_gl_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/large_grey_tiles/large_grey_tiles_rough_1k.jpg

Oak: three.js examples/textures/hardwood2_{diffuse,bump,roughness}.jpg. Three.js MIT license: vendor/LICENSE.
Floor plan: supplied by user, left diagram only.

Sky: Poly Haven, kloofendal_48d_partly_cloudy_puresky, CC0. https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky

## Updated pale timber
- `textures/whitewashed-oak.png`: generated using the built-in ImageGen tool for this project; replaces the parquet image. Prompt: a single continuous seamless expanse of very pale whitewashed oak, delicate fine straight grain running vertically edge to edge, low contrast, warm ivory beige, uniform shadowless lighting; no floorboard boundaries, horizontal joints, parquet blocks, dark knots, text or objects.
- Source output preserved at `/Users/batman_work/.codex/generated_images/01a079cb-fe69-7b00-874b-32cc674ebfea/exec-6d8f3084-e837-4c09-ae6d-d39ae611a534.png`.
- Fine oak surface reference maps: https://polyhaven.com/a/white_oak_veneer (CC0).

## Experimental lighting
Offline baking scripts are retained for development. Their generated lightmaps are excluded from Git and are not loaded by the current viewer.

## Optional real lighting
Vendored three-gpu-pathtracer 0.0.23 and three-mesh-bvh 0.8.3 are loaded only on request. Their MIT licenses are included in vendor/pathtracer/LICENSE and vendor/bvh/LICENSE. Prebuilt ESM files are shipped; no build or npm install is needed.
