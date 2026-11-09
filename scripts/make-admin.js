const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

// Uso:
//   npm run make-admin -- correo@ejemplo.com
//       → promociona a ADMIN un usuario existente.
//   npm run make-admin -- correo@ejemplo.com "contraseña" "Nombre"
//       → si el usuario no existe, lo crea ya como ADMIN.
//   npm run make-admin -- correo@ejemplo.com --revoke
//       → le quita el rol de administrador.
//
// También se pueden usar las variables ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith('--'));
const values = args.filter((arg) => !arg.startsWith('--'));

const email = (values[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = values[1] || process.env.ADMIN_PASSWORD || '';
const name = values[2] || process.env.ADMIN_NAME || 'Administrador';
const revoke = flags.includes('--revoke');

const usage = () => {
    console.log(`
Uso:
  npm run make-admin -- correo@ejemplo.com
  npm run make-admin -- correo@ejemplo.com "contraseña" "Nombre"
  npm run make-admin -- correo@ejemplo.com --revoke
`);
};

const main = async () => {
    if (!email) {
        usage();
        process.exitCode = 1;
        return;
    }

    // Búsqueda sin distinguir mayúsculas/minúsculas
    const existing = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (revoke) {
        if (!existing) {
            console.error(`❌ No existe ningún usuario con el correo ${email}.`);
            process.exitCode = 1;
            return;
        }

        await prisma.user.update({
            where: { id: existing.id },
            data: { role: 'USER' }
        });

        console.log(`✅ ${existing.email} ya no es administrador.`);
        return;
    }

    if (existing) {
        await prisma.user.update({
            where: { id: existing.id },
            data: { role: 'ADMIN' }
        });

        console.log(`✅ ${existing.email} es ahora administrador.`);
        return;
    }

    if (!password) {
        console.error(`❌ No existe ningún usuario con el correo ${email}.`);
        console.error('   Para crearlo, indica también una contraseña:');
        console.error(`   npm run make-admin -- ${email} "tu-contraseña" "Tu nombre"`);
        process.exitCode = 1;
        return;
    }

    if (password.length < 6) {
        console.error('❌ La contraseña debe tener al menos 6 caracteres.');
        process.exitCode = 1;
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
        data: {
            email,
            name,
            password: hashedPassword,
            role: 'ADMIN'
        }
    });

    console.log(`✅ Usuario administrador creado: ${admin.email}`);
};

main()
    .catch((error) => {
        console.error('❌ Error configurando el administrador:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
