import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TEXT_CLASSIFIER } from '../moderation/moderation.types';
import { CachedClassifier } from './cached.classifier';
import { LlmClassifier } from './llm.classifier';
import { RulesClassifier } from './rules.classifier';

@Module({
  imports: [CacheModule.register()],
  providers: [
    RulesClassifier,
    LlmClassifier,
    {
      provide: TEXT_CLASSIFIER,
      inject: [ConfigService, LlmClassifier, RulesClassifier, CACHE_MANAGER],
      useFactory: (
        config: ConfigService,
        llm: LlmClassifier,
        rules: RulesClassifier,
        cache: Cache,
      ) => {
        if (config.get<string>('CLASSIFIER_MODE') === 'rules') {
          return rules;
        }

        if (!config.get<string>('LLM_API_KEY')) {
          new Logger('ClassifierModule').warn(
            'CLASSIFIER_MODE=llm sin LLM_API_KEY: los comentarios irán a revisión humana',
          );
        }

        // Solo se cachea el LLM: las reglas son locales y no cuestan nada.
        const ttlSeconds = Number(config.get('CLASSIFIER_CACHE_TTL', 300));
        return new CachedClassifier(llm, cache, ttlSeconds * 1000);
      },
    },
  ],
  exports: [TEXT_CLASSIFIER],
})
export class ClassifierModule {}
