import { Color3, MeshBuilder, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import { CRATE_CHUNKS } from './effects';
import { casingOpacity, stepCasing, type CasingState } from './casingMotion';

interface Chunk {
  readonly mesh: Mesh;
  state: CasingState;
  readonly spinAxis: Vector3;
  spin: number;
  age: number;
  /** Rest height: half its (scaled) size. */
  rest: number;
}

/**
 * A crate breaking apart (M6-4, plan D14): pooled wooden chunks thrown out and
 * up from the crate, tumbling, bouncing once, then lying a moment and fading.
 * Same flight math as casings (`stepCasing`). Render-only, not collidable.
 */
export class CrateChunks {
  private readonly chunks: Chunk[];
  private next = 0;
  private readonly random = Math.random;

  constructor(scene: Scene) {
    const material = new StandardMaterial('crate-chunk-mat', scene);
    material.diffuseColor = new Color3(...CRATE_CHUNKS.colour);
    material.specularColor = Color3.Black();
    this.chunks = Array.from({ length: CRATE_CHUNKS.pool }, (_, i): Chunk => {
      const mesh = MeshBuilder.CreateBox(`crate-chunk-${i}`, { size: 1 }, scene);
      mesh.material = material;
      mesh.isPickable = false;
      mesh.rotationQuaternion = Quaternion.Identity();
      mesh.setEnabled(false);
      return {
        mesh,
        state: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, bounces: 0, resting: true },
        spinAxis: new Vector3(1, 0, 0),
        spin: 0,
        age: Number.POSITIVE_INFINITY,
        rest: 0.1,
      };
    });
  }

  /** A crate of `width` × `depth` × `height` centred at Babylon (`x`, `z`) breaks. */
  burst(x: number, z: number, width: number, depth: number, height: number): void {
    for (let i = 0; i < CRATE_CHUNKS.count; i++) {
      const chunk = this.chunks[this.next];
      if (chunk === undefined) {
        return;
      }
      this.next = (this.next + 1) % this.chunks.length;
      const size = this.between(CRATE_CHUNKS.size);
      const angle = this.random() * Math.PI * 2;
      const out = this.between(CRATE_CHUNKS.out);
      chunk.mesh.scaling.setAll(size);
      chunk.rest = size / 2;
      chunk.state = {
        x: x + (this.random() - 0.5) * width * 0.6,
        y: height * (0.3 + 0.5 * this.random()),
        z: z + (this.random() - 0.5) * depth * 0.6,
        vx: Math.sin(angle) * out,
        vy: this.between(CRATE_CHUNKS.up),
        vz: Math.cos(angle) * out,
        bounces: 0,
        resting: false,
      };
      chunk.spinAxis.set(this.random() - 0.5, this.random() - 0.5, this.random() - 0.5).normalize();
      chunk.spin = CRATE_CHUNKS.spin * (0.5 + this.random());
      chunk.age = 0;
      chunk.mesh.visibility = 1;
      chunk.mesh.setEnabled(true);
    }
  }

  update(frameSeconds: number): void {
    for (const chunk of this.chunks) {
      if (!chunk.mesh.isEnabled()) {
        continue;
      }
      chunk.age += frameSeconds;
      const before = chunk.state;
      chunk.state = stepCasing(before, frameSeconds, {
        ...CRATE_CHUNKS.physics,
        restHeight: chunk.rest,
      });
      const { mesh, state } = chunk;
      mesh.position.set(state.x, state.y, state.z);
      if (state.bounces > before.bounces) {
        chunk.spin *= 0.4;
      }
      if (!state.resting) {
        const turn = Quaternion.RotationAxis(chunk.spinAxis, chunk.spin * frameSeconds);
        mesh.rotationQuaternion = turn.multiply(mesh.rotationQuaternion ?? Quaternion.Identity());
      }
      mesh.visibility = casingOpacity(chunk.age, CRATE_CHUNKS.lie, CRATE_CHUNKS.fade);
      if (mesh.visibility === 0) {
        mesh.setEnabled(false);
      }
    }
  }

  clear(): void {
    for (const chunk of this.chunks) {
      chunk.mesh.setEnabled(false);
    }
  }

  dispose(): void {
    for (const chunk of this.chunks) {
      chunk.mesh.dispose();
    }
  }

  private between([low, high]: readonly [number, number]): number {
    return low + this.random() * (high - low);
  }
}
