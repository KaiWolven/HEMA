/* =====================================================
   HEMA Poses — Weapon geometry builders
   Exposes window.HEMAWeapons = { buildRopera, buildEspadaLarga }
   ===================================================== */
window.HEMAWeapons = (function () {

  function buildRopera(THREE, parent) {
    const steel = new THREE.MeshStandardMaterial({ color: 0xd7dee6, roughness: 0.28, metalness: 0.85 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x3a3027, roughness: 0.6,  metalness: 0.3  });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.4,  metalness: 0.7  });
    const grp = new THREE.Group();

    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0035, 1.02, 8), steel);
    blade.position.y = -0.62; blade.castShadow = true; grp.add(blade);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 10), dark);
    grip.position.y = -0.06; grp.add(grip);

    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8), brass);
    cross.rotation.z = Math.PI / 2; cross.position.y = -0.11; grp.add(cross);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 24), brass);
    ring.position.y = -0.11; ring.rotation.x = Math.PI / 2; grp.add(ring);

    const knuckle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 8, 20, Math.PI), brass);
    knuckle.position.y = -0.07; knuckle.rotation.y = Math.PI / 2; knuckle.rotation.z = -0.2; grp.add(knuckle);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), brass);
    pommel.position.y = 0.0; grp.add(pommel);

    grp.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    parent.add(grp);
    return grp;
  }

  function buildEspadaLarga(THREE, parent) {
    const steel = new THREE.MeshStandardMaterial({ color: 0xd7dee6, roughness: 0.28, metalness: 0.85 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x3a3027, roughness: 0.6,  metalness: 0.3  });
    const grp = new THREE.Group();

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.034, 1.04, 0.008), steel);
    blade.position.y = -0.66; blade.castShadow = true; grp.add(blade);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.07, 4), steel);
    tip.position.y = -1.21; tip.rotation.y = Math.PI / 4; grp.add(tip);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.012, 0.26, 10), dark);
    grip.position.y = -0.0; grp.add(grip);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.018, 0.018), steel);
    cross.position.y = -0.14; grp.add(cross);

    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 12), steel);
    pommel.position.y = 0.15; grp.add(pommel);

    grp.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    parent.add(grp);
    return grp;
  }

  return { buildRopera: buildRopera, buildEspadaLarga: buildEspadaLarga };
})();
