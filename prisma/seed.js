const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed de la base de datos...');

    // 1. Limpiar datos existentes en orden inverso de dependencias
    await prisma.contact.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.deleteMany();
    await prisma.images.deleteMany();
    await prisma.comment.deleteMany();

    console.log('🧹 Tablas limpiadas correctamente.');

    // 2. Crear Usuarios (con contraseñas hasheadas reales)
    const passwordHash = await bcrypt.hash('password123', 10);

    const user1 = await prisma.user.create({
        data: {
            email: 'elena@blog.com',
            name: 'Elena García',
            password: passwordHash,
        }
    });

    const user2 = await prisma.user.create({
        data: {
            email: 'marcos@blog.com',
            name: 'Marcos Soler',
            password: passwordHash,
        }
    });

    const user3 = await prisma.user.create({
        data: {
            email: 'sara@blog.com',
            name: 'Sara Vega',
            password: passwordHash,
        }
    });

    console.log('👤 Usuarios creados: 3');

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
            numLikes: 342,
            numComments: 18,
            authorId: user1.id
        }
    });

    const post2 = await prisma.post.create({
        data: {
            title: 'Rutas Ocultas en los Fiordos Noruegos',
            slug: 'rutas-ocultas-en-los-fiordos-noruegos',
            content: 'Los fiordos de Noruega representan la máxima expresión de la grandiosidad natural en Europa. Las paredes rocosas que se sumergen verticalmente en aguas gélidas crean juegos de niebla y profundidad inigualables.\n\nRecomiendo trabajar con filtros polarizadores para cortar los reflejos en las superficies húmedas y enfatizar los verdes musgosos característicos de la región escandinava.',
            image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
            numLikes: 512,
            numComments: 45,
            authorId: user2.id
        }
    });

    const post3 = await prisma.post.create({
        data: {
            title: 'Metrópolis de Neón: Fotografía Nocturna en la Gran Ciudad',
            slug: 'metropolis-de-neon-fotografia-nocturna',
            content: 'Cuando el sol se oculta, las grandes capitales despiertan con una paleta cromática totalmente distinta. Los carteles luminosos, los faros de tráfico y los escaparates proporcionan una iluminación dinámica y cinematográfica.\n\nUn trípode robusto y velocidades de obturación entre 1 y 4 segundos permitirán trazar estelas de luz mientras se mantiene la nitidez en las estructuras urbanas.',
            image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80',
            numLikes: 420,
            numComments: 29,
            authorId: user3.id
        }
    });

    const post4 = await prisma.post.create({
        data: {
            title: 'Minimalismo y Geometría en la Arquitectura Moderna',
            slug: 'minimalismo-y-geometria-en-la-arquitectura-moderna',
            content: 'Aislar formas, patrones repetitivos y texturas limpias es la clave del enfoque minimalista en la fotografía de arquitectura. Menos es más: eliminar elementos distractores de la composición fortalece la fuerza visual de la estructura.',
            image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
            numLikes: 189,
            numComments: 12,
            authorId: user1.id
        }
    });

    const post5 = await prisma.post.create({
        data: {
            title: 'Secretos de la Composición en Paisajes de Niebla',
            slug: 'secretos-de-la-composicion-en-paisajes-de-niebla',
            content: 'La niebla actúa como un difusor natural gigante que simplifica los fondos complejos y añade misterio y atmósfera. Utilizar un teleobjetivo comprime los planos y realza las siluetas fantasmales de los árboles.',
            image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
            numLikes: 275,
            numComments: 8,
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

    // 6. Crear Comentarios
    await prisma.comment.createMany({
        data: [
            { content: '¡Fotografía inspiradora y consejos muy prácticos!' },
            { content: 'Me encanta la edición y los tonos que has conseguido en esta toma.' },
            { content: 'Totalmente de acuerdo con el uso del polarizador en paisajes.' },
            { content: 'Esperando con ganas la siguiente publicación de la serie.' }
        ]
    });

    console.log('💬 Comentarios creados: 4');

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

