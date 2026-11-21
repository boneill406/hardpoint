import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Projectile } from '../../sim/combat/Projectile';
import type { WeaponDef } from '../../sim/combat/WeaponDef';
import type { Transform } from '../../sim/core/Transform';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView } from './EntityView';

type Look = WeaponDef['projectile']['look'];

/** Height (u) shots fly at: the barrel's height on the primitive tank. Cosmetic; the sim is planar. */
const FLIGHT_HEIGHT = 0.87;

/** Shell proportions after the prototype's (body, pointed nose, driving band), in u. */
const SHELL = { diameter: 0.12, body: 0.24, nose: 0.12, band: 0.04 };
/** The MG tracer: a thin self-lit rod. */
const TRACER = { width: 0.05, length: 0.4 };

/**
 * Motion streak: a fading trail covering how far the shot moved on screen
 * since the last frame, so a fast shot reads as one moving object instead of
 * a row of copies (the eye holds each frame; a shell moving ~3× its own length
 * per frame strobes). Tracers get half (Brendan: full-length MG streaks
 * crowded the stream). Capped so slow frame rates don't draw absurd trails.
 */
const STREAK: Readonly<Record<Look, { scale: number; maxLength: number; opacity: number }>> = {
  shell: { scale: 1, maxLength: 3, opacity: 0.35 },
  tracer: { scale: 0.5, maxLength: 1, opacity: 0.5 },
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
  /** Where the tip was drawn last frame; the streak covers the gap. */
  private lastTip: Vec2 | undefined;

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
    // A unit-length box stretched each frame to the frame's travel.
    this.streak = MeshBuilder.CreateBox(
      `${name}-streak`,
      { width: look === 'shell' ? SHELL.diameter * 0.7 : TRACER.width, height: 0.04, depth: 1 },
      scene,
    );
    this.streak.material = this.materials.streak[look];
    this.streak.isPickable = false;
    this.streak.parent = this.root;
  }

  update(transform: Transform): void {
    const { position, heading } = transform;
    const forward = Vec2.fromHeading(heading);
    const tip = position.add(forward.scale(this.projectile.weapon.projectile.radius));
    this.root.position = toBabylonPosition(tip, FLIGHT_HEIGHT);
    this.root.rotation.y = toBabylonRotationY(heading);
    this.updateStreak(tip);
  }

  dispose(): void {
    // Materials are shared; keep them for the next shot.
    this.root.dispose(false, false);
  }

  /**
   * Stretch the trail behind the tip over how far it moved on screen since the
   * last frame (not from the sim velocity: a shot that has hit is parked with
   * zero velocity while the view still carries it the last stretch to the
   * surface). Never reaches back past the muzzle.
   */
  private updateStreak(tip: Vec2): void {
    const { scale, maxLength } = STREAK[this.look];
    const moved = this.lastTip === undefined ? 0 : tip.distanceTo(this.lastTip);
    this.lastTip = tip;
    const travelled = tip.distanceTo(this.projectile.origin);
    const length = Math.min(moved * scale, maxLength, travelled);
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
  }

  /** Lays a cylinder (built along y) along the flight axis (+z), centred at `z`. */
  private alongFlight(mesh: Mesh, z: number): void {
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z;
    mesh.isPickable = false;
    mesh.parent = this.root;
  }
}
