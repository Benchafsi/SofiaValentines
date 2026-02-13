(() => {
  gsap.registerPlugin(ScrollTrigger);

  const canvas = document.getElementById("scene-canvas");
  const storyRoot = document.querySelector(".story");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b1f, 0.017);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 90);
  camera.position.set(0, 0.35, 14);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const world = new THREE.Group();
  scene.add(world);

  const ambient = new THREE.AmbientLight(0xaec3ff, 0.9);
  scene.add(ambient);

  const rimLight = new THREE.DirectionalLight(0xb7c9ff, 1.05);
  rimLight.position.set(-3.5, 4, 6);
  scene.add(rimLight);

  const coolFill = new THREE.PointLight(0x7192ff, 1.2, 28, 2);
  coolFill.position.set(4, -1, 3);
  scene.add(coolFill);

  const warmLight = new THREE.PointLight(0xffbb88, 0.25, 30, 2);
  warmLight.position.set(-0.4, -1.7, -3.8);
  scene.add(warmLight);

  function makeSoftTexture(innerColor, outerColor) {
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 256;
    texCanvas.height = 256;
    const ctx = texCanvas.getContext("2d");

    const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 128);
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(0.45, innerColor);
    gradient.addColorStop(1, outerColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    return new THREE.CanvasTexture(texCanvas);
  }

  function createStarField(count, spread) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const r = 10 + Math.random() * spread;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
      positions[i * 3 + 2] = -Math.abs(r * Math.cos(phi));
      sizes[i] = Math.random() * 1.2 + 0.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      color: 0xf8f9ff,
      size: 0.1,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    return new THREE.Points(geometry, material);
  }

  function createDustCloud(count, width, height, depth) {
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * width;
      positions[i * 3 + 1] = (Math.random() - 0.5) * height;
      positions[i * 3 + 2] = -Math.random() * depth;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xa3b7ff,
      size: 0.065,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geometry, material);
  }

  function createPlanet(options) {
    const {
      radius,
      color,
      emissive,
      roughness,
      metalness,
      glowColor,
      glowScale,
      ring
    } = options;

    const container = new THREE.Group();

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 48),
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.22,
        roughness,
        metalness
      })
    );
    container.add(sphere);

    const glowTexture = makeSoftTexture("rgba(255,255,255,0.75)", "rgba(255,255,255,0)");
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: glowColor,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    glow.scale.set(glowScale, glowScale, 1);
    container.add(glow);

    if (ring) {
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.72, radius * 0.12, 16, 90),
        new THREE.MeshStandardMaterial({
          color: ring.color,
          emissive: ring.color,
          emissiveIntensity: 0.17,
          transparent: true,
          opacity: 0.65,
          roughness: 0.5,
          metalness: 0.2
        })
      );
      ringMesh.rotation.x = ring.tiltX;
      ringMesh.rotation.z = ring.tiltZ;
      container.add(ringMesh);
    }

    return { container, sphere, glow };
  }

  function createAstronaut() {
    const suitMain = new THREE.MeshStandardMaterial({ color: 0xeef2ff, roughness: 0.4, metalness: 0.15 });
    const suitDark = new THREE.MeshStandardMaterial({ color: 0x4c5f92, roughness: 0.6, metalness: 0.1 });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x93a7ff,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.85,
      transparent: true,
      opacity: 0.68
    });

    const astronaut = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.75, 10, 18), suitMain);
    torso.rotation.z = -0.08;
    astronaut.add(torso);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.25), suitDark);
    backpack.position.set(-0.03, -0.02, -0.31);
    backpack.rotation.z = -0.07;
    astronaut.add(backpack);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 24), suitMain);
    head.position.set(0.03, 0.69, 0.04);
    astronaut.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 30, 30), visorMat);
    helmet.position.copy(head.position);
    astronaut.add(helmet);

    const armGeo = new THREE.CapsuleGeometry(0.1, 0.42, 6, 10);
    const leftArm = new THREE.Mesh(armGeo, suitMain);
    leftArm.position.set(-0.39, 0.1, 0.03);
    leftArm.rotation.set(0.1, 0.1, 0.7);
    astronaut.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, suitMain);
    rightArm.position.set(0.42, 0.04, 0.03);
    rightArm.rotation.set(-0.05, -0.1, -0.9);
    astronaut.add(rightArm);

    const legGeo = new THREE.CapsuleGeometry(0.11, 0.45, 8, 12);
    const leftLeg = new THREE.Mesh(legGeo, suitMain);
    leftLeg.position.set(-0.15, -0.72, 0.02);
    leftLeg.rotation.z = 0.11;
    astronaut.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, suitMain);
    rightLeg.position.set(0.16, -0.69, 0.02);
    rightLeg.rotation.z = -0.14;
    astronaut.add(rightLeg);

    return astronaut;
  }

  const starsFar = createStarField(3200, 65);
  world.add(starsFar);

  const starsNear = createStarField(1800, 35);
  starsNear.material.opacity = 0.55;
  starsNear.scale.setScalar(0.7);
  world.add(starsNear);

  const dust = createDustCloud(1400, 16, 8, 28);
  dust.position.z = 4;
  world.add(dust);

  const nebulaTexture = makeSoftTexture("rgba(156,181,255,0.45)", "rgba(12,20,66,0)");
  const warmNebulaTexture = makeSoftTexture("rgba(255,186,142,0.38)", "rgba(32,14,10,0)");

  const nebulaA = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: nebulaTexture,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  nebulaA.position.set(-5.5, 1.8, -14);
  nebulaA.scale.set(11, 6.5, 1);
  world.add(nebulaA);

  const nebulaB = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmNebulaTexture,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  nebulaB.position.set(6.4, -2.4, -12);
  nebulaB.scale.set(9, 5.5, 1);
  world.add(nebulaB);

  const journeyPlanet = createPlanet({
    radius: 1.06,
    color: 0x657fd1,
    emissive: 0x1c2b68,
    roughness: 0.85,
    metalness: 0.05,
    glowColor: 0x87a8ff,
    glowScale: 3.8,
    ring: {
      color: 0x8698d6,
      tiltX: 1.2,
      tiltZ: 0.42
    }
  });
  journeyPlanet.container.position.set(3.4, 0.75, -4.8);
  world.add(journeyPlanet.container);

  const deepPlanet = createPlanet({
    radius: 0.72,
    color: 0x4e668f,
    emissive: 0x1d3051,
    roughness: 0.78,
    metalness: 0.08,
    glowColor: 0x7f9de0,
    glowScale: 2.7
  });
  deepPlanet.container.position.set(-4.8, -1.35, -8.4);
  world.add(deepPlanet.container);

  const connectionSystem = new THREE.Group();
  connectionSystem.position.set(2.5, -0.2, -3.2);
  connectionSystem.scale.set(0.76, 0.76, 0.76);
  world.add(connectionSystem);

  const orbitPivot = new THREE.Group();
  connectionSystem.add(orbitPivot);

  const orbitPlanetA = createPlanet({
    radius: 0.65,
    color: 0x8ca0ee,
    emissive: 0x283f92,
    roughness: 0.74,
    metalness: 0.12,
    glowColor: 0xa8beff,
    glowScale: 2.4
  });
  orbitPivot.add(orbitPlanetA.container);

  const orbitPlanetB = createPlanet({
    radius: 0.56,
    color: 0xefb79f,
    emissive: 0x854f3e,
    roughness: 0.62,
    metalness: 0.08,
    glowColor: 0xffc9a6,
    glowScale: 2.2
  });
  orbitPivot.add(orbitPlanetB.container);

  const homePlanet = createPlanet({
    radius: 1.45,
    color: 0x8aa1f1,
    emissive: 0x324b9e,
    roughness: 0.67,
    metalness: 0.1,
    glowColor: 0xffbf94,
    glowScale: 5.8
  });
  homePlanet.container.position.set(-0.05, -0.95, -4.25);
  homePlanet.container.scale.set(0.5, 0.5, 0.5);
  homePlanet.glow.material.opacity = 0.2;
  world.add(homePlanet.container);

  const haloTexture = makeSoftTexture("rgba(255,194,149,0.65)", "rgba(0,0,0,0)");
  const homeHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  homeHalo.position.copy(homePlanet.container.position);
  homeHalo.scale.set(8.8, 8.8, 1);
  world.add(homeHalo);

  const astronaut = createAstronaut();
  astronaut.position.set(-1.4, 0.3, 0.35);
  astronaut.rotation.set(-0.2, 0.25, 0.11);
  world.add(astronaut);

  const astronautAnchor = astronaut.position.clone();

  if (!prefersReducedMotion) {
    gsap.to(astronaut.position, {
      y: astronaut.position.y + 0.28,
      duration: 3.8,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1
    });

    gsap.to(astronaut.rotation, {
      z: astronaut.rotation.z + 0.14,
      x: astronaut.rotation.x + 0.04,
      duration: 5.2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1
    });
  }

  const focusPoint = { x: 0, y: 0, z: 0 };

  // Narrative camera journey controlled by scroll position.
  const storyTimeline = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: storyRoot,
      start: "top top",
      end: "bottom bottom",
      scrub: prefersReducedMotion ? false : 1.2
    }
  });

  storyTimeline
    .to(camera.position, { x: 1.55, y: 0.55, z: 10.8, duration: 1 }, 0)
    .to(focusPoint, { x: -0.75, y: 0.2, z: 0.2, duration: 1 }, 0)
    .to(journeyPlanet.container.position, { x: 2.4, y: 0.52, z: -2.4, duration: 1 }, 0.05)
    .to(deepPlanet.container.position, { x: -5.8, y: -1.6, z: -9.8, duration: 1 }, 0)

    .to(camera.position, { x: 2.9, y: 0.3, z: 8.4, duration: 1 }, 1)
    .to(focusPoint, { x: 2.4, y: -0.2, z: -3.1, duration: 1 }, 1)
    .to(connectionSystem.scale, { x: 1, y: 1, z: 1, duration: 1 }, 1)
    .to(connectionSystem.position, { x: 2.05, y: -0.12, z: -2.75, duration: 1 }, 1)

    .to(camera.position, { x: 0.4, y: 0.18, z: 7.2, duration: 1 }, 2)
    .to(focusPoint, { x: 0, y: -0.5, z: -4.05, duration: 1 }, 2)
    .to(homePlanet.container.scale, { x: 1, y: 1, z: 1, duration: 1 }, 2)
    .to(homePlanet.glow.material, { opacity: 0.42, duration: 1 }, 2)
    .to(homeHalo.material, { opacity: 0.42, duration: 1 }, 2)
    .to(warmLight, { intensity: 1.22, duration: 1 }, 2)
    .to(coolFill, { intensity: 0.85, duration: 1 }, 2);

  // Reveal each caption as the user enters the related scene chapter.
  document.querySelectorAll(".panel").forEach((panel) => {
    const caption = panel.querySelector(".caption");
    if (!caption) {
      return;
    }

    gsap.fromTo(
      caption,
      { autoAlpha: 0, y: 26 },
      {
        autoAlpha: 1,
        y: 0,
        ease: "power2.out",
        scrollTrigger: {
          trigger: panel,
          start: "top 72%",
          end: "top 46%",
          scrub: prefersReducedMotion ? false : 0.9
        }
      }
    );

    gsap.to(caption, {
      autoAlpha: 0,
      y: -30,
      ease: "power2.out",
      scrollTrigger: {
        trigger: panel,
        start: "bottom 58%",
        end: "bottom 26%",
        scrub: prefersReducedMotion ? false : 0.9
      }
    });
  });

  gsap.fromTo(
    ".title, .eyebrow",
    { autoAlpha: 0, y: 20 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 1.2,
      ease: "power2.out"
    }
  );

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0
  };

  window.addEventListener("pointermove", (event) => {
    pointer.targetX = event.clientX / window.innerWidth - 0.5;
    pointer.targetY = event.clientY / window.innerHeight - 0.5;
  });

  const clock = new THREE.Clock();

  function renderLoop() {
    const elapsed = clock.getElapsedTime();

    pointer.x += (pointer.targetX - pointer.x) * 0.035;
    pointer.y += (pointer.targetY - pointer.y) * 0.035;

    world.rotation.y = pointer.x * 0.09;
    world.rotation.x = -pointer.y * 0.045;

    starsFar.rotation.y = elapsed * 0.01;
    starsNear.rotation.y = -elapsed * 0.016;
    dust.rotation.z = elapsed * 0.02;

    nebulaA.position.y = 1.8 + Math.sin(elapsed * 0.24) * 0.15;
    nebulaB.position.y = -2.4 + Math.cos(elapsed * 0.27) * 0.18;

    orbitPivot.rotation.y = elapsed * 0.45;
    orbitPlanetA.container.position.set(Math.cos(elapsed * 0.9) * 1.05, Math.sin(elapsed * 1.1) * 0.18, Math.sin(elapsed * 0.9) * 1.05);
    orbitPlanetB.container.position.set(Math.cos(elapsed * 0.9 + Math.PI) * 1.05, Math.sin(elapsed * 1.1 + Math.PI) * 0.18, Math.sin(elapsed * 0.9 + Math.PI) * 1.05);

    journeyPlanet.container.rotation.y += 0.003;
    deepPlanet.container.rotation.y += 0.0022;
    homePlanet.container.rotation.y += 0.0018;

    astronaut.position.x = astronautAnchor.x + Math.sin(elapsed * 0.5) * 0.08;

    camera.lookAt(focusPoint.x, focusPoint.y, focusPoint.z);
    renderer.render(scene, camera);

    requestAnimationFrame(renderLoop);
  }

  renderLoop();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
