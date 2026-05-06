/* =============================================
   CEBAS Asistencia - Students Module
   CRUD, search, filter, XLSX import
   ============================================= */

const Students = {
  allStudents: [],
  filteredStudents: [],

  _eventsBound: false,

  ensureInit() {
    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
    this.load();
  },

  bindEvents() {
    document.getElementById('btn-add-student')?.addEventListener('click', () => this.showForm());
    document.getElementById('btn-import-students')?.addEventListener('click', () => {
      document.getElementById('file-import-xlsx').click();
    });
    document.getElementById('file-import-xlsx')?.addEventListener('change', (e) => this.handleFileImport(e));
    document.getElementById('student-search')?.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
    document.getElementById('student-filter-course')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('student-filter-status')?.addEventListener('change', () => this.applyFilters());
  },

  async load() {
    const container = document.getElementById('students-list');
    if (!container) return;

    try {
      this.allStudents = await DB.getStudents();
      await this.populateCourseFilter();
      this.applyFilters();
    } catch (e) {
      console.error('Error loading students:', e);
      Utils.toastError('Error al cargar alumnos');
    }
  },

  async populateCourseFilter() {
    const select = document.getElementById('student-filter-course');
    if (!select) return;

    try {
      const courses = await DB.getCourses();
      const currentVal = select.value;
      select.innerHTML = '<option value="">Todos los cursos</option>';
      courses.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`;
      });
      select.value = currentVal;
    } catch (e) {
      console.error('Error loading courses for filter:', e);
    }
  },

  applyFilters() {
    const search = (document.getElementById('student-search')?.value || '').toLowerCase().trim();
    const courseId = document.getElementById('student-filter-course')?.value || '';
    const status = document.getElementById('student-filter-status')?.value || '';

    this.filteredStudents = this.allStudents.filter(s => {
      if (courseId && s.course_id !== courseId) return false;
      if (status && s.status !== status) return false;
      if (search) {
        const fullText = `${s.apellido} ${s.nombre} ${s.dni}`.toLowerCase();
        if (!fullText.includes(search)) return false;
      }
      return true;
    });

    this.render();
  },

  render() {
    const container = document.getElementById('students-list');
    if (!container) return;

    if (this.filteredStudents.length === 0) {
      Utils.showEmpty(container, 'Sin alumnos', 'No se encontraron alumnos con los filtros aplicados.',
        '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>');
      return;
    }

    container.innerHTML = this.filteredStudents.map(s => `
      <div class="student-card" data-id="${s.id}">
        <div class="student-avatar">${Utils.getInitials(s.apellido, s.nombre)}</div>
        <div class="student-info">
          <div class="student-name">${Utils.escapeHTML(s.apellido)}, ${Utils.escapeHTML(s.nombre)}</div>
          <div class="student-details">
            <span>DNI: ${Utils.escapeHTML(s.dni)}</span>
            <span>${Utils.escapeHTML(s.courses?.name || 'Sin curso')}</span>
            <span class="badge ${s.status === 'activo' ? 'badge-active' : 'badge-inactive'}">${s.status === 'activo' ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
        <div class="student-actions">
          <button class="btn btn-sm btn-outline btn-edit-student" data-id="${s.id}" title="Editar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-sm btn-outline btn-toggle-status" data-id="${s.id}" data-status="${s.status}" title="${s.status === 'activo' ? 'Desactivar' : 'Activar'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">${s.status === 'activo'
              ? '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
              : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}</svg>
          </button>
          <button class="btn btn-sm btn-outline btn-delete-student" data-id="${s.id}" data-name="${Utils.escapeHTML(s.apellido + ', ' + s.nombre)}" title="Eliminar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Bind card actions
    container.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(btn.dataset.id));
    });
    container.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', () => this.toggleStatus(btn.dataset.id, btn.dataset.status));
    });
    container.querySelectorAll('.btn-delete-student').forEach(btn => {
      btn.addEventListener('click', () => this.confirmDelete(btn.dataset.id, btn.dataset.name));
    });
  },

  async showForm(editId = null) {
    let student = null;
    let courses = [];

    try {
      courses = await DB.getCourses();
      if (editId) {
        student = this.allStudents.find(s => s.id === editId);
        if (!student) return;
      }
    } catch (e) {
      Utils.toastError('Error al cargar datos');
      return;
    }

    const isEdit = !!student;
    const title = isEdit ? 'Editar Alumno' : 'Nuevo Alumno';

    const courseOptions = courses.map(c =>
      `<option value="${c.id}" ${student?.course_id === c.id ? 'selected' : ''}>${Utils.escapeHTML(c.name)}</option>`
    ).join('');

    const html = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="student-form">
        <div class="form-group">
          <label for="sf-apellido">Apellido *</label>
          <input type="text" id="sf-apellido" class="input-field" value="${Utils.escapeHTML(student?.apellido || '')}" required>
        </div>
        <div class="form-group">
          <label for="sf-nombre">Nombre *</label>
          <input type="text" id="sf-nombre" class="input-field" value="${Utils.escapeHTML(student?.nombre || '')}" required>
        </div>
        <div class="form-group">
          <label for="sf-dni">DNI *</label>
          <input type="text" id="sf-dni" class="input-field" value="${Utils.escapeHTML(student?.dni || '')}" placeholder="Ej: 35123456" required>
        </div>
        <div class="form-group">
          <label for="sf-course">Curso *</label>
          <select id="sf-course" class="select-input" required>
            <option value="">Seleccionar curso...</option>
            ${courseOptions}
          </select>
        </div>
        <div class="form-group">
          <label for="sf-status">Estado</label>
          <select id="sf-status" class="select-input">
            <option value="activo" ${student?.status !== 'inactivo' ? 'selected' : ''}>Activo</option>
            <option value="inactivo" ${student?.status === 'inactivo' ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="sf-ingreso">Fecha de Ingreso</label>
            <input type="date" id="sf-ingreso" class="input-field" value="${student?.fecha_ingreso || ''}">
          </div>
          <div class="form-group">
            <label for="sf-egreso">Fecha de Egreso</label>
            <input type="date" id="sf-egreso" class="input-field" value="${student?.fecha_egreso || ''}">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Alumno'}</button>
        </div>
      </form>
    `;

    Utils.showModal(html);

    document.getElementById('student-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveStudent(editId);
    });
  },

  async saveStudent(editId) {
    const data = {
      apellido: document.getElementById('sf-apellido').value.trim(),
      nombre: document.getElementById('sf-nombre').value.trim(),
      dni: document.getElementById('sf-dni').value.trim().replace(/\D/g, ''),
      course_id: document.getElementById('sf-course').value,
      status: document.getElementById('sf-status').value,
      fecha_ingreso: document.getElementById('sf-ingreso').value || null,
      fecha_egreso: document.getElementById('sf-egreso').value || null
    };

    if (!data.apellido || !data.nombre || !data.dni || !data.course_id) {
      Utils.toastWarning('Completá todos los campos obligatorios');
      return;
    }

    try {
      if (editId) {
        await DB.updateStudent(editId, data);
        Utils.toastSuccess('Alumno actualizado');
      } else {
        await DB.addStudent(data);
        Utils.toastSuccess('Alumno creado');
      }
      Utils.hideModal();
      await this.load();
    } catch (e) {
      console.error('Error saving student:', e);
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
        Utils.toastError('Ya existe un alumno con ese DNI');
      } else {
        Utils.toastError('Error al guardar alumno: ' + e.message);
      }
    }
  },

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    try {
      await DB.updateStudent(id, { status: newStatus });
      Utils.toastSuccess(`Alumno ${newStatus === 'activo' ? 'activado' : 'desactivado'}`);
      await this.load();
    } catch (e) {
      Utils.toastError('Error al cambiar estado');
    }
  },

  confirmDelete(id, name) {
    const html = `
      <div class="modal-header">
        <h3>Confirmar Eliminación</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p>¿Estás seguro de que querés eliminar al alumno <strong>${name}</strong>?</p>
      <p class="text-sm" style="color:var(--color-text-secondary);margin-top:8px;">Esta acción también eliminará su historial de asistencias y no se puede deshacer.</p>
      <div class="form-actions" style="margin-top:20px;">
        <button class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirm-delete" data-id="${id}">Eliminar</button>
      </div>
    `;
    Utils.showModal(html);

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
      try {
        await DB.deleteStudent(id);
        Utils.toastSuccess('Alumno eliminado');
        Utils.hideModal();
        await this.load();
      } catch (e) {
        Utils.toastError('Error al eliminar alumno');
      }
    });
  },

  // ---- XLSX Import ----
  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        Utils.toastWarning('El archivo no contiene datos');
        return;
      }

      await this.showImportPreview(jsonData);
    } catch (e) {
      console.error('Error reading XLSX:', e);
      Utils.toastError('Error al leer el archivo XLSX');
    }
  },

  async showImportPreview(rows) {
    const courses = await DB.getCourses();
    const courseMap = {};
    courses.forEach(c => { courseMap[c.name.toLowerCase()] = c.id; });

    const validRows = [];
    const errorRows = [];

    rows.forEach((row, idx) => {
      const apellido = (row['apellido'] || row['Apellido'] || '').toString().trim();
      const nombre = (row['nombre'] || row['Nombre'] || '').toString().trim();
      const dni = (row['dni'] || row['DNI'] || row['Dni'] || '').toString().trim().replace(/\D/g, '');
      const cursoName = (row['curso'] || row['Curso'] || '').toString().trim().toLowerCase();
      const estado = (row['estado'] || row['Estado'] || 'activo').toString().trim().toLowerCase();
      const fechaIngreso = (row['fecha_ingreso'] || row['Fecha Ingreso'] || row['fecha ingreso'] || '').toString().trim();
      const fechaEgreso = (row['fecha_egreso'] || row['Fecha Egreso'] || row['fecha egreso'] || '').toString().trim();

      if (!apellido || !nombre || !dni || !cursoName) {
        errorRows.push({ row: idx + 2, reason: 'Faltan campos obligatorios', data: row });
        return;
      }

      const courseId = courseMap[cursoName];
      if (!courseId) {
        errorRows.push({ row: idx + 2, reason: `Curso "${cursoName}" no encontrado`, data: row });
        return;
      }

      validRows.push({
        apellido,
        nombre,
        dni,
        course_id: courseId,
        status: estado === 'inactivo' ? 'inactivo' : 'activo',
        fecha_ingreso: fechaIngreso || null,
        fecha_egreso: fechaEgreso || null
      });
    });

    const previewHTML = `
      <div class="modal-header">
        <h3>Importar Alumnos</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="import-stats">
        <span class="stat-valid">${validRows.length} válidos</span>
        <span class="stat-error">${errorRows.length} con error</span>
      </div>
      ${errorRows.length > 0 ? `
        <div class="import-preview">
          <table>
            <thead><tr><th>Fila</th><th>Motivo</th></tr></thead>
            <tbody>
              ${errorRows.map(e => `<tr class="error-row"><td>${e.row}</td><td>${Utils.escapeHTML(e.reason)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      ${validRows.length > 0 ? `
        <div class="import-preview">
          <table>
            <thead><tr><th>Apellido</th><th>Nombre</th><th>DNI</th><th>Curso</th></tr></thead>
            <tbody>
              ${validRows.slice(0, 20).map(r => `<tr><td>${Utils.escapeHTML(r.apellido)}</td><td>${Utils.escapeHTML(r.nombre)}</td><td>${Utils.escapeHTML(r.dni)}</td><td>${Utils.escapeHTML(cursoName)}</td></tr>`).join('')}
              ${validRows.length > 20 ? `<tr><td colspan="4" class="text-center text-sm">... y ${validRows.length - 20} más</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      ` : ''}
      <div class="form-actions">
        <button class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
        ${validRows.length > 0 ? '<button class="btn btn-primary" id="btn-confirm-import">Importar ' + validRows.length + ' Alumnos</button>' : ''}
      </div>
    `;

    Utils.showModal(previewHTML);

    if (validRows.length > 0) {
      document.getElementById('btn-confirm-import')?.addEventListener('click', async () => {
        try {
          await DB.addStudentsBatch(validRows);
          Utils.toastSuccess(`${validRows.length} alumnos importados`);
          Utils.hideModal();
          await this.load();
        } catch (e) {
          console.error('Import error:', e);
          Utils.toastError('Error al importar alumnos: ' + e.message);
        }
      });
    }
  }
};
