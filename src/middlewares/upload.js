const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Carpeta donde se guardan las imágenes subidas de los posts
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/posts');

// Carpeta de fotos de perfil
const AVATAR_DIR = path.join(__dirname, '../../public/uploads/avatars');

// Creamos las carpetas si no existen (multer no las crea por sí solo)
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Formatos permitidos. Se aceptan los indicados en el requisito
// (jpg, jpeg, png, heic) más los RAW habituales de cada fabricante.
const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.heic', '.heif',
    '.raw', '.cr2', '.cr3', '.nef', '.arw', '.dng', '.orf', '.rw2', '.raf'
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB por imagen
const MAX_FILES = 10;                   // Máximo de imágenes por post

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        // Nombre único y seguro: nunca usamos el nombre original del cliente
        const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        cb(null, unique);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new Error(
            `Formato no permitido (${ext || 'sin extensión'}). ` +
            'Usa JPG, JPEG, PNG, HEIC o RAW.'
        ));
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    }
});

// ---------- Fotos de perfil ----------
// Solo formatos que el navegador puede mostrar como avatar.
const AVATAR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const MAX_AVATAR_SIZE = 6 * 1024 * 1024; // 6 MB

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const unique = `avatar-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        cb(null, unique);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: MAX_AVATAR_SIZE,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!AVATAR_EXTENSIONS.has(ext)) {
            return cb(new Error('La foto de perfil debe ser JPG, JPEG, PNG, WEBP, GIF o AVIF.'));
        }

        cb(null, true);
    }
});

// Ejecuta multer para un único archivo "avatar" y convierte sus errores
// en un mensaje legible (req.uploadError) para volver a mostrar el formulario.
const uploadAvatar = (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                req.uploadError = `La foto de perfil debe pesar como máximo ${MAX_AVATAR_SIZE / (1024 * 1024)} MB.`;
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                req.uploadError = 'Solo puedes subir una foto de perfil.';
            } else {
                req.uploadError = err.message || 'No se pudo subir la foto de perfil.';
            }
        }

        next();
    });
};

// Borra una foto de perfil antigua del disco. Solo acepta rutas generadas
// por nosotros dentro de /uploads/avatars para evitar rutas arbitrarias.
const removeAvatarFile = (url) => {
    if (typeof url !== 'string') return;
    if (!/^\/uploads\/avatars\/[A-Za-z0-9._-]+$/.test(url)) return;

    const file = path.join(__dirname, '../../public', url);
    fs.unlink(file, () => {});
};

// Middleware que ejecuta multer y convierte sus errores en un mensaje
// legible para volver a mostrar el formulario sin romper la petición.
const uploadPostImages = (req, res, next) => {
    upload.array('images', MAX_FILES)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                req.uploadError = `Cada imagen debe pesar como máximo ${MAX_FILE_SIZE / (1024 * 1024)} MB.`;
            } else if (err.code === 'LIMIT_FILE_COUNT') {
                req.uploadError = `Puedes subir un máximo de ${MAX_FILES} imágenes por post.`;
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                req.uploadError = 'Se ha enviado un número de imágenes mayor del permitido.';
            } else {
                req.uploadError = err.message || 'No se pudieron subir las imágenes.';
            }
        }

        next();
    });
};

// Elimina del disco los archivos subidos (se usa si la validación falla)
const removeUploadedFiles = (files = []) => {
    files.forEach((file) => {
        fs.unlink(file.path, () => {});
    });
};

module.exports = {
    uploadPostImages,
    uploadAvatar,
    removeUploadedFiles,
    removeAvatarFile,
    ALLOWED_EXTENSIONS,
    AVATAR_EXTENSIONS,
    MAX_FILE_SIZE,
    MAX_AVATAR_SIZE,
    MAX_FILES
};
