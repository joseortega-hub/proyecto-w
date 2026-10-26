import { Controller, Get, Header, Headers, Param, StreamableFile } from '@nestjs/common';
import { USER_HEADER } from '../taste/taste.controller.js';
import { requireUserId } from '../taste/taste.service.js';
import { YearService } from './year.service.js';

/** «Tu año en Sintonía»: el resumen y cada tarjeta como PNG 9:16. */
@Controller('year')
export class YearController {
  constructor(private readonly year: YearService) {}

  @Get()
  get(@Headers(USER_HEADER) user?: string) {
    return this.year.get(requireUserId(user));
  }

  @Get('card/:kind')
  @Header('content-type', 'image/png')
  @Header('cache-control', 'private, max-age=600')
  async card(@Param('kind') kind: string, @Headers(USER_HEADER) user?: string) {
    return new StreamableFile(await this.year.card(requireUserId(user), kind));
  }
}
