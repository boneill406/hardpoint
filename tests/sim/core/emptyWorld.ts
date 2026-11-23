import type { SimQueries } from '../../../src/sim/core/SimQueries';

/** A `SimQueries` with nothing in it, for controller tests that don't look at the world. */
export const EMPTY_WORLD: SimQueries = {
  vehicles: () => [],
  vehicle: () => undefined,
  lineOfSight: () => true,
  findPath: (_from, to) => [to],
  navGrid: undefined,
};
