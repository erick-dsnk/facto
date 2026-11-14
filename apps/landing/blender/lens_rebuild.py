"""Rebuild the lens meshes as dense, even, smooth surfaces.

The source lenses are triangle fans, which shade as a pinwheel. We keep the
outline (convex hull of the lens seen from the front) and the curvature (a
quadratic surface fitted to the original vertices), and grid it densely.
"""

import math

import bmesh
import bpy
import numpy as np


def _hull(points):
    pts = sorted(map(tuple, points))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return np.array(lower[:-1] + upper[:-1])


def _ray_hull(c, hull, theta):
    d = np.array([math.cos(theta), math.sin(theta)])
    best = None
    n = len(hull)
    for i in range(n):
        a, b = hull[i], hull[(i + 1) % n]
        e = b - a
        m = np.array([[d[0], -e[0]], [d[1], -e[1]]])
        if abs(np.linalg.det(m)) < 1e-12:
            continue
        t, u = np.linalg.solve(m, a - c)
        if t > 0 and -1e-9 <= u <= 1 + 1e-9 and (best is None or t < best):
            best = t
    return c + d * best


def rebuild_lens(obj, rings=60, segments=192, thickness=0.0009):
    mw = obj.matrix_world
    v = np.array([tuple(mw @ p.co) for p in obj.data.vertices])  # world: x, y(depth), z
    xz = v[:, [0, 2]]
    # Curvature: y = f(x, z), quadratic least squares.
    x, z, y = v[:, 0], v[:, 2], v[:, 1]
    A = np.stack([np.ones_like(x), x, z, x * x, x * z, z * z], axis=1)
    coef, *_ = np.linalg.lstsq(A, y, rcond=None)
    f = lambda px, pz: coef @ np.array([1, px, pz, px * px, px * pz, pz * pz])

    hull = _hull(xz)
    c = xz.mean(axis=0)
    edge = [_ray_hull(c, hull, 2 * math.pi * s / segments) for s in range(segments)]

    bm = bmesh.new()
    center = bm.verts.new((c[0], f(*c), c[1]))
    prev = None
    grid = []
    for r in range(1, rings + 1):
        t = r / rings
        t = 1 - (1 - t) ** 1.6  # denser toward the rim
        ring = []
        for s in range(segments):
            p = c + (edge[s] - c) * t
            ring.append(bm.verts.new((p[0], f(p[0], p[1]), p[1])))
        grid.append(ring)
    for s in range(segments):
        bm.faces.new((center, grid[0][s], grid[0][(s + 1) % segments]))
    for r in range(rings - 1):
        for s in range(segments):
            a, b = grid[r][s], grid[r][(s + 1) % segments]
            bm.faces.new((a, grid[r + 1][s], grid[r + 1][(s + 1) % segments], b))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new(obj.data.name + " even")
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    for mat in obj.data.materials:
        mesh.materials.append(mat)
    obj.data = mesh
    obj.matrix_world = obj.matrix_world.__class__.Identity(4)  # vertices are in world space
    obj.modifiers.clear()
    sol = obj.modifiers.new("Facto lens thickness", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = 0
    sol.use_even_offset = True
