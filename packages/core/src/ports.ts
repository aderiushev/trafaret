export const PORT_TYPES = ['text', 'image'] as const;
export type PortType = (typeof PORT_TYPES)[number];
