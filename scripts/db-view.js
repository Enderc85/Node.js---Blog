#!/usr/bin/env node
// Visor de la base de datos por terminal.
//
// Usa el mismo cliente Prisma que la aplicación (src/config/db.js), así que
// funciona con el serverless driver de Prisma Postgres por el puerto 443,
// incluso en redes que bloquean el 5432.
//
// Uso:
//   npm run db:view
//   npm run db:view -- post
//   npm run db:view -- post --limit=5
//   npm run db:view -- user --json
//   npm run db:view -- media --full

const prisma = require('../src/config/db');

const MODELS = {
    users: 'user',
    user: 'user',
    posts: 'post',
    post: 'post',
    post_images: 'postImage',
    postimage: 'postImage',
    'post-image': 'postImage',
    media: 'media',
    comments: 'comment',
    comment: 'comment',
    likes: 'like',
    like: 'like',
    images: 'images',
    image: 'images',
    contacts: 'contact',
    contact: 'contact',
    categories: 'category',
    category: 'category'
};

// Campos que no conviene imprimir en pantalla.
const HIDDEN_FIELDS = new Set(['password']);

// En Media no mostramos el binario: solo sus metadatos.
const MEDIA_SELECT = {
    id: true,
    filename: true,
    mimeType: true,
    size: true,
    createdAt: true
};

const args = process.argv.slice(2);

const readOption = (name, fallback) => {
    const withEquals = args.find((a) => a.startsWith(`--${name}=`));
    if (withEquals) return withEquals.split('=').slice(1).join('=');
    const index = args.indexOf(`--${name}`);
    if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
        return args[index + 1];
    }
    return fallback;
};

const hasFlag = (name) => args.includes(`--${name}`);

const limitArg = Number(readOption('limit', '20'));
const limit = Number.isInteger(limitArg) && limitArg > 0 ? Math.min(limitArg, 500) : 20;
const asJson = hasFlag('json');
const full = hasFlag('full');
const tableArg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a) && a !== readOption('limit'));

const MAX_CELL = full ? Infinity : 45;

const truncate = (value, max) => {
    const text = String(value);
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

const formatCell = (value) => {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date) return value.toISOString().replace('T', ' ').slice(0, 19);
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return `<${value.length} bytes>`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return truncate(JSON.stringify(value), MAX_CELL);
    if (typeof value === 'string' && value.length > MAX_CELL) return truncate(value, MAX_CELL);
    return truncate(String(value), MAX_CELL);
};

const printTable = (columns, rows) => {
    const headers = columns.map((c) => c.name);
    const cells = rows.map((row) => columns.map((c) => formatCell(row[c.name])));

    const widths = headers.map((h, i) =>
        Math.max(h.length, ...cells.map((row) => row[i].length))
    );

    const separator = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
    const printRow = (values) =>
        '| ' + values.map((value, i) => value.padEnd(widths[i])).join(' | ') + ' |';

    console.log(separator);
    console.log(printRow(headers));
    console.log(separator);
    for (const row of cells) console.log(printRow(row));
    console.log(separator);
};

const resolveModel = (value) => {
    if (!value) return null;
    return MODELS[value.toLowerCase()] || null;
};

const modelKeys = () =>
    Object.keys(prisma).filter(
        (key) => !key.startsWith('$') && prisma[key] && typeof prisma[key].findMany === 'function'
    );

const redact = (row) => {
    const copy = { ...row };
    for (const field of HIDDEN_FIELDS) {
        if (field in copy) copy[field] = '***';
    }
    return copy;
};

const showHelp = () => {
    console.log(`
📊 Visor de base de datos — Prisma Postgres (443)

Uso:
  npm run db:view                     Lista las tablas y el número de filas
  npm run db:view -- <tabla>          Muestra las filas de una tabla
  npm run db:view -- <tabla> --limit=5
  npm run db:view -- <tabla> --full   No recorta las celdas
  npm run db:view -- <tabla> --json   Salida JSON

Tablas: ${modelKeys().join(', ')}

Ejemplos:
  npm run db:view -- post
  npm run db:view -- user --limit=3
  npm run db:view -- media
`);
};

const main = async () => {
    if (hasFlag('help') || tableArg === 'help') {
        showHelp();
        return;
    }

    if (!tableArg) {
        const keys = modelKeys();
        const rows = [];

        for (const key of keys) {
            const count = await prisma[key].count();
            rows.push({ modelo: key, filas: count });
        }

        rows.sort((a, b) => a.modelo.localeCompare(b.modelo));

        console.log('\n📊 Tablas de la base de datos\n');
        printTable([{ name: 'modelo' }, { name: 'filas' }], rows);
        console.log(`\nTotal: ${rows.length} tablas. Usa "npm run db:view -- <modelo>" para ver filas.\n`);
        return;
    }

    const modelKey = resolveModel(tableArg);

    if (!modelKey) {
        console.error(`\n❌ Tabla desconocida: "${tableArg}".`);
        console.error(`   Disponibles: ${modelKeys().join(', ')}\n`);
        process.exitCode = 1;
        return;
    }

    const delegate = prisma[modelKey];
    const total = await delegate.count();
    const query = {
        take: limit,
        orderBy: { id: 'asc' }
    };

    if (modelKey === 'media') {
        query.select = MEDIA_SELECT;
    }

    let rows = await delegate.findMany(query);
    rows = rows.map(redact);

    if (asJson) {
        console.log(JSON.stringify(rows, null, 2));
        return;
    }

    const columns = rows.length
        ? Object.keys(rows[0]).map((name) => ({ name }))
        : [];

    console.log(`\n📋 Tabla: ${modelKey} — ${total} fila${total === 1 ? '' : 's'}\n`);

    if (!rows.length) {
        console.log('(tabla vacía)\n');
        return;
    }

    printTable(columns, rows);

    if (total > rows.length) {
        console.log(`\nMostrando ${rows.length} de ${total}. Usa --limit=N para ver más.\n`);
    } else {
        console.log('');
    }
};

main()
    .catch((error) => {
        console.error('\n❌ No se pudo consultar la base de datos.');
        console.error(String(error.message).split('\n').slice(0, 6).join('\n'));
        console.error('\nComprueba tu conexión y que DATABASE_URL esté bien en .env.\n');
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
