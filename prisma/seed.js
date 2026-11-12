const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed de la base de datos...');

    // 1. Limpiar datos existentes en orden inverso de dependencias
    await prisma.like.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.deleteMany();
    await prisma.images.deleteMany();

    console.log('🧹 Tablas limpiadas correctamente.');

    // 2. Crear Usuarios (con contraseñas hasheadas reales)
    const passwordHash = await bcrypt.hash('password123', 10);

    const user1 = await prisma.user.create({
        data: {
            email: 'elena@blog.com',
            name: 'Elena García',
            password: passwordHash,
            bio: 'Fotógrafa de paisajes y luz natural. Persigo amaneceres con niebla y caminos que no salen en los mapas.'
        }
    });

    const user2 = await prisma.user.create({
        data: {
            email: 'marcos@blog.com',
            name: 'Marcos Soler',
            password: passwordHash,
            bio: 'Viajero y fotógrafo de arquitectura. Me pierdo entre fiordos, líneas y ciudades que nunca duermen.'
        }
    });

    const user3 = await prisma.user.create({
        data: {
            email: 'sara@blog.com',
            name: 'Sara Vega',
            password: passwordHash,
            bio: 'Retratos y fotografía nocturna. Me interesa la luz que aparece cuando todos se van a dormir.'
        }
    });

    // Usuario administrador de desarrollo (cambia la contraseña en producción)
    await prisma.user.create({
        data: {
            email: 'admin@blog.com',
            name: 'Administrador',
            password: passwordHash,
            role: 'ADMIN',
            bio: 'Detrás de LuminaBlog. Cuidando la comunidad y aprendiendo de cada historia que se comparte.'
        }
    });

    console.log('👤 Usuarios creados: 4 (1 administrador)');
    console.log('👑 Admin de desarrollo: admin@blog.com / password123');

    // 3. Crear Categorías
    const categories = await Promise.all([
        prisma.category.create({ data: { name: 'Paisajes' } }),
        prisma.category.create({ data: { name: 'Retratos' } }),
        prisma.category.create({ data: { name: 'Arquitectura' } }),
        prisma.category.create({ data: { name: 'Nocturna' } }),
        prisma.category.create({ data: { name: 'Naturaleza' } }),
    ]);

    console.log('🏷️  Categorías creadas: ' + categories.length);

    // 4. Crear Posts (con slugs únicos y relaciones con autores)
    const post1 = await prisma.post.create({
        data: {
            title: 'Luz Dorada: El Arte de Fotografiar al Amanecer',
            slug: 'luz-dorada-el-arte-de-fotografiar-al-amanecer',
            content: 'Fotografiar durante la hora dorada ofrece una de las experiencias visuales más gratificantes para cualquier fotógrafo. La suave inclinación de los rayos solares disminuye el contraste extremo y baña las escenas en tonalidades ámbar y miel.\n\nPara aprovecharla al máximo, es vital llegar al menos 30 minutos antes de la salida del sol, estudiar el terreno y medir la exposición teniendo cuidado de no quemar las altas luces en el cielo.',
            image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80',
            authorId: user1.id
        }
    });

    const post2 = await prisma.post.create({
        data: {
            title: 'Rutas Ocultas en los Fiordos Noruegos',
            slug: 'rutas-ocultas-en-los-fiordos-noruegos',
            content: 'Los fiordos de Noruega representan la máxima expresión de la grandiosidad natural en Europa. Las paredes rocosas que se sumergen verticalmente en aguas gélidas crean juegos de niebla y profundidad inigualables.\n\nRecomiendo trabajar con filtros polarizadores para cortar los reflejos en las superficies húmedas y enfatizar los verdes musgosos característicos de la región escandinava.',
            image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
            authorId: user2.id
        }
    });

    const post3 = await prisma.post.create({
        data: {
            title: 'Metrópolis de Neón: Fotografía Nocturna en la Gran Ciudad',
            slug: 'metropolis-de-neon-fotografia-nocturna',
            content: 'Cuando el sol se oculta, las grandes capitales despiertan con una paleta cromática totalmente distinta. Los carteles luminosos, los faros de tráfico y los escaparates proporcionan una iluminación dinámica y cinematográfica.\n\nUn trípode robusto y velocidades de obturación entre 1 y 4 segundos permitirán trazar estelas de luz mientras se mantiene la nitidez en las estructuras urbanas.',
            image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80',
            authorId: user3.id
        }
    });

    const post4 = await prisma.post.create({
        data: {
            title: 'Minimalismo y Geometría en la Arquitectura Moderna',
            slug: 'minimalismo-y-geometria-en-la-arquitectura-moderna',
            content: 'Aislar formas, patrones repetitivos y texturas limpias es la clave del enfoque minimalista en la fotografía de arquitectura. Menos es más: eliminar elementos distractores de la composición fortalece la fuerza visual de la estructura.',
            image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
            authorId: user1.id
        }
    });

    const post5 = await prisma.post.create({
        data: {
            title: 'Secretos de la Composición en Paisajes de Niebla',
            slug: 'secretos-de-la-composicion-en-paisajes-de-niebla',
            content: 'La niebla actúa como un difusor natural gigante que simplifica los fondos complejos y añade misterio y atmósfera. Utilizar un teleobjetivo comprime los planos y realza las siluetas fantasmales de los árboles.',
            image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
            authorId: user2.id
        }
    });

    console.log('📝 Posts creados: 5');

    // 5. Crear Contactos (vinculados a posts)
    await prisma.contact.createMany({
        data: [
            {
                name: 'Carlos Mendoza',
                email: 'carlos@mendoza.com',
                message: 'Excelente artículo sobre la hora dorada, me ha servido mucho para mi sesión de este fin de semana.',
                postId: post1.id
            },
            {
                name: 'Beatriz Alonso',
                email: 'beatriz@alonso.com',
                message: '¿Qué época del año recomendarías para viajar a los fiordos sin encontrar demasiadas lluvias?',
                postId: post2.id
            },
            {
                name: 'Javier Navarro',
                email: 'javier@navarro.com',
                message: 'Gran post sobre fotografía nocturna. ¿Qué ISO usas habitualmente para evitar grano?',
                postId: post3.id
            }
        ]
    });

    console.log('📬 Contactos creados: 3');

    // 6. Crear Comentarios (vinculados a un post y a un autor registrado)
    const comments = [
        { content: '¡Fotografía inspiradora y consejos muy prácticos!', postId: post1.id, authorId: user2.id },
        { content: 'Me encanta la edición y los tonos que has conseguido en esta toma.', postId: post1.id, authorId: user3.id },
        { content: 'Totalmente de acuerdo con el uso del polarizador en paisajes.', postId: post2.id, authorId: user1.id },
        { content: 'Esperando con ganas la siguiente publicación de la serie.', postId: post3.id, authorId: user1.id }
    ];

    await prisma.comment.createMany({ data: comments });

    console.log(`💬 Comentarios creados: ${comments.length}`);

    // 6b. Crear Me gusta de ejemplo (una fila por usuario y post)
    const likes = [
        { postId: post1.id, userId: user2.id },
        { postId: post1.id, userId: user3.id },
        { postId: post2.id, userId: user1.id },
        { postId: post2.id, userId: user3.id },
        { postId: post3.id, userId: user1.id },
        { postId: post4.id, userId: user2.id },
        { postId: post5.id, userId: user1.id },
        { postId: post5.id, userId: user3.id }
    ];

    await prisma.like.createMany({ data: likes });

    console.log(`❤️  Me gusta creados: ${likes.length}`);

    // 6c. Sincronizar contadores con las filas reales
    const allPosts = [post1, post2, post3, post4, post5];
    for (const post of allPosts) {
        await prisma.post.update({
            where: { id: post.id },
            data: {
                numLikes: likes.filter((like) => like.postId === post.id).length,
                numComments: comments.filter((comment) => comment.postId === post.id).length
            }
        });
    }

    console.log('🔢 Contadores de likes y comentarios sincronizados.');

    // 7. Crear Galería de Imágenes (Images)
    await prisma.images.createMany({
        data: [
            { url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80', category: 'Retratos' },
            { url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80', category: 'Paisajes' },
            { url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80', category: 'Nocturna' },
            { url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80', category: 'Arquitectura' },
            { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80', category: 'Naturaleza' },
            { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80', category: 'Retratos' },
            { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80', category: 'Retratos' },
            { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80', category: 'Naturaleza' }
        ]
    });

    console.log('🖼️  Imágenes creadas: 8');

    console.log('✅ ¡Seed completado con éxito!');
}

main()
    .catch((e) => {
        console.error('❌ Error ejecutando seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

