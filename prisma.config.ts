import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Configuración de Prisma 7.
// La URL de conexión ya no va en schema.prisma: se declara aquí para la CLI
// (migraciones, db push, introspección...) y se pasa al cliente mediante un
// adaptador en src/config/db.js.
export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: env('DATABASE_URL')
    },
    migrations: {
        seed: 'node prisma/seed.js'
    }
});