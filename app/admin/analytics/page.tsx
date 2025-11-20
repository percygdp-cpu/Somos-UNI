'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import AdminHeader from '@/components/AdminHeader'
import { mockUsers, mockCourses, mockTestResults } from '@/data/mockData'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'
import anime from 'animejs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalCourses: 0,
    totalTests: 0,
    averageScore: 0
  })

  useEffect(() => {
    // Calcular estadísticas
    const activeUsers = mockUsers.filter(u => u.status === 'active').length
    const totalTests = mockTestResults.length
    const averageScore = totalTests > 0 
      ? mockTestResults.reduce((acc, result) => acc + result.percentage, 0) / totalTests 
      : 0

    setStats({
      totalUsers: mockUsers.length,
      activeUsers,
      totalCourses: mockCourses.length,
      totalTests,
      averageScore: Math.round(averageScore)
    })
  }, [])

  useEffect(() => {
    // Animar gráficos
    anime({
      targets: '.chart-container',
      translateY: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(200),
      duration: 800,
      easing: 'easeOutQuart'
    })
  }, [])

  // Datos para gráfico de barras - Rendimiento por curso
  const coursePerformanceData = {
    labels: mockCourses.map(course => course.title),
    datasets: [
      {
        label: 'Estudiantes Inscritos',
        data: mockCourses.map(() => Math.floor(Math.random() * 50) + 10),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
      {
        label: 'Tests Completados',
        data: mockCourses.map(() => Math.floor(Math.random() * 30) + 5),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
    ],
  }

  // Datos para gráfico de dona - Distribución de usuarios por rol
  const userRoleData = {
    labels: ['Estudiantes', 'Administradores'],
    datasets: [
      {
        data: [
          mockUsers.filter(u => u.role === 'student').length,
          mockUsers.filter(u => u.role === 'admin').length
        ],
        backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderColor: ['rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)'],
        borderWidth: 2,
      },
    ],
  }

  // Datos para gráfico de línea - Rendimiento en el tiempo
  const performanceTimelineData = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Promedio de Notas (%)',
        data: [75, 82, 78, 85, 88, 92],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50">
        <AdminHeader />
        <div className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-secondary-900 mb-2">
              Análisis y Reportes
            </h1>
            <p className="text-secondary-600 text-lg">
              Estadísticas detalladas del rendimiento y uso del sistema
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Total Usuarios</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.totalUsers}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-2xl">👥</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Usuarios Activos</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.activeUsers}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-2xl">✅</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Tests Completados</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.totalTests}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-2xl">📝</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Promedio General</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.averageScore}%</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 text-2xl">📊</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Rendimiento por Curso */}
            <div className="chart-container card">
              <h3 className="text-xl font-semibold text-secondary-900 mb-4">
                Rendimiento por Curso
              </h3>
              <Bar 
                data={coursePerformanceData} 
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    title: {
                      display: true,
                      text: 'Estudiantes inscritos vs Tests completados'
                    }
                  }
                }} 
              />
            </div>

            {/* Distribución de Usuarios */}
            <div className="chart-container card">
              <h3 className="text-xl font-semibold text-secondary-900 mb-4">
                Distribución de Usuarios
              </h3>
              <Doughnut 
                data={userRoleData} 
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                    },
                    title: {
                      display: true,
                      text: 'Usuarios por Rol'
                    }
                  },
                }}
              />
            </div>
          </div>

          {/* Rendimiento en el Tiempo */}
          <div className="chart-container card mb-8">
            <h3 className="text-xl font-semibold text-secondary-900 mb-4">
              Rendimiento en el Tiempo
            </h3>
            <Line 
              data={performanceTimelineData} 
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    display: true,
                    text: 'Evolución del promedio de notas'
                  }
                }
              }} 
            />
          </div>

          {/* Tabla de Estudiantes Destacados */}
          <div className="card">
            <h3 className="text-xl font-semibold text-secondary-900 mb-4">
              Estudiantes Destacados
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                      Estudiante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                      Tests Completados
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                      Promedio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                      Último Acceso
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-secondary-200">
                  {mockUsers
                    .filter(user => user.role === 'student' && user.status === 'active')
                    .slice(0, 5)
                    .map((student) => {
                      const studentResults = mockTestResults.filter(r => r.userId === student.id)
                      const averageScore = studentResults.length > 0 
                        ? Math.round(studentResults.reduce((acc, r) => acc + r.percentage, 0) / studentResults.length)
                        : 0
                      
                      return (
                        <tr key={student.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-secondary-900">
                              {student.username}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                            {studentResults.length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              averageScore >= 80 
                                ? 'bg-green-100 text-green-800' 
                                : averageScore >= 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {averageScore}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                            {student.updatedAt.toLocaleDateString()}
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}