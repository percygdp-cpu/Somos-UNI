# Somos UNI - Plataforma de Aprendizaje

Una plataforma completa de gestión de cursos construida con Next.js, TypeScript y Tailwind CSS.

## Características

### Vista Estudiante
- ✅ Sistema de autenticación seguro
- ✅ Dashboard con lista de cursos disponibles
- ✅ Vista detallada de módulos con contenido descargable (PDF)
- ✅ Sistema de tests con preguntas aleatorias (20 preguntas, 5 alternativas)
- ✅ Retroalimentación inmediata en cada respuesta
- ✅ Sistema de calificación con porcentaje de aciertos
- ✅ Pantalla de felicitaciones al completar tests

### Vista Administrador
- ✅ Dashboard analítico completo con estadísticas
- ✅ Gestión completa de usuarios (crear, editar, activar/desactivar)
- ✅ Carga masiva de usuarios vía Excel
- ✅ Gestión de cursos y módulos
- ✅ Panel de análisis con gráficos interactivos
- ✅ Reportes de rendimiento estudiantil

## Tecnologías Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript
- **Estilos**: Tailwind CSS
- **Animaciones**: Anime.js
- **Gráficos**: Chart.js, react-chartjs-2
- **Utilidades**: XLSX para Excel, JWT para autenticación

## Instalación

1. Clona el repositorio:
```bash
git clone [URL_DEL_REPOSITORIO]
cd lms-platform-basic
```

2. Instala las dependencias:
```bash
npm install
```

3. Instala las dependencias faltantes:
```bash
npm install next@14.0.0 react@18.0.0 react-dom@18.0.0 typescript@5.0.0
npm install @types/node@20.0.0 @types/react@18.0.0 @types/react-dom@18.0.0
npm install bcryptjs jsonwebtoken xlsx animejs chart.js react-chartjs-2
npm install tailwindcss@3.3.0 autoprefixer@10.4.16 postcss@8.4.31
npm install @types/bcryptjs @types/jsonwebtoken
```

4. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Credenciales de Demo

### Administrador
- **Usuario**: `admin`
- **Contraseña**: `admin123`

### Estudiante
- **Usuario**: `student`
- **Contraseña**: `student123`

## Estructura del Proyecto

```
lms-platform-basic/
├── app/
│   ├── admin/
│   │   ├── analytics/          # Dashboard analítico
│   │   ├── courses/            # Gestión de cursos
│   │   ├── dashboard/          # Panel principal admin
│   │   └── users/              # Gestión de usuarios
│   ├── student/
│   │   └── courses/            # Vista de estudiante
│   ├── globals.css             # Estilos globales
│   ├── layout.tsx              # Layout principal
│   ├── login/page.tsx          # Página de login
│   └── page.tsx                # Página principal (redirige a login)
├── components/
│   ├── AuthContext.tsx         # Contexto de autenticación
│   └── ProtectedRoute.tsx      # Ruta protegida
├── data/
│   └── mockData.ts             # Datos de prueba
├── types/
│   └── index.ts                # Definiciones de tipos
├── public/
│   └── images/                 # Imágenes estáticas
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Funcionalidades Implementadas

### Sistema de Tests
- Tests de 20 preguntas con 5 alternativas cada una
- Preguntas en orden aleatorio para cada intento
- Retroalimentación inmediata después de seleccionar respuesta
- No se permite cambiar respuesta una vez seleccionada
- Cálculo automático de nota y porcentaje
- Pantalla de felicitaciones con resultados

### Gestión de Usuarios (Admin)
- Crear nuevos usuarios con rol de estudiante o administrador
- Activar/desactivar usuarios
- Carga masiva mediante archivos Excel
- Búsqueda y filtrado de usuarios
- Vista de estado y fecha de creación

### Dashboard Analítico
- Estadísticas generales del sistema
- Gráficos de rendimiento por curso
- Distribución de usuarios por rol
- Evolución del rendimiento en el tiempo
- Tabla de estudiantes destacados

### Gestión de Cursos
- Crear nuevos cursos
- Asignar módulos a cursos
- Gestión de contenido PDF
- Asignación de tests a módulos

## Próximas Mejoras

- Integración con base de datos real (Prisma/PostgreSQL)
- Sistema de notificaciones por email
- Chat en tiempo real para soporte
- Modo oscuro
- Exportación de reportes en PDF
- Integración con servicios de almacenamiento en la nube
- Sistema de certificados
- App móvil con React Native

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## Contacto

Para preguntas o soporte, por favor contacta al equipo de desarrollo.

---

**Nota**: Esta es una versión demo con datos mock. Para producción, se requiere implementar:
- Base de datos real
- Sistema de autenticación más robusto
- Manejo de archivos real
- Validaciones adicionales
- Tests unitarios y de integración