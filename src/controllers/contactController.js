const contactService = require('../services/contact.services');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LIMITS = {
    name: 80,
    email: 160,
    message: 2000
};

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

// Valida el contenido del formulario y devuelve el primer error (o null).
const validate = ({ name, email, message }) => {
    if (name.length < 2) {
        return 'Escribe tu nombre (al menos 2 caracteres).';
    }
    if (name.length > LIMITS.name) {
        return `El nombre no puede superar los ${LIMITS.name} caracteres.`;
    }
    if (!EMAIL_PATTERN.test(email)) {
        return 'Introduce un correo electrónico válido.';
    }
    if (email.length > LIMITS.email) {
        return 'El correo electrónico es demasiado largo.';
    }
    if (message.length < 10) {
        return 'Cuéntanos un poco más: el mensaje debe tener al menos 10 caracteres.';
    }
    if (message.length > LIMITS.message) {
        return `El mensaje no puede superar los ${LIMITS.message} caracteres.`;
    }
    return null;
};

const readPayload = (body) => ({
    name: asText(body && body.name),
    email: asText(body && body.email),
    message: asText(body && body.message)
});

// Valida y guarda. Devuelve { ok, error?, payload, contact? }
const saveContact = async (body) => {
    const payload = readPayload(body);
    const error = validate(payload);
    if (error) {
        return { ok: false, error, payload };
    }

    try {
        const contact = await contactService.createContact(payload);
        return { ok: true, payload, contact };
    } catch (error) {
        console.error('Error al guardar el mensaje de contacto:', error);
        return {
            ok: false,
            error: 'No se pudo enviar tu mensaje. Inténtalo de nuevo en unos minutos.',
            payload
        };
    }
};

// GET /contact → renderiza la página con los datos del usuario (si hay sesión)
const showContactPage = (req, res) => {
    const user = res.locals.user;

    res.render('contactUs', {
        title: 'Contacta con nosotros · LuminaBlog',
        sent: req.query.enviado === '1',
        error: null,
        prefillName: (user && (user.name || user.email.split('@')[0])) || '',
        prefillEmail: (user && user.email) || '',
        prefillMessage: ''
    });
};

// POST /api/contact → responde JSON (lo usa el formulario con fetch)
const submitContactJson = async (req, res) => {
    const result = await saveContact(req.body);

    if (!result.ok) {
        return res.status(400).json({ ok: false, message: result.error });
    }

    return res.status(201).json({
        ok: true,
        message: 'Mensaje recibido. ¡Gracias por escribirnos!',
        id: result.contact.id
    });
};

// POST /contact → fallback sin JavaScript (formulario tradicional)
const submitContactForm = async (req, res) => {
    const result = await saveContact(req.body);

    if (!result.ok) {
        return res.status(400).render('contactUs', {
            title: 'Contacta con nosotros · LuminaBlog',
            sent: false,
            error: result.error,
            prefillName: result.payload.name,
            prefillEmail: result.payload.email,
            prefillMessage: result.payload.message
        });
    }

    return res.redirect('/contact?enviado=1');
};

module.exports = {
    showContactPage,
    submitContactJson,
    submitContactForm
};
