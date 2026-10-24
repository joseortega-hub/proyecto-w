import { Inject, Injectable, Logger } from '@nestjs/common';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import { DomainsService } from '../domains/domains.service.js';
import {
  cleanIntentText,
  decideRoute,
  INTENT_SYSTEM,
  intentPrompt,
  intentSchema,
  type AvailableDomain,
  type RoutedIntent,
} from './route-intent.js';

@Injectable()
export class RouteIntentService {
  private readonly logger = new Logger('Ruta');

  constructor(
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    private readonly domains: DomainsService,
  ) {}

  /** Temáticas con contenido para esta persona (las personales, solo si ya importó algo). */
  async available(userId: string | null): Promise<AvailableDomain[]> {
    const list = await this.domains.list(userId);
    return list
      .filter((d) => d.itemCount > 0)
      .map((d) => ({ id: d.id, name: d.name, noun: d.itemNounPlural, personal: d.personal }));
  }

  /**
   * Detecta la temática de un texto libre. El texto se trata como dato (saneado y entre
   * marcas), no se guarda ni se registra. Si todos los modelos fallan, responden las reglas.
   */
  async route(rawText: string, userId: string | null): Promise<RoutedIntent & { available: AvailableDomain[] }> {
    const available = await this.available(userId);
    const text = cleanIntentText(rawText);
    const raw = await this.text
      .write({ system: INTENT_SYSTEM, prompt: intentPrompt(text, available), schema: intentSchema })
      .catch((error: Error) => {
        this.logger.warn(`Sin IA para enrutar; uso las reglas: ${error.message.slice(0, 100)}`);
        return null;
      });
    return { ...decideRoute(raw, text, available), available };
  }
}
