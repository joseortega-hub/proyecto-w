import { Controller, Get } from '@nestjs/common';
import { DomainsService } from './domains.service.js';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  list() {
    return this.domains.list();
  }
}
