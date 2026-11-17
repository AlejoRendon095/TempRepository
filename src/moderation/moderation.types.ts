export enum Label {
  LEGIT = 'LEGIT',
  SPAM = 'SPAM',
  FRAUD = 'FRAUD',
}

export enum CommentStatus {
  PUBLISHED = 'PUBLISHED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  BLOCKED = 'BLOCKED',
}

export interface ClassificationResult {
  label: Label;
  confidence: number; // 0..1
  reason: string;     // explicación corta, útil para el moderador
}

export interface TextClassifier {
  classify(text: string): Promise<ClassificationResult>;
}

export const TEXT_CLASSIFIER = 'TEXT_CLASSIFIER';