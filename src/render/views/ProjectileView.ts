import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  VertexBuffer,
} from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Projectile } from '../../sim/combat/Projectile';
import type { WeaponDef } from '../../sim/combat/WeaponDef';
import type { Transform } from '../../sim/core/Transform';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView } from './EntityView';

type Look = WeaponDef['projectile']['look'];

/**
 * Height (u) each kind of shot flies at: its barrel's height on the primitive
 * tank (cannon 0.87, the lower coaxial MG 0.82). Cosmetic; the sim is planar.
 */
export const FLIGHT_HEIGHT: Readonly<Record<Look, number>> = { shell: 0.87, tracer: 0.82 };

/** Shell proportions after the prototype's (body, pointed nose, driving band), in u. */
const SHELL = { diameter: 0.12, body: 0.24, nose: 0.12, band: 0.04 };
/** The MG tracer: a thin self-lit rod. */
const TRACER = { width: 0.035, length: 0.35 };

/**
 * Motion streak: a fixed-length trail behind each shot, fading from `opacity`
 * at the tip to nothing at the tail, so a fast shot reads as one moving object
 * instead of a row of copies (the eye holds each frame).
 *
 * - Fixed rather than per-frame travel: frame times wobble, and a streak whose
 *   length pulses with them reads as stutter.
 * - Longer than one 60 fps frame of travel (cannon 1.5 u, MG 1.7 u), so each
 *   frame's streak reaches back over the last frame's tip. Shorter, and the
 *   round visibly jumps across a gap every frame (Brendan: the MG "laggy"
 *   once it went to 100 u/s).
 * - The fade keeps the longer streak from reading as a solid bar, so rounds
 *   8 u apart (12/s at 100 u/s) don't look joined.
 */
const STREAK: Readonly<Record<Look, { length: number; opacity: number }>> = {
  shell: { length: 2.0, opacity: 0.5 },
  tracer: { length: 2.4, opacity: 0.75 },
};

interface Materials {
  readonly shell: StandardMaterial;
  readonly band: StandardMaterial;
  readonly nose: StandardMaterial;
  readonly tracer: StandardMaterial;
  readonly streak: Readonly<Record<Look, StandardMaterial>>;
}

/** Shared per scene: the MG fires 10 rounds a second, so don't make materials per shot. */
const sharedMaterials = new WeakMap<Scene, Materials>();

function materialsFor(scene: Scene): Materials {
  const existing = sharedMaterials.get(scene);
  if (existing !== undefined) {
    return existing;
  }
  const solid = (name: string, hex: string): StandardMaterial => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = Color3.FromHexString(hex);
    material.specularColor = new Color3(0.3, 0.3, 0.3);
    return material;
  };
  const glowing = (name: string, hex: string, alpha: number): StandardMaterial => {
    const material = new StandardMaterial(name, scene);
    material.emissiveColor = Color3.FromHexString(hex);
    material.disableLighting = true;
    material.alpha = alpha;
    return material;
  };
  const materials: Materials = {
    // Olive drab body, dark steel band, steel nose (Brendan: darker than the first brass).
    shell: solid('shell-mat', '#4b5320'),
    band: solid('shell-band-mat', '#2b2f2e'),
    nose: solid('shell-nose-mat', '#6b7270'),
    tracer: glowing('tracer-mat', '#ffc46b', 1),
    streak: {
      shell: glowing('shell-streak-mat', '#c9c9b8', STREAK.shell.opacity),
      tracer: glowing('tracer-streak-mat', '#ffb04a', STREAK.tracer.opacity),
    },
  };
  sharedMaterials.set(scene, materials);
  return materials;
}

/**
 * Gives a unit box built along z a per-vertex alpha: opaque at its front
 * (+z, the tip) and transparent at its back, so the streak fades out behind
 * the shot. The material's alpha scales the whole thing.
 */
function fadeTowardTail(mesh: Mesh): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const colors: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const z = positions[i + 2] ?? 0;
    colors.push(1, 1, 1, z > 0 ? 1 : 0);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  mesh.hasVertexAlpha = true;
}

/**
 * A shell or tracer in flight (M3-3). Built pointing along +z with its tip at
 * the origin of `root`, which sits at the front of the sim's collision circle,
 * so a shot that hits ends with its tip on the surface. Smoke trails and
 * impact sparks come with the juice pass (M6).
 */
export class ProjectileView implements EntityView {
  private readonly root: TransformNode;
  private readonly streak: Mesh;
  private readonly materials: Materials;
  private readonly look: Look;
  /** The tracer's rod, clipped so it never reaches back past the muzzle. */
  private rod: Mesh | undefined;

  constructor(
    scene: Scene,
    name: string,
    private readonly projectile: Projectile,
  ) {
    this.materials = materialsFor(scene);
    this.root = new TransformNode(name, scene);
    const look = projectile.weapon.projectile.look;
    this.look = look;
    if (look === 'shell') {
      this.buildShell(scene, name);
    } else {
      this.buildTracer(scene, name);
    }
    // A unit-length box, scaled to the streak's length each frame.
    this.streak = MeshBuilder.CreateBox(
      `${name}-streak`,
      { width: look === 'shell' ? SHELL.diameter * 0.7 : TRACER.width, height: 0.04, depth: 1 },
      scene,
    );
    this.streak.material = this.materials.streak[look];
    this.streak.isPickable = false;
    fadeTowardTail(this.streak);
    this.streak.parent = this.root;
  }

  update(transform: Transform): void {
    const tip = this.tipAt(transform.position, transform.heading);
    this.root.position = toBabylonPosition(tip, FLIGHT_HEIGHT[this.look]);
    this.root.rotation.y = toBabylonRotationY(transform.heading);
    const sinceMuzzle = tip.distanceTo(this.tipAt(this.projectile.origin, transform.heading));
    this.clipRod(sinceMuzzle);
    this.updateStreak(sinceMuzzle);
  }

  /** The front of the sim's collision circle: where the shot's tip is drawn. */
  private tipAt(centre: Vec2, heading: number): Vec2 {
    return centre.add(Vec2.fromHeading(heading).scale(this.projectile.weapon.projectile.radius));
  }

  /** A tracer just out of the barrel shows only the part that has left it, not a rod over the turret. */
  private clipRod(sinceMuzzle: number): void {
    if (this.rod === undefined) {
      return;
    }
    const length = Math.max(0.001, Math.min(TRACER.length, sinceMuzzle));
    this.rod.scaling.z = length / TRACER.length;
    this.rod.position.z = -length / 2;
  }

  dispose(): void {
    // Materials are shared; keep them for the next shot.
    this.root.dispose(false, false);
  }

  /** The trail behind the tip: a fixed length, but never reaching back past the muzzle. */
  private updateStreak(sinceMuzzle: number): void {
    const length = Math.min(STREAK[this.look].length, sinceMuzzle);
    this.streak.isVisible = length > 0.01;
    this.streak.scaling.z = Math.max(length, 0.01);
    this.streak.position.z = -length / 2;
  }

  /** Body, pointed nose and a darker driving band, like the prototype's shell. */
  private buildShell(scene: Scene, name: string): void {
    const body = MeshBuilder.CreateCylinder(
      `${name}-body`,
      { diameter: SHELL.diameter, height: SHELL.body, tessellation: 10 },
      scene,
    );
    body.material = this.materials.shell;
    this.alongFlight(body, -SHELL.nose - SHELL.body / 2);

    const nose = MeshBuilder.CreateCylinder(
      `${name}-nose`,
      { diameterTop: 0, diameterBottom: SHELL.diameter, height: SHELL.nose, tessellation: 10 },
      scene,
    );
    nose.material = this.materials.nose;
    this.alongFlight(nose, -SHELL.nose / 2);

    const band = MeshBuilder.CreateCylinder(
      `${name}-band`,
      { diameter: SHELL.diameter * 1.1, height: SHELL.band, tessellation: 10 },
      scene,
    );
    band.material = this.materials.band;
    this.alongFlight(band, -SHELL.nose - SHELL.body + SHELL.band * 1.5);
  }

  private buildTracer(scene: Scene, name: string): void {
    const rod = MeshBuilder.CreateBox(
      `${name}-rod`,
      { width: TRACER.width, height: TRACER.width, depth: TRACER.length },
      scene,
    );
    rod.material = this.materials.tracer;
    rod.isPickable = false;
    rod.parent = this.root;
    rod.position.z = -TRACER.length / 2;
    this.rod = rod;
  }

  /** Lays a cylinder (built along y) along the flight axis (+z), centred at `z`. */
  private alongFlight(mesh: Mesh, z: number): void {
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z;
    mesh.isPickable = false;
    mesh.parent = this.root;
  }
}
