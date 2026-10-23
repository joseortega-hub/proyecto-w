import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDb } from './client.js';

export const DB = Symbol('DB');
const SQL = Symbol('SQL');

@Global()
@Module({
  providers: [
    { provide: 'DB_CONNECTION', useFactory: () => createDb() },
    { provide: DB, useFactory: (c: ReturnType<typeof createDb>) => c.db, inject: ['DB_CONNECTION'] },
    { provide: SQL, useFactory: (c: ReturnType<typeof createDb>) => c.client, inject: ['DB_CONNECTION'] },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: ReturnType<typeof createDb>['client']) {}

  async onApplicationShutdown() {
    await this.sql.end({ timeout: 5 });
  }
}
