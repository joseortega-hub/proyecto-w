import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ItemsService } from './items.service.js';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  /** Elementos parecidos por embedding (`?limit=10`, máximo 30). */
  @Get(':id/similar')
  similar(@Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string) {
    return this.items.similar(id, Math.min(30, Math.max(1, Number(limit) || 10)));
  }
}
