/**
 * Damage and health as shown on screen: rounded to one decimal, with whole
 * numbers plain (32.5, 3, 62.5, 100). One formatter for the HUD, the health
 * bars and the damage numbers, so the same value never reads differently in
 * two places. Rounds first, so float noise (24.999999) shows as 25, not 25.0.
 */
export function amountLabel(amount: number): string {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
