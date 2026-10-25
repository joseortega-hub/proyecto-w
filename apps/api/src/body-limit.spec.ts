import { Body, Controller, Patch } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyBodyLimit } from './body-limit.js';

@Controller('echo')
class EchoController {
  @Patch()
  echo(@Body() body: { photoData?: string }) {
    return { size: body.photoData?.length ?? 0 };
  }
}

describe('límite del cuerpo JSON', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    app = mod.createNestApplication<NestExpressApplication>();
    applyBodyLimit(app);
    await app.init();
  });
  afterAll(() => app.close());

  // Una foto de 400×400 subida desde el iPhone (Safari no codifica WebP: sale PNG) pasa de los 100 kB por defecto de Express.
  it('acepta la foto más grande que admite el PATCH de un artista (600 000 caracteres en base64)', async () => {
    const res = await request(app.getHttpServer()).patch('/echo').send({ photoData: 'A'.repeat(600_000) });
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(600_000);
  });

  it('sigue rechazando cuerpos desmesurados', async () => {
    const res = await request(app.getHttpServer()).patch('/echo').send({ photoData: 'A'.repeat(2_000_000) });
    expect(res.status).toBe(413);
  });
});
