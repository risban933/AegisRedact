export type DetectionType = 'email' | 'phone' | 'ssn' | 'card';

export interface Detection {
  type: DetectionType;
  text: string;
  confidence: number;
}
