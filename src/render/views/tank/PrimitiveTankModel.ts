import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
} from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Faction } from '../../../sim/vehicles/Faction';
import type { HullDef } from '../../../sim/vehicles/VehicleDef';
import type { TankModel, TreadSurface } from './TankModel';

// Proportions follow the prototype's tank (mantis_breach v0.1.0, tank.js), slimmed
// so everything, tracks included, fits the hull footprint from the def: the
// collision box (CLAUDE.md rule 5). Cosmetic sizes only; nothing here affects play.

const TRACK = { width: 0.36, height: 0.42 };
/** Tread pad repeat (u). Long enough not to strobe at full speed (see `treadBlur`). */
const TREAD_PERIOD = 0.4;
const HULL = { bodyHeight: 0.42, bodyBottom: 0.15, deckThickness: 0.14 };
const TURRET = { radius: 0.48, height: 0.3, stretch: 1.25 };
const BARREL = { radius: 0.07, length: 1.0 };

interface Palette {
  readonly armor: Color3;
  readonly armorLight: Color3;
  readonly armorDark: Color3;
  readonly track: Color3;
  readonly trackPad: Color3;
  readonly steel: Color3;
  readonly lamp: Color3;
}

const PALETTES: Readonly<Record<Faction, Palette>> = {
  // The prototype's olive drab.
  player: {
    armor: Color3.FromHexString('#526345'),
    armorLight: Color3.FromHexString('#788764'),
    armorDark: Color3.FromHexString('#354334'),
    track: Color3.FromHexString('#202729'),
    trackPad: Color3.FromHexString('#4a5250'),
    steel: Color3.FromHexString('#53605c'),
    lamp: Color3.FromHexString('#d0a33c'),
  },
  // Insurgent sand and rust (GDD §5).
  insurgent: {
    armor: Color3.FromHexString('#8a6a3e'),
    armorLight: Color3.FromHexString('#a88a58'),
    armorDark: Color3.FromHexString('#5a4528'),
    track: Color3.FromHexString('#2a2522'),
    trackPad: Color3.FromHexString('#57504a'),
    steel: Color3.FromHexString('#5f5a52'),
    lamp: Color3.FromHexString('#d06a3c'),
  },
};

/**
 * A tank built from Babylon primitives, to the prototype's design: broad low
 * hull with a sloped glacis, side tracks with rounded ends and scrolling tread
 * pads, a stretched hexagonal turret with hatch, mantlet, barrel and coaxial MG.
 */
export class PrimitiveTankModel implements TankModel {
  readonly root: TransformNode;
  readonly hull: TransformNode;
  readonly turret: TransformNode;
  readonly barrel: TransformNode;
  readonly leftTread: TreadSurface;
  readonly rightTread: TreadSurface;
  readonly halfTrackSpacing: number;
  readonly treadPeriod = TREAD_PERIOD;
  private readonly materials = new Map<string, StandardMaterial>();
  private readonly treadMaterials: StandardMaterial[] = [];
  private readonly textures: DynamicTexture[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly name: string,
    footprint: HullDef,
    faction: Faction,
    /** Turret pivot along the hull (u), from the vehicle def so sim muzzles and drawn barrels agree. */
    turretPivotForward: number,
  ) {
    const palette = PALETTES[faction];
    this.root = new TransformNode(name, scene);
    this.halfTrackSpacing = footprint.width / 2 - TRACK.width / 2;

    this.leftTread = this.buildTrack(-1, footprint, palette);
    this.rightTread = this.buildTrack(1, footprint, palette);

    // Pivot at the hull's middle so pitching tilts the hull over the tracks.
    this.hull = new TransformNode(`${name}-hull`, scene);
    this.hull.parent = this.root;
    this.hull.position.y = HULL.bodyBottom + HULL.bodyHeight / 2;
    this.buildHull(footprint, palette);

    this.turret = new TransformNode(`${name}-turret`, scene);
    this.turret.parent = this.hull;
    this.turret.position.set(0, HULL.bodyHeight / 2 + HULL.deckThickness, turretPivotForward);
    this.buildTurret(palette);

    this.barrel = new TransformNode(`${name}-barrel`, scene);
    this.barrel.parent = this.turret;
    this.barrel.position.set(0, 0.16, TURRET.radius * TURRET.stretch);
    this.buildBarrel(palette);
  }

  dispose(): void {
    // false: also dispose child meshes; materials and textures are tracked separately.
    this.root.dispose(false, false);
    for (const material of [...this.materials.values(), ...this.treadMaterials]) {
      material.dispose();
    }
    for (const texture of this.textures) {
      texture.dispose();
    }
  }

  private buildTrack(side: -1 | 1, footprint: HullDef, palette: Palette): TreadSurface {
    const x = side * this.halfTrackSpacing;
    const radius = TRACK.height / 2;
    const runLength = footprint.length - 2 * radius;
    const trackMat = this.material('track', palette.track);

    const body = this.box(
      'track-body',
      { width: TRACK.width, height: TRACK.height, depth: runLength },
      trackMat,
    );
    body.parent = this.root;
    body.position.set(x, radius, 0);
    for (const end of [-1, 1]) {
      // Drive sprocket and idler: cylinders across the track give it rounded ends.
      const wheel = MeshBuilder.CreateCylinder(
        `${this.name}-track-wheel`,
        { diameter: TRACK.height, height: TRACK.width, tessellation: 14 },
        this.scene,
      );
      wheel.material = trackMat;
      wheel.rotation.z = Math.PI / 2;
      wheel.parent = this.root;
      wheel.position.set(x, radius, end * (runLength / 2));
    }

    const surface = MeshBuilder.CreateGround(
      `${this.name}-tread`,
      { width: TRACK.width * 0.92, height: runLength },
      this.scene,
    );
    surface.parent = this.root;
    surface.position.set(x, TRACK.height + 0.004, 0);
    return this.treadSurface(surface, runLength, palette);
  }

  /** A tread pattern on the track's top run: dark base with lighter pads, repeating every period. */
  private treadSurface(surface: Mesh, runLength: number, palette: Palette): TreadSurface {
    const texture = new DynamicTexture(
      `${this.name}-tread-tex`,
      { width: 16, height: 64 },
      this.scene,
      true,
    );
    const context = texture.getContext();
    context.fillStyle = palette.track.toHexString();
    context.fillRect(0, 0, 16, 64);
    context.fillStyle = palette.trackPad.toHexString();
    context.fillRect(0, 8, 16, 34);
    texture.update();
    // DynamicTexture defaults to clamping; the pattern must tile along the track.
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.vScale = runLength / TREAD_PERIOD;
    this.textures.push(texture);

    // Its own material per track: each fades independently (`setBlur`).
    const material = new StandardMaterial(`${this.name}-tread-mat`, this.scene);
    material.diffuseTexture = texture;
    material.specularColor = Color3.Black();
    this.treadMaterials.push(material);
    surface.material = material;

    return {
      // The texture's v runs along +z; moving the pattern forward means reducing the offset.
      scrollTo: (distance) => {
        texture.vOffset = -distance / TREAD_PERIOD;
      },
      // Fading the pads out reveals the plain track underneath: a cheap motion blur.
      setBlur: (amount) => {
        material.alpha = 1 - 0.85 * amount;
      },
    };
  }

  private buildHull(footprint: HullDef, palette: Palette): void {
    const innerWidth = footprint.width - 2 * TRACK.width + 0.04;
    const lower = this.box(
      'hull-lower',
      { width: innerWidth, height: HULL.bodyHeight, depth: footprint.length * 0.92 },
      this.material('armor', palette.armor),
    );
    lower.parent = this.hull;

    const deckY = HULL.bodyHeight / 2 + HULL.deckThickness / 2;
    const deck = this.box(
      'hull-deck',
      { width: innerWidth + 0.1, height: HULL.deckThickness, depth: footprint.length * 0.72 },
      this.material('armor-light', palette.armorLight),
    );
    deck.parent = this.hull;
    deck.position.set(0, deckY, -0.08);

    // Sloped glacis plate across the nose.
    const glacis = this.box(
      'hull-glacis',
      { width: innerWidth + 0.06, height: 0.08, depth: 0.42 },
      this.material('armor', palette.armor),
    );
    glacis.parent = this.hull;
    glacis.position.set(0, deckY - 0.05, footprint.length * 0.36);
    glacis.rotation.x = 0.42; // front edge down (positive rotation.x = nose down)

    const dark = this.material('armor-dark', palette.armorDark);
    const engineDeck = this.box(
      'hull-engine-deck',
      { width: innerWidth * 0.75, height: 0.06, depth: 0.32 },
      dark,
    );
    engineDeck.parent = this.hull;
    engineDeck.position.set(0, deckY + 0.08, -footprint.length * 0.38);

    const steel = this.material('steel', palette.steel);
    for (let i = -2; i <= 2; i++) {
      const vent = this.box('hull-vent', { width: 0.09, height: 0.05, depth: 0.24 }, steel);
      vent.parent = this.hull;
      vent.position.set(i * 0.13, deckY + 0.1, -footprint.length * 0.38);
    }

    const lamp = this.material('lamp', palette.lamp);
    lamp.emissiveColor = palette.lamp.scale(0.6);
    for (const side of [-1, 1]) {
      const light = this.box('hull-lamp', { width: 0.1, height: 0.06, depth: 0.1 }, lamp);
      light.parent = this.hull;
      light.position.set(side * innerWidth * 0.38, deckY + 0.04, footprint.length * 0.3);
    }
  }

  private buildTurret(palette: Palette): void {
    const dark = this.material('armor-dark', palette.armorDark);
    const ring = MeshBuilder.CreateCylinder(
      `${this.name}-turret-ring`,
      { diameter: TURRET.radius * 1.7, height: 0.1, tessellation: 16 },
      this.scene,
    );
    ring.material = dark;
    ring.parent = this.turret;
    ring.position.y = 0.05;

    const body = MeshBuilder.CreateCylinder(
      `${this.name}-turret-body`,
      { diameter: TURRET.radius * 2, height: TURRET.height, tessellation: 6 },
      this.scene,
    );
    body.material = this.material('armor', palette.armor);
    body.parent = this.turret;
    body.scaling.z = TURRET.stretch;
    body.position.y = 0.1 + TURRET.height / 2;

    const top = MeshBuilder.CreateCylinder(
      `${this.name}-turret-top`,
      { diameter: TURRET.radius * 1.45, height: 0.06, tessellation: 6 },
      this.scene,
    );
    top.material = this.material('armor-light', palette.armorLight);
    top.parent = this.turret;
    top.scaling.z = TURRET.stretch;
    top.position.y = 0.1 + TURRET.height + 0.03;

    const hatch = MeshBuilder.CreateCylinder(
      `${this.name}-turret-hatch`,
      { diameter: 0.26, height: 0.05, tessellation: 12 },
      this.scene,
    );
    hatch.material = dark;
    hatch.parent = this.turret;
    hatch.position.set(-0.14, 0.1 + TURRET.height + 0.08, -0.12);

    const mantlet = this.box('turret-mantlet', { width: 0.36, height: 0.22, depth: 0.2 }, dark);
    mantlet.parent = this.turret;
    mantlet.position.set(0, 0.26, TURRET.radius * TURRET.stretch - 0.02);
  }

  private buildBarrel(palette: Palette): void {
    const steel = this.material('steel', palette.steel);
    const tube = MeshBuilder.CreateCylinder(
      `${this.name}-barrel-tube`,
      { diameter: BARREL.radius * 2, height: BARREL.length, tessellation: 12 },
      this.scene,
    );
    tube.material = steel;
    tube.parent = this.barrel;
    tube.rotation.x = Math.PI / 2;
    tube.position.z = BARREL.length / 2;

    const brake = this.box(
      'barrel-brake',
      { width: 0.2, height: 0.17, depth: 0.14 },
      this.material('armor-dark', palette.armorDark),
    );
    brake.parent = this.barrel;
    brake.position.z = BARREL.length;

    // Coaxial machine gun, left of the cannon (as in the prototype).
    const coax = MeshBuilder.CreateCylinder(
      `${this.name}-coax`,
      { diameter: 0.07, height: 0.4, tessellation: 8 },
      this.scene,
    );
    coax.material = steel;
    coax.parent = this.barrel;
    coax.rotation.x = Math.PI / 2;
    coax.position.set(-0.2, -0.05, 0.1);
  }

  private box(
    part: string,
    size: { width: number; height: number; depth: number },
    material: StandardMaterial,
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(`${this.name}-${part}`, size, this.scene);
    mesh.material = material;
    return mesh;
  }

  /** One shared material per part role; matte, like the rest of the slice's placeholder look. */
  private material(role: string, color: Color3): StandardMaterial {
    const existing = this.materials.get(role);
    if (existing !== undefined) {
      return existing;
    }
    const material = new StandardMaterial(`${this.name}-${role}-mat`, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    this.materials.set(role, material);
    return material;
  }
}
