import type { TFunction } from 'i18next';
import type { DevelopmentStage } from './developmentStage';

/**
 * "Lebenswoche 12" / "Lebensmonat 18" in the current language. One literal
 * `t()` key per branch rather than a template-built key, so the typed-key
 * check keeps covering both.
 */
export function developmentStageLabel(t: TFunction, stage: DevelopmentStage): string {
  return stage.kind === 'week'
    ? t('development.stage.week', { number: stage.number })
    : t('development.stage.month', { number: stage.number });
}
