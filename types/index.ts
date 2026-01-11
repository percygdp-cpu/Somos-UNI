export interface User {
  id: string
  name: string
  username: string
  password: string
  role: 'student' | 'admin'
  status: 'active' | 'inactive'
  email?: string
  fullName?: string
  // Campos adicionales para estudiantes
  startDate?: string          // Fecha de inicio de clases
  phone?: string              // Teléfono de contacto
  guardianName?: string       // Nombre del apoderado
  address?: string            // Domicilio
  createdAt: Date
  updatedAt: Date
}

// Interfaces para el módulo de cobranza
export interface StudentBilling {
  id: string
  userId: string
  monthlyAmount: number       // Monto mensual a pagar
  dueDay: number              // Día del mes que vence (1-28)
  startDate: string           // Fecha de inicio de facturación
  status: 'active' | 'suspended' | 'completed'
  createdAt: Date
  updatedAt: Date
}

export interface Invoice {
  id: string
  userId: string
  period: string              // Formato YYYY-MM
  amount: number              // Monto de la cuota
  dueDate: string             // Fecha de vencimiento
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  paidAmount: number          // Monto pagado (para pagos parciales)
  createdAt: Date
  updatedAt: Date
  // Campos adicionales para mostrar en UI
  userName?: string
  remainingAmount?: number
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number              // Monto del pago
  paymentDate: string         // Fecha del pago
  paymentMethod: 'efectivo' | 'transferencia' | 'yape_plin' | 'otro'
  notes?: string              // Notas adicionales
  createdAt: Date
}

export interface Course {
  id: string
  title: string
  description: string
  image: string
  modules: Module[]
  createdAt: Date
  updatedAt: Date
}

export interface Module {
  id: string
  courseId: string
  title: string
  description: string
  order: number
  pdfUrl?: string
  tests: Test[]
  createdAt: Date
  updatedAt: Date
}

export interface Test {
  id: string
  moduleId: string
  title: string
  questions: Question[]
  createdAt: Date
  updatedAt: Date
}

export interface QuestionOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface Question {
  id: string
  testId: string
  question: string
  options: QuestionOption[]
  correctAnswer: number
  order: number
  explanation?: string
}

export interface TestResult {
  id: string
  userId: string
  testId: string
  score: number
  percentage: number
  answers: Answer[]
  completedAt: Date
}

export interface Answer {
  questionId: string
  selectedAnswer: number
  isCorrect: boolean
}

export interface MotivationalPhrase {
  id: string
  phrase: string
  rangeType: '0-30' | '31-50' | '51-70' | '71-90' | '91-100'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

// Tipos para Pizarra Digital
export interface WhiteboardPoint {
  x: number
  y: number
  pressure?: number
}

export interface WhiteboardStroke {
  id: string
  points: WhiteboardPoint[]
  color: string
  size: number
  tool: 'pen' | 'eraser'
  strokeType?: 'free' | 'line' | 'arrow' | 'curveArrow'  // Tipo de trazo: libre, línea, flecha recta, flecha curva
}

export interface WhiteboardTextBox {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  backgroundColor?: string
}

export interface WhiteboardFormula {
  id: string
  latex: string
  x: number
  y: number
  scale: number
  highlightColor?: string  // Color de resaltado (fondo)
  textColor?: string       // Color del texto de la fórmula
}

export interface WhiteboardShape {
  id: string
  shapeType: string
  x: number
  y: number
  scale: number
  color: string
}

export interface WhiteboardImage {
  id: string
  src: string           // Data URL o URL de la imagen
  x: number
  y: number
  width: number
  height: number
  rotation?: number     // Rotación en grados (opcional)
}

export interface WhiteboardContent {
  strokes: WhiteboardStroke[]
  textBoxes?: WhiteboardTextBox[]
  formulas?: WhiteboardFormula[]
  shapes?: WhiteboardShape[]
  images?: WhiteboardImage[]  // Imágenes pegadas
  latexContent?: string       // Contenido LaTeX en tiempo real (posición fija)
  latexFontSize?: number      // Tamaño de fuente del LaTeX
}

export interface Whiteboard {
  id: string
  title: string
  content: WhiteboardContent
  thumbnail?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}