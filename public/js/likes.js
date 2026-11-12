/* ===================================================
   LuminaBlog — Me gusta con micro-animación optimista
   ---------------------------------------------------
   - Al pulsar, el nuevo estado y la animación se aplican
     al instante en el cliente (sin esperar al servidor).
   - El contador rueda con un mini slide-up/down difuminado.
   - Si el servidor falla, se revierte con la animación
     inversa y una sacudida sutil del botón.
   - Sin sesión: sin optimismo; el 401/403 lleva al login
     conservando la ruta actual (comportamiento previo).
   =================================================== */
(function () {
    'use strict';

    var ROLL_CLASS = 'like-count-roll';
    var REDUCED_MOTION = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Contador tipo "rodillo" ---------- */

    function cancelRoll(span, text) {
        span.classList.remove(ROLL_CLASS);
        delete span.dataset.direction;
        span.textContent = text;
    }

    function rollCount(span, newText, direction) {
        if (!span) return;

        var previous = span.classList.contains(ROLL_CLASS)
            ? (span.querySelector('.roll-new') || {}).textContent
            : span.textContent;

        // Cancela cualquier rodillo en curso dejando el texto actual
        cancelRoll(span, previous == null ? '0' : previous);

        if (!direction || REDUCED_MOTION) {
            span.textContent = newText;
            return;
        }

        var oldEl = document.createElement('span');
        oldEl.className = 'roll-old';
        oldEl.textContent = previous == null ? '' : previous;

        var newEl = document.createElement('span');
        newEl.className = 'roll-new';
        newEl.textContent = newText;

        span.classList.add(ROLL_CLASS);
        span.dataset.direction = direction;
        span.textContent = '';
        span.append(newEl, oldEl);

        var cleanup = function () {
            // Solo limpia si este rodillo sigue siendo el vigente
            if (span.classList.contains(ROLL_CLASS) && span.contains(newEl)) {
                cancelRoll(span, newText);
            }
        };

        newEl.addEventListener('animationend', cleanup, { once: true });
        // Salvavidas si animationend no llega a dispararse
        setTimeout(cleanup, 650);
    }

    /* ---------- Efectos del botón ---------- */

    function popHeart(btn) {
        var icon = btn.querySelector('i');
        if (!icon) return;
        icon.classList.remove('like-heart-pop');
        void icon.offsetWidth; // reinicia la animación
        icon.classList.add('like-heart-pop');

        var done = false;
        var cleanup = function () {
            if (done) return;
            done = true;
            icon.classList.remove('like-heart-pop');
        };
        icon.addEventListener('animationend', cleanup, { once: true });
        // Salvavidas si animationend no dispara (pestaña en segundo plano)
        setTimeout(cleanup, 700);
    }

    function shakeButton(btn) {
        btn.classList.remove('like-failed');
        void btn.offsetWidth; // reinicia la animación
        btn.classList.add('like-failed');

        var done = false;
        var cleanup = function () {
            if (done) return;
            done = true;
            btn.classList.remove('like-failed');
        };
        btn.addEventListener('animationend', cleanup, { once: true });
        // Salvavidas si animationend no dispara (pestaña en segundo plano)
        setTimeout(cleanup, 600);
    }

    function applyState(btn, liked, count, direction, pop) {
        btn.dataset.liked = liked ? 'true' : 'false';
        btn.classList.toggle('is-liked', liked);

        var icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-solid', liked);
            icon.classList.toggle('fa-regular', !liked);
            icon.classList.toggle('text-danger', liked);
        }

        rollCount(btn.querySelector('.like-count'), String(count), direction);

        if (pop) popHeart(btn);
    }

    function readCount(btn) {
        var span = btn.querySelector('.like-count');
        if (!span) return 0;
        // Durante un rodillo el texto es "viejo+nuevo": leer el valor objetivo
        var text = span.classList.contains(ROLL_CLASS)
            ? (span.querySelector('.roll-new') || {}).textContent
            : span.textContent;
        return parseInt(text || '0', 10) || 0;
    }

    /* ---------- Toggle optimista ---------- */

    function toggleLike(btn) {
        if (!btn || !btn.dataset.postId || btn.dataset.busy === 'true') {
            return Promise.resolve();
        }

        btn.dataset.busy = 'true';

        var wasLiked = btn.dataset.liked === 'true';
        var prevCount = readCount(btn);
        var nextLiked = !wasLiked;
        var nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
        var optimistic = document.body.dataset.authenticated === 'true';

        // 1. Estado optimista + animación inmediata
        if (optimistic) {
            applyState(btn, nextLiked, nextCount, nextLiked ? 'up' : 'down', true);
        }

        // 2. Confirmación en el servidor
        return fetch('/posts/' + btn.dataset.postId + '/like', {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        })
            .then(function (response) {
                if (response.status === 401 || response.status === 403) {
                    // Sin sesión: revertir sin animación y llevar al login
                    if (optimistic) applyState(btn, wasLiked, prevCount, null, false);
                    var next = encodeURIComponent(window.location.pathname + window.location.search);
                    window.location.href = '/login?next=' + next;
                    return null;
                }

                return response.json().catch(function () {
                    // Cuerpo no-JSON (p. ej. HTML de un 502/504 de un proxy)
                    return {};
                }).then(function (data) {
                    if (!response.ok) {
                        throw new Error((data && data.message) || 'No se pudo dar me gusta');
                    }

                    // El servidor manda: sincroniza solo si difiere del optimista
                    var shownLiked = btn.dataset.liked === 'true';
                    var shownCount = readCount(btn);
                    if (String(data.liked) !== String(shownLiked) || Number(data.numLikes) !== shownCount) {
                        applyState(
                            btn,
                            data.liked,
                            data.numLikes,
                            data.liked !== shownLiked ? (data.liked ? 'up' : 'down') : null,
                            false
                        );
                    }
                });
            })
            .catch(function (error) {
                console.error('Error al dar me gusta:', error);
                if (optimistic && btn.isConnected) {
                    // Fallo del servidor: revertir con animación inversa + sacudida
                    applyState(btn, wasLiked, prevCount, wasLiked ? 'up' : 'down', false);
                    shakeButton(btn);
                }
            })
            .then(function () {
                btn.dataset.busy = 'false';
            });
    }

    // Global para los onclick del feed (posts renderizados e inyectados)
    window.toggleLike = toggleLike;

    // Botón del detalle de post (la vista usa .detail-like-btn sin onclick)
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.detail-like-btn[data-post-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                toggleLike(btn);
            });
        });
    });
})();
