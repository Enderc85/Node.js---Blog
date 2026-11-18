#!/usr/bin/env node
// Añade el soporte de respuestas (comentarios anidados) a la tabla comments.
//
// La CLI de Prisma (migrate/db push) necesita el puerto 5432, que en muchas
// redes está bloqueado. Este script hace el mismo cambio usando el cliente de
// la app, que va por el serverless driver (443).
//
// Uso:
//   npm run add-comment-replies
//
// Es idempotente: se puede ejecutar varias veces sin efecto.

const prisma = require('../src/config/db');

const statements = [
    'ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parentId" INTEGER',
    `DO $$
     BEGIN
         IF NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'comments_parentId_fkey'
         ) THEN
             ALTER TABLE "comments"
                 ADD CONSTRAINT "comments_parentId_fkey"
                 FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE;
         END IF;
     END
     $$`,
    'CREATE INDEX IF NOT EXISTS "comments_parentId_idx" ON "comments"("parentId")'
];

(async () => {
    for (const sql of statements) {
        await prisma.$executeRawUnsafe(sql);
        console.log('✔', sql.split('\n')[0].slice(0, 70));
    }
    console.log('\nListo: los comentarios ya admiten respuestas.\n');
})().catch((error) => {
    console.error('\n❌ No se pudo aplicar el cambio:', error.message, '\n');
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
});
