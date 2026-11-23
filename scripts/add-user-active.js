#!/usr/bin/env node
// Añade el flag `active` a la tabla users (desactivar/reactivar cuentas).
//
// La CLI de Prisma (migrate/db push) necesita el puerto 5432, que en muchas
// redes está bloqueado. Este script hace el mismo cambio usando el cliente de
// la app, que va por el serverless driver (443).
//
// Uso:
//   npm run add-user-active
//
// Es idempotente: se puede ejecutar varias veces sin efecto.

const prisma = require('../src/config/db');

const statements = [
    'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true'
];

(async () => {
    for (const sql of statements) {
        await prisma.$executeRawUnsafe(sql);
        console.log('✔', sql.slice(0, 70));
    }
    console.log('\nListo: los usuarios ya se pueden desactivar y reactivar.\n');
})().catch((error) => {
    console.error('\n❌ No se pudo aplicar el cambio:', error.message, '\n');
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
});
