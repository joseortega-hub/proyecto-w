import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { MAX_DESCRIPTION, ThemesService } from './themes.service.js';

const bodySchema = z.object({
  description: z.string().trim().min(2).max(MAX_DESCRIPTION * 2),
  variant: z.number().int().min(0).max(9).default(0),
});

/** "Crea tu tema con IA": la descripción no se guarda; solo se devuelve el tema propuesto. */
@Controller('themes')
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Post('generate')
  generate(@Body() body: unknown) {
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.themes.generate(parsed.data.description, parsed.data.variant);
  }
}
