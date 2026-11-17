import { ClassificationResult, Label, TextClassifier } from './moderation.types';

export class MockClassifier implements TextClassifier {
  async classify(text: string): Promise<ClassificationResult> {
    const lowerText = text.toLowerCase();

    if (lowerText.match(/(http|gratis|ganaste)/)) {
      return { label: Label.SPAM, confidence: 0.95, reason: 'Contiene enlaces o palabras de promoción' };
    }
    
    if (lowerText.match(/(transferencia|clave|tarjeta)/)) {
      return { label: Label.FRAUD, confidence: 0.9, reason: 'Posible intento de phishing o robo de datos' };
    }
    
    if (lowerText.includes('quizás') || text.trim().length < 10) {
      return { label: Label.SPAM, confidence: 0.6, reason: 'Texto muy corto o ambiguo' };
    }

    return { label: Label.LEGIT, confidence: 0.97, reason: 'Parece un comentario seguro y natural' };
  }
}