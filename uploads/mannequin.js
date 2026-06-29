/* =====================================================
   HEMA Poses — Procedural Mannequin Builder
   Replaces FBX dummy.fbx loading entirely.
   Exposes window.HEMAMannequin = { build }

   build(THREE, teamHex, rival, showHandles) → rig
   rig = {
     root        : THREE.Group  (position/rotation controls body placement)
     bones       : { [mixamoName]: THREE.Object3D }  (same keys as BONE_MAP)
     headBone    : THREE.Object3D
     swordMount  : THREE.Group  (attached to RightHand)
     dragSpheres : THREE.Mesh[]
     selectMeshes: THREE.Mesh[]
   }
   ===================================================== */
window.HEMAMannequin = (function () {

  /* proportions — all in metres, humanoid ~1.75 m */
  var P = {
    torsoH : 0.52,   torsoW : 0.26,  torsoD : 0.16,
    headR  : 0.105,
    neckH  : 0.08,
    upperArmH: 0.28, upperArmR: 0.045,
    foreArmH : 0.25, foreArmR : 0.038,
    handH    : 0.09, handR    : 0.030,
    upperLegH: 0.40, upperLegR: 0.060,
    lowerLegH: 0.36, lowerLegR: 0.048,
    footL    : 0.22, footH    : 0.07, footD : 0.09,
    shoulderW: 0.15, hipW: 0.10,
  };

  function seg(THREE, h, r, segs, mat) {
    var g = new THREE.CylinderGeometry(r * 0.88, r, h, segs || 8);
    var m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  }

  function ball(THREE, r, mat) {
    var g = new THREE.SphereGeometry(r, 10, 8);
    var m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  }

  function box(THREE, w, h, d, mat) {
    var g = new THREE.BoxGeometry(w, h, d);
    var m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  }

  /* Pivot helper: creates an Object3D at `offset` from parent,
     children are offset by -offset so they appear at the right place. */
  function pivot(THREE, parent, offset) {
    var p = new THREE.Object3D();
    p.position.copy(offset);
    parent.add(p);
    return p;
  }

  function build(THREE, teamHex, rival, showHandles) {
    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(teamHex),
      roughness: 0.62, metalness: 0.06,
    });
    var jMat = new THREE.MeshStandardMaterial({  /* joint ball accent */
      color: new THREE.Color(teamHex).multiplyScalar(0.7),
      roughness: 0.5, metalness: 0.1,
    });

    var root = new THREE.Group();
    var bones = {};

    /* ---- Hips (root bone, translates whole figure) ---- */
    var hips = new THREE.Object3D();
    hips.name = 'mixamorig:Hips';
    root.add(hips);
    bones['mixamorig:Hips'] = hips;
    /* hips sit at ~0.88 m above floor */
    hips.position.y = 0.88;

    /* ---- Spine / Torso ---- */
    var spine = new THREE.Object3D();
    spine.name = 'mixamorig:Spine';
    hips.add(spine);
    bones['mixamorig:Spine'] = spine;
    /* torso mesh centred on spine pivot */
    var torsoMesh = box(THREE, P.torsoW, P.torsoH, P.torsoD, mat);
    torsoMesh.position.y = P.torsoH * 0.5;
    spine.add(torsoMesh);

    /* Spine2 sits at top of torso */
    var spine2 = new THREE.Object3D();
    spine2.name = 'mixamorig:Spine2';
    spine2.position.y = P.torsoH;
    spine.add(spine2);
    bones['mixamorig:Spine2'] = spine2;

    /* ---- Neck & Head ---- */
    var neck = new THREE.Object3D();
    neck.name = 'mixamorig:Neck';
    spine2.add(neck);
    var neckMesh = seg(THREE, P.neckH, 0.035, 8, mat);
    neckMesh.position.y = P.neckH * 0.5;
    neck.add(neckMesh);

    var headPivot = new THREE.Object3D();
    headPivot.name = 'mixamorig:Head';
    headPivot.position.y = P.neckH;
    neck.add(headPivot);
    bones['mixamorig:Head'] = headPivot;
    var headMesh = ball(THREE, P.headR, mat);
    headMesh.position.y = P.headR;
    headPivot.add(headMesh);

    /* ---- Shoulders / Arms (RIGHT = weapon arm) ---- */
    function buildArm(side) {
      var sign = side === 'R' ? 1 : -1;
      var xOff = sign * (P.torsoW * 0.5 + P.shoulderW);

      /* shoulder joint */
      var shoulder = new THREE.Object3D();
      shoulder.name = 'mixamorig:' + (side === 'R' ? 'Right' : 'Left') + 'Arm';
      shoulder.position.set(xOff, -0.04, 0);
      spine2.add(shoulder);
      bones[shoulder.name] = shoulder;

      var shoulderBall = ball(THREE, 0.052, jMat.clone());
      shoulder.add(shoulderBall);

      /* upper arm */
      var upperArmMesh = seg(THREE, P.upperArmH, P.upperArmR, 8, mat);
      upperArmMesh.position.y = -P.upperArmH * 0.5;
      shoulder.add(upperArmMesh);

      /* elbow */
      var elbow = new THREE.Object3D();
      elbow.name = 'mixamorig:' + (side === 'R' ? 'Right' : 'Left') + 'ForeArm';
      elbow.position.y = -P.upperArmH;
      shoulder.add(elbow);
      bones[elbow.name] = elbow;

      var elbowBall = ball(THREE, 0.040, jMat.clone());
      elbow.add(elbowBall);

      var foreArmMesh = seg(THREE, P.foreArmH, P.foreArmR, 8, mat);
      foreArmMesh.position.y = -P.foreArmH * 0.5;
      elbow.add(foreArmMesh);

      /* wrist / hand */
      var wrist = new THREE.Object3D();
      wrist.name = 'mixamorig:' + (side === 'R' ? 'Right' : 'Left') + 'Hand';
      wrist.position.y = -P.foreArmH;
      elbow.add(wrist);
      bones[wrist.name] = wrist;

      var handMesh = box(THREE, P.handR * 2.2, P.handH, P.handR * 1.4, mat);
      handMesh.position.y = -P.handH * 0.5;
      wrist.add(handMesh);

      return wrist;
    }

    var rightHand = buildArm('R');
    buildArm('L');

    /* ---- Sword mount on right wrist ---- */
    var swordMount = new THREE.Group();
    swordMount.position.y = -P.handH;
    rightHand.add(swordMount);

    /* ---- Legs ---- */
    function buildLeg(side) {
      var sign = side === 'R' ? 1 : -1;
      var xOff = sign * P.hipW;

      var hip = new THREE.Object3D();
      hip.name = 'mixamorig:' + (side === 'R' ? 'Right' : 'Left') + 'UpLeg';
      hip.position.set(xOff, 0, 0);
      hips.add(hip);
      bones[hip.name] = hip;

      var hipBall = ball(THREE, 0.060, jMat.clone());
      hip.add(hipBall);

      var upperLegMesh = seg(THREE, P.upperLegH, P.upperLegR, 8, mat);
      upperLegMesh.position.y = -P.upperLegH * 0.5;
      hip.add(upperLegMesh);

      var knee = new THREE.Object3D();
      knee.name = 'mixamorig:' + (side === 'R' ? 'Right' : 'Left') + 'Leg';
      knee.position.y = -P.upperLegH;
      hip.add(knee);
      bones[knee.name] = knee;

      var kneeBall = ball(THREE, 0.048, jMat.clone());
      knee.add(kneeBall);

      var lowerLegMesh = seg(THREE, P.lowerLegH, P.lowerLegR, 8, mat);
      lowerLegMesh.position.y = -P.lowerLegH * 0.5;
      knee.add(lowerLegMesh);

      var ankle = new THREE.Object3D();
      ankle.name = 'mixamorig:' + (side === 'R' ? 'Right' : 'Left') + 'Foot';
      ankle.position.y = -P.lowerLegH;
      knee.add(ankle);
      bones[ankle.name] = ankle;

      var footMesh = box(THREE, P.footD, P.footH, P.footL, mat);
      footMesh.position.set(0, -P.footH * 0.5, P.footL * 0.2);
      ankle.add(footMesh);
    }

    buildLeg('R');
    buildLeg('L');

    /* ---- Collect selectMeshes (all Mesh descendants of root) ---- */
    var selectMeshes = [];
    root.traverse(function (o) {
      if (o.isMesh) {
        o.userData.rival = rival;
        selectMeshes.push(o);
      }
    });

    /* ---- Drag spheres (interactive joint handles) ---- */
    var dragSpheres = [];
    var DRAG_DEFS = [
      { key: 'spine',     boneName: 'mixamorig:Spine2'        },
      { key: 'head',      boneName: 'mixamorig:Head'           },
      { key: 'shoulderR', boneName: 'mixamorig:RightArm'       },
      { key: 'elbowR',    boneName: 'mixamorig:RightForeArm'   },
      { key: 'wristR',    boneName: 'mixamorig:RightHand'      },
      { key: 'shoulderL', boneName: 'mixamorig:LeftArm'        },
      { key: 'elbowL',    boneName: 'mixamorig:LeftForeArm'    },
      { key: 'wristL',    boneName: 'mixamorig:LeftHand'       },
      { key: 'hipR',      boneName: 'mixamorig:RightUpLeg'     },
      { key: 'kneeR',     boneName: 'mixamorig:RightLeg'       },
      { key: 'hipL',      boneName: 'mixamorig:LeftUpLeg'      },
      { key: 'kneeL',     boneName: 'mixamorig:LeftLeg'        },
    ];

    DRAG_DEFS.forEach(function (def) {
      var bone = bones[def.boneName];
      if (!bone) return;
      var hm = new THREE.MeshStandardMaterial({
        color: 0xffffff, transparent: true,
        opacity: showHandles ? 0.42 : 0.0,
        roughness: 0.4, depthWrite: false,
        emissive: new THREE.Color(0),
      });
      var hs = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), hm);
      hs.userData = { rival: rival, rotates: def.key, grab: true, baseEmissive: 0 };
      hs.visible = showHandles;
      bone.add(hs);
      dragSpheres.push(hs);
      selectMeshes.push(hs);
    });

    /* translate handle on hips */
    var hipBone = bones['mixamorig:Hips'];
    var thm = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true,
      opacity: showHandles ? 0.42 : 0.0,
      roughness: 0.4, depthWrite: false,
      emissive: new THREE.Color(0),
    });
    var th = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), thm);
    th.userData = { rival: rival, translate: true, grab: true, baseEmissive: 0 };
    th.visible = showHandles;
    hipBone.add(th);
    dragSpheres.push(th);
    selectMeshes.push(th);

    return {
      root        : root,
      bones       : bones,
      headBone    : bones['mixamorig:Head'],
      swordMount  : swordMount,
      dragSpheres : dragSpheres,
      selectMeshes: selectMeshes,
    };
  }

  return { build: build };
})();
