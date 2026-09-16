// RayTrace Lab - WebGL2 Ray Tracing Renderer
// This is the actual GPU-based ray tracer using fragment shaders

import { SceneData, SceneObject, SceneLight, Material, Camera, Environment, RendererSettings, RayDebugInfo, RayBounce } from '../scene/types';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Uniforms
uniform vec2 u_resolution;
uniform int u_frame;
uniform int u_samples;
uniform float u_time;

// Camera
uniform vec3 u_camPos;
uniform vec3 u_camTarget;
uniform vec3 u_camUp;
uniform float u_camFov;

// Environment
uniform int u_envType;
uniform vec3 u_envColor;
uniform vec3 u_envColor2;
uniform float u_envIntensity;

// Render settings
uniform int u_maxBounces;
uniform int u_renderMode;
uniform int u_toneMapping;
uniform int u_shadowSamples;
uniform float u_resolutionScale;

// Scene data - max 16 objects, 4 lights, 16 materials (reduced for compatibility)
#define MAX_OBJECTS 16
#define MAX_LIGHTS 4
#define MAX_MATERIALS 16

// Object data: type(1) + pos(3) + rot(3) + scale(3) + params(3) + matIdx(1) + visible(1) = 15 floats per object
uniform float u_objects[MAX_OBJECTS * 15];
uniform int u_objectCount;

// Light data: type(1) + pos(3) + dir(3) + color(3) + intensity(1) + radius(1) + visible(1) = 13 floats per light
uniform float u_lights[MAX_LIGHTS * 13];
uniform int u_lightCount;

// Material data: type(1) + color(3) + roughness(1) + metallic(1) + reflectivity(1) + transmission(1) + ior(1) + emission(3) + emStr(1) = 14 floats per material
uniform float u_materials[MAX_MATERIALS * 14];
uniform int u_materialCount;

// Random functions
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash1(float n) { return fract(sin(n) * 43758.5453123); }

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec3 randomInUnitSphere(vec2 seed, float offset) {
  float r = hash(seed + offset) * 0.99;
  float theta = hash(seed + offset + 1.0) * 6.28318;
  float phi = acos(2.0 * hash(seed + offset + 2.0) - 1.0);
  return vec3(r * sin(phi) * cos(theta), r * sin(phi) * sin(theta), r * cos(phi));
}

// Object intersection structures
struct HitRecord {
  float t;
  vec3 point;
  vec3 normal;
  int materialIdx;
  int objectId;
  bool frontFace;
};

struct Ray {
  vec3 origin;
  vec3 direction;
};

Ray createRay(vec3 origin, vec3 direction) {
  return Ray(origin, normalize(direction));
}

vec3 rayAt(Ray r, float t) { return r.origin + r.direction * t; }

// Sphere intersection
bool hitSphere(Ray r, vec3 center, float radius, float tMin, float tMax, inout HitRecord rec) {
  vec3 oc = r.origin - center;
  float a = dot(r.direction, r.direction);
  float halfB = dot(oc, r.direction);
  float c = dot(oc, oc) - radius * radius;
  float disc = halfB * halfB - a * c;
  if (disc < 0.0) return false;
  float sqrtD = sqrt(disc);
  float root = (-halfB - sqrtD) / a;
  if (root < tMin || root > tMax) {
    root = (-halfB + sqrtD) / a;
    if (root < tMin || root > tMax) return false;
  }
  rec.t = root;
  rec.point = rayAt(r, root);
  vec3 outNormal = (rec.point - center) / radius;
  rec.frontFace = dot(r.direction, outNormal) < 0.0;
  rec.normal = rec.frontFace ? outNormal : -outNormal;
  return true;
}

// Plane intersection (infinite)
bool hitPlane(Ray r, vec3 pos, vec3 normal, float tMin, float tMax, inout HitRecord rec) {
  float denom = dot(normal, r.direction);
  if (abs(denom) < 1e-6) return false;
  float t = dot(pos - r.origin, normal) / denom;
  if (t < tMin || t > tMax) return false;
  rec.t = t;
  rec.point = rayAt(r, t);
  rec.frontFace = denom < 0.0;
  rec.normal = rec.frontFace ? normal : -normal;
  return true;
}

// Box intersection (AABB)
bool hitBox(Ray r, vec3 center, vec3 halfSize, mat3 rot, float tMin, float tMax, inout HitRecord rec) {
  // Transform ray to box local space
  vec3 localOrigin = rot * (r.origin - center);
  vec3 localDir = rot * r.direction;
  
  float t0 = tMin, t1 = tMax;
  vec3 localNormal = vec3(0.0);
  
  for (int i = 0; i < 3; i++) {
    float invD = 1.0 / localDir[i];
    float tNear = (-(halfSize[i]) - localOrigin[i]) * invD;
    float tFar = (halfSize[i] - localOrigin[i]) * invD;
    if (tNear > tFar) { float tmp = tNear; tNear = tFar; tFar = tmp; }
    if (tNear > t0) {
      t0 = tNear;
      localNormal = vec3(0.0);
      localNormal[i] = invD > 0.0 ? -1.0 : 1.0;
    }
    t1 = min(tFar, t1);
    if (t0 > t1) return false;
  }
  
  rec.t = t0;
  rec.point = rayAt(r, t0);
  rec.normal = transpose(rot) * localNormal;
  rec.frontFace = dot(r.direction, rec.normal) < 0.0;
  if (!rec.frontFace) rec.normal = -rec.normal;
  return true;
}

// Cylinder intersection
bool hitCylinder(Ray r, vec3 center, float radius, float height, mat3 rot, float tMin, float tMax, inout HitRecord rec) {
  vec3 localOrigin = rot * (r.origin - center);
  vec3 localDir = rot * r.direction;
  
  float a = localDir.x * localDir.x + localDir.z * localDir.z;
  float halfB = localOrigin.x * localDir.x + localOrigin.z * localDir.z;
  float c = localOrigin.x * localOrigin.x + localOrigin.z * localOrigin.z - radius * radius;
  float disc = halfB * halfB - a * c;
  if (disc < 0.0) return false;
  
  float sqrtD = sqrt(disc);
  float t = (-halfB - sqrtD) / a;
  if (t < tMin || t > tMax) {
    t = (-halfB + sqrtD) / a;
    if (t < tMin || t > tMax) return false;
  }
  
  vec3 hitPoint = localOrigin + localDir * t;
  if (hitPoint.y < -height * 0.5 || hitPoint.y > height * 0.5) return false;
  
  rec.t = t;
  rec.point = rayAt(r, t);
  vec3 localNormal = normalize(vec3(hitPoint.x, 0.0, hitPoint.z));
  rec.normal = transpose(rot) * localNormal;
  rec.frontFace = dot(r.direction, rec.normal) < 0.0;
  if (!rec.frontFace) rec.normal = -rec.normal;
  return true;
}

// Cone intersection
bool hitCone(Ray r, vec3 center, float radius, float height, mat3 rot, float tMin, float tMax, inout HitRecord rec) {
  vec3 localOrigin = rot * (r.origin - center);
  vec3 localDir = rot * r.direction;
  
  float halfH = height * 0.5;
  float tanHalfAngle = radius / height;
  float k = tanHalfAngle * tanHalfAngle;
  
  float oy = localOrigin.y - halfH; // offset so apex is at top
  float dy = localDir.y;
  
  float a = localDir.x * localDir.x + localDir.z * localDir.z - k * dy * dy;
  float halfB = localOrigin.x * localDir.x + localOrigin.z * localDir.z - k * oy * dy;
  float c = localOrigin.x * localOrigin.x + localOrigin.z * localOrigin.z - k * oy * oy;
  
  float disc = halfB * halfB - a * c;
  if (disc < 0.0) return false;
  
  float sqrtD = sqrt(disc);
  float t = (-halfB - sqrtD) / a;
  if (t < tMin || t > tMax) {
    t = (-halfB + sqrtD) / a;
    if (t < tMin || t > tMax) return false;
  }
  
  vec3 hitPoint = localOrigin + localDir * t;
  if (hitPoint.y < -halfH || hitPoint.y > halfH) return false;
  
  rec.t = t;
  rec.point = rayAt(r, t);
  float distFromAxis = sqrt(hitPoint.x * hitPoint.x + hitPoint.z * hitPoint.z);
  vec3 localNormal = normalize(vec3(hitPoint.x, k * (halfH - hitPoint.y), hitPoint.z));
  if (length(localNormal) < 0.001) localNormal = vec3(0.0, 1.0, 0.0);
  rec.normal = transpose(rot) * localNormal;
  rec.frontFace = dot(r.direction, rec.normal) < 0.0;
  if (!rec.frontFace) rec.normal = -rec.normal;
  return true;
}

// Rotation matrix from Euler angles
mat3 rotationMatrix(vec3 euler) {
  float cx = cos(euler.x), sx = sin(euler.x);
  float cy = cos(euler.y), sy = sin(euler.y);
  float cz = cos(euler.z), sz = sin(euler.z);
  mat3 rx = mat3(1,0,0, 0,cx,sx, 0,-sx,cx);
  mat3 ry = mat3(cy,0,-sy, 0,1,0, sy,0,cy);
  mat3 rz = mat3(cz,sz,0, -sz,cz,0, 0,0,1);
  return rz * ry * rx;
}

// Scene intersection
bool hitScene(Ray r, float tMin, float tMax, inout HitRecord rec) {
  bool hitAnything = false;
  float closest = tMax;
  
  for (int i = 0; i < MAX_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    int base = i * 15;
    int objType = int(u_objects[base]);
    float visible = u_objects[base + 13];
    if (visible < 0.5) continue;
    
    vec3 pos = vec3(u_objects[base+1], u_objects[base+2], u_objects[base+3]);
    vec3 rot = vec3(u_objects[base+4], u_objects[base+5], u_objects[base+6]);
    vec3 scl = vec3(u_objects[base+7], u_objects[base+8], u_objects[base+9]);
    vec3 params = vec3(u_objects[base+10], u_objects[base+11], u_objects[base+12]);
    int matIdx = int(u_objects[base + 14]);
    
    HitRecord tempRec;
    tempRec.materialIdx = matIdx;
    tempRec.objectId = i;
    bool hit = false;
    
    mat3 rotMat = rotationMatrix(rot);
    
    if (objType == 0) { // Sphere
      float radius = params.x * max(scl.x, max(scl.y, scl.z));
      hit = hitSphere(r, pos, radius, tMin, closest, tempRec);
    } else if (objType == 1) { // Plane
      vec3 normal = rotMat * vec3(0.0, 1.0, 0.0);
      hit = hitPlane(r, pos, normal, tMin, closest, tempRec);
    } else if (objType == 2) { // Box
      vec3 halfSize = params * scl * 0.5;
      hit = hitBox(r, pos, halfSize, rotMat, tMin, closest, tempRec);
    } else if (objType == 3) { // Cylinder
      float radius = params.x * max(scl.x, scl.z);
      float height = params.y * scl.y;
      hit = hitCylinder(r, pos, radius, height, rotMat, tMin, closest, tempRec);
    } else if (objType == 4) { // Cone
      float radius = params.x * max(scl.x, scl.z);
      float height = params.y * scl.y;
      hit = hitCone(r, pos, radius, height, rotMat, tMin, closest, tempRec);
    }
    
    if (hit) {
      hitAnything = true;
      closest = tempRec.t;
      rec = tempRec;
    }
  }
  
  return hitAnything;
}

// Get material properties
vec3 getMaterialColor(int matIdx) {
  int base = matIdx * 14;
  return vec3(u_materials[base+1], u_materials[base+2], u_materials[base+3]);
}

float getMaterialRoughness(int matIdx) { return u_materials[matIdx * 14 + 4]; }
float getMaterialMetallic(int matIdx) { return u_materials[matIdx * 14 + 5]; }
float getMaterialReflectivity(int matIdx) { return u_materials[matIdx * 14 + 6]; }
float getMaterialTransmission(int matIdx) { return u_materials[matIdx * 14 + 7]; }
float getMaterialIOR(int matIdx) { return u_materials[matIdx * 14 + 8]; }
vec3 getMaterialEmission(int matIdx) {
  int base = matIdx * 14;
  return vec3(u_materials[base+9], u_materials[base+10], u_materials[base+11]) * u_materials[base+12];
}
int getMaterialType(int matIdx) { return int(u_materials[matIdx * 14]); }

// Environment color
vec3 getEnvironment(vec3 dir) {
  if (u_envType == 0) { // Solid
    return u_envColor * u_envIntensity;
  } else if (u_envType == 1) { // Gradient
    float t = dir.y * 0.5 + 0.5;
    return mix(u_envColor, u_envColor2, t) * u_envIntensity;
  } else if (u_envType == 2) { // Sky
    float t = max(dir.y, 0.0);
    vec3 sky = mix(vec3(0.8, 0.85, 0.9), vec3(0.3, 0.5, 0.9), t);
    float sun = pow(max(dot(dir, normalize(vec3(0.5, 0.3, 0.8))), 0.0), 64.0);
    return (sky + vec3(1.0, 0.9, 0.7) * sun) * u_envIntensity;
  } else if (u_envType == 3) { // Checkerboard
    vec2 uv = vec2(atan(dir.z, dir.x) / 3.14159, dir.y);
    float checker = mod(floor(uv.x * 8.0) + floor(uv.y * 8.0), 2.0);
    return mix(vec3(0.1), vec3(0.4), checker) * u_envIntensity;
  } else { // Dark
    return vec3(0.01) * u_envIntensity;
  }
}

// Shadow ray
float shadowRay(vec3 point, vec3 lightPos, vec3 lightDir, float lightDist, int shadowSamples, vec2 seed) {
  float shadow = 0.0;
  int samples = max(1, shadowSamples);
  
  for (int s = 0; s < 32; s++) {
    if (s >= samples) break;
    vec3 target = lightPos;
    if (samples > 1) {
      vec2 offset = hash2(seed + float(s) * 7.3) - 0.5;
      target += vec3(offset.x, 0.0, offset.y) * 0.5;
    }
    vec3 dir = normalize(target - point);
    float dist = length(target - point);
    Ray shadowR = createRay(point + dir * 0.001, dir);
    HitRecord rec;
    if (hitScene(shadowR, 0.001, dist - 0.001, rec)) {
      shadow += 1.0;
    }
  }
  return 1.0 - shadow / float(samples);
}

// Trace a single ray
vec3 traceRay(Ray ray, vec2 seed, int maxBounces) {
  vec3 color = vec3(0.0);
  vec3 throughput = vec3(1.0);
  int bounces = 0;
  
  for (int bounce = 0; bounce < 16; bounce++) {
    if (bounce >= maxBounces) break;
    
    HitRecord rec;
    if (!hitScene(ray, 0.001, 1000.0, rec)) {
      color += throughput * getEnvironment(ray.direction);
      break;
    }
    
    int matIdx = rec.materialIdx;
    vec3 matColor = getMaterialColor(matIdx);
    float roughness = getMaterialRoughness(matIdx);
    float metallic = getMaterialMetallic(matIdx);
    float reflectivity = getMaterialReflectivity(matIdx);
    float transmission = getMaterialTransmission(matIdx);
    float ior = getMaterialIOR(matIdx);
    vec3 emission = getMaterialEmission(matIdx);
    int matType = getMaterialType(matIdx);
    
    // Emission
    color += throughput * emission;
    
    // Direct lighting
    vec3 directLight = vec3(0.0);
    for (int li = 0; li < MAX_LIGHTS; li++) {
      if (li >= u_lightCount) break;
      int lbase = li * 13;
      float lvisible = u_lights[lbase + 12];
      if (lvisible < 0.5) continue;
      
      int lType = int(u_lights[lbase]);
      vec3 lPos = vec3(u_lights[lbase+1], u_lights[lbase+2], u_lights[lbase+3]);
      vec3 lDir = vec3(u_lights[lbase+4], u_lights[lbase+5], u_lights[lbase+6]);
      vec3 lCol = vec3(u_lights[lbase+7], u_lights[lbase+8], u_lights[lbase+9]);
      float lInt = u_lights[lbase+10];
      
      vec3 toLight;
      float lightDist;
      float attenuation;
      
      if (lType == 0) { // Point light
        toLight = lPos - rec.point;
        lightDist = length(toLight);
        toLight = normalize(toLight);
        attenuation = lInt / (1.0 + lightDist * lightDist * 0.1);
      } else if (lType == 1) { // Directional
        toLight = normalize(lDir);
        lightDist = 1000.0;
        attenuation = lInt;
      } else { // Area light
        toLight = lPos - rec.point;
        lightDist = length(toLight);
        toLight = normalize(toLight);
        attenuation = lInt / (1.0 + lightDist * lightDist * 0.05);
      }
      
      float NdotL = max(dot(rec.normal, toLight), 0.0);
      if (NdotL > 0.0) {
        float shadow = shadowRay(rec.point, lPos, toLight, lightDist, u_shadowSamples, seed + float(bounce) * 13.0 + float(li) * 7.0);
        directLight += lCol * attenuation * NdotL * shadow * matColor;
      }
    }
    
    // Add ambient
    directLight += matColor * getEnvironment(rec.normal) * 0.1;
    
    color += throughput * directLight * (1.0 - transmission);
    
    // Fresnel calculation (Schlick approximation)
    float cosTheta = abs(dot(-ray.direction, rec.normal));
    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    float fresnel = r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
    
    // For glass: decide between reflection and refraction based on Fresnel
    float rand = hash(seed + float(bounce) * 3.7);
    
    if (transmission > 0.01) {
      // Glass material - choose reflection or refraction based on Fresnel
      if (rand < fresnel) {
        // Reflection
        vec3 reflected = reflect(ray.direction, rec.normal);
        if (roughness > 0.01) {
          vec3 perturb = randomInUnitSphere(seed + float(bounce) * 5.3, 0.0) * roughness;
          reflected = normalize(reflected + perturb);
        }
        ray = createRay(rec.point + reflected * 0.001, reflected);
        throughput *= matColor;
      } else {
        // Refraction
        float eta = rec.frontFace ? (1.0 / ior) : ior;
        vec3 rd = refract(ray.direction, rec.normal, eta);
        if (length(rd) < 0.001) {
          // Total internal reflection - fallback to reflection
          rd = reflect(ray.direction, rec.normal);
          ray = createRay(rec.point + rd * 0.001, rd);
          throughput *= matColor;
        } else {
          ray = createRay(rec.point + rd * 0.001, rd);
          throughput *= matColor;
        }
      }
    } else if (reflectivity > 0.01 && rand < reflectivity) {
      // Non-glass reflective material
      vec3 reflected = reflect(ray.direction, rec.normal);
      if (roughness > 0.01) {
        vec3 perturb = randomInUnitSphere(seed + float(bounce) * 5.3, 0.0) * roughness;
        reflected = normalize(reflected + perturb);
      }
      ray = createRay(rec.point + reflected * 0.001, reflected);
      vec3 fresnelColor = mix(matColor, vec3(1.0), metallic);
      throughput *= fresnelColor;
    } else {
      break;
    }
    
    bounces++;
    throughput = clamp(throughput, 0.0, 1.0);
    if (dot(throughput, throughput) < 0.001) break;
  }
  
  return color;
}

// Debug render modes
vec3 renderDebug(Ray ray, vec2 uv) {
  HitRecord rec;
  if (!hitScene(ray, 0.001, 1000.0, rec)) {
    return getEnvironment(ray.direction);
  }
  
  if (u_renderMode == 2) { // Normals
    return rec.normal * 0.5 + 0.5;
  } else if (u_renderMode == 3) { // Depth
    float d = rec.t / 20.0;
    return vec3(d);
  } else if (u_renderMode == 4) { // Albedo
    return getMaterialColor(rec.materialIdx);
  } else if (u_renderMode == 5) { // Roughness
    float r = getMaterialRoughness(rec.materialIdx);
    return vec3(r);
  } else if (u_renderMode == 6) { // Metallic
    float m = getMaterialMetallic(rec.materialIdx);
    return vec3(m);
  } else if (u_renderMode == 7) { // Emission
    return getMaterialEmission(rec.materialIdx);
  } else if (u_renderMode == 8) { // Shadows
    float shadow = 1.0;
    for (int li = 0; li < MAX_LIGHTS; li++) {
      if (li >= u_lightCount) break;
      int lbase = li * 13;
      vec3 lPos = vec3(u_lights[lbase+1], u_lights[lbase+2], u_lights[lbase+3]);
      vec3 toLight = normalize(lPos - rec.point);
      float dist = length(lPos - rec.point);
      Ray sr = createRay(rec.point + toLight * 0.001, toLight);
      HitRecord sr2;
      if (hitScene(sr, 0.001, dist, sr2)) {
        shadow = 0.0;
        break;
      }
    }
    return vec3(shadow);
  }
  
  return vec3(1.0, 0.0, 1.0);
}

// Tone mapping
vec3 toneMap(vec3 color) {
  if (u_toneMapping == 1) { // Reinhard
    return color / (1.0 + color);
  } else if (u_toneMapping == 2) { // ACES approximation
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
  }
  return color;
}

void main() {
  vec2 uv = v_uv;
  vec2 pixelSeed = uv * u_resolution + float(u_frame) * 1.731;
  
  // Camera setup
  vec3 forward = normalize(u_camTarget - u_camPos);
  vec3 right = normalize(cross(forward, u_camUp));
  vec3 up = cross(right, forward);
  
  float aspect = u_resolution.x / u_resolution.y;
  float fovScale = tan(radians(u_camFov) * 0.5);
  
  // Anti-aliasing jitter
  vec2 jitter = vec2(0.0);
  if (u_samples > 1) {
    jitter = (hash2(pixelSeed + float(u_frame)) - 0.5) / u_resolution;
  }
  
  vec2 ndc = (uv + jitter) * 2.0 - 1.0;
  ndc.x *= aspect;
  vec3 rayDir = normalize(forward + right * ndc.x * fovScale + up * ndc.y * fovScale);
  
  Ray ray = createRay(u_camPos, rayDir);
  
  vec3 color;
  if (u_renderMode == 0 || u_renderMode == 1) {
    color = traceRay(ray, pixelSeed, u_maxBounces);
    // Direct lighting only mode
    if (u_renderMode == 1) {
      color = traceRay(ray, pixelSeed, 1);
    }
  } else {
    color = renderDebug(ray, uv);
  }
  
  // Tone mapping
  color = toneMap(color);
  
  // Gamma correction (linear to sRGB)
  color = pow(color, vec3(1.0 / 2.2));
  
  fragColor = vec4(color, 1.0);
}
`;

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private frameBuffer: WebGLFramebuffer | null = null;
  private accumTexture: WebGLTexture | null = null;
  private animationId: number = 0;
  private frameCount: number = 0;
  private lastRenderTime: number = 0;
  private isRendering: boolean = false;
  private isPaused: boolean = false;
  private sceneData: SceneData | null = null;
  private needsReset: boolean = true;
  private onFrameCallback: ((stats: RenderStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.init();
  }

  private init() {
    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    this.gl = gl;

    // Set initial canvas size
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }

    // Handle context loss
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.isRendering = false;
      cancelAnimationFrame(this.animationId);
    });

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.init();
      if (this.sceneData) this.updateScene(this.sceneData);
    });

    this.setupShaders();
    this.setupGeometry();
  }

  private setupShaders() {
    if (!this.gl) return;
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) {
      console.error('Failed to create vertex shader');
      return;
    }
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      gl.deleteShader(vs);
      return;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) {
      console.error('Failed to create fragment shader');
      gl.deleteShader(vs);
      return;
    }
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create program');
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    this.program = program;
    gl.useProgram(program);
    
    // Clean up shaders after linking
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  }

  private setupGeometry() {
    if (!this.gl) return;
    const gl = this.gl;

    // Full-screen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  }

  updateScene(scene: SceneData) {
    this.sceneData = scene;
    this.needsReset = true;
    this.frameCount = 0;
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  start() {
    if (this.isRendering) return;
    this.isRendering = true;
    this.renderLoop();
  }

  stop() {
    this.isRendering = false;
    cancelAnimationFrame(this.animationId);
  }

  setOnFrame(cb: (stats: RenderStats) => void) {
    this.onFrameCallback = cb;
  }

  private renderLoop = () => {
    if (!this.isRendering) return;
    this.animationId = requestAnimationFrame(this.renderLoop);

    if (this.isPaused || !this.gl || !this.program || !this.sceneData) return;

    const startTime = performance.now();
    this.render();
    const endTime = performance.now();
    this.lastRenderTime = endTime - startTime;

    if (this.onFrameCallback) {
      this.onFrameCallback({
        frameTime: this.lastRenderTime,
        frameCount: this.frameCount,
        resolution: this.getRenderResolution(),
        objectCount: this.sceneData.objects.length,
        lightCount: this.sceneData.lights.length,
        materialCount: this.sceneData.materials.length,
        samples: this.frameCount,
        maxBounces: this.sceneData.rendererSettings.maxBounces,
      });
    }
  };

  private render() {
    if (!this.gl || !this.program || !this.sceneData) return;
    const gl = this.gl;
    const scene = this.sceneData;
    const settings = scene.rendererSettings;

    const [width, height] = this.getRenderResolution();
    
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.needsReset = true;
    }

    gl.viewport(0, 0, width, height);

    if (this.needsReset) {
      this.frameCount = 0;
      this.needsReset = false;
    }

    this.frameCount++;

    // Set uniforms
    gl.useProgram(this.program);

    this.setUniform2f('u_resolution', width, height);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_frame'), this.frameCount);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_samples'), settings.samples);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), performance.now() / 1000);

    // Camera
    this.setUniform3f('u_camPos', ...scene.camera.position);
    this.setUniform3f('u_camTarget', ...scene.camera.target);
    this.setUniform3f('u_camUp', ...scene.camera.up);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_camFov'), scene.camera.fov);

    // Environment
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_envType'), 
      scene.environment.type === 'solid' ? 0 : scene.environment.type === 'gradient' ? 1 : 
      scene.environment.type === 'sky' ? 2 : scene.environment.type === 'checkerboard' ? 3 : 4);
    this.setUniform3f('u_envColor', ...scene.environment.color);
    this.setUniform3f('u_envColor2', ...scene.environment.color2);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_envIntensity'), scene.environment.intensity);

    // Render settings
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_maxBounces'), settings.maxBounces);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_renderMode'),
      settings.renderMode === 'full' ? 0 : settings.renderMode === 'direct' ? 1 :
      settings.renderMode === 'normals' ? 2 : settings.renderMode === 'depth' ? 3 :
      settings.renderMode === 'albedo' ? 4 : settings.renderMode === 'roughness' ? 5 :
      settings.renderMode === 'metallic' ? 6 : settings.renderMode === 'emission' ? 7 :
      settings.renderMode === 'shadows' ? 8 : 9);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_toneMapping'),
      settings.toneMapping === 'none' ? 0 : settings.toneMapping === 'reinhard' ? 1 : 2);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_shadowSamples'), settings.shadowSamples);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_resolutionScale'), settings.resolution / 100);

    // Objects
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_objectCount'), scene.objects.length);
    const objData = new Float32Array(16 * 15);
    scene.objects.forEach((obj, i) => {
      if (i >= 16) return;
      const base = i * 15;
      const typeMap: Record<string, number> = { sphere: 0, plane: 1, box: 2, cylinder: 3, cone: 4 };
      objData[base] = typeMap[obj.type] || 0;
      objData[base+1] = obj.transform.position[0];
      objData[base+2] = obj.transform.position[1];
      objData[base+3] = obj.transform.position[2];
      objData[base+4] = obj.transform.rotation[0];
      objData[base+5] = obj.transform.rotation[1];
      objData[base+6] = obj.transform.rotation[2];
      objData[base+7] = obj.transform.scale[0];
      objData[base+8] = obj.transform.scale[1];
      objData[base+9] = obj.transform.scale[2];
      objData[base+10] = obj.radius || 1;
      objData[base+11] = obj.height || 2;
      objData[base+12] = obj.size ? obj.size[0] : 1;
      const matIdx = scene.materials.findIndex(m => m.id === obj.materialId);
      objData[base+13] = obj.visible ? 1 : 0;
      objData[base+14] = matIdx >= 0 ? matIdx : 0;
    });
    this.setFloatArray('u_objects', objData);

    // Lights
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_lightCount'), scene.lights.length);
    const lightData = new Float32Array(4 * 13);
    scene.lights.forEach((light, i) => {
      if (i >= 4) return;
      const base = i * 13;
      const typeMap: Record<string, number> = { point: 0, directional: 1, area: 2 };
      lightData[base] = typeMap[light.type] || 0;
      lightData[base+1] = light.position[0];
      lightData[base+2] = light.position[1];
      lightData[base+3] = light.position[2];
      lightData[base+4] = light.direction[0];
      lightData[base+5] = light.direction[1];
      lightData[base+6] = light.direction[2];
      lightData[base+7] = light.color[0];
      lightData[base+8] = light.color[1];
      lightData[base+9] = light.color[2];
      lightData[base+10] = light.intensity;
      lightData[base+11] = light.radius;
      lightData[base+12] = light.visible ? 1 : 0;
    });
    this.setFloatArray('u_lights', lightData);

    // Materials
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_materialCount'), scene.materials.length);
    const matData = new Float32Array(16 * 14);
    scene.materials.forEach((mat, i) => {
      if (i >= 16) return;
      const base = i * 14;
      const typeMap: Record<string, number> = { diffuse: 0, reflective: 1, glass: 2, emissive: 3, metal: 4 };
      matData[base] = typeMap[mat.type] || 0;
      matData[base+1] = mat.baseColor[0];
      matData[base+2] = mat.baseColor[1];
      matData[base+3] = mat.baseColor[2];
      matData[base+4] = mat.roughness;
      matData[base+5] = mat.metallic;
      matData[base+6] = mat.reflectivity;
      matData[base+7] = mat.transmission;
      matData[base+8] = mat.ior;
      matData[base+9] = mat.emission[0];
      matData[base+10] = mat.emission[1];
      matData[base+11] = mat.emission[2];
      matData[base+12] = mat.emissionStrength;
      matData[base+13] = 0;
    });
    this.setFloatArray('u_materials', matData);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private setUniform2f(name: string, x: number, y: number) {
    if (!this.gl || !this.program) return;
    const loc = this.gl.getUniformLocation(this.program, name);
    this.gl.uniform2f(loc, x, y);
  }

  private setUniform3f(name: string, x: number, y: number, z: number) {
    if (!this.gl || !this.program) return;
    const loc = this.gl.getUniformLocation(this.program, name);
    this.gl.uniform3f(loc, x, y, z);
  }

  private setFloatArray(name: string, data: Float32Array) {
    if (!this.gl || !this.program) return;
    const loc = this.gl.getUniformLocation(this.program, name);
    this.gl.uniform1fv(loc, data);
  }

  getRenderResolution(): [number, number] {
    const scale = (this.sceneData?.rendererSettings.resolution || 100) / 100;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
    const rect = this.canvas.getBoundingClientRect();
    return [
      Math.max(1, Math.floor(rect.width * scale * dpr)),
      Math.max(1, Math.floor(rect.height * scale * dpr)),
    ];
  }

  getFrameCount(): number { return this.frameCount; }
  getRenderTime(): number { return this.lastRenderTime; }
  isContextValid(): boolean { return this.gl !== null && !this.gl.isContextLost(); }

  resetAccumulation() {
    this.needsReset = true;
    this.frameCount = 0;
  }

  getScreenshot(): string | null {
    if (!this.gl) return null;
    return this.canvas.toDataURL('image/png');
  }

  dispose() {
    this.stop();
    if (this.gl) {
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }
}

export interface RenderStats {
  frameTime: number;
  frameCount: number;
  resolution: [number, number];
  objectCount: number;
  lightCount: number;
  materialCount: number;
  samples: number;
  maxBounces: number;
}
