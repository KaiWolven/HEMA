# HEMA Poses — Memory Fix Report

## What was wrong

The artifact was crashing with **out-of-memory errors** in the browser tab despite the system having plenty of RAM. The root cause was not the JavaScript logic but the **FBX model loading pipeline**:

- `dummy.fbx` (2.2 MB compressed) was being loaded **twice** — once per rival — via Three.js `FBXLoader`, which decompresses and parses the file into GPU buffers. The actual VRAM footprint per instance was 30–80 MB after decompression, skinning weights, and texture data.
- Two additional CDN scripts were loaded: `fflate.min.js` (FBX decompressor) and `FBXLoader.js`. Combined with Three.js itself, this pushed the tab's process over the browser's per-tab memory limit on Claude Design's sandboxed iframe environment.
- The async loading callback pattern meant that on every re-render by Claude Design, a new FBX load could start before the previous one was fully garbage-collected.

Previous fixes to the animation loop and event listeners were correct and are preserved, but they couldn't solve an OOM caused by the models themselves.

---

## Changes made

### Files to DELETE from your project
| File | Reason |
|------|--------|
| `models/dummy.fbx` | Replaced by procedural geometry |
| `Shoved_Reaction_With_Spin.fbx` | Not used in the artifact |
| `scene.gltf` | Not used in the artifact |

### Files to ADD
| File | Location in project |
|------|---------------------|
| `mannequin.js` (attached) | `mannequins/mannequin.js` |

### Files to REPLACE
| File | What changed |
|------|-------------|
| `Analizador_HEMA_dc.html` (attached) | See below |

### Changes inside `Analizador_HEMA_dc.html`

1. **Removed two CDN script tags** — `fflate.min.js` and `FBXLoader.js` are gone. Only Three.js r128 remains.

2. **Added mannequin script tag** — `<script src="./mannequins/mannequin.js"></script>` loads before weapons.

3. **`componentDidMount` simplified** — previously polled for `window.THREE.FBXLoader`; now polls for `window.THREE && window.HEMAMannequin` (instant, no async wait).

4. **`loadMannequin()` method deleted** — the entire 60-line async FBX loader method is removed.

5. **Mannequin construction is now synchronous** — replaced the async callback chain with two direct calls to `window.HEMAMannequin.build(...)`. Both mannequins are ready in the same tick as `initThree()`, so `setState({ ready: true })` and `snapshotInit()` fire immediately.

---

## What `mannequin.js` does

Exposes `window.HEMAMannequin.build(THREE, teamHex, rival, showHandles)` which returns a **rig object with exactly the same interface** the rest of the code expects:

```
{
  root         // THREE.Group — position/rotation for body placement
  bones        // { 'mixamorig:Head': Object3D, 'mixamorig:RightArm': Object3D, … }
  headBone     // shortcut to bones['mixamorig:Head']
  swordMount   // THREE.Group attached to RightHand
  dragSpheres  // interactive handles array
  selectMeshes // raycaster targets array
}
```

All bone names match the `BONE_MAP` in the main component exactly (`mixamorig:Spine`, `mixamorig:RightArm`, etc.), so every slider, preset, drag handler, and pose system works without any other changes.

The mannequin is built from **cylinders, boxes, and spheres** — same approach as `weapons.js`. Total geometry: ~20 meshes per figure, ~5 KB of vertex data each. No file I/O, no decompression, no async.

---

## Folder structure after changes

```
project/
├── Analizador_HEMA_dc.html   ← replaced
├── support.js                ← unchanged
├── mannequins/
│   └── mannequin.js          ← NEW
└── weapons/
    └── weapons.js            ← unchanged
```

---

## What Claude Design should review

1. **Joint proportions** — the mannequin uses plausible humanoid proportions but they may need tuning to match the visual style you want. Key constants are in the `P = { … }` object at the top of `mannequin.js`.

2. **Arm orientation** — arms hang downward from shoulder pivots (Y-axis down). If any preset poses look wrong on the procedural rig versus the FBX, it may be because the FBX had a different rest-pose axis convention. The fix is to adjust the `set(…)` values in the relevant preset in `poseByName()`.

3. **Shadow map size** — already reduced to 1024×1024 in a previous fix. Can go to 512×512 if memory is still tight.

4. **`pixelRatio` cap** — already capped at `Math.min(devicePixelRatio, 2)`. On high-DPI screens this is the biggest single VRAM cost after models; consider capping at 1.5 if needed.
