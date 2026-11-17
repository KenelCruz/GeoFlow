# Cotizador de Levantamientos (Fase 1: Módulo de Operación)

Aplicación web progresiva (**PWA**) diseñada para empresas pequeñas de levantamiento topográfico (2 a 5 técnicos) en República Dominicana.

## Funcionalidades incluidas en la Fase 1
- **Multi-tenant estricto**: cada tabla incluye `empresa_id` y políticas RLS en PostgreSQL/Supabase.
- **Autenticación y roles por empresa**: `admin`, `coordinador` y `tecnico`, con selector de empresa si el usuario pertenece a varias.
- **CRUD de trabajos**: filtro por estado, búsqueda por cliente y cambio rápido de estado en campo.
- **CRUD de personal y vehículos**: control de cargos, estado de actividad y flota con rendimiento (km/gal).
- **Asignación por fecha con detección de conflictos**: alerta automática si un técnico o vehículo ya está asignado a otro trabajo el mismo día; exige confirmación explícita antes de guardar.
- **Agenda diaria y semanal**: vista consolidada de trabajos, brigadas y vehículos.
- **Bitácora de campo sin conexión**: notas con fecha/hora automática, captura desde cámara o galería, almacenamiento en **IndexedDB** y cola de sincronización automática al recuperar señal.
- **PWA instalable**: configurada con `vite-plugin-pwa` para Android e iPhone (Safari).

---

## Estructura de carpetas

```text
├── public/
│   ├── icon.svg
│   ├── apple-touch-icon.png
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   └── pwa-maskable-512x512.png
├── supabase/
│   ├── schema.sql               # Esquema base multi-tenant, FK compuestas, RPC y RLS
│   └── migrations/              # Migraciones SQL incrementales con RLS y Storage
├── src/
│   ├── domain/                  # Lógica de negocio pura (sin React)
│   │   ├── types.ts
│   │   ├── formatters.ts
│   │   ├── operacion.ts         # Permisos por rol y transiciones de estado
│   │   ├── operacion.test.ts
│   │   ├── conflictos.ts
│   │   └── conflictos.test.ts   # Pruebas unitarias (Vitest)
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase (bloquea demo automático en prod)
│   │   ├── offlineDb.ts         # IndexedDB (caché por empresa + cola binaria de fotos)
│   │   └── demoData.ts          # Datos ficticios para desarrollo local
│   ├── hooks/
│   │   ├── useAuth.tsx
│   │   ├── useOperacionData.tsx
│   │   ├── useOnlineStatus.ts
│   │   └── usePWAInstall.ts
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── ConflictoModal.tsx
│   │   ├── OfflineIndicator.tsx
│   │   └── PWAInstallButton.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── SeleccionEmpresaPage.tsx
│   │   ├── TrabajosPage.tsx
│   │   ├── TrabajoDetallePage.tsx
│   │   ├── AgendaPage.tsx
│   │   ├── PersonalPage.tsx
│   │   ├── VehiculosPage.tsx
│   │   └── BitacoraPage.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── vite.config.ts
└── package.json
```

---

## Configuración de Supabase

1. Crea un proyecto nuevo en [Supabase](https://supabase.com/).
2. Abre el **SQL Editor** en tu proyecto y ejecuta `supabase/schema.sql` (para instalaciones nuevas) o las migraciones en `supabase/migrations/` (para instalaciones existentes). Esto crea:
   - Tablas multi-tenant con `empresa_id` y claves foráneas compuestas `(id, empresa_id)` para impedir cruces entre empresas.
   - Triggers de protección para impedir cambiar `empresa_id` en `UPDATE`.
   - Funciones auxiliares (`es_miembro_empresa`, `tiene_rol_empresa`, `es_uuid_valido`) y RPC controlada (`actualizar_estado_trabajo_campo`) para que los técnicos actualicen el estado en campo sin permisos de edición sobre datos administrativos.
   - Políticas **RLS** en todas las tablas y en el bucket privado `bitacora-fotos` (`{empresa_id}/{trabajo_id}/{archivo}`).
3. Crea un archivo `.env` a partir de `.env.example` con tus credenciales:
   ```env
   VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
   VITE_SUPABASE_ANON_KEY="tu-clave-anon-publica"
   ```
4. En **Authentication → Users**, crea los usuarios y luego vincúlalos a una empresa insertando filas en `empresas` y `usuarios_empresa`.

> **Nota sobre el modo demostración:** El modo demostración local con datos ficticios solo está habilitado en desarrollo (`npm run dev`) o si se define explícitamente `VITE_ENABLE_DEMO="true"`. En compilaciones de producción sin credenciales de Supabase, el acceso queda bloqueado por seguridad.

---

## Ejecución local y pruebas

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo (puerto 3000)
npm run dev

# Ejecutar pruebas unitarias de detección de conflictos
npm test

# Compilar para producción (genera el Service Worker y manifest PWA)
npm run build
```

---

## Decisiones técnicas simples tomadas
- **IndexedDB nativo sin librerías adicionales**: `src/lib/offlineDb.ts` encapsula IndexedDB directamente para mantener el paquete ligero y sin dependencias extra.
- **Fotos en bitácora offline**: se serializan como Data URL en IndexedDB cuando no hay conexión para mostrarlas de inmediato y sincronizarlas al volver la señal.
- **Zona horaria y moneda**: formateo por defecto en `es-DO` (`America/Santo_Domingo`) y moneda en `RD$` para futuras fases de cotización y viáticos.
