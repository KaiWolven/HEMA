/* Minimal GLB loader — uses window.THREE, no secondary bundle */
(function () {
  var TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  var CTORS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

  function getAccessor(json, binBuf, idx) {
    var acc = json.accessors[idx];
    var bv  = json.bufferViews[acc.bufferView];
    var Ctor = CTORS[acc.componentType];
    var compCount  = TYPE_SIZES[acc.type] || 1;
    var bvOff  = bv.byteOffset  || 0;
    var accOff = acc.byteOffset || 0;
    var count  = acc.count;
    var byteStride = bv.byteStride;
    if (byteStride && byteStride !== compCount * Ctor.BYTES_PER_ELEMENT) {
      var out    = new Ctor(count * compCount);
      var stride = byteStride / Ctor.BYTES_PER_ELEMENT;
      var lOff   = accOff / Ctor.BYTES_PER_ELEMENT;
      var src    = new Ctor(binBuf, bvOff, bv.byteLength / Ctor.BYTES_PER_ELEMENT);
      for (var i = 0; i < count; i++)
        for (var c = 0; c < compCount; c++)
          out[i * compCount + c] = src[i * stride + lOff + c];
      return out;
    }
    // Return a copy so the ArrayBuffer can be GC'd
    var raw = new Ctor(binBuf, bvOff + accOff, count * compCount);
    return new Ctor(raw);
  }

  function parseGLB(buf, onLoad, onError) {
    try {
      var T3  = window.THREE;
      var view = new DataView(buf);
      if (view.getUint32(0, true) !== 0x46546C67)
        throw new Error('Not a valid GLB file');

      var jsonLen = view.getUint32(12, true);
      var json    = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
      var binStart = 20 + jsonLen + 8;
      var binBuf   = buf.byteLength > binStart ? buf.slice(binStart) : new ArrayBuffer(0);

      /* ── 1. Build node tree ───────────────────────────────────── */
      var nodeObjs = (json.nodes || []).map(function () { return null; });

      function buildNode(ni) {
        if (nodeObjs[ni]) return nodeObjs[ni];
        var nd  = json.nodes[ni];
        var obj = nd.skin !== undefined || nd.mesh !== undefined
          ? new T3.Group()
          : new T3.Bone();
        obj.name = nd.name || ('node_' + ni);
        if (nd.matrix) {
          var m4 = new T3.Matrix4(); m4.fromArray(nd.matrix);
          m4.decompose(obj.position, obj.quaternion, obj.scale);
        } else {
          if (nd.translation) obj.position.fromArray(nd.translation);
          if (nd.rotation)    obj.quaternion.fromArray(nd.rotation);
          if (nd.scale)       obj.scale.fromArray(nd.scale);
        }
        nodeObjs[ni] = obj;
        (nd.children || []).forEach(function (ci) { obj.add(buildNode(ci)); });
        return obj;
      }
      (json.nodes || []).forEach(function (_, i) { buildNode(i); });

      /* ── 2. Re-create bones for skinning (need Bone type) ───── */
      var boneObjs = {}; // joint index → Bone
      (json.skins || []).forEach(function (sk) {
        sk.joints.forEach(function (ji) {
          if (!boneObjs[ji]) {
            var nd   = json.nodes[ji];
            var bone = new T3.Bone();
            bone.name = nd.name || ('bone_' + ji);
            if (nd.matrix) {
              var m4 = new T3.Matrix4(); m4.fromArray(nd.matrix);
              m4.decompose(bone.position, bone.quaternion, bone.scale);
            } else {
              if (nd.translation) bone.position.fromArray(nd.translation);
              if (nd.rotation)    bone.quaternion.fromArray(nd.rotation);
              if (nd.scale)       bone.scale.fromArray(nd.scale);
            }
            boneObjs[ji] = bone;
          }
        });
        // rebuild children between bones
        sk.joints.forEach(function (ji) {
          var nd = json.nodes[ji];
          (nd.children || []).forEach(function (ci) {
            if (boneObjs[ci] && boneObjs[ji] && !boneObjs[ci].parent)
              boneObjs[ji].add(boneObjs[ci]);
          });
        });
      });

      /* ── 3. Build skeletons ───────────────────────────────────── */
      var skeletons = (json.skins || []).map(function (sk) {
        var bones = sk.joints.map(function (j) { return boneObjs[j]; });
        var ibmData = getAccessor(json, binBuf, sk.inverseBindMatrices);
        var boneInverses = bones.map(function (_, i) {
          var mx = new T3.Matrix4(); mx.fromArray(ibmData, i * 16); return mx;
        });
        return new T3.Skeleton(bones, boneInverses);
      });

      /* ── 4. Build meshes and attach to their nodes ───────────── */
      var scene = new T3.Group();
      scene.name = 'Scene';

      (json.nodes || []).forEach(function (nd, ni) {
        if (nd.mesh === undefined) return;
        var meshDef = json.meshes[nd.mesh];
        var skinIdx = nd.skin !== undefined ? nd.skin : -1;
        var sk = skinIdx >= 0 ? skeletons[skinIdx] : null;

        (meshDef.primitives || []).forEach(function (prim) {
          var geo   = new T3.BufferGeometry();
          var attrs = prim.attributes || {};

          function setAttr(name, accIdx, Ctor, itemSize) {
            if (accIdx === undefined) return;
            var data = getAccessor(json, binBuf, accIdx);
            geo.setAttribute(name, new T3.BufferAttribute(new Ctor(data), itemSize));
          }
          setAttr('position',  attrs.POSITION,   Float32Array, 3);
          setAttr('normal',    attrs.NORMAL,      Float32Array, 3);
          setAttr('uv',        attrs.TEXCOORD_0,  Float32Array, 2);
          setAttr('skinIndex', attrs.JOINTS_0,    Uint16Array,  4);
          setAttr('skinWeight',attrs.WEIGHTS_0,   Float32Array, 4);
          if (prim.indices !== undefined) {
            var idxData = getAccessor(json, binBuf, prim.indices);
            geo.setIndex(new T3.BufferAttribute(new Uint32Array(idxData), 1));
          }

          var isSkinned = !!geo.attributes.skinIndex && !!sk;
          var mat = new T3.MeshStandardMaterial({
            color: 0xaaaaaa, roughness: 0.6, metalness: 0.1,
            skinning: isSkinned
          });
          var mesh = isSkinned ? new T3.SkinnedMesh(geo, mat) : new T3.Mesh(geo, mat);
          mesh.name = nd.name || meshDef.name || ('mesh_' + ni);
          mesh.castShadow    = false;
          mesh.receiveShadow = false;

          if (isSkinned) {
            mesh.normalizeSkinWeights();
            var rootBone = sk.bones[0];
            scene.add(rootBone);   // bones live under scene
            mesh.bind(sk);
          }

          // Apply node transform to the mesh
          if (nd.matrix) {
            var m4 = new T3.Matrix4(); m4.fromArray(nd.matrix);
            m4.decompose(mesh.position, mesh.quaternion, mesh.scale);
          } else {
            if (nd.translation) mesh.position.fromArray(nd.translation);
            if (nd.rotation)    mesh.quaternion.fromArray(nd.rotation);
            if (nd.scale)       mesh.scale.fromArray(nd.scale);
          }

          scene.add(mesh);
        });
      });

      onLoad({ scene: scene, scenes: [scene], animations: [], cameras: [], asset: json.asset || {} });
    } catch (e) {
      if (onError) onError(e); else console.error('GLB parse error', e);
    }
  }

  function install(T) {
    if (T.GLTFLoader) return;
    function GLTFLoader() {}
    GLTFLoader.prototype.load = function (url, onLoad, _onProgress, onError) {
      fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(function (buf) { parseGLB(buf, onLoad, onError); })
        .catch(function (e) { if (onError) onError(e); else console.error(e); });
    };
    T.GLTFLoader = GLTFLoader;
  }

  if (window.THREE) { install(window.THREE); }
  else {
    var t = setInterval(function () {
      if (window.THREE) { clearInterval(t); install(window.THREE); }
    }, 40);
  }
})();
