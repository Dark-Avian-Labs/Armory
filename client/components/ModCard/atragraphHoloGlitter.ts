const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const GLITTER_GLSL = `
precision highp float;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.1;
    amplitude *= 0.5;
  }
  return value;
}

vec2 coverUv(vec2 uv, float texAspect, float viewAspect) {
  vec2 scale = vec2(1.0);
  vec2 offset = vec2(0.0);

  if (texAspect > viewAspect) {
    scale.x = viewAspect / texAspect;
    offset.x = (1.0 - scale.x) * 0.5;
  } else {
    scale.y = texAspect / viewAspect;
    offset.y = (1.0 - scale.y) * 0.5;
  }

  return uv * scale + offset;
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

float roundedBox(vec2 p, vec2 halfSize, float cornerRadius) {
  vec2 q = abs(p) - halfSize + cornerRadius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cornerRadius;
}

vec4 glitterLayerColored(
  vec2 uv,
  vec2 tilt,
  vec2 velocity,
  float gridScale,
  float spawnCutoff,
  float particleSize
) {
  float speed = length(velocity);
  float speedGate = smoothstep(0.006, 0.045, speed);

  vec2 glitterUv = uv * gridScale;
  vec2 cell = floor(glitterUv);
  vec2 local = fract(glitterUv) - 0.5;

  float seed = hash(cell);
  float spawn = step(spawnCutoff, seed);

  vec2 jitter = (vec2(hash(cell + 13.7), hash(cell + 42.1)) - 0.5) * 0.28;
  vec2 p = local + jitter;

  float angle = (seed - 0.5) * 0.55;
  float cs = cos(angle);
  float sn = sin(angle);
  p = mat2(cs, -sn, sn, cs) * p;

  float halfSize = particleSize * (0.52 + seed * 0.38);
  float cornerRadius = halfSize * (0.18 + seed * 0.2);
  float dist = roundedBox(p, vec2(halfSize), cornerRadius);
  float particle = (1.0 - smoothstep(-0.012, 0.018, dist)) * spawn;

  vec2 facetNormal = normalize(jitter * 2.4 + vec2(hash(cell + 3.1) - 0.5, hash(cell + 9.4) - 0.5));
  vec2 lightDir = normalize(tilt + vec2(0.001, 0.002));

  vec2 particleAxis = vec2(cos(seed * 6.283), sin(seed * 6.283));
  vec2 biasedNormal = normalize(facetNormal + particleAxis * (0.12 + seed * 0.18));
  float specPower = 6.0 + seed * 12.0;
  float spec = pow(max(0.0, dot(biasedNormal, lightDir)), specPower);

  vec2 velDir = normalize(velocity + vec2(0.0001));
  float velMatch = pow(max(0.0, abs(dot(velDir, particleAxis))), 3.0 + seed * 8.0);

  float tiltMatch = smoothstep(0.82, 0.98, abs(dot(facetNormal, lightDir)));
  float sweepMatch = smoothstep(0.55, 0.92, abs(dot(lightDir, particleAxis)));

  float canFlash = step(0.42 + seed * 0.48, hash(cell + 99.1));
  float particleFlash = speedGate * canFlash * max(
    spec * 2.2,
    max(velMatch * tiltMatch * 1.6, sweepMatch * spec * 1.8)
  );

  float baseDim = particle * 0.1;
  float flashStrength = particle * particleFlash * 1.5;

  float hue = fract(
    seed * 0.91 +
    dot(uv - 0.5, facetNormal) * 0.28 +
    spec * 0.25 +
    dot(velocity, vec2(0.6, 0.4)) * 0.55 * speedGate
  );
  float saturation = 0.88 + seed * 0.12;
  vec3 holoColor = hsv2rgb(vec3(hue, saturation, 1.0));
  vec3 idleColor = vec3(0.72, 0.76, 0.82);
  vec3 sparkleColor = mix(idleColor, holoColor, clamp(particleFlash * 1.8, 0.0, 1.0));

  return vec4(
    idleColor * baseDim + sparkleColor * flashStrength,
    baseDim + flashStrength
  );
}

vec4 holoGlitter(vec2 uv, vec2 tilt, vec2 velocity) {
  vec4 coarse = glitterLayerColored(uv, tilt, velocity, 78.0, 0.02, 0.34);
  vec4 medium = glitterLayerColored(uv, tilt, velocity, 139.0, 0.05, 0.24);
  vec4 fine = glitterLayerColored(uv, tilt, velocity, 223.0, 0.09, 0.16);
  vec4 micro = glitterLayerColored(uv, tilt, velocity, 347.0, 0.14, 0.105);
  vec4 dust = glitterLayerColored(uv, tilt, velocity, 509.0, 0.18, 0.072);
  vec4 grain = glitterLayerColored(uv, tilt, velocity, 721.0, 0.22, 0.052);

  vec4 combined = coarse + medium + fine + micro + dust + grain;
  float alpha = clamp(combined.a, 0.0, 1.0);
  vec3 rgb = combined.rgb / max(combined.a, 0.001);
  return vec4(rgb * alpha, alpha);
}

vec4 holoGlitterBase(vec2 uv) {
  return holoGlitter(uv, vec2(0.0), vec2(0.0));
}

float backgroundOnlyMask(vec2 uv, sampler2D baseTex) {
  vec3 c = texture(baseTex, uv).rgb;
  float cool = (c.g + c.b) * 0.5 - c.r;
  float warm = c.r - min(c.g, c.b);
  return smoothstep(0.04, 0.14, cool - warm * 0.65);
}

float overlayCreatureMask(vec2 uv, sampler2D overlayTex) {
  vec3 rgb = texture(overlayTex, uv).rgb;
  return smoothstep(0.045, 0.18, max(rgb.r, max(rgb.g, rgb.b)));
}

float sparkleRegionMask(vec2 uv, sampler2D baseTex, sampler2D overlayTex) {
  return backgroundOnlyMask(uv, baseTex) * (1.0 - overlayCreatureMask(uv, overlayTex));
}
`;

const PERSIST_FRAGMENT_SHADER = `#version 300 es
${GLITTER_GLSL}

uniform sampler2D uPrevPersist;
uniform sampler2D uTexture;
uniform sampler2D uOverlay;
uniform vec2 uTilt;
uniform vec2 uTiltVelocity;
uniform float uViewAspect;
uniform float uTexAspect;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 uv = coverUv(vUv, uTexAspect, uViewAspect);
  vec4 prev = texture(uPrevPersist, vUv);
  float bgMask = sparkleRegionMask(uv, uTexture, uOverlay);

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.0);
    return;
  }

  vec4 live = holoGlitter(uv, uTilt, uTiltVelocity);
  vec4 idle = holoGlitterBase(uv);
  vec4 flash = vec4(
    max(live.rgb - idle.rgb, vec3(0.0)),
    max(live.a - idle.a, 0.0)
  );
  flash *= bgMask;
  prev *= bgMask;

  float moving = smoothstep(0.006, 0.045, length(uTiltVelocity));
  float decay = mix(1.0, 0.93, moving);
  vec4 decayed = prev * decay;

  vec4 persist = vec4(
    max(flash.rgb, decayed.rgb),
    max(flash.a, decayed.a)
  );

  outColor = clamp(persist, 0.0, 1.5);
}
`;

const SPARKLE_FRAGMENT_SHADER = `#version 300 es
${GLITTER_GLSL}

uniform sampler2D uTexture;
uniform sampler2D uOverlay;
uniform sampler2D uPersist;
uniform vec2 uTilt;
uniform float uViewAspect;
uniform float uTexAspect;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 uv = coverUv(vUv, uTexAspect, uViewAspect);

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.0);
    return;
  }

  float bgMask = sparkleRegionMask(uv, uTexture, uOverlay);
  vec4 idle = holoGlitterBase(uv) * bgMask;
  vec4 persist = texture(uPersist, vUv) * bgMask;
  vec4 glitter = vec4(
    idle.rgb + persist.rgb,
    clamp(idle.a + persist.a, 0.0, 1.0)
  );

  outColor = vec4(glitter.rgb, glitter.a);
}
`;

type Vec2 = { x: number; y: number };

type PersistTargets = {
  read: { texture: WebGLTexture; fbo: WebGLFramebuffer };
  write: { texture: WebGLTexture; fbo: WebGLFramebuffer };
};

export function isAtragraphHoloGlitterSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return !!canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
}

export class AtragraphHoloRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly persistProgram: WebGLProgram;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private readonly persistUniforms: Record<string, WebGLUniformLocation | null>;
  private readonly quad: WebGLVertexArrayObject;
  private readonly persistQuad: WebGLVertexArrayObject;
  private persistTargets: PersistTargets | null = null;
  private texture: WebGLTexture | null = null;
  private overlayTexture: WebGLTexture | null = null;
  private texAspect = 1;
  private viewAspect = 1;
  private pixelWidth = 1;
  private pixelHeight = 1;
  private tilt: Vec2 = { x: 0, y: 0 };
  private targetTilt: Vec2 = { x: 0, y: 0 };
  private tiltVelocity: Vec2 = { x: 0, y: 0 };
  private prevTilt: Vec2 = { x: 0, y: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL2 is required for atragraph holo glitter.');
    }
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.program = this.createProgram(VERTEX_SHADER, SPARKLE_FRAGMENT_SHADER);
    this.persistProgram = this.createProgram(VERTEX_SHADER, PERSIST_FRAGMENT_SHADER);
    this.uniforms = {
      texture: gl.getUniformLocation(this.program, 'uTexture'),
      overlay: gl.getUniformLocation(this.program, 'uOverlay'),
      persist: gl.getUniformLocation(this.program, 'uPersist'),
      tilt: gl.getUniformLocation(this.program, 'uTilt'),
      viewAspect: gl.getUniformLocation(this.program, 'uViewAspect'),
      texAspect: gl.getUniformLocation(this.program, 'uTexAspect'),
    };
    this.persistUniforms = {
      prevPersist: gl.getUniformLocation(this.persistProgram, 'uPrevPersist'),
      texture: gl.getUniformLocation(this.persistProgram, 'uTexture'),
      overlay: gl.getUniformLocation(this.persistProgram, 'uOverlay'),
      tilt: gl.getUniformLocation(this.persistProgram, 'uTilt'),
      tiltVelocity: gl.getUniformLocation(this.persistProgram, 'uTiltVelocity'),
      viewAspect: gl.getUniformLocation(this.persistProgram, 'uViewAspect'),
      texAspect: gl.getUniformLocation(this.persistProgram, 'uTexAspect'),
    };
    this.quad = this.createQuad(this.program);
    this.persistQuad = this.createQuad(this.persistProgram);
  }

  async loadTextures(baseUrl: string, overlayUrl: string): Promise<void> {
    const [baseImage, overlayImage] = await Promise.all([
      loadImage(baseUrl),
      loadImage(overlayUrl),
    ]);
    this.texAspect = baseImage.width / baseImage.height;
    const gl = this.gl;

    const uploadTexture = (image: HTMLImageElement): WebGLTexture => {
      const texture = gl.createTexture();
      if (!texture) {
        throw new Error('Failed to create WebGL texture.');
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      return texture;
    };

    this.texture = uploadTexture(baseImage);
    this.overlayTexture = uploadTexture(overlayImage);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  setSize(width: number, height: number): void {
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));

    if (pixelWidth === this.pixelWidth && pixelHeight === this.pixelHeight) {
      return;
    }

    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    this.viewAspect = pixelWidth / pixelHeight;
    this.createPersistTargets(pixelWidth, pixelHeight);
  }

  setTargetTilt(tilt: Vec2): void {
    this.targetTilt = tilt;
  }

  renderFrame(): void {
    if (!this.texture || !this.overlayTexture || !this.persistTargets) return;

    this.tilt.x += (this.targetTilt.x - this.tilt.x) * 0.08;
    this.tilt.y += (this.targetTilt.y - this.tilt.y) * 0.08;

    this.tiltVelocity.x = (this.tilt.x - this.prevTilt.x) * 1.4 + this.tiltVelocity.x * 0.55;
    this.tiltVelocity.y = (this.tilt.y - this.prevTilt.y) * 1.4 + this.tiltVelocity.y * 0.55;
    this.prevTilt.x = this.tilt.x;
    this.prevTilt.y = this.tilt.y;

    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.persistTargets.write.fbo);
    gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
    gl.useProgram(this.persistProgram);
    gl.bindVertexArray(this.persistQuad);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.persistTargets.read.texture);
    gl.uniform1i(this.persistUniforms.prevPersist, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.persistUniforms.texture, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);
    gl.uniform1i(this.persistUniforms.overlay, 2);
    gl.uniform2f(this.persistUniforms.tilt, this.tilt.x, this.tilt.y);
    gl.uniform2f(this.persistUniforms.tiltVelocity, this.tiltVelocity.x, this.tiltVelocity.y);
    gl.uniform1f(this.persistUniforms.viewAspect, this.viewAspect || 1);
    gl.uniform1f(this.persistUniforms.texAspect, this.texAspect);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.swapPersistTargets();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.quad);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.texture, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);
    gl.uniform1i(this.uniforms.overlay, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.persistTargets.read.texture);
    gl.uniform1i(this.uniforms.persist, 2);
    gl.uniform2f(this.uniforms.tilt, this.tilt.x, this.tilt.y);
    gl.uniform1f(this.uniforms.viewAspect, this.viewAspect || 1);
    gl.uniform1f(this.uniforms.texAspect, this.texAspect);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.persistTargets) {
      gl.deleteFramebuffer(this.persistTargets.read.fbo);
      gl.deleteFramebuffer(this.persistTargets.write.fbo);
      gl.deleteTexture(this.persistTargets.read.texture);
      gl.deleteTexture(this.persistTargets.write.texture);
      this.persistTargets = null;
    }
    if (this.texture) {
      gl.deleteTexture(this.texture);
      this.texture = null;
    }
    if (this.overlayTexture) {
      gl.deleteTexture(this.overlayTexture);
      this.overlayTexture = null;
    }
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.persistProgram);
    gl.deleteVertexArray(this.quad);
    gl.deleteVertexArray(this.persistQuad);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader.');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader error';
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertex = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program.');
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? 'Unknown program error';
      throw new Error(`Program link error: ${info}`);
    }
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return program;
  }

  private createQuad(program: WebGLProgram): WebGLVertexArrayObject {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create buffer.');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create vertex array.');
    }
    gl.bindVertexArray(vao);
    const location = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private createPersistTargets(width: number, height: number): void {
    const gl = this.gl;

    if (this.persistTargets) {
      gl.deleteFramebuffer(this.persistTargets.read.fbo);
      gl.deleteFramebuffer(this.persistTargets.write.fbo);
      gl.deleteTexture(this.persistTargets.read.texture);
      gl.deleteTexture(this.persistTargets.write.texture);
    }

    const makeTarget = (): { texture: WebGLTexture; fbo: WebGLFramebuffer } => {
      const texture = gl.createTexture();
      if (!texture) {
        throw new Error('Failed to create persist texture.');
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

      const fbo = gl.createFramebuffer();
      if (!fbo) {
        throw new Error('Failed to create persist framebuffer.');
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Persistence framebuffer is incomplete.');
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return { texture, fbo };
    };

    this.persistTargets = {
      read: makeTarget(),
      write: makeTarget(),
    };
  }

  private swapPersistTargets(): void {
    if (!this.persistTargets) return;
    const temp = this.persistTargets.read;
    this.persistTargets.read = this.persistTargets.write;
    this.persistTargets.write = temp;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    image.src = url;
  });
}
