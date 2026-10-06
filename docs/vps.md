# Diagnóstico en un VPS sin escritorio

Ejecuta los comandos desde la carpeta que contiene `package.json`, con Node.js,
Chrome y Xvfb instalados. `.env` se configura a partir de `.env.example`.
Usa BROWSER_HEADLESS=false para Chrome dentro de la pantalla virtual de Xvfb.
Elimina HEADLESS de `.env` y del entorno; `env -u HEADLESS` solo elimina la variable
heredada, no una entrada que Node vuelva a leer desde `.env`.

## Prueba de acceso

Cada ejecución usa una carpeta nueva para no confundir evidencia anterior con
el resultado actual. Esta prueba obtiene el formulario sin enviar una consulta.

```sh
CEJ_RUN_DIR="./output/vps-$(date +%Y%m%d-%H%M%S)"
env -u HEADLESS BROWSER_MODE=local BROWSER_HEADLESS=false \
  FORM_TIMEOUT_MS=60000 OUTPUT_DIRECTORY="$CEJ_RUN_DIR" \
  xvfb-run -a npm run once
cat "$CEJ_RUN_DIR/diagnostico.json"
```

El último comando sirve cuando hay un fallo de acceso y se genera diagnóstico.
Si obtiene el formulario, crea `formulario.json`, `formulario.html` y `formulario.png`.
Los fallos anteriores a abrir la página, como un error al iniciar Chrome, pueden
no generar esos archivos; en ese caso revisa la salida de la terminal.

## Estados de la espera

- `loading`: el documento todavía no terminó de cargar.
- `unknown`: el documento terminó de cargar, pero no se reconoce el formulario.
- `radware`: se reconoció una pantalla de verificación de Radware.
- `captcha`: se detectó un widget reCAPTCHA, Turnstile o hCaptcha.
- `blocked`: la página muestra un rechazo explícito, incluyendo Forbidden.

La espera predeterminada del formulario es de 300000 ms, cinco minutos.
Durante la espera se informa el título y los segundos restantes cada diez segundos.
Un bloqueo explícito o un HTTP 403 termina la prueba y guarda diagnóstico.
Reconocer un widget hCaptcha no significa que el solver de imagen del CEJ pueda
resolverlo: puede requerir intervención o un adaptador compatible.

## Capturas y resultado completo

`acceso-inicial.png` muestra la página antes de empezar a esperar el formulario.
Se guarda cuando la navegación no termina inmediatamente con un error HTTP.
`diagnostico.png` y `diagnostico.json` muestran el estado al fallar la prueba.
Puedes descargar las imágenes al equipo con escritorio mediante scp.

`npm start` obtiene el formulario y conserva la sesión. Para llenar la consulta
y validar la identidad usa `npm run query -- --once` bajo Xvfb. Necesitas configurar
el archivo privado `data/consultant-identity.json`; no está incluido en Git.
El éxito de la identidad requiere `accepted: true`, `status: "OK"` y el estado
`identity-validated` en `consulta-final.json`.

Un diagnóstico de bloqueo describe la respuesta observada. No demuestra por sí
solo que la IP esté bloqueada permanentemente ni que cambiarla resuelva el acceso.

[Configuración del proxy](proxy.md) explica PROXY_URL y `npm run proxy:check`.
Si el estado es `radware/hcaptcha`, Radware exige «Soy humano» y Submit;
el OCR de letras del CEJ no resuelve ese desafío y Xvfb no ofrece interacción visible.
