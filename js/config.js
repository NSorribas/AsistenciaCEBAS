/* =============================================
   CEBAS Asistencia - Configuration Module
   Courses, Subjects, Holidays, Teacher Absences
   Database connection management
   ============================================= */

const Config = {
  async init() {
    this.bindEvents();
    this.bindTabs();
  },

  bindEvents() {
    // Add item buttons
    document.querySelectorAll('.btn-add-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (target === 'courses') this.showCourseForm();
        else if (target === 'subjects') this.showSubjectForm();
        else if (target === 'holidays') this.showHolidayForm();
        else if (target === 'teacher_absences') this.showTeacherAbsenceForm();
      });
    });

    // DB settings
    document.getElementById('btn-test-connection')?.addEventListener('click', () => this.testConnection());
    document.getElementById('btn-disconnect-db')?.addEventListener('click', () => this.disconnectDB());
  },

  bindTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab)?.classList.add('active');
      });
    });
  },

  // ---- Load all settings data ----
  async loadAll() {
    await Promise.all([
      this.loadCourses(),
      this.loadSubjects(),
      this.loadHolidays(),
      this.loadTeacherAbsences(),
      this.updateDBStatus()
    ]);
  },

  // ===================== COURSES =====================
  async loadCourses() {
    const container = document.getElementById('courses-list');
    if (!container) return;

    try {
      const courses = await DB.getCourses();
      if (courses.length === 0) {
        Utils.showEmpty(container, 'Sin cursos', 'Agregá cursos usando el botón de arriba.',
          '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>');
        return;
      }

      container.innerHTML = courses.map(c => `
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-name">${Utils.escapeHTML(c.name)}</div>
          </div>
          <div class="settings-item-actions">
            <button class="btn btn-sm btn-outline btn-edit-course" data-id="${c.id}" data-name="${Utils.escapeHTML(c.name)}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-outline btn-delete-course" data-id="${c.id}" data-name="${Utils.escapeHTML(c.name)}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button class="btn btn-sm btn-outline btn-load-default-sched" data-id="${c.id}" title="Cargar horario predefinido">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      // Bind events
      container.querySelectorAll('.btn-edit-course').forEach(btn => {
        btn.addEventListener('click', () => this.showCourseForm(btn.dataset.id, btn.dataset.name));
      });
      container.querySelectorAll('.btn-delete-course').forEach(btn => {
        btn.addEventListener('click', () => this.confirmDeleteCourse(btn.dataset.id, btn.dataset.name));
      });
      container.querySelectorAll('.btn-load-default-sched').forEach(btn => {
        btn.addEventListener('click', () => Schedule.loadDefaultSchedule(btn.dataset.id));
      });
    } catch (e) {
      console.error('Error loading courses:', e);
    }
  },

  showCourseForm(editId = null, currentName = '') {
    const isEdit = !!editId;
    const html = `
      <div class="modal-header">
        <h3>${isEdit ? 'Editar Curso' : 'Nuevo Curso'}</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="course-form">
        <div class="form-group">
          <label for="cf-name">Nombre del Curso</label>
          <input type="text" id="cf-name" class="input-field" value="${Utils.escapeHTML(currentName)}" placeholder="Ej: 1A" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `;
    Utils.showModal(html);

    document.getElementById('course-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cf-name').value.trim();
      if (!name) return;

      try {
        if (isEdit) {
          await DB.updateCourse(editId, name);
          Utils.toastSuccess('Curso actualizado');
        } else {
          await DB.addCourse(name);
          Utils.toastSuccess('Curso creado');
        }
        Utils.hideModal();
        await this.loadCourses();
      } catch (e) {
        if (e.message?.includes('unique')) {
          Utils.toastError('Ya existe un curso con ese nombre');
        } else {
          Utils.toastError('Error: ' + e.message);
        }
      }
    });
  },

  confirmDeleteCourse(id, name) {
    const html = `
      <div class="modal-header">
        <h3>Eliminar Curso</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p>¿Eliminar el curso <strong>${name}</strong>?</p>
      <p class="text-sm" style="color:var(--color-text-secondary);margin-top:8px;">Se eliminarán todos los alumnos, horarios y asistencias asociados.</p>
      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirm-del-course" data-id="${id}">Eliminar</button>
      </div>
    `;
    Utils.showModal(html);

    document.getElementById('btn-confirm-del-course').addEventListener('click', async () => {
      try {
        await DB.deleteCourse(id);
        Utils.toastSuccess('Curso eliminado');
        Utils.hideModal();
        await this.loadCourses();
      } catch (e) {
        Utils.toastError('Error al eliminar curso');
      }
    });
  },

  // ===================== SUBJECTS =====================
  async loadSubjects() {
    const container = document.getElementById('subjects-list');
    if (!container) return;

    try {
      const subjects = await DB.getSubjects();
      if (subjects.length === 0) {
        Utils.showEmpty(container, 'Sin materias', 'Agregá materias usando el botón de arriba.');
        return;
      }

      container.innerHTML = subjects.map(s => `
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-name">${Utils.escapeHTML(s.name)}</div>
          </div>
          <div class="settings-item-actions">
            <button class="btn btn-sm btn-outline btn-edit-subject" data-id="${s.id}" data-name="${Utils.escapeHTML(s.name)}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-outline btn-delete-subject" data-id="${s.id}" data-name="${Utils.escapeHTML(s.name)}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-edit-subject').forEach(btn => {
        btn.addEventListener('click', () => this.showSubjectForm(btn.dataset.id, btn.dataset.name));
      });
      container.querySelectorAll('.btn-delete-subject').forEach(btn => {
        btn.addEventListener('click', () => this.confirmDeleteSubject(btn.dataset.id, btn.dataset.name));
      });
    } catch (e) {
      console.error('Error loading subjects:', e);
    }
  },

  showSubjectForm(editId = null, currentName = '') {
    const isEdit = !!editId;
    const html = `
      <div class="modal-header">
        <h3>${isEdit ? 'Editar Materia' : 'Nueva Materia'}</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="subject-form">
        <div class="form-group">
          <label for="sf-subj-name">Nombre de la Materia</label>
          <input type="text" id="sf-subj-name" class="input-field" value="${Utils.escapeHTML(currentName)}" placeholder="Ej: Matemática" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `;
    Utils.showModal(html);

    document.getElementById('subject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('sf-subj-name').value.trim();
      if (!name) return;

      try {
        if (isEdit) {
          await DB.updateSubject(editId, name);
          Utils.toastSuccess('Materia actualizada');
        } else {
          await DB.addSubject(name);
          Utils.toastSuccess('Materia creada');
        }
        Utils.hideModal();
        await this.loadSubjects();
      } catch (e) {
        if (e.message?.includes('unique')) {
          Utils.toastError('Ya existe una materia con ese nombre');
        } else {
          Utils.toastError('Error: ' + e.message);
        }
      }
    });
  },

  confirmDeleteSubject(id, name) {
    const html = `
      <div class="modal-header">
        <h3>Eliminar Materia</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p>¿Eliminar la materia <strong>${name}</strong>?</p>
      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirm-del-subj" data-id="${id}">Eliminar</button>
      </div>
    `;
    Utils.showModal(html);

    document.getElementById('btn-confirm-del-subj').addEventListener('click', async () => {
      try {
        await DB.deleteSubject(id);
        Utils.toastSuccess('Materia eliminada');
        Utils.hideModal();
        await this.loadSubjects();
      } catch (e) {
        Utils.toastError('Error al eliminar materia');
      }
    });
  },

  // ===================== HOLIDAYS =====================
  async loadHolidays() {
    const container = document.getElementById('holidays-list');
    if (!container) return;

    try {
      const holidays = await DB.getHolidays();
      if (holidays.length === 0) {
        Utils.showEmpty(container, 'Sin feriados', 'Agregá feriados usando el botón de arriba.');
        return;
      }

      container.innerHTML = holidays.map(h => `
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-name">${Utils.formatDateLong(h.date)}</div>
            <div class="settings-item-detail">${Utils.escapeHTML(h.description || 'Sin descripción')}</div>
          </div>
          <div class="settings-item-actions">
            <button class="btn btn-sm btn-outline btn-delete-holiday" data-id="${h.id}" data-name="${Utils.formatDateLong(h.date)}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-delete-holiday').forEach(btn => {
        btn.addEventListener('click', () => this.confirmDeleteHoliday(btn.dataset.id, btn.dataset.name));
      });
    } catch (e) {
      console.error('Error loading holidays:', e);
    }
  },

  showHolidayForm() {
    const html = `
      <div class="modal-header">
        <h3>Nuevo Feriado</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="holiday-form">
        <div class="form-group">
          <label for="hf-date">Fecha</label>
          <input type="date" id="hf-date" class="input-field" required>
        </div>
        <div class="form-group">
          <label for="hf-desc">Descripción</label>
          <input type="text" id="hf-desc" class="input-field" placeholder="Ej: Feriado Nacional">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Crear</button>
        </div>
      </form>
    `;
    Utils.showModal(html);

    document.getElementById('holiday-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('hf-date').value;
      const description = document.getElementById('hf-desc').value.trim();

      if (!date) return;

      try {
        await DB.addHoliday(date, description);
        Utils.toastSuccess('Feriado agregado');
        Utils.hideModal();
        await this.loadHolidays();
      } catch (e) {
        if (e.message?.includes('unique')) {
          Utils.toastError('Ya existe un feriado en esa fecha');
        } else {
          Utils.toastError('Error: ' + e.message);
        }
      }
    });
  },

  confirmDeleteHoliday(id, name) {
    const html = `
      <div class="modal-header">
        <h3>Eliminar Feriado</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p>¿Eliminar el feriado <strong>${name}</strong>?</p>
      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirm-del-holiday" data-id="${id}">Eliminar</button>
      </div>
    `;
    Utils.showModal(html);

    document.getElementById('btn-confirm-del-holiday').addEventListener('click', async () => {
      try {
        await DB.deleteHoliday(id);
        Utils.toastSuccess('Feriado eliminado');
        Utils.hideModal();
        await this.loadHolidays();
      } catch (e) {
        Utils.toastError('Error al eliminar feriado');
      }
    });
  },

  // ===================== TEACHER ABSENCES =====================
  async loadTeacherAbsences() {
    const container = document.getElementById('teacher-abs-list');
    if (!container) return;

    try {
      const absences = await DB.getTeacherAbsences();
      if (absences.length === 0) {
        Utils.showEmpty(container, 'Sin ausencias de docentes', 'Registram las ausencias de docentes usando el botón de arriba.');
        return;
      }

      container.innerHTML = absences.map(a => `
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-name">${Utils.escapeHTML(a.subjects?.name || 'N/A')} - ${Utils.escapeHTML(a.courses?.name || 'N/A')}</div>
            <div class="settings-item-detail">${Utils.formatDateLong(a.date)}</div>
          </div>
          <div class="settings-item-actions">
            <button class="btn btn-sm btn-outline btn-delete-ta" data-id="${a.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-delete-ta').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await DB.deleteTeacherAbsence(btn.dataset.id);
            Utils.toastSuccess('Ausencia de docente eliminada');
            await this.loadTeacherAbsences();
          } catch (e) {
            Utils.toastError('Error al eliminar');
          }
        });
      });
    } catch (e) {
      console.error('Error loading teacher absences:', e);
    }
  },

  async showTeacherAbsenceForm() {
    let subjects = [], courses = [];
    try {
      subjects = await DB.getSubjects();
      courses = await DB.getCourses();
    } catch (e) {
      Utils.toastError('Error al cargar datos');
      return;
    }

    const html = `
      <div class="modal-header">
        <h3>Nueva Ausencia de Docente</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="ta-form">
        <div class="form-group">
          <label for="taf-subject">Materia</label>
          <select id="taf-subject" class="select-input" required>
            <option value="">Seleccionar materia...</option>
            ${subjects.map(s => `<option value="${s.id}">${Utils.escapeHTML(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="taf-course">Curso</label>
          <select id="taf-course" class="select-input" required>
            <option value="">Seleccionar curso...</option>
            ${courses.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="taf-date">Fecha</label>
          <input type="date" id="taf-date" class="input-field" value="${Utils.getToday()}" required>
        </div>
        <p class="text-sm" style="color:var(--color-text-secondary);">No se computarán inasistencias para esta materia en este curso el día indicado.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Ausencia</button>
        </div>
      </form>
    `;
    Utils.showModal(html);

    document.getElementById('ta-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const subjectId = document.getElementById('taf-subject').value;
      const courseId = document.getElementById('taf-course').value;
      const date = document.getElementById('taf-date').value;

      if (!subjectId || !courseId || !date) return;

      try {
        await DB.addTeacherAbsence(subjectId, courseId, date);
        Utils.toastSuccess('Ausencia de docente registrada');
        Utils.hideModal();
        await this.loadTeacherAbsences();
      } catch (e) {
        if (e.message?.includes('unique')) {
          Utils.toastError('Ya existe una ausencia registrada para esa materia/curso/fecha');
        } else {
          Utils.toastError('Error: ' + e.message);
        }
      }
    });
  },

  // ===================== DB STATUS =====================
  async updateDBStatus() {
    const urlInput = document.getElementById('settings-db-url');
    const statusBadge = document.getElementById('settings-db-status');
    const connDot = document.getElementById('connection-status');

    if (DB.connected) {
      const url = Utils.loadLocal('supabase_url') || '';
      if (urlInput) urlInput.value = url;
      if (statusBadge) {
        statusBadge.textContent = 'Conectado';
        statusBadge.className = 'badge badge-online';
      }
      if (connDot) {
        connDot.className = 'status-dot online';
        connDot.title = 'Conectado a base de datos';
      }
    } else {
      if (urlInput) urlInput.value = '';
      if (statusBadge) {
        statusBadge.textContent = 'Desconectado';
        statusBadge.className = 'badge badge-offline';
      }
      if (connDot) {
        connDot.className = 'status-dot offline';
        connDot.title = 'Sin conexión a base de datos';
      }
    }
  },

  async testConnection() {
    Utils.toastInfo('Probando conexión...');
    const result = await DB.testConnection();
    if (result) {
      Utils.toastSuccess('Conexión exitosa');
    } else {
      Utils.toastError('No se pudo conectar a la base de datos');
    }
    await this.updateDBStatus();
  },

  disconnectDB() {
    DB.disconnect();
    Utils.toastInfo('Desconectado. Redirigiendo a configuración...');
    setTimeout(() => {
      window.location.hash = '#/setup';
      location.reload();
    }, 1000);
  }
};
