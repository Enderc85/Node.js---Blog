const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
    throw new Error('Falta la variable DATABASE_URL en el archivo .env');
}

const connectionString = process.env.DATABASE_URL;
const accelerateUrl = (process.env.ACCELERATE_URL || '').trim();

// Prisma 7 ya no se conecta por sí solo: necesita un driver adapter o Accelerate.
//
// - Prisma Postgres (db.prisma.io): usamos el serverless driver oficial
//   (@prisma/adapter-ppg), que habla HTTP/WebSocket por el puerto 443.
//   Es la vía recomendada y funciona en redes que bloquean el puerto 5432.
// - ACCELERATE_URL (opcional): si está definida, se usa Prisma Accelerate.
//   También va por HTTPS 443, pero se retira el 1 de diciembre de 2026.
// - Cualquier otro PostgreSQL (local, Docker...): adaptador `pg` clásico,
//   que necesita el puerto 5432.
const isPrismaPostgres = /@(?:pooled\.)?db\.prisma\.io[:/]/i.test(connectionString);

let prisma;

if (accelerateUrl) {
    prisma = new PrismaClient({ accelerateUrl });
} else if (isPrismaPostgres) {
    const { PrismaPostgresAdapter } = require('@prisma/adapter-ppg');
    prisma = new PrismaClient({
        adapter: new PrismaPostgresAdapter({ connectionString })
    });
} else {
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString })
    });
}

module.exports = prisma;
