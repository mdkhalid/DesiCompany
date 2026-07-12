import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development',
  migrationsRun: process.env.NODE_ENV === 'production',
  logging: process.env.NODE_ENV !== 'production',
});

export const readReplicaConfig = (): TypeOrmModuleOptions | null => {
  const host = process.env.DB_READ_HOST;
  if (!host) return null;

  return {
    type: 'postgres',
    host,
    port: Number(process.env.DB_READ_PORT || process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
};
