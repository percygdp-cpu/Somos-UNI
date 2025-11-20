import { Course, Module, Test, Question, User, TestResult } from '@/types'

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    username: 'student',
    password: 'student123',
    role: 'student',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '3',
    username: 'juan.perez',
    password: 'password123',
    role: 'student',
    status: 'active',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '4',
    username: 'maria.garcia',
    password: 'password123',
    role: 'student',
    status: 'inactive',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01')
  }
]

export const mockCourses: Course[] = [
  {
    id: '1',
    title: 'Desarrollo Web Full Stack',
    description: 'Aprende a crear aplicaciones web modernas con las tecnologías más demandadas',
    image: '/images/course1.jpg',
    modules: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    title: 'Data Science con Python',
    description: 'Domina el análisis de datos y machine learning con Python',
    image: '/images/course2.jpg',
    modules: [],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '3',
    title: 'Diseño UX/UI',
    description: 'Crea experiencias de usuario excepcionales con principios de diseño moderno',
    image: '/images/course3.jpg',
    modules: [],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01')
  }
]

export const mockModules: Module[] = [
  {
    id: '1',
    courseId: '1',
    title: 'Módulo 1: Fundamentos de HTML y CSS',
    description: 'Aprende los conceptos básicos del desarrollo web frontend',
    order: 1,
    pdfUrl: '/pdfs/modulo1-html-css.pdf',
    tests: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    courseId: '1',
    title: 'Módulo 2: JavaScript Moderno',
    description: 'Programación con JavaScript ES6+ y conceptos avanzados',
    order: 2,
    pdfUrl: '/pdfs/modulo2-javascript.pdf',
    tests: [],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05')
  },
  {
    id: '3',
    courseId: '1',
    title: 'Módulo 3: React y Next.js',
    description: 'Construye aplicaciones modernas con React y Next.js',
    order: 3,
    pdfUrl: '/pdfs/modulo3-react-nextjs.pdf',
    tests: [],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10')
  }
]

export const mockQuestions: Question[] = [
  {
    id: '1',
    testId: '1',
    question: '¿Cuál es la etiqueta correcta para un encabezado de nivel 1 en HTML?',
    options: ['<heading>', '<h1>', '<header>', '<h>', '<title>'],
    correctAnswer: 1,
    order: 1
  },
  {
    id: '2',
    testId: '1',
    question: '¿Qué propiedad CSS se usa para cambiar el color del texto?',
    options: ['text-color', 'font-color', 'color', 'text-style', 'font-tint'],
    correctAnswer: 2,
    order: 2
  },
  {
    id: '3',
    testId: '1',
    question: '¿Cuál es la forma correcta de crear un enlace en HTML?',
    options: ['<link href="url">texto</link>', '<a src="url">texto</a>', '<a href="url">texto</a>', '<url>texto</url>', '<hyperlink>texto</hyperlink>'],
    correctAnswer: 2,
    order: 3
  },
  {
    id: '4',
    testId: '1',
    question: '¿Qué significa CSS?',
    options: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style Sheets', 'Colorful Style Sheets', 'Code Style Syntax'],
    correctAnswer: 1,
    order: 4
  },
  {
    id: '5',
    testId: '1',
    question: '¿Cuál es la etiqueta para insertar una imagen en HTML?',
    options: ['<image>', '<img>', '<picture>', '<media>', '<photo>'],
    correctAnswer: 1,
    order: 5
  },
  {
    id: '6',
    testId: '1',
    question: '¿Qué atributo HTML se usa para definir estilos en línea?',
    options: ['class', 'style', 'styles', 'font', 'css'],
    correctAnswer: 1,
    order: 6
  },
  {
    id: '7',
    testId: '1',
    question: '¿Cuál es la etiqueta correcta para crear un párrafo en HTML?',
    options: ['<paragraph>', '<p>', '<para>', '<text>', '<pg>'],
    correctAnswer: 1,
    order: 7
  },
  {
    id: '8',
    testId: '1',
    question: '¿Qué propiedad CSS se usa para cambiar el tamaño de fuente?',
    options: ['text-size', 'font-size', 'text-style', 'font-weight', 'size'],
    correctAnswer: 1,
    order: 8
  },
  {
    id: '9',
    testId: '1',
    question: '¿Cuál es la etiqueta para crear una lista ordenada en HTML?',
    options: ['<ul>', '<ol>', '<list>', '<dl>', '<ordered>'],
    correctAnswer: 1,
    order: 9
  },
  {
    id: '10',
    testId: '1',
    question: '¿Qué significa HTML?',
    options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlinks and Text Markup Language', 'Hyper Transfer Markup Language'],
    correctAnswer: 0,
    order: 10
  },
  {
    id: '11',
    testId: '1',
    question: '¿Cuál es la etiqueta para crear una división o sección en HTML?',
    options: ['<section>', '<div>', '<part>', '<container>', '<block>'],
    correctAnswer: 1,
    order: 11
  },
  {
    id: '12',
    testId: '1',
    question: '¿Qué propiedad CSS controla el espaciado entre líneas de texto?',
    options: ['line-spacing', 'line-height', 'text-spacing', 'spacing', 'line-gap'],
    correctAnswer: 1,
    order: 12
  },
  {
    id: '13',
    testId: '1',
    question: '¿Cuál es la etiqueta correcta para un salto de línea en HTML?',
    options: ['<break>', '<br>', '<lb>', '<newline>', '<line>'],
    correctAnswer: 1,
    order: 13
  },
  {
    id: '14',
    testId: '1',
    question: '¿Qué propiedad CSS se usa para centrar un texto?',
    options: ['align', 'text-align', 'center', 'alignment', 'text-center'],
    correctAnswer: 1,
    order: 14
  },
  {
    id: '15',
    testId: '1',
    question: '¿Cuál es la etiqueta para crear un formulario en HTML?',
    options: ['<form>', '<input>', '<formular>', '<field>', '<submit>'],
    correctAnswer: 0,
    order: 15
  },
  {
    id: '16',
    testId: '1',
    question: '¿Qué propiedad CSS se usa para cambiar el color de fondo?',
    options: ['bgcolor', 'background-color', 'color-background', 'bg-color', 'back-color'],
    correctAnswer: 1,
    order: 16
  },
  {
    id: '17',
    testId: '1',
    question: '¿Cuál es la etiqueta para crear una tabla en HTML?',
    options: ['<table>', '<tab>', '<grid>', '<data>', '<tbl>'],
    correctAnswer: 0,
    order: 17
  },
  {
    id: '18',
    testId: '1',
    question: '¿Qué atributo HTML especifica una URL de destino para un enlace?',
    options: ['src', 'href', 'url', 'link', 'target'],
    correctAnswer: 1,
    order: 18
  },
  {
    id: '19',
    testId: '1',
    question: '¿Qué propiedad CSS se usa para añadir bordes a un elemento?',
    options: ['outline', 'border', 'edge', 'frame', 'line'],
    correctAnswer: 1,
    order: 19
  },
  {
    id: '20',
    testId: '1',
    question: '¿Cuál es la etiqueta HTML correcta para el texto más grande?',
    options: ['<h6>', '<h1>', '<heading>', '<head>', '<big>'],
    correctAnswer: 1,
    order: 20
  }
]

export const mockTests: Test[] = [
  {
    id: '1',
    moduleId: '1',
    title: 'Test de Fundamentos HTML y CSS',
    questions: mockQuestions,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
]

export const mockTestResults: TestResult[] = [
  {
    id: '1',
    userId: '2',
    testId: '1',
    score: 4,
    percentage: 80,
    answers: [
      { questionId: '1', selectedAnswer: 1, isCorrect: true },
      { questionId: '2', selectedAnswer: 2, isCorrect: true },
      { questionId: '3', selectedAnswer: 2, isCorrect: true },
      { questionId: '4', selectedAnswer: 1, isCorrect: true },
      { questionId: '5', selectedAnswer: 0, isCorrect: false }
    ],
    completedAt: new Date('2024-01-20')
  }
]

// Asignar módulos a cursos
mockCourses[0].modules = [mockModules[0], mockModules[1], mockModules[2]]

// Asignar tests a módulos
mockModules[0].tests = [mockTests[0]]

// Funciones de utilidad
export const getUserById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id)
}

export const getCourseById = (id: string): Course | undefined => {
  return mockCourses.find(course => course.id === id)
}

export const getModuleById = (id: string): Module | undefined => {
  return mockModules.find(module => module.id === id)
}

export const getTestById = (id: string): Test | undefined => {
  return mockTests.find(test => test.id === id)
}

export const getUserTestResults = (userId: string): TestResult[] => {
  return mockTestResults.filter(result => result.userId === userId)
}