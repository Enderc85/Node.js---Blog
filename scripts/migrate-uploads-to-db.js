// Migra las imágenes que quedaron guardadas en public/uploads a la tabla media,
// para que se puedan ver desde cualquier dispositivo o despliegue.
// Uso: npm run migrate-media
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/db');
const mediaService = require('../src/services/media.services');

const PUBLIC_DIR = path.join(__dirname, '../public');
const LOCAL_PREFIXES = ['/uploads/posts/', '/uploads/avatars/'];

const isLocalUpload = (url) => (
    typeof url === 'string' && LOCAL_PREFIXES.some((prefix) => url.startsWith(prefix))
);

const diskPathFromUrl = (url) => path.join(PUBLIC_DIR, url.split('?')[0].split('#')[0]);

(async () => {
    const [posts, gallery, users, library] = await Promise.all([
        prisma.post.findMany({ select: { image: true } }),
        prisma.postImage.findMany({ select: { url: true } }),
        prisma.user.findMany({ select: { avatar: true } }),
        prisma.images.findMany({ select: { url: true } })
    ]);

    const urls = new Set();
    posts.forEach((post) => post.image && urls.add(post.image));
    gallery.forEach((image) => urls.add(image.url));
    users.forEach((user) => user.avatar && urls.add(user.avatar));
    library.forEach((image) => urls.add(image.url));

    const pending = [...urls].filter(isLocalUpload).filter((url) => fs.existsSync(diskPathFromUrl(url)));

    if (pending.length === 0) {
        console.log('No hay imágenes locales pendientes de migrar.');
        return;
    }

    let migrated = 0;
    let missing = 0;

    for (const oldUrl of pending) {
        const filePath = diskPathFromUrl(oldUrl);
        const buffer = fs.readFileSync(filePath);

        const newUrl = await mediaService.saveMedia({
            originalname: path.basename(filePath),
            buffer,
            mimetype: ''
        });

        await prisma.$transaction([
            prisma.post.updateMany({ where: { image: oldUrl }, data: { image: newUrl } }),
            prisma.postImage.updateMany({ where: { url: oldUrl }, data: { url: newUrl } }),
            prisma.user.updateMany({ where: { avatar: oldUrl }, data: { avatar: newUrl } }),
            prisma.images.updateMany({ where: { url: oldUrl }, data: { url: newUrl } })
        ]);

        migrated += 1;
        console.log(`${oldUrl} → ${newUrl}`);
    }

    // URLs locales referenciadas en la base de datos pero sin archivo en disco.
    for (const url of urls) {
        if (isLocalUpload(url) && !fs.existsSync(diskPathFromUrl(url))) {
            missing += 1;
            console.warn(`Aviso: no existe el archivo ${diskPathFromUrl(url)} (se deja la URL como está)`);
        }
    }

    console.log(`\nMigradas ${migrated} imágenes. Sin archivo en disco: ${missing}.`);
    console.log('Los archivos originales siguen en public/uploads; puedes borrarlos cuando compruebes que todo se ve bien.');
})().catch(async (error) => {
    console.error('Error migrando las imágenes:', error);
    await prisma.$disconnect();
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
