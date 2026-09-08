import type { Politician } from './types.js'

/**
 * The single gate on what reaches players. Shared by the Node content loader
 * and the browser bundle so the app and the balance harness never disagree
 * about which figures are in the game.
 */
export function shippable(all: Politician[]): Politician[] {
  return all.filter((p) => p.reviewed)
}
