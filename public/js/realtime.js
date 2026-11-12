// Actualizaciones en vivo (SSE) de likes y comentarios.
// El contador se actualiza en todas las pestañas y usuarios conectados.
(function () {
    if (!window.EventSource) return;

    const source = new EventSource('/events');

    const setText = (selector, value) => {
        document.querySelectorAll(selector).forEach((el) => {
            el.textContent = value;
        });
    };

    const parse = (event) => {
        try {
            return JSON.parse(event.data);
        } catch (error) {
            return null;
        }
    };

    source.addEventListener('like', (event) => {
        const data = parse(event);
        if (!data || !data.postId) return;

        document.querySelectorAll(`[data-post-id="${data.postId}"] .like-count`).forEach((el) => {
            // No pisar la animación en curso ni el estado optimista
            // de un clic propio (el toggle sincronizará con el servidor)
            const btn = el.closest('[data-busy]');
            if (el.classList.contains('like-count-roll')) return;
            if (btn && btn.dataset.busy === 'true') return;
            el.textContent = data.numLikes;
        });
    });

    source.addEventListener('comment', (event) => {
        const data = parse(event);
        if (!data || !data.postId) return;

        setText(`[data-post-id="${data.postId}"] .comment-count`, data.numComments);
        setText(`[data-post-id="${data.postId}"] .comments-count`, data.numComments);
        appendComment(data);
    });

    // Añade el comentario nuevo a la lista si estamos viendo ese post
    function appendComment(data) {
        if (!data.comment) return;

        const section = document.querySelector(`#comentarios[data-post-id="${data.postId}"]`);
        if (!section) return;

        // Evita duplicados si el comentario ya venía renderizado
        if (section.querySelector(`[data-comment-id="${data.comment.id}"]`)) return;

        const item = buildCommentItem(data.comment);
        const list = section.querySelector('.comment-list');

        if (list) {
            list.prepend(item);
            return;
        }

        const emptyState = section.querySelector('.comment-empty');
        if (emptyState) emptyState.remove();

        const newList = document.createElement('ul');
        newList.className = 'comment-list';
        newList.appendChild(item);
        section.appendChild(newList);
    }

    function buildCommentItem(comment) {
        const author = comment.author || {};
        const name = author.name || (author.email ? author.email.split('@')[0] : 'Anónimo');

        const item = document.createElement('li');
        item.className = 'comment-item';
        item.dataset.commentId = comment.id;

        const avatar = document.createElement('span');
        avatar.className = 'comment-avatar';
        avatar.textContent = name.charAt(0).toUpperCase();

        const body = document.createElement('div');
        body.className = 'comment-body';

        const head = document.createElement('div');
        head.className = 'comment-head';

        const authorName = document.createElement('strong');
        authorName.textContent = name;

        const time = document.createElement('time');
        const date = new Date(comment.createdAt);
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        head.append(authorName, time);

        const content = document.createElement('p');
        content.textContent = comment.content;

        body.append(head, content);
        item.append(avatar, body);

        return item;
    }
})();
