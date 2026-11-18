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

        const item = buildCommentItem(data.comment, data.comment.authorSlug);

        // Respuesta a un comentario: se cuelga de su lista de respuestas
        if (data.comment.parentId) {
            const parent = section.querySelector(
                `.comment-item[data-comment-id="${data.comment.parentId}"]`
            );
            const body = parent && parent.querySelector(':scope > .comment-body');

            if (body) {
                let replies = body.querySelector(':scope > .comment-replies');

                if (!replies) {
                    replies = document.createElement('ul');
                    replies.className = 'comment-replies';
                    body.appendChild(replies);
                }

                replies.appendChild(item);
                return;
            }
        }

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

    function buildCommentItem(comment, authorSlug) {
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

        if (authorSlug) {
            const link = document.createElement('a');
            link.className = 'comment-author-link';
            link.href = '/profiles/' + encodeURIComponent(authorSlug);
            link.title = 'Ver el perfil de ' + name;
            link.textContent = name;
            authorName.appendChild(link);
        } else {
            authorName.textContent = name;
        }

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

        // Formulario de respuesta para los comentarios que llegan en vivo
        if (document.body.dataset.authenticated === 'true') {
            body.appendChild(buildReplyForm(comment.id, name));
        }

        item.append(avatar, body);

        return item;
    }

    function buildReplyForm(commentId, authorName) {
        const details = document.createElement('details');
        details.className = 'comment-reply';

        const summary = document.createElement('summary');
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-reply';
        summary.append(icon, document.createTextNode(' Responder'));

        const form = document.createElement('form');
        form.className = 'comment-reply-form';
        form.method = 'POST';

        const section = document.querySelector('#comentarios[data-post-id]');
        const postId = section ? section.dataset.postId : '';
        form.action = '/posts/' + postId + '/comments';

        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'parentId';
        hidden.value = commentId;

        const textarea = document.createElement('textarea');
        textarea.name = 'content';
        textarea.rows = 2;
        textarea.maxLength = 1000;
        textarea.required = true;
        textarea.placeholder = 'Responde a ' + authorName + '...';

        const actions = document.createElement('div');
        actions.className = 'comment-form-actions';

        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'btn-post-primary comment-reply-submit';
        button.textContent = 'Publicar respuesta';

        actions.appendChild(button);
        form.append(hidden, textarea, actions);
        details.append(summary, form);

        return details;
    }
})();
