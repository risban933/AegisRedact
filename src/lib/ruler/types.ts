/**
 * Ruler and guide types
 */

export interface Guide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number; // x or y coordinate in canvas space
  color: string;
}

export interface RulerOptions {
  width: number;
  height: number;
  scale: number;
  majorTickInterval: number; // pixels
  minorTickInterval: number; // pixels
  labelInterval: number; // pixels
}

export type GuideEventListener = (guides: Guide[]) => void;
