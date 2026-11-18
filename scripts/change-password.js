#!/usr/bin/env node
// Cambia la contraseña de un usuario desde la terminal.
//
// Usa el mismo cliente Prisma que la aplicación, así que funciona con el
// serverless driver de Prisma Postgres por el puerto 443.
//
// Uso:
//   npm run change-password -- correo@ejemplo.com
//   npm run change-password -- correo@ejemplo.com "nueva-contraseña"
//   npm run change-password -- --id 3
//   npm run change-password -- correo@ejemplo.com --generate
//   npm run change-password -- --list

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

const MIN_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

const args = process.argv.slice(2);

const readOption = (name) => {
    const withEquals = args.find((arg) => arg.startsWith(`--${name}=`));
    if (withEquals) return withEquals.slice(name.length + 3);

    const index = args.indexOf(`--${name}`);
    if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
        return args[index + 1];
    }
    return null;
};

const hasFlag = (name) => args.includes(`--${name}`);

// Valores posicionales, saltando los valores de --id / --email.
const positional = [];
for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
        if ((arg === '--id' || arg === '--email') && args[i + 1] && !args[i + 1].startsWith('--')) {
            i += 1;
        }
        continue;
    }
    positional.push(arg);
}

const email = (readOption('email') || positional[0] || '').trim().toLowerCase();
const passwordArg = positional[1] || process.env.NEW_PASSWORD || '';
const idArg = readOption('id');
const generate = hasFlag('generate');
const list = hasFlag('list');

const usage = () => {
    console.log(`
Uso:
  npm run change-password -- correo@ejemplo.com
  npm run change-password -- correo@ejemplo.com "nueva-contraseña"
  npm run change-password -- --id 3
  npm run change-password -- correo@ejemplo.com --generate
  npm run change-password -- --list

Opciones:
  --id <n>         Busca al usuario por id
  --email <correo> Busca al usuario por correo
  --generate       Genera una contraseña aleatoria y la muestra una vez
  --list           Lista los usuarios existentes

Si no indicas la contraseña, se pide por terminal sin mostrarla.
La contraseña debe tener al menos ${MIN_LENGTH} caracteres.
`);
};

// Pide una contraseña por terminal sin mostrarla.
const promptHidden = (label) => new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
        return reject(new Error(
            'No hay una terminal interactiva. Indica la contraseña como argumento o usa --generate.'
        ));
    }

    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let value = '';

    const finish = (error, result) => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        if (error) {
            process.stdout.write('\n');
            reject(error);
        } else {
            process.stdout.write('\n');
            resolve(result);
        }
    };

    const onData = (char) => {
        if (char === '\u0003') return finish(new Error('Cancelado.'));
        if (char === '\r' || char === '\n') return finish(null, value);
        if (char === '\u007f' || char === '\b') {
            if (value.length > 0) {
                value = value.slice(0, -1);
                process.stdout.write('\b \b');
            }
            return;
        }
        if (char >= ' ') {
            value += char;
            process.stdout.write('*');
        }
    };

    process.stdin.on('data', onData);
});

const generatePassword = (length = 16) =>
    crypto.randomBytes(48).toString('base64url').slice(0, length);

const listUsers = async () => {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true },
        orderBy: { id: 'asc' }
    });

    console.log('\n👥 Usuarios\n');
    console.log('ID   CORREO                          NOMBRE                 ROL');
    console.log('---  ------------------------------  ---------------------  -------');
    for (const user of users) {
        const id = String(user.id).padEnd(3);
        const mail = (user.email || '').padEnd(30);
        const name = (user.name || '—').slice(0, 21).padEnd(21);
        console.log(`${id}  ${mail}  ${name}  ${user.role}`);
    }
    console.log(`\nTotal: ${users.length} usuario${users.length === 1 ? '' : 's'}.\n`);
};

const main = async () => {
    if (hasFlag('help')) {
        usage();
        return;
    }

    if (list) {
        await listUsers();
        return;
    }

    if (!email && !idArg) {
        usage();
        process.exitCode = 1;
        return;
    }

    const where = idArg
        ? { id: Number(idArg) }
        : { email: { equals: email, mode: 'insensitive' } };

    if (idArg && !Number.isInteger(where.id)) {
        console.error('❌ El id debe ser un número entero.');
        process.exitCode = 1;
        return;
    }

    const user = await prisma.user.findFirst({ where });

    if (!user) {
        console.error(`❌ No existe ningún usuario con ${idArg ? `id ${idArg}` : `el correo ${email}`}.`);
        console.error('   Usa "npm run change-password -- --list" para ver los usuarios.');
        process.exitCode = 1;
        return;
    }

    let newPassword = passwordArg;

    if (generate) {
        newPassword = generatePassword();
    } else if (!newPassword) {
        newPassword = await promptHidden('Nueva contraseña: ');
        const confirmation = await promptHidden('Repite la contraseña: ');

        if (newPassword !== confirmation) {
            console.error('❌ Las contraseñas no coinciden.');
            process.exitCode = 1;
            return;
        }
    }

    if (newPassword.length < MIN_LENGTH) {
        console.error(`❌ La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
        process.exitCode = 1;
        return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
    });

    console.log(`\n✅ Contraseña actualizada para ${user.email}${user.name ? ` (${user.name})` : ''}.`);

    if (generate) {
        console.log(`🔑 Nueva contraseña: ${newPassword}`);
        console.log('   Guárdala ahora: no se volverá a mostrar.');
    }

    console.log('   Las sesiones abiertas seguirán activas hasta que caduque su token.\n');
};

main()
    .catch((error) => {
        console.error(`\n❌ ${error.message || error}\n`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
