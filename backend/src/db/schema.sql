-- ============================================================
-- PREVITA OHP — Schema MySQL
-- Ejecutar como: mysql -h HOST -u USER -p previta_ohp < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS previta_ohp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE previta_ohp;

-- -------------------------------------------------------
-- Usuarios del sistema (médicos, enfermeras, admin)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','doctor','nurse','viewer') NOT NULL DEFAULT 'doctor',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  last_login    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_active (active)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Trabajadores / empleados
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
  id                      CHAR(36)     NOT NULL PRIMARY KEY,
  employee_id             VARCHAR(30)  NOT NULL UNIQUE,
  name                    VARCHAR(150) NOT NULL,
  date_birth              DATE         NULL,
  gender                  ENUM('masculino','femenino','otro') NULL,
  department              VARCHAR(100) NULL,
  position                VARCHAR(100) NULL,
  date_hired              DATE         NULL,
  risk_level              ENUM('bajo','medio','alto') NOT NULL DEFAULT 'bajo',
  blood_type              VARCHAR(5)   NULL,
  allergies               TEXT         NULL,
  chronic_conditions      TEXT         NULL,
  emergency_contact_name  VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(30)  NULL,
  status                  ENUM('active','inactive','leave') NOT NULL DEFAULT 'active',
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_workers_status (status),
  INDEX idx_workers_department (department),
  INDEX idx_workers_employee_id (employee_id),
  FULLTEXT INDEX ft_workers_name (name)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Evaluaciones médicas
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluations (
  id                   CHAR(36)     NOT NULL PRIMARY KEY,
  worker_id            CHAR(36)     NOT NULL,
  doctor_id            CHAR(36)     NULL,
  type                 ENUM('ingreso','periodico','reingreso','egreso','especial') NOT NULL,
  date                 DATE         NOT NULL,
  -- Signos vitales y biometría
  weight               DECIMAL(5,2) NULL COMMENT 'kg',
  height               DECIMAL(5,2) NULL COMMENT 'cm',
  blood_pressure_sys   SMALLINT     NULL,
  blood_pressure_dia   SMALLINT     NULL,
  heart_rate           SMALLINT     NULL,
  glucose              DECIMAL(6,2) NULL COMMENT 'mg/dL',
  -- Estudios especiales
  visual_acuity_right  VARCHAR(10)  NULL,
  visual_acuity_left   VARCHAR(10)  NULL,
  audiometry_right     DECIMAL(5,2) NULL COMMENT 'dB promedio',
  audiometry_left      DECIMAL(5,2) NULL,
  spirometry_fvc       DECIMAL(5,2) NULL COMMENT '% predicho',
  spirometry_fev1      DECIMAL(5,2) NULL COMMENT '% predicho',
  -- Diagnóstico
  diagnosis            TEXT         NULL,
  recommendations      TEXT         NULL,
  restrictions         TEXT         NULL,
  fitness_status       ENUM('apto','apto_con_restricciones','no_apto','pendiente') NOT NULL DEFAULT 'apto',
  notes                TEXT         NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_eval_worker (worker_id),
  INDEX idx_eval_date (date),
  INDEX idx_eval_type (type)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Accidentes de trabajo
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS accidents (
  id                   CHAR(36)      NOT NULL PRIMARY KEY,
  worker_id            CHAR(36)      NOT NULL,
  reported_by          CHAR(36)      NULL,
  date                 DATE          NOT NULL,
  type                 ENUM('caida','golpe','corte','quemadura','exposicion_quimica',
                            'sobreesfuerzo','accidente_vial','otro') NOT NULL,
  description          TEXT          NULL,
  body_part            VARCHAR(100)  NULL,
  days_lost            SMALLINT      NOT NULL DEFAULT 0,
  severity             ENUM('leve','moderado','grave','fatal') NOT NULL DEFAULT 'leve',
  investigation_notes  TEXT          NULL,
  status               ENUM('abierto','en_investigacion','cerrado') NOT NULL DEFAULT 'abierto',
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_acc_worker (worker_id),
  INDEX idx_acc_date (date),
  INDEX idx_acc_status (status)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Documentos clínicos
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  worker_id    CHAR(36)     NOT NULL,
  uploaded_by  CHAR(36)     NULL,
  type         VARCHAR(60)  NOT NULL,
  title        VARCHAR(200) NOT NULL,
  file_url     VARCHAR(500) NULL COMMENT 'URL en S3 o ruta interna',
  notes        TEXT         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_doc_worker (worker_id)
) ENGINE=InnoDB;

-- ============================================================
-- Datos iniciales: usuario administrador
-- Contraseña: Admin1234!  (cámbiala inmediatamente)
-- Hash bcrypt rounds=12
-- ============================================================
INSERT IGNORE INTO users (id, name, email, password_hash, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'admin@previta.org',
  '$2a$12$KIXBxM8L.dq7qTQVAd3V4.PVBElxiTz8gXYFW0vv3KqGW2HM3VrCy',
  'admin'
);
