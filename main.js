import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

(() => {
  gsap.registerPlugin(ScrollTrigger);

  const canvas = document.getElementById("scene-canvas");
  const storyRoot = document.querySelector(".story");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const astronautModelUrl = "assets/astronaut.glb";
  const heartModelUrl = "assets/heart.obj";

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

  function createStarTexture({
    shape = "star4",
    innerRadius = 12,
    outerRadius = 30,
    blurRadius = 56
  } = {}) {
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 128;
    texCanvas.height = 128;
    const ctx = texCanvas.getContext("2d");
    const center = texCanvas.width * 0.5;

    ctx.clearRect(0, 0, texCanvas.width, texCanvas.height);

    const halo = ctx.createRadialGradient(center, center, 1, center, center, blurRadius);
    halo.addColorStop(0, "rgba(255,255,255,0.95)");
    halo.addColorStop(0.3, "rgba(255,255,255,0.62)");
    halo.addColorStop(0.72, "rgba(255,255,255,0.2)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(center, center, blurRadius, 0, Math.PI * 2);
    ctx.fill();

    const drawSpiked = (spikes, innerScale = 1) => {
      const twist = (Math.random() - 0.5) * 0.18;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i += 1) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2 + twist;
        const jitter = 0.86 + Math.random() * 0.28;
        const radius = (i % 2 === 0 ? outerRadius : innerRadius * innerScale) * jitter;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
    };

    if (shape === "diamond") {
      drawSpiked(4, 0.62);
    } else if (shape === "burst") {
      drawSpiked(7, 0.5);
    } else if (shape === "star5") {
      drawSpiked(5, 1);
    } else {
      drawSpiked(4, 1);
    }

    const starFill = ctx.createRadialGradient(center, center, 1, center, center, outerRadius * 1.2);
    starFill.addColorStop(0, "rgba(255,255,255,1)");
    starFill.addColorStop(1, "rgba(255,255,255,0.3)");
    ctx.fillStyle = starFill;
    ctx.fill();

    const core = ctx.createRadialGradient(center, center, 0, center, center, outerRadius * 0.46);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(center, center, outerRadius * 0.46, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function createStarField(count, spread, palette, options = {}) {
    const {
      sizeMultiplier = 1,
      baseOpacity = 0.9,
      alphaThreshold = 0.18,
      yScale = 0.75,
      clampNegativeZ = true
    } = options;

    const field = new THREE.Group();
    const materials = [];
    const color = new THREE.Color();

    const variants = [
      { shape: "star4", weight: 0.35, size: 0.16, texture: createStarTexture({ shape: "star4", innerRadius: 12, outerRadius: 30, blurRadius: 56 }) },
      { shape: "star5", weight: 0.28, size: 0.15, texture: createStarTexture({ shape: "star5", innerRadius: 11, outerRadius: 28, blurRadius: 54 }) },
      { shape: "diamond", weight: 0.2, size: 0.14, texture: createStarTexture({ shape: "diamond", innerRadius: 10, outerRadius: 27, blurRadius: 52 }) },
      { shape: "burst", weight: 0.17, size: 0.13, texture: createStarTexture({ shape: "burst", innerRadius: 9, outerRadius: 26, blurRadius: 50 }) }
    ];

    let used = 0;
    variants.forEach((variant, index) => {
      const isLast = index === variants.length - 1;
      const variantCount = isLast ? count - used : Math.max(1, Math.floor(count * variant.weight));
      used += variantCount;

      const positions = new Float32Array(variantCount * 3);
      const colors = new Float32Array(variantCount * 3);

      for (let i = 0; i < variantCount; i += 1) {
        const r = 10 + Math.random() * spread;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * yScale;
        const z = r * Math.cos(phi);
        positions[i * 3 + 2] = clampNegativeZ ? -Math.abs(z) : z;

        color.setHex(palette[(Math.random() * palette.length) | 0]);
        color.offsetHSL((Math.random() - 0.5) * 0.1, 0.14 + Math.random() * 0.24, (Math.random() - 0.5) * 0.12);
        colors[i * 3 + 0] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        map: variant.texture,
        alphaMap: variant.texture,
        vertexColors: true,
        size: variant.size * sizeMultiplier,
        transparent: true,
        opacity: baseOpacity,
        alphaTest: alphaThreshold,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });

      materials.push(material);
      field.add(new THREE.Points(geometry, material));
    });

    field.userData.materials = materials;
    return field;
  }

  function setStarFieldOpacity(field, opacity) {
    const materials = field?.userData?.materials ?? [];
    for (const material of materials) {
      material.opacity = opacity;
    }
  }

  function createEarthTexture() {
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 1024;
    texCanvas.height = 512;
    const ctx = texCanvas.getContext("2d");

    const ocean = ctx.createLinearGradient(0, 0, 0, texCanvas.height);
    ocean.addColorStop(0, "#4f98d5");
    ocean.addColorStop(0.45, "#2f77b8");
    ocean.addColorStop(1, "#1d4f8e");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);

    function drawContinent(cx, cy, rx, ry, color) {
      const points = 18;
      ctx.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const jitter = 0.75 + Math.random() * 0.45;
        const x = cx + Math.cos(a) * rx * jitter;
        const y = cy + Math.sin(a) * ry * jitter;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    for (let i = 0; i < 12; i += 1) {
      const cx = Math.random() * texCanvas.width;
      const cy = 90 + Math.random() * 330;
      const rx = 30 + Math.random() * 80;
      const ry = 20 + Math.random() * 55;
      drawContinent(cx, cy, rx, ry, i % 2 === 0 ? "#5ea26b" : "#6ca86f");

      ctx.globalAlpha = 0.2;
      drawContinent(cx + 8, cy + 5, rx * 0.75, ry * 0.65, "#d0ba86");
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < 18; i += 1) {
      const x = Math.random() * texCanvas.width;
      const y = 55 + Math.random() * (texCanvas.height - 110);
      const w = 120 + Math.random() * 230;
      const h = 20 + Math.random() * 34;
      const cloudGrad = ctx.createRadialGradient(x, y, 10, x, y, w * 0.5);
      cloudGrad.addColorStop(0, "rgba(255,255,255,0.28)");
      cloudGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cloudGrad;
      ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
    }

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function createCloudTexture() {
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 1024;
    texCanvas.height = 512;
    const ctx = texCanvas.getContext("2d");

    ctx.clearRect(0, 0, texCanvas.width, texCanvas.height);
    for (let i = 0; i < 36; i += 1) {
      const x = Math.random() * texCanvas.width;
      const y = Math.random() * texCanvas.height;
      const r = 24 + Math.random() * 88;
      const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.42)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function createFallingStarTexture() {
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 256;
    texCanvas.height = 64;
    const ctx = texCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, texCanvas.width, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.35)");
    gradient.addColorStop(0.7, "rgba(255,245,220,0.95)");
    gradient.addColorStop(1, "rgba(255,245,220,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createFallingStars(count) {
    const starTexture = createFallingStarTexture();
    const stars = [];

    for (let i = 0; i < count; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: starTexture,
        color: i % 2 === 0 ? 0xbfd4ff : 0xffdfbc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      world.add(sprite);

      stars.push({
        sprite,
        velocity: new THREE.Vector3(),
        life: 0,
        duration: 1.1,
        wait: Math.random() * 7
      });
    }

    return stars;
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
      map,
      cloudMap,
      cloudOpacity,
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
        map,
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

    let cloudLayer = null;
    if (cloudMap) {
      cloudLayer = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.02, 48, 48),
        new THREE.MeshStandardMaterial({
          map: cloudMap,
          transparent: true,
          opacity: cloudOpacity ?? 0.35,
          depthWrite: false,
          roughness: 1,
          metalness: 0
        })
      );
      container.add(cloudLayer);
    }

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

    return { container, sphere, glow, cloudLayer };
  }

  function createAstronaut() {
    const suitMain = new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.45, metalness: 0.12 });
    const suitPanel = new THREE.MeshStandardMaterial({ color: 0xd7e0ff, roughness: 0.5, metalness: 0.16 });
    const suitDark = new THREE.MeshStandardMaterial({ color: 0x445986, roughness: 0.62, metalness: 0.08 });
    const suitJoint = new THREE.MeshStandardMaterial({ color: 0x6b7fa8, roughness: 0.72, metalness: 0.05 });
    const suitBoot = new THREE.MeshStandardMaterial({ color: 0x1a233d, roughness: 0.78, metalness: 0.05 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x9db7ff,
      emissive: 0x577ee6,
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0.4
    });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x8eabff,
      metalness: 0.08,
      roughness: 0.03,
      transmission: 0.9,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.7
    });

    const astronaut = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.74, 10, 20), suitMain);
    torso.rotation.z = -0.05;
    astronaut.add(torso);

    const torsoPanel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.18), suitPanel);
    torsoPanel.position.set(0.02, 0.12, 0.24);
    torsoPanel.rotation.x = -0.08;
    astronaut.add(torsoPanel);

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.2, 20), suitPanel);
    waist.position.set(0.01, -0.5, 0.02);
    waist.rotation.z = -0.03;
    astronaut.add(waist);

    const chestConsole = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.06), suitDark);
    chestConsole.position.set(0.04, 0.08, 0.34);
    astronaut.add(chestConsole);

    for (let i = 0; i < 3; i += 1) {
      const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), accentMat);
      indicator.position.set(-0.02 + i * 0.045, 0.085, 0.375);
      astronaut.add(indicator);
    }

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.56, 0.24), suitDark);
    backpack.position.set(-0.03, -0.02, -0.33);
    backpack.rotation.z = -0.06;
    astronaut.add(backpack);

    const thrusterLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.22, 16), suitJoint);
    thrusterLeft.position.set(-0.16, -0.22, -0.45);
    thrusterLeft.rotation.x = Math.PI * 0.5;
    backpack.add(thrusterLeft);

    const thrusterRight = thrusterLeft.clone();
    thrusterRight.position.x = 0.12;
    backpack.add(thrusterRight);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 26, 26), suitMain);
    head.position.set(0.03, 0.67, 0.03);
    astronaut.add(head);

    const helmetShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.33, 34, 34),
      new THREE.MeshPhysicalMaterial({
        color: 0xf4f8ff,
        roughness: 0.04,
        metalness: 0.05,
        transmission: 0.18,
        transparent: true,
        opacity: 0.28
      })
    );
    helmetShell.position.copy(head.position);
    astronaut.add(helmetShell);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 18), visorMat);
    visor.position.set(head.position.x + 0.02, head.position.y - 0.01, head.position.z + 0.16);
    visor.scale.set(1, 0.95, 0.62);
    astronaut.add(visor);

    const helmetRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 12, 36), suitDark);
    helmetRing.position.set(head.position.x, head.position.y - 0.02, head.position.z - 0.01);
    helmetRing.rotation.x = Math.PI * 0.5;
    astronaut.add(helmetRing);

    const createArm = (side) => {
      const arm = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.083, 0.22, 6, 12), suitMain);
      upper.rotation.z = side * 0.45;
      arm.add(upper);

      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 14), suitJoint);
      elbow.position.set(side * 0.14, -0.1, 0.01);
      arm.add(elbow);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.2, 6, 12), suitPanel);
      forearm.position.set(side * 0.22, -0.2, 0.05);
      forearm.rotation.set(side * 0.1, side * 0.05, side * 0.72);
      arm.add(forearm);

      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 18), suitDark);
      glove.position.set(side * 0.29, -0.28, 0.08);
      arm.add(glove);

      arm.position.set(side * 0.37, 0.1, 0.03);
      arm.rotation.set(side * 0.05, 0.08, side * 0.17);
      return arm;
    };

    astronaut.add(createArm(-1));
    astronaut.add(createArm(1));

    const createLeg = (side) => {
      const leg = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 6, 12), suitMain);
      leg.add(upper);

      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), suitJoint);
      knee.position.set(0, -0.17, 0.02);
      leg.add(knee);

      const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.083, 0.22, 6, 12), suitPanel);
      lower.position.set(0.01, -0.34, 0.07);
      lower.rotation.x = -0.18;
      leg.add(lower);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.3), suitBoot);
      boot.position.set(0.03, -0.51, 0.19);
      boot.rotation.x = 0.2;
      leg.add(boot);

      leg.position.set(side * 0.15, -0.69, 0.01);
      leg.rotation.z = -side * 0.11;
      return leg;
    };

    astronaut.add(createLeg(-1));
    astronaut.add(createLeg(1));

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 10), suitJoint);
    antenna.position.set(-0.14, 0.94, -0.08);
    antenna.rotation.z = -0.26;
    astronaut.add(antenna);

    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), accentMat);
    antennaTip.position.set(-0.18, 1.05, -0.09);
    astronaut.add(antennaTip);

    const tetherCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.18, -0.1, -0.43),
      new THREE.Vector3(-0.48, -0.16, -0.55),
      new THREE.Vector3(-0.72, -0.08, -0.18),
      new THREE.Vector3(-0.45, 0.16, 0.08)
    ]);
    const tether = new THREE.Mesh(new THREE.TubeGeometry(tetherCurve, 28, 0.012, 8, false), suitJoint);
    astronaut.add(tether);

    astronaut.scale.setScalar(0.96);

    return astronaut;
  }

  function normalizeAstronautModel(model) {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    if (size.y <= 0.0001) {
      return model;
    }

    const targetHeight = 2.05;
    const scale = targetHeight / size.y;
    model.scale.multiplyScalar(scale);

    const scaledBounds = new THREE.Box3().setFromObject(model);
    const scaledCenter = new THREE.Vector3();
    scaledBounds.getCenter(scaledCenter);
    model.position.sub(scaledCenter);

    const recenteredBounds = new THREE.Box3().setFromObject(model);
    const feetY = recenteredBounds.min.y;
    model.position.y += -0.92 - feetY;

    return model;
  }

  function loadAstronautModel(url) {
    if (window.location.protocol === "file:") {
      console.warn("[Astronaut] GLB loading is often blocked on file:// URLs. Use a local server (http://localhost).");
    }

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
    loader.setDRACOLoader(dracoLoader);

    return new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!model) {
            resolve(null);
            return;
          }

          model.traverse((node) => {
            if (!node.isMesh) {
              return;
            }
            node.castShadow = false;
            node.receiveShadow = false;
            node.frustumCulled = false;

            const materialList = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materialList) {
              if (!material) {
                continue;
              }

              if ("envMapIntensity" in material) {
                material.envMapIntensity = Math.max(material.envMapIntensity || 0, 1.45);
              }
              if ("roughness" in material && typeof material.roughness === "number") {
                material.roughness = Math.min(material.roughness, 0.75);
              }
              if ("metalness" in material && typeof material.metalness === "number") {
                material.metalness *= 0.65;
              }
              if ("color" in material && material.color) {
                material.color.multiplyScalar(1.16);
              }
              if ("emissive" in material && material.emissive) {
                material.emissive.add(new THREE.Color(0x2a3d64));
                material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.36);
              }
              material.needsUpdate = true;
            }
          });

            resolve(normalizeAstronautModel(model));
            console.info("[Astronaut] GLB loaded:", url);
            dracoLoader.dispose();
          },
          undefined,
          (error) => {
            console.error("[Astronaut] Failed to load GLB:", url, error);
            resolve(null);
            dracoLoader.dispose();
          }
        );
      });
  }

  function normalizeHeartModel(model) {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.3 / maxAxis;
    model.scale.multiplyScalar(scale);
    model.position.sub(center);
    // OBJ from Blender is usually Z-up; rotate to Y-up so the heart is upright.
    model.rotation.set(-Math.PI * 0.5, 0.36, 0.04);
    return model;
  }

  function loadHeartModel(url) {
    const loader = new OBJLoader();
    return new Promise((resolve) => {
      loader.load(
        url,
        (obj) => {
          const heart = normalizeHeartModel(obj);
          heart.traverse((node) => {
            if (!node.isMesh) {
              return;
            }

            node.material = new THREE.MeshPhysicalMaterial({
              color: 0xff2c5b,
              emissive: 0x6f0018,
              emissiveIntensity: 0.55,
              roughness: 0.28,
              metalness: 0.08,
              clearcoat: 0.65,
              clearcoatRoughness: 0.22
            });
            node.castShadow = false;
            node.receiveShadow = false;
            node.frustumCulled = false;
          });

          console.info("[Heart] OBJ loaded:", url);
          resolve(heart);
        },
        undefined,
        (error) => {
          console.error("[Heart] Failed to load OBJ:", url, error);
          resolve(null);
        }
      );
    });
  }

  function createHeartParticles(count = 180) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);

    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 0.62 + Math.random() * 0.48;
      const speed = 0.45 + Math.random() * 1.1;

      positions[i * 3 + 0] = Math.cos(theta) * Math.sin(phi) * radius * 0.95;
      positions[i * 3 + 1] = Math.cos(phi) * radius * 0.8;
      positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius * 0.95;

      seeds[i * 4 + 0] = theta;
      seeds[i * 4 + 1] = phi;
      seeds[i * 4 + 2] = radius;
      seeds[i * 4 + 3] = speed;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const sparkleTexture = makeSoftTexture("rgba(255,175,190,0.95)", "rgba(255,50,86,0)");
    const material = new THREE.PointsMaterial({
      color: 0xff4b6f,
      map: sparkleTexture,
      alphaMap: sparkleTexture,
      size: 0.11,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData.seeds = seeds;
    return particles;
  }

  const farPalette = [0xffffff, 0x9ec5ff, 0x88a9ff, 0xd39aff, 0xff9cc8, 0x8fffe5, 0xffbf7f];
  const nearPalette = [0xffffff, 0x88d0ff, 0x7395ff, 0xc490ff, 0xff87c1, 0x9dffe9, 0xffb064];

  const starsFar = createStarField(3400, 65, farPalette, {
    sizeMultiplier: 1.15,
    baseOpacity: 0.86,
    alphaThreshold: 0.08
  });
  world.add(starsFar);

  const starsNear = createStarField(2000, 35, nearPalette, {
    sizeMultiplier: 1.9,
    baseOpacity: 0.95,
    alphaThreshold: 0.06
  });
  setStarFieldOpacity(starsNear, 0.8);
  starsNear.scale.setScalar(1.1);
  world.add(starsNear);

  // A closer layer to make the star shapes clearly visible in the foreground.
  const starsAccent = createStarField(900, 16, nearPalette, {
    sizeMultiplier: 2.8,
    baseOpacity: 1,
    alphaThreshold: 0.045,
    clampNegativeZ: false
  });
  starsAccent.position.z = 3.8;
  starsAccent.position.y = 0.4;
  world.add(starsAccent);

  const dust = createDustCloud(1400, 16, 8, 28);
  dust.position.z = 4;
  world.add(dust);

  const nebulaTexture = makeSoftTexture("rgba(156,181,255,0.45)", "rgba(12,20,66,0)");
  const warmNebulaTexture = makeSoftTexture("rgba(255,186,142,0.38)", "rgba(32,14,10,0)");
  const roseNebulaTexture = makeSoftTexture("rgba(255,155,206,0.36)", "rgba(28,9,24,0)");

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

  const nebulaC = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: roseNebulaTexture,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  nebulaC.position.set(0.8, 2.8, -15.5);
  nebulaC.scale.set(10.2, 5.2, 1);
  world.add(nebulaC);

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
  journeyPlanet.container.position.set(3.8, 1.05, -5.4);
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
  deepPlanet.container.position.set(-5.9, -1.7, -9.7);
  world.add(deepPlanet.container);

  const connectionSystem = new THREE.Group();
  connectionSystem.position.set(-3.3, -0.34, -4.9);
  connectionSystem.scale.set(0.64, 0.64, 0.64);
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

  const earthSurfaceMap = createEarthTexture();
  const earthCloudMap = createCloudTexture();

  const homePlanet = createPlanet({
    radius: 1.45,
    color: 0xffffff,
    emissive: 0x16355e,
    map: earthSurfaceMap,
    cloudMap: earthCloudMap,
    cloudOpacity: 0.34,
    roughness: 0.8,
    metalness: 0.1,
    glowColor: 0xffbf94,
    glowScale: 5.8
  });
  homePlanet.container.position.set(0.24, -0.95, -4.45);
  homePlanet.container.scale.set(0.44, 0.44, 0.44);
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

  const atmosphereTexture = makeSoftTexture("rgba(143,196,255,0.6)", "rgba(143,196,255,0)");
  const earthAtmosphere = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: atmosphereTexture,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  earthAtmosphere.position.copy(homePlanet.container.position);
  earthAtmosphere.scale.set(7.4, 7.4, 1);
  world.add(earthAtmosphere);

  const heartReveal = { value: 0 };
  const heartAnchor = new THREE.Vector3();
  const heartDesktopOffset = new THREE.Vector3(1.18, 0.1, 0.22);
  const heartMobileOffset = new THREE.Vector3(0.7, -0.08, 0.16);

  function updateHeartAnchor() {
    if (window.innerWidth <= 760) {
      heartAnchor.copy(homePlanet.container.position).add(heartMobileOffset);
    } else {
      heartAnchor.copy(homePlanet.container.position).add(heartDesktopOffset);
    }
  }

  updateHeartAnchor();

  const heartRig = new THREE.Group();
  heartRig.visible = false;
  heartRig.position.copy(heartAnchor);
  heartRig.scale.setScalar(0.001);
  world.add(heartRig);

  const heartAuraTexture = makeSoftTexture("rgba(255,92,130,0.78)", "rgba(255,44,91,0)");
  const heartAura = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: heartAuraTexture,
      color: 0xff5a7f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  heartAura.scale.set(3.4, 3.4, 1);
  heartRig.add(heartAura);

  const heartParticles = createHeartParticles(prefersReducedMotion ? 90 : 190);
  heartRig.add(heartParticles);

  const heartLight = new THREE.PointLight(0xff4f72, 0, 12, 2);
  heartLight.position.set(0.1, 0.12, 0.7);
  heartRig.add(heartLight);

  const heartTrailTexture = makeSoftTexture("rgba(255,130,160,0.86)", "rgba(255,50,95,0)");
  const heartTrailCount = prefersReducedMotion ? 5 : 9;
  const heartTrail = [];
  const heartTrailPositions = [];
  for (let i = 0; i < heartTrailCount; i += 1) {
    const trailSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: heartTrailTexture,
        color: i % 2 === 0 ? 0xff4e73 : 0xff7a9a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    trailSprite.visible = false;
    trailSprite.scale.set(0.9 - i * 0.065, 0.9 - i * 0.065, 1);
    world.add(trailSprite);
    heartTrail.push(trailSprite);
    heartTrailPositions.push(heartAnchor.clone());
  }

  loadHeartModel(heartModelUrl).then((heartModel) => {
    if (!heartModel) {
      return;
    }
    heartRig.add(heartModel);
  });

  const fallingStars = createFallingStars(prefersReducedMotion ? 3 : 7);

  function spawnFallingStar(star) {
    const startX = -10 + Math.random() * 18;
    const startY = 2.1 + Math.random() * 3.8;
    const startZ = -4 - Math.random() * 10;
    star.sprite.position.set(startX, startY, startZ);

    const speed = 4.4 + Math.random() * 2.8;
    star.velocity.set(0.95 * speed, -0.55 * speed, -0.38 * speed);
    star.sprite.scale.set(1.35 + Math.random() * 1.45, 0.075 + Math.random() * 0.04, 1);
    star.sprite.material.rotation = Math.atan2(star.velocity.y, star.velocity.x);
    star.sprite.material.opacity = 0.82;
    star.life = 0;
    star.duration = 0.7 + Math.random() * 0.55;
    star.sprite.visible = true;
  }

  function updateFallingStars(delta) {
    for (const star of fallingStars) {
      if (!star.sprite.visible) {
        star.wait -= delta;
        if (star.wait <= 0) {
          spawnFallingStar(star);
        }
        continue;
      }

      star.life += delta;
      star.sprite.position.addScaledVector(star.velocity, delta);

      const progress = star.life / star.duration;
      star.sprite.material.opacity = (1 - progress) * 0.9;

      if (star.life >= star.duration) {
        star.sprite.visible = false;
        star.wait = 2.4 + Math.random() * 8.2;
      }
    }
  }

  const astronautRig = new THREE.Group();
  const astronautContainer = new THREE.Group();
  const fallbackAstronaut = createAstronaut();
  fallbackAstronaut.rotation.set(-0.17, 0.12, 0.1);
  astronautContainer.add(fallbackAstronaut);

  astronautRig.position.set(-4.05, -2.2, 2.25);
  astronautRig.rotation.set(-0.07, 0.34, 0.04);
  astronautRig.add(astronautContainer);

  const astronautAmbientLight = new THREE.AmbientLight(0xe3ebff, 0.55);
  astronautRig.add(astronautAmbientLight);

  const astronautKeyLight = new THREE.PointLight(0xd7e4ff, 2.05, 14, 2);
  astronautKeyLight.position.set(1.2, 0.7, 1.35);
  astronautRig.add(astronautKeyLight);

  const astronautFillLight = new THREE.PointLight(0xffd7ba, 1.15, 12, 2);
  astronautFillLight.position.set(-1.05, -0.5, 1.05);
  astronautRig.add(astronautFillLight);

  const astronautRimLight = new THREE.PointLight(0x8fafff, 0.95, 12, 2);
  astronautRimLight.position.set(-0.22, 0.55, -1.25);
  astronautRig.add(astronautRimLight);

  world.add(astronautRig);

  const astronautAnchor = astronautRig.position.clone();
  const astronautRigRotationAnchor = astronautRig.rotation.clone();
  const astronautContainerAnchor = astronautContainer.position.clone();
  const astronautContainerRotationAnchor = astronautContainer.rotation.clone();
  const astronautScrollState = {
    target: 0,
    current: 0
  };

  loadAstronautModel(astronautModelUrl).then((loadedAstronaut) => {
    if (!loadedAstronaut) {
      return;
    }
    astronautContainer.clear();
    astronautContainer.add(loadedAstronaut);
  });

  if (!prefersReducedMotion) {
    gsap.to(astronautContainer.position, {
      y: astronautContainerAnchor.y + 0.28,
      duration: 3.8,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1
    });

    gsap.to(astronautContainer.rotation, {
      z: astronautContainerRotationAnchor.z + 0.14,
      x: astronautContainerRotationAnchor.x + 0.04,
      duration: 5.2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1
    });

    ScrollTrigger.create({
      trigger: storyRoot,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        astronautScrollState.target = self.progress;
      }
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
    .to(camera.position, { x: 1.35, y: 0.52, z: 11.1, duration: 1 }, 0)
    .to(focusPoint, { x: -0.75, y: 0.2, z: 0.2, duration: 1 }, 0)
    .to(journeyPlanet.container.position, { x: 2.45, y: 0.62, z: -2.9, duration: 1 }, 0.05)
    .to(deepPlanet.container.position, { x: -6.4, y: -1.95, z: -10.2, duration: 1 }, 0)
    .to(connectionSystem.position, { x: -4.2, y: -0.54, z: -6.2, duration: 1 }, 0)

    .to(camera.position, { x: 2.6, y: 0.3, z: 8.8, duration: 1 }, 1)
    .to(focusPoint, { x: 2.05, y: -0.22, z: -3.45, duration: 1 }, 1)
    .to(connectionSystem.scale, { x: 1, y: 1, z: 1, duration: 1 }, 1)
    .to(connectionSystem.position, { x: 2.1, y: -0.18, z: -3.45, duration: 1 }, 1)
    .to(journeyPlanet.container.position, { x: 5.9, y: 1.35, z: -7.1, duration: 1 }, 1)

    .to(camera.position, { x: 0.3, y: 0.16, z: 7, duration: 1 }, 2)
    .to(focusPoint, { x: 0.25, y: -0.52, z: -4.35, duration: 1 }, 2)
    .to(homePlanet.container.scale, { x: 1, y: 1, z: 1, duration: 1 }, 2)
    .to(homePlanet.glow.material, { opacity: 0.42, duration: 1 }, 2)
    .to(connectionSystem.position, { x: 4.8, y: 1.18, z: -8.6, duration: 1 }, 2)
    .to(connectionSystem.scale, { x: 0.72, y: 0.72, z: 0.72, duration: 1 }, 2)
    .to(earthAtmosphere.material, { opacity: 0.32, duration: 1 }, 2)
    .to(homeHalo.material, { opacity: 0.42, duration: 1 }, 2)
    .to(warmLight, { intensity: 1.22, duration: 1 }, 2)
    .to(coolFill, { intensity: 0.85, duration: 1 }, 2)
    .to(heartReveal, { value: 1, duration: 1 }, 2);

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
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    pointer.x += (pointer.targetX - pointer.x) * 0.035;
    pointer.y += (pointer.targetY - pointer.y) * 0.035;

    world.rotation.y = pointer.x * 0.09;
    world.rotation.x = -pointer.y * 0.045;

    starsFar.rotation.y = elapsed * 0.01;
    starsNear.rotation.y = -elapsed * 0.016;
    starsAccent.rotation.y = elapsed * 0.03;
    starsAccent.rotation.x = Math.sin(elapsed * 0.2) * 0.05;
    dust.rotation.z = elapsed * 0.02;

    nebulaA.position.y = 1.8 + Math.sin(elapsed * 0.24) * 0.15;
    nebulaB.position.y = -2.4 + Math.cos(elapsed * 0.27) * 0.18;
    nebulaC.position.y = 2.8 + Math.sin(elapsed * 0.18 + 0.8) * 0.2;

    orbitPivot.rotation.y = elapsed * 0.45;
    orbitPlanetA.container.position.set(Math.cos(elapsed * 0.9) * 1.05, Math.sin(elapsed * 1.1) * 0.18, Math.sin(elapsed * 0.9) * 1.05);
    orbitPlanetB.container.position.set(Math.cos(elapsed * 0.9 + Math.PI) * 1.05, Math.sin(elapsed * 1.1 + Math.PI) * 0.18, Math.sin(elapsed * 0.9 + Math.PI) * 1.05);

    journeyPlanet.container.rotation.y += 0.003;
    deepPlanet.container.rotation.y += 0.0022;
    homePlanet.container.rotation.y += 0.0018;
    if (homePlanet.cloudLayer) {
      homePlanet.cloudLayer.rotation.y += 0.0026;
    }

    astronautScrollState.current += (astronautScrollState.target - astronautScrollState.current) * 0.08;
    const scrollDrift = prefersReducedMotion ? 0 : astronautScrollState.current - 0.5;
    const scrollWave = prefersReducedMotion ? 0 : Math.sin(astronautScrollState.current * Math.PI * 2);

    const driftPhase = prefersReducedMotion ? 0 : elapsed * 0.62;
    const bobX = Math.sin(driftPhase) * 0.26 + Math.cos(driftPhase * 0.45) * 0.07;
    const bobY = Math.sin(driftPhase * 0.82 + 1.1) * 0.22;
    const bobZ = Math.cos(driftPhase * 0.7) * 0.18;

    astronautRig.position.x = astronautAnchor.x + bobX * 0.7 + scrollDrift * 0.72;
    astronautRig.position.y = astronautAnchor.y + bobY * 0.75 + Math.sin(scrollDrift * Math.PI) * 0.18;
    astronautRig.position.z = astronautAnchor.z + bobZ - scrollDrift * 1.05 + scrollWave * 0.18;
    const pitchOffset = prefersReducedMotion ? 0 : (Math.cos(astronautScrollState.current * Math.PI * 1.6) - 1) * 0.06;
    astronautRig.rotation.x = astronautRigRotationAnchor.x + pitchOffset + Math.sin(driftPhase * 0.55) * 0.05;
    astronautRig.rotation.y = astronautRigRotationAnchor.y + scrollDrift * 0.34 + (prefersReducedMotion ? 0 : elapsed * 0.04);
    astronautRig.rotation.z = astronautRigRotationAnchor.z + scrollWave * 0.16 + Math.cos(driftPhase * 0.5) * 0.08;

    astronautContainer.rotation.y = astronautContainerRotationAnchor.y + (prefersReducedMotion ? 0 : Math.sin(elapsed * 0.9) * 0.2);

    const heartVisibility = THREE.MathUtils.clamp(heartReveal.value, 0, 1);
    const heartIsVisible = heartVisibility > 0.01;
    heartRig.visible = heartIsVisible;
    if (heartIsVisible) {
      const pulse = 1 + Math.sin(elapsed * 5.2) * 0.06 * heartVisibility;
      heartRig.scale.setScalar(Math.max(0.001, heartVisibility) * pulse);
      heartRig.position.copy(heartAnchor);
      heartRig.position.y += Math.sin(elapsed * 1.45) * 0.1 * heartVisibility;
      heartRig.rotation.y = elapsed * 0.72;
      heartRig.rotation.x = -0.16 + Math.cos(elapsed * 0.7) * 0.06;

      heartAura.material.opacity = 0.08 + heartVisibility * 0.48;
      heartLight.intensity = 0.15 + heartVisibility * 1.75;

      const particleMaterial = heartParticles.material;
      particleMaterial.opacity = 0.12 + heartVisibility * 0.75;
      heartParticles.rotation.y = elapsed * 0.95;
      heartParticles.rotation.z = Math.sin(elapsed * 0.8) * 0.4;

      for (let i = 0; i < heartTrail.length; i += 1) {
        const followTarget = i === 0 ? heartRig.position : heartTrailPositions[i - 1];
        const followStrength = Math.max(0.08, 0.32 - i * 0.022);
        heartTrailPositions[i].lerp(followTarget, followStrength);

        const trailSprite = heartTrail[i];
        trailSprite.visible = true;
        trailSprite.position.copy(heartTrailPositions[i]);
        trailSprite.position.z -= i * 0.06;
        const baseScale = Math.max(0.18, 0.86 - i * 0.07);
        trailSprite.scale.set(baseScale * heartVisibility, baseScale * heartVisibility, 1);
        trailSprite.material.opacity = Math.max(0.02, (0.32 - i * 0.03) * heartVisibility);
      }

      const positionAttr = heartParticles.geometry.getAttribute("position");
      const positionArray = positionAttr.array;
      const seeds = heartParticles.userData.seeds;
      for (let i = 0; i < seeds.length / 4; i += 1) {
        const theta = seeds[i * 4 + 0] + elapsed * seeds[i * 4 + 3] * 0.35;
        const phi = seeds[i * 4 + 1] + Math.sin(elapsed * 0.7 + i * 0.04) * 0.09;
        const radius = seeds[i * 4 + 2] + Math.sin(elapsed * seeds[i * 4 + 3] + i * 0.13) * 0.09 * heartVisibility;

        positionArray[i * 3 + 0] = Math.cos(theta) * Math.sin(phi) * radius * 0.95;
        positionArray[i * 3 + 1] = Math.cos(phi) * radius * 0.8;
        positionArray[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius * 0.95;
      }
      positionAttr.needsUpdate = true;
    } else {
      for (let i = 0; i < heartTrail.length; i += 1) {
        heartTrail[i].visible = false;
      }
    }

    updateFallingStars(delta);

    camera.lookAt(focusPoint.x, focusPoint.y, focusPoint.z);
    renderer.render(scene, camera);

    requestAnimationFrame(renderLoop);
  }

  renderLoop();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    updateHeartAnchor();
    for (let i = 0; i < heartTrailPositions.length; i += 1) {
      heartTrailPositions[i].copy(heartAnchor);
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

