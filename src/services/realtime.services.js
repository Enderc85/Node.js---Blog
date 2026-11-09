// Servidor SSE (Server-Sent Events) para actualizar likes y comentarios
// en vivo, sin recargar la página ni añadir dependencias externas.
//
// Cada navegador conectado a GET /events mantiene una respuesta HTTP abierta.
// `broadcast(event, data)` escribe un evento en todas esas conexiones.

const clients = new Set();

const heartbeat = setInterval(() => {
    for (const client of clients) {
        try {
            client.write(': ping\n\n');
        } catch (error) {
            clients.delete(client);
        }
    }
}, 25000);

// No mantenemos vivo el proceso solo por el latido
if (typeof heartbeat.unref === 'function') heartbeat.unref();

const removeClient = (res) => {
    clients.delete(res);
};

// GET /events → abre la conexión SSE con este navegador
const addClient = (req, res) => {
    res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('retry: 3000\n\n');

    clients.add(res);

    req.on('close', () => removeClient(res));
    req.on('error', () => removeClient(res));
    res.on('error', () => removeClient(res));
};

// Envía un evento a todos los navegadores conectados.
// `data` debe ser serializable a JSON.
const broadcast = (event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of clients) {
        try {
            client.write(payload);
        } catch (error) {
            clients.delete(client);
        }
    }
};

module.exports = {
    addClient,
    broadcast,
    clients
};
