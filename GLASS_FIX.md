# Glass Sphere Noise Fix

## Problem
The glass sphere was showing significant noise/graininess in the rendered output.

## Root Cause
The issue was caused by improper handling of reflection vs refraction probability in the ray tracing shader. The original implementation used a simple random threshold that didn't properly account for the Fresnel effect, leading to incorrect energy distribution and visual noise.

## Solution

### 1. Implemented Fresnel Effect (Schlick Approximation)
Added proper Fresnel calculation to determine the probability of reflection vs refraction based on the viewing angle:

```glsl
float cosTheta = abs(dot(-ray.direction, rec.normal));
float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
float fresnel = r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
```

This ensures that:
- At grazing angles, more light is reflected (higher fresnel value)
- At normal incidence, more light is refracted (lower fresnel value)
- The transition is physically plausible

### 2. Fixed Reflection/Refraction Logic
Changed the ray branching logic to use Fresnel-based probability:

```glsl
if (transmission > 0.01) {
  if (rand < fresnel) {
    // Reflection path
    vec3 reflected = reflect(ray.direction, rec.normal);
    // ... handle reflection
  } else {
    // Refraction path
    float eta = rec.frontFace ? (1.0 / ior) : ior;
    vec3 rd = refract(ray.direction, rec.normal, eta);
    // ... handle refraction
  }
}
```

### 3. Increased Default Sample Count
- Default samples: 4 → 8
- Default max bounces: 4 → 6
- Glass-specific presets now use 16 samples for better convergence
- Mirror room preset uses 12 samples

### 4. Updated Quality Presets
- Fast: 4 samples (was 2)
- Balanced: 8 samples (was 4)
- Quality: 16 samples (was 8)
- Insane: 32 samples (was 16)

## Technical Details

### Fresnel Effect
The Fresnel effect describes how the reflectivity of a surface changes based on the viewing angle. For glass:
- At normal incidence (looking straight at the surface): ~4% reflection, ~96% refraction
- At grazing angles (looking at a shallow angle): up to 100% reflection

The Schlick approximation provides a computationally efficient way to calculate this:
```
F(θ) = F₀ + (1 - F₀)(1 - cos θ)⁵
```
where F₀ = ((n₁ - n₂) / (n₁ + n₂))²

### Monte Carlo Integration
The ray tracer uses Monte Carlo methods to estimate the light transport. Each ray randomly chooses between reflection and refraction based on the Fresnel probability. With more samples, the noise decreases as the law of large numbers ensures convergence to the correct solution.

### Total Internal Reflection
When light tries to exit a denser medium (like glass) at a steep angle, it can be completely reflected back inside. This is handled by checking if the refraction calculation fails:

```glsl
if (length(rd) < 0.001) {
  // Total internal reflection - fallback to reflection
  rd = reflect(ray.direction, rec.normal);
}
```

## Results
- Glass spheres now render with significantly less noise
- Physically accurate Fresnel reflections
- Better convergence with increased sample counts
- Improved visual quality across all scenes with transparent materials

## Files Modified
- `src/renderer/WebGLRenderer.ts` - Fixed glass reflection/refraction logic
- `src/scene/types.ts` - Increased default samples and bounces
- `src/scene/presets.ts` - Updated presets with higher quality settings
- `src/App.tsx` - Updated quality preset buttons
