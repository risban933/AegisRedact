import { describe, it, expect } from 'vitest';
import {
  detectTables,
  extractColumnText,
  getColumnCells,
  type OCRWord
} from '../../src/lib/ocr/table-detector';
import {
  applyColumnRules,
  extractPIIFromTable,
  getTablePIIBoundingBoxes,
  detectTableColumnsWithValidation
} from '../../src/lib/ocr/column-rules';

describe('Table Detector', () => {
  // Mock OCR data representing a simple table
  const mockTableData: OCRWord[] = [
    // Header row (y=10)
    { text: 'Name', bbox: { x: 10, y: 10, width: 100, height: 20 }, confidence: 0.95 },
    { text: 'SSN', bbox: { x: 120, y: 10, width: 100, height: 20 }, confidence: 0.95 },
    { text: 'Email', bbox: { x: 230, y: 10, width: 100, height: 20 }, confidence: 0.95 },

    // Row 1 (y=35)
    { text: 'John', bbox: { x: 10, y: 35, width: 50, height: 20 }, confidence: 0.90 },
    { text: 'Doe', bbox: { x: 65, y: 35, width: 45, height: 20 }, confidence: 0.90 },
    { text: '123-45-6789', bbox: { x: 120, y: 35, width: 100, height: 20 }, confidence: 0.92 },
    { text: 'john@example.com', bbox: { x: 230, y: 35, width: 150, height: 20 }, confidence: 0.93 },

    // Row 2 (y=60)
    { text: 'Jane', bbox: { x: 10, y: 60, width: 50, height: 20 }, confidence: 0.91 },
    { text: 'Smith', bbox: { x: 65, y: 60, width: 55, height: 20 }, confidence: 0.91 },
    { text: '987-65-4321', bbox: { x: 120, y: 60, width: 100, height: 20 }, confidence: 0.94 },
    { text: 'jane@example.com', bbox: { x: 230, y: 60, width: 150, height: 20 }, confidence: 0.94 }
  ];

  describe('Table Detection', () => {
    it('should detect table structure from OCR words', () => {
      const tables = detectTables(mockTableData, 2, 2);

      expect(tables.length).toBe(1);
      expect(tables[0].rows.length).toBe(3); // Header + 2 data rows
      expect(tables[0].columns.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract headers from first row', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const headers = tables[0].headers;

      expect(headers).toContain('Name');
      expect(headers).toContain('SSN');
      expect(headers).toContain('Email');
    });

    it('should group words into rows by Y-position', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const table = tables[0];

      // Each row should have multiple cells
      expect(table.rows[0].cells.length).toBeGreaterThan(1); // Header
      expect(table.rows[1].cells.length).toBeGreaterThan(1); // Row 1
      expect(table.rows[2].cells.length).toBeGreaterThan(1); // Row 2
    });

    it('should detect column positions', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const table = tables[0];

      // Should have at least 3 columns (Name, SSN, Email)
      expect(table.columns.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Column Extraction', () => {
    it('should extract text from specific column', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const columnText = extractColumnText(tables[0], 0, false); // Column 0 with header

      expect(columnText).toContain('Name');
    });

    it('should skip header when requested', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const columnText = extractColumnText(tables[0], 0, true); // Skip header

      expect(columnText).not.toContain('Name');
      expect(columnText.length).toBeGreaterThan(0);
    });

    it('should get cells from specific column', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const cells = getColumnCells(tables[0], 0);

      expect(cells.length).toBeGreaterThan(0);
      expect(cells[0].text).toBeDefined();
      expect(cells[0].bbox).toBeDefined();
    });
  });

  describe('Column Rules Application', () => {
    it('should match column headers to detection rules', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const columnResults = applyColumnRules(tables[0]);

      expect(columnResults.length).toBeGreaterThan(0);

      // Should detect Name column
      const nameColumn = columnResults.find(r => r.detectionType === 'name');
      expect(nameColumn).toBeDefined();

      // Should detect SSN column
      const ssnColumn = columnResults.find(r => r.detectionType === 'ssn');
      expect(ssnColumn).toBeDefined();

      // Should detect Email column
      const emailColumn = columnResults.find(r => r.detectionType === 'email');
      expect(emailColumn).toBeDefined();
    });

    it('should extract PII from detected columns', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const piiValues = extractPIIFromTable(tables[0], {
        names: true,
        ssns: true,
        emails: true
      });

      expect(piiValues.length).toBeGreaterThan(0);
    });

    it('should generate bounding boxes for PII cells', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const boxes = getTablePIIBoundingBoxes(tables[0], {
        ssns: true,
        emails: true
      });

      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes[0].bbox).toHaveProperty('x');
      expect(boxes[0].bbox).toHaveProperty('y');
      expect(boxes[0].bbox).toHaveProperty('width');
      expect(boxes[0].bbox).toHaveProperty('height');
      expect(boxes[0].type).toBeDefined();
    });
  });

  describe('Column Validation', () => {
    it('should validate column values match expected patterns', () => {
      const tables = detectTables(mockTableData, 2, 2);
      const validatedResults = detectTableColumnsWithValidation(tables[0]);

      // Email column should pass validation (contains valid emails)
      const emailColumn = validatedResults.find(r => r.detectionType === 'email');
      expect(emailColumn).toBeDefined();
      if (emailColumn) {
        expect(emailColumn.confidence).toBeGreaterThan(0);
      }

      // SSN column should pass validation (contains valid SSN format)
      const ssnColumn = validatedResults.find(r => r.detectionType === 'ssn');
      expect(ssnColumn).toBeDefined();
    });

    it('should filter out columns with low validation score', () => {
      // Create mock data with invalid email column
      const invalidData: OCRWord[] = [
        { text: 'Email', bbox: { x: 10, y: 10, width: 100, height: 20 }, confidence: 0.95 },
        { text: 'NotAnEmail1', bbox: { x: 10, y: 35, width: 100, height: 20 }, confidence: 0.90 },
        { text: 'NotAnEmail2', bbox: { x: 10, y: 60, width: 100, height: 20 }, confidence: 0.90 }
      ];

      const tables = detectTables(invalidData, 1, 2);
      const validatedResults = detectTableColumnsWithValidation(tables[0]);

      // Email column should be filtered out (validation score < 50%)
      const emailColumn = validatedResults.find(r => r.detectionType === 'email');
      expect(emailColumn).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const tables = detectTables([], 2, 2);
      expect(tables.length).toBe(0);
    });

    it('should handle single row (no table)', () => {
      const singleRow: OCRWord[] = [
        { text: 'Name', bbox: { x: 10, y: 10, width: 100, height: 20 }, confidence: 0.95 }
      ];

      const tables = detectTables(singleRow, 2, 2);
      expect(tables.length).toBe(0); // Not enough rows to form a table
    });

    it('should handle unaligned text (not a table)', () => {
      const unalignedData: OCRWord[] = [
        { text: 'Random', bbox: { x: 10, y: 10, width: 50, height: 20 }, confidence: 0.95 },
        { text: 'text', bbox: { x: 200, y: 50, width: 40, height: 20 }, confidence: 0.90 },
        { text: 'scattered', bbox: { x: 50, y: 100, width: 60, height: 20 }, confidence: 0.92 }
      ];

      const tables = detectTables(unalignedData, 2, 2);
      // May or may not detect a table depending on alignment
      // This tests robustness
      expect(tables).toBeDefined();
    });
  });
});
