import { Injectable } from '@nestjs/common';
import {
  ClassificationResult,
  Label,
  TextClassifier,
} from '../moderation/moderation.types';

// Palabras sin tildes: el texto se normaliza antes de comparar.
const FRAUD_KEYWORDS = [
  'transferencia',
  'clave',
  'contrasena',
  'cuenta bancaria',
  'numero de tarjeta',
  'tarjeta de credito',
  'cvv',
  'codigo de verificacion',
  'ganaste',
  'premio',
];

const SPAM_KEYWORDS = [
  'gratis',
  'oferta',
  'descuento',
  'promocion',
  'compra ya',
  'haz clic',
  'click aqui',
  'gana dinero',
  'sigueme',
];

const URL_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'cutt.ly',
  'is.gd',
  'ow.ly',
];

const URL_PATTERN = /(https?:\/\/|www\.)\S+/g;
const REPEATED_PUNCTUATION = /[!?¡¿]{3,}/;
const REPEATED_CHAR = /(.)\1{4,}/;

/**
 * Clasificador offline basado en reglas. No llama a ninguna API: sirve para
 * desarrollo sin gastar créditos, para la demo sin internet y como respaldo.
 * Ante señales débiles devuelve confianza media para que el comentario
 * termine en revisión humana en lugar de bloquearse.
 */
@Injectable()
export class RulesClassifier implements TextClassifier {
  async classify(text: string): Promise<ClassificationResult> {
    const normalized = this.normalize(text);

    const fraudHits = this.findKeywords(normalized, FRAUD_KEYWORDS);
    const urls = normalized.match(URL_PATTERN) ?? [];
    const shortenedUrls = urls.filter((url) =>
      URL_SHORTENERS.includes(this.getHost(url)),
    );

    if (fraudHits.length >= 2 || (fraudHits.length === 1 && urls.length > 0)) {
      return {
        label: Label.FRAUD,
        confidence: 0.95,
        reason: `Posible fraude: ${fraudHits.join(', ')}`,
      };
    }

    if (shortenedUrls.length > 0 || urls.length >= 2) {
      return {
        label: Label.SPAM,
        confidence: 0.92,
        reason: `Enlaces sospechosos (${urls.length}), acortados: ${shortenedUrls.length}`,
      };
    }

    if (fraudHits.length === 1) {
      return {
        label: Label.FRAUD,
        confidence: 0.7,
        reason: `Menciona un término sensible: ${fraudHits[0]}`,
      };
    }

    const spamHits = this.findKeywords(normalized, SPAM_KEYWORDS);
    if (spamHits.length >= 2) {
      return {
        label: Label.SPAM,
        confidence: 0.88,
        reason: `Lenguaje promocional: ${spamHits.join(', ')}`,
      };
    }

    const formatSignals = this.findFormatSignals(text);
    if (spamHits.length === 1 || urls.length === 1) {
      formatSignals.push(
        spamHits.length === 1 ? `palabra promocional "${spamHits[0]}"` : 'contiene un enlace',
      );
    }

    if (formatSignals.length > 0) {
      return {
        label: Label.SPAM,
        confidence: formatSignals.length >= 2 ? 0.75 : 0.6,
        reason: `Señales de spam: ${formatSignals.join(', ')}`,
      };
    }

    return {
      label: Label.LEGIT,
      confidence: 0.87,
      reason: 'No se detectaron señales de spam ni fraude',
    };
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  private getHost(url: string): string {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split(/[/?#]/)[0];
  }

  private findKeywords(text: string, keywords: string[]): string[] {
    return keywords.filter((keyword) =>
      new RegExp(`\\b${keyword}\\b`).test(text),
    );
  }

  private findFormatSignals(text: string): string[] {
    const signals: string[] = [];
    const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    const upper = letters.replace(/[^A-ZÀ-Þ]/g, '');

    if (letters.length >= 10 && upper.length / letters.length >= 0.7) {
      signals.push('exceso de mayúsculas');
    }
    if (REPEATED_PUNCTUATION.test(text)) {
      signals.push('signos repetidos');
    }
    if (REPEATED_CHAR.test(text)) {
      signals.push('caracteres repetidos');
    }

    return signals;
  }
}
