# Proxy con salida en Perú

Necesitas Node.js 22.12 o superior, Chrome instalado y BROWSER_MODE=local.
Guarda la cadena del generador en el `.env` privado, sin subirla a Git:

```dotenv
BROWSER_MODE=local
BROWSER_HEADLESS=false
PROXY_URL="https://proxy.example:1001:usuario:clave_country-PE_session-example1_lifetime-30"
PROXY_CHECK_URL=https://ip.evomi.com/
PROXY_EXPECTED_COUNTRY=PE
```

El ejemplo usa credenciales ficticias. Copia tu cadena completa; el host, puerto,
usuario y contraseña deben coincidir con el generador. También admite el formato
estándar `https://usuario:clave@proxy.example:1001`. En el generador de Evomi,
elige Perú, Sticky Session, una sesión y 30 minutos. La ciudad es opcional.
Si la cadena no incluye lifetime, Evomi aplica el valor predeterminado de su sesión.

El endpoint `/` de ip.evomi.com informa país e IP en JSON; `/s` devuelve solamente
la IP y no sirve para verificar el país. PROXY_CHECK_URL permite otro endpoint
que devuelva IP (`ip` o `query`) y país (`countryCode`, `country_code` o `country.code`).

## Comprobar la salida y el acceso

En el equipo local:

```sh
npm install
CEJ_RUN_DIR="./output/proxy-$(date +%Y%m%d-%H%M%S)"
FORM_TIMEOUT_MS=60000 OUTPUT_DIRECTORY="$CEJ_RUN_DIR" npm run proxy:check
cat "$CEJ_RUN_DIR/proxy-ip.json"
```

En el VPS, desde la carpeta del proyecto:

```sh
npm install
CEJ_RUN_DIR="./output/proxy-$(date +%Y%m%d-%H%M%S)"
env -u HEADLESS BROWSER_HEADLESS=false FORM_TIMEOUT_MS=60000 \
  OUTPUT_DIRECTORY="$CEJ_RUN_DIR" xvfb-run -a npm run proxy:check
cat "$CEJ_RUN_DIR/proxy-ip.json"
```

`accepted: true` y `country: "PE"` prueban que Chrome obtuvo una IP peruana.
Después se intenta obtener el formulario y se cierra el navegador. El éxito de
la IP no implica que el CEJ acepte la conexión: revisa `formulario.json` o,
si falla, `diagnostico.json` y `diagnostico.png` en esa misma carpeta.
Cada carpeta de ejecución nueva evita confundir evidencia de intentos anteriores.
Un HTTP 402 del proveedor proxy exige revisar Statistics / Subscription: puede
haber vencido la prueba o faltar tráfico disponible. Un 401/407 señala un rechazo
de autenticación. Esas respuestas del proxy son distintas de un bloqueo del CEJ.

## Consulta y Radware

La conexión proxy se aplica también a `npm start`, `npm run once` y `npm run query`.
El arranque habitual deja la página abierta en Chrome antes de conectar CDP;
`proxy:check` conecta primero para verificar la IP antes de visitar el CEJ.
La consulta usa el archivo privado de identidad y la configuración existentes:

```sh
npm run query
```

Si Radware muestra «Soy humano», hay que completar hCaptcha y pulsar Submit
durante la espera en Chrome visible. El bot detecta `radware/hcaptcha` y explica
esa intervención. El OCR del CAPTCHA de letras del CEJ no resuelve hCaptcha.
Un VPS con Xvfb guarda capturas, pero no proporciona una interfaz para resolverlo;
para intervención necesitas acceso al escritorio o una conexión remota apropiada.
Si persiste el desafío, el bot termina con diagnóstico al vencer FORM_TIMEOUT_MS.

## Sesión y credenciales

El puente escucha solo en 127.0.0.1 y envía las credenciales al proveedor desde
el arranque. Chrome no recibe la contraseña en sus argumentos. HTTPS al proxy
verifica el certificado y usa el nombre del host del proveedor para TLS.
Al cerrar Chrome se cierra el puente; los fallos no activan una conexión directa.
Se bloquean peticiones de fondo a mtalk.google.com, update.googleapis.com,
clients2.google.com y optimizationguide-pa.googleapis.com para reducir tráfico
ajeno a la consulta. Otros recursos necesarios del sitio siguen pasando por el proxy.

El perfil y el archivo de cookies llevan un sufijo derivado del proxy, país y sesión.
Cambiar la cadena crea un contexto separado; las credenciales no aparecen en esas rutas.
Con proxy, cierra la instancia anterior con Ctrl+C antes de iniciar otra sobre
el mismo perfil: su puente pertenece a la ejecución anterior.
Los modos real, cdp y browserless rechazan PROXY_URL para evitar una salida distinta
de la configurada. Deja PROXY_URL vacío si quieres volver a la conexión directa.
`.env`, los perfiles y los resultados permanecen excluidos de Git.
