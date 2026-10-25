import { BadRequestException, Body, Controller, Headers, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { USER_HEADER } from '../taste/taste.controller.js';
import { optionalUserId } from '../taste/taste.service.js';
import { ListsService } from './lists.service.js';

const entriesSchema = z.object({ itemIds: z.array(z.uuid()).min(1).max(200) });

@Controller('sessions')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  /** Editar la lista: el orden y los elementos finales, en una sola llamada. */
  @Put(':id/entries')
  setEntries(@Param('id') id: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const parsed = entriesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('La lista tiene que llevar entre 1 y 200 canciones');
    return this.lists.setEntries(id, parsed.data.itemIds, optionalUserId(user));
  }
}
