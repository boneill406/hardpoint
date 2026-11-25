import { describe, expect, it } from 'vitest';
import { MenuNavigator } from '../../src/ui/MenuNavigator';

describe('MenuNavigator', () => {
  it('starts on the first item and wraps both ways', () => {
    const menu = new MenuNavigator(3);
    expect(menu.index).toBe(0);
    menu.move(-1);
    expect(menu.index).toBe(2);
    menu.move(1);
    expect(menu.index).toBe(0);
    menu.move(4);
    expect(menu.index).toBe(1);
  });

  it('hover sets the item; out of range is ignored; reset goes back to the first', () => {
    const menu = new MenuNavigator(2);
    menu.set(1);
    expect(menu.index).toBe(1);
    menu.set(5);
    expect(menu.index).toBe(1);
    menu.reset(3);
    expect(menu.index).toBe(0);
  });

  it('an empty menu stays at 0', () => {
    const menu = new MenuNavigator(0);
    menu.move(1);
    expect(menu.index).toBe(0);
  });
});
