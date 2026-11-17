import { createCache } from 'cache-manager';
import { CachedClassifier } from './cached.classifier';
import { Label } from '../moderation/moderation.types';

describe('CachedClassifier', () => {
  let innerMock: { classify: jest.Mock };
  let classifier: CachedClassifier;

  beforeEach(() => {
    innerMock = { classify: jest.fn() };
    classifier = new CachedClassifier(innerMock, createCache(), 60_000);
  });

  it('debe llamar una sola vez al clasificador para el mismo texto', async () => {
    innerMock.classify.mockResolvedValue({
      label: Label.SPAM,
      confidence: 0.95,
      reason: 'promo',
    });

    const first = await classifier.classify('Compra   YA en mi tienda');
    const second = await classifier.classify('compra ya en mi tienda');

    expect(innerMock.classify).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('no debe cachear los errores', async () => {
    innerMock.classify
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ label: Label.LEGIT, confidence: 0.9, reason: '' });

    await expect(classifier.classify('hola')).rejects.toThrow('Timeout');
    await expect(classifier.classify('hola')).resolves.toMatchObject({
      label: Label.LEGIT,
    });
    expect(innerMock.classify).toHaveBeenCalledTimes(2);
  });
});
