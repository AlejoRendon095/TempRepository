import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ClassifierModule } from './classifier.module';
import { CachedClassifier } from './cached.classifier';
import { LlmClassifier } from './llm.classifier';
import { RulesClassifier } from './rules.classifier';
import { TEXT_CLASSIFIER } from '../moderation/moderation.types';

describe('ClassifierModule', () => {
  const buildModule = (env: Record<string, string>) =>
    Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => env],
        }),
        ClassifierModule,
      ],
    }).compile();

  it('debe inyectar RulesClassifier con CLASSIFIER_MODE=rules', async () => {
    const module = await buildModule({ CLASSIFIER_MODE: 'rules' });
    expect(module.get(TEXT_CLASSIFIER)).toBeInstanceOf(RulesClassifier);
  });

  it('debe inyectar LlmClassifier con caché con CLASSIFIER_MODE=llm', async () => {
    const module = await buildModule({
      CLASSIFIER_MODE: 'llm',
      LLM_API_KEY: 'test',
    });
    const classifier = module.get<CachedClassifier>(TEXT_CLASSIFIER);

    expect(classifier).toBeInstanceOf(CachedClassifier);
    expect(classifier.inner).toBeInstanceOf(LlmClassifier);
  });

  it('debe usar el LLM por defecto si no hay CLASSIFIER_MODE', async () => {
    const module = await buildModule({});
    const classifier = module.get<CachedClassifier>(TEXT_CLASSIFIER);
    expect(classifier.inner).toBeInstanceOf(LlmClassifier);
  });
});
