import { RulesClassifier } from './rules.classifier';
import { Label } from '../moderation/moderation.types';

describe('RulesClassifier', () => {
  let classifier: RulesClassifier;

  beforeEach(() => {
    classifier = new RulesClassifier();
  });

  it('debe marcar como LEGIT con confianza alta un comentario normal', async () => {
    const result = await classifier.classify(
      'El producto llegó a tiempo y funciona muy bien, lo recomiendo.',
    );
    expect(result.label).toBe(Label.LEGIT);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe marcar como FRAUD con confianza alta varias palabras de fraude', async () => {
    const result = await classifier.classify(
      '¡Ganaste un premio! Envía tu número de tarjeta para reclamarlo',
    );
    expect(result.label).toBe(Label.FRAUD);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe marcar como FRAUD con confianza alta una palabra de fraude con enlace', async () => {
    const result = await classifier.classify(
      'Confirma tu clave en http://banco-seguro.xyz/login',
    );
    expect(result.label).toBe(Label.FRAUD);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe dejar en confianza media una sola palabra sensible sin enlace', async () => {
    const result = await classifier.classify(
      'La clave de este restaurante es la atención del personal',
    );
    expect(result.label).toBe(Label.FRAUD);
    expect(result.confidence).toBeLessThan(0.85);
  });

  it('debe marcar como SPAM con confianza alta enlaces acortados', async () => {
    const result = await classifier.classify('Mira esto https://bit.ly/abc123');
    expect(result.label).toBe(Label.SPAM);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('no debe confundir un dominio normal con un acortador', async () => {
    const result = await classifier.classify(
      'Lo vi recomendado en https://reddit.com/r/cocina',
    );
    expect(result.confidence).toBeLessThan(0.85);
  });

  it('debe marcar como SPAM con confianza alta varios enlaces', async () => {
    const result = await classifier.classify(
      'Visita https://a.com y también https://b.com',
    );
    expect(result.label).toBe(Label.SPAM);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe marcar como SPAM con confianza alta varias palabras promocionales', async () => {
    const result = await classifier.classify(
      'Oferta increíble, envío gratis por tiempo limitado',
    );
    expect(result.label).toBe(Label.SPAM);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe marcar como SPAM con confianza media el exceso de mayúsculas y signos', async () => {
    const result = await classifier.classify('ESTE ES EL MEJOR LUGAR DEL MUNDO!!!!');
    expect(result.label).toBe(Label.SPAM);
    expect(result.confidence).toBeLessThan(0.85);
    expect(result.reason).toContain('mayúsculas');
    expect(result.reason).toContain('signos repetidos');
  });

  it('no debe detectar palabras clave dentro de otras palabras', async () => {
    const result = await classifier.classify(
      'Me encantó la pintura del local, muy bien ofertado el menú',
    );
    expect(result.label).toBe(Label.LEGIT);
  });
});
