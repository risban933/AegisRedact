import { describe, it, expect } from 'vitest';
import {
  detectFormFields,
  type OCRWord
} from '../../src/lib/ocr/form-detector';
import {
  detectFormType,
  enhanceWithTemplate,
  type FormTemplate
} from '../../src/lib/ocr/form-templates';

describe('Form Detector', () => {
  // Mock OCR data representing a simple form
  const mockFormData: OCRWord[] = [
    // Field 1: Name (horizontal layout)
    { text: 'Name:', bbox: { x: 10, y: 10, width: 60, height: 20 }, confidence: 0.95 },
    { text: 'John', bbox: { x: 80, y: 10, width: 50, height: 20 }, confidence: 0.90 },
    { text: 'Doe', bbox: { x: 135, y: 10, width: 45, height: 20 }, confidence: 0.90 },

    // Field 2: SSN (horizontal layout)
    { text: 'SSN:', bbox: { x: 10, y: 40, width: 50, height: 20 }, confidence: 0.95 },
    { text: '123-45-6789', bbox: { x: 70, y: 40, width: 110, height: 20 }, confidence: 0.92 },

    // Field 3: Email (vertical layout)
    { text: 'Email', bbox: { x: 10, y: 70, width: 60, height: 20 }, confidence: 0.94 },
    { text: 'john@example.com', bbox: { x: 10, y: 95, width: 150, height: 20 }, confidence: 0.93 },

    // Field 4: Phone (horizontal layout)
    { text: 'Phone:', bbox: { x: 10, y: 125, width: 70, height: 20 }, confidence: 0.96 },
    { text: '555-1234', bbox: { x: 90, y: 125, width: 80, height: 20 }, confidence: 0.91 }
  ];

  describe('Field Detection', () => {
    it('should detect form fields from OCR words', () => {
      const fields = detectFormFields(mockFormData);

      expect(fields.length).toBeGreaterThan(0);
    });

    it('should detect field labels', () => {
      const fields = detectFormFields(mockFormData);

      const labels = fields.map(f => f.label.toLowerCase());
      expect(labels.some(l => l.includes('name'))).toBe(true);
      expect(labels.some(l => l.includes('ssn'))).toBe(true);
    });

    it('should extract field values', () => {
      const fields = detectFormFields(mockFormData);

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.value.trim().length > 0)).toBe(true);
    });

    it('should identify field types', () => {
      const fields = detectFormFields(mockFormData);

      const types = fields.map(f => f.type);
      expect(types).toContain('name');
      expect(types).toContain('ssn');
    });

    it('should generate bounding boxes for fields', () => {
      const fields = detectFormFields(mockFormData);

      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].bbox).toHaveProperty('x');
      expect(fields[0].bbox).toHaveProperty('y');
      expect(fields[0].bbox).toHaveProperty('width');
      expect(fields[0].bbox).toHaveProperty('height');
    });

    it('should assign confidence scores', () => {
      const fields = detectFormFields(mockFormData);

      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].confidence).toBeGreaterThan(0);
      expect(fields[0].confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Spatial Proximity', () => {
    it('should detect horizontal field layout (label left, value right)', () => {
      const horizontalData: OCRWord[] = [
        { text: 'Name:', bbox: { x: 10, y: 10, width: 60, height: 20 }, confidence: 0.95 },
        { text: 'John', bbox: { x: 80, y: 10, width: 50, height: 20 }, confidence: 0.90 }
      ];

      const fields = detectFormFields(horizontalData);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should detect vertical field layout (label above, value below)', () => {
      const verticalData: OCRWord[] = [
        { text: 'Email:', bbox: { x: 10, y: 10, width: 60, height: 20 }, confidence: 0.95 },
        { text: 'john@example.com', bbox: { x: 10, y: 40, width: 150, height: 20 }, confidence: 0.93 }
      ];

      const fields = detectFormFields(verticalData);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should combine multi-word values', () => {
      const multiWordData: OCRWord[] = [
        { text: 'Name:', bbox: { x: 10, y: 10, width: 60, height: 20 }, confidence: 0.95 },
        { text: 'John', bbox: { x: 80, y: 10, width: 50, height: 20 }, confidence: 0.90 },
        { text: 'Smith', bbox: { x: 135, y: 10, width: 55, height: 20 }, confidence: 0.90 }
      ];

      const fields = detectFormFields(multiWordData);
      expect(fields.length).toBeGreaterThan(0);

      const nameField = fields.find(f => f.type === 'name');
      if (nameField) {
        expect(nameField.value).toContain('John');
        expect(nameField.value).toContain('Smith');
      }
    });
  });

  describe('Form Type Detection', () => {
    it('should detect W-2 form', () => {
      const w2Text = 'Form W-2 Wage and Tax Statement Employee SSN 123-45-6789';
      const formType = detectFormType(w2Text);

      expect(formType).toBeDefined();
      expect(formType?.name).toBe('W-2');
    });

    it('should detect I-9 form', () => {
      const i9Text = 'Form I-9 Employment Eligibility Verification';
      const formType = detectFormType(i9Text);

      expect(formType).toBeDefined();
      expect(formType?.name).toBe('I-9');
    });

    it('should detect medical forms', () => {
      const medicalText = 'Patient Information Medical History HIPAA';
      const formType = detectFormType(medicalText);

      expect(formType).toBeDefined();
      expect(formType?.name).toBe('Medical Intake');
    });

    it('should return null for unknown form types', () => {
      const randomText = 'This is just random text with no form keywords';
      const formType = detectFormType(randomText);

      expect(formType).toBeNull();
    });
  });

  describe('Template Enhancement', () => {
    it('should boost confidence for fields matching template', () => {
      const w2Template: FormTemplate = {
        name: 'W-2',
        description: 'Wage and Tax Statement',
        keywords: ['w-2', 'wage'],
        fields: [
          { label: 'Employee SSN', type: 'ssn', required: true, aliases: ['ssn', 'social security'] }
        ]
      };

      const detectedFields = [
        {
          label: 'SSN',
          value: '123-45-6789',
          type: 'ssn' as const,
          confidence: 0.7,
          bbox: { x: 0, y: 0, width: 100, height: 20 }
        }
      ];

      const enhanced = enhanceWithTemplate(detectedFields, w2Template);

      // Confidence should be boosted
      expect(enhanced[0].confidence).toBeGreaterThan(0.7);
    });

    it('should not reduce confidence for non-matching fields', () => {
      const template: FormTemplate = {
        name: 'Test',
        description: 'Test Form',
        keywords: ['test'],
        fields: [
          { label: 'Name', type: 'name', required: true, aliases: ['name'] }
        ]
      };

      const detectedFields = [
        {
          label: 'SSN',  // Not in template
          value: '123-45-6789',
          type: 'ssn' as const,
          confidence: 0.8,
          bbox: { x: 0, y: 0, width: 100, height: 20 }
        }
      ];

      const enhanced = enhanceWithTemplate(detectedFields, template);

      // Confidence should remain the same
      expect(enhanced[0].confidence).toBe(0.8);
    });
  });


  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const fields = detectFormFields([]);
      expect(fields).toBeDefined();
      expect(fields.length).toBe(0);
    });

    it('should handle words with no recognizable labels', () => {
      const randomData: OCRWord[] = [
        { text: 'Random', bbox: { x: 10, y: 10, width: 60, height: 20 }, confidence: 0.95 },
        { text: 'Text', bbox: { x: 80, y: 10, width: 50, height: 20 }, confidence: 0.90 }
      ];

      const fields = detectFormFields(randomData);
      // Should handle gracefully without errors
      expect(fields).toBeDefined();
    });

    it('should handle overlapping bounding boxes', () => {
      const overlappingData: OCRWord[] = [
        { text: 'Name:', bbox: { x: 10, y: 10, width: 100, height: 20 }, confidence: 0.95 },
        { text: 'John', bbox: { x: 50, y: 10, width: 50, height: 20 }, confidence: 0.90 }  // Overlaps
      ];

      const fields = detectFormFields(overlappingData);
      expect(fields).toBeDefined();
    });

    it('should handle very low confidence words', () => {
      const lowConfidenceData: OCRWord[] = [
        { text: 'Name:', bbox: { x: 10, y: 10, width: 60, height: 20 }, confidence: 0.30 },
        { text: 'John', bbox: { x: 80, y: 10, width: 50, height: 20 }, confidence: 0.25 }
      ];

      const fields = detectFormFields(lowConfidenceData);
      // Should still process but may filter by confidence
      expect(fields).toBeDefined();
    });
  });
});
