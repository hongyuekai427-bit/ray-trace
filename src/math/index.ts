// RayTrace Lab - Math Library
// Core vector, matrix, and ray operations for ray tracing

export class Vec3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}

  static zero(): Vec3 { return new Vec3(0, 0, 0); }
  static one(): Vec3 { return new Vec3(1, 1, 1); }
  static up(): Vec3 { return new Vec3(0, 1, 0); }
  static forward(): Vec3 { return new Vec3(0, 0, -1); }
  static right(): Vec3 { return new Vec3(1, 0, 0); }

  clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }
  set(x: number, y: number, z: number): Vec3 { this.x = x; this.y = y; this.z = z; return this; }
  copy(v: Vec3): Vec3 { this.x = v.x; this.y = v.y; this.z = v.z; return this; }

  add(v: Vec3): Vec3 { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: Vec3): Vec3 { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s); }
  div(s: number): Vec3 { const inv = 1 / s; return new Vec3(this.x * inv, this.y * inv, this.z * inv); }
  mulVec(v: Vec3): Vec3 { return new Vec3(this.x * v.x, this.y * v.y, this.z * v.z); }

  dot(v: Vec3): number { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length(): number { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  lengthSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize(): Vec3 {
    const len = this.length();
    if (len < 1e-10) return Vec3.zero();
    return this.div(len);
  }

  negate(): Vec3 { return new Vec3(-this.x, -this.y, -this.z); }
  reflect(normal: Vec3): Vec3 {
    const d = 2 * this.dot(normal);
    return this.sub(normal.mul(d));
  }

  lerp(v: Vec3, t: number): Vec3 {
    return new Vec3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  toArray(): [number, number, number] { return [this.x, this.y, this.z]; }
  static fromArray(a: number[]): Vec3 { return new Vec3(a[0] || 0, a[1] || 0, a[2] || 0); }
}

export class Ray {
  constructor(public origin: Vec3 = Vec3.zero(), public direction: Vec3 = Vec3.forward()) {}

  at(t: number): Vec3 { return this.origin.add(this.direction.mul(t)); }
}

export class Mat4 {
  data: Float32Array;

  constructor() {
    this.data = new Float32Array(16);
    this.identity();
  }

  identity(): Mat4 {
    this.data.fill(0);
    this.data[0] = 1; this.data[5] = 1; this.data[10] = 1; this.data[15] = 1;
    return this;
  }

  static perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
    const m = new Mat4();
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    m.data[0] = f / aspect;
    m.data[5] = f;
    m.data[10] = (far + near) * nf;
    m.data[11] = -1;
    m.data[14] = 2 * far * near * nf;
    m.data[15] = 0;
    return m;
  }

  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    const z = eye.sub(target).normalize();
    const x = up.cross(z).normalize();
    const y = z.cross(x).normalize();
    const m = new Mat4();
    m.data[0] = x.x; m.data[4] = x.y; m.data[8] = x.z; m.data[12] = -x.dot(eye);
    m.data[1] = y.x; m.data[5] = y.y; m.data[9] = y.z; m.data[13] = -y.dot(eye);
    m.data[2] = z.x; m.data[6] = z.y; m.data[10] = z.z; m.data[14] = -z.dot(eye);
    m.data[3] = 0; m.data[7] = 0; m.data[11] = 0; m.data[15] = 1;
    return m;
  }

  static translation(x: number, y: number, z: number): Mat4 {
    const m = new Mat4();
    m.data[12] = x; m.data[13] = y; m.data[14] = z;
    return m;
  }

  static rotationX(angle: number): Mat4 {
    const m = new Mat4();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[5] = c; m.data[6] = s; m.data[9] = -s; m.data[10] = c;
    return m;
  }

  static rotationY(angle: number): Mat4 {
    const m = new Mat4();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[0] = c; m.data[2] = -s; m.data[8] = s; m.data[10] = c;
    return m;
  }

  static rotationZ(angle: number): Mat4 {
    const m = new Mat4();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[0] = c; m.data[1] = s; m.data[4] = -s; m.data[5] = c;
    return m;
  }

  static scaling(x: number, y: number, z: number): Mat4 {
    const m = new Mat4();
    m.data[0] = x; m.data[5] = y; m.data[10] = z;
    return m;
  }

  multiply(b: Mat4): Mat4 {
    const a = this.data;
    const bd = b.data;
    const r = new Mat4();
    const o = r.data;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        o[j * 4 + i] = a[i] * bd[j * 4] + a[4 + i] * bd[j * 4 + 1] + a[8 + i] * bd[j * 4 + 2] + a[12 + i] * bd[j * 4 + 3];
      }
    }
    return r;
  }

  transformPoint(v: Vec3): Vec3 {
    const d = this.data;
    const w = d[3] * v.x + d[7] * v.y + d[11] * v.z + d[15];
    return new Vec3(
      (d[0] * v.x + d[4] * v.y + d[8] * v.z + d[12]) / w,
      (d[1] * v.x + d[5] * v.y + d[9] * v.z + d[13]) / w,
      (d[2] * v.x + d[6] * v.y + d[10] * v.z + d[14]) / w
    );
  }

  transformDirection(v: Vec3): Vec3 {
    const d = this.data;
    return new Vec3(
      d[0] * v.x + d[4] * v.y + d[8] * v.z,
      d[1] * v.x + d[5] * v.y + d[9] * v.z,
      d[2] * v.x + d[6] * v.y + d[10] * v.z
    );
  }

  inverse(): Mat4 {
    const m = this.data;
    const inv = new Float32Array(16);
    inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
    inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
    inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
    inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
    inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
    inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
    inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
    inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
    inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
    inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];

    let det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
    if (Math.abs(det) < 1e-10) return new Mat4();
    det = 1.0 / det;
    const r = new Mat4();
    for (let i = 0; i < 16; i++) r.data[i] = inv[i] * det;
    return r;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function degToRad(deg: number): number { return deg * Math.PI / 180; }
export function radToDeg(rad: number): number { return rad * 180 / Math.PI; }

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
