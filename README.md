<p align="center">
  <img src="assets/logo-cebas48.png" alt="CEBAS" width="80" height="80" style="border-radius:12px;object-fit:contain;">
</p>

<h1 align="center">CEBAS - Sistema de Control de Asistencia</h1>

<p align="center">
  Aplicación web SPA para el registro y seguimiento de asistencia de alumnos,<br>
  diseñada para funcionar de forma óptima en dispositivos móviles.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Estado-En%20Desarrollo-2E9CCA?style=for-the-badge" alt="Estado">
  <img src="https://img.shields.io/badge/Plataforma-GitHub%20Pages-0E2F44?style=for-the-badge" alt="Plataforma">
  <img src="https://img.shields.io/badge/Base%20de%20Datos-Supabase-3ECF8E?style=for-the-badge" alt="Supabase">
</p>

---

## Demo en vivo

**[https://nsorribas.github.io/AsistenciaCEBAS/](https://nsorribas.github.io/AsistenciaCEBAS/)**

---

## Funcionalidades

### Gestión de Alumnos
- Alta individual con datos completos (apellido, nombre, DNI, curso, estado, fechas de ingreso/egreso)
- Importación masiva desde archivo **XLSX** (Excel)
- Búsqueda y filtros por curso y estado (activo/inactivo)
- Activar/desactivar alumnos sin perder el historial

### Toma de Asistencia
- Selección de curso y fecha
- Toggle **Presente/Ausente** por alumno (optimizado para uso en celular)
- Campos de **Hora de Entrada** y **Hora de Salida** por alumno (se completan automáticamente según el horario del curso)
- Cálculo automático de presencia por hora cátedra con la **regla del 70%**
- Resumen en tiempo real de horas presentes/ausentes por alumno
- Botones de "Todos Presentes" y "Todos Ausentes"
- Contabilización automática por **hora cátedra** según el horario del curso
- Detección automática de **recreos** (no computan inasistencias) y **horas libres**
- Detección de **feriados** y **ausencias de docentes** (no computan inasistencias)

### Horarios Escolares
- Configuración del horario anual por curso y por día
- Grilla visual con las materias asignadas a cada hora
- Carga predefinida del horario para los cursos 1A, 2A y 3A
- Edición individual de cada celda del horario
- Horas libres y recreos correctamente diferenciados

### Reportes

#### Planilla Mensual
Grilla mensual tipo planilla escolar, similar al formato manual de papel. Cada fila es un alumno y cada columna es un día hábil del mes seleccionado.

**Estructura de la grilla:**
- 3 filas de encabezado: nombre del mes, día de la semana (Lun/Mar/Mié/Jue/Vie), número de día
- Columnas fijas: **Nro** (orden alfabético) y **Apellido y Nombre** (sticky al hacer scroll)
- Columnas de días: solo días hábiles (Lun-Vie), sin sábados ni domingos

**Contenido de cada celda según condición:**

| Condición | Valor en la celda | Estilo visual |
|---|---|---|
| Alumno presente todas las horas (horarios default) | **P** | Verde, negrita |
| Alumno ausente todas las horas | **A** | Rojo, negrita |
| Alumno que llegó tarde (hora de entrada posterior al default) | **T** | Violeta, fondo lila claro |
| Alumno que se retiró antes (hora de salida anterior al default) | **RA** | Violeta, fondo índigo claro |
| Alumno que llegó tarde Y se retiró antes | **T/RA** | Violeta oscuro, fondo lila |
| Día feriado | **F** | Fondo gris oscuro (visible en impresión B&W) |
| Alumno dado de baja (después de fecha de egreso, dentro del mes) | **Baja** | Gris claro, cursiva |
| Alumno aún no ingresado (antes de fecha de ingreso) | *(celda vacía)* | Sin contenido |
| Sin asistencia registrada ese día | *(celda vacía)* | Sin contenido |

**Lógica de llegada tarde y retiro anticipado (regla del 70%):**

Al tomar asistencia, cada alumno tiene dos campos editables: **Hora de Entrada** y **Hora de Salida**. Por default, estos se completan automáticamente con la hora de inicio de la primera materia del día y la hora de fin de la última materia del día (según el horario del curso). El preceptor puede modificar estos valores.

Para cada hora cátedra (slot con hora de inicio y fin), se aplica la **regla del 70%**:
- Si el alumno estuvo presente durante el **70% o más** de la duración de esa hora cátedra → se computa como **Presente**
- Si estuvo presente durante **menos del 70%** → se computa como **Ausente**

Ejemplos:
- Hora cátedra de 35 minutos (07:45–08:20). Si el alumno entra a las 07:55, estuvo 25 minutos (71%) → **Presente** en esa hora
- Si entra a las 08:00, estuvo 20 minutos (57%) → **Ausente** en esa hora
- Todas las horas cátedra posteriores a la hora de entrada se computan como Presente
- Todas las horas cátedra anteriores a la hora de salida se computan como Presente
- Las horas cátedra anteriores a la hora de entrada o posteriores a la hora de salida se computan como Ausente
- Los recreos se excluyen del cálculo
- Las horas con docente ausente también se excluyen

El resumen **"Xp / Ya"** junto a los campos de hora indica cuántas horas cátedra se computan como Presente y cuántas como Ausente según los horarios ingresados.

**Reglas de visualización de alumnos:**
- Los alumnos **activos** siempre aparecen
- Los alumnos **dados de baja** aparecen solo si su fecha de egreso cae dentro del mes seleccionado (se muestra "Baja" desde el día siguiente al egreso hasta el final del mes)
- A partir del mes siguiente al egreso, el alumno ya no aparece en la planilla
- Los alumnos se ordenan alfabéticamente por apellido y nombre
- El número de orden (Nro) es puramente secuencial alfabético, no está vinculado al ID del alumno

**Filtros disponibles:**
- **Curso** (obligatorio): seleccionar el curso para la planilla
- **Mes** (obligatorio): seleccionar el mes/año a visualizar
- **Alumno** (opcional): filtrar para ver un solo alumno en la planilla

**Exportación a XLSX:**
- Encabezado del mes con celdas combinadas
- Columnas Nro y Apellido y Nombre fijas
- Bordes en todas las celdas
- Feriados marcados con "(F)" en el encabezado de día
- Nombre del archivo: `Planilla_{Curso}_{MES}_{AÑO}.xlsx`

#### Detalle por Alumno
Reporte individual con desglose por materia:
- Períodos: **Mensual**, **YTD** (año a la fecha) o **rango personalizado**
- Desglose de inasistencias por materia
- Porcentaje de asistencia por materia y total
- Gráfico de barras interactivo (Chart.js)
- **Exportación a XLSX**

### Configuración
- Gestión de **cursos**, **materias**, **feriados** y **ausencias de docentes**
- Conexión a base de datos Supabase
- Prueba de conexión y estado en tiempo real

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| **HTML5 / CSS3 / JS** | Aplicación SPA vanilla, sin frameworks |
| **Supabase** | Base de datos PostgreSQL en la nube |
| **Chart.js** | Gráficos de reportes |
| **SheetJS (XLSX)** | Importación y exportación de archivos Excel |
| **GitHub Pages** | Hosting estático gratuito |

---

## Puesta en marcha

La app ya está configurada y conectada a Supabase. Si necesitás recrear la base de datos o configurar un nuevo proyecto, seguí estos pasos:

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y crear una cuenta
2. Crear un nuevo proyecto (anotá la contraseña de la base de datos)
3. Esperar a que el proyecto se termine de provisionar

### 2. Crear las tablas

1. En el menú lateral de Supabase, ir a **SQL Editor**
2. Copiar y ejecutar el siguiente SQL:

```sql
-- Cursos
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materias
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alumnos
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apellido TEXT NOT NULL,
  nombre TEXT NOT NULL,
  dni TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
  fecha_ingreso DATE DEFAULT CURRENT_DATE,
  fecha_egreso DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Horarios
CREATE TABLE IF NOT EXISTS schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  hour_slot SMALLINT NOT NULL CHECK (hour_slot BETWEEN 1 AND 8),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recess BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, day_of_week, hour_slot)
);

-- Asistencia
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedule(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  present BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, schedule_id, date)
);

-- Feriados
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ausencias de docentes
CREATE TABLE IF NOT EXISTS teacher_absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, course_id, date)
);

-- Habilitar RLS y políticas de acceso
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on courses" ON courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on schedule" ON schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on holidays" ON holidays FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teacher_absences" ON teacher_absences FOR ALL USING (true) WITH CHECK (true);
```

### 3. Configurar la conexión en la app

Si creaste un proyecto nuevo, editá las credenciales en el archivo `js/db.js`:

```js
DEFAULT_URL: 'https://TU-PROYECTO.supabase.co',
DEFAULT_KEY: 'TU-ANON-KEY',
```

La anon key se encuentra en **Settings > API > anon public**.

### 4. Cargar datos iniciales

1. Ir a **Configuración > Cursos** y crear los cursos (1A, 2A, 3A)
2. Ir a **Configuración > Materias** y crear las materias
3. Ir a **Configuración > Cursos** y usar el botón "Cargar horario predefinido" para cada curso
4. Listo para tomar asistencia!

---

## Estructura del proyecto

```
AsistenciaCEBAS/
├── index.html              # SPA principal (todas las vistas)
├── assets/
│   ├── favicon.svg         # Favicon SVG (principal)
│   ├── favicon-16.png      # Favicon PNG 16x16
│   ├── favicon.ico         # Favicon clásico
│   └── logo-cebas48.png    # Logo del CEBAS
├── css/
│   └── styles.css          # Estilos mobile-first responsive
└── js/
    ├── app.js              # Routing, sidebar, splash screen, inicialización
    ├── db.js               # Conexión Supabase y operaciones CRUD
    ├── utils.js            # Toasts, modales, formateo, helpers
    ├── students.js         # Gestión de alumnos
    ├── schedule.js         # Horarios y carga predefinida
    ├── attendance.js       # Toma de asistencia
    ├── reports.js          # Reportes y exportación XLSX
    └── config.js           # Cursos, materias, feriados, aus. docentes
```

---

## Diseño

- **Color principal:** `rgba(14, 47, 68, 0.97)` — azul oscuro institucional
- **Color accent:** `#2E9CCA` — celeste para acciones principales
- **Mobile-first:** Sidebar colapsable, toggles grandes para uso con el dedo, botones accesibles
- **Responsive:** Funciona en celular, tablet y escritorio
- **Sin naranja**

---

## Importar alumnos por XLSX

El archivo Excel debe tener estas columnas (el encabezado puede ser con o sin mayúsculas):

| apellido | nombre | dni | curso | estado | fecha_ingreso | fecha_egreso |
|---|---|---|---|---|---|---|
| Pérez | Juan | 35123456 | 1A | activo | 2025-03-01 | |

- **Obligatorios:** apellido, nombre, dni, curso
- **Opcionales:** estado (default: activo), fecha_ingreso, fecha_egreso
- El nombre del curso debe coincidir exactamente con los cursos cargados en la app

---

## Seguridad

La app usa la **anon key** de Supabase, que es pública por diseño (se envía en cada request del navegador). La seguridad de los datos se controla mediante **Row Level Security (RLS)** en Supabase. Para un uso más restrictivo, se puede implementar autenticación con Supabase Auth en futuras versiones.

---

## Roadmap

- [ ] Autenticación de usuarios (preceptores, administradores)
- [ ] Justificación de inasistencias
- [ ] Notificaciones por inasistencias reiteradas
- [x] Reporte de planilla mensual imprimible
- [ ] Modo offline con sincronización
- [ ] Panel de administración avanzado

---

<p align="center">
  Desarrollado para el CEBAS
</p>
