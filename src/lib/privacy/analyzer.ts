/**
 * Privacy Analyzer
 *
 * Calculates privacy scores and identifies risks in documents.
 */

import type {
  PrivacyAnalysis,
  PrivacyRisk,
  PrivacyScoreBreakdown,
  DocumentMetadata,
  RiskSeverity
} from './types';

export class PrivacyAnalyzer {
  /**
   * Analyze document privacy and generate score
   */
  static analyze(
    metadata: DocumentMetadata,
    detectedPIICount: number,
    hasTextLayer: boolean
  ): PrivacyAnalysis {
    const risks = this.identifyRisks(metadata, detectedPIICount, hasTextLayer);
    const score = this.calculateScore(metadata, detectedPIICount, hasTextLayer);
    const recommendations = this.generateRecommendations(risks);

    return {
      score,
      risks,
      metadata,
      recommendations,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate privacy score breakdown
   */
  private static calculateScore(
    metadata: DocumentMetadata,
    detectedPIICount: number,
    hasTextLayer: boolean
  ): PrivacyScoreBreakdown {
    // Metadata score (0-100)
    let metadataScore = 100;
    if (metadata.author) metadataScore -= 20;
    if (metadata.creator || metadata.producer) metadataScore -= 10;
    if (metadata.creationDate) metadataScore -= 5;
    if (metadata.title) metadataScore -= 5;

    // EXIF score (0-100)
    let exifScore = 100;
    if (metadata.exif) {
      if (metadata.exif.gps) exifScore -= 50; // GPS is critical
      if (metadata.exif.make || metadata.exif.model) exifScore -= 15;
      if (metadata.exif.software) exifScore -= 10;
      if (metadata.exif.dateTime) exifScore -= 10;
    }

    // PII detection score (0-100)
    let piiScore = 100;
    if (detectedPIICount > 0) {
      // Logarithmic penalty: 1 PII = -20, 10 PII = -60, 100 PII = -100
      const penalty = Math.min(100, 20 * Math.log10(detectedPIICount + 1) * 2);
      piiScore -= penalty;
    }

    // Text layer score (0-100)
    const textLayerScore = hasTextLayer ? 50 : 100; // Searchable text is a privacy risk

    // Weighted average
    const overall = Math.round(
      metadataScore * 0.25 +
      exifScore * 0.25 +
      piiScore * 0.35 +
      textLayerScore * 0.15
    );

    // Calculate grade
    const grade = this.scoreToGrade(overall);

    return {
      metadata: metadataScore,
      exifData: exifScore,
      piiDetection: piiScore,
      textLayer: textLayerScore,
      overall,
      grade
    };
  }

  /**
   * Convert score to letter grade
   */
  private static scoreToGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Identify privacy risks
   */
  private static identifyRisks(
    metadata: DocumentMetadata,
    detectedPIICount: number,
    hasTextLayer: boolean
  ): PrivacyRisk[] {
    const risks: PrivacyRisk[] = [];

    // GPS coordinates (critical)
    risks.push({
      id: 'gps',
      category: 'Location',
      severity: metadata.exif?.gps ? 'critical' : 'none',
      title: 'GPS Coordinates',
      description: 'Image contains embedded GPS location data',
      found: !!metadata.exif?.gps,
      details: metadata.exif?.gps
        ? `Lat: ${metadata.exif.gps.latitude?.toFixed(6)}, Lon: ${metadata.exif.gps.longitude?.toFixed(6)}`
        : undefined
    });

    // Author/Creator metadata (high)
    const hasAuthorInfo = !!(metadata.author || metadata.creator);
    risks.push({
      id: 'author',
      category: 'Identity',
      severity: hasAuthorInfo ? 'high' : 'none',
      title: 'Author Information',
      description: 'Document contains author or creator metadata',
      found: hasAuthorInfo,
      details: metadata.author || metadata.creator
    });

    // Unredacted PII (high/medium)
    const piiSeverity: RiskSeverity =
      detectedPIICount > 20 ? 'high' :
      detectedPIICount > 5 ? 'medium' :
      detectedPIICount > 0 ? 'low' : 'none';

    risks.push({
      id: 'pii',
      category: 'Sensitive Data',
      severity: piiSeverity,
      title: 'Unredacted PII',
      description: 'Detected personally identifiable information in document',
      found: detectedPIICount > 0,
      details: `${detectedPIICount} instance(s) detected`
    });

    // Searchable text layer (medium)
    risks.push({
      id: 'text-layer',
      category: 'Data Recovery',
      severity: hasTextLayer ? 'medium' : 'none',
      title: 'Searchable Text Layer',
      description: 'PDF contains searchable text that could reveal redacted content',
      found: hasTextLayer,
      details: hasTextLayer ? 'Text layer should be flattened' : undefined
    });

    // Camera/device info (low)
    const hasDeviceInfo = !!(metadata.exif?.make || metadata.exif?.model);
    risks.push({
      id: 'device',
      category: 'Device Info',
      severity: hasDeviceInfo ? 'low' : 'none',
      title: 'Camera/Device Information',
      description: 'Image contains camera make and model metadata',
      found: hasDeviceInfo,
      details: metadata.exif ? `${metadata.exif.make || ''} ${metadata.exif.model || ''}`.trim() : undefined
    });

    // Software metadata (low)
    const hasSoftwareInfo = !!(metadata.producer || metadata.exif?.software);
    risks.push({
      id: 'software',
      category: 'Software',
      severity: hasSoftwareInfo ? 'low' : 'none',
      title: 'Software Information',
      description: 'Document contains software/producer metadata',
      found: hasSoftwareInfo,
      details: metadata.producer || metadata.exif?.software
    });

    // Timestamps (low)
    const hasTimestamps = !!(metadata.creationDate || metadata.modificationDate || metadata.exif?.dateTime);
    risks.push({
      id: 'timestamps',
      category: 'Timestamps',
      severity: hasTimestamps ? 'low' : 'none',
      title: 'Creation/Modification Dates',
      description: 'Document contains timestamp metadata',
      found: hasTimestamps,
      details: hasTimestamps ? 'Creation and modification dates present' : undefined
    });

    // Return only risks that were found, sorted by severity
    return risks
      .filter(r => r.found)
      .sort((a, b) => this.severityWeight(b.severity) - this.severityWeight(a.severity));
  }

  /**
   * Get numeric weight for severity (for sorting)
   */
  private static severityWeight(severity: RiskSeverity): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      case 'none': return 0;
    }
  }

  /**
   * Generate recommendations based on risks
   */
  private static generateRecommendations(risks: PrivacyRisk[]): string[] {
    const recommendations: string[] = [];

    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const highRisks = risks.filter(r => r.severity === 'high');
    const mediumRisks = risks.filter(r => r.severity === 'medium');

    if (criticalRisks.length > 0) {
      recommendations.push('🔴 CRITICAL: Remove GPS coordinates immediately - they reveal exact location');
    }

    if (highRisks.some(r => r.id === 'author')) {
      recommendations.push('Strip author/creator metadata to remove identity information');
    }

    if (highRisks.some(r => r.id === 'pii')) {
      recommendations.push('Redact all detected PII before sharing this document');
    }

    if (mediumRisks.some(r => r.id === 'text-layer')) {
      recommendations.push('Flatten PDF to prevent text layer from revealing redacted content');
    }

    if (risks.some(r => r.id === 'device')) {
      recommendations.push('Remove EXIF data to strip camera/device information');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No major privacy risks detected - document looks good!');
    } else {
      recommendations.push('💡 Use "Maximum Privacy Export" to apply all protections automatically');
    }

    return recommendations;
  }

  /**
   * Get severity color for UI
   */
  static getSeverityColor(severity: RiskSeverity): string {
    switch (severity) {
      case 'critical': return '#dc2626'; // red-600
      case 'high': return '#ea580c'; // orange-600
      case 'medium': return '#f59e0b'; // amber-500
      case 'low': return '#fbbf24'; // yellow-400
      case 'none': return '#10b981'; // green-500
    }
  }

  /**
   * Get score color for UI
   */
  static getScoreColor(score: number): string {
    if (score >= 90) return '#10b981'; // green-500
    if (score >= 75) return '#84cc16'; // lime-500
    if (score >= 60) return '#f59e0b'; // amber-500
    if (score >= 40) return '#ea580c'; // orange-600
    return '#dc2626'; // red-600
  }
}
