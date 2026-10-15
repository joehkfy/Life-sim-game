#!/usr/bin/env python3
"""Generate Life Sim's lightweight skinned Donghua-inspired humanoid GLB.

The asset is original procedural geometry made for this project. It uses a real
GLTF 2.0 skin (JOINTS_0/WEIGHTS_0 + inverse bind matrices) and named animation
clips so Three.js can animate it with AnimationMixer.
"""
from __future__ import annotations
import json, math, struct
from pathlib import Path
from typing import Callable
import numpy as np
from skimage.measure import marching_cubes

OUT = Path(__file__).resolve().parents[1] / "client/public/models/characters/life-sim-donghua-base.glb"
OUT.parent.mkdir(parents=True, exist_ok=True)

# Bone order is also the skin joint-index order.
BONES = [
    ("Hips", None, (0.0, 0.92, 0.0)),
    ("Spine", "Hips", (0.0, 0.02, 0.0)),
    ("Chest", "Spine", (0.0, 0.30, 0.0)),
    ("Neck", "Chest", (0.0, 0.30, 0.0)),
    ("Head", "Neck", (0.0, 0.13, 0.0)),
    ("Shoulder_L", "Chest", (-0.25, 0.17, 0.0)),
    ("UpperArm_L", "Shoulder_L", (-0.12, 0.0, 0.0)),
    ("LowerArm_L", "UpperArm_L", (-0.25, -0.34, 0.0)),
    ("Hand_L", "LowerArm_L", (-0.21, -0.22, 0.0)),
    ("Shoulder_R", "Chest", (0.25, 0.17, 0.0)),
    ("UpperArm_R", "Shoulder_R", (0.12, 0.0, 0.0)),
    ("LowerArm_R", "UpperArm_R", (0.25, -0.34, 0.0)),
    ("Hand_R", "LowerArm_R", (0.21, -0.22, 0.0)),
    ("UpperLeg_L", "Hips", (-0.12, -0.05, 0.0)),
    ("LowerLeg_L", "UpperLeg_L", (0.0, -0.42, 0.0)),
    ("Foot_L", "LowerLeg_L", (0.0, -0.38, 0.06)),
    ("UpperLeg_R", "Hips", (0.12, -0.05, 0.0)),
    ("LowerLeg_R", "UpperLeg_R", (0.0, -0.42, 0.0)),
    ("Foot_R", "LowerLeg_R", (0.0, -0.38, 0.06)),
]
# Finger chains give the hands enough articulation for believable gestures,
# typing, pointing, holding objects, and open/closed hand poses. Bone origins
# are aligned to the procedural hand geometry in the bind pose.
for side, sign in (("L", -1), ("R", 1)):
    BONES.append((f"ThumbBase_{side}", f"Hand_{side}", (-sign * 0.05, -0.065, 0.074)))
    BONES.append((f"ThumbTip_{side}", f"ThumbBase_{side}", (0.0, -0.032, 0.018)))
    for finger_index, finger_name in enumerate(("Index", "Middle", "Ring", "Pinky")):
        fx = sign * (0.795 + finger_index * 0.025)
        BONES.append((f"Finger_{finger_name}_Base_{side}", f"Hand_{side}", (fx - sign * 0.835, -0.08, 0.045)))
        BONES.append((f"Finger_{finger_name}_Tip_{side}", f"Finger_{finger_name}_Base_{side}", (0.0, -0.045, 0.0)))
# Secondary hair joints give longer hairstyles a little inertial follow-through.
BONES.append(("HairTip_L", "Head", (-0.205, -0.12, -0.025)))
BONES.append(("HairTip_R", "Head", (0.205, -0.12, -0.025)))
BONE_INDEX = {name: i for i, (name, _, _) in enumerate(BONES)}
BONE_NODE = {name: i + 1 for i, (name, _, _) in enumerate(BONES)} # node 0 is armature root
BONE_GLOBAL: dict[str, tuple[float,float,float]] = {}
for name, parent, tr in BONES:
    if parent is None:
        BONE_GLOBAL[name] = tr
    else:
        pp = BONE_GLOBAL[parent]
        BONE_GLOBAL[name] = (pp[0]+tr[0], pp[1]+tr[1], pp[2]+tr[2])

# Geometry buckets: (mesh node name, material name) -> primitive arrays.
buckets: dict[str, dict] = {}
shape_defs: dict[str, list[dict]] = {}
MATERIALS = {
    "Mat_Skin": ([0.73, 0.49, 0.35, 1], 0.82),
    "Mat_FingerSkin": ([0.73, 0.49, 0.35, 1], 0.82),
    "Mat_SkinOverlay": ([0.73, 0.49, 0.35, 1], 0.82),
    "Mat_Shirt": ([0.10, 0.30, 0.72, 1], 0.78),
    "Mat_Pants": ([0.08, 0.12, 0.19, 1], 0.84),
    "Mat_Hair": ([0.10, 0.055, 0.035, 1], 0.9),
    "Mat_EyeWhite": ([0.96, 0.96, 0.93, 1], 0.42),
    "Mat_Iris": ([0.20, 0.35, 0.55, 1], 0.36),
    "Mat_Pupil": ([0.025, 0.022, 0.026, 1], 0.26),
    "Mat_Mouth": ([0.31, 0.075, 0.09, 1], 0.72),
    "Mat_Accent": ([0.90, 0.86, 0.74, 1], 0.65),
    "Mat_Shoe": ([0.055, 0.07, 0.10, 1], 0.54),
    "Mat_Sole": ([0.88, 0.88, 0.84, 1], 0.78),
    "Mat_Brow": ([0.09, 0.045, 0.03, 1], 0.9),
    "Mat_Buckle": ([0.76, 0.56, 0.23, 1], 0.3),
}

def bucket(group: str, mat: str) -> dict:
    # Merge ordinary geometry by material so a nearby character uses only a
    # small number of draw calls. Hair silhouettes stay separate so the
    # appearance selector can enable one hairstyle at runtime.
    key = group if group.startswith('HairStyle_') else mat
    mesh_name = group if group.startswith('HairStyle_') else f"Mesh_{mat.replace('Mat_', '')}"
    if key not in buckets:
        buckets[key] = {"name": mesh_name, "material": mat, "positions": [], "normals": [], "joints": [], "weights": [], "indices": []}
    return buckets[key]

def normalize(v):
    l = math.sqrt(sum(x*x for x in v)) or 1.0
    return tuple(x/l for x in v)

def rotate_xyz(v, rot):
    x,y,z = v; rx,ry,rz = rot
    # X, then Y, then Z
    cy,sy = math.cos(rx), math.sin(rx)
    y,z = y*cy-z*sy, y*sy+z*cy
    cx,sx = math.cos(ry), math.sin(ry)
    x,z = x*cx+z*sx, -x*sx+z*cx
    cz,sz = math.cos(rz), math.sin(rz)
    x,y = x*cz-y*sz, x*sz+y*cz
    return (x,y,z)

def weights_for(bones, t=0.0):
    """Return the most relevant bone indices and normalized weights."""
    if isinstance(bones, str):
        return [(BONE_INDEX[bones], 1.0)]
    # bone pair and blend parameter: (proximal, distal, distal_weight)
    a,b,w = bones
    return [(BONE_INDEX[a], max(0.0,1-w)), (BONE_INDEX[b], max(0.0,w))]

def add_ellipsoid(group, mat, center, scale, bone, segments=16, rings=12, rot=(0,0,0), weight_fn: Callable|None=None):
    b = bucket(group, mat)
    key = group if group.startswith("HairStyle_") else mat
    shape_defs.setdefault(key, []).append({"center": center, "scale": scale, "bone": bone, "rot": rot, "weight_fn": weight_fn})
    base = len(b["positions"])
    cx,cy,cz = center; sx,sy,sz = scale
    for j in range(rings+1):
        theta = math.pi*j/rings
        st,ct = math.sin(theta), math.cos(theta)
        for i in range(segments+1):
            phi = 2*math.pi*i/segments
            ux,uy,uz = st*math.cos(phi), ct, st*math.sin(phi)
            p_local = (sx*ux, sy*uy, sz*uz)
            p_rot = rotate_xyz(p_local, rot)
            p = (cx+p_rot[0], cy+p_rot[1], cz+p_rot[2])
            n_local = normalize((ux/max(sx,1e-6), uy/max(sy,1e-6), uz/max(sz,1e-6)))
            n = normalize(rotate_xyz(n_local, rot))
            b["positions"].append(p); b["normals"].append(n)
            if weight_fn:
                wlist = weight_fn(p)
            elif isinstance(bone, str):
                wlist = [(BONE_INDEX[bone],1.0)]
            else:
                wlist = weights_for(bone)
            wlist = sorted(wlist, key=lambda it: it[1], reverse=True)[:4]
            total = sum(w for _,w in wlist) or 1.0
            wlist = [(idx,w/total) for idx,w in wlist]
            ji = [0,0,0,0]; jw = [0.0,0.0,0.0,0.0]
            for k,(idx,w) in enumerate(wlist): ji[k],jw[k] = idx,w
            b["joints"].append(ji); b["weights"].append(jw)
    for j in range(rings):
        for i in range(segments):
            a = base + j*(segments+1)+i
            c = a + segments+1
            b["indices"].extend([a, a+1, c, a+1, c+1, c])

# Weight ramps by height to soften the body joints.
def torso_weights(p):
    y=p[1]
    if y < 1.00: return [(BONE_INDEX['Hips'],.68),(BONE_INDEX['Spine'],.32)]
    if y < 1.18:
        t=(y-1.0)/.18
        return [(BONE_INDEX['Hips'],.45*(1-t)),(BONE_INDEX['Spine'],.55+.15*t),(BONE_INDEX['Chest'],.30*t)]
    t=min(1,max(0,(y-1.18)/.30))
    return [(BONE_INDEX['Spine'],.55*(1-t)),(BONE_INDEX['Chest'],.45+.55*t)]

def leg_weights(side, lower=False):
    up=f'UpperLeg_{side}'; low=f'LowerLeg_{side}'; foot=f'Foot_{side}'
    def fn(p):
        y=p[1]
        if y > 0.52:
            t=min(1,max(0,(0.67-y)/0.18))
            return [(BONE_INDEX[up],1-t*.55),(BONE_INDEX[low],t*.55)]
        t=min(1,max(0,(0.52-y)/0.20))
        return [(BONE_INDEX[low],1-t*.8),(BONE_INDEX[foot],t*.8)]
    return fn

def arm_weights(side, lower=False):
    up=f'UpperArm_{side}'; low=f'LowerArm_{side}'; hand=f'Hand_{side}'
    def fn(p):
        # The elbow is roughly x=+/-.62 and the wrist x=+/-.83.
        outward = abs(p[0])
        if outward < .53: return [(BONE_INDEX[up], .8),(BONE_INDEX[low],.2)]
        if outward < .72:
            t=(outward-.53)/.19
            return [(BONE_INDEX[up],1-t),(BONE_INDEX[low],t)]
        t=min(1,max(0,(outward-.72)/.13))
        return [(BONE_INDEX[low],1-t),(BONE_INDEX[hand],t)]
    return fn

# Body and clothes: smooth overlapping shapes, not separate primitive blocks.
add_ellipsoid('Torso', 'Mat_Shirt', (0,1.205,0), (.285,.365,.185), 'Chest', 24,16, weight_fn=torso_weights)
add_ellipsoid('Torso', 'Mat_Shirt', (0,1.405,0), (.295,.145,.18), 'Chest', 20,12, weight_fn=torso_weights)
# Rounded shoulder caps make the shirt silhouette join the upper arms cleanly.
add_ellipsoid('Shoulders', 'Mat_Shirt', (-.245,1.365,0), (.15,.15,.15), 'Chest', 18,12)
add_ellipsoid('Shoulders', 'Mat_Shirt', (.245,1.365,0), (.15,.15,.15), 'Chest', 18,12)
add_ellipsoid('Collar', 'Mat_Accent', (0,1.505,.012), (.112,.047,.102), 'Neck', 16,8)
add_ellipsoid('Hips_Clothing', 'Mat_Pants', (0,.88,0), (.245,.18,.16), 'Hips', 20,12)
add_ellipsoid('Hips_Clothing', 'Mat_Accent', (0,.965,.012), (.249,.035,.164), 'Hips', 18,8)
add_ellipsoid('Hips_Clothing', 'Mat_Buckle', (0,.966,.177), (.048,.035,.015), 'Hips', 12,8)
# A shirt front seam and buttons for a tailored look.
add_ellipsoid('Shirt_Details', 'Mat_Accent', (0,1.205,.179), (.012,.22,.009), 'Chest', 10,10)
for y in [1.13,1.22,1.31]:
    add_ellipsoid('Shirt_Details', 'Mat_Buckle', (0,y,.190), (.011,.011,.006), 'Chest', 8,6)
# Neck and head.
add_ellipsoid('Neck', 'Mat_Skin', (0,1.505,0), (.098,.145,.095), 'Neck', 16,10)
add_ellipsoid('Head', 'Mat_Skin', (0,1.685,.005), (.238,.30,.218), 'Head', 24,18)
add_ellipsoid('Head_Details', 'Mat_Skin', (-.235,1.675,0), (.047,.068,.045), 'Head', 14,10)
add_ellipsoid('Head_Details', 'Mat_Skin', (.235,1.675,0), (.047,.068,.045), 'Head', 14,10)
add_ellipsoid('Head_Details', 'Mat_Skin', (0,1.622,.211), (.032,.045,.039), 'Head', 14,10)
# Eyes, large but not chibi; brows and mouth.
for x in [-.082,.082]:
    add_ellipsoid('Face_Whites', 'Mat_EyeWhite', (x,1.707,.193), (.050,.068,.025), 'Head', 16,12)
    add_ellipsoid('Face_Iris', 'Mat_Iris', (x,1.704,.215), (.027,.043,.013), 'Head', 14,10)
    add_ellipsoid('Face_Pupils', 'Mat_Pupil', (x,1.703,.226), (.014,.029,.008), 'Head', 12,8)
    add_ellipsoid('Face_Highlights', 'Mat_EyeWhite', (x-.006,1.72,.233), (.006,.010,.004), 'Head', 8,6)
    add_ellipsoid('Face_Brows', 'Mat_Brow', (x,1.785,.195), (.055,.014,.013), 'Head', 12,6, rot=(0,0, -0.08 if x<0 else 0.08))
    # Separate upper lids can slide down with the eye morph target during blinks.
    add_ellipsoid('Face_UpperLids', 'Mat_SkinOverlay', (x,1.752,.213), (.055,.024,.014), 'Head', 14,8)
add_ellipsoid('Face_Mouth', 'Mat_Mouth', (0,1.565,.210), (.043,.011,.009), 'Head', 12,8)
# Base hair cap and rear hair.
add_ellipsoid('Hair_Base', 'Mat_Hair', (0,1.855,-.005), (.25,.17,.225), 'Head', 22,14)
add_ellipsoid('Hair_Base', 'Mat_Hair', (0,1.735,-.145), (.225,.22,.095), 'Head', 18,12)
# Four selectable front/side silhouettes (the runtime shows one at a time).
# Style 0: short swept bangs.
add_ellipsoid('HairStyle_0', 'Mat_Hair', (-.095,1.855,.169), (.105,.085,.078), 'Head', 14,10, rot=(0,0,-.30))
add_ellipsoid('HairStyle_0', 'Mat_Hair', (.02,1.825,.205), (.082,.09,.06), 'Head', 14,10, rot=(0,0,.12))
# Style 1: neat fringe plus ear-length side locks.
add_ellipsoid('HairStyle_1', 'Mat_Hair', (-.07,1.85,.168), (.11,.075,.075), 'Head', 14,10, rot=(0,0,-.12))
add_ellipsoid('HairStyle_1', 'Mat_Hair', (.075,1.85,.168), (.11,.075,.075), 'Head', 14,10, rot=(0,0,.12))
for x in [-.205,.205]: add_ellipsoid('HairStyle_1','Mat_Hair',(x,1.60,-.005),(.055,.20,.07),'HairTip_L' if x < 0 else 'HairTip_R',12,10,rot=(0,0,x*.9))
# Style 2: longer hair at the back and sides.
add_ellipsoid('HairStyle_2', 'Mat_Hair', (-.10,1.85,.16), (.12,.085,.07), 'Head', 14,10, rot=(0,0,-.24))
add_ellipsoid('HairStyle_2', 'Mat_Hair', (.04,1.83,.19), (.10,.10,.065), 'Head', 14,10, rot=(0,0,.14))
for x in [-.205,.205]: add_ellipsoid('HairStyle_2','Mat_Hair',(x,1.49,-.025),(.07,.31,.075),'HairTip_L' if x < 0 else 'HairTip_R',14,10,rot=(0,0,x*.35))
# Style 3: lifted top spikes.
add_ellipsoid('HairStyle_3', 'Mat_Hair', (-.095,1.865,.17), (.08,.085,.065), 'Head', 12,10,rot=(0,0,-.40))
add_ellipsoid('HairStyle_3', 'Mat_Hair', (0,1.88,.17), (.075,.12,.06), 'Head', 12,10,rot=(0,0,.04))
add_ellipsoid('HairStyle_3', 'Mat_Hair', (.095,1.855,.15), (.08,.085,.065), 'Head', 12,10,rot=(0,0,.40))
# Arms, gloves/hands and fingers. Arm weights blend across elbow/wrist.
for side,sgn in [('L',-1),('R',1)]:
    add_ellipsoid(f'UpperArm_{side}', 'Mat_Shirt', (sgn*.495,1.24,0), (.12,.265,.115), f'UpperArm_{side}', 16,12, rot=(0,0,sgn*.63), weight_fn=arm_weights(side))
    add_ellipsoid(f'Forearm_{side}', 'Mat_Shirt', (sgn*.72,.96,.005), (.085,.225,.088), f'LowerArm_{side}', 16,12, rot=(0,0,sgn*.76), weight_fn=arm_weights(side, True))
    add_ellipsoid(f'Cuff_{side}', 'Mat_Accent', (sgn*.79,.865,.005), (.085,.038,.086), f'LowerArm_{side}', 12,8, rot=(0,0,sgn*.76), weight_fn=arm_weights(side, True))
    add_ellipsoid(f'Hand_{side}', 'Mat_Skin', (sgn*.835,.80,.018), (.078,.075,.073), f'Hand_{side}', 14,10)
    finger_names = ("Index", "Middle", "Ring", "Pinky")
    for fi, finger_name in enumerate(finger_names):
        fx=sgn*(.795+fi*.025)
        base_bone = f'Finger_{finger_name}_Base_{side}'
        tip_bone = f'Finger_{finger_name}_Tip_{side}'
        # Two overlapping segments keep the fingers readable while allowing
        # the distal joints to curl independently.
        add_ellipsoid(f'Finger_{side}_{fi}_Base', 'Mat_FingerSkin', (fx,.748,.045), (.014,.039,.018), base_bone, 10,8, rot=(0,0,sgn*.08))
        add_ellipsoid(f'Finger_{side}_{fi}_Tip', 'Mat_FingerSkin', (fx,.708,.045), (.013,.027,.017), tip_bone, 10,8, rot=(0,0,sgn*.08))
    add_ellipsoid(f'Thumb_{side}_Base', 'Mat_FingerSkin', (sgn*.785,.785,.092), (.020,.029,.021), f'ThumbBase_{side}', 10,8, rot=(.1,0,sgn*.6))
    add_ellipsoid(f'Thumb_{side}_Tip', 'Mat_FingerSkin', (sgn*.776,.755,.112), (.017,.024,.018), f'ThumbTip_{side}', 10,8, rot=(.15,0,sgn*.48))
# Legs, trousers, shoes and soles.
for side,sgn in [('L',-1),('R',1)]:
    wf=leg_weights(side)
    add_ellipsoid(f'Thigh_{side}', 'Mat_Pants', (sgn*.12,.665,0), (.13,.285,.135), f'UpperLeg_{side}', 16,12, weight_fn=wf)
    add_ellipsoid(f'Knee_{side}', 'Mat_Pants', (sgn*.12,.475,.006), (.103,.115,.105), f'LowerLeg_{side}', 14,10, weight_fn=wf)
    add_ellipsoid(f'Shin_{side}', 'Mat_Pants', (sgn*.12,.31,0), (.092,.20,.103), f'LowerLeg_{side}', 16,12, weight_fn=wf)
    add_ellipsoid(f'Sock_{side}', 'Mat_Accent', (sgn*.12,.13,.005), (.09,.055,.10), f'Foot_{side}', 12,8)
    add_ellipsoid(f'Shoe_{side}', 'Mat_Shoe', (sgn*.12,.085,.055), (.112,.078,.18), f'Foot_{side}', 16,10)
    add_ellipsoid(f'Sole_{side}', 'Mat_Sole', (sgn*.12,.035,.07), (.113,.026,.178), f'Foot_{side}', 16,8)
    add_ellipsoid(f'Shoe_Tongue_{side}', 'Mat_Accent', (sgn*.12,.117,.17), (.043,.023,.054), f'Foot_{side}', 10,8)

# Union the large clothing/body surfaces to eliminate the visible capsule seams.
# Small facial details, fingers, shoes and hair clumps remain separate surfaces.
def analytic_weights(mat, p):
    x,y,z = p
    if mat == "Mat_Shirt":
        if abs(x) > 0.31:
            return arm_weights("L" if x < 0 else "R")(p)
        return torso_weights(p)
    if mat == "Mat_Pants":
        if y < 0.82 and abs(x) > 0.045:
            return leg_weights("L" if x < 0 else "R")(p)
        return [(BONE_INDEX["Hips"], 1.0)]
    if mat == "Mat_Skin":
        if y > 1.565:
            return [(BONE_INDEX["Head"], 1.0)]
        if y > 1.36:
            t = min(1.0, max(0.0, (y - 1.36) / 0.20))
            return [(BONE_INDEX["Neck"], 1.0-t), (BONE_INDEX["Head"], t)]
        if abs(x) > 0.57:
            return arm_weights("L" if x < 0 else "R")(p)
        return [(BONE_INDEX["Neck"], 1.0)]
    return [(BONE_INDEX["Head"], 1.0)]

def union_surface(key, pitch=0.016):
    shapes = shape_defs[key]
    # Padded world-space bounds; the main materials contain torso/limbs/head.
    mins=[]; maxs=[]
    for sh in shapes:
        c=np.asarray(sh["center"], dtype=np.float32)
        s=np.asarray(sh["scale"], dtype=np.float32)
        pad=s*1.13 + pitch*2
        mins.append(c-pad); maxs.append(c+pad)
    lo=np.min(np.vstack(mins),axis=0); hi=np.max(np.vstack(maxs),axis=0)
    axes=[np.arange(float(lo[i]), float(hi[i])+pitch*0.51, pitch, dtype=np.float32) for i in range(3)]
    X,Y,Z=np.meshgrid(axes[0],axes[1],axes[2], indexing="ij")
    field=np.full(X.shape, 1e6, dtype=np.float32)
    for sh in shapes:
        cx,cy,cz=sh["center"]; sx,sy,sz=sh["scale"]
        dx=X-cx; dy=Y-cy; dz=Z-cz
        rx,ry,rz=sh["rot"]
        # Inverse rotation to evaluate the ellipsoid's local signed-distance approximation.
        if rx or ry or rz:
            # For this asset the unioned body parts use zero/near-zero rotations.
            cyaw,syaw=math.cos(-ry),math.sin(-ry)
            dx,dz=dx*cyaw+dz*syaw, -dx*syaw+dz*cyaw
            cxr,sxr=math.cos(-rx),math.sin(-rx)
            dy,dz=dy*cxr-dz*sxr, dy*sxr+dz*cxr
            czr,szr=math.cos(-rz),math.sin(-rz)
            dx,dy=dx*czr-dy*szr, dx*szr+dy*czr
        k0=np.sqrt((dx/sx)**2+(dy/sy)**2+(dz/sz)**2)
        k1=np.sqrt((dx/(sx*sx))**2+(dy/(sy*sy))**2+(dz/(sz*sz))**2)
        sd=np.where(k1>1e-7, k0*(k0-1.0)/np.maximum(k1,1e-7), (k0-1.0)*min(sx,sy,sz))
        np.minimum(field, sd, out=field)
    verts, faces, normals, _ = marching_cubes(field, level=0.0, spacing=(pitch,pitch,pitch), gradient_direction="ascent")
    verts += lo
    return verts.astype(np.float32), faces.astype(np.uint32), normals.astype(np.float32)

for key in ("Mat_Shirt", "Mat_Pants", "Mat_Skin", "Mat_Hair"):
    if key not in buckets or not shape_defs.get(key):
        continue
    verts, faces, normals = union_surface(key)
    data=buckets[key]
    data["positions"]=[tuple(map(float,p)) for p in verts]
    data["normals"]=[tuple(map(float,n)) for n in normals]
    data["joints"]=[]; data["weights"]=[]
    for p in verts:
        raw=sorted(analytic_weights(key, p), key=lambda it:it[1], reverse=True)[:4]
        total=sum(w for _,w in raw) or 1.0
        ji=[0,0,0,0]; jw=[0.0,0.0,0.0,0.0]
        for k,(idx,w) in enumerate(raw): ji[k],jw[k]=idx,w/total
        data["joints"].append(ji); data["weights"].append(jw)
    data["indices"]=faces.reshape(-1).tolist()

# Skeleton hierarchy / nodes.
children: dict[str,list[int]] = {name: [] for name,_,_ in BONES}
for i,(name,parent,tr) in enumerate(BONES):
    if parent: children[parent].append(BONE_NODE[name])
root_children = [BONE_NODE['Hips']]
# inverse bind matrices: inverse of each joint's global bind transform, column-major

def inverse_translation_matrix(pos):
    x,y,z=pos
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, -x,-y,-z,1]

# binary buffer and accessors
bin_data = bytearray()
buffer_views=[]; accessors=[]

def align4():
    while len(bin_data)%4: bin_data.append(0)

def add_accessor(data: bytes, component_type: int, count: int, typ: str, target=None, minv=None, maxv=None):
    align4(); offset=len(bin_data); bin_data.extend(data)
    view={"buffer":0,"byteOffset":offset,"byteLength":len(data)}
    if target is not None: view["target"]=target
    view_idx=len(buffer_views); buffer_views.append(view)
    acc={"bufferView":view_idx,"componentType":component_type,"count":count,"type":typ}
    if minv is not None: acc["min"]=minv
    if maxv is not None: acc["max"]=maxv
    idx=len(accessors); accessors.append(acc); return idx

def pack_floats(vals): return struct.pack('<'+'f'*len(vals), *vals)
def pack_ushorts(vals): return struct.pack('<'+'H'*len(vals), *vals)

# Create material defs in stable order.
material_names=list(MATERIALS.keys())
material_idx={n:i for i,n in enumerate(material_names)}
gltf_meshes=[]; mesh_nodes=[]
for group,data in buckets.items():
    pos=data['positions']; nor=data['normals']; joints=data['joints']; weights=data['weights']; inds=data['indices']
    if not pos or not inds: continue
    # local index buffers start at zero per group
    pos_flat=[v for p in pos for v in p]; nor_flat=[v for p in nor for v in p]
    joints_flat=[v for j in joints for v in j]; weights_flat=[v for w in weights for v in w]
    idx_max=max(inds)
    pmin=[min(p[i] for p in pos) for i in range(3)]; pmax=[max(p[i] for p in pos) for i in range(3)]
    pacc=add_accessor(pack_floats(pos_flat),5126,len(pos),'VEC3',34962,pmin,pmax)
    nacc=add_accessor(pack_floats(nor_flat),5126,len(nor),'VEC3',34962)
    jacc=add_accessor(pack_ushorts(joints_flat),5123,len(joints),'VEC4',34962)
    wacc=add_accessor(pack_floats(weights_flat),5126,len(weights),'VEC4',34962)
    iacc=add_accessor(pack_ushorts(inds),5123,len(inds),'SCALAR',34963,[min(inds)],[max(inds)])
    mi=material_idx[data['material']]
    mesh_name = data['name']
    target_specs: list[tuple[str, list[tuple[float, float, float]]]] = []
    # Small glTF morph targets support natural blinking and readable expressions
    # without a heavy face rig. Deltas are authored around the facial features.
    if mesh_name in ("Mesh_EyeWhite", "Mesh_Iris", "Mesh_Pupil"):
        deltas=[]
        for x,y,z in pos:
            if abs(x) < 0.15 and 1.625 < y < 1.79 and z > 0.17:
                deltas.append((0.0, (1.707 + (y - 1.707) * 0.045) - y, 0.0))
            else:
                deltas.append((0.0,0.0,0.0))
        target_specs.append(("Blink", deltas))
    elif mesh_name == "Mesh_SkinOverlay":
        deltas=[]
        for x,y,z in pos:
            deltas.append((0.0, (1.707 - y) * 0.92 if abs(x) < 0.15 and z > 0.19 else 0.0, 0.0))
        target_specs.append(("Blink", deltas))
    elif mesh_name == "Mesh_Mouth":
        opened=[]; smiling=[]
        for x,y,z in pos:
            if abs(x) < 0.05 and 1.54 < y < 1.59 and z > 0.19:
                opened.append((0.0, (y - 1.565) * 1.7, 0.0))
                smiling.append((0.0, 0.010 * (abs(x) / 0.043) ** 1.5, 0.0))
            else:
                opened.append((0.0,0.0,0.0)); smiling.append((0.0,0.0,0.0))
        target_specs.extend([("MouthOpen", opened), ("Smile", smiling)])
    elif mesh_name == "Mesh_Brow":
        up=[]; frown=[]
        for x,y,z in pos:
            if abs(x) < 0.15 and 1.76 < y < 1.81 and z > 0.18:
                up.append((0.0, 0.018, 0.0))
                # The inner edge of each brow drops slightly for a focused look.
                inner = max(0.0, 1.0 - abs(x) / 0.15)
                frown.append((0.0, -0.010 * inner, 0.0))
            else:
                up.append((0.0,0.0,0.0)); frown.append((0.0,0.0,0.0))
        target_specs.extend([("BrowUp", up), ("BrowFrown", frown)])

    targets=[]
    target_names=[]
    for target_name, deltas in target_specs:
        delta_flat=[v for point in deltas for v in point]
        target_acc=add_accessor(pack_floats(delta_flat),5126,len(pos),'VEC3',34962)
        targets.append({"POSITION":target_acc})
        target_names.append(target_name)
    primitive={"attributes":{"POSITION":pacc,"NORMAL":nacc,"JOINTS_0":jacc,"WEIGHTS_0":wacc},"indices":iacc,"material":mi,"mode":4}
    if targets:
        primitive["targets"]=targets
    mesh_entry={"name":mesh_name,"primitives":[primitive]}
    if target_names:
        mesh_entry["weights"]=[0.0 for _ in target_names]
        mesh_entry["extras"]={"targetNames":target_names}
    gltf_meshes.append(mesh_entry)
    mesh_nodes.append({"name":mesh_name,"mesh":len(gltf_meshes)-1,"skin":0})

# node indexing: root node, bone nodes in order, then mesh nodes
nodes=[{"name":"LifeSim_ArmatureRoot","children":root_children+[len(BONES)+1+i for i in range(len(mesh_nodes))]}]
for name,parent,tr in BONES:
    node={"name":name,"translation":list(tr)}
    if children[name]: node['children']=children[name]
    nodes.append(node)
for mn in mesh_nodes: nodes.append(mn)

# Animation helpers. Rotations are quaternions from Euler XYZ.
def quat_xyz(rx,ry,rz):
    # Three.js Euler XYZ quaternion formula.
    c1,c2,c3=math.cos(rx/2),math.cos(ry/2),math.cos(rz/2)
    s1,s2,s3=math.sin(rx/2),math.sin(ry/2),math.sin(rz/2)
    return (s1*c2*c3+c1*s2*s3, c1*s2*c3-s1*c2*s3, c1*c2*s3+s1*s2*c3, c1*c2*c3-s1*s2*s3)

def animation_clip(name, duration, key_times, pose_fn, loop=True):
    samplers=[]; channels=[]
    time_acc=add_accessor(pack_floats(key_times),5126,len(key_times),'SCALAR',None,[min(key_times)],[max(key_times)])
    animated_bones=set()
    for t in key_times:
        pose=pose_fn(t, duration)
        animated_bones.update(pose.keys())
    for bn in sorted(animated_bones, key=lambda n:BONE_INDEX[n]):
        pose=pose_fn
        quats=[]
        for t in key_times:
            vals=pose_fn(t,duration).get(bn,(0,0,0))
            q=quat_xyz(*vals); quats.extend(q)
        out_acc=add_accessor(pack_floats(quats),5126,len(key_times),'VEC4')
        sampler_idx=len(samplers); samplers.append({"input":time_acc,"output":out_acc,"interpolation":"LINEAR"})
        channels.append({"sampler":sampler_idx,"target":{"node":BONE_NODE[bn],"path":"rotation"}})
    return {"name":name,"samplers":samplers,"channels":channels}

def cyclic_pose(base_fn):
    def f(t,d): return base_fn((t/d)*2*math.pi)
    return f

def hand_pose(side, curl=0.0, spread=0.0, thumb=0.0):
    """Finger rotations for light interaction gestures on the extended hand rig."""
    pose = {}
    sign = -1 if side == "L" else 1
    for index, name in enumerate(("Index", "Middle", "Ring", "Pinky")):
        fan = (index - 1.5) * spread * sign
        pose[f"Finger_{name}_Base_{side}"] = (-0.38 * curl, 0.0, fan)
        pose[f"Finger_{name}_Tip_{side}"] = (-0.32 * curl, 0.0, fan * 0.45)
    pose[f"ThumbBase_{side}"] = (0.08 * thumb, 0.0, sign * (0.18 - 0.25 * curl))
    pose[f"ThumbTip_{side}"] = (0.05 * thumb, 0.0, sign * (0.12 - 0.18 * curl))
    return pose

def pointing_hand_pose(side="R"):
    """Keep the index finger extended while the remaining fingers curl."""
    pose = hand_pose(side, curl=0.78, spread=0.0, thumb=0.3)
    pose[f"Finger_Index_Base_{side}"] = (0.0, 0.0, 0.0)
    pose[f"Finger_Index_Tip_{side}"] = (0.0, 0.0, 0.0)
    return pose

clips=[]
# idle breathing and low-intensity look movement
clips.append(animation_clip('Idle',2.2,[0,.55,1.1,1.65,2.2],cyclic_pose(lambda a:{
    'Hips':(.004*math.sin(a),0,.012*math.sin(a*.5)),
    'Spine':(.010*math.sin(a),0,.010*math.sin(a*.5)),
    'Chest':(.020*math.sin(a),0,.010*math.cos(a)),
    'Neck':(.004*math.sin(a*.6),.008*math.sin(a*.45),0),
    'Head':(.012*math.sin(a*.5),.018*math.sin(a*.35),.006*math.sin(a*.7)),
    'Shoulder_L':(.010*math.sin(a),0,0),'Shoulder_R':(.010*math.sin(a),0,0),
})))
# walk/run gait, sampled every quarter-cycle with opposing limb swings
# Locomotion clips use a shared phase convention. Starting near the passing
# pose (rather than a feet-together pose) makes start/loop blends much cleaner.
def walk_pose(a):
    phase = a + math.pi / 2
    left = math.sin(phase)
    right = math.sin(phase + math.pi)
    return {
        'Hips':(.012*math.sin(phase*2),0,.018*math.sin(phase)),
        'UpperLeg_L':(.38*left,0,0), 'UpperLeg_R':(.38*right,0,0),
        'LowerLeg_L':(.50*max(0,left),0,0), 'LowerLeg_R':(.50*max(0,right),0,0),
        'UpperArm_L':(-.30*left,0,.015*math.sin(phase)), 'UpperArm_R':(-.30*right,0,-.015*math.sin(phase)),
        'LowerArm_L':(-.12*max(0,-left),0,0), 'LowerArm_R':(-.12*max(0,-right),0,0),
        'Spine':(.012*math.sin(phase*2),0,0),
        'Chest':(.025,0,.014*math.sin(phase*2)), 'Head':(-.015,0,.006*math.sin(phase)),
    }

def run_pose(a):
    phase = a + math.pi / 2
    left = math.sin(phase)
    right = math.sin(phase + math.pi)
    return {
        'Hips':(.028*math.sin(phase*2),0,.022*math.sin(phase)),
        'UpperLeg_L':(.66*left,0,0), 'UpperLeg_R':(.66*right,0,0),
        'LowerLeg_L':(.83*max(0,left),0,0), 'LowerLeg_R':(.83*max(0,right),0,0),
        'UpperArm_L':(-.50*left,0,.02*math.sin(phase)), 'UpperArm_R':(-.50*right,0,-.02*math.sin(phase)),
        'LowerArm_L':(-.30,0,0), 'LowerArm_R':(-.30,0,0),
        'Spine':(.04,0,0), 'Chest':(.095,0,.02*math.sin(phase*2)), 'Head':(-.045,0,.008*math.sin(phase)),
    }

clips.append(animation_clip('Walk',1.0,[0,.25,.5,.75,1.0],cyclic_pose(walk_pose)))
clips.append(animation_clip('Run',.68,[0,.17,.34,.51,.68],cyclic_pose(run_pose)))
# Short anticipatory steps and deceleration poses smooth the transition from
# standing to locomotion and back. Their end poses line up with the loop phase.
def start_walk_pose(t, d):
    p = min(1.0, max(0.0, t / d))
    phase = p * math.pi / 2
    left = math.sin(phase); right = math.sin(phase + math.pi)
    return {
        'Hips':(.012*math.sin(phase*2),0,.015*math.sin(phase)),
        'UpperLeg_L':(.38*left,0,0), 'UpperLeg_R':(.38*right,0,0),
        'LowerLeg_L':(.50*max(0,left),0,0), 'LowerLeg_R':(.50*max(0,right),0,0),
        'UpperArm_L':(-.30*left,0,0), 'UpperArm_R':(-.30*right,0,0),
        'Spine':(.015*p,0,0), 'Chest':(.025,0,.01*math.sin(phase*2)), 'Head':(-.012*p,0,0),
    }

def stop_walk_pose(t, d):
    p = 1.0 - min(1.0, max(0.0, t / d))
    return start_walk_pose(p * d, d)

def start_run_pose(t, d):
    p = min(1.0, max(0.0, t / d))
    phase = p * math.pi / 2
    left = math.sin(phase); right = math.sin(phase + math.pi)
    return {
        'Hips':(.025*math.sin(phase*2),0,.02*math.sin(phase)),
        'UpperLeg_L':(.66*left,0,0), 'UpperLeg_R':(.66*right,0,0),
        'LowerLeg_L':(.83*max(0,left),0,0), 'LowerLeg_R':(.83*max(0,right),0,0),
        'UpperArm_L':(-.50*left,0,0), 'UpperArm_R':(-.50*right,0,0),
        'LowerArm_L':(-.30*p,0,0), 'LowerArm_R':(-.30*p,0,0),
        'Spine':(.04*p,0,0), 'Chest':(.095*p,0,.015*math.sin(phase*2)), 'Head':(-.04*p,0,0),
    }

def stop_run_pose(t, d):
    p = 1.0 - min(1.0, max(0.0, t / d))
    return start_run_pose(p * d, d)

clips.append(animation_clip('WalkStart',.34,[0,.085,.17,.255,.34],start_walk_pose))
clips.append(animation_clip('WalkStop',.30,[0,.075,.15,.225,.30],stop_walk_pose))
clips.append(animation_clip('RunStart',.30,[0,.075,.15,.225,.30],start_run_pose))
clips.append(animation_clip('RunStop',.28,[0,.07,.14,.21,.28],stop_run_pose))
# A small, occasional look-around makes idle characters feel attentive without
# requiring a full facial blendshape rig.
clips.append(animation_clip('IdleLook',1.45,[0,.24,.52,.78,1.08,1.45],lambda t,d:{
    'Spine':(.006*math.sin(t*2),0,.035*math.sin(math.pi*t/d)),
    'Chest':(.008,0,.025*math.sin(math.pi*t/d)),
    'Neck':(.015*math.sin(math.pi*t/d),.09*math.sin(math.pi*t/d),0),
    'Head':(.025*math.sin(t*3),.16*math.sin(math.pi*t/d),.015*math.sin(t*2)),
}))
# helpers for seated poses
SEATED = {'UpperLeg_L':(-1.25,0,0),'UpperLeg_R':(-1.25,0,0),'LowerLeg_L':(1.15,0,0),'LowerLeg_R':(1.15,0,0),'Chest':(.04,0,0)}
def make_pose(**kw):
    d=dict(SEATED)
    d.update(kw)
    return d
# transition into chair pose
clips.append(animation_clip('SitDown',.82,[0,.12,.28,.48,.66,.82],lambda t,d:{
    **{'Hips':(.025*math.sin(math.pi*min(1,t/d)),0,0),
       'UpperLeg_L':(-1.22*min(1,t/d),0,0),'UpperLeg_R':(-1.22*min(1,t/d),0,0),
       'LowerLeg_L':(1.18*min(1,t/d),0,0),'LowerLeg_R':(1.18*min(1,t/d),0,0),
       'Spine':(.11*math.sin(math.pi*min(1,t/d))+.02*min(1,t/d),0,0),
       'Chest':(.07*min(1,t/d),0,0),
       'UpperArm_L':(-.25*min(1,t/d),0,-.14*min(1,t/d)), 'UpperArm_R':(-.25*min(1,t/d),0,.14*min(1,t/d)),
       'LowerArm_L':(-.10*min(1,t/d),0,0), 'LowerArm_R':(-.10*min(1,t/d),0,0)}
}))
clips.append(animation_clip('SitIdle',2.0,[0,.5,1,1.5,2.0],lambda t,d:make_pose(Chest=(.03+math.sin(t*3)*.008,0,0),Head=(.015*math.sin(t*1.5),.01*math.sin(t),0),UpperArm_L=(-.22,0,-.12),UpperArm_R=(-.22,0,.12), **hand_pose('L',.06,.04), **hand_pose('R',.06,.04))))
clips.append(animation_clip('StandUp',.82,[0,.12,.28,.48,.66,.82],lambda t,d:{
    'Hips':(.02*math.sin(math.pi*(1-t/d)),0,0),
    'UpperLeg_L':(-1.22*(1-t/d),0,0),'UpperLeg_R':(-1.22*(1-t/d),0,0),
    'LowerLeg_L':(1.18*(1-t/d),0,0),'LowerLeg_R':(1.18*(1-t/d),0,0),
    'Spine':(.13*(1-t/d),0,0),'Chest':(.07*(1-t/d),0,0),
    'UpperArm_L':(-.25*(1-t/d),0,-.14*(1-t/d)), 'UpperArm_R':(-.25*(1-t/d),0,.14*(1-t/d)),
    'LowerArm_L':(-.10*(1-t/d),0,0), 'LowerArm_R':(-.10*(1-t/d),0,0),
}))
clips.append(animation_clip('Relax',2.0,[0,.5,1,1.5,2],lambda t,d:make_pose(Chest=(-.06+math.sin(t*2)*.01,0,0),Head=(.01*math.sin(t*1.3),0,0),UpperArm_L=(-.38,0,-.18),UpperArm_R=(-.38,0,.18), **hand_pose('L',.04), **hand_pose('R',.04))))
clips.append(animation_clip('WatchTV',2.0,[0,.5,1,1.5,2],lambda t,d:make_pose(Chest=(-.045,0,.01*math.sin(t*1.4)),Head=(-.025,.01*math.sin(t*.8),0),UpperArm_L=(-.24,0,-.12),UpperArm_R=(-.24,0,.12), **hand_pose('L',.05), **hand_pose('R',.05))))
clips.append(animation_clip('WatchTVStanding',2.0,[0,.5,1,1.5,2],lambda t,d:{'Chest':(-.02,0,0),'Head':(-.05,.01*math.sin(t*.8),0),'UpperArm_L':(-.07,0,-.08),'UpperArm_R':(-.07,0,.08),'LowerArm_L':(.10,0,0),'LowerArm_R':(.10,0,0)}))
clips.append(animation_clip('Type',1.4,[0,.35,.7,1.05,1.4],lambda t,d:make_pose(Chest=(.06,0,0),Head=(.08,.008*math.sin(t*4),0),UpperArm_L=(-.72,0,-.15+math.sin(t*15)*.025),UpperArm_R=(-.72,0,.15+math.sin(t*15+1)*.025),LowerArm_L=(-.78,0,0),LowerArm_R=(-.78,0,0),Hand_L=(-.03*math.sin(t*15),0,0),Hand_R=(-.03*math.sin(t*15+1),0,0), **hand_pose('L',.12,.12), **hand_pose('R',.12,.12))))
clips.append(animation_clip('Read',2.0,[0,.5,1,1.5,2],lambda t,d:{'Chest':(.09,0,0),'Head':(.12+.012*math.sin(t*1.4),0,0),'UpperArm_L':(-.55,0,-.10),'UpperArm_R':(-.55,0,.10),'LowerArm_L':(-.75,0,0),'LowerArm_R':(-.75,0,0),'UpperLeg_L':(0,0,0),'UpperLeg_R':(0,0,0),'LowerLeg_L':(0,0,0),'LowerLeg_R':(0,0,0), **hand_pose('L',.16,.08), **hand_pose('R',.16,.08)}))
clips.append(animation_clip('Eat',1.6,[0,.4,.8,1.2,1.6],lambda t,d:{'Chest':(.05,0,0),'Head':(.03+.05*max(0,math.sin(t*4)),0,0),'UpperArm_R':(-.8-.32*max(0,math.sin(t*4)),0,.08),'LowerArm_R':(-.7-.2*max(0,math.sin(t*4)),0,0),'UpperArm_L':(-.15,0,-.1),'LowerArm_L':(-.2,0,0), **hand_pose('R',.55), **hand_pose('L',.12)}))
clips.append(animation_clip('Cook',1.2,[0,.3,.6,.9,1.2],lambda t,d:{'Chest':(.04,0,0),'Head':(.02*math.sin(t*2),0,0),'UpperArm_L':(-.55-.15*math.sin(t*5),0,-.15),'UpperArm_R':(-.44-.18*math.sin(t*5+1),0,.15),'LowerArm_L':(-.64-.12*max(0,math.sin(t*5)),0,0),'LowerArm_R':(-.72-.14*max(0,math.sin(t*5+1)),0,0), **hand_pose('L',.28,.10), **hand_pose('R',.28,.10)}))
clips.append(animation_clip('Shower',1.5,[0,.375,.75,1.125,1.5],lambda t,d:{'Chest':(.025,0,0),'Head':(-.10,0,0),'UpperArm_L':(-.65-.09*math.sin(t*3),0,-.2),'UpperArm_R':(-.36-.08*math.sin(t*2.4+1),0,.2),'LowerArm_L':(-.95-.10*math.sin(t*3),0,0),'LowerArm_R':(-.8-.09*math.sin(t*2.4+1),0,0), **hand_pose('L',.18), **hand_pose('R',.18)}))
clips.append(animation_clip('Phone',1.5,[0,.375,.75,1.125,1.5],lambda t,d:{'Chest':(.07,0,0),'Head':(.10,0,0),'UpperArm_R':(-.78,0,.15),'LowerArm_R':(-.85,0,0),'Hand_R':(.12,0,0),'UpperArm_L':(-.15,0,-.08), **hand_pose('R',.08), **hand_pose('L',.08)}))
clips.append(animation_clip('Wave',1.5,[0,.25,.5,.75,1.0,1.25,1.5],lambda t,d:{'UpperArm_R':(-.45,0,.15),'LowerArm_R':(-1.25,0,0.05*math.sin(t*18)),'Hand_R':(.05,0,.25*math.sin(t*18)),'Head':(.0,.04*math.sin(t*5),0), **hand_pose('R',.0,.22), **hand_pose('L',.0)}))
clips.append(animation_clip('Jump',1.0,[0,.2,.5,.75,1.0],lambda t,d:{'UpperLeg_L':(-.35*math.sin(math.pi*t),0,0),'UpperLeg_R':(-.35*math.sin(math.pi*t),0,0),'LowerLeg_L':(.35*math.sin(math.pi*t),0,0),'LowerLeg_R':(.35*math.sin(math.pi*t),0,0),'UpperArm_L':(-.55*math.sin(math.pi*t),0,-.15),'UpperArm_R':(-.55*math.sin(math.pi*t),0,.15),'Chest':(.10*math.sin(math.pi*t),0,0)}))
# Lie/sleep/wake clips have a relaxed internal pose; the Three.js controller tilts around hips for mattress alignment.
clips.append(animation_clip('LieDown',.9,[0,.18,.42,.66,.9],lambda t,d:{
    'UpperArm_L':(-.1*t/d,0,-.15*t/d),'UpperArm_R':(-.1*t/d,0,.15*t/d),
    'UpperLeg_L':(.04*math.sin(t*4),0,0),'UpperLeg_R':(-.04*math.sin(t*4),0,0),
    'Head':(.02*t/d,0,0),'Chest':(.02*t/d,0,0)}))
clips.append(animation_clip('Sleep',2.4,[0,.6,1.2,1.8,2.4],lambda t,d:{
    'Chest':(.015*math.sin(t*2*math.pi/d),0,0),'Head':(.008*math.sin(t*2*math.pi/d+.4),0,0),
    'UpperArm_L':(-.08,0,-.10),'UpperArm_R':(-.08,0,.10),'Hand_L':(.025*math.sin(t*1.2),0,0),'Hand_R':(-.025*math.sin(t*1.2),0,0), **hand_pose('L',.03), **hand_pose('R',.03)}))
clips.append(animation_clip('WakeUp',1.12,[0,.22,.45,.7,.92,1.12],lambda t,d:{
    'Chest':(.08*(1-t/d),0,0),'Head':(.04*(1-t/d),0,0),
    'UpperArm_L':(-.35*(1-t/d),0,-.1*(1-t/d)),'UpperArm_R':(-.35*(1-t/d),0,.1*(1-t/d)),
    'UpperLeg_L':(.02,0,0),'UpperLeg_R':(-.02,0,0)}))

# Additional full-body clips round out the final everyday/social animation set.
# These are deliberately in-place; the gameplay controller owns world movement.
def unit(t, d):
    return max(0.0, min(1.0, t / max(d, 1e-6)))

def smooth(t, d):
    p = unit(t, d)
    return p * p * (3.0 - 2.0 * p)

def anim_pose(t, d, pose_fn):
    return pose_fn(unit(t, d))

# Actions for common physical interactions.
clips.append(animation_clip('Drink',1.45,[0,.18,.38,.60,.82,1.10,1.45],lambda t,d:{
    'Chest':(.045,0,0),'Head':(-.035-.12*max(0,math.sin(t*math.pi/d)),0,0),
    'UpperArm_R':(-.72,0,.13),'LowerArm_R':(-.88-.10*max(0,math.sin(t*5)),0,0),'Hand_R':(-.18,0,.04),
    'UpperArm_L':(-.12,0,-.08), **hand_pose('R',.32), **hand_pose('L',.08)
}))
clips.append(animation_clip('OpenDoor',.72,[0,.12,.28,.44,.58,.72],lambda t,d:{
    'Spine':(.025,0,0),'Chest':(.06,0,0),'Head':(.015,.04,0),
    'UpperArm_R':(-.42,0,.24),'LowerArm_R':(-.95,0,.08),'Hand_R':(.08,0,.12),
    'UpperArm_L':(-.08,0,-.08),'LowerArm_L':(-.12,0,0), **hand_pose('R',.12), **hand_pose('L',.0)
}))
clips.append(animation_clip('Reach',.62,[0,.12,.25,.42,.62],lambda t,d:{
    'Chest':(.07,0,0),'Head':(.035,0,0),'UpperArm_R':(-.95,0,.08),'LowerArm_R':(-.25,0,0),
    'Hand_R':(.02,0,0), **hand_pose('R',.0,.08), **hand_pose('L',.02)
}))
clips.append(animation_clip('PickUp',.92,[0,.12,.28,.48,.68,.82,.92],lambda t,d:{
    'Hips':(.08*math.sin(math.pi*unit(t,d)),0,0),'Spine':(.20*(1-unit(t,d)*.45),0,0),
    'Chest':(.11*(1-unit(t,d)*.55),0,0),
    'UpperLeg_L':(-.55*(1-unit(t,d)),0,0),'UpperLeg_R':(-.55*(1-unit(t,d)),0,0),
    'LowerLeg_L':(.78*(1-unit(t,d)),0,0),'LowerLeg_R':(.78*(1-unit(t,d)),0,0),
    'UpperArm_R':(-.78+ .30*unit(t,d),0,.12),'LowerArm_R':(-.42,0,0),
    'UpperArm_L':(-.78+.30*unit(t,d),0,-.12),'LowerArm_L':(-.42,0,0),
    'Head':(.12*(1-unit(t,d)),0,0), **hand_pose('R',.42), **hand_pose('L',.42)
}))
clips.append(animation_clip('Carry',1.5,[0,.375,.75,1.125,1.5],cyclic_pose(lambda a:{
    'Chest':(.06+.008*math.sin(a),0,0),'Head':(.015*math.sin(a*.5),0,0),
    'UpperArm_L':(-.72,0,-.20),'UpperArm_R':(-.72,0,.20),
    'LowerArm_L':(-.72,0,0),'LowerArm_R':(-.72,0,0), **hand_pose('L',.65), **hand_pose('R',.65)
})))
clips.append(animation_clip('PutDown',.82,[0,.12,.26,.44,.62,.82],lambda t,d:{
    'Hips':(.07*math.sin(math.pi*unit(t,d)),0,0),'Spine':(.12+.10*unit(t,d),0,0),
    'UpperLeg_L':(-.45*math.sin(math.pi*unit(t,d)),0,0),'UpperLeg_R':(-.45*math.sin(math.pi*unit(t,d)),0,0),
    'LowerLeg_L':(.58*math.sin(math.pi*unit(t,d)),0,0),'LowerLeg_R':(.58*math.sin(math.pi*unit(t,d)),0,0),
    'UpperArm_L':(-.72+.42*unit(t,d),0,-.16),'UpperArm_R':(-.72+.42*unit(t,d),0,.16),
    'LowerArm_L':(-.68+.42*unit(t,d),0,0),'LowerArm_R':(-.68+.42*unit(t,d),0,0),
    **hand_pose('L',.65*(1-unit(t,d))), **hand_pose('R',.65*(1-unit(t,d)))
}))

# Social/emote library. Clips are intentionally designed to be readable from
# third-person camera distance and have quiet loops for remote multiplayer views.
clips.append(animation_clip('Talk',1.35,[0,.22,.45,.68,.92,1.15,1.35],cyclic_pose(lambda a:{
    'Spine':(.018*math.sin(a),0,0),'Chest':(.025*math.sin(a*1.3),0,.015*math.sin(a)),
    'Neck':(.008*math.sin(a*1.7),.018*math.sin(a),0),'Head':(.012*math.sin(a*1.4),.035*math.sin(a*.9),0),
    'UpperArm_R':(-.12-.12*max(0,math.sin(a*1.7)),0,.12),
    'LowerArm_R':(-.15-.15*max(0,math.sin(a*1.7+.5)),0,0),
    'UpperArm_L':(-.10-.08*max(0,math.sin(a*1.7+1)),0,-.12),
    'LowerArm_L':(-.14-.10*max(0,math.sin(a*1.7+1.4)),0,0), **hand_pose('R',.05,.1), **hand_pose('L',.05,.1)
})))
clips.append(animation_clip('Laugh',1.7,[0,.34,.68,1.02,1.36,1.7],cyclic_pose(lambda a:{
    'Chest':(.08+.035*math.sin(a*2),0,.025*math.sin(a)), 'Head':(.07+.045*math.sin(a*2),.035*math.sin(a),0),
    'UpperArm_R':(-.52,0,.32),'LowerArm_R':(-.82,0,.05),'Hand_R':(-.12,0,.08),
    'UpperArm_L':(-.52,0,-.32),'LowerArm_L':(-.82,0,-.05),'Hand_L':(-.12,0,-.08),
    **hand_pose('R',.12), **hand_pose('L',.12)
})))
clips.append(animation_clip('Clap',1.0,[0,.125,.25,.375,.5,.625,.75,.875,1.0],cyclic_pose(lambda a:{
    'Chest':(.02,0,0),'UpperArm_L':(-.55,0,-.48),'UpperArm_R':(-.55,0,.48),
    'LowerArm_L':(-.55-.18*abs(math.sin(a*2)),0,.02),'LowerArm_R':(-.55-.18*abs(math.sin(a*2)),0,-.02),
    'Hand_L':(.0,0,-.05),'Hand_R':(.0,0,.05), **hand_pose('L',.12), **hand_pose('R',.12)
})))
clips.append(animation_clip('Shrug',.9,[0,.14,.3,.52,.72,.9],lambda t,d:{
    'Chest':(-.025*math.sin(math.pi*unit(t,d)),0,0),'Head':(.015,.06*math.sin(math.pi*unit(t,d)),0),
    'Shoulder_L':(0,0,-.22*math.sin(math.pi*unit(t,d))),'Shoulder_R':(0,0,.22*math.sin(math.pi*unit(t,d))),
    'UpperArm_L':(-.10,0,-.34*math.sin(math.pi*unit(t,d))-.08),'UpperArm_R':(-.10,0,.34*math.sin(math.pi*unit(t,d))+.08),
    'LowerArm_L':(-.16,0,-.08),'LowerArm_R':(-.16,0,.08), **hand_pose('L',.0,.25), **hand_pose('R',.0,.25)
}))
clips.append(animation_clip('Point',.82,[0,.12,.28,.48,.66,.82],lambda t,d:{
    'Chest':(.03,0,0),'Head':(0,.03,0),'UpperArm_R':(-.82,0,.10),'LowerArm_R':(-.22,0,0),'Hand_R':(0,0,0),
    **pointing_hand_pose('R'), **hand_pose('L',.0)
}))
clips.append(animation_clip('Handshake',1.1,[0,.18,.36,.55,.75,.92,1.1],lambda t,d:{
    'Chest':(.035,0,0),'Head':(.01,.02,0),'UpperArm_R':(-.65,0,.10),
    'LowerArm_R':(-.10-.06*math.sin(t*17),0,0),'Hand_R':(.0,0,.06*math.sin(t*17)),
    **hand_pose('R',.45), **hand_pose('L',.0)
}))
clips.append(animation_clip('FistBump',.8,[0,.12,.28,.42,.58,.8],lambda t,d:{
    'Chest':(.05,0,0),'UpperArm_R':(-.55,0,.16),'LowerArm_R':(-.58,0,0),
    'Hand_R':(.04,0,0), **hand_pose('R',.95), **hand_pose('L',.0)
}))
clips.append(animation_clip('Celebrate',1.35,[0,.18,.42,.68,.9,1.15,1.35],cyclic_pose(lambda a:{
    'Chest':(-.025,0,.025*math.sin(a)),'Head':(-.06,.025*math.sin(a),0),
    'UpperArm_L':(.12,0,-.62),'UpperArm_R':(.12,0,.62),
    'LowerArm_L':(-.18,0,-.08),'LowerArm_R':(-.18,0,.08), **hand_pose('L',.0), **hand_pose('R',.0)
})))
clips.append(animation_clip('Stretch',1.65,[0,.25,.5,.825,1.15,1.4,1.65],lambda t,d:{
    'Spine':(-.06*smooth(t,d),0,0),'Chest':(-.09*smooth(t,d),0,0),'Neck':(-.025,0,0),'Head':(-.035,0,0),
    'UpperArm_L':(.15*smooth(t,d),0,-.48*smooth(t,d)),'UpperArm_R':(.15*smooth(t,d),0,.48*smooth(t,d)),
    'LowerArm_L':(-.15*smooth(t,d),0,-.08),'LowerArm_R':(-.15*smooth(t,d),0,.08),
    **hand_pose('L',.0,.10), **hand_pose('R',.0,.10)
}))
clips.append(animation_clip('Yawn',1.6,[0,.25,.5,.8,1.1,1.35,1.6],lambda t,d:{
    'Chest':(.07*math.sin(math.pi*unit(t,d)),0,0),'Head':(.10*math.sin(math.pi*unit(t,d)),0,0),
    'UpperArm_R':(-.65,0,.20),'LowerArm_R':(-.8,0,.03),'Hand_R':(-.12,0,.05),
    **hand_pose('R',.1), **hand_pose('L',.0)
}))
clips.append(animation_clip('Crouch',1.15,[0,.23,.46,.69,.92,1.15],cyclic_pose(lambda a:{
    'Hips':(.04*math.sin(a),0,0),'Spine':(.15,0,0),'Chest':(.05,0,0),
    'UpperLeg_L':(-.72,0,0),'UpperLeg_R':(-.72,0,0),'LowerLeg_L':(1.05,0,0),'LowerLeg_R':(1.05,0,0),
    'UpperArm_L':(-.18,0,-.08),'UpperArm_R':(-.18,0,.08), **hand_pose('L',.2), **hand_pose('R',.2)
})))
clips.append(animation_clip('Land',.48,[0,.08,.18,.30,.40,.48],lambda t,d:{
    'Hips':(.18*(1-unit(t,d)),0,0),'Spine':(.15*(1-unit(t,d)),0,0),'Chest':(.08*(1-unit(t,d)),0,0),
    'UpperLeg_L':(-.2*(1-unit(t,d)),0,0),'UpperLeg_R':(-.2*(1-unit(t,d)),0,0),
    'LowerLeg_L':(.38*(1-unit(t,d)),0,0),'LowerLeg_R':(.38*(1-unit(t,d)),0,0),
    'UpperArm_L':(-.24*(1-unit(t,d)),0,-.10),'UpperArm_R':(-.24*(1-unit(t,d)),0,.10)
}))
clips.append(animation_clip('PhoneTyping',1.0,[0,.25,.5,.75,1.0],cyclic_pose(lambda a:{
    'Chest':(.08,0,0),'Head':(.11,.015*math.sin(a),0),'UpperArm_R':(-.78,0,.16),'LowerArm_R':(-.82,0,0),
    'UpperArm_L':(-.34,0,-.22),'LowerArm_L':(-.62,0,0),'Hand_L':(.05,0,-.03),
    **hand_pose('R',.08), **hand_pose('L',.08)
})))
clips.append(animation_clip('Nod',.8,[0,.16,.32,.48,.64,.8],lambda t,d:{
    'Neck':(.04*math.sin(t*8),0,0),'Head':(.16*math.sin(t*8),0,0),'Chest':(.01,0,0)
}))
clips.append(animation_clip('ShakeHead',.85,[0,.17,.34,.51,.68,.85],lambda t,d:{
    'Neck':(.0,.10*math.sin(t*9),0),'Head':(.0,.22*math.sin(t*9),0),'Chest':(.01,0,0)
}))
clips.append(animation_clip('LookAt',1.0,[0,.25,.5,.75,1.0],cyclic_pose(lambda a:{
    'Neck':(.01*math.sin(a),.08*math.sin(a),0),'Head':(.02*math.sin(a),.14*math.sin(a),0)
})))
clips.append(animation_clip('IdleHolding',1.8,[0,.45,.9,1.35,1.8],cyclic_pose(lambda a:{
    'Chest':(.045,0,0),'Head':(.01*math.sin(a),0,0),
    'UpperArm_L':(-.68,0,-.16),'UpperArm_R':(-.68,0,.16),
    'LowerArm_L':(-.58,0,0),'LowerArm_R':(-.58,0,0), **hand_pose('L',.55), **hand_pose('R',.55)
})))
clips.append(animation_clip('CrouchDown',.42,[0,.08,.18,.30,.42],lambda t,d:{
    'Hips':(.22*smooth(t,d),0,0),'Spine':(.15*smooth(t,d),0,0),'Chest':(.045*smooth(t,d),0,0),
    'UpperLeg_L':(-.72*smooth(t,d),0,0),'UpperLeg_R':(-.72*smooth(t,d),0,0),
    'LowerLeg_L':(1.05*smooth(t,d),0,0),'LowerLeg_R':(1.05*smooth(t,d),0,0),
    'UpperArm_L':(-.18*smooth(t,d),0,-.08),'UpperArm_R':(-.18*smooth(t,d),0,.08),
    **hand_pose('L',.18*smooth(t,d)), **hand_pose('R',.18*smooth(t,d))
}))
clips.append(animation_clip('CrouchUp',.42,[0,.08,.18,.30,.42],lambda t,d:{
    'Hips':(.22*(1-smooth(t,d)),0,0),'Spine':(.15*(1-smooth(t,d)),0,0),'Chest':(.045*(1-smooth(t,d)),0,0),
    'UpperLeg_L':(-.72*(1-smooth(t,d)),0,0),'UpperLeg_R':(-.72*(1-smooth(t,d)),0,0),
    'LowerLeg_L':(1.05*(1-smooth(t,d)),0,0),'LowerLeg_R':(1.05*(1-smooth(t,d)),0,0),
    'UpperArm_L':(-.18*(1-smooth(t,d)),0,-.08),'UpperArm_R':(-.18*(1-smooth(t,d)),0,.08),
    **hand_pose('L',.18*(1-smooth(t,d))), **hand_pose('R',.18*(1-smooth(t,d)))
}))
clips.append(animation_clip('Dance',2.2,[0,.275,.55,.825,1.10,1.375,1.65,1.925,2.2],cyclic_pose(lambda a:{
    'Hips':(.035*math.sin(a*2),.045*math.sin(a),.04*math.sin(a*2)),
    'Spine':(.015*math.sin(a),.02*math.sin(a*2),.015*math.sin(a)),
    'Chest':(.025*math.sin(a*2),.02*math.sin(a),.035*math.sin(a*2)),
    'Head':(.012*math.sin(a),.035*math.sin(a*.75),0),
    'UpperLeg_L':(.28*math.sin(a),0,.08*math.sin(a)), 'UpperLeg_R':(.28*math.sin(a+math.pi),0,-.08*math.sin(a)),
    'LowerLeg_L':(.30*max(0,math.sin(a+math.pi/2)),0,0), 'LowerLeg_R':(.30*max(0,math.sin(a+math.pi/2+math.pi)),0,0),
    'UpperArm_L':(-.28+.42*math.sin(a),0,-.32-.10*math.sin(a)),
    'UpperArm_R':(-.28-.42*math.sin(a),0,.32+.10*math.sin(a)),
    'LowerArm_L':(-.38-.18*math.sin(a+1),0,-.05), 'LowerArm_R':(-.38-.18*math.sin(a+2),0,.05),
    **hand_pose('L',.05,.12), **hand_pose('R',.05,.12)
})))
clips.append(animation_clip('WashHands',1.55,[0,.31,.62,.93,1.24,1.55],cyclic_pose(lambda a:{
    'Chest':(.035,0,0),'Head':(.06+.008*math.sin(a),0,0),
    'UpperArm_L':(-.56,0,-.18),'UpperArm_R':(-.56,0,.18),
    'LowerArm_L':(-.82+.10*math.sin(a*3),0,.08),'LowerArm_R':(-.82+.10*math.sin(a*3+1),0,-.08),
    'Hand_L':(-.03,0,.04),'Hand_R':(-.03,0,-.04),**hand_pose('L',.08),**hand_pose('R',.08)
})))
clips.append(animation_clip('BrushTeeth',1.6,[0,.32,.64,.96,1.28,1.6],cyclic_pose(lambda a:{
    'Chest':(.055,0,0),'Head':(.06+.01*math.sin(a*2),0,0),
    'UpperArm_R':(-.77,0,.14),'LowerArm_R':(-.93+.05*math.sin(a*4),0,.03),
    'Hand_R':(.02,0,.05*math.sin(a*7)),'UpperArm_L':(-.10,0,-.08),
    **hand_pose('R',.28),**hand_pose('L',.02)
})))
clips.append(animation_clip('Kneel',1.05,[0,.21,.42,.63,.84,1.05],lambda t,d:{
    'Hips':(.18,0,0),'Spine':(.08,0,0),'Chest':(.03,0,0),
    'UpperLeg_L':(-1.05,0,0),'UpperLeg_R':(-.70,0,0),
    'LowerLeg_L':(1.35,0,0),'LowerLeg_R':(.92,0,0),
    'UpperArm_L':(-.15,0,-.10),'UpperArm_R':(-.15,0,.10),
    **hand_pose('L',.06),**hand_pose('R',.06)
}))

# Create inverse bind matrix accessor (MAT4 column-major) for all joints.
ibm=[]
for name,_,_ in BONES: ibm.extend(inverse_translation_matrix(BONE_GLOBAL[name]))
ibm_acc=add_accessor(pack_floats(ibm),5126,len(BONES),'MAT4')

# Material list.
gltf_materials=[]
for name,(color,rough) in MATERIALS.items():
    gltf_materials.append({"name":name,"pbrMetallicRoughness":{"baseColorFactor":color,"metallicFactor":0.0,"roughnessFactor":rough},"doubleSided":False})

# animation accessors/channels were appended to binary after mesh attributes.
gltf={
    "asset":{"version":"2.0","generator":"Life Sim custom Donghua avatar generator"},
    "scene":0,
    "scenes":[{"name":"LifeSim_Donghua_Character","nodes":[0]}],
    "nodes":nodes,
    "meshes":gltf_meshes,
    "materials":gltf_materials,
    "skins":[{"name":"LifeSimHumanoidRig","inverseBindMatrices":ibm_acc,"skeleton":0,"joints":[BONE_NODE[name] for name,_,_ in BONES]}],
    "animations":clips,
    "accessors":accessors,
    "bufferViews":buffer_views,
    "buffers":[{"byteLength":len(bin_data)}],
}
# Ensure all clip node references match the skeleton node indices and add useful extras.
gltf['extras']={"style":"semi-realistic Donghua-inspired game character","heightMeters":1.98,"license":"Original procedural project asset"}
json_bytes=json.dumps(gltf,separators=(',',':')).encode('utf-8')
while len(json_bytes)%4: json_bytes += b' '
while len(bin_data)%4: bin_data.append(0)
# GLB: 12 byte header + JSON chunk + BIN chunk
json_chunk=struct.pack('<I4s',len(json_bytes),b'JSON')+json_bytes
bin_chunk=struct.pack('<I4s',len(bin_data),b'BIN\x00')+bytes(bin_data)
total_len=12+len(json_chunk)+len(bin_chunk)
with OUT.open('wb') as f:
    f.write(struct.pack('<4sII',b'glTF',2,total_len)); f.write(json_chunk); f.write(bin_chunk)
print(f'Wrote {OUT} ({OUT.stat().st_size:,} bytes), {len(BONES)} joints, {len(clips)} animation clips, {len(gltf_meshes)} skinned mesh groups')
