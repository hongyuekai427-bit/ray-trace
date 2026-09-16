// RayTrace Lab - Scene Presets
import { SceneData, createObject, createLight, createMaterial } from './types';

function baseScene(): SceneData {
  return {
    version: 1,
    name: '',
    camera: { position: [0, 3, 7], target: [0, 0.5, 0], up: [0, 1, 0], fov: 60, near: 0.1, far: 100 },
    objects: [],
    lights: [],
    materials: [],
    environment: { type: 'gradient', color: [0.1, 0.15, 0.3], color2: [0.4, 0.5, 0.7], intensity: 0.3 },
    rendererSettings: { resolution: 100, samples: 4, maxBounces: 4, shadowSamples: 1, progressive: true, renderMode: 'full', toneMapping: 'aces', showGrid: true, showAxes: true, denoise: false, useBVH: true },
  };
}

export function threeSpheresPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Three Spheres';

  const m1 = createMaterial('diffuse', 'Red');
  m1.baseColor = [0.8, 0.15, 0.15];
  const m2 = createMaterial('metal', 'Gold');
  m2.baseColor = [1.0, 0.76, 0.33];
  m2.roughness = 0.15;
  const m3 = createMaterial('glass', 'Crystal');
  m3.baseColor = [0.9, 0.95, 1.0];
  m3.ior = 1.8;
  const floor = createMaterial('diffuse', 'Floor');
  floor.baseColor = [0.4, 0.4, 0.42];
  floor.roughness = 0.85;

  scene.materials = [m1, m2, m3, floor];

  const o1 = createObject('sphere', m1.id);
  o1.name = 'Red Sphere';
  o1.transform.position = [-2, 1, 0];
  o1.radius = 1;

  const o2 = createObject('sphere', m2.id);
  o2.name = 'Gold Sphere';
  o2.transform.position = [0, 1, 0];
  o2.radius = 1;

  const o3 = createObject('sphere', m3.id);
  o3.name = 'Crystal Sphere';
  o3.transform.position = [2, 1, 0];
  o3.radius = 1;

  const fl = createObject('plane', floor.id);
  fl.name = 'Floor';

  scene.objects = [fl, o1, o2, o3];

  const l1 = createLight('point');
  l1.name = 'Key Light';
  l1.position = [4, 6, 4];
  l1.intensity = 2.5;
  l1.color = [1, 0.95, 0.9];

  const l2 = createLight('point');
  l2.name = 'Fill Light';
  l2.position = [-3, 4, -2];
  l2.intensity = 0.8;
  l2.color = [0.6, 0.7, 1.0];

  scene.lights = [l1, l2];
  scene.environment = { type: 'sky', color: [0.15, 0.2, 0.35], color2: [0.5, 0.6, 0.8], intensity: 0.4 };
  return scene;
}

export function mirrorRoomPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Mirror Room';

  const mirror = createMaterial('reflective', 'Mirror');
  mirror.baseColor = [0.95, 0.95, 0.97];
  mirror.roughness = 0.02;
  mirror.reflectivity = 0.98;

  const red = createMaterial('diffuse', 'Red Wall');
  red.baseColor = [0.7, 0.1, 0.1];
  const blue = createMaterial('diffuse', 'Blue Wall');
  blue.baseColor = [0.1, 0.1, 0.7];
  const white = createMaterial('diffuse', 'White');
  white.baseColor = [0.8, 0.8, 0.8];

  scene.materials = [mirror, red, blue, white];

  const floor = createObject('plane', white.id);
  floor.name = 'Floor';

  const mirrorBall = createObject('sphere', mirror.id);
  mirrorBall.name = 'Mirror Ball';
  mirrorBall.transform.position = [0, 1.5, 0];
  mirrorBall.radius = 1.5;

  const redSphere = createObject('sphere', red.id);
  redSphere.name = 'Red Sphere';
  redSphere.transform.position = [-2, 0.6, 1];
  redSphere.radius = 0.6;

  const blueSphere = createObject('sphere', blue.id);
  blueSphere.name = 'Blue Sphere';
  blueSphere.transform.position = [2, 0.6, -1];
  blueSphere.radius = 0.6;

  scene.objects = [floor, mirrorBall, redSphere, blueSphere];

  const l1 = createLight('point');
  l1.name = 'Top Light';
  l1.position = [0, 5, 0];
  l1.intensity = 3;

  const l2 = createLight('point');
  l2.name = 'Side Light';
  l2.position = [3, 2, 3];
  l2.intensity = 1.5;
  l2.color = [1, 0.8, 0.6];

  scene.lights = [l1, l2];
  scene.environment = { type: 'dark', color: [0.02, 0.02, 0.05], color2: [0.05, 0.05, 0.1], intensity: 0.2 };
  scene.rendererSettings.maxBounces = 8;
  return scene;
}

export function glassLabPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Glass Laboratory';

  const glass1 = createMaterial('glass', 'Crown Glass');
  glass1.ior = 1.52;
  glass1.baseColor = [0.95, 0.98, 1.0];

  const glass2 = createMaterial('glass', 'Flint Glass');
  glass2.ior = 1.66;
  glass2.baseColor = [1.0, 0.95, 0.9];

  const glass3 = createMaterial('glass', 'Diamond');
  glass3.ior = 2.42;
  glass3.baseColor = [1.0, 1.0, 1.0];
  glass3.transmission = 0.98;

  const floor = createMaterial('diffuse', 'Dark Floor');
  floor.baseColor = [0.15, 0.15, 0.18];

  scene.materials = [glass1, glass2, glass3, floor];

  const fl = createObject('plane', floor.id);
  fl.name = 'Floor';

  const s1 = createObject('sphere', glass1.id);
  s1.name = 'Crown Glass';
  s1.transform.position = [-2, 1, 0];
  s1.radius = 1;

  const s2 = createObject('sphere', glass2.id);
  s2.name = 'Flint Glass';
  s2.transform.position = [0, 1, 0];
  s2.radius = 1;

  const s3 = createObject('sphere', glass3.id);
  s3.name = 'Diamond';
  s3.transform.position = [2, 1, 0];
  s3.radius = 1;

  scene.objects = [fl, s1, s2, s3];

  const l1 = createLight('point');
  l1.position = [0, 5, 3];
  l1.intensity = 3;

  scene.lights = [l1];
  scene.environment = { type: 'gradient', color: [0.2, 0.25, 0.4], color2: [0.6, 0.7, 0.9], intensity: 0.5 };
  scene.rendererSettings.maxBounces = 8;
  return scene;
}

export function cornellBoxPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Cornell Box';

  const white = createMaterial('diffuse', 'White');
  white.baseColor = [0.73, 0.73, 0.73];
  const red = createMaterial('diffuse', 'Red');
  red.baseColor = [0.63, 0.065, 0.05];
  const green = createMaterial('diffuse', 'Green');
  green.baseColor = [0.14, 0.45, 0.091];
  const light = createMaterial('emissive', 'Light');
  light.emissionStrength = 15;
  light.baseColor = [1, 0.95, 0.8];

  scene.materials = [white, red, green, light];

  const floor = createObject('plane', white.id);
  floor.name = 'Floor';

  const backWall = createObject('plane', white.id);
  backWall.name = 'Back Wall';
  backWall.transform.position = [0, 0, -3];
  backWall.transform.rotation = [Math.PI / 2, 0, 0];

  const leftWall = createObject('plane', red.id);
  leftWall.name = 'Left Wall';
  leftWall.transform.position = [-3, 0, 0];
  leftWall.transform.rotation = [0, 0, -Math.PI / 2];

  const rightWall = createObject('plane', green.id);
  rightWall.name = 'Right Wall';
  rightWall.transform.position = [3, 0, 0];
  rightWall.transform.rotation = [0, 0, Math.PI / 2];

  const ceiling = createObject('plane', white.id);
  ceiling.name = 'Ceiling';
  ceiling.transform.position = [0, 5.5, 0];
  ceiling.transform.rotation = [Math.PI, 0, 0];

  const tallBox = createObject('box', white.id);
  tallBox.name = 'Tall Box';
  tallBox.transform.position = [1, 1.5, -0.5];
  tallBox.transform.rotation = [0, -0.3, 0];
  tallBox.size = [1.5, 3, 1.5];

  const shortBox = createObject('box', white.id);
  shortBox.name = 'Short Box';
  shortBox.transform.position = [-1, 0.75, 0.5];
  shortBox.transform.rotation = [0, 0.3, 0];
  shortBox.size = [1.5, 1.5, 1.5];

  const lightBox = createObject('plane', light.id);
  lightBox.name = 'Area Light';
  lightBox.transform.position = [0, 5.49, 0];
  lightBox.transform.rotation = [Math.PI, 0, 0];
  lightBox.size = [2, 2, 1];

  scene.objects = [floor, backWall, leftWall, rightWall, ceiling, tallBox, shortBox, lightBox];

  const l1 = createLight('point');
  l1.position = [0, 5, 0];
  l1.intensity = 5;
  l1.color = [1, 0.95, 0.8];

  scene.lights = [l1];
  scene.camera.position = [0, 2.75, 8];
  scene.camera.target = [0, 2.75, 0];
  scene.camera.fov = 45;
  scene.environment = { type: 'dark', color: [0.01, 0.01, 0.01], color2: [0.01, 0.01, 0.01], intensity: 0.1 };
  return scene;
}

export function sunsetPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Sunset';

  const ground = createMaterial('diffuse', 'Sand');
  ground.baseColor = [0.76, 0.6, 0.4];
  ground.roughness = 0.95;

  const stone = createMaterial('diffuse', 'Stone');
  stone.baseColor = [0.5, 0.45, 0.4];
  stone.roughness = 0.85;

  scene.materials = [ground, stone];

  const floor = createObject('plane', ground.id);
  floor.name = 'Ground';

  for (let i = 0; i < 5; i++) {
    const s = createObject('sphere', stone.id);
    s.name = `Stone ${i + 1}`;
    s.transform.position = [(Math.random() - 0.5) * 8, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 6 - 2];
    s.radius = 0.3 + Math.random() * 0.7;
    scene.objects.push(s);
  }
  scene.objects.unshift(floor);

  const sun = createLight('directional');
  sun.name = 'Sun';
  sun.direction = [-0.5, 0.2, -0.8];
  sun.color = [1.0, 0.6, 0.3];
  sun.intensity = 3;

  scene.lights = [sun];
  scene.environment = {
    type: 'gradient',
    color: [0.8, 0.3, 0.1],
    color2: [0.2, 0.1, 0.3],
    intensity: 0.6,
  };
  return scene;
}

export function neonRoomPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Neon Room';

  const dark = createMaterial('diffuse', 'Dark');
  dark.baseColor = [0.05, 0.05, 0.08];

  const neon1 = createMaterial('emissive', 'Neon Pink');
  neon1.emission = [1, 0.1, 0.5];
  neon1.emissionStrength = 8;

  const neon2 = createMaterial('emissive', 'Neon Blue');
  neon2.emission = [0.1, 0.3, 1];
  neon2.emissionStrength = 8;

  const neon3 = createMaterial('emissive', 'Neon Green');
  neon3.emission = [0.1, 1, 0.3];
  neon3.emissionStrength = 8;

  const chrome = createMaterial('metal', 'Chrome');
  chrome.baseColor = [0.9, 0.9, 0.95];
  chrome.roughness = 0.05;

  scene.materials = [dark, neon1, neon2, neon3, chrome];

  const floor = createObject('plane', dark.id);
  floor.name = 'Floor';

  const s1 = createObject('sphere', neon1.id);
  s1.name = 'Pink Neon';
  s1.transform.position = [-2, 1, 0];
  s1.radius = 0.8;

  const s2 = createObject('sphere', neon2.id);
  s2.name = 'Blue Neon';
  s2.transform.position = [0, 1, -1];
  s2.radius = 0.8;

  const s3 = createObject('sphere', neon3.id);
  s3.name = 'Green Neon';
  s3.transform.position = [2, 1, 0];
  s3.radius = 0.8;

  const chromeSphere = createObject('sphere', chrome.id);
  chromeSphere.name = 'Chrome Sphere';
  chromeSphere.transform.position = [0, 0.8, 1.5];
  chromeSphere.radius = 0.8;

  scene.objects = [floor, s1, s2, s3, chromeSphere];

  const l1 = createLight('point');
  l1.position = [0, 4, 0];
  l1.intensity = 0.5;
  l1.color = [0.3, 0.2, 0.5];

  scene.lights = [l1];
  scene.environment = { type: 'dark', color: [0.01, 0.01, 0.02], color2: [0.02, 0.01, 0.05], intensity: 0.1 };
  return scene;
}

export function materialGalleryPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Material Gallery';

  const floor = createMaterial('diffuse', 'Floor');
  floor.baseColor = [0.35, 0.35, 0.38];

  const matte = createMaterial('diffuse', 'Matte Red');
  matte.baseColor = [0.8, 0.2, 0.2];
  matte.roughness = 0.95;

  const polished = createMaterial('diffuse', 'Polished Blue');
  polished.baseColor = [0.2, 0.3, 0.8];
  polished.roughness = 0.1;

  const mirror = createMaterial('reflective', 'Mirror');
  mirror.baseColor = [0.95, 0.95, 0.95];
  mirror.reflectivity = 0.98;

  const gold = createMaterial('metal', 'Gold');
  gold.baseColor = [1.0, 0.76, 0.33];
  gold.roughness = 0.15;

  const glass = createMaterial('glass', 'Glass');
  glass.baseColor = [0.9, 0.95, 1.0];
  glass.ior = 1.5;

  const emissive = createMaterial('emissive', 'Emissive');
  emissive.emission = [1, 0.8, 0.4];
  emissive.emissionStrength = 5;

  scene.materials = [floor, matte, polished, mirror, gold, glass, emissive];

  const fl = createObject('plane', floor.id);
  fl.name = 'Floor';
  scene.objects.push(fl);

  const materials = [matte, polished, mirror, gold, glass, emissive];
  const names = ['Matte', 'Polished', 'Mirror', 'Gold', 'Glass', 'Emissive'];
  materials.forEach((m, i) => {
    const s = createObject('sphere', m.id);
    s.name = names[i];
    s.transform.position = [(i - 2.5) * 2, 1, 0];
    s.radius = 0.8;
    scene.objects.push(s);
  });

  const l1 = createLight('point');
  l1.position = [0, 5, 4];
  l1.intensity = 2.5;

  const l2 = createLight('point');
  l2.position = [-4, 3, -2];
  l2.intensity = 1;
  l2.color = [0.7, 0.8, 1.0];

  scene.lights = [l1, l2];
  scene.environment = { type: 'sky', color: [0.15, 0.2, 0.35], color2: [0.5, 0.6, 0.8], intensity: 0.3 };
  return scene;
}

export function rayPlaygroundPreset(): SceneData {
  const scene = baseScene();
  scene.name = 'Ray Playground';

  const diffuse = createMaterial('diffuse', 'Diffuse');
  diffuse.baseColor = [0.6, 0.6, 0.65];

  const reflective = createMaterial('reflective', 'Reflective');
  reflective.baseColor = [0.9, 0.9, 0.95];
  reflective.reflectivity = 0.9;

  const glass = createMaterial('glass', 'Glass');
  glass.ior = 1.5;

  scene.materials = [diffuse, reflective, glass];

  const floor = createObject('plane', diffuse.id);
  floor.name = 'Floor';

  const s1 = createObject('sphere', reflective.id);
  s1.name = 'Mirror';
  s1.transform.position = [-1.5, 1, 0];
  s1.radius = 1;

  const s2 = createObject('sphere', glass.id);
  s2.name = 'Glass';
  s2.transform.position = [1.5, 1, 0];
  s2.radius = 1;

  scene.objects = [floor, s1, s2];

  const l1 = createLight('point');
  l1.position = [0, 4, 3];
  l1.intensity = 3;

  scene.lights = [l1];
  scene.camera.position = [0, 2.5, 6];
  scene.camera.target = [0, 0.5, 0];
  scene.environment = { type: 'gradient', color: [0.1, 0.12, 0.2], color2: [0.3, 0.4, 0.6], intensity: 0.3 };
  scene.rendererSettings.maxBounces = 6;
  return scene;
}

export const PRESETS = {
  'Three Spheres': threeSpheresPreset,
  'Mirror Room': mirrorRoomPreset,
  'Glass Laboratory': glassLabPreset,
  'Cornell Box': cornellBoxPreset,
  'Sunset': sunsetPreset,
  'Neon Room': neonRoomPreset,
  'Material Gallery': materialGalleryPreset,
  'Ray Playground': rayPlaygroundPreset,
};
