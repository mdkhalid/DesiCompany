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
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(
      process.env.DB_CONNECTION_TIMEOUT || '5000',
      10,
    ),
    ...(process.env.DB_SSL === 'true'
      ? {
          ssl: { rejectUnauthorized: false },
        }
      : {}),
  },
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
    extra: {
      max: parseInt(process.env.DB_READ_POOL_MAX || '40', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || '5000',
        10,
      ),
    },
  };
};
