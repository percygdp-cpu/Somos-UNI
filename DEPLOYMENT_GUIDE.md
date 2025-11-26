# 🚀 Guía de Deployment - LMS Platform

## Preparación Pre-Deploy

### 1. Verificar Variables de Entorno

Asegúrate de tener todas las variables configuradas en tu archivo `.env.local`:

```bash
TURSO_DATABASE_URL=libsql://[tu-database].turso.io
TURSO_AUTH_TOKEN=eyJ...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NODE_ENV=production
```

### 2. Ejecutar Validaciones

```bash
# Verificar que no haya errores de TypeScript
npm run type-check

# Ejecutar build local
npm run build

# Verificar que el build sea exitoso
npm run start
```

## Deploy en Vercel

### Opción 1: Deploy desde CLI

```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Login en Vercel
vercel login

# Deploy a producción
vercel --prod
```

### Opción 2: Deploy desde GitHub

1. **Conectar Repositorio**
   - Ve a [vercel.com](https://vercel.com)
   - Click en "Add New Project"
   - Importa tu repositorio de GitHub

2. **Configurar Variables de Entorno**
   - En el dashboard de Vercel, ve a Settings → Environment Variables
   - Agrega cada variable:
     - `TURSO_DATABASE_URL`
     - `TURSO_AUTH_TOKEN`
     - `BLOB_READ_WRITE_TOKEN`
   - Asegúrate de seleccionar "Production" para cada una

3. **Configurar Build**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Deploy**
   - Click en "Deploy"
   - Espera a que termine el build

## Post-Deploy

### 1. Verificar Base de Datos

```bash
# Conectar a tu base de datos Turso
turso db shell [tu-database-name]

# Verificar que las tablas existan
.tables

# Verificar que haya datos iniciales
SELECT * FROM users WHERE role = 'admin';
SELECT COUNT(*) FROM motivational_phrases;
```

### 2. Cambiar Contraseñas por Defecto

**⚠️ CRÍTICO:** Cambia las contraseñas por defecto inmediatamente:

```sql
-- En tu shell de Turso
UPDATE users SET password = 'TU_NUEVA_CONTRASEÑA_SEGURA' WHERE username = 'admin';
```

**Nota:** En el futuro, implementa hash de contraseñas con bcrypt.

### 3. Verificar Funcionalidades

Prueba cada funcionalidad principal:

- [ ] Login como admin
- [ ] Login como estudiante
- [ ] Crear un curso
- [ ] Crear un módulo
- [ ] Subir un PDF
- [ ] Crear un test
- [ ] Tomar un test como estudiante
- [ ] Ver frases motivacionales
- [ ] Administrar frases motivacionales

### 4. Monitoreo

En el dashboard de Vercel:
- Verifica que no haya errores en los logs
- Revisa el rendimiento de la aplicación
- Configura alertas para errores críticos

## Troubleshooting

### Error: "Environment variables not defined"

**Solución:** 
1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Verifica que todas las variables estén configuradas
3. Redeploy la aplicación

### Error: "Database connection failed"

**Solución:**
1. Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` sean correctos
2. Ejecuta: `turso db tokens create [database-name]` para generar un nuevo token
3. Actualiza el token en Vercel
4. Redeploy

### Error: "Blob storage upload failed"

**Solución:**
1. Ve a Vercel Dashboard → Storage → Blob
2. Copia el token de lectura/escritura
3. Actualiza `BLOB_READ_WRITE_TOKEN` en las variables de entorno
4. Redeploy

### Páginas en blanco o 404

**Solución:**
1. Verifica que el build haya sido exitoso en Vercel
2. Revisa los logs de build para errores
3. Asegúrate de que todas las rutas dinámicas estén configuradas correctamente

## Actualizaciones Futuras

### Deploy de nuevas características

```bash
# 1. Desarrolla localmente
git checkout -b feature/nueva-caracteristica

# 2. Prueba localmente
npm run dev

# 3. Commit y push
git add .
git commit -m "feat: agregar nueva característica"
git push origin feature/nueva-caracteristica

# 4. Crea Pull Request en GitHub
# 5. Merge a main
# 6. Vercel automáticamente hace deploy de main a producción
```

### Rollback en caso de error

```bash
# En Vercel Dashboard
# 1. Ve a Deployments
# 2. Encuentra el deployment anterior que funcionaba
# 3. Click en "..." → "Promote to Production"
```

## Seguridad Post-Deploy

### Tareas Inmediatas

1. **Cambiar credenciales por defecto**
   ```sql
   UPDATE users SET password = 'nueva_contraseña_segura' WHERE username = 'admin';
   ```

2. **Configurar dominio personalizado**
   - En Vercel: Settings → Domains
   - Agrega tu dominio
   - Configura SSL (automático en Vercel)

3. **Habilitar 2FA en Vercel**
   - Ve a tu cuenta de Vercel
   - Settings → Security
   - Enable Two-Factor Authentication

### Tareas Recomendadas (Próximas semanas)

- [ ] Implementar hash de contraseñas con bcrypt
- [ ] Agregar JWT para sesiones
- [ ] Configurar rate limiting
- [ ] Implementar logging estructurado
- [ ] Agregar monitoreo con Sentry

## Mantenimiento

### Backup de Base de Datos

```bash
# Crear backup manual
turso db shell [database-name] .dump > backup-$(date +%Y%m%d).sql

# Programar backups automáticos
# (configurar en Turso Dashboard o usando GitHub Actions)
```

### Monitoreo de Performance

1. **Vercel Analytics**
   - Habilita en: Settings → Analytics
   - Revisa métricas semanalmente

2. **Logs de Errores**
   - Revisa Vercel Dashboard → Logs diariamente
   - Investiga cualquier error 500 inmediatamente

## Checklist Final Pre-Deploy

- [ ] Todas las variables de entorno configuradas en Vercel
- [ ] Build local exitoso (`npm run build`)
- [ ] Schema de base de datos aplicado
- [ ] Datos iniciales (admin, frases) insertados
- [ ] Console.logs removidos de código de producción
- [ ] Contraseñas por defecto documentadas para cambiar post-deploy
- [ ] Dominio personalizado configurado (opcional)
- [ ] SSL habilitado (automático en Vercel)
- [ ] Tests manuales realizados
- [ ] Plan de rollback definido

---

**¡Listo para deploy! 🚀**

Si tienes problemas, revisa los logs en Vercel Dashboard o contacta soporte.
