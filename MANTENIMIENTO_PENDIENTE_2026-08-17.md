# Mantenimiento pendiente — 2026-08-17

## Estado de publicación

- El código rastreado y sus 13 commits fueron escaneados sin secretos ni datos
  privados confirmados. El `.env`, medios descargados, renders, logs y cachés
  siguen ignorados y no deben publicarse.
- CI valida el commit exacto, las 89 pruebas, la campaña y el historial con
  Gitleaks. Sólo usa permisos de lectura; este repositorio no despliega a AWS.
- Los nueve assets seleccionados tienen ruta relativa, tamaño, tipo y SHA-256
  registrados, pero los binarios siguen fuera de Git.

## Bloqueos intencionales

- Los nueve registros de render permanecen pendientes. Polly y ambos renderers
  fallan cerrado hasta que una persona registre aprobación terminal y revisión
  de licencia, con identidad, fecha y el asset exacto aprobado.
- MoneyPrinterTurbo permanece bloqueado: `campaigns/zoositioweb/mpt-approved-source.json`
  no tiene repositorio ni commit aprobado. Una revisión independiente debe fijar
  una fuente, un SHA completo y un checkout limpio; nunca se debe inventar ese dato.
- Antes de publicar cualquier pieza, conservar evidencia de licencia y revisar
  personas reconocibles, marcas, contexto publicitario y derechos de uso.

## Transferencia entre computadoras

- **Alta / integridad alta:** clonar el repositorio y verificar el SHA del commit.
- **Alta para render / confidencialidad media e integridad alta:** mover sólo los
  nueve assets aprobados mediante canal cifrado y verificar los SHA-256 registrados.
- **Media / seguridad alta:** mover audio o renders únicamente si están aprobados;
  cifrar, limitar acceso y verificar hashes antes de usarlos.
- **Nunca transferir como parte del repositorio:** `.env`, claves de proveedor,
  perfiles AWS, credenciales, logs, cachés, `node_modules` o medios sin licencia.
