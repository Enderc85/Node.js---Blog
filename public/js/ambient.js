/* ===================================================
   LuminaBlog — Capa ambiente del fondo (paralaje)
   ---------------------------------------------------
   Las capas de "lluvia" (html::before/::after definidas en
   lumina-theme.css) caen por CSS. Este script añade la
   interacción con la posición del usuario: sigue el cursor
   con suavizado (lerp) y publica --mx/--my en <html>, que
   cada capa lee con un factor distinto (lejos sutil, cerca
   marcado) para dar sensación de profundidad.
   Se desactiva en táctil o con movimiento reducido.
   =================================================== */
(function () {
    'use strict';

    // Sin puntero fino (táctil) o con movimiento reducido: sin paralaje
    if (!window.matchMedia('(hover: hover)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var root = document.documentElement;
    var targetX = 0;
    var targetY = 0;
    var curX = 0;
    var curY = 0;
    var rafId = null;

    function tick() {
        rafId = null;

        // Interpolación suave hacia el objetivo: flotación, no salto
        curX += (targetX - curX) * 0.055;
        curY += (targetY - curY) * 0.055;

        root.style.setProperty('--mx', curX.toFixed(4));
        root.style.setProperty('--my', curY.toFixed(4));

        // Sigue animando mientras no haya llegado al objetivo
        if (Math.abs(targetX - curX) > 0.0008 || Math.abs(targetY - curY) > 0.0008) {
            rafId = requestAnimationFrame(tick);
        }
    }

    function wake() {
        if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', function (event) {
        // Normalizado a -1..1 respecto al centro del viewport
        targetX = (event.clientX / window.innerWidth) * 2 - 1;
        targetY = (event.clientY / window.innerHeight) * 2 - 1;
        wake();
    }, { passive: true });

    // Al salir el cursor de la ventana, el fondo vuelve al centro suavemente
    document.addEventListener('mouseleave', function () {
        targetX = 0;
        targetY = 0;
        wake();
    });
})();
