-- Turso/SQLite Schema
-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  -- Campos adicionales para estudiantes
  start_date TEXT,              -- Fecha de inicio de clases (obligatorio para estudiantes)
  phone TEXT,                   -- Teléfono de contacto (opcional)
  guardian_name TEXT,           -- Nombre del apoderado (opcional)
  address TEXT,                 -- Domicilio (opcional)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabla de cursos
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabla de módulos
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL,
  pdf_files TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Tabla de tests
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  module_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- Tabla de preguntas
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  "order" INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Tabla de resultados de tests
CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  answers TEXT NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Tabla de frases motivacionales
CREATE TABLE IF NOT EXISTS motivational_phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phrase TEXT NOT NULL,
  range_type TEXT NOT NULL CHECK (range_type IN ('0-30', '31-50', '51-70', '71-90', '91-100')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabla de historial de frases usadas por usuario
CREATE TABLE IF NOT EXISTS user_phrase_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phrase_id INTEGER NOT NULL,
  used_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (phrase_id) REFERENCES motivational_phrases(id) ON DELETE CASCADE
);

-- Tabla de metas semanales (no ligada a un curso específico)
CREATE TABLE IF NOT EXISTS weekly_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabla de tests asociados a metas semanales
CREATE TABLE IF NOT EXISTS weekly_goal_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_goal_id INTEGER NOT NULL,
  test_id INTEGER NOT NULL,
  FOREIGN KEY (weekly_goal_id) REFERENCES weekly_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  UNIQUE(weekly_goal_id, test_id)
);

-- Tabla de asignación de metas semanales a usuarios
CREATE TABLE IF NOT EXISTS user_weekly_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  weekly_goal_id INTEGER NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (weekly_goal_id) REFERENCES weekly_goals(id) ON DELETE CASCADE,
  UNIQUE(user_id, weekly_goal_id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_tests_course_id ON tests(course_id);
CREATE INDEX IF NOT EXISTS idx_tests_module_id ON tests(module_id);
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_motivational_phrases_range ON motivational_phrases(range_type);
CREATE INDEX IF NOT EXISTS idx_user_phrase_history_user ON user_phrase_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phrase_history_phrase ON user_phrase_history(phrase_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goal_tests_goal ON weekly_goal_tests(weekly_goal_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goal_tests_test ON weekly_goal_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_user_weekly_goals_user ON user_weekly_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weekly_goals_goal ON user_weekly_goals(weekly_goal_id);

-- Tabla de pizarras digitales
CREATE TABLE IF NOT EXISTS whiteboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '[]',
  thumbnail TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whiteboards_created_by ON whiteboards(created_by);

-- Tabla de configuración de facturación por estudiante
CREATE TABLE IF NOT EXISTS student_billing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  monthly_amount REAL NOT NULL,           -- Monto mensual a pagar
  due_day INTEGER NOT NULL DEFAULT 5,     -- Día del mes que vence (1-28)
  start_date TEXT NOT NULL,               -- Fecha de inicio de facturación
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'completed')) DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de cuotas mensuales
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  period TEXT NOT NULL,                   -- Periodo en formato YYYY-MM
  amount REAL NOT NULL,                   -- Monto de la cuota
  due_date TEXT NOT NULL,                 -- Fecha de vencimiento
  status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'paid', 'overdue')) DEFAULT 'pending',
  paid_amount REAL DEFAULT 0,             -- Monto pagado (para pagos parciales)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, period)
);

-- Tabla de pagos realizados
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL,                   -- Monto del pago
  payment_date TEXT NOT NULL,             -- Fecha del pago
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'transferencia', 'yape_plin', 'otro')),
  notes TEXT,                             -- Notas adicionales
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Índices para cobranza
CREATE INDEX IF NOT EXISTS idx_student_billing_user ON student_billing(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Datos iniciales (admin y algunos datos de prueba)
INSERT OR IGNORE INTO users (name, username, password, role, status) 
VALUES ('Administrador', 'admin', 'admin123', 'admin', 'active');

INSERT OR IGNORE INTO users (name, username, password, role, status) 
VALUES ('Estudiante Demo', 'estudiante', 'est123', 'student', 'active');
