export interface User {
  id: string
  name: string
  username: string
  password: string
  role: 'student' | 'admin'
  status: 'active' | 'inactive'
  email?: string
  fullName?: string
  createdAt: Date
  updatedAt: Date
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

export interface Question {
  id: string
  testId: string
  question: string
  options: string[]
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