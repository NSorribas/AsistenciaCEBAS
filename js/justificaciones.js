/* =============================================
   CEBAS Asistencia - Justificaciones Module
   Manage justifications for absent students
   ============================================= */

const Justificaciones = {
  currentCourseId: null,
  currentDate: null,
  absentStudents: [],
  existingJustifications: {},

  _eventsBound: false,

  ensureInit() {
    if (!this._eventsBound) {
      this.bindEvents();
      this.setDateToToday();
      this._eventsBound = true;
    }
  },

  bindEvents() {
    document.getElementById('btn-load-justifications')?.addEventListener('click', () => this.loadAbsentStudents());
    document.getElementById('just-course')?.addEventListener('change', () => this.onCourseOrDateChange());
    document.getElementById('just-date')?.addEventListener('change', () => this.onCourseOrDateChange());
  },

  setDateToToday() {
    const dateInput = document.getElementById('just-date');
    if (dateInput) dateInput.value = Utils.getToday();
  },

  async populateCourseSelect() {
    const select = document.getElementById('just-course');
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
      console.error('Error loading courses for justifications:', e);
    }
  },

  onCourseOrDateChange() {
    const courseId = document.getElementById('just-course')?.value;
    const date = document.getElementById('just-date')?.value;
    const btn = document.getElementById('btn-load-justifications');
    btn.disabled = !courseId || !date;

    // Hide list when filters change
    const listContainer = document.getElementById('justifications-list');
    if (listContainer) listContainer.style.display = 'none';
  },

  async loadAbsentStudents() {
    const courseId = document.getElementById('just-course')?.value;
    const date = document.getElementById('just-date')?.value;

    if (!courseId || !date) return;

    this.currentCourseId = courseId;
    this.currentDate = date;

    const listContainer = document.getElementById('justifications-list');
    Utils.showLoading(listContainer, 'Buscando alumnos ausentes...');
    listContainer.style.display = 'block';

    try {
      // Get students for this course (active only)
      const students = await DB.getStudents({ courseId, status: 'activo' });

      // Get schedule for this day to find schedule IDs
      const dayOfWeek = Utils.getDayOfWeek(date);
      const schedule = await DB.getSchedule(courseId);
      const daySchedule = schedule.filter(s => s.day_of_week === dayOfWeek);

      // Get teacher absences to know which subjects are excluded
      const teacherAbsences = await DB.getTeacherAbsences({ date, courseId });
      const absentSubjectIds = new Set(teacherAbsences.map(ta => ta.subject_id));

      // Effective slots (non-recess, has subject, not teacher-absent)
      const effectiveSlots = daySchedule.filter(s =>
        !s.is_recess && s.subject_id && !absentSubjectIds.has(s.subject_id)
      );

      if (effectiveSlots.length === 0) {
        Utils.showEmpty(listContainer, 'Sin horas efectivas',
          'No hay horas cátedra configuradas para este día, o todos los docentes están ausentes.');
        return;
      }

      const scheduleIds = effectiveSlots.map(s => s.id);

      // Get attendance records for this date and these schedule slots
      const { data: attData, error: attErr } = await DB.client
        .from('attendance')
        .select('student_id, present, schedule_id')
        .eq('date', date)
        .in('schedule_id', scheduleIds);

      if (attErr) throw attErr;

      // Group by student: determine who is fully absent
      const studentAttendance = {};
      (attData || []).forEach(a => {
        if (!studentAttendance[a.student_id]) {
          studentAttendance[a.student_id] = { hasPresent: false, hasAbsent: false };
        }
        if (a.present) {
          studentAttendance[a.student_id].hasPresent = true;
        } else {
          studentAttendance[a.student_id].hasAbsent = true;
        }
      });

      // Find students who are entirely absent (all slots absent, no present)
      this.absentStudents = students.filter(s => {
        const att = studentAttendance[s.id];
        // Must have attendance records AND be entirely absent
        return att && att.hasAbsent && !att.hasPresent;
      });

      if (this.absentStudents.length === 0) {
        Utils.showEmpty(listContainer, 'Sin ausentes',
          'No hay alumnos ausentes en la fecha seleccionada para este curso.');
        return;
      }

      // Load existing justifications for these students on this date
      const studentIds = this.absentStudents.map(s => s.id);
      const justifications = await DB.getJustifications({ date, studentIds });

      this.existingJustifications = {};
      justifications.forEach(j => {
        this.existingJustifications[j.student_id] = j.justificacion || '';
      });

      this.renderJustificationList();
    } catch (e) {
      console.error('Error loading absent students:', e);
      Utils.toastError('Error al buscar alumnos ausentes');
      listContainer.style.display = 'none';
    }
  },

  renderJustificationList() {
    const container = document.getElementById('justifications-list');
    if (!container) return;

    const dateFormatted = Utils.formatDateLong(this.currentDate);

    let html = `
      <div class="justifications-header">
        <h3>Ausentes del ${Utils.escapeHTML(dateFormatted)}</h3>
        <span class="justifications-count">${this.absentStudents.length} alumno${this.absentStudents.length !== 1 ? 's' : ''} ausente${this.absentStudents.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="justificaciones-cards">
    `;

    this.absentStudents.forEach(student => {
      const existingJust = this.existingJustifications[student.id] || '';
      const hasJustification = existingJust.trim().length > 0;
      const cardClass = hasJustification ? 'justified' : '';

      html += `
        <div class="just-card ${cardClass}" data-student-id="${student.id}">
          <div class="just-card-left">
            <div class="student-avatar">${Utils.getInitials(student.apellido, student.nombre)}</div>
            <div class="just-card-info">
              <span class="just-card-name">${Utils.escapeHTML(student.apellido)}, ${Utils.escapeHTML(student.nombre)}</span>
              <span class="just-card-dni">DNI: ${Utils.escapeHTML(student.dni)}</span>
            </div>
          </div>
          <div class="just-card-right">
            <input type="text"
              class="just-input"
              data-student-id="${student.id}"
              placeholder="Justificación de la ausencia..."
              value="${Utils.escapeHTML(existingJust)}"
              maxlength="200">
            ${hasJustification ? '<span class="just-badge">Justificado</span>' : ''}
          </div>
        </div>
      `;
    });

    html += `
      </div>
      <div class="justifications-save-bar">
        <button id="btn-save-justifications" class="btn btn-primary btn-lg btn-block">Guardar Justificaciones</button>
      </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';

    // Bind save button
    document.getElementById('btn-save-justifications')?.addEventListener('click', () => this.save());

    // Bind input change for visual feedback
    container.querySelectorAll('.just-input').forEach(input => {
      input.addEventListener('input', (e) => this.onInputChange(e));
    });
  },

  onInputChange(e) {
    const card = e.target.closest('.just-card');
    const value = e.target.value.trim();
    const badge = card.querySelector('.just-badge');

    if (value.length > 0) {
      card.classList.add('justified');
      if (!badge) {
        const badgeEl = document.createElement('span');
        badgeEl.className = 'just-badge';
        badgeEl.textContent = 'Justificado';
        e.target.parentElement.appendChild(badgeEl);
      }
    } else {
      card.classList.remove('justified');
      if (badge) badge.remove();
    }
  },

  async save() {
    if (!this.currentDate) return;

    const inputs = document.querySelectorAll('#justifications-list .just-input');
    const records = [];
    const deletes = [];

    inputs.forEach(input => {
      const studentId = input.dataset.studentId;
      const value = input.value.trim();

      if (value.length > 0) {
        records.push({
          student_id: studentId,
          date: this.currentDate,
          justificacion: value
        });
      } else {
        // If empty and there was an existing justification, delete it
        if (this.existingJustifications[studentId]) {
          deletes.push(studentId);
        }
      }
    });

    try {
      // Save justifications (upsert)
      if (records.length > 0) {
        await DB.saveJustifications(records);
      }

      // Delete justifications that were cleared
      if (deletes.length > 0) {
        await DB.deleteJustifications(this.currentDate, deletes);
      }

      // Update local state
      records.forEach(r => {
        this.existingJustifications[r.student_id] = r.justificacion;
      });
      deletes.forEach(sid => {
        delete this.existingJustifications[sid];
      });

      Utils.toastSuccess(`Justificaciones guardadas (${records.length} registro${records.length !== 1 ? 's' : ''})`);
    } catch (e) {
      console.error('Error saving justifications:', e);
      Utils.toastError('Error al guardar justificaciones: ' + e.message);
    }
  }
};
