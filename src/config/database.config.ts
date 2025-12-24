import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'mariadb',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  username: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'partition_db',
  synchronize: false, // Never use in production
}));
