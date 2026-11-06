import { Module, Global } from '@nestjs/common';
import { DatabaseService, DRIZZLE_DB } from './database.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: DRIZZLE_DB,
      useFactory: (databaseService: DatabaseService) => databaseService.getDb(),
      inject: [DatabaseService],
    },
  ],
  exports: [DatabaseService, DRIZZLE_DB],
})
export class DatabaseModule {}
