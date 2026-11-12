/* ===================================================
   LuminaBlog — Ajuste automático de medios
   Fija el aspect-ratio de cada foto del feed y del
   detalle a partir de su resolución natural, para que:
   - El navegador reserve el hueco antes de cargar (sin saltos)
   - Cada post adapte su altura a la proporción real de la imagen
   Funciona con imágenes renderizadas por el servidor y con
   las que inyecta el infinite scroll (captura del evento load).
   =================================================== */
(function () {
    'use strict';

    var SELECTOR = 'img.post-image, img.post-detail-image';

    function fitImage(img) {
        if (!img || img.dataset.mediaFit === '1') return;

        var apply = function () {
            var w = img.naturalWidth;
            var h = img.naturalHeight;
            if (w > 0 && h > 0) {
                // Reserva el hueco con la proporción real; el tope de
                // altura lo aplica el CSS (max-height + object-fit: contain)
                img.style.aspectRatio = w + ' / ' + h;
            }
            img.dataset.mediaFit = '1';
        };

        if (img.complete && img.naturalWidth > 0) {
            apply();
        } else {
            img.addEventListener('load', apply, { once: true });
            img.addEventListener('error', function () {
                img.dataset.mediaFit = '1';
            }, { once: true });
        }
    }

    function scanAll() {
        document.querySelectorAll(SELECTOR).forEach(fitImage);
    }

    // Los eventos load en fase de captura burbujean desde cualquier
    // imagen (incluidas las añadidas después por el infinite scroll)
    document.addEventListener('load', function (event) {
        var target = event.target;
        if (target && target.matches && target.matches(SELECTOR)) {
            fitImage(target);
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanAll);
    } else {
        scanAll();
    }
})();
