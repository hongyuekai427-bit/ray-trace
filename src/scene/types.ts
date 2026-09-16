// RayTrace Lab - Scene Types
import { Vec3, generateId } from '../math';

export type PrimitiveType = 'sphere' | 'plane' | 'box' | 'cylinder' | 'cone';
export type LightType = 'point' | 'directional' | 'area';
export type MaterialType = 'diffuse' | 'reflective' | 'glass' | 'emissive' | 'metal';
export type RenderMode = 'full' | 'direct' | 'normals' | 'depth' | 'albedo' | 'roughness' | 'metallic' | 'emission' | 'shadows' | 'bounceCount';
export type EnvironmentType = 'solid' | 'gradient' | 'sky' | 'checkerboard' | 'dark';
export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  baseColor: [number, number, number];
  roughness: number;
  metallic: number;
  reflectivity: number;
  transmission: number;
  ior: number;
  emission: [number, number, number];
  emissionStrength: number;
}

export interface SceneObject {
  id: string;
  name: string;
  type: PrimitiveType;
  transform: Transform;
  materialId: string;
  visible: boolean;
  locked: boolean;
  // Primitive-specific params
  radius?: number;
  size?: [number, number, number];
  height?: number;
}

export interface SceneLight {
  id: string;
  name: string;
  type: LightType;
  position: [number, number, number];
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  radius: number;
  size?: [number, number];
  visible: boolean;
}

export interface Camera {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export interface Environment {
  type: EnvironmentType;
  color: [number, number, number];
  color2: [number, number, number];
  intensity: number;
}

export interface RendererSettings {
  resolution: number;
  samples: number;
  maxBounces: number;
  shadowSamples: number;
  progressive: boolean;
  renderMode: RenderMode;
  toneMapping: 'none' | 'reinhard' | 'aces';
  showGrid: boolean;
  showAxes: boolean;
  denoise: boolean;
  useBVH: boolean;
}

export interface RayDebugInfo {
  pixelX: number;
  pixelY: number;
  bounces: RayBounce[];
}

export interface RayBounce {
  type: 'primary' | 'shadow' | 'reflection' | 'refraction';
  origin: [number, number, number];
  direction: [number, number, number];
  hitDistance: number;
  hitObjectId: string | null;
  hitNormal: [number, number, number];
  materialId: string | null;
  color: [number, number, number];
}

export interface SceneData {
  version: number;
  name: string;
  camera: Camera;
  objects: SceneObject[];
  lights: SceneLight[];
  materials: Material[];
  environment: Environment;
  rendererSettings: RendererSettings;
}

// Default material factory
export function createMaterial(type: MaterialType = 'diffuse', name?: string): Material {
  const id = generateId();
  const base: Material = {
    id,
    name: name || type.charAt(0).toUpperCase() + type.slice(1),
    type,
    baseColor: [0.8, 0.8, 0.8],
    roughness: 0.5,
    metallic: 0.0,
    reflectivity: 0.0,
    transmission: 0.0,
    ior: 1.5,
    emission: [1, 1, 1],
    emissionStrength: 0.0,
  };

  switch (type) {
    case 'diffuse':
      base.roughness = 0.9;
      base.reflectivity = 0.02;
      break;
    case 'reflective':
      base.roughness = 0.05;
      base.reflectivity = 0.95;
      base.metallic = 0.9;
      break;
    case 'glass':
      base.roughness = 0.0;
      base.transmission = 0.95;
      base.ior = 1.5;
      base.reflectivity = 0.04;
      break;
    case 'emissive':
      base.emissionStrength = 5.0;
      base.roughness = 1.0;
      break;
    case 'metal':
      base.roughness = 0.2;
      base.metallic = 1.0;
      base.reflectivity = 0.9;
      break;
  }
  return base;
}

export function createObject(type: PrimitiveType = 'sphere', materialId?: string): SceneObject {
  const id = generateId();
  const names: Record<string, string> = { sphere: 'Sphere', plane: 'Plane', box: 'Box', cylinder: 'Cylinder', cone: 'Cone' };
  return {
    id,
    name: (names[type] || 'Object') + ' ' + id.substring(0, 4),
    type,
    transform: {
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialId: materialId || '',
    visible: true,
    locked: false,
    radius: 1,
    size: [1, 1, 1],
    height: 2,
  };
}

export function createLight(type: LightType = 'point'): SceneLight {
  const id = generateId();
  return {
    id,
    name: type.charAt(0).toUpperCase() + type.slice(1) + ' Light ' + id.substring(0, 4),
    type,
    position: [3, 5, 3],
    direction: [0, -1, 0],
    color: [1, 1, 1],
    intensity: 1.0,
    radius: 0.5,
    size: [2, 2],
    visible: true,
  };
}

export function createDefaultScene(): SceneData {
  const mat1 = createMaterial('diffuse', 'Red Diffuse');
  mat1.baseColor = [0.8, 0.2, 0.2];
  const mat2 = createMaterial('reflective', 'Mirror');
  mat2.baseColor = [0.95, 0.95, 0.95];
  const mat3 = createMaterial('glass', 'Glass');
  mat3.baseColor = [0.9, 0.95, 1.0];
  const matFloor = createMaterial('diffuse', 'Floor');
  matFloor.baseColor = [0.5, 0.5, 0.5];
  matFloor.roughness = 0.8;

  const obj1 = createObject('sphere', mat1.id);
  obj1.name = 'Red Sphere';
  obj1.transform.position = [-1.5, 1, 0];
  obj1.radius = 1;

  const obj2 = createObject('sphere', mat2.id);
  obj2.name = 'Mirror Sphere';
  obj2.transform.position = [1.5, 1, 0];
  obj2.radius = 1;

  const obj3 = createObject('sphere', mat3.id);
  obj3.name = 'Glass Sphere';
  obj3.transform.position = [0, 1, -1.5];
  obj3.radius = 1;

  const floor = createObject('plane', matFloor.id);
  floor.name = 'Floor';
  floor.transform.position = [0, 0, 0];
  floor.transform.rotation = [0, 0, 0];

  const light1 = createLight('point');
  light1.name = 'Main Light';
  light1.position = [3, 5, 3];
  light1.intensity = 2.0;

  const light2 = createLight('point');
  light2.name = 'Fill Light';
  light2.position = [-3, 3, -2];
  light2.color = [0.5, 0.6, 1.0];
  light2.intensity = 0.8;

  return {
    version: 1,
    name: 'Default Scene',
    camera: {
      position: [0, 3, 7],
      target: [0, 0.5, 0],
      up: [0, 1, 0],
      fov: 60,
      near: 0.1,
      far: 100,
    },
    objects: [floor, obj1, obj2, obj3],
    lights: [light1, light2],
    materials: [mat1, mat2, mat3, matFloor],
    environment: {
      type: 'gradient',
      color: [0.1, 0.15, 0.3],
      color2: [0.4, 0.5, 0.7],
      intensity: 0.3,
    },
    rendererSettings: {
      resolution: 100,
      samples: 4,
      maxBounces: 4,
      shadowSamples: 1,
      progressive: true,
      renderMode: 'full',
      toneMapping: 'aces',
      showGrid: true,
      showAxes: true,
      denoise: false,
      useBVH: true,
    },
  };
}
