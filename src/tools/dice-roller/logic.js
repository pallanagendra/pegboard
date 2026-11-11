import { randomInt } from '../../assets/js/random-core.js';

export const SIDES = [4, 6, 8, 10, 12, 20, 100];
export const MAX_DICE = 50;

/** Roll `count` dice with `sides` faces and add `modifier` to the total. */
export function rollDice({ count = 1, sides = 6, modifier = 0 }, next) {
  count = Number(count);
  sides = Number(sides);
  modifier = Number(modifier) || 0;
  if (!Number.isInteger(count) || count < 1) return { error: 'Roll at least 1 die.' };
  if (count > MAX_DICE) return { error: `You can roll up to ${MAX_DICE} dice at once.` };
  if (!SIDES.includes(sides)) return { error: 'Pick a type of die.' };
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 1000) return { error: 'The modifier should be a whole number between −1000 and 1000.' };
  const rolls = Array.from({ length: count }, () => randomInt(1, sides, next));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, sum, total: sum + modifier, count, sides, modifier };
}

/** Standard dice notation: 2d6, 1d20+5, 3d8−2. */
export function notation({ count, sides, modifier = 0 }) {
  return `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `−${Math.abs(modifier)}` : ''}`;
}

/** "4 + 3 + 5 = 12", or "17 + 5 = 22" for one die with a modifier. */
export function breakdown({ rolls, modifier = 0, total }) {
  const parts = rolls.map(String);
  if (modifier) parts.push(modifier > 0 ? `${modifier}` : `(−${Math.abs(modifier)})`);
  if (parts.length === 1) return `${total}`;
  return `${parts.join(' + ')} = ${total}`;
}

/** Lowest and highest possible totals, and the average. */
export function range({ count, sides, modifier = 0 }) {
  return { min: count + modifier, max: count * sides + modifier, average: (count * (sides + 1)) / 2 + modifier };
}

/** Pip positions on a 3×3 grid for a six-sided die face (0 = top-left … 8 = bottom-right). */
export const PIPS = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
