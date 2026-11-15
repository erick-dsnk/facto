"""Render the Facto landing scroll sequence from actually_glasses.blend.

Usage (headless):
  Blender -b actually_glasses.blend -P render_sequence.py -- \
      --variant desktop --out ./frames --start 0 --end 149 --samples 64

  --coords-only   write lens coordinates JSON without rendering

The camera stays behind the glasses, the wearer's side: a high back three-quarter,
a short orbit through the straight-back view to the inside view, then a push into
the wearer's right lens (the
display lens on Meta Ray-Ban Display). Lenses are smoked and darken during the
push-in. For each frame we export the projected bounding box of the right lens
so the page can lock the HTML HUD to it.
"""

import argparse
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lens_rebuild import rebuild_lens  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

FRAMES = 360
ORBIT_START, ORBIT_END, PUSH_END = 30, 180, 359

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--variant", choices=["desktop", "mobile"], default="desktop")
ap.add_argument("--out", default="./frames")
ap.add_argument("--start", type=int, default=0)
ap.add_argument("--end", type=int, default=FRAMES - 1)
ap.add_argument("--step", type=int, default=1)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--coords-only", action="store_true")
args = ap.parse_args(argv)

scene = bpy.context.scene
MOBILE = args.variant == "mobile"


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (6 * t - 15) + 10)  # smootherstep


def lerp(a, b, t):
    return a + (b - a) * t


def vlerp(a, b, t):
    return a.lerp(b, t)


# ---------------------------------------------------------------- key poses
hero_pos = Vector((0.085, -0.4, 0.1))
hero_dir = Vector((0, 0, -1))
hero_dir.rotate(Euler((1.282, 0.0, 0.248), "XYZ"))
hero_target = hero_pos + hero_dir * hero_pos.length

lens_obj = bpy.data.objects["Right | clear curved lens"]
lens_center = sum((lens_obj.matrix_world @ Vector(c) for c in lens_obj.bound_box), Vector()) / 8
final_pos = Vector((lens_center.x, -0.14, lens_center.z))
final_target = Vector((lens_center.x, 0.5, lens_center.z))


def spherical(v):
    r = v.length
    return r, math.atan2(v.y, v.x), math.asin(v.z / r)


def from_spherical(r, az, el):
    return Vector((r * math.cos(el) * math.cos(az), r * math.cos(el) * math.sin(az), r * math.sin(el)))


r1, az1, el1 = spherical(hero_pos)
# Start behind and to the wearer's left, higher and further out.
r0, az0, el0 = 0.5, math.radians(-128), math.radians(24)

HERO_TARGET = Vector((0.0, -0.06, -0.004))  # visual centre incl. temples
FOCAL_HERO, FOCAL_INSIDE, FOCAL_FINAL = 52.0, 48.0, 48.0
FOCAL_FINAL_MOBILE = 70.0


def pose(f):
    """Camera position, look target and focal length for frame f."""
    if f <= ORBIT_START:
        # Hero: front three-quarter, a slow drift toward the orbit.
        t = f / ORBIT_START
        az = az0 + 0.04 * t
        return from_spherical(r0, az, el0), HERO_TARGET, FOCAL_HERO
    if f <= ORBIT_END:
        t = smooth((f - ORBIT_START) / (ORBIT_END - ORBIT_START))
        az = lerp(az0 + 0.04, az1, t)
        r = lerp(r0, r1, t)
        el = lerp(el0, el1, t)
        target = vlerp(HERO_TARGET, hero_target, t)
        return from_spherical(r, az, el), target, lerp(FOCAL_HERO, FOCAL_INSIDE, t)
    t = smooth((f - ORBIT_END) / (PUSH_END - ORBIT_END))
    pos = vlerp(hero_pos, final_pos, t)
    target = vlerp(hero_target, final_target, smooth(min(1.0, t * 1.15)))
    focal_end = FOCAL_FINAL_MOBILE if MOBILE else FOCAL_FINAL
    return pos, target, lerp(FOCAL_INSIDE, focal_end, t)


def smoke(f):
    """Lens opacity: light grey in the hero, deepening during the push-in."""
    if f <= ORBIT_END:
        return lerp(0.42, 0.5, smooth(f / ORBIT_END))
    return lerp(0.5, 0.9, smooth((f - ORBIT_END) / (PUSH_END - ORBIT_END)))


# ---------------------------------------------------------------- scene setup
cam_data = bpy.data.cameras.new("Facto scroll camera")
cam_data.sensor_width = 36.0
cam_data.sensor_fit = "HORIZONTAL"
cam_data.clip_start = 0.002
cam = bpy.data.objects.new("Facto scroll camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

if MOBILE:
    scene.render.resolution_x, scene.render.resolution_y = 900, 1600
else:
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.resolution_percentage = int(100 * args.scale)
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"

try:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.use_denoising = True
    scene.cycles.film_transparent_glass = True
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as exc:  # fall back to whatever the file uses
    print("cycles setup warning:", exc)

# Smoked lens material: dark, glossy, partly transparent. Alpha keeps the page
# background visible through the lens, so the HUD reads on any section colour.
smoke_mat = bpy.data.materials.new("Facto smoked lens")
smoke_mat.use_nodes = True
nt = smoke_mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Base Color"].default_value = (0.012, 0.012, 0.02, 1.0)
bsdf.inputs["Roughness"].default_value = 0.09  # soft, even reflections
bsdf.inputs["IOR"].default_value = 1.5
for name in ("Specular IOR Level", "Specular"):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = 0.6
        break
try:
    smoke_mat.surface_render_method = "BLENDED"
except AttributeError:
    pass
for name in ("Left | clear curved lens", "Right | clear curved lens"):
    obj = bpy.data.objects[name]
    obj.data.materials.clear()
    obj.data.materials.append(smoke_mat)
    rebuild_lens(obj)



def lens_box():
    """Projected right-lens bounding box in normalized image coords (top-left origin)."""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = lens_obj.evaluated_get(deps)
    mesh = ev.to_mesh()
    xs, ys = [], []
    for v in mesh.vertices:
        p = world_to_camera_view(scene, cam, ev.matrix_world @ v.co)
        xs.append(p.x)
        ys.append(1.0 - p.y)
    ev.to_mesh_clear()
    return [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)]


os.makedirs(args.out, exist_ok=True)
coords = {}
for f in range(args.start, args.end + 1, args.step):
    pos, target, focal = pose(f)
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = focal
    bsdf.inputs["Alpha"].default_value = smoke(f)
    scene.frame_set(f)
    bpy.context.view_layer.update()
    coords[f] = lens_box()
    if not args.coords_only:
        scene.render.filepath = os.path.join(args.out, f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)

with open(os.path.join(args.out, f"lens-{args.variant}-{args.start}-{args.end}.json"), "w") as fh:
    json.dump(coords, fh)
print("DONE", args.variant, len(coords))
