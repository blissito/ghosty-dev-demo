<!-- ghosty-dev:agents -->
## Bitácora (ghosty-dev)

Este repo usa **ghosty-dev**: las tareas son issues de GitHub con etiqueta `ghosty-dev:*` y se cierran con
evidencia. No uses listas TODO en markdown para llevar el trabajo.

1. **El trabajo vive en la bitácora, no en la sesión.** Empieza con `ghosty-dev ready --json`, toma uno con
   `ghosty-dev claim <n>` y trabaja sólo en su worktree (`../<repo>-<n>`, rama `ghosty-dev/<n>-…`).
2. **Se revisa la evidencia, no el código.** Antes de terminar: `ghosty-dev evidence <n> --file evidencia.md`
   (secciones «Qué se hizo», «Verificación» con comandos `$ …` y su salida real, «CI» con resultado y liga,
   «Preview», «Criterios de aceptación» marcados). El PR lleva `Closes #<n>`; sin evidencia, el check
   `ghosty-dev/evidencia` no deja mergear. Nunca cierres un issue sin evidencia.
3. **Se espera por evento, no se sondea.** Con el PR abierto y el CI corriendo: `ghosty-dev wait <n>` y termina.
   `ghosty-dev ready` te lo vuelve a ofrecer cuando el CI resuelva.

Un solo escritor por pendiente. Lo que la persona pida y lo que descubras va a un pendiente nuevo
(`ghosty-dev add "título" --goal … --criteria …`), y si te bloquea: `ghosty-dev block <n> --by <m>`. La persona (el Clerk) lee la evidencia y
decide el merge. Especificación: `SPEC.md` del paquete ghosty-dev.
