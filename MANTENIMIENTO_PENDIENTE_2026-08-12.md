# Mantenimiento del repositorio — actualizado 2026-08-17

## Publicación y automatización

- Origen canónico privado: `https://github.com/LynxPardelle/zoositioweb-content-factory`.
- Rama canónica: `main`; sólo se permiten pushes normales.
- GitHub Actions ejecuta pruebas, validación de campaña y revisión de whitespace
  en cada push y pull request.
- Dependabot revisa semanalmente únicamente las acciones fijadas por SHA.
- Validación antes de publicar: 64/64 pruebas, campaña válida, `actionlint`,
  `gitleaks` y `git diff --check` correctos.

Este repositorio sigue siendo una fábrica local con aprobación humana. No se
añadió despliegue, OIDC ni acceso AWS: la única operación Polly continúa siendo
local, explícita y condicionada a `--execute`. Convertirla en automatización de
nube requeriría otro diseño, revisión de permisos y aprobación humana.

## Material fuera de Git

Nunca transfiera dentro de Git `.env`, claves de Pexels/Pixabay/AWS, medios de
terceros descargados, videos/audio generados, estado bajo `devonly/`, materiales
de MoneyPrinterTurbo o datos privados de clientes. Si esos activos deben pasar
a otra computadora, use un canal cifrado independiente y conserve fuente,
autor, URL de licencia, permiso comercial y hash de cada archivo.

La protección obligatoria de ramas privadas depende del plan de GitHub. Mientras
no esté disponible, use pull requests, revise las comprobaciones y no fuerce la
historia.
