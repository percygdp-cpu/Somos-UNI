import { TestResult } from '@/types'

export interface ProgressData {
  completed: number
  total: number
  percentage: number
}

export interface ModuleProgress extends ProgressData {
  testResults: { [testId: number]: TestResult }
}

export interface CourseProgress extends ProgressData {
  moduleProgress: { [moduleId: number]: ModuleProgress }
}

/**
 * Calcula el progreso de un módulo basado en los tests completados
 * Un test se considera completado si tiene un resultado con >= 70%
 */
export function calculateModuleProgress(
  moduleId: number, 
  testIds: number[], 
  userTestResults: TestResult[]
): ModuleProgress {
  const testResultsMap: { [testId: number]: TestResult } = {}
  let completedTests = 0

  testIds.forEach(testId => {
    const latestResult = userTestResults
      .filter(result => parseInt(result.testId) === testId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]

    if (latestResult && latestResult.percentage >= 70) {
      completedTests++
      testResultsMap[testId] = latestResult
    }
  })

  return {
    completed: completedTests,
    total: testIds.length,
    percentage: testIds.length > 0 ? Math.round((completedTests / testIds.length) * 100) : 0,
    testResults: testResultsMap
  }
}

/**
 * Calcula el progreso de un curso basado en los módulos completados
 * Un módulo se considera completado si todos sus tests están completados (>= 70%)
 */
export function calculateCourseProgress(
  courseId: number,
  moduleData: Array<{ id: number; testIds: number[] }>,
  userTestResults: TestResult[]
): CourseProgress {
  const moduleProgressMap: { [moduleId: number]: ModuleProgress } = {}
  let completedModules = 0

  moduleData.forEach(module => {
    const moduleProgress = calculateModuleProgress(module.id, module.testIds, userTestResults)
    moduleProgressMap[module.id] = moduleProgress
    
    if (moduleProgress.percentage === 100) {
      completedModules++
    }
  })

  return {
    completed: completedModules,
    total: moduleData.length,
    percentage: moduleData.length > 0 ? Math.round((completedModules / moduleData.length) * 100) : 0,
    moduleProgress: moduleProgressMap
  }
}

/**
 * Obtiene el resultado más reciente de un test específico para un usuario
 */
export function getLatestTestResult(testId: number, userTestResults: TestResult[]): TestResult | null {
  const results = userTestResults.filter(result => parseInt(result.testId) === testId)
  if (results.length === 0) return null
  
  return results.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
}

/**
 * Verifica si un test está completado (>= 70%)
 */
export function isTestCompleted(testId: number, userTestResults: TestResult[]): boolean {
  const latestResult = getLatestTestResult(testId, userTestResults)
  return latestResult !== null && latestResult.percentage >= 70
}

/**
 * Verifica si un módulo está completado (todos los tests >= 70%)
 */
export function isModuleCompleted(moduleId: number, testIds: number[], userTestResults: TestResult[]): boolean {
  const moduleProgress = calculateModuleProgress(moduleId, testIds, userTestResults)
  return moduleProgress.percentage === 100
}