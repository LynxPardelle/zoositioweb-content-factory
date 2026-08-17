# Mantenimiento del repositorio — actualizado 2026-08-17

## Publicación y automatización

- Origen canónico público: `https://github.com/LynxPardelle/zoositioweb-content-factory`.
- `main` exige PR y CI estricto, incluye a administradores, resuelve conversaciones
  y bloquea force-push y borrado. Secret scanning, push protection y actualizaciones
  de seguridad de Dependabot están activos.
- GitHub Actions ejecuta 90 pruebas, validación de campaña, Gitleaks del historial
  y revisión de whitespace en cada push y pull request.
- Dependabot revisa semanalmente únicamente las acciones fijadas por SHA.
- Validación antes de publicar: 90/90 pruebas, campaña válida, 9/9 assets locales,
  `actionlint`, Gitleaks de 13 commits y `git diff --check` correctos.

Este repositorio sigue siendo una fábrica local con aprobación humana. Polly y
los renderers fallan cerrado mientras la cola permanezca pendiente. MoneyPrinterTurbo
también permanece bloqueado hasta registrar una fuente y commit exactos revisados.
No se añadió despliegue, OIDC ni acceso AWS.

## Material fuera de Git

Nunca transfiera dentro de Git `.env`, claves de Pexels/Pixabay/AWS, medios de
terceros descargados, videos/audio generados, estado bajo `devonly/`, materiales
de MoneyPrinterTurbo o datos privados de clientes. Si esos activos deben pasar
a otra computadora, use un canal cifrado independiente y conserve fuente,
autor, URL de licencia, permiso comercial y hash de cada archivo.

Antes de publicar una pieza, verifique la evidencia de licencia, personas, marcas,
contexto publicitario y los SHA-256 registrados. No fuerce historia.
