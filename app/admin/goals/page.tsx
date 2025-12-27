// @ts-nocheck
'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface WeeklyGoal {
  id: number
  weekNumber: number
  title: string
  startDate: string
  endDate: string
  testIds: number[]
  createdAt?: string
}

interface Course {
  id: number
  title: string
  description: string
}

interface Module {
  id: number
  courseId: number
  title: string
  order: number
}

interface Test {
  id: number
  courseId: number
  moduleId: number
  title: string
}

interface User {
  id: number
  name: string
  username: string
  role: string
  status: string
}

interface GoalAssignment {
  id: number
  userId: number
  weeklyGoalId: number
  assignedAt: string
  userName: string
  username: string
  goalTitle: string
  weekNumber: number
  startDate: string
  endDate: string
}

export default function AdminGoalsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<WeeklyGoal[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [assignments, setAssignments] = useState<GoalAssignment[]>([])
  
  const [activeTab, setActiveTab] = useState<'goals' | 'assignments' | 'progress'>('goals')
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<WeeklyGoal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<WeeklyGoal | null>(null)
  const [assigningGoal, setAssigningGoal] = useState<WeeklyGoal | null>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState({ goalId: 'all', userId: 'all' })
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    weekNumber: 1,
    title: '',
    startDate: '',
    endDate: '',
    testIds: [] as number[]
  })
  
  // Test selection state
  const [testSearchTerm, setTestSearchTerm] = useState('')
  const [expandedCourses, setExpandedCourses] = useState<number[]>([])
  
  // Assignment form state
  const [assignFormData, setAssignFormData] = useState({
    assignToAll: true,
    selectedUserIds: [] as number[]
  })
  
  const [isSaving, setIsSaving] = useState(false)
  
  // Progress tab state
  const [progressData, setProgressData] = useState<any[]>([])
  const [progressSummary, setProgressSummary] = useState<any>(null)
  const [progressFilter, setProgressFilter] = useState({ goalId: 'all', status: 'all' })
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [expandedProgress, setExpandedProgress] = useState<number | null>(null)
  
  // Estado para modal de vista de examen
  const [showExamPreviewModal, setShowExamPreviewModal] = useState(false)
  const [examPreviewData, setExamPreviewData] = useState<any>(null)
  const [loadingExamPreview, setLoadingExamPreview] = useState(false)
  const [examFilter, setExamFilter] = useState<'all' | 'correct' | 'incorrect'>('all')

  useEffect(() => {
    loadData()
  }, [])
  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadData = async () => {
    try {
      setLoading(true)
      const [goalsRes, coursesRes, modulesRes, testsRes, usersRes, assignmentsRes] = await Promise.all([
        fetch('/api/weekly-goals'),
        fetch('/api/courses'),
        fetch('/api/modules'),
        fetch('/api/tests'),
        fetch('/api/users'),
        fetch('/api/goal-assignments')
      ])
      
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setGoals(goalsData)
      }
      
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json()
        setCourses(coursesData)
      }
      
      if (modulesRes.ok) {
        const modulesData = await modulesRes.json()
        setModules(modulesData)
      }
      
      if (testsRes.ok) {
        const testsData = await testsRes.json()
        setTests(testsData)
      }
      
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.filter((u: User) => u.role === 'student'))
      }
      
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json()
        setAssignments(assignmentsData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Error al cargar datos', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Cargar progreso cuando cambia el filtro o se activa la pestaña
  const loadProgress = async (goalIdFilter?: string) => {
    try {
      setLoadingProgress(true)
      const goalParam = goalIdFilter && goalIdFilter !== 'all' ? `?goalId=${goalIdFilter}` : ''
      const response = await fetch(`/api/goal-progress${goalParam}`)
      
      if (response.ok) {
        const data = await response.json()
        setProgressData(data.progress || [])
        setProgressSummary(data.summary || null)
      }
    } catch (error) {
      console.error('Error loading progress:', error)
      setToast({ message: 'Error al cargar progreso', type: 'error' })
    } finally {
      setLoadingProgress(false)
    }
  }
  
  // Cargar vista previa del examen de un estudiante
  const loadExamPreview = async (userId: number, testId: number, testTitle: string, userName: string) => {
    try {
      setLoadingExamPreview(true)
      setShowExamPreviewModal(true)
      setExamFilter('all') // Resetear filtro al abrir
      
      // Cargar el resultado del test
      const resultRes = await fetch(`/api/test-results?userId=${userId}&testId=${testId}`)
      const resultData = await resultRes.json()
      
      // Cargar las preguntas del test
      const testRes = await fetch(`/api/tests?id=${testId}`)
      const testData = await testRes.json()
      
      if (resultData.length > 0 && testData) {
        const result = resultData[0]
        const test = Array.isArray(testData) ? testData[0] : testData
        
        setExamPreviewData({
          userName,
          testTitle,
          testId,
          score: result.score,
          totalQuestions: result.totalQuestions,
          percentage: result.percentage,
          completedAt: result.completedAt,
          answers: result.answers,
          questions: test.questions || []
        })
      } else {
        setToast({ message: 'No se encontraron datos del examen', type: 'error' })
        setShowExamPreviewModal(false)
      }
    } catch (error) {
      console.error('Error loading exam preview:', error)
      setToast({ message: 'Error al cargar el examen', type: 'error' })
      setShowExamPreviewModal(false)
    } finally {
      setLoadingExamPreview(false)
    }
  }
  
  // Cargar progreso cuando se activa la pestaña
  useEffect(() => {
    if (activeTab === 'progress') {
      loadProgress(progressFilter.goalId)
    }
  }, [activeTab])
  
  // Recargar cuando cambia el filtro de meta
  useEffect(() => {
    if (activeTab === 'progress') {
      loadProgress(progressFilter.goalId)
    }
  }, [progressFilter.goalId])

  const resetForm = () => {
    setFormData({
      weekNumber: 1,
      title: '',
      startDate: '',
      endDate: '',
      testIds: []
    })
    setTestSearchTerm('')
    setExpandedCourses([])
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (goal: WeeklyGoal) => {
    setEditingGoal(goal)
    setFormData({
      weekNumber: goal.weekNumber,
      title: goal.title,
      startDate: goal.startDate,
      endDate: goal.endDate,
      testIds: goal.testIds || []
    })
    setShowEditModal(true)
  }

  const openDeleteModal = (goal: WeeklyGoal) => {
    setDeletingGoal(goal)
    setShowDeleteModal(true)
  }

  const handleCreateGoal = async () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      setToast({ message: 'Complete todos los campos requeridos', type: 'error' })
      return
    }
    
    try {
      setIsSaving(true)
      const response = await fetch('/api/weekly-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber: formData.weekNumber,
          title: formData.title,
          startDate: formData.startDate,
          endDate: formData.endDate,
          testIds: formData.testIds
        })
      })
      
      if (response.ok) {
        setToast({ message: 'Meta creada exitosamente', type: 'success' })
        setShowCreateModal(false)
        loadData()
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Error al crear meta', type: 'error' })
      }
    } catch (error) {
      console.error('Error creating goal:', error)
      setToast({ message: 'Error al crear meta', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateGoal = async () => {
    if (!editingGoal) return
    
    if (!formData.title || !formData.startDate || !formData.endDate) {
      setToast({ message: 'Complete todos los campos requeridos', type: 'error' })
      return
    }
    
    try {
      setIsSaving(true)
      const response = await fetch('/api/weekly-goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGoal.id,
          weekNumber: formData.weekNumber,
          title: formData.title,
          startDate: formData.startDate,
          endDate: formData.endDate,
          testIds: formData.testIds
        })
      })
      
      if (response.ok) {
        setToast({ message: 'Meta actualizada exitosamente', type: 'success' })
        setShowEditModal(false)
        setEditingGoal(null)
        loadData()
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Error al actualizar meta', type: 'error' })
      }
    } catch (error) {
      console.error('Error updating goal:', error)
      setToast({ message: 'Error al actualizar meta', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteGoal = async () => {
    if (!deletingGoal) return
    
    try {
      setIsSaving(true)
      const response = await fetch(`/api/weekly-goals?id=${deletingGoal.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setToast({ message: 'Meta eliminada exitosamente', type: 'success' })
        setShowDeleteModal(false)
        setDeletingGoal(null)
        loadData()
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Error al eliminar meta', type: 'error' })
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      setToast({ message: 'Error al eliminar meta', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // === FUNCIONES DE ASIGNACIÓN ===
  
  const openAssignModal = (goal: WeeklyGoal) => {
    setAssigningGoal(goal)
    setAssignFormData({
      assignToAll: true,
      selectedUserIds: []
    })
    setShowAssignModal(true)
  }

  const handleAssignGoal = async () => {
    if (!assigningGoal) return
    
    try {
      setIsSaving(true)
      const response = await fetch('/api/goal-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: assigningGoal.id,
          assignToAll: assignFormData.assignToAll,
          userIds: assignFormData.assignToAll ? [] : assignFormData.selectedUserIds
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setToast({ 
          message: `Meta asignada a ${result.assigned} estudiante(s)${result.skipped > 0 ? ` (${result.skipped} ya asignados)` : ''}`, 
          type: 'success' 
        })
        setShowAssignModal(false)
        setAssigningGoal(null)
        loadData()
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Error al asignar meta', type: 'error' })
      }
    } catch (error) {
      console.error('Error assigning goal:', error)
      setToast({ message: 'Error al asignar meta', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveAssignment = async (assignment: GoalAssignment) => {
    try {
      const response = await fetch(`/api/goal-assignments?id=${assignment.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setToast({ message: 'Asignación eliminada', type: 'success' })
        loadData()
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Error al eliminar asignación', type: 'error' })
      }
    } catch (error) {
      console.error('Error removing assignment:', error)
      setToast({ message: 'Error al eliminar asignación', type: 'error' })
    }
  }

  const toggleUserSelection = (userId: number) => {
    setAssignFormData(prev => {
      const newIds = prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter(id => id !== userId)
        : [...prev.selectedUserIds, userId]
      return { ...prev, selectedUserIds: newIds }
    })
  }

  const getAssignmentCountForGoal = (goalId: number) => {
    return assignments.filter(a => a.weeklyGoalId === goalId).length
  }

  const toggleTestSelection = (testId: number) => {
    setFormData(prev => {
      const newTestIds = prev.testIds.includes(testId)
        ? prev.testIds.filter(id => id !== testId)
        : [...prev.testIds, testId]
      return { ...prev, testIds: newTestIds }
    })
  }

  const getCourseName = (courseId: number) => {
    return courses.find(c => c.id === courseId)?.title || 'Curso no encontrado'
  }

  // Obtener todos los tests agrupados por curso
  const getTestsGroupedByCourse = () => {
    const grouped: { [courseId: number]: typeof tests } = {}
    courses.forEach(course => {
      const courseTests = tests.filter(t => t.courseId === course.id)
      if (courseTests.length > 0) {
        grouped[course.id] = courseTests
      }
    })
    return grouped
  }

  // Obtener módulos para un curso específico
  const getModulesForCourse = (courseId: number) => {
    return modules.filter(m => m.courseId === courseId).sort((a, b) => a.order - b.order)
  }

  const getModuleName = (moduleId: number) => {
    return modules.find(m => m.id === moduleId)?.title || 'Módulo'
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('es-PE', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Lima'
    })
  }

  const filteredGoals = goals.filter(goal => {
    const matchesSearch = goal.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }).sort((a, b) => {
    // Ordenar por número de semana
    return a.weekNumber - b.weekNumber
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <AdminHeader />

        <main className="flex-grow p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-secondary-900">Metas Semanales</h1>
                  <p className="text-sm text-secondary-600 mt-1">
                    Administra las metas de estudio semanales para los cursos
                  </p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Nueva Meta
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <div className="flex gap-8">
                <button
                  onClick={() => setActiveTab('goals')}
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                    activeTab === 'goals'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  <p className="text-sm font-bold">Metas ({goals.length})</p>
                </button>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                    activeTab === 'assignments'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  <p className="text-sm font-bold">Asignaciones ({assignments.length})</p>
                </button>
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                    activeTab === 'progress'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  <p className="text-sm font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                    Progreso
                  </p>
                </button>
              </div>
            </div>

            {/* Tab: Metas */}
            {activeTab === 'goals' && (
              <>
                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-secondary-700 mb-1">Buscar</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-secondary-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Buscar por título..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Goals Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {filteredGoals.length === 0 ? (
                    <div className="p-12 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto text-secondary-300 mb-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                      </svg>
                      <h3 className="text-lg font-semibold text-secondary-900 mb-2">No hay metas semanales</h3>
                      <p className="text-secondary-600 mb-4">
                        {searchTerm 
                          ? 'No se encontraron metas con los filtros aplicados'
                          : 'Crea tu primera meta semanal para que los estudiantes puedan seguir su progreso'}
                      </p>
                      <button
                        onClick={openCreateModal}
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        Crear Meta
                      </button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-secondary-50 border-b border-secondary-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700">Semana</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700">Título</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700">Período</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Tests</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Asignados</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGoals.map((goal) => (
                          <tr 
                            key={goal.id} 
                        className="border-b border-secondary-100 hover:bg-secondary-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                            {goal.weekNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-secondary-900">{goal.title}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-secondary-600">
                          {formatDate(goal.startDate)} - {formatDate(goal.endDate)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-secondary-100 text-secondary-700 text-xs font-medium">
                            {goal.testIds?.length || 0} test{goal.testIds?.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                            {getAssignmentCountForGoal(goal.id)} alumno{getAssignmentCountForGoal(goal.id) !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openAssignModal(goal)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Asignar a estudiantes"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => openEditModal(goal)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar meta"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => openDeleteModal(goal)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar meta"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Tab: Asignaciones */}
        {activeTab === 'assignments' && (
          <>
            {/* Consultar Asignaciones */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-secondary-800 mb-4">Consultar Asignaciones</h3>
              
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Estudiante
                  </label>
                  <select
                    value={assignmentFilter.userId}
                    onChange={(e) => setAssignmentFilter({ goalId: 'all', userId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">Seleccionar estudiante...</option>
                    {users.filter(u => u.role === 'student').map(user => (
                      <option key={user.id} value={user.id}>{user.name} ({user.username})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end text-secondary-400 font-medium">o</div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Meta Semanal
                  </label>
                  <select
                    value={assignmentFilter.goalId}
                    onChange={(e) => setAssignmentFilter({ userId: 'all', goalId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">Seleccionar meta...</option>
                    {goals.map(goal => (
                      <option key={goal.id} value={goal.id}>Semana {goal.weekNumber}: {goal.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Resultados */}
              {assignmentFilter.userId !== 'all' && (
                <div className="border border-secondary-200 rounded-lg">
                  <div className="bg-secondary-50 px-4 py-3 border-b border-secondary-200">
                    <h4 className="font-medium text-secondary-800">
                      Metas asignadas a: {users.find(u => u.id === parseInt(assignmentFilter.userId))?.name}
                    </h4>
                  </div>
                  <div className="p-4">
                    {(() => {
                      const userAssignments = assignments.filter(a => a.userId === parseInt(assignmentFilter.userId))
                      if (userAssignments.length === 0) {
                        return <p className="text-sm text-secondary-500 text-center py-4">Este estudiante no tiene metas asignadas</p>
                      }
                      return (
                        <div className="space-y-2">
                          {userAssignments.map(a => (
                            <div key={a.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                                  S{a.weekNumber}
                                </span>
                                <div>
                                  <span className="font-medium text-secondary-900">{a.goalTitle}</span>
                                  <p className="text-xs text-secondary-500">{formatDate(a.startDate)} - {formatDate(a.endDate)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveAssignment(a)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
              
              {assignmentFilter.goalId !== 'all' && (
                <div className="border border-secondary-200 rounded-lg">
                  <div className="bg-secondary-50 px-4 py-3 border-b border-secondary-200">
                    <h4 className="font-medium text-secondary-800">
                      Estudiantes con: {goals.find(g => g.id === parseInt(assignmentFilter.goalId))?.title}
                    </h4>
                  </div>
                  <div className="p-4">
                    {(() => {
                      const goalAssignments = assignments.filter(a => a.weeklyGoalId === parseInt(assignmentFilter.goalId))
                      if (goalAssignments.length === 0) {
                        return <p className="text-sm text-secondary-500 text-center py-4">Esta meta no está asignada a ningún estudiante</p>
                      }
                      return (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {goalAssignments.map(a => (
                            <div key={a.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                              <div>
                                <span className="font-medium text-secondary-900">{a.userName}</span>
                                <span className="text-sm text-secondary-500 ml-2">@{a.username}</span>
                              </div>
                              <button
                                onClick={() => handleRemoveAssignment(a)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
              
              {assignmentFilter.userId === 'all' && assignmentFilter.goalId === 'all' && (
                <div className="text-center py-8 text-secondary-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-secondary-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                  <p>Selecciona un estudiante o una meta para ver las asignaciones</p>
                </div>
              )}
              
              {/* Resumen */}
              <div className="mt-6 pt-4 border-t border-secondary-200 flex flex-wrap gap-6 text-sm text-secondary-600">
                <span>Total asignaciones: <strong className="text-secondary-900">{assignments.length}</strong></span>
                <span>Estudiantes con metas: <strong className="text-secondary-900">{new Set(assignments.map(a => a.userId)).size}</strong></span>
                <span>Metas en uso: <strong className="text-secondary-900">{new Set(assignments.map(a => a.weeklyGoalId)).size}</strong></span>
              </div>
            </div>
          </>
        )}

        {/* Tab: Progreso */}
        {activeTab === 'progress' && (
          <>
            {/* Filtros de Progreso */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Filtrar por Meta
                  </label>
                  <select
                    value={progressFilter.goalId}
                    onChange={(e) => setProgressFilter({ ...progressFilter, goalId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">Todas las metas</option>
                    {goals.map(goal => (
                      <option key={goal.id} value={goal.id}>
                        Semana {goal.weekNumber}: {goal.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[180px]">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={progressFilter.status}
                    onChange={(e) => setProgressFilter({ ...progressFilter, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">Todos</option>
                    <option value="completed">✅ Completado</option>
                    <option value="in-progress">🔄 En progreso</option>
                    <option value="not-started">⏳ Sin iniciar</option>
                  </select>
                </div>
                <button
                  onClick={() => loadProgress(progressFilter.goalId)}
                  disabled={loadingProgress}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingProgress ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                  )}
                  Actualizar
                </button>
              </div>
            </div>

            {/* Resumen de Progreso */}
            {progressSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                  <p className="text-xs text-secondary-500 uppercase font-medium">Total</p>
                  <p className="text-2xl font-bold text-secondary-900">{progressSummary.totalAssignments}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                  <p className="text-xs text-secondary-500 uppercase font-medium">Completados</p>
                  <p className="text-2xl font-bold text-green-600">{progressSummary.completed}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500">
                  <p className="text-xs text-secondary-500 uppercase font-medium">En progreso</p>
                  <p className="text-2xl font-bold text-yellow-600">{progressSummary.inProgress}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400">
                  <p className="text-xs text-secondary-500 uppercase font-medium">Sin iniciar</p>
                  <p className="text-2xl font-bold text-gray-500">{progressSummary.notStarted}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
                  <p className="text-xs text-secondary-500 uppercase font-medium">% Avance</p>
                  <p className="text-2xl font-bold text-purple-600">{progressSummary.averageCompletion}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                  <p className="text-xs text-secondary-500 uppercase font-medium">Nota Prom.</p>
                  <p className="text-2xl font-bold text-orange-600">{progressSummary.averageScore}%</p>
                </div>
              </div>
            )}

            {/* Tabla de Progreso */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {loadingProgress ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
              ) : progressData.length === 0 ? (
                <div className="p-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto text-secondary-300 mb-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-secondary-900 mb-2">No hay datos de progreso</h3>
                  <p className="text-secondary-600">
                    {progressFilter.goalId !== 'all' 
                      ? 'No hay estudiantes asignados a esta meta'
                      : 'Asigna metas a estudiantes para ver su progreso'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-secondary-50 border-b border-secondary-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700">Estudiante</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700">Meta</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Tests</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Promedio</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Estado</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Última actividad</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-700">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressData
                        .filter(p => progressFilter.status === 'all' || p.status === progressFilter.status)
                        .map((progress: any) => (
                        <React.Fragment key={progress.assignmentId}>
                          <tr className="border-b border-secondary-100 hover:bg-secondary-50 transition-colors">
                            <td className="py-3 px-4">
                              <div>
                                <span className="font-medium text-secondary-900">{progress.userName}</span>
                                <p className="text-xs text-secondary-500">@{progress.username}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-bold text-xs">
                                  S{progress.weekNumber}
                                </span>
                                <span className="text-sm text-secondary-800">{progress.goalTitle}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className={`font-bold ${progress.completedTests === progress.totalTests && progress.totalTests > 0 ? 'text-green-600' : 'text-secondary-700'}`}>
                                  {progress.completedTests}
                                </span>
                                <span className="text-secondary-400">/</span>
                                <span className="text-secondary-500">{progress.totalTests}</span>
                              </div>
                              {progress.totalTests > 0 && (
                                <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all ${
                                      progress.completedTests === progress.totalTests ? 'bg-green-500' :
                                      progress.completedTests > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${(progress.completedTests / progress.totalTests) * 100}%` }}
                                  ></div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {progress.completedTests > 0 ? (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold ${
                                  progress.averagePercentage >= 90 ? 'bg-green-100 text-green-700' :
                                  progress.averagePercentage >= 70 ? 'bg-blue-100 text-blue-700' :
                                  progress.averagePercentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {progress.averagePercentage}%
                                </span>
                              ) : (
                                <span className="text-secondary-400 text-sm">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {progress.status === 'completed' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                  </svg>
                                  Completado
                                </span>
                              )}
                              {progress.status === 'in-progress' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                                  </svg>
                                  En progreso
                                </span>
                              )}
                              {progress.status === 'not-started' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                                    <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                  </svg>
                                  Sin iniciar
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-secondary-600">
                              {progress.lastActivity ? (
                                new Date(progress.lastActivity).toLocaleDateString('es-PE', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              ) : (
                                <span className="text-secondary-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setExpandedProgress(expandedProgress === progress.assignmentId ? null : progress.assignmentId)}
                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Ver detalle"
                              >
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className={`w-5 h-5 transition-transform ${expandedProgress === progress.assignmentId ? 'rotate-180' : ''}`} 
                                  viewBox="0 0 24 24" 
                                  fill="currentColor"
                                >
                                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                          {/* Fila expandida con detalle de tests */}
                          {expandedProgress === progress.assignmentId && progress.testDetails.length > 0 && (
                            <tr>
                              <td colSpan={7} className="bg-secondary-50 px-4 py-3">
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-secondary-700 mb-2">Detalle de tests:</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {progress.testDetails.map((test: any, idx: number) => (
                                      <div 
                                        key={idx}
                                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                                          test.completed 
                                            ? 'bg-white border-green-200' 
                                            : 'bg-gray-50 border-gray-200'
                                        }`}
                                      >
                                        {test.completed ? (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                          </svg>
                                        ) : (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                                          </svg>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm truncate ${test.completed ? 'text-secondary-900' : 'text-secondary-500'}`}>
                                            {test.testTitle || `Test ${test.testId}`}
                                          </p>
                                          {test.completed ? (
                                            <p className="text-xs text-secondary-500">
                                              {test.score}/{test.totalQuestions} ({test.percentage}%)
                                            </p>
                                          ) : (
                                            <p className="text-xs text-orange-500 font-medium">
                                              Pendiente
                                            </p>
                                          )}
                                        </div>
                                        {test.completed ? (
                                          <div className="flex items-center gap-1">
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                              test.percentage >= 90 ? 'bg-green-100 text-green-700' :
                                              test.percentage >= 70 ? 'bg-blue-100 text-blue-700' :
                                              test.percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-red-100 text-red-700'
                                            }`}>
                                              {test.percentage}%
                                            </span>
                                            <button
                                              onClick={() => loadExamPreview(progress.userId, test.testId, test.testTitle || `Test ${test.testId}`, progress.userName)}
                                              className="p-1 rounded-full hover:bg-blue-100 text-blue-600 transition-colors"
                                              title="Ver examen"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                              </svg>
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-600">
                                            ⏳
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

          </div>
        </main>

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-secondary-200">
                <h2 className="text-xl font-bold text-secondary-900">
                  {showCreateModal ? 'Crear Nueva Meta Semanal' : 'Editar Meta Semanal'}
                </h2>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  {/* Número de semana y título en una fila */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Semana <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.weekNumber}
                        onChange={(e) => setFormData({ ...formData, weekNumber: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Título <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Meta de la Semana 1"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Fecha de Inicio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Fecha de Fin <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Selección de Tests - Todos los cursos */}
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Tests incluidos en la meta
                    </label>
                    
                    {/* Buscador de tests */}
                    <div className="relative mb-3">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-secondary-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar tests por nombre..."
                        value={testSearchTerm}
                        onChange={(e) => setTestSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      {testSearchTerm && (
                        <button
                          onClick={() => setTestSearchTerm('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary-400 hover:text-secondary-600"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {/* Tests seleccionados (chips) */}
                    {formData.testIds.length > 0 && (
                      <div className="mb-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-primary-800">
                            {formData.testIds.length} test{formData.testIds.length !== 1 ? 's' : ''} seleccionado{formData.testIds.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => setFormData({ ...formData, testIds: [] })}
                            className="text-xs text-primary-600 hover:text-primary-800 underline"
                          >
                            Limpiar todo
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {formData.testIds.slice(0, 10).map(testId => {
                            const test = tests.find(t => t.id === testId)
                            if (!test) return null
                            return (
                              <span 
                                key={testId}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs text-secondary-700 border border-primary-200"
                              >
                                {test.title.length > 25 ? test.title.slice(0, 25) + '...' : test.title}
                                <button
                                  onClick={() => toggleTestSelection(testId)}
                                  className="text-secondary-400 hover:text-red-500"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                  </svg>
                                </button>
                              </span>
                            )
                          })}
                          {formData.testIds.length > 10 && (
                            <span className="px-2 py-1 text-xs text-secondary-500">
                              +{formData.testIds.length - 10} más
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {courses.length === 0 ? (
                      <div className="p-4 bg-secondary-50 rounded-lg text-secondary-600 text-sm text-center">
                        No hay cursos disponibles
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                        {(() => {
                          // Filtrar tests por búsqueda
                          const searchLower = testSearchTerm.toLowerCase()
                          const filteredTests = testSearchTerm
                            ? tests.filter(t => t.title.toLowerCase().includes(searchLower))
                            : tests
                          
                          // Si hay búsqueda, mostrar resultados directamente
                          if (testSearchTerm && filteredTests.length > 0) {
                            return (
                              <div className="divide-y divide-gray-100">
                                {filteredTests.map(test => {
                                  const course = courses.find(c => c.id === test.courseId)
                                  const module = modules.find(m => m.id === test.moduleId)
                                  return (
                                    <label 
                                      key={test.id}
                                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={formData.testIds.includes(test.id)}
                                        onChange={() => toggleTestSelection(test.id)}
                                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm text-secondary-900 block">{test.title}</span>
                                        <span className="text-xs text-secondary-500">
                                          {course?.title} → {module?.title}
                                        </span>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            )
                          }
                          
                          if (testSearchTerm && filteredTests.length === 0) {
                            return (
                              <div className="p-8 text-center text-secondary-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-2 text-secondary-300" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                                </svg>
                                <p className="text-sm">No se encontraron tests con "{testSearchTerm}"</p>
                              </div>
                            )
                          }
                          
                          // Vista por acordeón de cursos
                          return courses.map(course => {
                            const courseModules = getModulesForCourse(course.id)
                            const courseTests = tests.filter(t => t.courseId === course.id)
                            if (courseTests.length === 0) return null
                            
                            const selectedInCourse = courseTests.filter(t => formData.testIds.includes(t.id)).length
                            const isExpanded = expandedCourses.includes(course.id)
                            
                            return (
                              <div key={course.id} className="border-b border-gray-200 last:border-b-0">
                                {/* Course Header - Clickable */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedCourses(prev => 
                                      prev.includes(course.id) 
                                        ? prev.filter(id => id !== course.id)
                                        : [...prev, course.id]
                                    )
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary-50 hover:bg-secondary-100 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <svg 
                                      xmlns="http://www.w3.org/2000/svg" 
                                      className={`w-4 h-4 text-secondary-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                                      viewBox="0 0 24 24" 
                                      fill="currentColor"
                                    >
                                      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                                    </svg>
                                    <span className="font-medium text-secondary-800">{course.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {selectedInCourse > 0 && (
                                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">
                                        {selectedInCourse} seleccionado{selectedInCourse !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    <span className="text-xs text-secondary-500">
                                      {courseTests.length} test{courseTests.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </button>
                                
                                {/* Modules and Tests - Collapsible */}
                                {isExpanded && (
                                  <div className="border-t border-gray-200">
                                    {courseModules.map(module => {
                                      const moduleTests = tests.filter(t => t.moduleId === module.id)
                                      if (moduleTests.length === 0) return null
                                      
                                      return (
                                        <div key={module.id} className="border-b border-gray-100 last:border-b-0">
                                          <div className="bg-gray-50 px-6 py-1.5">
                                            <span className="font-medium text-secondary-600 text-xs">{module.title}</span>
                                          </div>
                                          <div className="divide-y divide-gray-50">
                                            {moduleTests.map(test => (
                                              <label 
                                                key={test.id}
                                                className="flex items-center gap-3 px-8 py-2 hover:bg-primary-50 cursor-pointer transition-colors"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={formData.testIds.includes(test.id)}
                                                  onChange={() => toggleTestSelection(test.id)}
                                                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-secondary-900">{test.title}</span>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-secondary-200 bg-secondary-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    setEditingGoal(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-secondary-700 hover:bg-secondary-200 rounded-lg transition-colors"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  onClick={showCreateModal ? handleCreateGoal : handleUpdateGoal}
                  disabled={isSaving}
                  className="btn-primary flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                      {showCreateModal ? 'Crear Meta' : 'Guardar Cambios'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-secondary-900 mb-2">¿Eliminar meta?</h3>
                <p className="text-secondary-600">
                  Estás por eliminar <strong>"{deletingGoal.title}"</strong>. Esta acción no se puede deshacer.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletingGoal(null)
                  }}
                  className="flex-1 px-4 py-2 text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteGoal}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Eliminando...
                    </>
                  ) : (
                    'Eliminar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Goal Modal */}
        {showAssignModal && assigningGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-secondary-200">
                <h2 className="text-xl font-bold text-secondary-900">
                  Asignar Meta a Estudiantes
                </h2>
                <p className="text-sm text-secondary-600 mt-1">
                  Meta: <strong>{assigningGoal.title}</strong>
                </p>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  {/* Opción de asignar a todos */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg cursor-pointer hover:bg-secondary-100 transition-colors">
                      <input
                        type="radio"
                        name="assignType"
                        checked={assignFormData.assignToAll}
                        onChange={() => setAssignFormData({ ...assignFormData, assignToAll: true, selectedUserIds: [] })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div>
                        <span className="font-medium text-secondary-900">Asignar a todos los estudiantes</span>
                        <p className="text-sm text-secondary-600">{users.length} estudiantes activos</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg cursor-pointer hover:bg-secondary-100 transition-colors">
                      <input
                        type="radio"
                        name="assignType"
                        checked={!assignFormData.assignToAll}
                        onChange={() => setAssignFormData({ ...assignFormData, assignToAll: false })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div>
                        <span className="font-medium text-secondary-900">Seleccionar estudiantes específicos</span>
                        <p className="text-sm text-secondary-600">Elige manualmente a quién asignar</p>
                      </div>
                    </label>
                  </div>

                  {/* Lista de estudiantes (solo si selecciona específicos) */}
                  {!assignFormData.assignToAll && (
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Selecciona los estudiantes ({assignFormData.selectedUserIds.length} seleccionados)
                      </label>
                      <div className="border border-gray-300 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        {users.length === 0 ? (
                          <div className="p-4 text-center text-secondary-500 text-sm">
                            No hay estudiantes activos
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {users.map(student => {
                              const isAlreadyAssigned = assignments.some(
                                a => a.userId === student.id && a.weeklyGoalId === assigningGoal.id
                              )
                              return (
                                <label 
                                  key={student.id}
                                  className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                                    isAlreadyAssigned 
                                      ? 'bg-gray-100 cursor-not-allowed' 
                                      : 'hover:bg-primary-50 cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={assignFormData.selectedUserIds.includes(student.id)}
                                    onChange={() => !isAlreadyAssigned && toggleUserSelection(student.id)}
                                    disabled={isAlreadyAssigned}
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm text-secondary-900">{student.name}</span>
                                    <span className="text-xs text-secondary-500 ml-2">({student.username})</span>
                                  </div>
                                  {isAlreadyAssigned && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                      Ya asignado
                                    </span>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-secondary-200 bg-secondary-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setAssigningGoal(null)
                  }}
                  className="px-4 py-2 text-secondary-700 hover:bg-secondary-200 rounded-lg transition-colors"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssignGoal}
                  disabled={isSaving || (!assignFormData.assignToAll && assignFormData.selectedUserIds.length === 0)}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Asignando...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      Asignar Meta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Vista Previa del Examen */}
        {showExamPreviewModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Vista del Examen</h3>
                    {examPreviewData && (
                      <p className="text-blue-100 text-sm">{examPreviewData.userName} - {examPreviewData.testTitle}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowExamPreviewModal(false)
                    setExamPreviewData(null)
                  }}
                  className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>

              {/* Loading */}
              {loadingExamPreview && (
                <div className="flex-1 flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-secondary-600">Cargando examen...</p>
                  </div>
                </div>
              )}

              {/* Contenido */}
              {!loadingExamPreview && examPreviewData && (
                <>
                  {/* Resumen */}
                  <div className="px-6 py-4 bg-secondary-50 border-b">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-xs text-secondary-500 uppercase tracking-wide">Resultado</p>
                          <p className={`text-2xl font-bold ${
                            examPreviewData.percentage >= 70 ? 'text-green-600' :
                            examPreviewData.percentage >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {examPreviewData.score}/{examPreviewData.totalQuestions}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-secondary-500 uppercase tracking-wide">Porcentaje</p>
                          <p className={`text-2xl font-bold ${
                            examPreviewData.percentage >= 70 ? 'text-green-600' :
                            examPreviewData.percentage >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {examPreviewData.percentage}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-secondary-500 uppercase tracking-wide">Fecha</p>
                          <p className="text-sm font-medium text-secondary-700">
                            {examPreviewData.completedAt ? new Date(examPreviewData.completedAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExamFilter(examFilter === 'correct' ? 'all' : 'correct')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                            examFilter === 'correct' 
                              ? 'bg-green-500 text-white ring-2 ring-green-300' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                          Correctas: {examPreviewData.score}
                        </button>
                        <button
                          onClick={() => setExamFilter(examFilter === 'incorrect' ? 'all' : 'incorrect')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                            examFilter === 'incorrect' 
                              ? 'bg-red-500 text-white ring-2 ring-red-300' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                          </svg>
                          Incorrectas: {examPreviewData.totalQuestions - examPreviewData.score}
                        </button>
                        {examFilter !== 'all' && (
                          <button
                            onClick={() => setExamFilter('all')}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                            Limpiar filtro
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lista de preguntas */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {examPreviewData.questions.map((question: any, qIdx: number) => {
                      // Las respuestas se guardan como objetos: { questionId, selectedAnswer, isCorrect }
                      const answerObj = examPreviewData.answers.find((a: any) => a.questionId === question.id) 
                        || examPreviewData.answers[qIdx]
                      const userAnswer = answerObj?.selectedAnswer
                      const isCorrect = answerObj?.isCorrect ?? (userAnswer === question.correctAnswer)
                      
                      // Aplicar filtro
                      if (examFilter === 'correct' && !isCorrect) return null
                      if (examFilter === 'incorrect' && isCorrect) return null
                      
                      return (
                        <div 
                          key={question.id || qIdx}
                          className={`p-4 rounded-lg border-2 ${
                            isCorrect 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          {/* Pregunta */}
                          <div className="flex items-start gap-3 mb-3">
                            <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                              isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                              {qIdx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-secondary-900">{question.question}</p>
                            </div>
                            {isCorrect ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                              </svg>
                            )}
                          </div>

                          {/* Opciones */}
                          <div className="ml-10 space-y-2">
                            {question.options?.map((option: string, optIdx: number) => {
                              const isUserAnswer = userAnswer === optIdx
                              const isCorrectOption = question.correctAnswer === optIdx
                              const optionText = typeof option === 'string' ? option : (option as any).text || ''
                              
                              let bgClass = 'bg-white border-gray-200'
                              let textClass = 'text-secondary-700'
                              let icon = null
                              
                              if (isCorrectOption) {
                                bgClass = 'bg-green-100 border-green-300'
                                textClass = 'text-green-800 font-medium'
                                icon = (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                  </svg>
                                )
                              } else if (isUserAnswer && !isCorrect) {
                                bgClass = 'bg-red-100 border-red-300'
                                textClass = 'text-red-800'
                                icon = (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                  </svg>
                                )
                              }
                              
                              return (
                                <div 
                                  key={optIdx}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bgClass}`}
                                >
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    isCorrectOption ? 'bg-green-500 text-white' :
                                    isUserAnswer && !isCorrect ? 'bg-red-500 text-white' :
                                    'bg-gray-200 text-gray-600'
                                  }`}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span className={`flex-1 text-sm ${textClass}`}>{optionText}</span>
                                  {icon}
                                  {isUserAnswer && (
                                    <span className="text-xs text-secondary-500 italic">
                                      (Respuesta del estudiante)
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Explicación si existe y la respuesta fue incorrecta */}
                          {!isCorrect && question.explanation && (
                            <div className="ml-10 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                                </svg>
                                Explicación
                              </p>
                              <p className="text-sm text-blue-800">{question.explanation}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t bg-secondary-50 flex justify-end">
                    <button
                      onClick={() => {
                        setShowExamPreviewModal(false)
                        setExamPreviewData(null)
                      }}
                      className="px-6 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors font-medium"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
