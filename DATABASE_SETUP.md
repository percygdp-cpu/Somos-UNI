# Configuración de Turso + Vercel Blob - Guía Paso a Paso

## 📋 Parte 1: Configurar Turso (Base de Datos)

### 1. Crear cuenta en Turso
- Ve a [turso.tech](https://turso.tech)
- Click en **Sign Up** (regístrate con GitHub)

### 2. Instalar Turso CLI (opcional pero recomendado)
```bash
# Windows (PowerShell)
irm get.turso.tech/install.ps1 | iex

# Mac/Linux
curl -sSfL https://get.turso.tech/install.sh | bash
```

### 3. Crear base de datos
#### Opción A: Desde el Dashboard Web
1. Ve a [app.turso.tech](https://app.turso.tech)
2. Click en **Create Database**
3. Nombre: `lms-database`
4. Región: Selecciona la más cercana
5. Click en **Create**

#### Opción B: Desde CLI
```bash
turso auth login
turso db create lms-database
```

### 4. Obtener credenciales
#### Desde Dashboard:
1. Click en tu database `lms-database`
2. Copia el **Database URL**
3. Click en **Create Token** y cópialo

#### Desde CLI:
```bash
turso db show lms-database --url
turso db tokens create lms-database
```

### 5. Configurar el proyecto local
1. En la raíz del proyecto, crea `.env.local`
2. Pega las credenciales:

```env
TURSO_DATABASE_URL="libsql://lms-database-xxxxx.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
```

### 6. Crear las tablas
#### Desde CLI:
```bash
turso db shell lms-database < schema.sql
```

#### Desde Dashboard:
1. Ve a tu database
2. Click en **SQL Console**
3. Copia y pega el contenido de `schema.sql`
4. Click en **Execute**

## 📋 Parte 2: Configurar Vercel Blob (Archivos)

### 1. Crear Blob Store
1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto (o créalo)
3. Ve a **Storage** > **Create Database**
4. Selecciona **Blob**
5. Nombre: `lms-files`
6. Click en **Create**

### 2. Obtener token
1. En tu Blob store, verás el token
2. Cópialo y agrégalo a `.env.local`:

```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxx"
```

## 🎯 Archivo .env.local completo

```env
# Turso Database
TURSO_DATABASE_URL="libsql://lms-database-xxxxx.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."

# Vercel Blob
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxx"
```

## 🧪 Probar la conexión

```bash
npm run dev
```

Abre `http://localhost:3000`:
- Login: `admin` / `admin123`
- O: `estudiante` / `estudiante123`

## 📊 Límites FREE

### Turso:
- ✅ 5 GB storage
- ✅ 500M lecturas/mes
- ✅ 10M escrituras/mes
- ✅ 100 databases

### Vercel Blob:
- ✅ 500 MB storage inicial
- ✅ Ilimitadas lecturas
- ✅ ~300-500 archivos (PDFs + imágenes)

## 🔧 Comandos útiles

```bash
# Ver todas tus databases
turso db list

# Ver info de una database
turso db show lms-database

# Acceder a consola SQL
turso db shell lms-database

# Ver tablas
turso db shell lms-database "SELECT name FROM sqlite_master WHERE type='table';"

# Ver usuarios
turso db shell lms-database "SELECT * FROM users;"
```
