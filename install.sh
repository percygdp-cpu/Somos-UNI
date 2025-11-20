#!/bin/bash

echo "🚀 Instalando LMS Platform..."
echo "================================"

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js 18+ primero."
    exit 1
fi

# Verificar versión de Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js $REQUIRED_VERSION o superior es requerido. Versión actual: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION detectado"

# Instalar dependencias principales
echo "📦 Instalando dependencias principales..."
npm install next@14.0.0 react@18.0.0 react-dom@18.0.0

# Instalar dependencias de desarrollo
echo "📦 Instalando dependencias de desarrollo..."
npm install -D typescript@5.0.0 @types/node@20.0.0 @types/react@18.0.0 @types/react-dom@18.0.0

# Instalar utilidades
echo "📦 Instalando utilidades..."
npm install bcryptjs jsonwebtoken xlsx animejs chart.js react-chartjs-2

# Instalar Tailwind CSS y herramientas de build
echo "📦 Instalando Tailwind CSS y herramientas de build..."
npm install -D tailwindcss@3.3.0 autoprefixer@10.4.16 postcss@8.4.31

# Instalar tipos TypeScript
echo "📦 Instalando tipos TypeScript..."
npm install -D @types/bcryptjs @types/jsonwebtoken

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p public/images
mkdir -p pdfs

# Hacer el script ejecutable
chmod +x install.sh

echo ""
echo "✅ Instalación completada!"
echo ""
echo "🎉 Para iniciar el servidor de desarrollo:"
echo "   npm run dev"
echo ""
echo "🌐 La aplicación estará disponible en:"
echo "   http://localhost:3000"
echo ""
echo "📋 Credenciales de demo:"
echo "   Admin: admin / admin123"
echo "   Estudiante: student / student123"
echo ""