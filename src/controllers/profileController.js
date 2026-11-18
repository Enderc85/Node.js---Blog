const profileService = require('../services/profile.services');
const mediaService = require('../services/media.services');

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const defaultForm = (user) => ({
    name: user ? (user.name || '') : '',
    bio: user ? (user.bio || '') : '',
    featuredPostId: user && user.featuredPostId ? String(user.featuredPostId) : '',
    avatar: user ? user.avatar : null
});

// ---------- /profiles: buscador + listado público ----------

const renderProfiles = async (res, { status = 200, search = '' } = {}) => {
    const profiles = await profileService.getProfiles({ search });

    return res.status(status).render('profiles', {
        title: 'Perfiles · LuminaBlog',
        profiles,
        search
    });
};

// GET /profiles → solo buscador y ranking de perfiles
const showProfiles = async (req, res) => {
    const search = asText(req.query.q).slice(0, 80);

    try {
        return await renderProfiles(res, { search });
    } catch (error) {
        console.error('Error al cargar perfiles:', error);
        return res.status(500).render('profiles', {
            title: 'Perfiles · LuminaBlog',
            profiles: [],
            search
        });
    }
};

// ---------- /profiles/:id: perfil público de un usuario ----------

// GET /profiles/:slug → portada del usuario y feed de sus posts
const showProfile = async (req, res) => {
    const param = String(req.params.slug || '').trim();
    const viewerId = res.locals.user ? res.locals.user.id : null;

    const notFound = () => res.status(404).render('errors/404', {
        title: 'Perfil no encontrado · LuminaBlog',
        message: 'Ese perfil no existe o ha sido eliminado.'
    });

    try {
        // Enlaces antiguos por id: /profiles/3 → /profiles/nombre-del-usuario
        if (/^\d+$/.test(param)) {
            const legacy = await profileService.getProfileById(Number(param), viewerId);

            if (!legacy) return notFound();

            return res.redirect(301, `/profiles/${encodeURIComponent(legacy.slug)}`);
        }

        const profile = await profileService.getProfileBySlug(param, viewerId);

        if (!profile) return notFound();

        return res.render('profile', {
            title: `${profile.name} · LuminaBlog`,
            profile
        });
    } catch (error) {
        console.error('Error al cargar el perfil público:', error);
        return res.status(500).render('errors/500', {
            title: 'Error · LuminaBlog',
            message: 'No se pudo cargar el perfil. Inténtalo de nuevo.'
        });
    }
};

// GET /profiles/me → redirige al perfil público del usuario con sesión
const showOwnProfile = async (req, res) => {
    const user = res.locals.user;

    try {
        const profile = await profileService.getProfileById(user.id);

        if (!profile) {
            return res.status(404).render('errors/404', {
                title: 'Perfil no encontrado · LuminaBlog',
                message: 'Tu perfil no está disponible.'
            });
        }

        return res.redirect(`/profiles/${encodeURIComponent(profile.slug)}`);
    } catch (error) {
        console.error('Error al abrir el perfil propio:', error);
        return res.status(500).render('errors/500', {
            title: 'Error · LuminaBlog',
            message: 'No se pudo cargar tu perfil. Inténtalo de nuevo.'
        });
    }
};

// ---------- /personal: información y edición del perfil propio ----------

// Carga el perfil propio (con sus estadísticas) y sus posts,
// y renderiza la vista de edición.
const renderPersonal = async (res, { status = 200, error = null, form = null, saved = false } = {}) => {
    const user = res.locals.user;

    const [profiles, myPosts] = await Promise.all([
        profileService.getProfiles(),
        profileService.getOwnPosts(user.id)
    ]);

    const me = profiles.find((profile) => profile.id === user.id) || null;

    return res.status(status).render('personal', {
        title: 'Mi perfil · LuminaBlog',
        me,
        myPosts,
        error,
        saved,
        form: form || defaultForm(user),
        bioMax: profileService.BIO_MAX,
        nameMax: profileService.NAME_MAX
    });
};

// GET /personal → editor del perfil propio
const showPersonal = async (req, res) => {
    try {
        return await renderPersonal(res, {
            saved: req.query.guardado === '1'
        });
    } catch (error) {
        console.error('Error al cargar el perfil personal:', error);
        return res.status(500).render('personal', {
            title: 'Mi perfil · LuminaBlog',
            me: null,
            myPosts: [],
            error: 'No se pudo cargar tu perfil. Inténtalo de nuevo.',
            saved: false,
            form: defaultForm(res.locals.user),
            bioMax: profileService.BIO_MAX,
            nameMax: profileService.NAME_MAX
        });
    }
};

// POST /personal → guarda foto, nombre, descripción y post destacado
const updatePersonal = async (req, res) => {
    const user = res.locals.user;

    const form = {
        name: asText(req.body.name),
        bio: asText(req.body.bio),
        featuredPostId: asText(req.body.featuredPostId),
        avatar: user.avatar
    };

    const uploaded = req.file ? await mediaService.saveMedia(req.file) : undefined;
    const removeAvatar = req.body.removeAvatar === '1';

    const fail = async (message, status = 400) => {
        // Si se subió una foto pero la validación falla, no la dejamos huérfana.
        if (uploaded) await mediaService.deleteMediaByUrl(uploaded);

        try {
            return await renderPersonal(res, { status, error: message, form });
        } catch (error) {
            console.error('Error al volver a mostrar el perfil personal:', error);
            return res.status(500).send('Error interno del servidor');
        }
    };

    if (req.uploadError) {
        return fail(req.uploadError);
    }

    if (form.name.length < 2) {
        return fail('Escribe un nombre visible de al menos 2 caracteres.');
    }

    if (form.name.length > profileService.NAME_MAX) {
        return fail(`El nombre visible no puede superar los ${profileService.NAME_MAX} caracteres.`);
    }

    if (form.bio.length > profileService.BIO_MAX) {
        return fail(`La descripción no puede superar los ${profileService.BIO_MAX} caracteres.`);
    }

    try {
        await profileService.updateProfile(user.id, {
            name: form.name,
            bio: form.bio,
            avatar: uploaded || (removeAvatar ? null : undefined),
            featuredPostId: form.featuredPostId || null
        });

        // La foto anterior ya no se usa: la borramos.
        if (user.avatar && (uploaded || removeAvatar)) {
            await mediaService.deleteMediaByUrl(user.avatar);
        }

        return res.redirect('/personal?guardado=1');
    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
        return fail('No se pudo guardar tu perfil. Inténtalo de nuevo.', 500);
    }
};

module.exports = {
    showProfiles,
    showProfile,
    showOwnProfile,
    showPersonal,
    updatePersonal
};
