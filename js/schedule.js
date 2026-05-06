/* =============================================
   CEBAS Asistencia - Schedule Module
   View, add, edit, delete schedule entries
   ============================================= */

const Schedule = {
  currentSchedule: [],
  timeSlots: [
    { slot: 1, start: '07:45', end: '08:20' },
    { slot: 2, start: '08:20', end: '08:55' },
    { slot: 3, start: '08:55', end: '09:30' },
    { slot: 4, start: '09:30', end: '10:05' },
    { slot: 5, start: '10:05', end: '10:20', recess: true },  // Recreo
    { slot: 6, start: '10:20', end: '10:55' },
    { slot: 7, start: '10:55', end: '11:30' },
    { slot: 8, start: '11:30', end: '12:05' }
  ],

  days: [
    { num: 1, name: 'Lunes' },
    { num: 2, name: 'Martes' },
    { num: 3, name: 'Miércoles' },
    { num: 4, name: 'Jueves' },
    { num: 5, name: 'Viernes' }
  ],

  _eventsBound: false,

  ensureInit() {
    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
  },

  async init() {
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('schedule-course')?.addEventListener('change', () => this.load());
    document.getElementById('btn-add-schedule-entry')?.addEventListener('click', () => this.showForm());
  },

  async populateCourseSelect() {
    const select = document.getElementById('schedule-course');
    if (!select) return;

    try {
      const courses = await DB.getCourses();
      const currentVal = select.value;
      select.innerHTML = '<option value="">Seleccionar curso...</option>';
      courses.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`;
      });
      select.value = currentVal;
    } catch (e) {
      console.error('Error loading courses:', e);
    }
  },

  async load() {
    const courseId = document.getElementById('schedule-course')?.value;
    const container = document.getElementById('schedule-grid');
    if (!container) return;

    if (!courseId) {
      Utils.showEmpty(container, 'Seleccioná un curso', 'Elegí un curso del selector para ver su horario.');
      return;
    }

    try {
      this.currentSchedule = await DB.getSchedule(courseId);
      this.render();
    } catch (e) {
      console.error('Error loading schedule:', e);
      Utils.toastError('Error al cargar horario');
    }
  },

  render() {
    const container = document.getElementById('schedule-grid');
    if (!container) return;

    const scheduleMap = {};
    this.currentSchedule.forEach(s => {
      scheduleMap[`${s.day_of_week}-${s.hour_slot}`] = s;
    });

    let html = `<table class="schedule-table">
      <thead>
        <tr>
          <th>Hora</th>
          ${this.days.map(d => `<th>${d.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

    this.timeSlots.forEach(ts => {
      if (ts.recess) {
        html += `<tr>
          <td class="time-col">${ts.start} - ${ts.end}</td>
          ${this.days.map(() => '<td class="recess">Recreo</td>').join('')}
        </tr>`;
      } else {
        html += `<tr>
          <td class="time-col">${ts.start} - ${ts.end}</td>`;
        this.days.forEach(day => {
          const entry = scheduleMap[`${day.num}-${ts.slot}`];
          if (entry) {
            const subjectName = entry.subjects?.name || 'Sin materia';
            html += `<td>
              <span class="subject-name">${Utils.escapeHTML(subjectName)}</span>
              <div class="schedule-cell-actions">
                <button class="btn-edit-sched" data-id="${entry.id}" title="Editar">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-delete-sched" data-id="${entry.id}" title="Eliminar">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </td>`;
          } else {
            html += `<td class="free">
              <span class="subject-name" style="color:var(--color-text-light)">Libre</span>
              <div class="schedule-cell-actions">
                <button class="btn-add-sched-cell" data-day="${day.num}" data-slot="${ts.slot}" title="Agregar materia">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </td>`;
          }
        });
        html += '</tr>';
      }
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Bind actions
    container.querySelectorAll('.btn-edit-sched').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete-sched').forEach(btn => {
      btn.addEventListener('click', () => this.confirmDelete(btn.dataset.id));
    });
    container.querySelectorAll('.btn-add-sched-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showForm(null, parseInt(btn.dataset.day), parseInt(btn.dataset.slot));
      });
    });
  },

  async showForm(editId = null, preDay = null, preSlot = null) {
    let entry = null;
    let subjects = [];
    const courseId = document.getElementById('schedule-course')?.value;

    if (!courseId) {
      Utils.toastWarning('Seleccioná un curso primero');
      return;
    }

    try {
      subjects = await DB.getSubjects();
      if (editId) {
        entry = this.currentSchedule.find(s => s.id === editId);
        if (!entry) return;
      }
    } catch (e) {
      Utils.toastError('Error al cargar datos');
      return;
    }

    const isEdit = !!entry;
    const title = isEdit ? 'Editar Hora de Clase' : 'Agregar Hora de Clase';

    const subjectOptions = subjects.map(s =>
      `<option value="${s.id}" ${entry?.subject_id === s.id ? 'selected' : ''}>${Utils.escapeHTML(s.name)}</option>`
    ).join('');

    const dayOptions = this.days.map(d =>
      `<option value="${d.num}" ${(entry?.day_of_week || preDay) === d.num ? 'selected' : ''}>${d.name}</option>`
    ).join('');

    const slotOptions = this.timeSlots.filter(t => !t.recess).map(t =>
      `<option value="${t.slot}" ${(entry?.hour_slot || preSlot) === t.slot ? 'selected' : ''}>${t.start} - ${t.end}</option>`
    ).join('');

    const html = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="schedule-form">
        <div class="form-group">
          <label for="sf-subject">Materia</label>
          <select id="sf-subject" class="select-input">
            <option value="">Hora Libre</option>
            ${subjectOptions}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="sf-day">Día</label>
            <select id="sf-day" class="select-input" required>
              ${dayOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="sf-slot">Hora</label>
            <select id="sf-slot" class="select-input" required>
              ${slotOptions}
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar' : 'Agregar'}</button>
        </div>
      </form>
    `;

    Utils.showModal(html);

    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const selectedSlot = parseInt(document.getElementById('sf-slot').value);
      const selectedDay = parseInt(document.getElementById('sf-day').value);
      const subjectId = document.getElementById('sf-subject').value || null;
      const timeSlot = this.timeSlots.find(t => t.slot === selectedSlot);

      const data = {
        course_id: courseId,
        subject_id: subjectId,
        day_of_week: selectedDay,
        hour_slot: selectedSlot,
        start_time: timeSlot?.start || '00:00',
        end_time: timeSlot?.end || '00:00',
        is_recess: false
      };

      try {
        if (isEdit) {
          await DB.updateScheduleEntry(editId, data);
          Utils.toastSuccess('Horario actualizado');
        } else {
          await DB.addScheduleEntry(data);
          Utils.toastSuccess('Hora agregada al horario');
        }
        Utils.hideModal();
        await this.load();
      } catch (e) {
        if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
          Utils.toastError('Ya existe una entrada para ese día y hora en este curso');
        } else {
          Utils.toastError('Error al guardar: ' + e.message);
        }
      }
    });
  },

  confirmDelete(id) {
    const html = `
      <div class="modal-header">
        <h3>Eliminar Hora</h3>
        <button class="modal-close" onclick="Utils.hideModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p>¿Eliminar esta hora del horario? Las asistencias asociadas también se eliminarán.</p>
      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn-outline" onclick="Utils.hideModal()">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirm-del-sched" data-id="${id}">Eliminar</button>
      </div>
    `;
    Utils.showModal(html);

    document.getElementById('btn-confirm-del-sched').addEventListener('click', async () => {
      try {
        await DB.deleteScheduleEntry(id);
        Utils.toastSuccess('Hora eliminada');
        Utils.hideModal();
        await this.load();
      } catch (e) {
        Utils.toastError('Error al eliminar');
      }
    });
  },

  // ---- Batch load from image data ----
  async loadDefaultSchedule(courseId) {
    // This is the schedule from the image provided by the user
    const subjects = await DB.getSubjects();
    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s.name.toLowerCase()] = s.id; });

    const scheduleData = {
      '1A': {
        1: [ // Lunes
          { slot: 1, subject: 'Matemática' },
          { slot: 2, subject: 'Matemática' },
          { slot: 3, subject: 'Matemática' },
          { slot: 4, subject: 'Cultura y Salud' },
          // slot 5 = recreo
          { slot: 6, subject: 'Cultura y Salud' },
          { slot: 7, subject: 'Cultura y Salud' },
          // slot 8 = libre
        ],
        2: [ // Martes
          { slot: 1, subject: 'Anatomía' },
          { slot: 2, subject: 'Anatomía' },
          { slot: 3, subject: 'Anatomía' },
          { slot: 4, subject: 'Salud Pública' },
          { slot: 6, subject: 'Salud Pública' },
          { slot: 7, subject: 'Salud Pública' },
          { slot: 8, subject: 'Salud Pública' },
        ],
        3: [ // Miércoles
          { slot: 1, subject: 'Educación Cívica' },
          { slot: 2, subject: 'Educación Cívica' },
          { slot: 3, subject: 'Inglés' },
          { slot: 4, subject: 'Inglés' },
          { slot: 6, subject: 'Salud Pública' },
          { slot: 7, subject: 'Salud Pública' },
          { slot: 8, subject: 'Salud Pública' },
        ],
        4: [ // Jueves
          { slot: 1, subject: 'Ciencias Sociales' },
          { slot: 2, subject: 'Ciencias Sociales' },
          { slot: 3, subject: 'Ciencias Sociales' },
          { slot: 4, subject: 'Informática' },
          { slot: 6, subject: 'Informática' },
          // slot 7 = libre
          // slot 8 = libre
        ],
        5: [ // Viernes
          { slot: 1, subject: 'Lengua' },
          { slot: 2, subject: 'Lengua' },
          { slot: 3, subject: 'Lengua' },
          { slot: 4, subject: 'Biología' },
          { slot: 6, subject: 'Biología' },
          { slot: 7, subject: 'Biología' },
          // slot 8 = libre
        ]
      },
      '2A': {
        1: [
          { slot: 1, subject: 'Microbiología' },
          { slot: 2, subject: 'Microbiología' },
          { slot: 3, subject: 'Farmacología' },
          { slot: 4, subject: 'Farmacología' },
          { slot: 6, subject: 'Ciencias Sociales' },
          { slot: 7, subject: 'Ciencias Sociales' },
          { slot: 8, subject: 'Ciencias Sociales' },
        ],
        2: [
          { slot: 1, subject: 'Lengua' },
          { slot: 2, subject: 'Lengua' },
          { slot: 3, subject: 'Lengua' },
          { slot: 4, subject: 'Físico Química' },
          { slot: 6, subject: 'Físico Química' },
          { slot: 7, subject: 'Físico Química' },
          // slot 8 = libre
        ],
        3: [
          // slot 1 = libre
          { slot: 2, subject: 'Anatomía' },
          { slot: 3, subject: 'Anatomía' },
          { slot: 4, subject: 'Anatomía' },
          { slot: 6, subject: 'Salud Pública' },
          { slot: 7, subject: 'Salud Pública' },
          { slot: 8, subject: 'Salud Pública' },
        ],
        4: [
          { slot: 1, subject: 'Informática' },
          { slot: 2, subject: 'Informática' },
          { slot: 3, subject: 'Salud Pública' },
          { slot: 4, subject: 'Salud Pública' },
          { slot: 6, subject: 'Salud Pública' },
          { slot: 7, subject: 'Inglés' },
          { slot: 8, subject: 'Inglés' },
        ],
        5: [
          // slot 1 = libre
          { slot: 2, subject: 'Psicología' },
          { slot: 3, subject: 'Psicología' },
          { slot: 4, subject: 'Psicología' },
          { slot: 6, subject: 'Matemática' },
          { slot: 7, subject: 'Matemática' },
          { slot: 8, subject: 'Matemática' },
        ]
      },
      '3A': {
        1: [
          // slot 1 = libre
          // slot 2 = libre
          { slot: 3, subject: 'Nutrición' },
          { slot: 4, subject: 'Nutrición' },
          { slot: 6, subject: 'Anatomía' },
          { slot: 7, subject: 'Anatomía' },
          { slot: 8, subject: 'Anatomía' },
        ],
        2: [
          { slot: 1, subject: 'Química Biológica' },
          { slot: 2, subject: 'Química Biológica' },
          { slot: 3, subject: 'Química Biológica' },
          { slot: 4, subject: 'Salud Pública' },
          { slot: 6, subject: 'Salud Pública' },
          { slot: 7, subject: 'Salud Pública' },
          { slot: 8, subject: 'Salud Pública' },
        ],
        3: [
          { slot: 1, subject: 'Salud Pública' },
          { slot: 2, subject: 'Salud Pública' },
          { slot: 3, subject: 'Epidemiología' },
          { slot: 4, subject: 'Epidemiología' },
          { slot: 6, subject: 'Problemática Social Contemporánea' },
          { slot: 7, subject: 'Problemática Social Contemporánea' },
          { slot: 8, subject: 'Problemática Social Contemporánea' },
        ],
        4: [
          { slot: 1, subject: 'Lengua' },
          { slot: 2, subject: 'Lengua' },
          { slot: 3, subject: 'Lengua' },
          { slot: 4, subject: 'Inglés' },
          { slot: 6, subject: 'Inglés' },
          { slot: 7, subject: 'Informática' },
          { slot: 8, subject: 'Informática' },
        ],
        5: [
          { slot: 1, subject: 'Psicología' },
          { slot: 2, subject: 'Psicología' },
          { slot: 3, subject: 'Políticas Públicas y Promoción Comunitaria' },
          { slot: 4, subject: 'Políticas Públicas y Promoción Comunitaria' },
          { slot: 6, subject: 'Matemática' },
          { slot: 7, subject: 'Matemática' },
          { slot: 8, subject: 'Matemática' },
        ]
      }
    };

    // Build entries for the selected course
    const courses = await DB.getCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const courseSchedule = scheduleData[course.name];
    if (!courseSchedule) {
      Utils.toastWarning('No hay horario predefinido para el curso ' + course.name);
      return;
    }

    const entries = [];
    for (const [dayStr, slots] of Object.entries(courseSchedule)) {
      const day = parseInt(dayStr);
      for (const s of slots) {
        const timeSlot = this.timeSlots.find(t => t.slot === s.slot);
        const subjectId = subjectMap[s.subject.toLowerCase()] || null;
        entries.push({
          course_id: courseId,
          subject_id: subjectId,
          day_of_week: day,
          hour_slot: s.slot,
          start_time: timeSlot?.start || '00:00',
          end_time: timeSlot?.end || '00:00',
          is_recess: false
        });
      }
    }

    try {
      await DB.deleteScheduleByCourse(courseId);
      await DB.addScheduleBatch(entries);
      Utils.toastSuccess(`Horario cargado para ${course.name}`);
      await this.load();
    } catch (e) {
      console.error('Error loading default schedule:', e);
      Utils.toastError('Error al cargar horario: ' + e.message);
    }
  }
};
