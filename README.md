# Bot del CEJ

Bot JavaScript para obtener el formulario de
[Consulta de Expedientes Judiciales](https://cej.pj.gob.pe/cej/forms/busquedaform.html).
La primera fase abre la página, espera el formulario real y exporta sus controles,
HTML y captura. `npm run query` ingresa los datos solicitados, rellena el modal
de identidad y pulsa Validar. [Instrucciones de consulta](docs/query.md).

## Ejecutar

Necesitas Node.js 22 o superior y Google Chrome instalado. En Linux, el modo
visible necesita una sesión gráfica; para servidores configura BROWSER_HEADLESS=true.

```sh
npm install
cp .env.example .env
npm start
```

`npm start` conserva el navegador y la conexión abiertos después de capturar.
Ctrl+C guarda las cookies y cierra la pestaña del bot. Termina Chrome si lo inició
esta ejecución; si reutilizó uno abierto, conserva sus demás pestañas. Para capturar y cerrar:

```sh
npm run once
```

Si aparece Radware, el bot espera hasta FORM_TIMEOUT_MS, sin recargar la página.
Puedes completar un desafío manualmente en Chrome durante esa espera.
Al vencer el plazo, guarda un diagnóstico y termina. Un HTTP 200 de Radware
no cuenta como formulario obtenido. HTTP 429 y errores 5xx detienen el flujo.
Un HTTP 403 o una página Forbidden también detienen el flujo y guardan diagnóstico.
Antes de esperar se guarda `output/acceso-inicial.*`, incluyendo una captura.
La terminal muestra el estado, título y segundos restantes cada diez segundos.
`unknown` indica que la página terminó de cargar pero no se reconoció el formulario.
En un VPS sin escritorio, puedes ejecutar Chrome visible con `xvfb-run -a npm run once`.
[Diagnóstico en VPS](docs/vps.md) explica cómo revisar esos estados y capturas.

## Resultado

- `output/formulario.json`: campos, selectores, etiquetas y opciones disponibles.
- `output/formulario.html`: DOM completo de la página renderizada.
- `output/formulario.png`: captura visual.
- `output/diagnostico.*`: evidencia de una captura fallida.
- `data/visible-query-cookies.json`: cookies vigentes del dominio objetivo.
- `data/visible-query-profile/`: perfil persistente, incluyendo almacenamiento local.
- `data/visible-query-profile/cej-browser.json`: endpoint CDP del navegador, verificado antes de reutilizarlo.

El JSON separa los campos propios del formulario de `sharedFields`: en el CEJ,
Parte, código CAPTCHA y Consultar están fuera de la etiqueta form.
También registra las imágenes CAPTCHA visibles en `captchaImages`.
Instancia y especialidad cargan sus opciones después de seleccionar un distrito.
`required` refleja el atributo HTML; algunas validaciones del CEJ son JavaScript.
Las capturas contienen el estado del momento, incluido el CAPTCHA, que expira.

## Navegadores y sesión

Configura BROWSER_MODE en `.env`:

| Modo | Conexión |
| --- | --- |
| real | puppeteer-real-browser con Chrome visible, perfil dedicado y CDP. |
| local | Chrome instalado y Puppeteer Core, con CDP estándar. |
| cdp | Chrome existente mediante CDP_ENDPOINT HTTP(S) o WS(S). |
| browserless | Browserless mediante BROWSERLESS_ENDPOINT y BROWSERLESS_TOKEN. |

El modo predeterminado es local: Chrome abre la URL y espera 15 segundos antes
de conectar Puppeteer; BROWSER_STARTUP_DELAY_MS controla esa espera.
Si Chrome del perfil ya está abierto, se verifica su WebSocket activo y se crea
una pestaña propia. No se intenta levantar otro puerto sobre el mismo perfil.
Antes de conectar se comprueba `/json/version`; un puerto antiguo no basta para
identificar el navegador. El arranque fallido termina solo el proceso recién creado.
Usa BROWSER_HEADLESS; la variable HEADLESS activa el modo oculto en Chrome Launcher
incluso si su valor es `false`, y el bot la rechaza para evitar esa confusión.
Se conserva la página cargada. Usa perfil y archivo de cookies distintos por instancia;
no reutilices tu perfil personal de Chrome. USER_AGENT vacío conserva el agente
original; si lo configuras, procura que corresponda al navegador y sistema reales.
El arranque directo conserva idioma y zona horaria del Chrome nativo.
TIMEZONE y ACCEPT_LANGUAGE se aplican a las otras conexiones. Se mantiene una identidad estable
entre ejecuciones mediante el perfil y las cookies, sin rotar agentes al azar.
Las cookies ya vigentes del navegador tienen prioridad sobre el respaldo en JSON.

El heartbeat consulta el navegador y guarda cookies; no hace peticiones al CEJ.
La pestaña mantiene el foco emulado mediante Puppeteer para que las animaciones
y las interacciones no se suspendan al dejar Chrome en segundo plano.
No prolonga los límites máximos impuestos por un proveedor remoto. CDP y
Browserless liberan la conexión y la pestaña propia, sin cerrar otras pestañas.
La duración de la sesión remota depende del servicio. Solo se restauran cookies
en estos modos; el almacenamiento local completo permanece en el perfil local.

[nodriver](https://github.com/ultrafunkamsterdam/nodriver) es una biblioteca Python.
Este proyecto usa una alternativa JavaScript con conexión por CDP.
[puppeteer-real-browser](https://github.com/ZFC-Digital/puppeteer-real-browser)
anuncia que ya no recibe actualizaciones; queda aislado detrás de un adaptador
para sustituirlo. No existe garantía universal de acceso frente a Radware.

## CAPTCHA

El `.env.example` usa OCR local y audio accesible como respaldo. Obtener el
formulario del CEJ no requiere resolver su CAPTCHA de consulta. Para usar el
[SDK oficial de 2Captcha](https://github.com/2captcha/2captcha-javascript), configura:

```dotenv
CAPTCHA_MODE=2captcha
TWOCAPTCHA_API_KEY=tu_clave
CAPTCHA_TYPE=image
CAPTCHA_TRIGGER_SELECTOR="#captcha_image"
CAPTCHA_IMAGE_SELECTOR="#captcha_image"
CAPTCHA_RESPONSE_SELECTOR="#codigoCaptcha"
```

El proveedor cobra por cada tarea enviada. El adaptador soporta imagen,
reCAPTCHA v2 y Turnstile estándar. No es un solver específico de Radware;
desafíos con parámetros dinámicos adicionales necesitan adaptar la integración.
Los tokens usan CAPTCHA_RESPONSE_SELECTOR y, si procede, CAPTCHA_CALLBACK
como nombre de función accesible, por ejemplo `app.onCaptchaSolved`.
CAPTCHA_SUBMIT_SELECTOR es opcional: vacío evita enviar formularios automáticamente.

El solver actúa cuando un desafío configurado impide acceder al formulario,
o mediante una acción `captcha` explícita. El formulario ya accesible no dispara
una solución pagada. CAPTCHA_TIMEOUT_MS y Ctrl+C terminan el worker y su polling;
cancelar localmente no anula una tarea ya cobrada por el proveedor.
Browserless y 2Captcha necesitan sus propias claves y cuentas; las claves
no están incluidas ni se han utilizado servicios de pago en la verificación.

## Interacción opcional

Deja ACTIONS_FILE vacío para inspeccionar. Si defines un archivo JSON, sus pasos
se ejecutan después de verificar el formulario y antes de exportarlo.
`examples/inspect-actions.json` selecciona LIMA y espera opciones de instancia:

```dotenv
ACTIONS_FILE=./examples/inspect-actions.json
```

Acciones: fill, select, click, wait y captcha. Todas salvo captcha necesitan
`selector`; fill y select requieren `value` de tipo string. wait espera presencia
DOM; `visible: true` exige visibilidad. Para iframes, usa `frameUrl` exacto.
click admite `waitForNavigation: true` y `waitForSelector` después del clic.
Una acción `{ "type": "captcha" }` requiere el proveedor configurado.
Los selectores de la captura permiten definir nuevos pasos sin cambiar el controlador.

## Arquitectura

| Ruta | Responsabilidad |
| --- | --- |
| src/models | Captura de formulario y repositorios de cookies/artefactos. |
| src/views | Presentación CLI y ocultación de credenciales. |
| src/controllers | Coordinación del flujo MVC. |
| src/services | Inspección, interacción, desafíos y heartbeat. |
| src/browser | Adaptadores y ciclo de vida del navegador. |
| src/infrastructure | JSON atómico y ejecución cancelable del SDK CAPTCHA. |
| src/config | Lectura y validación de opciones. |
| src/application.js | Composición e inyección de dependencias. |

El controlador depende de contratos pequeños (`wait`, `run`, `save`) y recibe
sus colaboradores por inyección. Los proveedores de navegador implementan
`connect`, devolviendo browser y release. Cada archivo tiene una responsabilidad.
`npm run check` verifica sintaxis y máximo de 200 líneas por archivo del proyecto,
excluyendo dependencias y artefactos generados.
Las dependencias directas están fijadas; `.npmrc` evita un lockfile extenso
para cumplir el límite de líneas. Las versiones transitivas no quedan congeladas.

## Verificación

```sh
npm test
npm run test:browser
npm run check
```

Las pruebas de navegador usan un servidor local e inspeccionan Chrome local y
real: formularios/iframes, selección, escritura y cookies tras reconectar.
La prueba de consulta usa OCR real sobre una imagen de prueba y verifica la
apertura del modal. Las pruebas de identidad comprueban fechas, el POST real local,
la confirmación, el rechazo sin duplicar envíos y la renovación automática del CAPTCHA.
Los archivos de sesión y salida se excluyen de Git y se escriben con permisos
privados. Puppeteer incluye dependencias de descarga con alertas transitivas
en npm audit; este bot utiliza Chrome instalado y no descarga ni extrae archivos ZIP.
# arxatec-cej-force
