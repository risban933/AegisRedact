/**
 * Layer system types
 */

import type { Box } from '../pdf/find';

/**
 * Redaction layer model
 */
export interface RedactionLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0-1 (for preview only, exports at 1.0)
  boxes: Map<number, Box[]>; // Page number -> Boxes on that page
  createdAt: Date;
  modifiedAt: Date;
  color?: string; // Optional color coding for UI
}

/**
 * Layer creation options
 */
export interface CreateLayerOptions {
  name?: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  color?: string;
}

/**
 * Layer event types
 */
export type LayerEvent =
  | { type: 'layer-created'; layerId: string }
  | { type: 'layer-deleted'; layerId: string }
  | { type: 'layer-renamed'; layerId: string; oldName: string; newName: string }
  | { type: 'layer-moved'; layerId: string; oldIndex: number; newIndex: number }
  | { type: 'layer-visibility-changed'; layerId: string; visible: boolean }
  | { type: 'layer-lock-changed'; layerId: string; locked: boolean }
  | { type: 'active-layer-changed'; oldLayerId: string; newLayerId: string }
  | { type: 'boxes-modified'; layerId: string; page: number };

export type LayerEventListener = (event: LayerEvent) => void;
