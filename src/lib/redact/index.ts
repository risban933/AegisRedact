/**
 * Redaction styles module
 */

export * from './styles';
export * from './renderers';

// Auto-register all built-in styles
import { StyleRegistry } from './styles';
import { SolidRedactionStyle } from './renderers/solid';
import { PatternRedactionStyle } from './renderers/pattern';
import { TextRedactionStyle } from './renderers/text';

// Register styles on module load
StyleRegistry.register(new SolidRedactionStyle());
StyleRegistry.register(new PatternRedactionStyle());
StyleRegistry.register(new TextRedactionStyle());

// Set solid as default
StyleRegistry.setDefault('solid');
