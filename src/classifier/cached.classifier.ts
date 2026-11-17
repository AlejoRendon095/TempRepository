import { createHash } from 'node:crypto';
import type { Cache } from 'cache-manager';
import {
  ClassificationResult,
  TextClassifier,
} from '../moderation/moderation.types';

/**
 * Envuelve otro clasificador y reutiliza la clasificación de textos ya vistos.
 * Los bots suelen repetir el mismo spam, así que esto evita pagar una llamada
 * a la IA por cada copia. Solo se guardan clasificaciones exitosas.
 */
export class CachedClassifier implements TextClassifier {
  constructor(
    readonly inner: TextClassifier,
    private readonly cache: Cache,
    private readonly ttlMs: number,
  ) {}

  async classify(text: string): Promise<ClassificationResult> {
    const key = `classification:${this.hash(text)}`;

    const cached = await this.cache.get<ClassificationResult>(key);
    if (cached) {
      return cached;
    }

    const result = await this.inner.classify(text);
    await this.cache.set(key, result, this.ttlMs);
    return result;
  }

  private hash(text: string): string {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
  }
}
