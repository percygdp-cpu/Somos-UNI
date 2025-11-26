-- Migración: Agregar columna explanation a la tabla questions
-- Ejecutar este script en la base de datos de Turso

ALTER TABLE questions ADD COLUMN explanation TEXT;
