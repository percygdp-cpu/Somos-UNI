'use client'

import AdminHeader from '@/components/AdminHeader'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import anime from 'animejs'
import { useEffect, useState } from 'react'

interface Student {
  id: number
  name: string
  username: string
  start_date: string | null
  phone: string | null
  guardian_name: string | null
  address: string | null
  billing_id: number | null
  monthly_amount: number | null
  due_day: number | null
  billing_status: string | null
}

interface Invoice {
  id: number
  user_id: number
  user_name: string
  period: string
  amount: number
  due_date: string
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  paid_amount: number
  remaining_amount: number
}

interface Payment {
  id: number
  invoice_id: number
  amount: number
  payment_date: string
  payment_method: string
  notes: string | null
  period: string
  user_name?: string
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'students' | 'invoices' | 'history' | 'payments'>('students')
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([])
  const [loadingAllInvoices, setLoadingAllInvoices] = useState(true)
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [loadingAllPayments, setLoadingAllPayments] = useState(true)
  const [paymentsPeriodFilter, setPaymentsPeriodFilter] = useState('')
  const [paymentsMethodFilter, setPaymentsMethodFilter] = useState('')
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [invoicePayments, setInvoicePayments] = useState<Payment[]>([])
  const [showStudentPaymentsModal, setShowStudentPaymentsModal] = useState(false)
  const [studentPayments, setStudentPayments] = useState<Payment[]>([])
  const [selectedStudentForPayments, setSelectedStudentForPayments] = useState<Student | null>(null)
  const [loadingStudentPayments, setLoadingStudentPayments] = useState(false)
  const [showStudentInvoicesModal, setShowStudentInvoicesModal] = useState(false)
  const [studentInvoices, setStudentInvoices] = useState<Invoice[]>([])
  const [selectedStudentForInvoices, setSelectedStudentForInvoices] = useState<Student | null>(null)
  const [loadingStudentInvoices, setLoadingStudentInvoices] = useState(false)
  
  const [currentPeriod, setCurrentPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [configForm, setConfigForm] = useState({ monthlyAmount: '', dueDay: '5', startDate: '' })
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: '', paymentMethod: 'efectivo', notes: '' })
  
  const [stats, setStats] = useState({ total: 0, pending: 0, partial: 0, paid: 0, overdue: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 })

  useEffect(() => {
    anime({
      targets: '.animate-card',
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(50),
      duration: 400,
      easing: 'easeOutQuart'
    })
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'students') loadStudents()
    else loadInvoices()
  }, [activeTab, currentPeriod, filterStatus])

  const loadStudents = async () => {
    setLoadingStudents(true)
    try {
      const res = await fetch('/api/student-billing?includeWithout=true')
      if (res.ok) setStudents(await res.json())
    } catch (e) { console.error(e) }
    setLoadingStudents(false)
  }

  const loadInvoices = async () => {
    setLoadingInvoices(true)
    try {
      let url = `/api/invoices?period=${currentPeriod}`
      if (filterStatus) url += `&status=${filterStatus}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data)
        setStats({
          total: data.length,
          pending: data.filter((i: Invoice) => i.status === 'pending').length,
          partial: data.filter((i: Invoice) => i.status === 'partial').length,
          paid: data.filter((i: Invoice) => i.status === 'paid').length,
          overdue: data.filter((i: Invoice) => i.status === 'overdue').length,
          totalAmount: data.reduce((s: number, i: Invoice) => s + i.amount, 0),
          paidAmount: data.reduce((s: number, i: Invoice) => s + i.paid_amount, 0),
          pendingAmount: data.reduce((s: number, i: Invoice) => s + (i.amount - i.paid_amount), 0)
        })
      }
    } catch (e) { console.error(e) }
    setLoadingInvoices(false)
  }

  const loadAllInvoices = async () => {
    setLoadingAllInvoices(true)
    try {
      let url = `/api/invoices?`
      if (historyPeriodFilter) url += `period=${historyPeriodFilter}&`
      if (historyStatusFilter) url += `status=${historyStatusFilter}`
      const res = await fetch(url)
      if (res.ok) {
        setAllInvoices(await res.json())
      }
    } catch (e) { console.error(e) }
    setLoadingAllInvoices(false)
  }

  const loadAllPayments = async () => {
    setLoadingAllPayments(true)
    try {
      let url = `/api/payments?`
      if (paymentsPeriodFilter) {
        const [year, month] = paymentsPeriodFilter.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = `${year}-${month}-31`
        url += `startDate=${startDate}&endDate=${endDate}&`
      }
      const res = await fetch(url)
      if (res.ok) {
        let data = await res.json()
        if (paymentsMethodFilter) {
          data = data.filter((p: Payment) => p.payment_method === paymentsMethodFilter)
        }
        setAllPayments(data)
      }
    } catch (e) { console.error(e) }
    setLoadingAllPayments(false)
  }

  const openConfigModal = (student: Student) => {
    setSelectedStudent(student)
    setConfigForm({
      monthlyAmount: student.monthly_amount ? String(student.monthly_amount) : '',
      dueDay: student.due_day ? String(student.due_day) : student.start_date ? String(Math.min(new Date(student.start_date).getDate(), 28)) : '5',
      startDate: student.start_date || new Date().toISOString().split('T')[0]
    })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedStudent) return
    const amount = parseFloat(configForm.monthlyAmount)
    if (isNaN(amount) || amount <= 0) return alert('Ingresa un monto válido')
    
    try {
      const method = selectedStudent.billing_id ? 'PUT' : 'POST'
      const body = selectedStudent.billing_id 
        ? { id: selectedStudent.billing_id, monthlyAmount: amount, dueDay: parseInt(configForm.dueDay) }
        : { userId: selectedStudent.id, monthlyAmount: amount, dueDay: parseInt(configForm.dueDay), startDate: configForm.startDate }
      
      const res = await fetch('/api/student-billing', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { setShowConfigModal(false); loadStudents(); alert('Configuración guardada') }
      else alert((await res.json()).error || 'Error')
    } catch (e) { alert('Error al guardar') }
  }

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPaymentForm({ amount: String(invoice.remaining_amount), paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'efectivo', notes: '' })
    setShowPaymentModal(true)
  }

  const handleRegisterPayment = async () => {
    if (!selectedInvoice) return
    const amount = parseFloat(paymentForm.amount)
    if (isNaN(amount) || amount <= 0) return alert('Ingresa un monto válido')
    
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: selectedInvoice.id, amount, paymentDate: paymentForm.paymentDate, paymentMethod: paymentForm.paymentMethod, notes: paymentForm.notes || null })
      })
      if (res.ok) { setShowPaymentModal(false); loadInvoices(); alert('Pago registrado') }
      else alert((await res.json()).error || 'Error')
    } catch (e) { alert('Error') }
  }

  const openHistory = async (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    try {
      const res = await fetch(`/api/payments?invoiceId=${invoice.id}`)
      if (res.ok) { setInvoicePayments(await res.json()); setShowHistoryModal(true) }
    } catch (e) { console.error(e) }
  }

  const openStudentPayments = async (student: Student) => {
    setSelectedStudentForPayments(student)
    setLoadingStudentPayments(true)
    setShowStudentPaymentsModal(true)
    try {
      const res = await fetch(`/api/payments?userId=${student.id}`)
      if (res.ok) { setStudentPayments(await res.json()) }
    } catch (e) { console.error(e) }
    finally { setLoadingStudentPayments(false) }
  }

  const openStudentInvoices = async (student: Student) => {
    setSelectedStudentForInvoices(student)
    setLoadingStudentInvoices(true)
    setShowStudentInvoicesModal(true)
    try {
      const res = await fetch(`/api/invoices?userId=${student.id}`)
      if (res.ok) { setStudentInvoices(await res.json()) }
    } catch (e) { console.error(e) }
    finally { setLoadingStudentInvoices(false) }
  }

  const deletePayment = async (id: number) => {
    if (!confirm('¿Eliminar este pago?')) return
    try {
      const res = await fetch(`/api/payments?id=${id}`, { method: 'DELETE' })
      if (res.ok) { 
        if (selectedInvoice) {
          const r = await fetch(`/api/payments?invoiceId=${selectedInvoice.id}`)
          if (r.ok) setInvoicePayments(await r.json())
        }
        loadInvoices()
      }
    } catch (e) { console.error(e) }
  }

  const formatPeriod = (p: string) => {
    const [y, m] = p.split('-')
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    return `${months[parseInt(m)-1]} ${y}`
  }

  const periodOptions = () => {
    const opts = []
    const now = new Date()
    for (let i = -12; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      opts.push({ value: v, label: formatPeriod(v) })
    }
    return opts.reverse()
  }

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date().toISOString().split('T')[0]
    const soon = new Date(); soon.setDate(soon.getDate()+5)
    const soonStr = soon.toISOString().split('T')[0]
    
    if (status === 'paid') return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Pagado</span>
    if (status === 'partial') return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Parcial</span>
    if (status === 'overdue' || dueDate <= today) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Vencido</span>
    if (dueDate <= soonStr) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Por vencer</span>
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary-100 text-secondary-600">Pendiente</span>
  }

  const studentsWithBilling = students.filter(s => s.billing_id)
  const studentsWithoutBilling = students.filter(s => !s.billing_id)
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredInvoices = invoices.filter(i => i.user_name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-secondary-50">
        <AdminHeader />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="animate-card mb-6">
            <h1 className="text-3xl font-bold text-secondary-900">Gestión de Cobranza</h1>
            <p className="text-secondary-600 mt-1">Administra pagos mensuales de estudiantes</p>
          </div>

          {/* Tabs */}
          <div className="animate-card flex border-b border-secondary-200 mb-6">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'students' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Estudiantes
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'invoices' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Cuotas del Mes
            </button>
            <button
              onClick={() => { setActiveTab('history'); loadAllInvoices() }}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'history' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Historial de Cuotas
            </button>
            <button
              onClick={() => { setActiveTab('payments'); loadAllPayments() }}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'payments' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Historial de Pagos
            </button>
          </div>

          {/* Tab: Estudiantes */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              {/* Búsqueda */}
              <div className="animate-card">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar estudiante..."
                  className="w-full md:w-80 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Alerta: Sin configuración */}
              {studentsWithoutBilling.length > 0 && (
                <div className="animate-card bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <div>
                      <h3 className="font-medium text-yellow-800">{studentsWithoutBilling.length} estudiante(s) sin configuración de pago</h3>
                      <p className="text-sm text-yellow-700 mt-1">Configura el monto mensual para generar cuotas automáticamente.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Estudiantes */}
              <div className="animate-card bg-white rounded-lg shadow-sm border border-secondary-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-secondary-200">
                  <h2 className="text-lg font-semibold text-secondary-900">
                    Información de Estudiantes y Pagos
                  </h2>
                </div>

                {loadingStudents ? (
                  <div className="p-8 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-secondary-500">
                    No se encontraron estudiantes
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50 border-b border-secondary-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Estudiante</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Fecha Inicio</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Apoderado</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Teléfono</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Monto Mensual</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Día Pago</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Estado</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100">
                        {filteredStudents.map(student => (
                          <tr key={student.id} className="hover:bg-secondary-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-secondary-900">{student.name}</div>
                              <div className="text-sm text-secondary-500">@{student.username}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-600">
                              {student.start_date ? new Date(student.start_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : <span className="text-secondary-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-600">
                              {student.guardian_name || <span className="text-secondary-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-600">
                              {student.phone || <span className="text-secondary-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {student.monthly_amount ? (
                                <span className="font-medium text-secondary-900">S/ {student.monthly_amount.toFixed(2)}</span>
                              ) : (
                                <span className="text-yellow-600 text-sm font-medium">Sin configurar</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-secondary-600">
                              {student.due_day ? `Día ${student.due_day}` : <span className="text-secondary-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {student.billing_id ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Activo</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Pendiente</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openConfigModal(student)}
                                  className="px-2 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                                  title="Configurar facturación"
                                >
                                  {student.billing_id ? 'Editar' : 'Configurar'}
                                </button>
                                {student.billing_id && (
                                  <>
                                    <button
                                      onClick={() => openStudentInvoices(student)}
                                      className="px-2 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Ver historial de cuotas"
                                    >
                                      Cuotas
                                    </button>
                                    <button
                                      onClick={() => openStudentPayments(student)}
                                      className="px-2 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                                      title="Ver historial de pagos"
                                    >
                                      Pagos
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Cuotas */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-secondary-900">S/ {stats.totalAmount.toFixed(2)}</div>
                  <div className="text-sm text-secondary-500">Total a cobrar</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-green-600">S/ {stats.paidAmount.toFixed(2)}</div>
                  <div className="text-sm text-secondary-500">Cobrado</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-yellow-600">S/ {stats.pendingAmount.toFixed(2)}</div>
                  <div className="text-sm text-secondary-500">Pendiente</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="flex items-center gap-2 text-lg">
                    <span className="font-bold text-green-600">{stats.paid}</span>
                    <span className="text-secondary-300">/</span>
                    <span className="font-bold text-yellow-600">{stats.pending + stats.partial}</span>
                    <span className="text-secondary-300">/</span>
                    <span className="font-bold text-red-600">{stats.overdue}</span>
                  </div>
                  <div className="text-sm text-secondary-500">Pagados / Pend / Venc</div>
                </div>
              </div>

              {/* Filtros */}
              <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Período</label>
                    <select
                      value={currentPeriod}
                      onChange={(e) => setCurrentPeriod(e.target.value)}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {periodOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Estado</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Todos</option>
                      <option value="pending">Pendiente</option>
                      <option value="partial">Parcial</option>
                      <option value="paid">Pagado</option>
                      <option value="overdue">Vencido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Buscar</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nombre del alumno..."
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tabla de Cuotas */}
              <div className="animate-card bg-white rounded-lg shadow-sm overflow-hidden border border-secondary-200">
                {loadingInvoices ? (
                  <div className="p-8 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="p-8 text-center text-secondary-500">
                    <p>No hay cuotas para este período</p>
                    <p className="text-sm mt-1">Configura los pagos de estudiantes primero</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50 border-b border-secondary-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Alumno</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Vencimiento</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Monto</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Pagado</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Saldo</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Estado</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100">
                        {filteredInvoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-secondary-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-secondary-900">{inv.user_name}</td>
                            <td className="px-4 py-3 text-sm text-secondary-600">{new Date(inv.due_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</td>
                            <td className="px-4 py-3 text-right font-medium text-secondary-900">S/ {inv.amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-green-600">S/ {inv.paid_amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-medium text-yellow-600">S/ {inv.remaining_amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">{getStatusBadge(inv.status, inv.due_date)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {inv.status !== 'paid' && (
                                  <button
                                    onClick={() => openPaymentModal(inv)}
                                    className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                  >
                                    Pagar
                                  </button>
                                )}
                                <button
                                  onClick={() => openHistory(inv)}
                                  className="px-3 py-1.5 text-sm font-medium text-secondary-600 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                                >
                                  Ver
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Historial de Cuotas */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Filtros */}
              <div className="animate-card bg-white rounded-lg shadow-sm border border-secondary-200 p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Período</label>
                    <select
                      value={historyPeriodFilter}
                      onChange={(e) => { setHistoryPeriodFilter(e.target.value); setTimeout(loadAllInvoices, 100) }}
                      className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Todos los períodos</option>
                      {periodOptions().map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Estado</label>
                    <select
                      value={historyStatusFilter}
                      onChange={(e) => { setHistoryStatusFilter(e.target.value); setTimeout(loadAllInvoices, 100) }}
                      className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Todos</option>
                      <option value="paid">Pagadas</option>
                      <option value="pending">Pendientes</option>
                      <option value="partial">Parciales</option>
                      <option value="overdue">Vencidas</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar estudiante..."
                      className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-secondary-900">{allInvoices.length}</div>
                  <div className="text-sm text-secondary-500">Total cuotas</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-green-600">{allInvoices.filter(i => i.status === 'paid').length}</div>
                  <div className="text-sm text-secondary-500">Pagadas</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-yellow-600">{allInvoices.filter(i => i.status === 'pending').length}</div>
                  <div className="text-sm text-secondary-500">Pendientes</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-blue-600">{allInvoices.filter(i => i.status === 'partial').length}</div>
                  <div className="text-sm text-secondary-500">Parciales</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-red-600">{allInvoices.filter(i => i.status === 'overdue').length}</div>
                  <div className="text-sm text-secondary-500">Vencidas</div>
                </div>
              </div>

              {/* Tabla */}
              <div className="animate-card bg-white rounded-lg shadow-sm border border-secondary-200 overflow-hidden">
                {loadingAllInvoices ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-secondary-600 mt-2">Cargando historial...</p>
                  </div>
                ) : allInvoices.length === 0 ? (
                  <div className="p-8 text-center text-secondary-500">
                    No hay cuotas registradas
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50 border-b border-secondary-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Estudiante</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Período</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Vencimiento</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase tracking-wider">Monto</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase tracking-wider">Pagado</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase tracking-wider">Pendiente</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase tracking-wider">Estado</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100">
                        {allInvoices
                          .filter(i => i.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(inv => (
                          <tr key={inv.id} className="hover:bg-secondary-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-secondary-900">{inv.user_name}</td>
                            <td className="px-4 py-3 text-sm text-secondary-700">{formatPeriod(inv.period)}</td>
                            <td className="px-4 py-3 text-sm text-secondary-600">{new Date(inv.due_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</td>
                            <td className="px-4 py-3 text-right font-medium text-secondary-900">S/ {inv.amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-green-600">S/ {inv.paid_amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-medium text-yellow-600">S/ {inv.remaining_amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">{getStatusBadge(inv.status, inv.due_date)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {inv.status !== 'paid' && (
                                  <button
                                    onClick={() => openPaymentModal(inv)}
                                    className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                  >
                                    Pagar
                                  </button>
                                )}
                                <button
                                  onClick={() => openHistory(inv)}
                                  className="px-3 py-1.5 text-sm font-medium text-secondary-600 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                                >
                                  Ver
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Historial de Pagos */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Filtros */}
              <div className="animate-card bg-white rounded-lg shadow-sm border border-secondary-200 p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Período</label>
                    <select
                      value={paymentsPeriodFilter}
                      onChange={(e) => { setPaymentsPeriodFilter(e.target.value); setTimeout(loadAllPayments, 100) }}
                      className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Todos los períodos</option>
                      {periodOptions().map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Método de Pago</label>
                    <select
                      value={paymentsMethodFilter}
                      onChange={(e) => { setPaymentsMethodFilter(e.target.value); setTimeout(loadAllPayments, 100) }}
                      className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Todos</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="yape">Yape/Plin</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar estudiante..."
                      className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-secondary-900">{allPayments.length}</div>
                  <div className="text-sm text-secondary-500">Total pagos</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-green-600">
                    S/ {allPayments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-secondary-500">Monto total</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-green-600">
                    {allPayments.filter(p => p.payment_method === 'efectivo').length}
                  </div>
                  <div className="text-sm text-secondary-500">En efectivo</div>
                </div>
                <div className="animate-card bg-white rounded-lg shadow-sm p-4 border border-secondary-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {allPayments.filter(p => p.payment_method === 'yape' || p.payment_method === 'transferencia').length}
                  </div>
                  <div className="text-sm text-secondary-500">Digitales</div>
                </div>
              </div>

              {/* Tabla */}
              <div className="animate-card bg-white rounded-lg shadow-sm border border-secondary-200 overflow-hidden">
                {loadingAllPayments ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-secondary-600 mt-2">Cargando pagos...</p>
                  </div>
                ) : allPayments.length === 0 ? (
                  <div className="p-8 text-center text-secondary-500">
                    No hay pagos registrados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50 border-b border-secondary-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Estudiante</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Período</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase tracking-wider">Monto</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase tracking-wider">Método</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100">
                        {allPayments
                          .filter(p => (p.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(payment => (
                          <tr key={payment.id} className="hover:bg-secondary-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-secondary-900">
                              {new Date(payment.payment_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
                            </td>
                            <td className="px-4 py-3 font-medium text-secondary-900">{payment.user_name}</td>
                            <td className="px-4 py-3 text-sm text-secondary-700">{formatPeriod(payment.period)}</td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">S/ {Number(payment.amount).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                payment.payment_method === 'efectivo' ? 'bg-green-100 text-green-700' :
                                payment.payment_method === 'transferencia' ? 'bg-blue-100 text-blue-700' :
                                payment.payment_method === 'yape' ? 'bg-purple-100 text-purple-700' :
                                'bg-secondary-100 text-secondary-700'
                              }`}>
                                {payment.payment_method === 'efectivo' ? 'Efectivo' :
                                 payment.payment_method === 'transferencia' ? 'Transferencia' :
                                 payment.payment_method === 'yape' ? 'Yape/Plin' :
                                 payment.payment_method === 'tarjeta' ? 'Tarjeta' :
                                 payment.payment_method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-500 max-w-xs truncate">
                              {payment.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Modal: Configurar Pago */}
        {showConfigModal && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
              <div className="bg-primary-600 px-6 py-4 rounded-t-xl">
                <h2 className="text-lg font-bold text-white">
                  {selectedStudent.billing_id ? 'Editar Configuración de Pago' : 'Configurar Pago'}
                </h2>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Datos del Estudiante (solo lectura) */}
                <div className="bg-secondary-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-secondary-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Datos del Estudiante
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-secondary-500">Nombre:</span>
                      <span className="ml-2 font-medium text-secondary-900">{selectedStudent.name}</span>
                    </div>
                    <div>
                      <span className="text-secondary-500">Usuario:</span>
                      <span className="ml-2 font-medium text-secondary-900">@{selectedStudent.username}</span>
                    </div>
                    <div>
                      <span className="text-secondary-500">Fecha inicio:</span>
                      <span className="ml-2 font-medium text-secondary-900">
                        {selectedStudent.start_date ? new Date(selectedStudent.start_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-secondary-500">Teléfono:</span>
                      <span className="ml-2 font-medium text-secondary-900">{selectedStudent.phone || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-secondary-500">Apoderado:</span>
                      <span className="ml-2 font-medium text-secondary-900">{selectedStudent.guardian_name || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Configuración de Pago */}
                <div>
                  <h3 className="text-sm font-semibold text-secondary-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Configuración de Pago
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Monto Mensual (S/) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={configForm.monthlyAmount}
                        onChange={(e) => setConfigForm({...configForm, monthlyAmount: e.target.value})}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Ej: 250.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">
                        Día de Primer Pago
                      </label>
                      <select
                        value={configForm.dueDay}
                        onChange={(e) => setConfigForm({...configForm, dueDay: e.target.value})}
                        className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>Día {d} de cada mes</option>)}
                      </select>
                      <p className="text-xs text-secondary-500 mt-1">Calculado desde la fecha de primera clase</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 bg-secondary-50 rounded-b-xl">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg font-medium hover:bg-secondary-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Registrar Pago */}
        {showPaymentModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
              <div className="bg-green-600 px-6 py-4 rounded-t-xl">
                <h2 className="text-lg font-bold text-white">Registrar Pago</h2>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-secondary-50 rounded-lg p-4">
                  <div className="font-medium text-secondary-900">{selectedInvoice.user_name}</div>
                  <div className="text-sm text-secondary-600">{formatPeriod(selectedInvoice.period)}</div>
                  <div className="text-sm mt-2">
                    Pendiente: <span className="font-semibold text-yellow-600">S/ {selectedInvoice.remaining_amount.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Monto a pagar (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Fecha de pago</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({...paymentForm, paymentDate: e.target.value})}
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Método de pago</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="yape_plin">Yape / Plin</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Notas (opcional)</label>
                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Recibo, referencia..."
                  />
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 bg-secondary-50 rounded-b-xl">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg font-medium hover:bg-secondary-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Historial de Pagos */}
        {showHistoryModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
              <div className="bg-secondary-700 px-6 py-4 rounded-t-xl">
                <h2 className="text-lg font-bold text-white">Historial de Pagos</h2>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="bg-secondary-50 rounded-lg p-4 mb-4">
                  <div className="font-medium text-secondary-900">{selectedInvoice.user_name}</div>
                  <div className="text-sm text-secondary-600">{formatPeriod(selectedInvoice.period)}</div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span>Total: S/ {selectedInvoice.amount.toFixed(2)}</span>
                    <span className="text-green-600">Pagado: S/ {selectedInvoice.paid_amount.toFixed(2)}</span>
                  </div>
                </div>

                {invoicePayments.length === 0 ? (
                  <div className="text-center py-8 text-secondary-500">
                    Sin pagos registrados
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoicePayments.map(p => (
                      <div key={p.id} className="border border-secondary-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-green-600">S/ {p.amount.toFixed(2)}</div>
                            <div className="text-sm text-secondary-500">{new Date(p.payment_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
                            <div className="text-sm text-secondary-500 capitalize">{p.payment_method.replace('_', ' / ')}</div>
                            {p.notes && <div className="text-sm text-secondary-400 mt-1">{p.notes}</div>}
                          </div>
                          <button
                            onClick={() => deletePayment(p.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-secondary-50 rounded-b-xl">
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg font-medium hover:bg-secondary-100 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Historial de pagos del estudiante */}
        {showStudentPaymentsModal && selectedStudentForPayments && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-secondary-200 bg-secondary-50">
                <h2 className="text-xl font-bold text-secondary-900">Historial de Pagos</h2>
                <p className="text-sm text-secondary-600 mt-1">{selectedStudentForPayments.name}</p>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loadingStudentPayments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-secondary-600 mt-2">Cargando...</p>
                  </div>
                ) : studentPayments.length === 0 ? (
                  <div className="text-center py-8 text-secondary-500">
                    <svg className="w-12 h-12 mx-auto text-secondary-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    No hay pagos registrados para este estudiante
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Resumen */}
                    <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-primary-600">Total pagado</p>
                          <p className="text-2xl font-bold text-primary-700">
                            S/ {studentPayments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-primary-600">Pagos realizados</p>
                          <p className="text-2xl font-bold text-primary-700">{studentPayments.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* Lista de pagos */}
                    <div className="border border-secondary-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-secondary-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Fecha</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Período</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Monto</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Método</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100">
                          {studentPayments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-secondary-50">
                              <td className="px-4 py-3 text-sm text-secondary-900">
                                {new Date(payment.payment_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
                              </td>
                              <td className="px-4 py-3 text-sm text-secondary-600">
                                {formatPeriod(payment.period)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                                S/ {Number(payment.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  payment.payment_method === 'efectivo' ? 'bg-green-100 text-green-700' :
                                  payment.payment_method === 'transferencia' ? 'bg-blue-100 text-blue-700' :
                                  payment.payment_method === 'yape' ? 'bg-purple-100 text-purple-700' :
                                  'bg-secondary-100 text-secondary-700'
                                }`}>
                                  {payment.payment_method === 'efectivo' ? 'Efectivo' :
                                   payment.payment_method === 'transferencia' ? 'Transferencia' :
                                   payment.payment_method === 'yape' ? 'Yape/Plin' :
                                   payment.payment_method === 'tarjeta' ? 'Tarjeta' :
                                   payment.payment_method}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-secondary-50 rounded-b-xl">
                <button
                  onClick={() => setShowStudentPaymentsModal(false)}
                  className="w-full px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg font-medium hover:bg-secondary-100 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Historial de cuotas del estudiante */}
        {showStudentInvoicesModal && selectedStudentForInvoices && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-secondary-200 bg-secondary-50">
                <h2 className="text-xl font-bold text-secondary-900">Historial de Cuotas</h2>
                <p className="text-sm text-secondary-600 mt-1">{selectedStudentForInvoices.name}</p>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loadingStudentInvoices ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-secondary-600 mt-2">Cargando...</p>
                  </div>
                ) : studentInvoices.length === 0 ? (
                  <div className="text-center py-8 text-secondary-500">
                    <svg className="w-12 h-12 mx-auto text-secondary-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    No hay cuotas registradas para este estudiante
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Resumen */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <p className="text-sm text-green-600">Pagadas</p>
                        <p className="text-2xl font-bold text-green-700">
                          {studentInvoices.filter(i => i.status === 'paid').length}
                        </p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                        <p className="text-sm text-yellow-600">Pendientes</p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {studentInvoices.filter(i => i.status === 'pending' || i.status === 'partial').length}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                        <p className="text-sm text-red-600">Vencidas</p>
                        <p className="text-2xl font-bold text-red-700">
                          {studentInvoices.filter(i => i.status === 'overdue').length}
                        </p>
                      </div>
                    </div>

                    {/* Totales */}
                    <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-primary-600">Total pagado</p>
                          <p className="text-xl font-bold text-green-700">
                            S/ {studentInvoices.reduce((sum, i) => sum + Number(i.paid_amount), 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-primary-600">Pendiente de pago</p>
                          <p className="text-xl font-bold text-yellow-700">
                            S/ {studentInvoices.reduce((sum, i) => sum + Number(i.remaining_amount), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Lista de cuotas */}
                    <div className="border border-secondary-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-secondary-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-600 uppercase">Período</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Monto</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Pagado</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-600 uppercase">Pendiente</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Vencimiento</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-secondary-600 uppercase">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100">
                          {studentInvoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-secondary-50">
                              <td className="px-4 py-3 text-sm font-medium text-secondary-900">
                                {formatPeriod(invoice.period)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-secondary-700">
                                S/ {Number(invoice.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                                S/ {Number(invoice.paid_amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-yellow-600">
                                S/ {Number(invoice.remaining_amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-secondary-600">
                                {new Date(invoice.due_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                                  invoice.status === 'partial' ? 'bg-blue-100 text-blue-700' :
                                  invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {invoice.status === 'paid' ? 'Pagada' :
                                   invoice.status === 'partial' ? 'Parcial' :
                                   invoice.status === 'overdue' ? 'Vencida' :
                                   'Pendiente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-secondary-50 rounded-b-xl">
                <button
                  onClick={() => setShowStudentInvoicesModal(false)}
                  className="w-full px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg font-medium hover:bg-secondary-100 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
