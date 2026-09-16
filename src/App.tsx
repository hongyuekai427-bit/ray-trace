// RayTrace Lab - Main Application
import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from './state/store';
import { WebGLRenderer, RenderStats } from './renderer/WebGLRenderer';
import { PRESETS } from './scene/presets';
import { RenderMode, TransformMode } from './scene/types';

// ─── Viewport Component ────────────────────────────────────────────────────────
function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const scene = useStore(s => s.scene);
  const isPaused = useStore(s => s.isPaused);
  const updateRenderStats = useStore(s => s.updateRenderStats);
  const updateCamera = useStore(s => s.updateCamera);
  const selectObject = useStore(s => s.selectObject);
  const selectedObjectId = useStore(s => s.selectedObjectId);
  const selectedLightId = useStore(s => s.selectedLightId);
  const transformMode = useStore(s => s.transformMode);
  const updateObjectTransform = useStore(s => s.updateObjectTransform);
  const updateLight = useStore(s => s.updateLight);

  // Camera orbit state
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Ensure canvas has dimensions
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      canvasRef.current.width = 800;
      canvasRef.current.height = 600;
    }
    
    const renderer = new WebGLRenderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.setOnFrame((stats: RenderStats) => {
      updateRenderStats(stats);
    });
    renderer.start();

    return () => { renderer.dispose(); };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateScene(scene);
    }
  }, [scene]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPaused(isPaused);
    }
  }, [isPaused]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (rendererRef.current) {
        rendererRef.current.updateScene(scene);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scene]);

  // Camera orbit controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      // Right/middle click = orbit
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    } else if (e.button === 0 && e.shiftKey) {
      // Shift+left = pan
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      // Orbit camera around target
      const cam = scene.camera;
      const target = new Float64Array(cam.target);
      const pos = new Float64Array(cam.position);
      
      const offset = [pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]];
      const dist = Math.sqrt(offset[0]*offset[0] + offset[1]*offset[1] + offset[2]*offset[2]);
      
      let theta = Math.atan2(offset[0], offset[2]);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset[1] / dist)));
      
      theta -= dx * 0.005;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * 0.005));
      
      const newPos: [number, number, number] = [
        target[0] + dist * Math.sin(phi) * Math.sin(theta),
        target[1] + dist * Math.cos(phi),
        target[2] + dist * Math.sin(phi) * Math.cos(theta),
      ];
      
      updateCamera({ position: newPos });
    } else if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      const cam = scene.camera;
      const forward = [
        cam.target[0] - cam.position[0],
        cam.target[1] - cam.position[1],
        cam.target[2] - cam.position[2],
      ];
      const len = Math.sqrt(forward[0]*forward[0] + forward[1]*forward[1] + forward[2]*forward[2]);
      forward[0] /= len; forward[1] /= len; forward[2] /= len;
      
      const right = [
        forward[1] * cam.up[2] - forward[2] * cam.up[1],
        forward[2] * cam.up[0] - forward[0] * cam.up[2],
        forward[0] * cam.up[1] - forward[1] * cam.up[0],
      ];
      const up = [
        right[1] * forward[2] - right[2] * forward[1],
        right[2] * forward[0] - right[0] * forward[2],
        right[0] * forward[1] - right[1] * forward[0],
      ];

      const panSpeed = 0.005 * len;
      const panX = -dx * panSpeed;
      const panY = dy * panSpeed;

      const newTarget: [number, number, number] = [
        cam.target[0] + right[0] * panX + up[0] * panY,
        cam.target[1] + right[1] * panX + up[1] * panY,
        cam.target[2] + right[2] * panX + up[2] * panY,
      ];
      const newPos: [number, number, number] = [
        cam.position[0] + right[0] * panX + up[0] * panY,
        cam.position[1] + right[1] * panX + up[1] * panY,
        cam.position[2] + right[2] * panX + up[2] * panY,
      ];

      updateCamera({ position: newPos, target: newTarget });
    }
  }, [scene.camera, updateCamera]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cam = scene.camera;
    const forward = [
      cam.target[0] - cam.position[0],
      cam.target[1] - cam.position[1],
      cam.target[2] - cam.position[2],
    ];
    const dist = Math.sqrt(forward[0]*forward[0] + forward[1]*forward[1] + forward[2]*forward[2]);
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const newDist = Math.max(0.5, Math.min(100, dist * zoomFactor));
    const scale = newDist / dist;

    const newPos: [number, number, number] = [
      cam.target[0] - forward[0] * scale,
      cam.target[1] - forward[1] * scale,
      cam.target[2] - forward[2] * scale,
    ];

    updateCamera({ position: newPos });
  }, [scene.camera, updateCamera]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Touch controls
  const touchState = useRef<{ touches: { id: number; x: number; y: number }[]; lastDist: number }>({
    touches: [], lastDist: 0
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    touchState.current.touches = touches;
    if (touches.length === 2) {
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      touchState.current.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    const prev = touchState.current.touches;

    if (touches.length === 1 && prev.length >= 1) {
      // Single finger = orbit
      const dx = touches[0].x - prev[0].x;
      const dy = touches[0].y - prev[0].y;
      
      const cam = scene.camera;
      const target = cam.target;
      const pos = cam.position;
      
      const offset = [pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]];
      const dist = Math.sqrt(offset[0]*offset[0] + offset[1]*offset[1] + offset[2]*offset[2]);
      
      let theta = Math.atan2(offset[0], offset[2]);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset[1] / dist)));
      
      theta -= dx * 0.005;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * 0.005));
      
      const newPos: [number, number, number] = [
        target[0] + dist * Math.sin(phi) * Math.sin(theta),
        target[1] + dist * Math.cos(phi),
        target[2] + dist * Math.sin(phi) * Math.cos(theta),
      ];
      
      updateCamera({ position: newPos });
    } else if (touches.length === 2 && prev.length >= 2) {
      // Two fingers = pinch zoom + pan
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const prevDist = touchState.current.lastDist;
      
      if (prevDist > 0) {
        const scale = prevDist / dist;
        const cam = scene.camera;
        const forward = [
          cam.target[0] - cam.position[0],
          cam.target[1] - cam.position[1],
          cam.target[2] - cam.position[2],
        ];
        const fDist = Math.sqrt(forward[0]*forward[0] + forward[1]*forward[1] + forward[2]*forward[2]);
        const newDist = Math.max(0.5, Math.min(100, fDist * scale));
        const ratio = newDist / fDist;

        const newPos: [number, number, number] = [
          cam.target[0] - forward[0] * ratio,
          cam.target[1] - forward[1] * ratio,
          cam.target[2] - forward[2] * ratio,
        ];
        updateCamera({ position: newPos });
      }
      touchState.current.lastDist = dist;
    }

    touchState.current.touches = touches;
  }, [scene.camera, updateCamera]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ imageRendering: 'auto', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      />
    </div>
  );
}

// ─── Scene Panel ───────────────────────────────────────────────────────────────
function ScenePanel() {
  const { scene, selectedObjectId, selectedLightId, selectObject, selectLight, addObject, addLight, removeObject, removeLight, duplicateObject, saveToLocalStorage, loadFromLocalStorage, getSavedScenes, deleteSavedScene } = useStore();
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const savedScenes = getSavedScenes();

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Scene</h3>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => addObject('sphere')} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors" title="Add Sphere">+ Sphere</button>
          <button onClick={() => addObject('box')} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors" title="Add Box">+ Box</button>
          <button onClick={() => addObject('plane')} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors" title="Add Plane">+ Plane</button>
          <button onClick={() => addObject('cylinder')} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors" title="Add Cylinder">+ Cylinder</button>
          <button onClick={() => addObject('cone')} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors" title="Add Cone">+ Cone</button>
        </div>
        <div className="flex gap-1 mt-1">
          <button onClick={() => addLight('point')} className="px-2 py-1 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 rounded transition-colors">+ Point Light</button>
          <button onClick={() => addLight('directional')} className="px-2 py-1 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 rounded transition-colors">+ Dir Light</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-3">
          <div className="text-xs text-white/40 mb-1 px-1">Objects ({scene.objects.length})</div>
          {scene.objects.map(obj => (
            <div
              key={obj.id}
              onClick={() => selectObject(obj.id)}
              className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm mb-0.5 transition-colors ${
                selectedObjectId === obj.id ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-white/80'
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400/60"></span>
                {obj.name}
              </span>
              <div className="flex gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); duplicateObject(obj.id); }} className="p-0.5 hover:bg-white/10 rounded text-xs" title="Duplicate">⧉</button>
                <button onClick={(e) => { e.stopPropagation(); removeObject(obj.id); }} className="p-0.5 hover:bg-red-500/20 rounded text-xs text-red-400" title="Delete">×</button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="text-xs text-white/40 mb-1 px-1">Lights ({scene.lights.length})</div>
          {scene.lights.map(light => (
            <div
              key={light.id}
              onClick={() => selectLight(light.id)}
              className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm mb-0.5 transition-colors ${
                selectedLightId === light.id ? 'bg-yellow-500/20 text-yellow-300' : 'hover:bg-white/5 text-white/80'
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400/60"></span>
                {light.name}
              </span>
              <button onClick={(e) => { e.stopPropagation(); removeLight(light.id); }} className="p-0.5 hover:bg-red-500/20 rounded text-xs text-red-400">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Scenes */}
      <div className="p-3 border-t border-white/10">
        <button onClick={() => setShowSaved(!showSaved)} className="text-xs text-white/50 hover:text-white/70 flex items-center gap-1">
          💾 Saved Scenes ({savedScenes.length}) <span className="text-white/30">{showSaved ? '▾' : '▸'}</span>
        </button>
        {showSaved && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              <input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Scene name..."
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
              <button
                onClick={() => { if (saveName) { saveToLocalStorage(saveName); setSaveName(''); } }}
                className="px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded"
              >
                Save
              </button>
            </div>
            {savedScenes.map(name => (
              <div key={name} className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs">
                <button onClick={() => loadFromLocalStorage(name)} className="text-white/70 hover:text-white truncate">{name}</button>
                <button onClick={() => deleteSavedScene(name)} className="text-red-400/60 hover:text-red-400 ml-1">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inspector Panel ───────────────────────────────────────────────────────────
function InspectorPanel() {
  const { scene, selectedObjectId, selectedLightId, updateObject, updateObjectTransform, updateLight, updateMaterial, updateCamera, updateEnvironment } = useStore();

  const selectedObj = scene.objects.find(o => o.id === selectedObjectId);
  const selectedLight = scene.lights.find(l => l.id === selectedLightId);
  const selectedMat = selectedObj ? scene.materials.find(m => m.id === selectedObj.materialId) : null;

  if (!selectedObj && !selectedLight) {
    return (
      <div className="p-4 text-center text-white/40 text-sm">
        <p className="mb-2">No selection</p>
        <p className="text-xs">Select an object or light to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {selectedObj && (
        <div className="p-3 border-b border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Object</h3>
          <input
            value={selectedObj.name}
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white mb-2"
          />
          <div className="space-y-2">
            <Vec3Input label="Position" value={selectedObj.transform.position} onChange={(v) => updateObjectTransform(selectedObj.id, { position: v })} />
            <Vec3Input label="Rotation" value={selectedObj.transform.rotation} onChange={(v) => updateObjectTransform(selectedObj.id, { rotation: v })} step={0.1} />
            <Vec3Input label="Scale" value={selectedObj.transform.scale} onChange={(v) => updateObjectTransform(selectedObj.id, { scale: v })} step={0.1} />
            {selectedObj.type === 'sphere' && (
              <div>
                <label className="text-xs text-white/50">Radius</label>
                <input type="range" min="0.1" max="5" step="0.1" value={selectedObj.radius || 1}
                  onChange={(e) => updateObject(selectedObj.id, { radius: parseFloat(e.target.value) })}
                  className="w-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {selectedMat && (
        <div className="p-3 border-b border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Material</h3>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-white/50">Type</label>
              <select
                value={selectedMat.type}
                onChange={(e) => updateMaterial(selectedMat.id, { type: e.target.value as any })}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white"
              >
                <option value="diffuse">Diffuse</option>
                <option value="reflective">Reflective</option>
                <option value="glass">Glass</option>
                <option value="metal">Metal</option>
                <option value="emissive">Emissive</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50">Base Color</label>
              <input type="color"
                value={rgbToHex(selectedMat.baseColor)}
                onChange={(e) => updateMaterial(selectedMat.id, { baseColor: hexToRgb(e.target.value) })}
                className="w-full h-8 rounded cursor-pointer" />
            </div>
            <SliderInput label="Roughness" value={selectedMat.roughness} min={0} max={1} step={0.01}
              onChange={(v) => updateMaterial(selectedMat.id, { roughness: v })} />
            <SliderInput label="Metallic" value={selectedMat.metallic} min={0} max={1} step={0.01}
              onChange={(v) => updateMaterial(selectedMat.id, { metallic: v })} />
            <SliderInput label="Reflectivity" value={selectedMat.reflectivity} min={0} max={1} step={0.01}
              onChange={(v) => updateMaterial(selectedMat.id, { reflectivity: v })} />
            <SliderInput label="Transmission" value={selectedMat.transmission} min={0} max={1} step={0.01}
              onChange={(v) => updateMaterial(selectedMat.id, { transmission: v })} />
            <SliderInput label="IOR" value={selectedMat.ior} min={1} max={3} step={0.01}
              onChange={(v) => updateMaterial(selectedMat.id, { ior: v })} />
            <SliderInput label="Emission" value={selectedMat.emissionStrength} min={0} max={20} step={0.1}
              onChange={(v) => updateMaterial(selectedMat.id, { emissionStrength: v })} />
          </div>
        </div>
      )}

      {selectedLight && (
        <div className="p-3 border-b border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Light</h3>
          <input
            value={selectedLight.name}
            onChange={(e) => updateLight(selectedLight.id, { name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white mb-2"
          />
          <div className="space-y-2">
            <Vec3Input label="Position" value={selectedLight.position} onChange={(v) => updateLight(selectedLight.id, { position: v })} />
            {selectedLight.type === 'directional' && (
              <Vec3Input label="Direction" value={selectedLight.direction} onChange={(v) => updateLight(selectedLight.id, { direction: v })} step={0.1} />
            )}
            <div>
              <label className="text-xs text-white/50">Color</label>
              <input type="color"
                value={rgbToHex(selectedLight.color)}
                onChange={(e) => updateLight(selectedLight.id, { color: hexToRgb(e.target.value) })}
                className="w-full h-8 rounded cursor-pointer" />
            </div>
            <SliderInput label="Intensity" value={selectedLight.intensity} min={0} max={10} step={0.1}
              onChange={(v) => updateLight(selectedLight.id, { intensity: v })} />
          </div>
        </div>
      )}

      <div className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Camera</h3>
        <div className="space-y-2">
          <Vec3Input label="Position" value={scene.camera.position} onChange={(v) => updateCamera({ position: v })} step={0.1} />
          <Vec3Input label="Target" value={scene.camera.target} onChange={(v) => updateCamera({ target: v })} step={0.1} />
          <SliderInput label="FOV" value={scene.camera.fov} min={10} max={120} step={1}
            onChange={(v) => updateCamera({ fov: v })} />
        </div>
      </div>

      <div className="p-3 border-t border-white/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Environment</h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-white/50">Type</label>
            <select
              value={scene.environment.type}
              onChange={(e) => updateEnvironment({ type: e.target.value as any })}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white"
            >
              <option value="solid">Solid Color</option>
              <option value="gradient">Gradient</option>
              <option value="sky">Sky</option>
              <option value="checkerboard">Checkerboard</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <SliderInput label="Intensity" value={scene.environment.intensity} min={0} max={2} step={0.05}
            onChange={(v) => updateEnvironment({ intensity: v })} />
        </div>
      </div>
    </div>
  );
}

// ─── Render Settings Panel ─────────────────────────────────────────────────────
function RenderSettingsPanel() {
  const { scene, updateRendererSettings, setRenderMode } = useStore();
  const settings = scene.rendererSettings;

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Render Mode</h3>
        <div className="grid grid-cols-2 gap-1">
          {(['full', 'direct', 'normals', 'depth', 'albedo', 'roughness', 'metallic', 'emission', 'shadows', 'bounceCount'] as RenderMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setRenderMode(mode)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                settings.renderMode === mode ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              {mode === 'bounceCount' ? 'Bounces' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Quality</h3>
        <div className="space-y-2">
          <SliderInput label="Resolution" value={settings.resolution} min={25} max={100} step={25}
            onChange={(v) => updateRendererSettings({ resolution: v })} format={(v) => `${v}%`} />
          <SliderInput label="Samples" value={settings.samples} min={1} max={32} step={1}
            onChange={(v) => updateRendererSettings({ samples: v })} />
          <SliderInput label="Max Bounces" value={settings.maxBounces} min={1} max={16} step={1}
            onChange={(v) => updateRendererSettings({ maxBounces: v })} />
          <SliderInput label="Shadow Samples" value={settings.shadowSamples} min={1} max={16} step={1}
            onChange={(v) => updateRendererSettings({ shadowSamples: v })} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Tone Mapping</h3>
        <div className="flex gap-1">
          {(['none', 'reinhard', 'aces'] as const).map(tm => (
            <button
              key={tm}
              onClick={() => updateRendererSettings({ toneMapping: tm })}
              className={`px-2 py-1 text-xs rounded transition-colors flex-1 ${
                settings.toneMapping === tm ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              {tm.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Quality Presets</h3>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => updateRendererSettings({ resolution: 50, samples: 1, maxBounces: 1, shadowSamples: 1 })}
            className="px-2 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded">⚡ Fast</button>
          <button onClick={() => updateRendererSettings({ resolution: 75, samples: 4, maxBounces: 4, shadowSamples: 1 })}
            className="px-2 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded">⚖ Balanced</button>
          <button onClick={() => updateRendererSettings({ resolution: 100, samples: 8, maxBounces: 8, shadowSamples: 4 })}
            className="px-2 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded">✦ Quality</button>
          <button onClick={() => updateRendererSettings({ resolution: 100, samples: 16, maxBounces: 16, shadowSamples: 8 })}
            className="px-2 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded">🔥 Insane</button>
        </div>
        <p className="text-xs text-white/30 mt-1">⚠ High settings increase GPU workload significantly</p>
      </div>
    </div>
  );
}

// ─── Education Panel ───────────────────────────────────────────────────────────
function EducationPanel() {
  const [activeLesson, setActiveLesson] = useState(0);

  const lessons = [
    {
      title: 'What is a Ray?',
      content: 'A ray is a line defined by an origin point and a direction. In ray tracing, we cast rays from the camera through each pixel into the scene to determine what color that pixel should be.',
      equation: 'P(t) = Origin + t × Direction',
      tip: 'Each pixel in the final image is the result of tracing one or more rays.',
    },
    {
      title: 'Ray-Object Intersection',
      content: 'For each ray, we test whether it hits any object in the scene. We find the closest intersection point. Different shapes have different intersection tests.',
      equation: 'Sphere: |P - C|² = r²',
      tip: 'The quadratic formula solves sphere intersections. Planes use a simpler dot product test.',
    },
    {
      title: 'Surface Normals',
      content: 'At each intersection point, we calculate the surface normal — a vector perpendicular to the surface. Normals are essential for lighting calculations.',
      equation: 'N = normalize(P - Center) [for spheres]',
      tip: 'The normal determines how light reflects off a surface and which direction shadows are cast.',
    },
    {
      title: 'Lighting & Shadows',
      content: 'At each hit point, we cast shadow rays toward each light. If another object blocks the path, the point is in shadow. Direct lighting uses the angle between the normal and light direction.',
      equation: 'L = max(0, N · L_dir) × Color',
      tip: 'The dot product N·L determines how directly the light hits the surface.',
    },
    {
      title: 'Reflection',
      content: 'When a ray hits a reflective surface, we spawn a new ray in the reflected direction. The reflection formula uses the incoming direction and surface normal.',
      equation: 'R = I - 2(I · N)N',
      tip: 'Try the Mirror Room preset to see multiple reflections bouncing between surfaces.',
    },
    {
      title: 'Refraction',
      content: 'When light passes through a transparent material, it bends according to Snell\'s law. The amount of bending depends on the Index of Refraction (IOR).',
      equation: 'n₁ sin(θ₁) = n₂ sin(θ₂)',
      tip: 'Glass has IOR ≈ 1.5. Diamond has IOR ≈ 2.42. Try the Glass Laboratory preset!',
    },
    {
      title: 'Fresnel Effect',
      content: 'Surfaces appear more reflective at grazing angles. A glass window looks transparent straight-on but reflective from the side. This is the Fresnel effect.',
      equation: 'R(θ) = R₀ + (1-R₀)(1-cos θ)⁵',
      tip: 'This is why you can see reflections in windows at night but not during the day.',
    },
    {
      title: 'Sampling & Noise',
      content: 'Monte Carlo ray tracing uses random sampling. More samples = less noise but more computation. Each sample traces a slightly different ray path.',
      equation: 'Color ≈ (1/N) Σ sample_i',
      tip: 'Watch the progressive render — noise decreases as more samples accumulate.',
    },
    {
      title: 'BVH Acceleration',
      content: 'A Bounding Volume Hierarchy organizes objects into a tree of bounding boxes. Rays can skip entire groups of objects if they miss the bounding box.',
      equation: 'O(n log n) build, O(log n) query',
      tip: 'Without BVH, each ray tests every object. With BVH, it tests far fewer.',
    },
    {
      title: 'GPU Ray Tracing',
      content: 'Modern GPUs can trace millions of rays in parallel. Each pixel is computed independently on a GPU core. This is why fragment shaders are ideal for ray tracing.',
      equation: 'Parallel: 1 thread per pixel',
      tip: 'This renderer runs entirely in a WebGL2 fragment shader on your GPU.',
    },
  ];

  const lesson = lessons[activeLesson];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">Learn Ray Tracing</h3>
        <div className="flex flex-wrap gap-1">
          {lessons.map((l, i) => (
            <button
              key={i}
              onClick={() => setActiveLesson(i)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activeLesson === i ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 hover:bg-white/10 text-white/60'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <h4 className="text-sm font-semibold text-white">{lesson.title}</h4>
        <p className="text-sm text-white/70 leading-relaxed">{lesson.content}</p>
        {lesson.equation && (
          <div className="bg-white/5 border border-white/10 rounded p-2 font-mono text-xs text-cyan-300">
            {lesson.equation}
          </div>
        )}
        {lesson.tip && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2 text-xs text-blue-300">
            💡 {lesson.tip}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Experiments Panel ─────────────────────────────────────────────────────────
function ExperimentsPanel() {
  const { loadPreset, updateRendererSettings, setRenderMode } = useStore();

  const experiments = [
    {
      title: '01 — Find the Reflection',
      desc: 'Load the Ray Playground preset. Move the camera and observe how reflection directions change.',
      action: () => { loadPreset(PRESETS['Ray Playground']()); setRenderMode('full'); },
    },
    {
      title: '02 — Block the Light',
      desc: 'Add a sphere between a light and another object. Watch the shadow appear in real-time.',
      action: () => { loadPreset(PRESETS['Ray Playground']()); setRenderMode('shadows'); },
    },
    {
      title: '03 — Glass & IOR',
      desc: 'Load the Glass Laboratory. Compare how different IOR values bend light differently.',
      action: () => { loadPreset(PRESETS['Glass Laboratory']()); },
    },
    {
      title: '04 — Roughness',
      desc: 'Load Material Gallery. Compare matte vs polished surfaces and observe highlight differences.',
      action: () => { loadPreset(PRESETS['Material Gallery']()); setRenderMode('roughness'); },
    },
    {
      title: '05 — More Bounces',
      desc: 'Load Mirror Room. Increase max bounces from 2 to 8 and observe deeper reflections.',
      action: () => { loadPreset(PRESETS['Mirror Room']()); updateRendererSettings({ maxBounces: 2 }); },
    },
    {
      title: '06 — Sampling & Noise',
      desc: 'Set samples to 1 and watch the noise. Then increase to 16 and observe convergence.',
      action: () => { updateRendererSettings({ samples: 1 }); },
    },
    {
      title: '07 — Render Modes',
      desc: 'Try each render mode to understand what data the ray tracer computes at each pixel.',
      action: () => { setRenderMode('normals'); },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">Experiments</h3>
        <p className="text-xs text-white/40 mt-1">Structured exercises to learn ray tracing concepts</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {experiments.map((exp, i) => (
          <div key={i} className="bg-white/5 rounded p-3 border border-white/5">
            <h4 className="text-sm font-medium text-white mb-1">{exp.title}</h4>
            <p className="text-xs text-white/60 mb-2">{exp.desc}</p>
            <button
              onClick={exp.action}
              className="px-3 py-1 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded transition-colors"
            >
              Start Experiment →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar() {
  const { transformMode, setTransformMode, togglePause, isPaused, showUI, toggleUI, setCameraPreset, frameSelected, toggleCommandPalette, toggleRayDebugger, showRayDebugger } = useStore();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/10">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">RayTrace Lab</span>
        <span className="text-xs text-white/30 hidden sm:inline">Build a world. Trace every ray.</span>
        <span className="text-xs text-white/20 hidden md:inline ml-2">Real-time educational ray tracer</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Transform tools */}
        <div className="flex bg-white/5 rounded overflow-hidden">
          <button onClick={() => setTransformMode('translate')} className={`px-2 py-1 text-xs transition-colors ${transformMode === 'translate' ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white/60'}`} title="Move (W)">↔ Move</button>
          <button onClick={() => setTransformMode('rotate')} className={`px-2 py-1 text-xs transition-colors ${transformMode === 'rotate' ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white/60'}`} title="Rotate (E)">↻ Rot</button>
          <button onClick={() => setTransformMode('scale')} className={`px-2 py-1 text-xs transition-colors ${transformMode === 'scale' ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-white/60'}`} title="Scale (R)">⤡ Scale</button>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1"></div>

        {/* Camera presets */}
        <select onChange={(e) => { if (e.target.value) setCameraPreset(e.target.value); e.target.value = ''; }}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/70" defaultValue="">
          <option value="" disabled>Camera...</option>
          <option value="front">Front</option>
          <option value="back">Back</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="top">Top</option>
          <option value="perspective">Perspective</option>
        </select>

        <button onClick={frameSelected} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60" title="Frame Selected (F)">⊡ Frame</button>

        <div className="w-px h-5 bg-white/10 mx-1"></div>

        <button onClick={toggleRayDebugger} className={`px-2 py-1 text-xs rounded transition-colors ${showRayDebugger ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 hover:bg-white/10 text-white/60'}`} title="Ray Debugger (G)">🔍 Rays</button>
        <button onClick={toggleCommandPalette} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60" title="Command Palette (Ctrl+K)">⌘</button>
        <button onClick={togglePause} className={`px-2 py-1 text-xs rounded transition-colors ${isPaused ? 'bg-green-500/20 text-green-300' : 'bg-white/5 hover:bg-white/10 text-white/60'}`} title="Pause/Resume (Space)">
          {isPaused ? '▶' : '⏸'}
        </button>
        <button onClick={toggleUI} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60" title="Toggle UI (H)">{showUI ? '◧' : '◨'}</button>
        <button onClick={() => { const e = new KeyboardEvent('keydown', { key: 'F1' }); window.dispatchEvent(e); }} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60" title="Keyboard Shortcuts (F1)">⌨</button>
      </div>
    </div>
  );
}

// ─── Command Palette ───────────────────────────────────────────────────────────
function CommandPalette() {
  const [query, setQuery] = useState('');
  const { showCommandPalette, toggleCommandPalette, addObject, addLight, setCameraPreset, frameSelected, toggleRayDebugger, exportScene, loadPreset } = useStore();

  const commands = [
    { label: 'Add Sphere', action: () => addObject('sphere') },
    { label: 'Add Box', action: () => addObject('box') },
    { label: 'Add Plane', action: () => addObject('plane') },
    { label: 'Add Cylinder', action: () => addObject('cylinder') },
    { label: 'Add Cone', action: () => addObject('cone') },
    { label: 'Add Point Light', action: () => addLight('point') },
    { label: 'Add Directional Light', action: () => addLight('directional') },
    { label: 'Camera: Front', action: () => setCameraPreset('front') },
    { label: 'Camera: Top', action: () => setCameraPreset('top') },
    { label: 'Camera: Perspective', action: () => setCameraPreset('perspective') },
    { label: 'Frame Selected', action: () => frameSelected() },
    { label: 'Toggle Ray Debugger', action: () => toggleRayDebugger() },
    { label: 'Export Scene', action: () => { const json = exportScene(); downloadJSON(json, 'scene.json'); } },
    { label: 'Load: Three Spheres', action: () => loadPreset(PRESETS['Three Spheres']()) },
    { label: 'Load: Mirror Room', action: () => loadPreset(PRESETS['Mirror Room']()) },
    { label: 'Load: Glass Laboratory', action: () => loadPreset(PRESETS['Glass Laboratory']()) },
    { label: 'Load: Cornell Box', action: () => loadPreset(PRESETS['Cornell Box']()) },
    { label: 'Load: Material Gallery', action: () => loadPreset(PRESETS['Material Gallery']()) },
    { label: 'Load: Neon Room', action: () => loadPreset(PRESETS['Neon Room']()) },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  if (!showCommandPalette) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={toggleCommandPalette}>
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="w-full bg-transparent border-b border-white/10 px-4 py-3 text-white placeholder:text-white/30 outline-none"
          onKeyDown={e => { if (e.key === 'Escape') toggleCommandPalette(); }}
        />
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.map((cmd, i) => (
            <button
              key={i}
              onClick={() => { cmd.action(); toggleCommandPalette(); }}
              className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/5 rounded transition-colors"
            >
              {cmd.label}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-4 py-3 text-sm text-white/30">No commands found</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Overlay ─────────────────────────────────────────────────────────────
function StatsOverlay() {
  const { renderStats, scene } = useStore();

  return (
    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono text-white/60 pointer-events-none">
      <div>Objects: {scene.objects.length} | Lights: {scene.lights.length} | Materials: {scene.materials.length}</div>
      <div>Resolution: {renderStats.resolution[0]}×{renderStats.resolution[1]} | Samples: {renderStats.samples} | Bounces: {scene.rendererSettings.maxBounces}</div>
      <div>Frame: {renderStats.frameTime.toFixed(1)}ms | Renderer: WebGL2</div>
    </div>
  );
}

// ─── Presets Menu ──────────────────────────────────────────────────────────────
function PresetsMenu() {
  const [open, setOpen] = useState(false);
  const loadPreset = useStore(s => s.loadPreset);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60 transition-colors">
        📂 Presets
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] z-40">
          {Object.entries(PRESETS).map(([name, fn]) => (
            <button
              key={name}
              onClick={() => { loadPreset(fn()); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Save/Load Menu ────────────────────────────────────────────────────────────
function SaveLoadMenu() {
  const [open, setOpen] = useState(false);
  const { exportScene, importScene, encodeSceneToURL } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const json = exportScene();
    downloadJSON(json, 'raytrace-scene.json');
    setOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const success = importScene(json);
      if (!success) alert('Invalid scene file. Please check the format.');
    };
    reader.readAsText(file);
    setOpen(false);
  };

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'raytrace-screenshot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    setOpen(false);
  };

  const handleShareURL = () => {
    const hash = encodeSceneToURL();
    if (hash) {
      const url = window.location.origin + window.location.pathname + hash;
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60 transition-colors">
        💾 File
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1 min-w-[200px] z-40">
          <button onClick={handleExport} className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/5">📤 Export Scene (JSON)</button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/5">📥 Import Scene</button>
          <button onClick={handleScreenshot} className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/5">📸 Screenshot (PNG)</button>
          <div className="border-t border-white/10 my-1"></div>
          <button onClick={handleShareURL} className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/5">
            🔗 {copied ? '✓ Link Copied!' : 'Copy Shareable Link'}
          </button>
          <button onClick={() => { navigator.clipboard.writeText(exportScene()); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/5">📋 Copy Scene JSON</button>
          <div className="border-t border-white/10 my-1"></div>
          <div className="px-3 py-1.5 text-xs text-white/30">🔒 Scenes stay in your browser. No data is uploaded.</div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────
function Vec3Input({ label, value, onChange, step = 0.1 }: { label: string; value: [number, number, number]; onChange: (v: [number, number, number]) => void; step?: number }) {
  return (
    <div>
      <label className="text-xs text-white/50">{label}</label>
      <div className="grid grid-cols-3 gap-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="relative">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-white/30">{axis}</span>
            <input
              type="number"
              step={step}
              value={Number(value[i].toFixed(3))}
              onChange={(e) => {
                const newVal = [...value] as [number, number, number];
                newVal[i] = parseFloat(e.target.value) || 0;
                onChange(newVal);
              }}
              className="w-full bg-white/5 border border-white/10 rounded pl-6 pr-1 py-1 text-xs text-white"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SliderInput({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div>
      <div className="flex justify-between">
        <label className="text-xs text-white/50">{label}</label>
        <span className="text-xs text-white/40">{format ? format(value) : value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
      />
    </div>
  );
}

// ─── Utility Functions ─────────────────────────────────────────────────────────
function rgbToHex(rgb: [number, number, number]): string {
  const r = Math.round(Math.min(1, Math.max(0, rgb[0])) * 255);
  const g = Math.round(Math.min(1, Math.max(0, rgb[1])) * 255);
  const b = Math.round(Math.min(1, Math.max(0, rgb[2])) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

function downloadJSON(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── WebGL Check ───────────────────────────────────────────────────────────────
function WebGLCheck() {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) setSupported(false);
    } catch {
      setSupported(false);
    }
  }, []);

  if (supported) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">WebGL2 Not Supported</h2>
        <p className="text-white/60 mb-4">
          RayTrace Lab requires WebGL2 to render scenes. Please use a modern browser like Chrome, Firefox, or Edge.
        </p>
        <p className="text-sm text-white/40">
          Your browser may not support WebGL2, or hardware acceleration may be disabled.
        </p>
      </div>
    </div>
  );
}

// ─── Daily Challenge ───────────────────────────────────────────────────────────
function DailyChallenge() {
  const [dismissed, setDismissed] = useState(false);
  
  const challenges = [
    { title: 'Create a scene with exactly three spheres', desc: 'Add three spheres with different materials.' },
    { title: 'Make a glass sphere reflect', desc: 'Position a glass sphere so it shows a visible reflection of another object.' },
    { title: 'Three-light setup', desc: 'Create a scene with three lights of different colors.' },
    { title: 'Reduce render noise', desc: 'Start with 1 sample and increase until the image is clean.' },
    { title: 'Mirror maze', desc: 'Create a scene with at least 3 reflective surfaces.' },
    { title: 'IOR experiment', desc: 'Create 3 glass spheres with IOR values of 1.2, 1.5, and 2.0.' },
    { title: 'Shadow art', desc: 'Arrange objects to create interesting shadow patterns.' },
  ];

  // Deterministic daily challenge based on date
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % challenges.length;
  const challenge = challenges[dayIndex];

  if (dismissed) return null;

  return (
    <div className="absolute bottom-14 left-2 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-3 max-w-[240px] animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-purple-300">🎯 Daily Challenge</span>
        <button onClick={() => setDismissed(true)} className="text-white/30 hover:text-white/60 text-xs">×</button>
      </div>
      <p className="text-xs text-white/80 font-medium">{challenge.title}</p>
      <p className="text-xs text-white/50 mt-1">{challenge.desc}</p>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { activePanel, setActivePanel, showUI, undo, redo, toggleCommandPalette, togglePause, toggleUI, setTransformMode, frameSelected, toggleRayDebugger, addObject, addLight, selectedObjectId, removeObject, duplicateObject } = useStore();
  const [isMobile, setIsMobile] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const decodeSceneFromURL = useStore(s => s.decodeSceneFromURL);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load scene from URL hash
  useEffect(() => {
    if (window.location.hash) {
      decodeSceneFromURL(window.location.hash);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); if (selectedObjectId) duplicateObject(selectedObjectId); }
      else if (e.key === 'w') setTransformMode('translate');
      else if (e.key === 'e') setTransformMode('rotate');
      else if (e.key === 'r') setTransformMode('scale');
      else if (e.key === 'f') frameSelected();
      else if (e.key === 'Delete') { if (selectedObjectId) removeObject(selectedObjectId); }
      else if (e.key === ' ') { e.preventDefault(); togglePause(); }
      else if (e.key === 'g') toggleRayDebugger();
      else if (e.key === 'h') toggleUI();
      else if (e.key === 'F1') { e.preventDefault(); setShowShortcuts(s => !s); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <WebGLCheck />
      
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Scene Hierarchy (Desktop) */}
        {showUI && !isMobile && (
          <div className="w-56 bg-gray-900/80 border-r border-white/10 flex flex-col overflow-hidden shrink-0">
            <ScenePanel />
          </div>
        )}

        {/* Center - Viewport */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 relative bg-black">
            <Viewport />
            <StatsOverlay />
            
            {/* Viewport top bar */}
            <div className="absolute top-2 right-2 flex gap-1">
              <PresetsMenu />
              <SaveLoadMenu />
            </div>

            {/* Ray debugger overlay */}
            <RayDebuggerOverlay />

            {/* Daily Challenge */}
            {showUI && <DailyChallenge />}

            {/* Camera Help */}
            <CameraHelp />

            {/* Mobile toggle button */}
            {isMobile && showUI && (
              <button
                onClick={() => setShowMobilePanel(!showMobilePanel)}
                className="absolute bottom-2 right-2 w-10 h-10 bg-gray-900/80 border border-white/10 rounded-full flex items-center justify-center text-lg"
              >
                {showMobilePanel ? '×' : '☰'}
              </button>
            )}
          </div>

          {/* Bottom Panel Tabs (Desktop) */}
          {showUI && !isMobile && (
            <div className="h-48 bg-gray-900/80 border-t border-white/10 flex flex-col">
              <div className="flex border-b border-white/10">
                {(['render', 'education', 'experiments'] as const).map(panel => (
                  <button
                    key={panel}
                    onClick={() => setActivePanel(panel)}
                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                      activePanel === panel ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-white/50 hover:text-white/70'
                    }`}
                  >
                    {panel === 'render' ? '⚙ Render' : panel === 'education' ? '📚 Learn' : '🧪 Experiments'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {activePanel === 'render' && <RenderSettingsPanel />}
                {activePanel === 'education' && <EducationPanel />}
                {activePanel === 'experiments' && <ExperimentsPanel />}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Inspector (Desktop) */}
        {showUI && !isMobile && (
          <div className="w-64 bg-gray-900/80 border-l border-white/10 flex flex-col overflow-hidden shrink-0">
            <div className="p-2 border-b border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">Inspector</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <InspectorPanel />
            </div>
          </div>
        )}

        {/* Mobile Panel (Bottom Sheet) */}
        {isMobile && showMobilePanel && (
          <div className="absolute inset-0 z-30 bg-black/50" onClick={() => setShowMobilePanel(false)}>
            <div className="absolute bottom-0 left-0 right-0 h-[70vh] bg-gray-900 border-t border-white/10 rounded-t-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-3 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-sm font-semibold">Controls</h3>
                <button onClick={() => setShowMobilePanel(false)} className="text-white/60">✕</button>
              </div>
              <div className="p-3 space-y-3">
                <ScenePanel />
                <div className="border-t border-white/10 pt-3">
                  <InspectorPanel />
                </div>
                <div className="border-t border-white/10 pt-3">
                  <RenderSettingsPanel />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette />

      {/* Shortcuts Dialog */}
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

// ─── Ray Debugger Overlay ──────────────────────────────────────────────────────
function RayDebuggerOverlay() {
  const showRayDebugger = useStore(s => s.showRayDebugger);
  const scene = useStore(s => s.scene);

  if (!showRayDebugger) return null;

  return (
    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-3 max-w-xs animate-fade-in">
      <h4 className="text-xs font-semibold text-purple-300 mb-2">🔍 Ray Debugger</h4>
      <p className="text-xs text-white/60 mb-2">The ray tracer computes light paths through the scene.</p>
      <div className="space-y-1 text-xs text-white/50">
        <div>Render Mode: <span className="text-white/80">{scene.rendererSettings.renderMode}</span></div>
        <div>Max Bounces: <span className="text-white/80">{scene.rendererSettings.maxBounces}</span></div>
        <div>Samples: <span className="text-white/80">{scene.rendererSettings.samples}</span></div>
        <div>Shadow Samples: <span className="text-white/80">{scene.rendererSettings.shadowSamples}</span></div>
        <div>Objects: <span className="text-white/80">{scene.objects.length}</span></div>
        <div>Lights: <span className="text-white/80">{scene.lights.length}</span></div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/10">
        <p className="text-xs text-white/40 leading-relaxed">
          Pipeline: Camera → Primary Ray → Intersection → Normal → Lighting → Shadow Rays → Reflection/Refraction
        </p>
      </div>
      <div className="mt-2 pt-2 border-t border-white/10">
        <p className="text-xs text-cyan-400/60">
          Try switching render modes to visualize different data: normals, depth, albedo, shadows.
        </p>
      </div>
    </div>
  );
}

// ─── Keyboard Shortcuts Dialog ─────────────────────────────────────────────────
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const shortcuts = [
    { keys: 'W', action: 'Move tool' },
    { keys: 'E', action: 'Rotate tool' },
    { keys: 'R', action: 'Scale tool' },
    { keys: 'F', action: 'Frame selected' },
    { keys: 'Delete', action: 'Delete selected' },
    { keys: 'Ctrl+D', action: 'Duplicate' },
    { keys: 'Ctrl+Z', action: 'Undo' },
    { keys: 'Ctrl+Shift+Z', action: 'Redo' },
    { keys: 'Ctrl+K', action: 'Command palette' },
    { keys: 'Space', action: 'Pause/Resume render' },
    { keys: 'G', action: 'Toggle ray debugger' },
    { keys: 'H', action: 'Toggle UI' },
    { keys: 'Right-click drag', action: 'Orbit camera' },
    { keys: 'Shift+Left drag', action: 'Pan camera' },
    { keys: 'Scroll', action: 'Zoom camera' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">✕</button>
        </div>
        <div className="space-y-1.5">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex justify-between items-center py-1">
              <span className="text-sm text-white/70">{s.action}</span>
              <kbd className="px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-white/80 font-mono">{s.keys}</kbd>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-xs text-white/40">
            Camera: Right-click drag to orbit, Shift+drag to pan, scroll to zoom. On mobile: one finger to orbit, two fingers to zoom.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Camera Help Tooltip ───────────────────────────────────────────────────────
function CameraHelp() {
  const [show, setShow] = useState(false);

  return (
    <div className="absolute bottom-2 right-2">
      <button
        onClick={() => setShow(!show)}
        className="w-6 h-6 bg-black/40 border border-white/10 rounded-full text-xs text-white/40 hover:text-white/60 flex items-center justify-center"
        title="Camera controls help"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-8 right-0 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-xs text-white/60 w-48 animate-fade-in">
          <p className="font-medium text-white/80 mb-1">Camera Controls</p>
          <p>• Right-drag: Orbit</p>
          <p>• Shift+Left-drag: Pan</p>
          <p>• Scroll: Zoom</p>
          <p className="mt-1 text-white/40">Mobile: 1 finger orbit, 2 finger zoom</p>
        </div>
      )}
    </div>
  );
}
