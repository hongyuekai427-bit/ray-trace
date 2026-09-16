// RayTrace Lab - Application State Store
import { create } from 'zustand';
import { SceneData, SceneObject, SceneLight, Material, Camera, Environment, RendererSettings, TransformMode, RenderMode, createDefaultScene, createObject, createLight, createMaterial } from '../scene/types';
import { generateId } from '../math';

interface HistoryEntry {
  scene: SceneData;
  timestamp: number;
}

interface AppState {
  // Scene
  scene: SceneData;
  selectedObjectId: string | null;
  selectedLightId: string | null;
  transformMode: TransformMode;
  
  // UI State
  activePanel: 'scene' | 'render' | 'education' | 'experiments';
  showRayDebugger: boolean;
  showCommandPalette: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showUI: boolean;
  isPaused: boolean;
  theme: 'dark' | 'light' | 'system';
  
  // Render Stats
  renderStats: {
    frameTime: number;
    frameCount: number;
    resolution: [number, number];
    objectCount: number;
    lightCount: number;
    materialCount: number;
    samples: number;
    maxBounces: number;
  };
  
  // History
  history: HistoryEntry[];
  historyIndex: number;
  
  // Actions
  setScene: (scene: SceneData) => void;
  loadPreset: (preset: SceneData) => void;
  
  // Object actions
  addObject: (type: SceneObject['type']) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  updateObjectTransform: (id: string, updates: Partial<SceneObject['transform']>) => void;
  
  // Light actions
  addLight: (type: SceneLight['type']) => void;
  removeLight: (id: string) => void;
  selectLight: (id: string | null) => void;
  updateLight: (id: string, updates: Partial<SceneLight>) => void;
  
  // Material actions
  addMaterial: (type: Material['type']) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
  
  // Camera actions
  updateCamera: (updates: Partial<Camera>) => void;
  setCameraPreset: (preset: string) => void;
  frameSelected: () => void;
  
  // Environment
  updateEnvironment: (updates: Partial<Environment>) => void;
  
  // Renderer settings
  updateRendererSettings: (updates: Partial<RendererSettings>) => void;
  setRenderMode: (mode: RenderMode) => void;
  
  // UI
  setTransformMode: (mode: TransformMode) => void;
  setActivePanel: (panel: AppState['activePanel']) => void;
  toggleRayDebugger: () => void;
  toggleCommandPalette: () => void;
  toggleUI: () => void;
  togglePause: () => void;
  setTheme: (theme: AppState['theme']) => void;
  
  // Stats
  updateRenderStats: (stats: AppState['renderStats']) => void;
  
  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  
  // Serialization
  exportScene: () => string;
  importScene: (json: string) => boolean;
  encodeSceneToURL: () => string;
  decodeSceneFromURL: (hash: string) => boolean;
  
  // Local storage
  saveToLocalStorage: (name: string) => void;
  loadFromLocalStorage: (name: string) => boolean;
  getSavedScenes: () => string[];
  deleteSavedScene: (name: string) => void;
}

const defaultScene = createDefaultScene();

export const useStore = create<AppState>((set, get) => ({
  scene: defaultScene,
  selectedObjectId: null,
  selectedLightId: null,
  transformMode: 'translate',
  activePanel: 'scene',
  showRayDebugger: false,
  showCommandPalette: false,
  showGrid: true,
  showAxes: true,
  showUI: true,
  isPaused: false,
  theme: 'dark',
  renderStats: {
    frameTime: 0,
    frameCount: 0,
    resolution: [0, 0],
    objectCount: 0,
    lightCount: 0,
    materialCount: 0,
    samples: 0,
    maxBounces: 0,
  },
  history: [{ scene: JSON.parse(JSON.stringify(defaultScene)), timestamp: Date.now() }],
  historyIndex: 0,

  setScene: (scene) => set({ scene }),
  
  loadPreset: (preset) => {
    set({ 
      scene: preset, 
      selectedObjectId: null, 
      selectedLightId: null,
      history: [{ scene: JSON.parse(JSON.stringify(preset)), timestamp: Date.now() }],
      historyIndex: 0,
    });
  },

  addObject: (type) => {
    const state = get();
    state.pushHistory();
    const mat = createMaterial('diffuse');
    const obj = createObject(type, mat.id);
    obj.transform.position = [0, 1, 0];
    set({
      scene: {
        ...state.scene,
        objects: [...state.scene.objects, obj],
        materials: [...state.scene.materials, mat],
      },
      selectedObjectId: obj.id,
    });
  },

  removeObject: (id) => {
    const state = get();
    state.pushHistory();
    set({
      scene: {
        ...state.scene,
        objects: state.scene.objects.filter(o => o.id !== id),
      },
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    });
  },

  duplicateObject: (id) => {
    const state = get();
    const obj = state.scene.objects.find(o => o.id === id);
    if (!obj) return;
    state.pushHistory();
    const newObj = { ...JSON.parse(JSON.stringify(obj)), id: generateId() };
    newObj.name = obj.name + ' Copy';
    newObj.transform.position = [
      obj.transform.position[0] + 1,
      obj.transform.position[1],
      obj.transform.position[2],
    ];
    const newMat = { ...state.scene.materials.find(m => m.id === obj.materialId)!, id: generateId() };
    newObj.materialId = newMat.id;
    set({
      scene: {
        ...state.scene,
        objects: [...state.scene.objects, newObj],
        materials: [...state.scene.materials, newMat],
      },
      selectedObjectId: newObj.id,
    });
  },

  selectObject: (id) => set({ selectedObjectId: id, selectedLightId: null }),
  
  updateObject: (id, updates) => {
    const state = get();
    set({
      scene: {
        ...state.scene,
        objects: state.scene.objects.map(o => o.id === id ? { ...o, ...updates } : o),
      },
    });
  },

  updateObjectTransform: (id, updates) => {
    const state = get();
    set({
      scene: {
        ...state.scene,
        objects: state.scene.objects.map(o => 
          o.id === id ? { ...o, transform: { ...o.transform, ...updates } } : o
        ),
      },
    });
  },

  addLight: (type) => {
    const state = get();
    state.pushHistory();
    const light = createLight(type);
    set({
      scene: { ...state.scene, lights: [...state.scene.lights, light] },
      selectedLightId: light.id,
      selectedObjectId: null,
    });
  },

  removeLight: (id) => {
    const state = get();
    state.pushHistory();
    set({
      scene: { ...state.scene, lights: state.scene.lights.filter(l => l.id !== id) },
      selectedLightId: state.selectedLightId === id ? null : state.selectedLightId,
    });
  },

  selectLight: (id) => set({ selectedLightId: id, selectedObjectId: null }),

  updateLight: (id, updates) => {
    const state = get();
    set({
      scene: {
        ...state.scene,
        lights: state.scene.lights.map(l => l.id === id ? { ...l, ...updates } : l),
      },
    });
  },

  addMaterial: (type) => {
    const state = get();
    const mat = createMaterial(type);
    set({
      scene: { ...state.scene, materials: [...state.scene.materials, mat] },
    });
  },

  updateMaterial: (id, updates) => {
    const state = get();
    set({
      scene: {
        ...state.scene,
        materials: state.scene.materials.map(m => m.id === id ? { ...m, ...updates } : m),
      },
    });
  },

  removeMaterial: (id) => {
    const state = get();
    set({
      scene: { ...state.scene, materials: state.scene.materials.filter(m => m.id !== id) },
    });
  },

  updateCamera: (updates) => {
    const state = get();
    set({
      scene: { ...state.scene, camera: { ...state.scene.camera, ...updates } },
    });
  },

  setCameraPreset: (preset) => {
    const state = get();
    const target = state.scene.camera.target;
    const dist = 8;
    let pos: [number, number, number] = [0, 3, 7];
    switch (preset) {
      case 'front': pos = [target[0], target[1], target[2] + dist]; break;
      case 'back': pos = [target[0], target[1], target[2] - dist]; break;
      case 'left': pos = [target[0] - dist, target[1], target[2]]; break;
      case 'right': pos = [target[0] + dist, target[1], target[2]]; break;
      case 'top': pos = [target[0], target[1] + dist, target[2] + 0.01]; break;
      case 'bottom': pos = [target[0], target[1] - dist, target[2] + 0.01]; break;
      case 'perspective': pos = [4, 4, 6]; break;
    }
    set({ scene: { ...state.scene, camera: { ...state.scene.camera, position: pos } } });
  },

  frameSelected: () => {
    const state = get();
    const obj = state.scene.objects.find(o => o.id === state.selectedObjectId);
    if (!obj) return;
    const pos = obj.transform.position;
    const camDist = 5;
    set({
      scene: {
        ...state.scene,
        camera: {
          ...state.scene.camera,
          position: [pos[0] + camDist * 0.5, pos[1] + camDist * 0.4, pos[2] + camDist],
          target: [...pos] as [number, number, number],
        },
      },
    });
  },

  updateEnvironment: (updates) => {
    const state = get();
    set({
      scene: { ...state.scene, environment: { ...state.scene.environment, ...updates } },
    });
  },

  updateRendererSettings: (updates) => {
    const state = get();
    set({
      scene: { ...state.scene, rendererSettings: { ...state.scene.rendererSettings, ...updates } },
    });
  },

  setRenderMode: (mode) => {
    const state = get();
    set({
      scene: { ...state.scene, rendererSettings: { ...state.scene.rendererSettings, renderMode: mode } },
    });
  },

  setTransformMode: (mode) => set({ transformMode: mode }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  toggleRayDebugger: () => set(s => ({ showRayDebugger: !s.showRayDebugger })),
  toggleCommandPalette: () => set(s => ({ showCommandPalette: !s.showCommandPalette })),
  toggleUI: () => set(s => ({ showUI: !s.showUI })),
  togglePause: () => set(s => ({ isPaused: !s.isPaused })),
  setTheme: (theme) => set({ theme }),

  updateRenderStats: (stats) => set({ renderStats: stats }),

  pushHistory: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ scene: JSON.parse(JSON.stringify(state.scene)), timestamp: Date.now() });
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIndex = state.historyIndex - 1;
    set({ 
      scene: JSON.parse(JSON.stringify(state.history[newIndex].scene)), 
      historyIndex: newIndex 
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIndex = state.historyIndex + 1;
    set({ 
      scene: JSON.parse(JSON.stringify(state.history[newIndex].scene)), 
      historyIndex: newIndex 
    });
  },

  exportScene: () => {
    return JSON.stringify(get().scene, null, 2);
  },

  importScene: (json) => {
    try {
      const data = JSON.parse(json);
      if (!data.version || !data.camera || !data.objects || !data.lights || !data.materials) {
        return false;
      }
      set({ scene: data as SceneData, selectedObjectId: null, selectedLightId: null });
      return true;
    } catch {
      return false;
    }
  },

  encodeSceneToURL: () => {
    try {
      const scene = get().scene;
      const compact = {
        v: scene.version,
        c: scene.camera,
        o: scene.objects.map(o => ({
          t: o.type[0], // s, p, b, c
          n: o.name,
          p: o.transform.position,
          r: o.transform.rotation,
          s: o.transform.scale,
          m: o.materialId,
          rad: o.radius,
          sz: o.size,
          h: o.height,
        })),
        l: scene.lights.map(l => ({
          t: l.type[0],
          n: l.name,
          p: l.position,
          d: l.direction,
          c: l.color,
          i: l.intensity,
        })),
        mt: scene.materials.map(m => ({
          t: m.type[0],
          n: m.name,
          bc: m.baseColor,
          ro: m.roughness,
          me: m.metallic,
          re: m.reflectivity,
          tr: m.transmission,
          io: m.ior,
          em: m.emission,
          es: m.emissionStrength,
        })),
        e: scene.environment,
        rs: scene.rendererSettings,
      };
      const json = JSON.stringify(compact);
      const encoded = btoa(encodeURIComponent(json));
      return `#scene=${encoded}`;
    } catch {
      return '';
    }
  },

  decodeSceneFromURL: (hash) => {
    try {
      if (!hash.startsWith('#scene=')) return false;
      const encoded = hash.substring(7);
      const json = decodeURIComponent(atob(encoded));
      const compact = JSON.parse(json);
      
      // Reconstruct full scene from compact format
      const scene: SceneData = {
        version: compact.v || 1,
        name: 'Shared Scene',
        camera: compact.c,
        objects: (compact.o || []).map((o: any, i: number) => {
          const typeMap: Record<string, string> = { s: 'sphere', p: 'plane', b: 'box', c: 'cylinder' };
          return {
            id: generateId(),
            name: o.n || `Object ${i}`,
            type: (typeMap[o.t] || 'sphere') as any,
            transform: { position: o.p || [0,0,0], rotation: o.r || [0,0,0], scale: o.s || [1,1,1] },
            materialId: o.m || '',
            visible: true,
            locked: false,
            radius: o.rad || 1,
            size: o.sz || [1,1,1],
            height: o.h || 2,
          };
        }),
        lights: (compact.l || []).map((l: any, i: number) => {
          const typeMap: Record<string, string> = { p: 'point', d: 'directional', a: 'area' };
          return {
            id: generateId(),
            name: l.n || `Light ${i}`,
            type: (typeMap[l.t] || 'point') as any,
            position: l.p || [0,5,0],
            direction: l.d || [0,-1,0],
            color: l.c || [1,1,1],
            intensity: l.i || 1,
            radius: 0.5,
            visible: true,
          };
        }),
        materials: (compact.mt || []).map((m: any, i: number) => {
          const typeMap: Record<string, string> = { d: 'diffuse', r: 'reflective', g: 'glass', e: 'emissive', m: 'metal' };
          return {
            id: generateId(),
            name: m.n || `Material ${i}`,
            type: (typeMap[m.t] || 'diffuse') as any,
            baseColor: m.bc || [0.8,0.8,0.8],
            roughness: m.ro ?? 0.5,
            metallic: m.me ?? 0,
            reflectivity: m.re ?? 0,
            transmission: m.tr ?? 0,
            ior: m.io ?? 1.5,
            emission: m.em || [1,1,1],
            emissionStrength: m.es ?? 0,
          };
        }),
        environment: compact.e || { type: 'gradient', color: [0.1,0.15,0.3], color2: [0.4,0.5,0.7], intensity: 0.3 },
        rendererSettings: compact.rs || { resolution: 75, samples: 4, maxBounces: 4, shadowSamples: 1, progressive: true, renderMode: 'full' as const, toneMapping: 'aces' as const, showGrid: true, showAxes: true, denoise: false, useBVH: true },
      };

      // Fix material references
      scene.objects.forEach((obj, i) => {
        if (i < scene.materials.length) {
          obj.materialId = scene.materials[i].id;
        }
      });

      set({ scene, selectedObjectId: null, selectedLightId: null });
      return true;
    } catch {
      return false;
    }
  },

  saveToLocalStorage: (name) => {
    try {
      const scene = get().scene;
      const saves = JSON.parse(localStorage.getItem('raytracelab_saves') || '{}');
      saves[name] = { scene, timestamp: Date.now() };
      localStorage.setItem('raytracelab_saves', JSON.stringify(saves));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  },

  loadFromLocalStorage: (name) => {
    try {
      const saves = JSON.parse(localStorage.getItem('raytracelab_saves') || '{}');
      if (!saves[name]) return false;
      set({ scene: saves[name].scene, selectedObjectId: null, selectedLightId: null });
      return true;
    } catch {
      return false;
    }
  },

  getSavedScenes: () => {
    try {
      const saves = JSON.parse(localStorage.getItem('raytracelab_saves') || '{}');
      return Object.keys(saves);
    } catch {
      return [];
    }
  },

  deleteSavedScene: (name) => {
    try {
      const saves = JSON.parse(localStorage.getItem('raytracelab_saves') || '{}');
      delete saves[name];
      localStorage.setItem('raytracelab_saves', JSON.stringify(saves));
    } catch {}
  },
}));
