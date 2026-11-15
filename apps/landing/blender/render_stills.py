"""Transparent stills for the landing page sections.

  Blender -b actually_glasses.blend -P render_stills.py -- --out ./raw/stills
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lens_rebuild import rebuild_lens  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[argv.index("--out") + 1] if "--out" in argv else "./raw/stills"
os.makedirs(out, exist_ok=True)

scene = bpy.context.scene
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 2400, 1350
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.cycles.samples = 128
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as exc:
    print("cycles setup warning:", exc)

# Same smoked lens as the scroll sequence, at its hero opacity.
mat = bpy.data.materials.new("Facto smoked lens")
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Base Color"].default_value = (0.012, 0.012, 0.02, 1.0)
bsdf.inputs["Roughness"].default_value = 0.04
bsdf.inputs["Alpha"].default_value = 0.55
for name in ("Left | clear curved lens", "Right | clear curved lens"):
    obj = bpy.data.objects[name]
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    rebuild_lens(obj)


for cam_name, file in (
    ("Hero A | oblique inside, both temples", "inside.png"),
    ("Product | front three-quarter", "product.png"),
):
    scene.camera = bpy.data.objects[cam_name]
    scene.render.filepath = os.path.join(out, file)
    bpy.ops.render.render(write_still=True)
print("DONE stills")
