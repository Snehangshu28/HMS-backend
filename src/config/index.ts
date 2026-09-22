import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function resolveMongoUri(): string {
  if (process.env.MONGODB_URI) {
    const uri = process.env.MONGODB_URI;
    // If DB_NAME is set and URI has no path db (or ends with /), append it
    if (process.env.DB_NAME) {
      try {
        const parsed = new URL(uri);
        const hasDb = parsed.pathname && parsed.pathname !== '/';
        if (!hasDb) {
          parsed.pathname = `/${process.env.DB_NAME}`;
          return parsed.toString();
        }
      } catch {
        // plain mongodb://host:port style without URL parser issues
        if (/mongodb(\+srv)?:\/\/[^/]+\/?$/.test(uri)) {
          return `${uri.replace(/\/$/, '')}/${process.env.DB_NAME}`;
        }
      }
    }
    return uri;
  }

  const host = process.env.MONGO_HOST || 'localhost';
  const port = process.env.MONGO_PORT || '27017';
  const db = process.env.DB_NAME || 'hms-saas';
  return `mongodb://${host}:${port}/${db}`;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: resolveMongoUri(),
  dbName: process.env.DB_NAME || undefined,
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_change_me_in_production',
  nodeEnv: process.env.NODE_ENV || 'development',
};
