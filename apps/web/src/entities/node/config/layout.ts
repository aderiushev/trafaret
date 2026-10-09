/** Every node card has the same width, so new nodes can be centred and wires line up. */
export const NODE_CARD_WIDTH = 264;
/** Handles sit at fixed heights, so wires stay put when a card grows (for example when its output arrives). */
export const HANDLE_TOP = { first: 52, second: 88 } as const;
