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
  // Geometría 2D interactiva
  geometry2D?: Geometry2DContent
  // Geometría 3D interactiva
  geometry3D?: Geometry3DObject[]
}

// ============================================
// Tipos para Geometría 2D Interactiva
// ============================================

export interface GeometryVertex {
  id: string
  x: number
  y: number
  label?: string              // Etiqueta opcional (A, B, C, etc.)
  color?: string
}

export interface GeometryEdge {
  id: string
  startVertexId: string       // ID del vértice inicial
  endVertexId: string         // ID del vértice final
  color?: string
  strokeWidth?: number
}

export interface GeometryAngle {
  id: string
  vertexAId: string           // Primer punto del ángulo
  vertexVId: string           // Vértice del ángulo (centro)
  vertexBId: string           // Segundo punto del ángulo
  value?: string              // Valor del ángulo (ej: "45°")
  color?: string
  arcRadius?: number
}

export type GeometryMarkType = 'lines' | 'circle' | 'thick' | 'zigzag'

export interface GeometryMark {
  id: string
  edgeId: string              // ID del segmento al que pertenece
  type: GeometryMarkType      // Tipo de marca: || ● ━ 〰
  color?: string
}

export interface GeometryArea {
  id: string
  vertexIds: string[]         // IDs de los vértices que forman el área
  fillColor: string           // Color de relleno con transparencia
}

export interface Geometry2DFigure {
  id: string
  figureType: 'triangle' | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'circle'
  vertexIds: string[]         // IDs de los vértices que forman la figura
  edgeIds: string[]           // IDs de las aristas
  centerX?: number            // Para círculos
  centerY?: number
  radius?: number
  fillColor?: string
}

export interface Geometry2DContent {
  vertices: GeometryVertex[]
  edges: GeometryEdge[]
  angles: GeometryAngle[]
  marks: GeometryMark[]
  areas: GeometryArea[]
  figures: Geometry2DFigure[]
  circles: GeometryCircle[]
}

export interface GeometryCircle {
  id: string
  centerX: number
  centerY: number
  radius: number
  fillColor?: string
  strokeColor?: string
}

// ============================================
// Tipos para Geometría 3D Interactiva
// ============================================

export interface Geometry3DVertex {
  id: string
  x: number
  y: number
  z: number
  isUserAdded?: boolean       // Si fue agregado por el usuario sobre una arista
}

export interface Geometry3DEdge {
  id: string
  startVertexId: string
  endVertexId: string
  color?: string
  isUserAdded?: boolean
}

export interface Geometry3DFace {
  id: string
  vertexIds: string[]         // IDs de los vértices que forman la cara
  fillColor: string
  opacity?: number
}

export interface Geometry3DAngle {
  id: string
  vertexAId: string
  vertexVId: string
  vertexBId: string
  value?: string
}

export type Geometry3DFigureType = 'cube' | 'tetrahedron' | 'cone' | 'sphere' | 'pyramid' | 'cylinder' | 'prism'

export interface Geometry3DObject {
  id: string
  figureType: Geometry3DFigureType
  x: number                   // Posición en el canvas 2D
  y: number
  width: number               // Tamaño del visor 3D
  height: number
  rotationX: number           // Rotación actual
  rotationY: number
  scale: number
  vertices: Geometry3DVertex[]
  edges: Geometry3DEdge[]
  faces: Geometry3DFace[]
  angles: Geometry3DAngle[]
  cameraPosition?: { x: number; y: number; z: number }
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