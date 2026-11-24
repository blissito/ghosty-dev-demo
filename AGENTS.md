<!-- ghosty-dev:agents -->

**Instalar y actualizar (una sola forma; no está en el registro de npm, `npm i -g ghosty-dev@latest` da 404):** `npm install -g github:blissito/ghosty-dev` la primera vez y `ghosty-dev update` después (dice versión vieja → nueva). `ghosty-dev doctor` avisa si hay una nueva.

## Bitácora (ghosty-dev)

**El flujo en 5 renglones** (relee esto al retomar o tras compactar):

1. `ghosty-dev next` — el siguiente paso exacto según el repo (empieza aquí siempre, también tras compactar).
   **Fábrica en pausa** (la persona la pausó o está fuera de su horario): `next`, `claim` y `asks` salen **6** con la línea («Fábrica en pausa hasta las 8:00»), y `wait` corta igual. No tomes trabajo nuevo: termina el paso que traes, déjalo subido y detente. Sólo la persona la reanuda (`/c/dev` o `ghosty-dev factory resume`); `ghosty-dev factory` dice el estado.
2. Trabajo nuevo: `ghosty-dev claim <n>`. Trabajo que ya existe (PR a mano, rama propia): `ghosty-dev claim --pr <m> --issue <n>`.
3. Push → `ghosty-dev preview --wait --json` → prueba la app; si falla: `ghosty-dev box logs` / `box exec -- <cmd>` → arregla → push.
4. CI verde → revisión de otra sesión: `ghosty-dev review <n> --pr <m>` (subagente ghosty-dev-revisor), 0 hallazgos abiertos.
5. `ghosty-dev evidence <n> --pr <m> --file evidencia.md` (re-dispara la puerta) → la persona decide el merge; si te lo pide: `ghosty-dev merge <m>` (sólo con TODOS los checks en verde, y espera el deploy), nunca `gh pr merge`. Nunca `gh issue comment` a mano.

Este repo usa **ghosty-dev**: las tareas son issues de GitHub con etiqueta `ghosty-dev:*` y se cierran con
evidencia. No uses listas TODO en markdown para llevar el trabajo.

1. **El trabajo vive en la bitácora, no en la sesión.** Empieza con `ghosty-dev ready --json`, toma uno con
   `ghosty-dev claim <n>` y trabaja sólo en su worktree (`../<repo>-<n>`, rama `ghosty-dev/<n>-…`).
2. **Se revisa la evidencia, no el código.** Con el CI en verde, otro agente con contexto limpio revisa el PR
   (subagente `ghosty-dev-revisor`, o `ghosty-dev review <n>` en otra sesión); tú no te calificas. Con la revisión
   en 0 hallazgos abiertos: `ghosty-dev evidence <n> --file evidencia.md`
   (secciones «Qué se hizo», «Verificación» con comandos `$ …` y su salida real, «CI» con resultado y liga,
   «Preview», **«Flujo principal probado con sesión»** —qué función principal usaste logueado en la vista previa y
   cómo, con captura o bloque `$ …` con salida; abrir la página no cuenta; sin interfaz: «no aplica: <motivo>»—,
   «Criterios de aceptación» marcados). El mismo renglón va en la descripción del PR (plantilla de init).
   Si la función principal no funciona y no lo puedes arreglar ahora, no lo marques listo: déjalo bloqueado con motivo. El PR lleva `Closes #<n>`; sin revisión del commit actual y sin
   evidencia, el check `ghosty-dev/evidencia` no deja mergear. Nunca cierres un issue sin evidencia.
3. **Se espera por evento, no se sondea.** Con el PR abierto: `ghosty-dev wait <n> --watch` espera al CI en una sola llamada (tope 5 min); si tarda más, toma otro pendiente o termina. Si el repo está conectado a Ghosty Studio, `wait --watch` también avisa cuando la vista previa y la revisión de Ghosty terminan, y `ghosty-dev show <n>` da la ficha y los servicios del PR (vista previa con su liga, revisión, smoke, CI): no hace falta otro CLI.
   Para probar la app: push → `ghosty-dev preview --wait --json` → prueba la app en `url` → evidencia (0 lista, 75 armándose, 1 falló; sin pendiente: `show --pr <m>`);
   si falla: `ghosty-dev box logs` / `ghosty-dev box exec -- <comando>` → arregla → push (la caja la administras tú; `wait --pr <m> --until ci|review` espera sin pendiente).
   La liga lleva la llave de la vista previa: nunca la pegues en la evidencia, el issue ni el PR.
   `ghosty-dev ready` te lo vuelve a ofrecer cuando el CI resuelva.

Preparar el repo sin credenciales de GitHub: `ghosty-dev init --force --files-only --no-checks` (sólo los archivos de la puerta, sin el workflow extra ghosty-checks.yml; commit y PR; etiquetas y `protect` son de la persona).

La nube (`claim <n> --cloud`) y las variables de la vista previa (secretos) van con `ghosty-dev login --no-wait` → la persona aprueba la liga →
`ghosty-dev login --wait` (sólo si `whoami` no encuentra sesión, y preguntando antes) y `ghosty-dev env ls | push <archivo>`
(sesión propia de Ghosty Studio; GitHub sigue siendo `gh`). El archivo lo nombra la persona y ningún valor se imprime.
Si un criterio de aceptación NO se puede cumplir (p. ej. «0 fallos» y main ya tenía fallos), no lo marques ni lo edites a escondidas: `ghosty-dev criteria <n> --set <i> "texto nuevo" --reason "…"` cambia sólo ese renglón y deja el comentario de rastro (quién, cuándo, antes, ahora, motivo). Sin `--set` lista los criterios. En la nube el escritor usa `dev_run_propose_criteria` y la persona aprueba.

Si un criterio sólo lo puede comprobar la persona (p. ej. una sesión de administrador que no tienes), NO lo marques `[x]`, NO pidas publicar sin él y NO preguntes qué hacer: márcalo `- [~] <criterio> — verificación de la persona: <qué comprobar y cómo>`, enumera los pasos exactos y sigue. La puerta queda pendiente («Falta tu verificación») hasta que la persona corre `ghosty-dev confirm <n> --criterion <i>`; entonces pasa sola.

Hablarle al escritor de un pendiente que va en la nube: `ghosty-dev tell <n> "mensaje"` (o `--file m.md`, o `-` por stdin); si `show <n>` muestra «el escritor pregunta», contesta con la línea `contesta: ghosty-dev tell <n> "<opción>"`; `tell <n> --again` = otra vuelta.

**OAuth en previews** (entrar con Google/GitHub en la vista previa):
- Si existe `GS_PREVIEW_OAUTH_REDIRECT_URI`, úsalo como `redirect_uri` al pedir el código **y al canjearlo** (si no, `redirect_uri_mismatch`).
- Arma el `state` con `previewOAuthState(state, '/ruta/del/callback')` (snippet de 10 líneas: docs de Ghosty Studio, fabrica/oauth-en-previews; usa `GS_PREVIEW_OAUTH_STATE_KEY`).
- Una sola vez, el dueño registra `https://www.ghosty.studio/preview-oauth/callback` en el proveedor (GitHub: un OAuth App aparte para previews).
- `ghosty-dev doctor` dice qué falta (llaves, callback, registro) y los pasos. Una puerta instalada distinta de la de ghosty-dev pero ≥ 0.9.38 sólo avisa (`puerta-gate-version`, arréglalo con `ghosty-dev init --force --no-checks --files-only` en un PR); sólo bloquea si falta o es anterior.
- **Primero la identidad de Ghosty (abajo, «Login en previews»: incluye Google real como paso 5), sin OAuth.** Si de verdad hace falta OAuth en previews: un cliente OAuth
  APARTE sólo para previews; nunca edites el cliente de producción ni copies su secreto a la vista previa.

**Login en previews: UNA receta completa** (identidad de Ghosty, como Cloudflare Access). Se adopta entera, una vez, en
main: por partes se rompe la pieza de al lado (Formmy, fila 61: tres entregas y el logout reabría la sesión). Quien abre
la vista previa desde Ghosty llega con `X-Ghosty-Identity` (JWT EdDSA de 12 h, `aud` = el host de la preview) en CADA
petición; en producción `GS_PREVIEW_IDENTITY_JWKS_URL` no existe y nada de esto actúa.
```js
// app/preview-identity.server.js
import { createRemoteJWKSet, jwtVerify } from "jose";
const JWKS_URL = process.env.GS_PREVIEW_IDENTITY_JWKS_URL;
const jwks = JWKS_URL ? createRemoteJWKSet(new URL(JWKS_URL)) : null;
export const isGhostyPreview = () => Boolean(jwks);
export const LOGGED_OUT = "preview_logged_out"; // marca de logout: sin ella el header reabre la sesión
export const loggedOut = (request) => /(?:^|;\s*)preview_logged_out=1/.test(request.headers.get("cookie") ?? "");
export async function previewIdentity(request, { ignoreMark = false } = {}) {
  const token = request.headers.get("x-ghosty-identity");
  if (!jwks || !token || (!ignoreMark && loggedOut(request))) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: process.env.GS_PREVIEW_IDENTITY_ISSUER, audience: process.env.PREVIEW_HOST, algorithms: ["EdDSA"] });
    return { id: payload.sub, email: payload.email, name: payload.name ?? null, role: payload.role };
  } catch {
    return null;
  }
}
export const enterFromGhosty = () => new Response(`<!doctype html><meta charset="utf-8"><title>Entra desde Ghosty</title><h1>Entra desde Ghosty</h1><p>Abre esta vista previa desde Ghosty («Abrir preview») y entrarás con tu cuenta.</p>`, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
```
1. **Entrar sola**: en el loader que lee la sesión (el del dashboard y el de `/login`), sin sesión y con
   `previewIdentity(request)` → entra como un **usuario de prueba sembrado en la base de la vista previa** (búscalo o
   créalo con `preview-${role}@ghosty.test`; `sub`/`email` sólo como dato) y crea la sesión normal. Si tu cookie lleva
   `Domain` de producción, quítaselo con `isGhostyPreview()`.
2. **Cerrar sesión**: además de destruir la sesión, en la preview pon `preview_logged_out=1; Path=/; HttpOnly; SameSite=Lax; Secure`.
3. **Volver a entrar**: botón «Entrar con Ghosty» (sólo con `isGhostyPreview()`, p. ej. `intent=ghosty-login`) →
   `previewIdentity(request, { ignoreMark: true })`, borra la marca (`Max-Age=0`) y crea la sesión; sin identidad, `enterFromGhosty()`.
4. **Sin identidad ni llaves del proveedor**: `/login` y la action de Google responden `enterFromGhosty()` (401, sin
   pedir credenciales), nunca «Oops» ni un 500.
5. **Google real (opcional)**: con las llaves de un cliente OAuth APARTE sólo para previews, «Entrar con Google» usa
   `redirect_uri = GS_PREVIEW_OAUTH_REDIRECT_URI` (al pedir el código y al canjearlo) y `state = previewOAuthState(csrf, "/auth/google/callback")`
   (arriba). Sin llaves, el botón va apagado con el motivo.

La base de la vista previa tiene que ser desechable (copia o vacía con seed), nunca la de producción: `ghosty-dev doctor`
avisa si la preview trae `DATABASE_URL`, `MONGO_*`, etc., y sugiere la receta si la app tiene login. «Probado en la
preview del PR #N» sólo vale en la evidencia si #N contiene el mismo commit (`evidence` y la puerta lo verifican).

- **Comprobarlo de punta a punta**: en el frontmatter de `.ghosty/factory.md`:
  `login_path: /dashboard`, `logout: POST /api/login intent=logout`, `relogin: POST /api/login intent=ghosty-login`
  (los de tu app). `ghosty-dev preview <pr> --login --check` (y `doctor`) siguen redirecciones como un navegador y dan
  un renglón por paso: entrar · cerrar sesión · no se reabre (con el header todavía llegando) · volver a entrar · sin
  identidad («Entra desde Ghosty», no 500). Sale 1 si alguno falla; sin `logout`/`relogin`, los pasos salen «sin probar».
- **Entrar como agente**: `ghosty-dev preview <pr> --login [--path /dashboard]` da una liga de UN solo uso (10 min) con
  la identidad de servicio (`smoke@ghosty.studio`); generarla no la gasta, abrirla sí (`--open` la abre en tu
  navegador). Síguela con `curl -sL -c jar "<liga>" -o /dev/null` y usa `-b jar`.

**API de partner en previews sin llaves** (identidad de la caja, como el OIDC de GitHub Actions): cada vista previa trae
`GHOSTY_PREVIEW_TOKEN` (JWT de Ghosty, `aud` = `ghosty-api`) y `/api/v2/partner/*` lo acepta como Bearer, sólo para
pruebas (turnos, AG-UI, páginas, lecturas). Nunca copies `GHOSTY_PARTNER_KEY` a la preview; donde la app firma:
```js
// Vista previa de Ghosty: sin llave de partner, la caja trae su propia identidad.
const previewToken = !process.env.GHOSTY_PARTNER_KEY && process.env.GHOSTY_PREVIEW_TOKEN;
const auth = previewToken ? { Authorization: `Bearer ${previewToken}` } : { "X-Ghosty-Key": keyId, "X-Ghosty-Ts": ts, "X-Ghosty-Sig": signCredentialBody(secret, ts, keyId, raw) };
```
`...auth` en los headers del fetch y sin el error de «falta la llave» si hay token. Si la dueña tiene varios espacios de
partner, `.ghosty/factory.md` dice cuál con `partner: <espacio>` en el frontmatter. `ghosty-dev doctor` lo sugiere.

**Agentes de partner (el que contesta en tu app)**: se crean y cambian con el CLI `ghosty` de Ghosty Studio
(`npx @ghostystudio/cli@latest`), no con `ghosty-dev`. Versiona el prompt en el repo (p. ej. `ghosty/agents/<slug>.md`)
y aplícalo con la llave de partner **del env** (`GHOSTY_PARTNER_KEY` + `GHOSTY_PARTNER_KEY_SECRET`, nunca pegada):
```bash
ghosty partner agent apply --agent crear --prompt-file ghosty/agents/crear.md --mcp https://www.formmy.app/api/mcp --dry-run
ghosty partner agent apply --agent crear --prompt-file ghosty/agents/crear.md --mcp https://www.formmy.app/api/mcp
ghosty partner agent ls      # y: ghosty partner agent get --agent crear
```
(Con JSON: `--file agent.json --prompt-file …`.) `--dry-run` valida y dice si lo crearía o cambiaría, sin escribir.
`ghosty-dev doctor` marca MAL si el código llama por `/api/v2/partner/*` a un agente que no existe, con el comando para
crearlo: un PR que depende de él no está listo aunque todo se vea verde. El MCP apunta a producción (el agente atiende en
prod); cambiar el prompt es un PR con ese `.md` y, tras el merge, el mismo `apply`.

Un PR cerrado sin merge: `next`, `wait` y `show` dicen quién lo cerró y el motivo, y ofrecen `gh pr reopen <m>`;
mientras siga cerrado, un push a su rama no corre CI, vista previa ni revisión (el pre-push lo avisa).

Un solo escritor por pendiente. Lo que la persona pida y lo que descubras va a un pendiente nuevo
(`ghosty-dev add "título" --goal … --criteria …`), y si te bloquea: `ghosty-dev block <n> --by <m>`. La persona (el Clerk) lee la evidencia y
decide el merge. Los identificadores van siempre en inglés (variables, funciones, llaves, archivos); en
español sólo comentarios, mensajes y nombres de pruebas. Especificación: `SPEC.md` del paquete ghosty-dev.
## Referencias entre repos (0.9.42)

Un número solo es ambiguo cuando hay ≥2 repos en juego (el #94 de Formmy no es el #94 de gs). Toda referencia acepta el patrón de GitHub: `94`, `#94` u `owner/repo#94` (también la URL del issue o PR). Sin repo explícito es el del directorio (igual que siempre). Con `owner/repo#n` de OTRO repo el comando corre allá: ubica su clon local (directorio actual, `~/` a dos niveles y `GHOSTY_DEV_REPOS`, buscando por remoto) y trabaja ahí; **nunca crea ramas ni worktrees en el repo del directorio**. Sin clon, `claim` y `teleport` se detienen y dicen el comando exacto (`gh repo clone owner/repo ~/repo`); el resto sólo necesita GitHub. Con ≥2 repos en juego imprime `owner/repo#n`.

- `ghosty-dev claim owner/repo#n` · `show` · `block` · `criteria` · `evidence` · `review` · `tell` · `stop` · `teleport` · `claim --cloud` aceptan la referencia completa; `--issue`/`--pr` también.
- `ghosty-dev unclaim <n> [--reason "…"]` suelta tu claim local (quita tu assignee, vuelve a `por-hacer`, deja comentario); rechaza con un run vivo en la nube (`stop`/`teleport`) o si otra persona lo tiene. `release <n>` NO suelta claims: sólo reanuda un run de la nube «Esperando otro PR». `show`/`cloud` listan las `actions` que manda Ghosty Studio con su comando exacto.
- `ghosty-dev add "título" --repo owner/repo [--from <n>] …` abre el pendiente en OTRO repo, asegura allí las etiquetas del tablero y deja el enlace cruzado (`Descubierto en origen#n` en el cuerpo y un comentario en el pendiente de origen). `--from` sin repo es del repo donde corres el comando; `--by` sin repo, del repo donde se abre.
- `--from owner/repo#n` y `--by owner/repo#m` entienden pendientes de otro repo (el bloqueo usa la dependencia nativa de GitHub, o `- owner/repo#m` en «Bloqueado por»).
- `claim <n>` avisa (sin bloquear) si el título empieza con un prefijo de otro repo («gs:», «formmy:») o el cuerpo menciona otro repo del mismo dueño: «este pendiente parece de <repo>; usa `ghosty-dev claim <repo>#N` o ábrelo allí con `add --repo`».

<!-- /ghosty-dev:agents -->
