// @ts-nocheck
'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { validateAndCompressPDF } from '@/lib/pdfCompressor'
import { User } from '@/types'
import anime from 'animejs'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'

// Función para renderizar texto con subíndices, superíndices e imágenes
const renderFormattedText = (text: string) => {
  if (!text) return null
  
  // Dividir por saltos de línea y procesar cada línea
  const lines = text.split('\n')
  
  const processLine = (lineText: string, lineIndex: number) => {
    const parts: any[] = []
    
    // Regex para detectar imágenes markdown: ![alt](url) o ![alt](url){width}
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\s*\{(\d+)\})?/g
    const formatRegex = /([_^])(\{([^}]+)\}|(\d+)|([a-zA-Z]))/g
    
    // Primero procesar imágenes
    let imageMatch
    const segments: any[] = []
    let lastIndex = 0
    
    while ((imageMatch = imageRegex.exec(lineText)) !== null) {
      // Agregar texto antes de la imagen
      if (imageMatch.index > lastIndex) {
        segments.push({ type: 'text', content: lineText.substring(lastIndex, imageMatch.index), index: lastIndex })
      }
      
      // Agregar imagen
      segments.push({ 
        type: 'image', 
        alt: imageMatch[1] || 'imagen',
        url: imageMatch[2],
        width: imageMatch[3] ? parseInt(imageMatch[3]) : 300,
        index: imageMatch.index
      })
      
      lastIndex = imageMatch.index + imageMatch[0].length
    }
    
    // Agregar texto restante
    if (lastIndex < lineText.length) {
      segments.push({ type: 'text', content: lineText.substring(lastIndex), index: lastIndex })
    }
    
    // Si no hay imágenes, procesar todo como texto
    if (segments.length === 0) {
      segments.push({ type: 'text', content: lineText, index: 0 })
    }
  
  // Procesar cada segmento
  segments.forEach((segment, segIndex) => {
    if (segment.type === 'image') {
      parts.push(
        <img 
          key={`img-${segment.index}`}
          src={segment.url} 
          alt={segment.alt}
          style={{ maxWidth: `${segment.width}px`, height: 'auto', display: 'inline-block', margin: '0 4px', verticalAlign: 'middle' }}
          className="rounded border border-gray-300"
        />
      )
    } else {
      // Procesar formato de texto (sub/superíndices)
      const textParts: any[] = []
      let textIndex = 0
      let match
      formatRegex.lastIndex = 0
      
      while ((match = formatRegex.exec(segment.content)) !== null) {
        if (match.index > textIndex) {
          textParts.push(segment.content.substring(textIndex, match.index))
        }
        
        const type = match[1]
        const content = match[3] || match[4] || match[5]
        
        if (type === '_') {
          textParts.push(<sub key={`sub-${segment.index}-${match.index}`}>{content}</sub>)
        } else if (type === '^') {
          textParts.push(<sup key={`sup-${segment.index}-${match.index}`}>{content}</sup>)
        }
        
        textIndex = match.index + match[0].length
      }
      
      if (textIndex < segment.content.length) {
        textParts.push(segment.content.substring(textIndex))
      }
      
      // Agregar las partes de texto procesadas
      textParts.forEach(part => parts.push(part))
    }
  })
  
    return parts
  }
  
  // Procesar cada línea y agregar saltos de línea entre ellas
  return (
    <>
      {lines.map((line, idx) => (
        <React.Fragment key={`line-${idx}`}>
          {processLine(line, idx)}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  )
}

export default function UserManagementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'students' | 'courses' | 'modules' | 'tests' | 'phrases'>('students')
  
  // Estados de filtro para cada tabla
  const [studentFilters, setStudentFilters] = useState({
    search: '',
    status: 'all' as 'all' | 'active' | 'inactive',
    role: 'all' as 'all' | 'student' | 'admin'
  })
  const [showStudentFilters, setShowStudentFilters] = useState(false)
  const [courseFilters, setCourseFilters] = useState({
    search: ''
  })
  const [moduleFilters, setModuleFilters] = useState({
    search: '',
    courseId: 'all'
  })
  const [showModuleFilters, setShowModuleFilters] = useState(false)
  const [testFilters, setTestFilters] = useState({
    search: '',
    courseId: 'all',
    moduleId: 'all'
  })
  const [showTestFilters, setShowTestFilters] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null)
  const [modifiedUserIds, setModifiedUserIds] = useState<string[]>([])
  const [visiblePasswords, setVisiblePasswords] = useState<string[]>([])
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingTab, setPendingTab] = useState<'students' | 'courses' | 'modules' | 'tests' | 'phrases' | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteItem, setDeleteItem] = useState<{ id: string; type: 'user' | 'course' | 'module' | 'test' | 'phrase'; name: string } | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    role: 'student' as 'student' | 'admin',
    status: 'active' as 'active' | 'inactive'
  })
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    image: ''
  })
  const [newModule, setNewModule] = useState({
    title: '',
    description: '',
    courseId: '',
    order: 1,
    pdfFiles: [] as { name: string; url: string }[]
  })
  const [newTest, setNewTest] = useState({
    title: '',
    courseId: '',
    moduleId: '',
    questions: [] as any[]
  })
  const [courses, setCourses] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [phrases, setPhrases] = useState<any[]>([])
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [pendingTests, setPendingTests] = useState<any[]>([])
  const [showTestPreviewModal, setShowTestPreviewModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Estados para modal de reordenamiento de módulos
  const [showReorderModal, setShowReorderModal] = useState(false)
  const [reorderCourseId, setReorderCourseId] = useState<string>('')
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null)
  const [reorderedModules, setReorderedModules] = useState<any[]>([])
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  
  // Estados para cursos y módulos faltantes
  const [missingCourses, setMissingCourses] = useState<Array<{name: string, description: string}>>([])
  const [missingModules, setMissingModules] = useState<Array<{name: string, courseName: string, order: number}>>([])
  const [showMissingCoursesModal, setShowMissingCoursesModal] = useState(false)
  const [showMissingModulesModal, setShowMissingModulesModal] = useState(false)
  const [tempExcelData, setTempExcelData] = useState<any>(null)
  const [isCreatingCourses, setIsCreatingCourses] = useState(false)
  const [isCreatingModules, setIsCreatingModules] = useState(false)
  const [isCreatingTests, setIsCreatingTests] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Leer tab desde URL al cargar
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['students', 'courses', 'modules', 'tests'].includes(tab)) {
      setActiveTab(tab as 'students' | 'courses' | 'modules' | 'tests')
    }
  }, [])

  useEffect(() => {
    // Cargar datos desde las APIs
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, coursesRes, modulesRes, testsRes, phrasesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/courses'),
        fetch('/api/modules'),
        fetch('/api/tests'),
        fetch('/api/motivational-phrases')
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
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
      if (phrasesRes.ok) {
        const phrasesData = await phrasesRes.json()
        setPhrases(phrasesData)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      // Animar tabla
      anime({
        targets: '.user-row',
        translateX: [-50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 500,
        easing: 'easeOutQuart'
      })
    }
  }, [loading])

  // Filtrado de estudiantes
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(studentFilters.search.toLowerCase())
    const matchesStatus = studentFilters.status === 'all' || user.status === studentFilters.status
    const matchesRole = studentFilters.role === 'all' || user.role === studentFilters.role
    return matchesSearch && matchesStatus && matchesRole
  })

  // Filtrado de cursos
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(courseFilters.search.toLowerCase()) ||
                         course.description.toLowerCase().includes(courseFilters.search.toLowerCase())
    return matchesSearch
  })

  // Filtrado de módulos
  const filteredModules = modules.filter(module => {
    const matchesSearch = module.title.toLowerCase().includes(moduleFilters.search.toLowerCase()) ||
                         module.description.toLowerCase().includes(moduleFilters.search.toLowerCase())
    const matchesCourse = moduleFilters.courseId === 'all' || String(module.courseId) === moduleFilters.courseId
    return matchesSearch && matchesCourse
  })

  // Filtrado de tests
  const filteredTests = tests.filter(test => {
    const matchesSearch = test.title.toLowerCase().includes(testFilters.search.toLowerCase())
    const matchesCourse = testFilters.courseId === 'all' || String(test.courseId) === testFilters.courseId
    const matchesModule = testFilters.moduleId === 'all' || String(test.moduleId) === testFilters.moduleId
    return matchesSearch && matchesCourse && matchesModule
  })

  // Función de ordenamiento
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortData = (data: any[], key: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aValue = a[key]
      let bValue = b[key]

      // Manejar arrays (modules, tests, questions) - ordenar por longitud
      if (Array.isArray(aValue) && Array.isArray(bValue)) {
        return direction === 'asc' 
          ? aValue.length - bValue.length 
          : bValue.length - aValue.length
      }

      // Manejar valores de fecha
      if (aValue instanceof Date) aValue = aValue.getTime()
      if (bValue instanceof Date) bValue = bValue.getTime()

      // Manejar valores numéricos
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Manejar strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return 0
    })
  }

  // Aplicar ordenamiento
  const sortedUsers = sortConfig 
    ? sortData(filteredUsers, sortConfig.key, sortConfig.direction)
    : filteredUsers

  const sortedCourses = sortConfig
    ? sortData(filteredCourses, sortConfig.key, sortConfig.direction)
    : filteredCourses

  const sortedModules = sortConfig
    ? sortData(filteredModules, sortConfig.key, sortConfig.direction)
    : filteredModules

  const sortedTests = sortConfig
    ? sortData(filteredTests, sortConfig.key, sortConfig.direction)
    : filteredTests

  // Cálculos de paginación
  const totalItems = sortedUsers.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = sortedUsers.slice(startIndex, endIndex)
  const showingFrom = totalItems > 0 ? startIndex + 1 : 0
  const showingTo = Math.min(endIndex, totalItems)

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id))
    }
  }

  const handleCreateUser = async () => {
    // Validar
    if (!newUser.name) {
      alert('Por favor ingresa el nombre completo del estudiante')
      return
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        const createdUser = await response.json()
        await loadData()
        setShowCreateModal(false)
        
        // Mostrar credenciales generadas
        alert(`Usuario creado exitosamente:\n\nUsuario: ${createdUser.username}\nContraseña: ${createdUser.password}\n\n¡Anota estas credenciales!`)
        
        setNewUser({
          name: '',
          username: '',
          password: '',
          role: 'student',
          status: 'active'
        })
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear usuario')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear usuario')
    }
  }

  const handleCreateCourse = async () => {
    if (!newCourse.title) {
      alert('Por favor completa el título del curso')
      return
    }

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse)
      })

      if (response.ok) {
        await loadData()
        setShowCreateModal(false)
        setNewCourse({ title: '', description: '', image: '' })
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear curso')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear curso')
    }
  }

  const handleCreateModule = async () => {
    if (!newModule.title || !newModule.description || !newModule.courseId) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    // Calcular el orden automáticamente basado en los módulos existentes del curso
    const courseModules = modules.filter(m => m.courseId === newModule.courseId)
    
    // Si no hay módulos, comenzar en 1
    // Si hay módulos, tomar el máximo orden y sumarle 1
    // Esto funciona incluso si hay duplicados (ej: varios con orden 1)
    const maxOrder = courseModules.length > 0 
      ? Math.max(...courseModules.map(m => Number(m.order) || 0))
      : 0
    const nextOrder = maxOrder + 1

    try {
      const response = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newModule, order: nextOrder })
      })

      if (response.ok) {
        await loadData()
        setShowCreateModal(false)
        setNewModule({ title: '', description: '', courseId: '', order: 1, pdfFiles: [] })
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear módulo')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear módulo')
    }
  }

  // Funciones para reordenar módulos con drag & drop
  const handleOpenReorderModal = () => {
    setShowReorderModal(true)
    setReorderCourseId('')
    setReorderedModules([])
  }

  const handleCourseSelectForReorder = (courseId: string) => {
    setReorderCourseId(courseId)
    
    if (courseId) {
      // Obtener módulos del curso seleccionado y ordenarlos
      const courseModules = modules
        .filter(m => String(m.courseId) === String(courseId))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      
      setReorderedModules(courseModules)
    } else {
      setReorderedModules([])
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedModuleIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    
    if (draggedModuleIndex === null || draggedModuleIndex === index) return
    
    const newModules = [...reorderedModules]
    const draggedModule = newModules[draggedModuleIndex]
    
    // Remover el módulo de su posición original
    newModules.splice(draggedModuleIndex, 1)
    // Insertarlo en la nueva posición
    newModules.splice(index, 0, draggedModule)
    
    setReorderedModules(newModules)
    setDraggedModuleIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedModuleIndex(null)
  }

  const handleSaveReorder = async () => {
    if (reorderedModules.length === 0) return
    
    setIsSavingOrder(true)
    try {
      // Actualizar el orden de cada módulo (1, 2, 3...)
      const updates = reorderedModules.map((module, index) => ({
        id: module.id,
        order: index + 1
      }))

      const response = await fetch('/api/modules/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: updates })
      })

      if (response.ok) {
        await loadData()
        setShowReorderModal(false)
        setReorderCourseId('')
        setReorderedModules([])
        showToast('Orden de módulos actualizado correctamente')
      } else {
        const error = await response.json()
        alert(error.error || 'Error al guardar el orden')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar el orden')
    } finally {
      setIsSavingOrder(false)
    }
  }

  const handleCloseReorderModal = () => {
    setShowReorderModal(false)
    setReorderCourseId('')
    setReorderedModules([])
    setDraggedModuleIndex(null)
  }

  const handleCreateTest = async () => {
    if (!newTest.title || !newTest.moduleId) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTest)
      })

      if (response.ok) {
        await loadData()
        setShowCreateModal(false)
        setNewTest({ title: '', courseId: '', moduleId: '', questions: [] })
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear test')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear test')
    }
  }

  const handleCreatePhrase = async () => {
    if (!editingItem?.phrase) {
      alert('Por favor completa la frase motivacional')
      return
    }

    try {
      const response = await fetch('/api/motivational-phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: editingItem.phrase,
          rangeType: editingItem.rangeType || '0-30'
        })
      })

      if (response.ok) {
        await loadData()
        setShowCreateModal(false)
        setEditingItem(null)
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear frase')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear frase')
    }
  }

  const toggleUserStatus = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    
    setPendingChanges(prev => {
      const newMap = new Map(prev)
      newMap.set(userId, {
        ...user,
        status: newStatus
      })
      return newMap
    })
  }

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return

    try {
      // Guardar todos los cambios pendientes
      const promises = Array.from(pendingChanges.values()).map(user =>
        fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            name: user.name,
            username: user.username,
            password: user.password,
            role: user.role,
            status: user.status
          })
        })
      )

      await Promise.all(promises)
      await loadData()
      setPendingChanges(new Map())
      
      // Agregar IDs modificados
      const modifiedIds = Array.from(pendingChanges.keys())
      setModifiedUserIds(prev => {
        const combined = [...prev, ...modifiedIds]
        return Array.from(new Set(combined))
      })
      
      // Simulación de guardado
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const count = modifiedUserIds.length
      setModifiedUserIds([])
      showToast(`${count} cambio(s) guardado(s) exitosamente`, 'success')
    } catch (error) {
      showToast('Error al guardar los cambios', 'error')
      console.error(error)
    }
  }

  const handleTabChange = (newTab: 'students' | 'courses' | 'modules' | 'tests' | 'phrases') => {
    if (modifiedUserIds.length > 0) {
      setPendingTab(newTab)
      setShowConfirmModal(true)
    } else {
      setActiveTab(newTab)
      // Actualizar URL sin recargar la página
      router.push(`/admin/users?tab=${newTab}`, { scroll: false })
    }
  }

  const handleConfirmDiscard = () => {
    if (pendingTab) {
      setModifiedUserIds([])
      setActiveTab(pendingTab)
      // Actualizar URL
      router.push(`/admin/users?tab=${pendingTab}`, { scroll: false })
      setShowConfirmModal(false)
      setPendingTab(null)
    }
  }

  const handleConfirmSave = async () => {
    await handleSaveChanges()
    if (pendingTab) {
      setActiveTab(pendingTab)
      // Actualizar URL
      router.push(`/admin/users?tab=${pendingTab}`, { scroll: false })
      setShowConfirmModal(false)
      setPendingTab(null)
    }
  }

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          alert('El archivo está vacío')
          return
        }

        // Validar que tenga el campo name
        const firstRow: any = jsonData[0]
        if (!firstRow.name && !firstRow.Name) {
          alert('El archivo debe tener una columna "name" con los nombres completos')
          return
        }

        let created = 0
        let errors = 0

        for (const row of jsonData) {
          const rowData = row as any
          const name = rowData.name || rowData.Name
          const role = rowData.role || rowData.Role || 'student'
          const status = rowData.status || rowData.Status || 'active'

          if (!name) continue

          try {
            const response = await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, role, status })
            })

            if (response.ok) {
              created++
            } else {
              errors++
            }
          } catch (error) {
            errors++
          }
        }

        await loadData()
        alert(`Carga completada:\n✅ ${created} usuarios creados\n❌ ${errors} errores`)
        
        // Reset input
        event.target.value = ''
      }

      reader.readAsBinaryString(file)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar el archivo Excel')
    }
  }

  const processExcelData = (jsonData: any[]) => {
    const testsByModule = new Map()
    const errors: string[] = []

    // Agrupar preguntas por test
    for (const row of jsonData) {
      const rowData = row as any
      const courseName = String(rowData['Curso'] || rowData['curso'] || '')
      const moduleName = String(rowData['Módulo'] || rowData['modulo'] || rowData['Modulo'] || '')
      const testTitle = String(rowData['Test'] || rowData['test'] || '')
      const questionNumber = rowData['N° Pregunta'] || rowData['N Pregunta'] || rowData['Numero Pregunta'] || rowData['pregunta'] || ''
      const questionText = String(rowData['Pregunta'] || rowData['Texto Pregunta'] || '')
      const option = String(rowData['Opción'] || rowData['opcion'] || rowData['Opcion'] || '')
      const correctaValue = String(rowData['Correcta'] || rowData['correcta'] || '').toLowerCase()
      const isCorrect = correctaValue === 'sí' || correctaValue === 'si' || correctaValue === 'x' || correctaValue === '1' || correctaValue === 'true'
      const explanation = String(rowData['Explicación'] || rowData['Explicacion'] || rowData['explicacion'] || '')

      // Validar que no estén vacíos
      if (!courseName.trim() || !moduleName.trim() || !testTitle.trim() || !questionText.trim() || !option.trim()) continue

      // Buscar el curso
      const course = courses.find(c => c.title.toLowerCase().trim() === courseName.toLowerCase().trim())
      if (!course) {
        if (!errors.includes(`Curso no encontrado: ${courseName}`)) {
          errors.push(`Curso no encontrado: ${courseName}`)
        }
        continue
      }

      const module = modules.find(m => 
        m.title.toLowerCase().trim() === moduleName.toLowerCase().trim() && 
        m.courseId === course.id
      )
      if (!module) {
        if (!errors.includes(`Módulo no encontrado: ${moduleName} en ${courseName}`)) {
          errors.push(`Módulo no encontrado: ${moduleName} en ${courseName}`)
        }
        continue
      }

      const key = `${module.id}_${testTitle.trim()}`
      if (!testsByModule.has(key)) {
        testsByModule.set(key, {
          moduleId: module.id,
          moduleName: module.title,
          courseName: course.title,
          title: testTitle.trim(),
          questions: new Map()
        })
      }

      const testData = testsByModule.get(key)
      // Usar el número de pregunta como clave, o el texto de la pregunta si no hay número
      const questionKey = questionNumber ? String(questionNumber) : questionText
      
      if (!testData.questions.has(questionKey)) {
        testData.questions.set(questionKey, {
          question: questionText,
          options: [],
          correctAnswer: -1,
          explanation: explanation.trim()
        })
      }

      const questionData = testData.questions.get(questionKey)
      const optionIndex = questionData.options.length
      questionData.options.push(option)
      if (isCorrect) {
        questionData.correctAnswer = optionIndex
      }
    }

    // Convertir a array para mostrar
    const testsArray = Array.from(testsByModule.values()).map(testData => ({
      moduleId: testData.moduleId,
      moduleName: testData.moduleName,
      courseName: testData.courseName,
      title: testData.title,
      questions: Array.from(testData.questions.values()).map((q: any) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || ''
      }))
    }))

    if (testsArray.length === 0 && errors.length > 0) {
      alert('No se pudieron procesar tests del archivo.\n\nErrores:\n' + errors.join('\n'))
      return
    }

    setPendingTests(testsArray)
    setShowTestPreviewModal(true)
    setTempExcelData(null)
  }

  const handleTestExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // Buscar la hoja "Input" o usar la primera hoja
        const sheetName = workbook.SheetNames.includes('Input') ? 'Input' : workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          alert('El archivo está vacío')
          return
        }

        // Validar columnas requeridas
        const firstRow: any = jsonData[0]
        const requiredColumns = ['Curso', 'Módulo', 'Test', 'Pregunta', 'Opción', 'Correcta']
        const optionalColumns = ['N° Pregunta', 'Explicación']
        
        // Verificar que existan las columnas básicas (permitir variaciones)
        const hasCurso = firstRow['Curso'] !== undefined || firstRow['curso'] !== undefined
        const hasModulo = firstRow['Módulo'] !== undefined || firstRow['modulo'] !== undefined || firstRow['Modulo'] !== undefined
        const hasTest = firstRow['Test'] !== undefined || firstRow['test'] !== undefined
        const hasPregunta = firstRow['Pregunta'] !== undefined || firstRow['pregunta'] !== undefined || firstRow['Texto Pregunta'] !== undefined
        const hasOpcion = firstRow['Opción'] !== undefined || firstRow['opcion'] !== undefined || firstRow['Opcion'] !== undefined
        const hasCorrecta = firstRow['Correcta'] !== undefined || firstRow['correcta'] !== undefined
        
        const missingColumns: string[] = []
        if (!hasCurso) missingColumns.push('Curso')
        if (!hasModulo) missingColumns.push('Módulo')
        if (!hasTest) missingColumns.push('Test')
        if (!hasPregunta) missingColumns.push('Pregunta')
        if (!hasOpcion) missingColumns.push('Opción')
        if (!hasCorrecta) missingColumns.push('Correcta')
        
        if (missingColumns.length > 0) {
          const availableColumns = Object.keys(firstRow).join(', ')
          alert(
            `❌ Error: Columnas requeridas faltantes\n\n` +
            `Falta(n): ${missingColumns.join(', ')}\n\n` +
            `Columnas requeridas:\n` +
            `• Curso\n` +
            `• Módulo\n` +
            `• Test\n` +
            `• Pregunta\n` +
            `• Opción\n` +
            `• Correcta\n\n` +
            `Columnas opcionales:\n` +
            `• N° Pregunta (o variantes: N Pregunta, Numero Pregunta)\n` +
            `• Explicación\n\n` +
            `Columnas encontradas en tu archivo:\n${availableColumns || 'Ninguna'}\n\n` +
            `Revisa que las columnas estén escritas correctamente.`
          )
          event.target.value = ''
          return
        }

        // Detectar cursos y módulos faltantes
        const courseNamesInExcel = new Set<string>()
        const modulesByCourse = new Map<string, Set<string>>()

        for (const row of jsonData) {
          const rowData = row as any
          const courseName = String(rowData['Curso'] || rowData['curso'] || '').trim()
          const moduleName = String(rowData['Módulo'] || rowData['modulo'] || rowData['Modulo'] || '').trim()
          
          if (courseName && moduleName) {
            courseNamesInExcel.add(courseName)
            
            if (!modulesByCourse.has(courseName)) {
              modulesByCourse.set(courseName, new Set())
            }
            modulesByCourse.get(courseName)!.add(moduleName)
          }
        }

        // Verificar cursos faltantes
        const missingCoursesList: Array<{name: string, description: string}> = []
        for (const courseName of courseNamesInExcel) {
          const exists = courses.some(c => c.title.toLowerCase().trim() === courseName.toLowerCase())
          if (!exists) {
            missingCoursesList.push({
              name: courseName,
              description: ''
            })
          }
        }

        // Verificar módulos faltantes
        const missingModulesList: Array<{name: string, courseName: string, order: number}> = []
        for (const [courseName, moduleNames] of modulesByCourse.entries()) {
          const course = courses.find(c => c.title.toLowerCase().trim() === courseName.toLowerCase())
          
          // Calcular el orden base para este curso
          let orderCounter = 1
          if (course) {
            // Si el curso existe, obtener el último orden de sus módulos
            const courseModules = modules.filter(m => m.courseId === course.id)
            if (courseModules.length > 0) {
              const maxOrder = Math.max(...courseModules.map(m => m.order || 0))
              orderCounter = maxOrder + 1
            }
          }
          
          for (const moduleName of moduleNames) {
            // Si el curso existe, verificar si el módulo existe
            if (course) {
              const moduleExists = modules.some(m => 
                m.title.toLowerCase().trim() === moduleName.toLowerCase() && 
                m.courseId === course.id
              )
              if (!moduleExists) {
                missingModulesList.push({
                  name: moduleName,
                  courseName: courseName,
                  order: orderCounter++
                })
              }
            } else {
              // Si el curso no existe (pero se va a crear), agregar el módulo a la lista
              missingModulesList.push({
                name: moduleName,
                courseName: courseName,
                order: orderCounter++
              })
            }
          }
        }

        // Si hay cursos faltantes, mostrar modal
        if (missingCoursesList.length > 0) {
          setMissingCourses(missingCoursesList)
          setTempExcelData({ jsonData, missingModules: missingModulesList })
          setShowMissingCoursesModal(true)
          event.target.value = ''
          return
        }

        // Si no hay cursos faltantes pero hay módulos faltantes, mostrar modal
        if (missingModulesList.length > 0) {
          setMissingModules(missingModulesList)
          setTempExcelData({ jsonData, missingModules: [] })
          setShowMissingModulesModal(true)
          event.target.value = ''
          return
        }

        // Si no hay nada faltante, procesar directamente
        processExcelData(jsonData)
        event.target.value = ''
      }

      reader.readAsBinaryString(file)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar el archivo Excel')
    }
  }

  const handleConfirmTests = async () => {
    if (isCreatingTests) return
    setIsCreatingTests(true)
    
    try {
      let created = 0
      let errors = 0

      for (const test of pendingTests) {
        try {
          // Validar que el test tenga datos válidos
          if (!test.moduleId || !test.title || !test.questions || test.questions.length === 0) {
            console.error('Test inválido:', test)
            errors++
            continue
          }

          // Obtener courseId del módulo
          const module = modules.find(m => m.id === test.moduleId)
          if (!module) {
            console.error('Módulo no encontrado:', test.moduleId)
            errors++
            continue
          }

          // Validar que todas las preguntas tengan opciones válidas
          const validQuestions = test.questions.filter((q: any) => 
            q.question && 
            q.options && 
            q.options.length > 0 && 
            q.correctAnswer !== undefined &&
            q.correctAnswer >= 0 &&
            q.correctAnswer < q.options.length
          )

          if (validQuestions.length === 0) {
            console.error('No hay preguntas válidas en el test:', test.title)
            errors++
            continue
          }

          const response = await fetch('/api/tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: module.courseId,
              moduleId: test.moduleId,
              title: test.title,
              questions: validQuestions
            })
          })

          if (response.ok) {
            created++
          } else {
            const errorData = await response.json()
            console.error(`Error creando test ${test.title}:`, errorData)
            errors++
          }
        } catch (error) {
          console.error('Error:', error)
          errors++
        }
      }

      await loadData()
      setShowTestPreviewModal(false)
      setPendingTests([])
      
      if (created > 0) {
        alert(`✅ ${created} test${created !== 1 ? 's' : ''} creado${created !== 1 ? 's' : ''}${errors > 0 ? `\n❌ ${errors} error${errors !== 1 ? 'es' : ''}` : ''}`)
      } else {
        alert(`❌ No se pudo crear ningún test. Revisa la consola para más detalles.`)
      }
    } finally {
      setIsCreatingTests(false)
    }
  }

  const handleCancelTests = () => {
    setPendingTests([])
    setShowTestPreviewModal(false)
  }

  const handleDiscardChanges = () => {
    setPendingChanges(new Map())
  }

  // Funciones de Edición y Eliminación
  const handleEditUser = (userId: string) => {
    const userToEdit = users.find(u => u.id === userId)
    if (userToEdit) {
      setEditingItem({ ...userToEdit, type: 'user' })
      setShowEditModal(true)
    }
  }

  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (user) {
      setDeleteItem({ id: userId, type: 'user', name: user.username })
      setShowDeleteModal(true)
    }
  }

  const handleEditCourse = (courseId: string) => {
    const courseToEdit = courses.find(c => c.id === courseId)
    if (courseToEdit) {
      setEditingItem({ ...courseToEdit, type: 'course' })
      setShowEditModal(true)
    }
  }

  const handleDeleteCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId)
    if (course) {
      setDeleteItem({ id: courseId, type: 'course', name: course.title })
      setShowDeleteModal(true)
    }
  }

  const handleEditModule = (moduleId: string) => {
    const moduleToEdit = modules.find(m => m.id === moduleId)
    if (moduleToEdit) {
      setEditingItem({ ...moduleToEdit, type: 'module' })
      setShowEditModal(true)
    }
  }

  const handleDeleteModule = (moduleId: string) => {
    const module = modules.find(m => m.id === moduleId)
    if (module) {
      setDeleteItem({ id: moduleId, type: 'module', name: module.title })
      setShowDeleteModal(true)
    }
  }

  const handleEditTest = (testId: string) => {
    const testToEdit = tests.find(t => t.id === testId)
    if (testToEdit) {
      // Encontrar el módulo y curso asociados
      const moduleOfTest = modules.find(m => m.id === testToEdit.moduleId)
      const courseId = moduleOfTest?.courseId || ''
      
      // Asegurarse de que questions sea un array
      let questionsArray = testToEdit.questions
      if (typeof questionsArray === 'string') {
        try {
          questionsArray = JSON.parse(questionsArray)
        } catch (e) {
          console.error('Error parsing questions:', e)
          questionsArray = []
        }
      }
      if (!Array.isArray(questionsArray)) {
        questionsArray = []
      }
      
      // Normalizar las opciones: convertir de {text, isCorrect} a string array
      const normalizedQuestions = questionsArray.map((q: any) => {
        // Si options es un array de objetos con text e isCorrect
        if (Array.isArray(q.options) && q.options.length > 0 && typeof q.options[0] === 'object' && q.options[0].text) {
          const optionsArray = q.options.map((opt: any) => opt.text || opt)
          const correctIndex = q.options.findIndex((opt: any) => opt.isCorrect)
          return {
            ...q,
            question: q.question || q.text, // Normalizar el campo question/text
            options: optionsArray,
            correctAnswer: correctIndex >= 0 ? correctIndex : 0
          }
        }
        // Si ya es un array de strings
        return {
          ...q,
          question: q.question || q.text // Asegurar que question esté presente
        }
      })
      
      setEditingItem({ 
        ...testToEdit, 
        type: 'test',
        courseId: courseId,
        questions: normalizedQuestions
      })
      setShowEditModal(true)
    }
  }

  const handleDeleteTest = (testId: string) => {
    const test = tests.find(t => t.id === testId)
    if (test) {
      setDeleteItem({ id: testId, type: 'test', name: test.title })
      setShowDeleteModal(true)
    }
  }

  const confirmDelete = async () => {
    if (!deleteItem) return

    try {
      let endpoint = ''
      switch (deleteItem.type) {
        case 'user':
          endpoint = `/api/users?id=${deleteItem.id}`
          break
        case 'course':
          endpoint = `/api/courses?id=${deleteItem.id}`
          break
        case 'module':
          endpoint = `/api/modules?id=${deleteItem.id}`
          break
        case 'test':
          endpoint = `/api/tests?id=${deleteItem.id}`
          break
        case 'phrase':
          endpoint = `/api/motivational-phrases?id=${deleteItem.id}`
          break
      }

      const response = await fetch(endpoint, { method: 'DELETE' })

      if (response.ok) {
        await loadData()
        if (deleteItem.type === 'user') {
          setModifiedUserIds(prev => prev.filter(id => id !== deleteItem.id))
        }
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar')
    }

    setShowDeleteModal(false)
    setDeleteItem(null)
  }

  const handleBulkDelete = () => {
    if (selectedUsers.length === 0) return
    const count = selectedUsers.length
    setDeleteItem({ 
      id: 'bulk', 
      type: 'user', 
      name: `${count} estudiante${count > 1 ? 's' : ''}` 
    })
    setShowDeleteModal(true)
  }

  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
    if (selectedUsers.length === 0) return

    try {
      // Actualizar todos los usuarios seleccionados
      await Promise.all(
        selectedUsers.map(userId =>
          fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, status })
          })
        )
      )

      await loadData()
      
      // Marcar como modificados
      setModifiedUserIds(prev => {
        const newModified = [...prev]
        selectedUsers.forEach(id => {
          if (!newModified.includes(id)) {
            newModified.push(id)
          }
        })
        return newModified
      })
      
      setSelectedUsers([])
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar usuarios')
    }
  }

  const confirmBulkDelete = async () => {
    if (deleteItem?.id === 'bulk') {
      try {
        // Eliminar todos los usuarios seleccionados
        await Promise.all(
          selectedUsers.map(userId =>
            fetch(`/api/users?id=${userId}`, { method: 'DELETE' })
          )
        )

        await loadData()
        setModifiedUserIds(prev => prev.filter(id => !selectedUsers.includes(id)))
        setSelectedUsers([])
        setShowDeleteModal(false)
        setDeleteItem(null)
      } catch (error) {
        console.error('Error:', error)
        alert('Error al eliminar usuarios')
      }
    } else if (deleteItem?.id === 'bulk-tests') {
      try {
        // Eliminar todos los tests seleccionados
        await Promise.all(
          selectedTests.map(testId =>
            fetch(`/api/tests?id=${testId}`, { method: 'DELETE' })
          )
        )

        await loadData()
        setSelectedTests([])
        setShowDeleteModal(false)
        setDeleteItem(null)
      } catch (error) {
        console.error('Error:', error)
        alert('Error al eliminar tests')
      }
    } else {
      confirmDelete()
    }
  }

  const handleBulkDeleteTests = () => {
    if (selectedTests.length === 0) return
    const count = selectedTests.length
    setDeleteItem({ 
      id: 'bulk-tests', 
      type: 'test', 
      name: `${count} test${count > 1 ? 's' : ''}` 
    })
    setShowDeleteModal(true)
  }

  const toggleTestSelection = (testId: string) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    )
  }

  const toggleAllTests = () => {
    if (selectedTests.length === sortedTests.length) {
      setSelectedTests([])
    } else {
      setSelectedTests(sortedTests.map(t => t.id))
    }
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    console.log('🔍 handleSaveEdit llamado para:', editingItem.type, editingItem)

    // Validaciones específicas por tipo
    if (editingItem.type === 'test') {
      // Validar que cada pregunta tenga al menos 2 opciones
      for (let i = 0; i < editingItem.questions.length; i++) {
        const question = editingItem.questions[i]
        if (!question.options || question.options.length < 2) {
          alert(`La pregunta ${i + 1} debe tener al menos 2 opciones`)
          return
        }
        // Validar que cada opción tenga contenido
        const emptyOptions = question.options.filter((opt: string) => !opt || opt.trim() === '')
        if (emptyOptions.length > 0) {
          alert(`La pregunta ${i + 1} tiene opciones vacías. Por favor complételas o elimínelas.`)
          return
        }
      }
    }

    try {
      let endpoint = ''
      let body: any = {}

      switch (editingItem.type) {
        case 'user':
          endpoint = '/api/users'
          body = {
            id: editingItem.id,
            name: editingItem.name,
            username: editingItem.username,
            password: editingItem.password,
            role: editingItem.role,
            status: editingItem.status
          }
          break
        case 'course':
          endpoint = '/api/courses'
          body = {
            id: editingItem.id,
            title: editingItem.title,
            description: editingItem.description,
            image: editingItem.image
          }
          break
        case 'module':
          endpoint = '/api/modules'
          body = {
            id: editingItem.id,
            courseId: editingItem.courseId,
            title: editingItem.title,
            description: editingItem.description,
            order: editingItem.order,
            pdfFiles: editingItem.pdfFiles
          }
          break
        case 'test':
          endpoint = '/api/tests'
          body = {
            id: editingItem.id,
            courseId: editingItem.courseId,
            moduleId: editingItem.moduleId,
            title: editingItem.title,
            questions: editingItem.questions
          }
          break
        case 'phrase':
          endpoint = '/api/motivational-phrases'
          body = {
            id: editingItem.id,
            phrase: editingItem.phrase,
            rangeType: editingItem.rangeType,
            isActive: editingItem.isActive
          }
          break
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        await loadData()
        if (editingItem.type === 'user' && !modifiedUserIds.includes(editingItem.id)) {
          setModifiedUserIds([...modifiedUserIds, editingItem.id])
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Error al actualizar')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar')
    }

    setShowEditModal(false)
    setEditingItem(null)
  }

  // Funciones para generar plantillas Excel
  const downloadStudentTemplate = () => {
    const data = [
      { name: '', role: 'student', status: 'active' },
      { name: 'Juan Pérez García', role: 'student', status: 'active' },
      { name: 'María García López', role: 'student', status: 'active' },
      { name: 'Carlos López Martínez', role: 'student', status: 'inactive' },
      { name: 'Ana Martínez Rodríguez', role: 'student', status: 'active' },
      { name: 'Administrador del Sistema', role: 'admin', status: 'active' }
    ]
    
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
    XLSX.writeFile(workbook, 'students_template.xlsx')
  }

  const downloadCourseTemplate = () => {
    const data = [
      { title: '', description: '', image: '' },
      { title: 'Introducción a la Programación', description: 'Aprende los fundamentos de la programación con Python desde cero', image: 'https://example.com/python-intro.jpg' },
      { title: 'Desarrollo Web Moderno', description: 'HTML, CSS y JavaScript para crear sitios web responsivos y modernos', image: 'https://example.com/web-dev.jpg' },
      { title: 'Bases de Datos SQL', description: 'Diseño y gestión de bases de datos relacionales con MySQL', image: 'https://example.com/sql.jpg' },
      { title: 'React Avanzado', description: 'Hooks, Context API, Redux y patrones avanzados de desarrollo', image: 'https://example.com/react-adv.jpg' }
    ]
    
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Courses')
    XLSX.writeFile(workbook, 'courses_template.xlsx')
  }

  const downloadModuleTemplate = () => {
    const data = [
      { courseId: '', title: '', description: '', order: 1, pdfUrl: '' },
      { courseId: '1', title: 'Fundamentos de Python', description: 'Sintaxis básica, variables y tipos de datos en Python', order: 1, pdfUrl: 'https://example.com/python-fundamentos.pdf' },
      { courseId: '1', title: 'Estructuras de Control', description: 'Condicionales, bucles y manejo de flujo de programa', order: 2, pdfUrl: 'https://example.com/python-control.pdf' },
      { courseId: '1', title: 'Funciones y Módulos', description: 'Creación de funciones reutilizables y organización de código', order: 3, pdfUrl: 'https://example.com/python-funciones.pdf' },
      { courseId: '2', title: 'HTML Básico', description: 'Estructura y etiquetas HTML5 fundamentales', order: 1, pdfUrl: 'https://example.com/html-basico.pdf' },
      { courseId: '2', title: 'CSS Estilos', description: 'Selectores, propiedades y diseño con CSS3', order: 2, pdfUrl: 'https://example.com/css-estilos.pdf' },
      { courseId: '2', title: 'JavaScript Interactivo', description: 'DOM, eventos y programación del lado del cliente', order: 3, pdfUrl: 'https://example.com/js-interactivo.pdf' }
    ]
    
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modules')
    XLSX.writeFile(workbook, 'modules_template.xlsx')
  }

  const downloadTestTemplate = () => {
    // Usar módulos reales del sistema para los ejemplos
    const exampleModule = modules[0]
    const exampleCourse = exampleModule ? courses.find(c => c.id === exampleModule.courseId) : null
    
    const courseName = exampleCourse?.title || 'Python Básico'
    const moduleName = exampleModule?.title || 'Introducción'

    // Hoja "Ejemplo" - Datos completos organizados por curso > módulo > test
    const exampleData = [
      { 'Curso': courseName, 'Módulo': moduleName, 'Test': 'Evaluación Inicial', 'N° Pregunta': 1, 'Pregunta': '¿Cuál es el tipo de dato para decimales?', 'Opción': 'int', 'Correcta': 'No', 'Explicación': 'int es para números enteros, no decimales' },
      { 'Curso': courseName, 'Módulo': moduleName, 'Test': 'Evaluación Inicial', 'N° Pregunta': 1, 'Pregunta': '¿Cuál es el tipo de dato para decimales?', 'Opción': 'float', 'Correcta': 'Sí', 'Explicación': '' },
      { 'Curso': courseName, 'Módulo': moduleName, 'Test': 'Evaluación Inicial', 'N° Pregunta': 1, 'Pregunta': '¿Cuál es el tipo de dato para decimales?', 'Opción': 'str', 'Correcta': 'No', 'Explicación': 'str es para cadenas de texto, no números' },
      { 'Curso': courseName, 'Módulo': moduleName, 'Test': 'Evaluación Inicial', 'N° Pregunta': 2, 'Pregunta': '¿Qué palabra clave define una función?', 'Opción': 'function', 'Correcta': 'No', 'Explicación': 'function se usa en JavaScript, no en Python' },
      { 'Curso': courseName, 'Módulo': moduleName, 'Test': 'Evaluación Inicial', 'N° Pregunta': 2, 'Pregunta': '¿Qué palabra clave define una función?', 'Opción': 'def', 'Correcta': 'Sí', 'Explicación': '' },
      { 'Curso': courseName, 'Módulo': moduleName, 'Test': 'Evaluación Inicial', 'N° Pregunta': 2, 'Pregunta': '¿Qué palabra clave define una función?', 'Opción': 'func', 'Correcta': 'No', 'Explicación': 'func no existe en Python' }
    ]

    // Hoja "Input" - Plantilla vacía
    const inputData = [
      { 'Curso': '', 'Módulo': '', 'Test': '', 'N° Pregunta': '', 'Pregunta': '', 'Opción': '', 'Correcta': '', 'Explicación': '' }
    ]
    
    const workbook = XLSX.utils.book_new()
    
    const wsExample = XLSX.utils.json_to_sheet(exampleData)
    XLSX.utils.book_append_sheet(workbook, wsExample, 'Ejemplo')
    
    const wsInput = XLSX.utils.json_to_sheet(inputData)
    XLSX.utils.book_append_sheet(workbook, wsInput, 'Input')
    
    XLSX.writeFile(workbook, 'tests_template.xlsx')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50">
        <AdminHeader />
        <div className="flex-grow p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Pestañas */}
          <div className="border-b border-gray-200 mb-4">
            <div className="flex gap-8 px-0">
              <button
                onClick={() => handleTabChange('students')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                  activeTab === 'students'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-800'
                }`}
              >
                <p className="text-sm font-bold">Estudiantes</p>
              </button>
              <button
                onClick={() => handleTabChange('courses')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                  activeTab === 'courses'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-800'
                }`}
              >
                <p className="text-sm font-bold">Cursos</p>
              </button>
              <button
                onClick={() => handleTabChange('modules')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                  activeTab === 'modules'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-800'
                }`}
              >
                <p className="text-sm font-bold">Módulos</p>
              </button>
              <button
                onClick={() => handleTabChange('tests')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                  activeTab === 'tests'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-800'
                }`}
              >
                <p className="text-sm font-bold">Tests</p>
              </button>
              <button
                onClick={() => handleTabChange('phrases')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 transition-colors ${
                  activeTab === 'phrases'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-800'
                }`}
              >
                <p className="text-sm font-bold">Frases de Motivación</p>
              </button>
            </div>
          </div>

          {activeTab === 'students' && (
            <>
              {/* Filtros de Estudiantes */}
              <div className="pb-4 space-y-4">
                <div className="flex gap-4 items-end">
                  <label className="flex h-12 flex-1 flex-col">
                    <div className="flex h-full w-full flex-1 items-stretch rounded-lg">
                      <div className="flex items-center justify-center rounded-l-lg border border-gray-300 bg-gray-100 pl-4 pr-3 text-secondary-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por nombre de usuario..."
                        value={studentFilters.search}
                        onChange={(e) => setStudentFilters({...studentFilters, search: e.target.value})}
                        className="h-full w-full min-w-0 flex-1 rounded-r-lg border border-l-0 border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 placeholder:text-secondary-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                      />
                    </div>
                  </label>
                  <button
                    onClick={() => setShowStudentFilters(!showStudentFilters)}
                    className="flex h-12 items-center gap-2 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-secondary-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
                    </svg>
                    {showStudentFilters ? 'Ocultar filtros' : 'Agregar filtro'}
                  </button>
                </div>
                {showStudentFilters && (
                  <div className="flex gap-4 animate-fadeIn">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-secondary-700 mb-2">Estado</label>
                      <select
                        value={studentFilters.status}
                        onChange={(e) => setStudentFilters({...studentFilters, status: e.target.value as any})}
                        className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                      >
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-secondary-700 mb-2">Rol</label>
                      <select
                        value={studentFilters.role}
                        onChange={(e) => setStudentFilters({...studentFilters, role: e.target.value as any})}
                        className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                      >
                        <option value="all">Todos</option>
                        <option value="student">Estudiante</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de acciones masivas */}
              {selectedUsers.length > 0 && (
                <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary-900">{selectedUsers.length} estudiante{selectedUsers.length > 1 ? 's' : ''} seleccionado{selectedUsers.length > 1 ? 's' : ''}</p>
                      <p className="text-xs text-primary-700">Aplicar acciones a los elementos seleccionados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBulkStatusChange('active')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                      </svg>
                      Activar
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange('inactive')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                      </svg>
                      Cesar
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                      Eliminar
                    </button>
                    <button
                      onClick={() => setSelectedUsers([])}
                      className="ml-2 p-2 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                      title="Deseleccionar todos"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition-colors hover:bg-primary-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <span className="truncate">Agregar Estudiante</span>
                  </button>
                  <label className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-gray-300 bg-white px-4 text-sm font-bold text-secondary-800 transition-colors hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                    </svg>
                    <span className="truncate">Upload List (.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <button onClick={downloadStudentTemplate} className="text-sm font-normal text-primary-600 underline hover:no-underline cursor-pointer">
                  Descargar plantilla Excel de estudiantes
                </button>
              </div>

              {/* Tabla de Usuarios */}
              <div className="rounded-lg border border-gray-200 overflow-visible">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-secondary-900 sm:pl-6" scope="col">
                          <input
                            type="checkbox"
                            checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </th>
                        <th onClick={() => handleSort('username')} className="px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Name
                            {sortConfig?.key === 'username' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('id')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Student ID
                            {sortConfig?.key === 'id' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('username')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 lg:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Username
                            {sortConfig?.key === 'username' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('password')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 md:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Password
                            {sortConfig?.key === 'password' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('status')} className="px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Status
                            {sortConfig?.key === 'status' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6" scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {paginatedUsers.map((user, index) => {
                        const isSelected = selectedUsers.includes(user.id)
                        const isDropdownOpen = openStatusDropdown === user.id
                        const isLastRow = index >= paginatedUsers.length - 2
                        const pendingUser = pendingChanges.get(user.id)
                        const displayUser = pendingUser || user
                        const hasPendingChanges = !!pendingUser
                        return (
                          <tr key={user.id} className={`user-row hover:bg-gray-50 ${isDropdownOpen ? 'relative z-[100]' : ''} ${hasPendingChanges ? 'bg-yellow-50' : ''}`}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectUser(user.id)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-secondary-900">
                              {user.name || user.username}
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                              {user.username}
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 lg:table-cell">
                              #{user.id}
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 md:table-cell">
                              <div className="flex items-center gap-2">
                                <span className="font-mono">
                                  {visiblePasswords.includes(user.id) ? user.password : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(user.id)}
                                  className="p-1 text-secondary-400 hover:text-secondary-600 transition-colors"
                                  title={visiblePasswords.includes(user.id) ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    {visiblePasswords.includes(user.id) ? (
                                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                                    ) : (
                                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                    )}
                                  </svg>
                                </button>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-secondary-500">
                              <div className="relative inline-block">
                                <button 
                                  id={`status-btn-${user.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenStatusDropdown(openStatusDropdown === user.id ? null : user.id)
                                  }}
                                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium ring-1 ring-inset transition-colors ${
                                  displayUser.status === 'active'
                                    ? 'text-green-700 ring-green-600/20 hover:bg-green-50'
                                    : 'text-gray-600 ring-gray-500/20 hover:bg-gray-100'
                                }`}>
                                  <span>{displayUser.status === 'active' ? 'Activo' : 'Cesado'}</span>
                                  <span className={`text-base transition-transform ${openStatusDropdown === user.id ? 'rotate-180' : ''}`}>▼</span>
                                </button>
                                {openStatusDropdown === user.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-[90]" 
                                      onClick={() => setOpenStatusDropdown(null)}
                                    />
                                    <div 
                                      className={`absolute left-0 ${isLastRow ? 'bottom-full mb-1' : 'top-full mt-1'} z-[110] w-full min-w-max rounded-md bg-white py-1 shadow-lg ring-1 ring-gray-200`}
                                    >
                                      <button
                                        onClick={() => {
                                          toggleUserStatus(user.id)
                                          setOpenStatusDropdown(null)
                                        }}
                                        className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm text-secondary-700 hover:bg-gray-100"
                                      >
                                        {displayUser.status === 'active' ? 'Cesado' : 'Activo'}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleEditUser(user.id)} className="p-2 text-secondary-500 hover:text-primary-600 transition-colors" title="Edit">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                  </svg>
                                </button>
                                <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-secondary-500 hover:text-red-500 transition-colors" title="Delete">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paginación */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg">
                <div className="text-sm text-secondary-700">
                  Mostrando <span className="font-medium">{showingFrom}</span> a <span className="font-medium">{showingTo}</span> de{' '}
                  <span className="font-medium">{totalItems}</span> resultados
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Mostrar solo algunas páginas alrededor de la actual
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              currentPage === page
                                ? 'bg-primary-600 text-white'
                                : 'text-secondary-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-2 text-secondary-500">...</span>
                      }
                      return null
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'courses' && (
            <>
              {/* Filtros de Cursos */}
              <div className="pb-4">
                <label className="flex h-12 w-full flex-col">
                  <div className="flex h-full w-full flex-1 items-stretch rounded-lg">
                    <div className="flex items-center justify-center rounded-l-lg border border-gray-300 bg-gray-100 pl-4 pr-3 text-secondary-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar por título o descripción..."
                      value={courseFilters.search}
                      onChange={(e) => setCourseFilters({...courseFilters, search: e.target.value})}
                      className="h-full w-full min-w-0 flex-1 rounded-r-lg border border-l-0 border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 placeholder:text-secondary-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                    />
                  </div>
                </label>
              </div>

              {/* Acciones Cursos */}
              <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition-colors hover:bg-primary-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <span className="truncate">Agregar Curso</span>
                  </button>
                </div>
              </div>

              {/* Tabla de Cursos */}
              <div className="rounded-lg border border-gray-200 overflow-visible">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th onClick={() => handleSort('title')} className="px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Título
                            {sortConfig?.key === 'title' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('description')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 lg:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Descripción
                            {sortConfig?.key === 'description' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('modules')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Módulos
                            {sortConfig?.key === 'modules' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('createdAt')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 md:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Fecha Creación
                            {sortConfig?.key === 'createdAt' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6" scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {sortedCourses.map((course) => (
                        <tr key={course.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-secondary-900">
                            {course.title}
                          </td>
                          <td className="hidden px-3 py-4 text-sm text-secondary-500 lg:table-cell max-w-md">
                            <p className="truncate">{course.description}</p>
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                            {course.modules?.length || 0}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 md:table-cell">
                            {course.created_at ? new Date(course.created_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEditCourse(course.id)} className="p-2 text-secondary-500 hover:text-primary-600 transition-colors" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteCourse(course.id)} className="p-2 text-secondary-500 hover:text-red-500 transition-colors" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paginación Cursos */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg">
                <div className="text-sm text-secondary-700">
                  Mostrando <span className="font-medium">1</span> a <span className="font-medium">{courses.length}</span> de{' '}
                  <span className="font-medium">{courses.length}</span> resultados
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={true}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-primary-600 text-white"
                  >
                    1
                  </button>
                  <button
                    disabled={true}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'modules' && (
            <>
              {/* Filtros de Módulos */}
              <div className="pb-4 space-y-4">
                <div className="flex gap-4 items-end">
                  <label className="flex h-12 flex-1 flex-col">
                    <div className="flex h-full w-full flex-1 items-stretch rounded-lg">
                      <div className="flex items-center justify-center rounded-l-lg border border-gray-300 bg-gray-100 pl-4 pr-3 text-secondary-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por título o descripción..."
                        value={moduleFilters.search}
                        onChange={(e) => setModuleFilters({...moduleFilters, search: e.target.value})}
                        className="h-full w-full min-w-0 flex-1 rounded-r-lg border border-l-0 border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 placeholder:text-secondary-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                      />
                    </div>
                  </label>
                  <button
                    onClick={() => setShowModuleFilters(!showModuleFilters)}
                    className="flex h-12 items-center gap-2 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-secondary-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
                    </svg>
                    {showModuleFilters ? 'Ocultar filtros' : 'Agregar filtro'}
                  </button>
                </div>
                {showModuleFilters && (
                  <div className="animate-fadeIn">
                    <label className="block text-sm font-medium text-secondary-700 mb-2">Curso</label>
                    <select
                      value={moduleFilters.courseId}
                      onChange={(e) => setModuleFilters({...moduleFilters, courseId: e.target.value})}
                      className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                    >
                      <option value="all">Todos los cursos</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Acciones Módulos */}
              <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition-colors hover:bg-primary-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <span className="truncate">Agregar Módulo</span>
                  </button>
                  
                  <button
                    onClick={handleOpenReorderModal}
                    className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-amber-600 px-4 text-sm font-bold text-white transition-colors hover:bg-amber-700"
                    title="Reordenar módulos de un curso"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
                    </svg>
                    <span className="truncate">Reordenar Módulos</span>
                  </button>
                </div>
              </div>

              {/* Tabla de Módulos */}
              <div className="rounded-lg border border-gray-200 overflow-visible">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th onClick={() => handleSort('title')} className="px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Título
                            {sortConfig?.key === 'title' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('courseId')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Curso
                            {sortConfig?.key === 'courseId' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('description')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 lg:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Descripción
                            {sortConfig?.key === 'description' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('order')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Orden
                            {sortConfig?.key === 'order' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell" scope="col">
                          # Docs
                        </th>
                        <th onClick={() => handleSort('tests')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Tests
                            {sortConfig?.key === 'tests' && (
                              <span>{sortConfig.direction === 'asc' ? '↓' : '↑'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('createdAt')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 md:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Fecha Creación
                            {sortConfig?.key === 'createdAt' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6" scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {sortedModules.map((module) => (
                        <tr key={module.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-secondary-900">
                            {module.title}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                            {courses.find(c => c.id === module.courseId)?.title || 'N/A'}
                          </td>
                          <td className="hidden px-3 py-4 text-sm text-secondary-500 lg:table-cell max-w-md">
                            <p className="truncate">{module.description}</p>
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                            {module.order}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                            <div className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                              </svg>
                              {module.pdfFiles?.length || 0}
                            </div>
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                            {module.tests?.length || 0}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 md:table-cell">
                            {module.createdAt ? new Date(module.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEditModule(module.id)} className="p-2 text-secondary-500 hover:text-primary-600 transition-colors" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteModule(module.id)} className="p-2 text-secondary-500 hover:text-red-500 transition-colors" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paginación Módulos */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg">
                <div className="text-sm text-secondary-700">
                  Mostrando <span className="font-medium">1</span> a <span className="font-medium">{modules.length}</span> de{' '}
                  <span className="font-medium">{modules.length}</span> resultados
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={true}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-primary-600 text-white"
                  >
                    1
                  </button>
                  <button
                    disabled={true}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'tests' && (
            <>
              {/* Filtros de Tests */}
              <div className="pb-4 space-y-4">
                <div className="flex gap-4 items-end">
                  <label className="flex h-12 flex-1 flex-col">
                    <div className="flex h-full w-full flex-1 items-stretch rounded-lg">
                      <div className="flex items-center justify-center rounded-l-lg border border-gray-300 bg-gray-100 pl-4 pr-3 text-secondary-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por título..."
                        value={testFilters.search}
                        onChange={(e) => setTestFilters({...testFilters, search: e.target.value})}
                        className="h-full w-full min-w-0 flex-1 rounded-r-lg border border-l-0 border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 placeholder:text-secondary-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                      />
                    </div>
                  </label>
                  <button
                    onClick={() => setShowTestFilters(!showTestFilters)}
                    className="flex h-12 items-center gap-2 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-secondary-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
                    </svg>
                    {showTestFilters ? 'Ocultar filtros' : 'Agregar filtro'}
                  </button>
                </div>
                {showTestFilters && (
                  <div className="flex gap-4 animate-fadeIn">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-secondary-700 mb-2">Curso</label>
                      <select
                        value={testFilters.courseId}
                        onChange={(e) => {
                          setTestFilters({...testFilters, courseId: e.target.value, moduleId: 'all'})
                        }}
                        className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                      >
                        <option value="all">Todos los cursos</option>
                        {courses.map(course => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-secondary-700 mb-2">Módulo</label>
                      <select
                        value={testFilters.moduleId}
                        onChange={(e) => setTestFilters({...testFilters, moduleId: e.target.value})}
                        className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base font-normal text-secondary-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                        disabled={testFilters.courseId === 'all'}
                      >
                        <option value="all">Todos los módulos</option>
                        {modules
                          .filter(m => testFilters.courseId === 'all' || m.courseId === testFilters.courseId)
                          .map(module => (
                            <option key={module.id} value={module.id}>{module.title}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones Tests */}
              <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition-colors hover:bg-primary-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <span className="truncate">Agregar Test</span>
                  </button>
                  <label className="flex h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-gray-300 bg-white px-4 text-sm font-bold text-secondary-800 transition-colors hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                    </svg>
                    <span className="truncate">Subir Lista (.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleTestExcelUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <button onClick={downloadTestTemplate} className="text-sm font-normal text-primary-600 underline hover:no-underline cursor-pointer">
                  Descargar plantilla Excel de tests
                </button>
              </div>

              {/* Barra de selección múltiple Tests */}
              {selectedTests.length > 0 && (
                <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary-900">{selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} seleccionado{selectedTests.length > 1 ? 's' : ''}</p>
                        <p className="text-xs text-primary-700">Acciones disponibles para los tests seleccionados</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleBulkDeleteTests}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        Eliminar
                      </button>
                      <button
                        onClick={() => setSelectedTests([])}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Tests */}
              <div className="rounded-lg border border-gray-200 overflow-visible">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3.5 text-left" scope="col">
                          <input
                            type="checkbox"
                            checked={selectedTests.length === sortedTests.length && sortedTests.length > 0}
                            onChange={toggleAllTests}
                            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                          />
                        </th>
                        <th onClick={() => handleSort('title')} className="px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Título
                            {sortConfig?.key === 'title' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('courseId')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 lg:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Curso
                            {sortConfig?.key === 'courseId' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('moduleId')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 md:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Módulo
                            {sortConfig?.key === 'moduleId' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('questions')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 sm:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Preguntas
                            {sortConfig?.key === 'questions' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th onClick={() => handleSort('createdAt')} className="hidden px-3 py-3.5 text-left text-sm font-semibold text-secondary-900 md:table-cell cursor-pointer hover:bg-gray-100 select-none" scope="col">
                          <div className="flex items-center gap-1">
                            Fecha Creación
                            {sortConfig?.key === 'createdAt' && (
                              <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6" scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {sortedTests.map((test) => {
                        const testModule = modules.find(m => m.id === test.moduleId)
                        const testCourse = courses.find(c => c.id === testModule?.courseId)
                        return (
                        <tr key={test.id} className="hover:bg-gray-50">
                          <td className="px-3 py-4">
                            <input
                              type="checkbox"
                              checked={selectedTests.includes(test.id)}
                              onChange={() => toggleTestSelection(test.id)}
                              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-secondary-900">
                            {test.title}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 lg:table-cell">
                            {testCourse?.title || '-'}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 md:table-cell">
                            {testModule?.title || '-'}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 sm:table-cell">
                            {test.questions?.length || 0}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-secondary-500 md:table-cell">
                            {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEditTest(test.id)} className="p-2 text-secondary-500 hover:text-primary-600 transition-colors" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteTest(test.id)} className="p-2 text-secondary-500 hover:text-red-500 transition-colors" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paginación Tests */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg">
                <div className="text-sm text-secondary-700">
                  Mostrando <span className="font-medium">1</span> a <span className="font-medium">{tests.length}</span> de{' '}
                  <span className="font-medium">{tests.length}</span> resultados
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={true}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-primary-600 text-white"
                  >
                    1
                  </button>
                  <button
                    disabled={true}
                    className="px-3 py-1.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'phrases' && (
            <>
              {/* Header Frases */}
              <div className="pb-4">
                <div className="flex gap-4 items-end justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-secondary-900 mb-2">Gestión de Frases Motivacionales</h3>
                    <p className="text-sm text-secondary-600">Administra las frases que se mostrarán a los estudiantes según su rendimiento</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(true)
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Nueva Frase
                  </button>
                </div>
              </div>

              {/* Tabla de Frases por Rango */}
              {['0-30', '31-50', '51-70', '71-90', '91-100'].map((range) => {
                const rangePhrases = phrases.filter(p => p.range_type === range)
                const rangeLabels = {
                  '0-30': '0-30% (Necesita mejorar)',
                  '31-50': '31-50% (En progreso)',
                  '51-70': '51-70% (Bien)',
                  '71-90': '71-90% (Muy bien)',
                  '91-100': '91-100% (Excelente)'
                }
                
                return (
                  <div key={range} className="mb-6 bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-4 border-b border-gray-200">
                      <h4 className="text-lg font-bold text-primary-900">{rangeLabels[range]}</h4>
                      <p className="text-sm text-primary-700 mt-1">{rangePhrases.length} frase(s) configurada(s)</p>
                    </div>
                    
                    <div className="p-4">
                      {rangePhrases.length === 0 ? (
                        <div className="text-center py-8 text-secondary-500">
                          <p className="text-sm">No hay frases configuradas para este rango</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {rangePhrases.map((phrase) => (
                            <div key={phrase.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                              <div className="flex-1">
                                <p className="text-sm text-secondary-900">{phrase.phrase}</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    phrase.is_active 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {phrase.is_active ? 'Activa' : 'Inactiva'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingItem({
                                      type: 'phrase',
                                      id: phrase.id,
                                      phrase: phrase.phrase,
                                      rangeType: phrase.range_type,
                                      isActive: phrase.is_active
                                    })
                                    setShowEditModal(true)
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar frase"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteItem({ id: phrase.id, type: 'phrase', name: phrase.phrase })
                                    setShowDeleteModal(true)
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar frase"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Modal de Reordenamiento de Módulos */}
      {showReorderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-secondary-900 mb-6">
              Reordenar Módulos
            </h2>
            
            {/* Selector de Curso */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Selecciona el curso <span className="text-red-500">*</span>
              </label>
              <select
                value={reorderCourseId}
                onChange={(e) => handleCourseSelectForReorder(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Selecciona un curso --</option>
                {[...courses].sort((a, b) => a.title.localeCompare(b.title)).map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            {/* Lista de módulos con drag & drop */}
            {reorderedModules.length > 0 ? (
              <div className="mb-6">
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <p className="text-sm text-amber-800">
                    <strong>Instrucciones:</strong> Arrastra los módulos para cambiar su orden. Los números se actualizarán automáticamente.
                  </p>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {reorderedModules.map((module, index) => (
                    <div
                      key={module.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-4 p-4 bg-white rounded-lg border-2 transition-all cursor-move ${
                        draggedModuleIndex === index 
                          ? 'border-primary-500 opacity-50 scale-[0.98] shadow-lg' 
                          : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-lg">
                          {index + 1}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{module.title}</h3>
                        <p className="text-sm text-gray-500 truncate">{module.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        </svg>
                        {module.pdfFiles?.length || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              reorderCourseId && (
                <div className="mb-6 p-8 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                  </svg>
                  <p className="font-medium">Este curso no tiene módulos</p>
                  <p className="text-sm">Agrega módulos primero para poder reordenarlos</p>
                </div>
              )
            )}

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={handleCloseReorderModal}
                disabled={isSavingOrder}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-secondary-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReorder}
                disabled={reorderedModules.length === 0 || isSavingOrder}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingOrder ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  'Guardar Orden'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal - Dinámico según tab activo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-secondary-900 mb-6">
              {activeTab === 'students' && 'Crear Nuevo Usuario'}
              {activeTab === 'courses' && 'Crear Nuevo Curso'}
              {activeTab === 'modules' && 'Crear Nuevo Módulo'}
              {activeTab === 'tests' && 'Crear Nuevo Test'}
            </h2>
            
            <div className="space-y-4">
              {/* Formulario Students */}
              {activeTab === 'students' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ej: Juan Pérez García"
                    />
                    <p className="text-xs text-secondary-500 mt-1">
                      Se generará automáticamente el usuario y contraseña
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Usuario (opcional)
                      </label>
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Se generará automáticamente"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Contraseña (opcional)
                      </label>
                      <input
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Se generará automáticamente"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Rol
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value as 'student' | 'admin'})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="student">Estudiante</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Estado
                    </label>
                    <select
                      value={newUser.status}
                      onChange={(e) => setNewUser({...newUser, status: e.target.value as 'active' | 'inactive'})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </>
              )}

              {/* Formulario Courses */}
              {activeTab === 'courses' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Título del Curso <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCourse.title}
                      onChange={(e) => setNewCourse({...newCourse, title: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ej: Álgebra Básica"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Describe el contenido del curso..."
                    />
                  </div>
                </>
              )}

              {/* Formulario Modules */}
              {activeTab === 'modules' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Curso
                    </label>
                    <select
                      value={newModule.courseId}
                      onChange={(e) => setNewModule({...newModule, courseId: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Seleccionar curso</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Título del Módulo
                    </label>
                    <input
                      type="text"
                      value={newModule.title}
                      onChange={(e) => setNewModule({...newModule, title: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ej: Introducción a HTML"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={newModule.description}
                      onChange={(e) => setNewModule({...newModule, description: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Describe el contenido del módulo..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Orden
                    </label>
                    <input
                      type="number"
                      value={newModule.order}
                      onChange={(e) => setNewModule({...newModule, order: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="1"
                    />
                  </div>

                  {/* Archivos PDF */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-bold text-secondary-900 mb-3">
                      Archivos PDF ({newModule.pdfFiles.length})
                    </label>
                    
                    {/* Lista de PDFs subidos */}
                    {newModule.pdfFiles.map((pdf, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-secondary-900">{pdf.name}</p>
                          <p className="text-xs text-secondary-500 truncate">{pdf.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newModule.pdfFiles.filter((_, i) => i !== index)
                            setNewModule({...newModule, pdfFiles: updated})
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Eliminar PDF"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                    
                    {/* Input para subir nuevo PDF */}
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-600">Subir PDF</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          
                          // Validar y comprimir PDF si es necesario
                          showToast('Procesando PDF...', 'info')
                          
                          try {
                            const result = await validateAndCompressPDF(file, 4)
                            
                            if (result.compressed) {
                              showToast(`PDF comprimido: ${result.originalSize.toFixed(2)}MB → ${result.finalSize.toFixed(2)}MB`, 'success')
                            }
                            
                            const formData = new FormData()
                            formData.append('file', result.file)
                            
                            const response = await fetch('/api/upload', {
                              method: 'POST',
                              body: formData
                            })
                            
                            if (response.ok) {
                              const data = await response.json()
                              setNewModule({
                                ...newModule,
                                pdfFiles: [...newModule.pdfFiles, { name: data.name, url: data.url }]
                              })
                              showToast('PDF subido correctamente', 'success')
                            } else {
                              if (response.status === 413) {
                                alert('El archivo es demasiado grande incluso después de comprimirlo.\n\nIntenta comprimirlo manualmente: https://www.ilovepdf.com/es/comprimir_pdf')
                              } else {
                                const error = await response.json()
                                alert(error.error || 'Error al subir el archivo')
                              }
                            }
                          } catch (error: any) {
                            console.error('Error:', error)
                            alert(error.message || 'Error al subir el archivo')
                          }
                          
                          // Reset input
                          e.target.value = ''
                        }}
                      />
                    </label>
                    <p className="text-xs text-secondary-500 mt-2">Archivos PDF (se comprimirán automáticamente si superan 4MB)</p>
                  </div>
                </>
              )}

              {/* Formulario Tests */}
              {/* Formulario Tests */}
              {activeTab === 'tests' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Título del Test
                    </label>
                    <input
                      type="text"
                      value={newTest.title}
                      onChange={(e) => setNewTest({...newTest, title: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ej: Evaluación HTML Básico"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Curso
                      </label>
                      <select
                        value={newTest.courseId}
                        onChange={(e) => setNewTest({...newTest, courseId: e.target.value, moduleId: ''})}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Seleccionar curso</option>
                        {courses.map(course => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Módulo
                      </label>
                      <select
                        value={newTest.moduleId}
                        onChange={(e) => setNewTest({...newTest, moduleId: e.target.value})}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        disabled={!newTest.courseId}
                      >
                        <option value="">Seleccionar módulo</option>
                        {modules
                          .filter(m => String(m.courseId) === newTest.courseId)
                          .map(module => (
                            <option key={module.id} value={module.id}>{module.title}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <label className="block text-sm font-bold text-secondary-900 mb-3">
                      Preguntas ({newTest.questions.length})
                    </label>
                    <p className="text-sm text-secondary-600 mb-3">
                      Puedes agregar preguntas después de crear el test usando el botón "Editar"
                    </p>
                  </div>
                </>
              )}

              {/* Formulario Frases */}
              {activeTab === 'phrases' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Frase Motivacional <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={editingItem?.phrase || ''}
                      onChange={(e) => setEditingItem({...editingItem, phrase: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ej: ¡Felicitaciones! Has demostrado un excelente dominio del tema."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Rango de Porcentaje <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editingItem?.rangeType || '0-30'}
                      onChange={(e) => setEditingItem({...editingItem, rangeType: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="0-30">0-30% (Necesita mejorar)</option>
                      <option value="31-50">31-50% (En progreso)</option>
                      <option value="51-70">51-70% (Bien)</option>
                      <option value="71-90">71-90% (Muy bien)</option>
                      <option value="91-100">91-100% (Excelente)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={editingItem?.isActive !== false}
                      onChange={(e) => setEditingItem({...editingItem, isActive: e.target.checked})}
                      className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-secondary-700">
                      Frase activa
                    </label>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'students') handleCreateUser()
                  else if (activeTab === 'courses') handleCreateCourse()
                  else if (activeTab === 'modules') handleCreateModule()
                  else if (activeTab === 'tests') handleCreateTest()
                  else if (activeTab === 'phrases') handleCreatePhrase()
                }}
                className="flex-1 btn-primary"
              >
                Crear {activeTab === 'students' ? 'Usuario' : activeTab === 'courses' ? 'Curso' : activeTab === 'modules' ? 'Módulo' : activeTab === 'tests' ? 'Test' : 'Frase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra flotante fija con cambios pendientes */}
      {pendingChanges.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-green-600 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-secondary-900">
                    {pendingChanges.size} {pendingChanges.size === 1 ? 'cambio pendiente' : 'cambios pendientes'}
                  </p>
                  <p className="text-xs text-secondary-500">Presiona guardar para actualizar la base de datos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDiscardChanges}
                  className="px-4 py-2 text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={handleSaveChanges}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-all hover:scale-105 shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                  </svg>
                  <span>Guardar cambios</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de cambios */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-secondary-900">Cambios sin guardar</h3>
                  <p className="text-sm text-secondary-600">Tienes {modifiedUserIds.length} cambio(s) pendiente(s)</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-secondary-700 mb-2">
                ¿Qué deseas hacer con los cambios antes de cambiar de pestaña?
              </p>
              <ul className="text-sm text-secondary-600 space-y-1 ml-4 list-disc">
                <li>Guardar: Los cambios se guardarán en la base de datos</li>
                <li>Descartar: Los cambios se perderán permanentemente</li>
              </ul>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setPendingTab(null)
                }}
                className="px-4 py-2 text-sm font-medium text-secondary-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all hover:scale-105 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 rounded-t-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                Editar {editingItem.type === 'user' ? 'Usuario' : editingItem.type === 'course' ? 'Curso' : editingItem.type === 'module' ? 'Módulo' : editingItem.type === 'phrase' ? 'Frase' : 'Test'}
              </h3>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {editingItem.type === 'user' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={editingItem.username}
                      onChange={(e) => setEditingItem({ ...editingItem, username: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Contraseña
                    </label>
                    <input
                      type="text"
                      value={editingItem.password}
                      onChange={(e) => setEditingItem({ ...editingItem, password: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Rol
                    </label>
                    <select
                      value={editingItem.role}
                      onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="student">Student</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Estado
                    </label>
                    <select
                      value={editingItem.status}
                      onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Cesado</option>
                    </select>
                  </div>
                </>
              )}

              {editingItem.type === 'course' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={editingItem.title}
                      onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={editingItem.description}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'module' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Curso
                    </label>
                    <select
                      value={editingItem.courseId}
                      onChange={(e) => setEditingItem({ ...editingItem, courseId: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Seleccionar curso</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={editingItem.title}
                      onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={editingItem.description}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Orden
                    </label>
                    <input
                      type="number"
                      value={editingItem.order}
                      onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  {/* Archivos PDF */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-bold text-secondary-900 mb-3">
                      Archivos PDF ({editingItem.pdfFiles?.length || 0})
                    </label>
                    
                    {(editingItem.pdfFiles || []).map((pdf: any, index: number) => (
                      <div key={index} className="flex gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={pdf.name}
                            onChange={(e) => {
                              const updated = [...(editingItem.pdfFiles || [])]
                              updated[index].name = e.target.value
                              setEditingItem({...editingItem, pdfFiles: updated})
                            }}
                            placeholder="Nombre del archivo"
                            className="w-full px-3 py-1.5 text-sm border border-secondary-300 rounded mb-1"
                          />
                          <input
                            type="text"
                            value={pdf.url}
                            onChange={(e) => {
                              const updated = [...(editingItem.pdfFiles || [])]
                              updated[index].url = e.target.value
                              setEditingItem({...editingItem, pdfFiles: updated})
                            }}
                            placeholder="URL del PDF"
                            className="w-full px-3 py-1.5 text-sm border border-secondary-300 rounded"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingItem.pdfFiles || []).filter((_: any, i: number) => i !== index)
                            setEditingItem({...editingItem, pdfFiles: updated})
                          }}
                          className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem({
                            ...editingItem,
                            pdfFiles: [...(editingItem.pdfFiles || []), { name: '', url: '' }]
                          })
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        Agregar URL
                      </button>

                      <label className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary-50 text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                        </svg>
                        Adjuntar archivo
                        <input
                          type="file"
                          accept=".pdf"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || [])
                            if (files.length === 0) return
                            
                            showToast('Procesando PDFs...', 'info')
                            
                            try {
                              // Comprimir y subir cada archivo
                              const uploadPromises = files.map(async (file) => {
                                // Comprimir si es necesario
                                const result = await validateAndCompressPDF(file, 4)
                                
                                if (result.compressed) {
                                  console.log(`${file.name}: ${result.originalSize.toFixed(2)}MB → ${result.finalSize.toFixed(2)}MB`)
                                }
                                
                                const formData = new FormData()
                                formData.append('file', result.file)
                                
                                const response = await fetch('/api/upload', {
                                  method: 'POST',
                                  body: formData
                                })
                                
                                if (!response.ok) {
                                  if (response.status === 413) {
                                    throw new Error(`${file.name} es demasiado grande incluso comprimido. Usa: https://www.ilovepdf.com/es/comprimir_pdf`)
                                  }
                                  const errorData = await response.json()
                                  throw new Error(errorData.error || `Error al subir ${file.name}`)
                                }
                                
                                const data = await response.json()
                                return { name: data.name, url: data.url }
                              })
                              
                              const uploadedPdfs = await Promise.all(uploadPromises)
                              
                              setEditingItem({
                                ...editingItem,
                                pdfFiles: [...(editingItem.pdfFiles || []), ...uploadedPdfs]
                              })
                              
                              showToast('PDFs subidos correctamente', 'success')
                            } catch (error: any) {
                              console.error('Error subiendo archivos:', error)
                              alert(error.message || 'Error al subir los archivos')
                            }
                            
                            // Reset input
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {editingItem.type === 'test' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={editingItem.title}
                      onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Curso
                      </label>
                      <select
                        value={editingItem.courseId || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, courseId: e.target.value, moduleId: '' })}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Seleccionar curso</option>
                        {courses.map(course => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Módulo
                      </label>
                      <select
                        value={editingItem.moduleId || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, moduleId: e.target.value })}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        disabled={!editingItem.courseId}
                      >
                        <option value="">Seleccionar módulo</option>
                        {modules
                          .filter(m => m.courseId === editingItem.courseId)
                          .map(module => (
                            <option key={module.id} value={module.id}>{module.title}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Preguntas */}
                  <div className="border-t pt-4 mt-4">
                    <label className="block text-sm font-bold text-secondary-900 mb-3">
                      Preguntas ({editingItem.questions?.length || 0})
                    </label>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {editingItem.questions?.map((question: any, index: number) => (
                        <div key={question.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-3">
                            <label className="block text-sm font-semibold text-secondary-900">
                              Pregunta {index + 1}
                            </label>
                            <button
                              onClick={() => {
                                const newQuestions = editingItem.questions.filter((_: any, i: number) => i !== index)
                                setEditingItem({ ...editingItem, questions: newQuestions })
                              }}
                              className="text-red-500 hover:text-red-700 text-sm font-bold px-2"
                              title="Eliminar pregunta"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              Texto de la pregunta
                            </label>
                            <div className="flex gap-1 mb-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const textarea = document.getElementById(`question-${index}`) as HTMLTextAreaElement
                                  if (!textarea) return
                                  
                                  const start = textarea.selectionStart
                                  const end = textarea.selectionEnd
                                  const selectedText = textarea.value.substring(start, end)
                                  
                                  if (selectedText) {
                                    const newText = textarea.value.substring(0, start) + 
                                      `_{${selectedText}}` + 
                                      textarea.value.substring(end)
                                    
                                    const newQuestions = [...editingItem.questions]
                                    newQuestions[index] = { ...question, question: newText }
                                    setEditingItem({ ...editingItem, questions: newQuestions })
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                title="Subíndice (selecciona texto primero)"
                              >
                                X<sub>2</sub>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const textarea = document.getElementById(`question-${index}`) as HTMLTextAreaElement
                                  if (!textarea) return
                                  
                                  const start = textarea.selectionStart
                                  const end = textarea.selectionEnd
                                  const selectedText = textarea.value.substring(start, end)
                                  
                                  if (selectedText) {
                                    const newText = textarea.value.substring(0, start) + 
                                      `^{${selectedText}}` + 
                                      textarea.value.substring(end)
                                    
                                    const newQuestions = [...editingItem.questions]
                                    newQuestions[index] = { ...question, question: newText }
                                    setEditingItem({ ...editingItem, questions: newQuestions })
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                title="Superíndice (selecciona texto primero)"
                              >
                                X<sup>2</sup>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.accept = 'image/*'
                                  input.onchange = async (e: any) => {
                                    const file = e.target.files[0]
                                    if (!file) return
                                    
                                    try {
                                      // Subir imagen a Vercel Blob
                                      const formData = new FormData()
                                      formData.append('file', file)
                                      
                                      const response = await fetch('/api/upload-image', {
                                        method: 'POST',
                                        body: formData
                                      })
                                      
                                      if (!response.ok) throw new Error('Error subiendo imagen')
                                      
                                      const { url } = await response.json()
                                      
                                      // Insertar sintaxis de imagen en el cursor
                                      const textarea = document.getElementById(`question-${index}`) as HTMLTextAreaElement
                                      if (!textarea) return
                                      
                                      const start = textarea.selectionStart
                                      const newText = textarea.value.substring(0, start) + 
                                        ` ![imagen](${url}){300} ` + 
                                        textarea.value.substring(start)
                                      
                                      const newQuestions = [...editingItem.questions]
                                      newQuestions[index] = { ...question, question: newText }
                                      setEditingItem({ ...editingItem, questions: newQuestions })
                                    } catch (error) {
                                      console.error('Error subiendo imagen:', error)
                                      alert('Error al subir la imagen')
                                    }
                                  }
                                  input.click()
                                }}
                                className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                title="Subir imagen"
                              >
                                📷 Imagen
                              </button>
                              <span className="text-xs text-gray-500 self-center ml-2">Selecciona texto y haz clic</span>
                            </div>
                            <textarea
                              id={`question-${index}`}
                              value={question.question}
                              onChange={(e) => {
                                const newQuestions = [...editingItem.questions]
                                newQuestions[index] = { ...question, question: e.target.value }
                                setEditingItem({ ...editingItem, questions: newQuestions })
                              }}
                              rows={3}
                              placeholder="Escriba aquí el texto de la pregunta..."
                              className="w-full px-3 py-2 border-2 border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                            />
                            {question.question && (
                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                <span className="text-xs text-blue-600 font-medium">Vista previa: </span>
                                <span>{renderFormattedText(question.question)}</span>
                              </div>
                            )}
                          </div>
                          
                          <label className="block text-xs font-medium text-secondary-600 mb-1 mt-3">
                            Opciones
                          </label>
                          <div className="flex gap-1 mb-2">
                            <button
                              type="button"
                              onClick={() => {
                                const textarea = document.getElementById(`option-${index}-focused`) as HTMLInputElement
                                if (!textarea) return
                                
                                const start = textarea.selectionStart || 0
                                const end = textarea.selectionEnd || 0
                                const selectedText = textarea.value.substring(start, end)
                                
                                if (selectedText) {
                                  const optIndex = parseInt(textarea.dataset.optionIndex || '0')
                                  const newText = textarea.value.substring(0, start) + 
                                    `_{${selectedText}}` + 
                                    textarea.value.substring(end)
                                  
                                  const newQuestions = [...editingItem.questions]
                                  const newOptions = [...question.options]
                                  newOptions[optIndex] = newText
                                  newQuestions[index] = { ...question, options: newOptions }
                                  setEditingItem({ ...editingItem, questions: newQuestions })
                                }
                              }}
                              className="px-2 py-0.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                              title="Subíndice para opción (selecciona texto primero)"
                            >
                              X<sub>2</sub>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const textarea = document.getElementById(`option-${index}-focused`) as HTMLInputElement
                                if (!textarea) return
                                
                                const start = textarea.selectionStart || 0
                                const end = textarea.selectionEnd || 0
                                const selectedText = textarea.value.substring(start, end)
                                
                                if (selectedText) {
                                  const optIndex = parseInt(textarea.dataset.optionIndex || '0')
                                  const newText = textarea.value.substring(0, start) + 
                                    `^{${selectedText}}` + 
                                    textarea.value.substring(end)
                                  
                                  const newQuestions = [...editingItem.questions]
                                  const newOptions = [...question.options]
                                  newOptions[optIndex] = newText
                                  newQuestions[index] = { ...question, options: newOptions }
                                  setEditingItem({ ...editingItem, questions: newQuestions })
                                }
                              }}
                              className="px-2 py-0.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                              title="Superíndice para opción (selecciona texto primero)"
                            >
                              X<sup>2</sup>
                            </button>
                            <span className="text-xs text-gray-500 self-center ml-1">Para opciones</span>
                          </div>
                          <div className="space-y-1">
                            {question.options?.map((option: string, optIndex: number) => (
                              <div key={optIndex}>
                                <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={question.correctAnswer === optIndex}
                                  onChange={() => {
                                    const newQuestions = [...editingItem.questions]
                                    newQuestions[index] = { ...question, correctAnswer: optIndex }
                                    setEditingItem({ ...editingItem, questions: newQuestions })
                                  }}
                                  className="h-4 w-4 text-primary-600"
                                  title="Marcar como respuesta correcta"
                                />
                                <input
                                  type="text"
                                  id={`option-${index}-focused`}
                                  data-option-index={optIndex}
                                  value={typeof option === 'string' ? option : option.text || ''}
                                  onChange={(e) => {
                                    const newQuestions = [...editingItem.questions]
                                    const newOptions = [...question.options]
                                    newOptions[optIndex] = e.target.value
                                    newQuestions[index] = { ...question, options: newOptions }
                                    setEditingItem({ ...editingItem, questions: newQuestions })
                                  }}
                                  onFocus={(e) => {
                                    // Actualizar el id del input enfocado
                                    document.querySelectorAll(`[id^="option-${index}-"]`).forEach(el => {
                                      if (el.id !== e.target.id) el.removeAttribute('id')
                                    })
                                    e.target.id = `option-${index}-focused`
                                  }}
                                  className="flex-1 px-3 py-1.5 border border-secondary-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                  placeholder={`Opción ${optIndex + 1}`}
                                />
                                {question.options.length > 2 && (
                                  <button
                                    onClick={() => {
                                      const newQuestions = [...editingItem.questions]
                                      const newOptions = question.options.filter((_: string, i: number) => i !== optIndex)
                                      // Ajustar correctAnswer si es necesario
                                      let newCorrectAnswer = question.correctAnswer
                                      if (question.correctAnswer === optIndex) {
                                        newCorrectAnswer = 0
                                      } else if (question.correctAnswer > optIndex) {
                                        newCorrectAnswer = question.correctAnswer - 1
                                      }
                                      newQuestions[index] = { ...question, options: newOptions, correctAnswer: newCorrectAnswer }
                                      setEditingItem({ ...editingItem, questions: newQuestions })
                                    }}
                                    className="text-red-500 hover:text-red-700 text-xs px-2"
                                    title="Eliminar opción"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              {option && (
                                <div className="ml-8 mt-1 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                  Vista: {renderFormattedText(typeof option === 'string' ? option : option.text)}
                                </div>
                              )}
                              </div>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => {
                              const newQuestions = [...editingItem.questions]
                              const newOptions = [...question.options, '']
                              newQuestions[index] = { ...question, options: newOptions }
                              setEditingItem({ ...editingItem, questions: newQuestions })
                            }}
                            className="mt-2 w-full px-3 py-1.5 border border-dashed border-gray-300 rounded text-xs text-secondary-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                          >
                            + Agregar opción
                          </button>
                          
                          {/* Campo de Explicación */}
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              Explicación (opcional - se muestra al errar)
                            </label>
                            <textarea
                              value={question.explanation || ''}
                              onChange={(e) => {
                                const newQuestions = [...editingItem.questions]
                                newQuestions[index] = { ...question, explanation: e.target.value }
                                setEditingItem({ ...editingItem, questions: newQuestions })
                                // Auto-ajustar altura
                                e.target.style.height = 'auto'
                                e.target.style.height = e.target.scrollHeight + 'px'
                              }}
                              onFocus={(e) => {
                                // Ajustar altura al enfocar
                                e.target.style.height = 'auto'
                                e.target.style.height = e.target.scrollHeight + 'px'
                              }}
                              placeholder="Explicación de por qué es incorrecta...&#10;(Puedes usar saltos de línea)"
                              className="w-full px-3 py-2 border border-secondary-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none overflow-hidden"
                              style={{ minHeight: '60px' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => {
                        const newQuestion = {
                          id: `q-${Date.now()}`,
                          testId: editingItem.id,
                          question: '',
                          options: ['', ''],
                          correctAnswer: 0,
                          order: editingItem.questions?.length || 0,
                          explanation: ''
                        }
                        setEditingItem({ 
                          ...editingItem, 
                          questions: [...(editingItem.questions || []), newQuestion] 
                        })
                      }}
                      className="mt-3 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-secondary-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                    >
                      + Agregar pregunta
                    </button>
                  </div>
                </>
              )}

              {editingItem.type === 'phrase' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Frase Motivacional <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={editingItem.phrase || ''}
                      onChange={(e) => setEditingItem({...editingItem, phrase: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ej: ¡Felicitaciones! Has demostrado un excelente dominio del tema."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Rango de Porcentaje <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editingItem.rangeType || '0-30'}
                      onChange={(e) => setEditingItem({...editingItem, rangeType: e.target.value})}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="0-30">0-30% (Necesita mejorar)</option>
                      <option value="31-50">31-50% (En progreso)</option>
                      <option value="51-70">51-70% (Bien)</option>
                      <option value="71-90">71-90% (Muy bien)</option>
                      <option value="91-100">91-100% (Excelente)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editIsActive"
                      checked={editingItem.isActive !== false}
                      onChange={(e) => setEditingItem({...editingItem, isActive: e.target.checked})}
                      className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="editIsActive" className="text-sm font-medium text-secondary-700">
                      Frase activa
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingItem(null)
                }}
                className="px-4 py-2 text-sm font-medium text-secondary-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all hover:scale-105 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminación moderno */}
      {showDeleteModal && deleteItem && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all animate-scaleIn">
            {/* Header con gradiente */}
            <div className="relative bg-gradient-to-br from-red-500 to-red-600 px-6 py-8">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4 animate-bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {deleteItem.id === 'bulk' 
                    ? '¿Eliminar estudiantes seleccionados?' 
                    : `¿Eliminar ${deleteItem.type === 'user' ? 'usuario' : deleteItem.type === 'course' ? 'curso' : deleteItem.type === 'module' ? 'módulo' : 'test'}?`
                  }
                </h3>
                <p className="text-red-100 text-sm">Esta acción no se puede deshacer</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800 mb-1">Estás a punto de eliminar:</p>
                    <p className="text-base font-bold text-red-900">{deleteItem.name}</p>
                  </div>
                </div>
              </div>
              
              {deleteItem.type === 'course' && (
                <p className="text-sm text-secondary-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <span>Todos los módulos y tests asociados también serán eliminados.</span>
                </p>
              )}
              
              {deleteItem.type === 'module' && (
                <p className="text-sm text-secondary-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <span>Todos los tests asociados a este módulo también serán eliminados.</span>
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteItem(null)
                }}
                className="px-5 py-2.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmBulkDelete}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cursos Faltantes */}
      {showMissingCoursesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Cursos No Encontrados</h3>
              <p className="text-orange-50 text-sm mt-1">
                Los siguientes cursos no existen. ¿Deseas agregarlos?
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {missingCourses.map((course, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Nombre del Curso
                      </label>
                      <input
                        type="text"
                        value={course.name}
                        onChange={(e) => {
                          const newCourses = [...missingCourses]
                          newCourses[idx].name = e.target.value
                          setMissingCourses(newCourses)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Nombre del curso"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        value={course.description}
                        onChange={(e) => {
                          const newCourses = [...missingCourses]
                          newCourses[idx].description = e.target.value
                          setMissingCourses(newCourses)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Descripción del curso (opcional)"
                        rows={3}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setMissingCourses(missingCourses.filter((_, i) => i !== idx))
                      }}
                      className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                      No agregar este curso
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
              <button
                onClick={() => {
                  setShowMissingCoursesModal(false)
                  setMissingCourses([])
                  setTempExcelData(null)
                }}
                className="px-5 py-2.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (isCreatingCourses) return
                  setIsCreatingCourses(true)
                  
                  try {
                    // Crear los cursos
                    for (const course of missingCourses) {
                      try {
                        await fetch('/api/courses', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: course.name,
                            description: course.description || `Curso de ${course.name}`,
                            image: ''
                          })
                        })
                      } catch (error) {
                        console.error('Error creando curso:', error)
                      }
                    }
                    
                    // Recargar datos
                    await loadData()
                    
                    // Cerrar modal de cursos
                    setShowMissingCoursesModal(false)
                    setMissingCourses([])
                    
                    // Si hay módulos faltantes, mostrar ese modal
                    if (tempExcelData && tempExcelData.missingModules.length > 0) {
                      setMissingModules(tempExcelData.missingModules)
                      setShowMissingModulesModal(true)
                    } else if (tempExcelData) {
                      // Si no hay módulos faltantes, procesar el Excel
                      processExcelData(tempExcelData.jsonData)
                    }
                  } finally {
                    setIsCreatingCourses(false)
                  }
                }}
                disabled={isCreatingCourses}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg transition-all hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isCreatingCourses ? (
                  <>
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Sí, Agregar Cursos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Módulos Faltantes */}
      {showMissingModulesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Módulos No Encontrados</h3>
              <p className="text-purple-50 text-sm mt-1">
                Los siguientes módulos no existen. ¿Deseas agregarlos?
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-900">Nombre del Módulo</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-900">Curso</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-900 w-24">Orden</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-secondary-900 w-20">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingModules.map((module, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={module.name}
                            onChange={(e) => {
                              const newModules = [...missingModules]
                              newModules[idx].name = e.target.value
                              setMissingModules(newModules)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Nombre del módulo"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span className="text-sm text-secondary-700 font-medium">{module.courseName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            value={module.order}
                            onChange={(e) => {
                              const newModules = [...missingModules]
                              newModules[idx].order = parseInt(e.target.value) || 1
                              setMissingModules(newModules)
                            }}
                            className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            min="1"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setMissingModules(missingModules.filter((_, i) => i !== idx))
                            }}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="No agregar este módulo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
              <button
                onClick={() => {
                  setShowMissingModulesModal(false)
                  setMissingModules([])
                  setTempExcelData(null)
                }}
                className="px-5 py-2.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (isCreatingModules) return
                  setIsCreatingModules(true)
                  
                  try {
                    // Crear los módulos
                    for (const module of missingModules) {
                      try {
                        // Buscar el courseId
                        const course = courses.find(c => c.title.toLowerCase().trim() === module.courseName.toLowerCase().trim())
                        if (course) {
                          await fetch('/api/modules', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: module.name,
                              description: `Módulo ${module.name}`,
                              courseId: course.id,
                              order: module.order,
                              pdfFiles: []
                            })
                          })
                        }
                      } catch (error) {
                        console.error('Error creando módulo:', error)
                      }
                    }
                    
                    // Recargar datos
                    await loadData()
                    
                    // Cerrar modal de módulos
                    setShowMissingModulesModal(false)
                    setMissingModules([])
                    
                    // Procesar el Excel
                    if (tempExcelData) {
                      processExcelData(tempExcelData.jsonData)
                    }
                  } finally {
                    setIsCreatingModules(false)
                  }
                }}
                disabled={isCreatingModules}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-lg transition-all hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isCreatingModules ? (
                  <>
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Sí, Agregar Módulos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa de Tests */}
      {showTestPreviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-secondary-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Vista Previa - Tests Cargados</h3>
              <button
                onClick={handleCancelTests}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-blue-900">
                  Se cargaron {pendingTests.length} test{pendingTests.length !== 1 ? 's' : ''} desde el archivo Excel.
                  Puedes editar cualquier campo antes de confirmar.
                </p>
              </div>

              {pendingTests.map((test, testIdx) => (
                <div key={testIdx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="mb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="text"
                        value={test.title}
                        onChange={(e) => {
                          const newTests = [...pendingTests]
                          newTests[testIdx].title = e.target.value
                          setPendingTests(newTests)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Título del test"
                      />
                      <button
                        onClick={() => {
                          const newTests = pendingTests.filter((_, i) => i !== testIdx)
                          setPendingTests(newTests)
                        }}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Eliminar test"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-secondary-600 px-3">
                      {test.courseName} → {test.moduleName}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {test.questions.map((q: any, qIdx: number) => (
                      <div key={qIdx} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-sm font-medium text-secondary-500 mt-2">{qIdx + 1}.</span>
                          <input
                            type="text"
                            value={q.question}
                            onChange={(e) => {
                              const newTests = [...pendingTests]
                              newTests[testIdx].questions[qIdx].question = e.target.value
                              setPendingTests(newTests)
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Pregunta"
                          />
                          <button
                            onClick={() => {
                              const newTests = [...pendingTests]
                              newTests[testIdx].questions = newTests[testIdx].questions.filter((_: any, i: number) => i !== qIdx)
                              setPendingTests(newTests)
                            }}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Eliminar pregunta"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-2 pl-6">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const newTests = [...pendingTests]
                                  newTests[testIdx].questions[qIdx].correctAnswer = optIdx
                                  setPendingTests(newTests)
                                }}
                                className={`flex-shrink-0 transition-colors ${
                                  optIdx === q.correctAnswer
                                    ? 'text-green-600'
                                    : 'text-gray-300 hover:text-gray-400'
                                }`}
                              >
                                {optIdx === q.correctAnswer ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                                  </svg>
                                )}
                              </button>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newTests = [...pendingTests]
                                  newTests[testIdx].questions[qIdx].options[optIdx] = e.target.value
                                  setPendingTests(newTests)
                                }}
                                className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                  optIdx === q.correctAnswer
                                    ? 'border-green-300 bg-green-50 font-medium'
                                    : 'border-gray-300'
                                }`}
                                placeholder="Opción"
                              />
                              <button
                                onClick={() => {
                                  const newTests = [...pendingTests]
                                  newTests[testIdx].questions[qIdx].options = newTests[testIdx].questions[qIdx].options.filter((_, i) => i !== optIdx)
                                  // Ajustar correctAnswer si es necesario
                                  if (newTests[testIdx].questions[qIdx].correctAnswer === optIdx) {
                                    newTests[testIdx].questions[qIdx].correctAnswer = 0
                                  } else if (newTests[testIdx].questions[qIdx].correctAnswer > optIdx) {
                                    newTests[testIdx].questions[qIdx].correctAnswer--
                                  }
                                  setPendingTests(newTests)
                                }}
                                className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                title="Eliminar opción"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newTests = [...pendingTests]
                              newTests[testIdx].questions[qIdx].options.push('')
                              setPendingTests(newTests)
                            }}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mt-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            Agregar opción
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
              <button
                onClick={handleCancelTests}
                className="px-5 py-2.5 text-sm font-medium text-secondary-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTests}
                disabled={isCreatingTests}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 rounded-lg transition-all hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isCreatingTests ? (
                  <>
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando Tests...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Confirmar y Crear Tests
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-l-4 ${
            toast.type === 'success' 
              ? 'bg-white border-green-500' 
              : 'bg-white border-red-500'
          }`}>
            {toast.type === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            )}
            <p className={`text-sm font-medium ${
              toast.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {toast.message}
            </p>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  )
}
