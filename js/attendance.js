/* =============================================
   CEBAS Asistencia - Attendance Module
   Take attendance by course, mark present/absent
   Handle holidays and teacher absences
   ============================================= */

const Attendance = {
  currentCourseId: null,
  currentDate: null,
  scheduleData: [],
  attendanceData: [],
  studentsData: [],
  holidays: [],
  teacherAbsences: [],
  presentCount: 0,
  absentCount: 0,

  _eventsBound: false,

  ensureInit() {
    if (!this._eventsBound) {
      this.bindEvents();
      this.setDateToToday();
      this._eventsBound = true;
    }
  },

  bindEvents() {
    document.getElementById('btn-load-attendance')?.addEventListener('click', () => this.loadStudentList());
    document.getElementById('btn-att-back')?.addEventListener('click', () => this.showSelectStep());
    document.getElementById('btn-mark-all-present')?.addEventListener('click', () => this.markAll(true));
    document.getElementById('btn-mark-all-absent')?.addEventListener('click', () => this.markAll(false));
    document.getElementById('btn-save-attendance')?.addEventListener('click', () => this.save());
    document.getElementById('att-course')?.addEventListener('change', () => this.onCourseOrDateChange());
    document.getElementById('att-date')?.addEventListener('change', () => this.onCourseOrDateChange());
  },

  setDateToToday() {
    const dateInput = document.getElementById('att-date');
    if (dateInput) dateInput.value = Utils.getToday();
  },

  async populateCourseSelect() {
    const select = document.getElementById('att-course');
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
      console.error('Error loading courses for attendance:', e);
    }
  },

  async onCourseOrDateChange() {
    const courseId = document.getElementById('att-course')?.value;
    const date = document.getElementById('att-date')?.value;
    const btn = document.getElementById('btn-load-attendance');
    const scheduleInfo = document.getElementById('att-schedule-info');
    const warnings = document.getElementById('att-warnings');

    scheduleInfo.style.display = 'none';
    warnings.style.display = 'none';
    btn.disabled = !courseId || !date;

    if (!courseId || !date) return;

    // Check if it's a weekend
    const dayOfWeek = Utils.getDayOfWeek(date);
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.style.display = 'block';
      warnings.innerHTML = '<p>El día seleccionado es fin de semana. No hay clases.</p>';
      btn.disabled = true;
      return;
    }

    // Check if it's a holiday
    const isHoliday = await DB.isHoliday(date);
    if (isHoliday) {
      warnings.style.display = 'block';
      warnings.innerHTML = '<p>El día seleccionado es feriado. No hay clases.</p>';
      btn.disabled = true;
      return;
    }

    // Show schedule preview
    try {
      const schedule = await DB.getSchedule(courseId);
      const daySchedule = schedule.filter(s => s.day_of_week === dayOfWeek);

      if (daySchedule.length === 0) {
        scheduleInfo.style.display = 'block';
        scheduleInfo.innerHTML = '<h4>Sin horario configurado</h4><p>No hay horario para este día. Configurá el horario primero.</p>';
        btn.disabled = true;
        return;
      }

      const subjectSlots = daySchedule.filter(s => !s.is_recess && s.subject_id);
      const recessSlots = daySchedule.filter(s => s.is_recess);
      const freeSlots = daySchedule.filter(s => !s.is_recess && !s.subject_id);

      let chipsHtml = '';
      daySchedule.sort((a, b) => a.hour_slot - b.hour_slot).forEach(s => {
        const timeSlot = Schedule.timeSlots.find(t => t.slot === s.hour_slot);
        const timeStr = timeSlot ? `${timeSlot.start}-${timeSlot.end}` : '';
        if (s.is_recess) {
          chipsHtml += `<span class="schedule-chip recess">Recreo ${timeStr}</span>`;
        } else if (s.subject_id && s.subjects) {
          chipsHtml += `<span class="schedule-chip">${Utils.escapeHTML(s.subjects.name)} (${timeStr})</span>`;
        } else {
          chipsHtml += `<span class="schedule-chip free">Libre ${timeStr}</span>`;
        }
      });

      // Count hours per subject
      const subjectHours = {};
      subjectSlots.forEach(s => {
        const name = s.subjects?.name || 'Sin materia';
        subjectHours[name] = (subjectHours[name] || 0) + 1;
      });

      scheduleInfo.style.display = 'block';
      scheduleInfo.innerHTML = `
        <h4>Horario del ${Utils.getDayName(dayOfWeek)} - ${Utils.formatDateLong(date)}</h4>
        <div class="schedule-subjects">${chipsHtml}</div>
        <p class="mt-2 text-sm" style="color:var(--color-text-secondary)">
          Horas catedra: ${Object.entries(subjectHours).map(([name, count]) => `${name}: ${count}h`).join(' | ')}
        </p>
      `;

      // Check teacher absences for this day
      const teacherAbs = await DB.getTeacherAbsences({ date, courseId });
      if (teacherAbs.length > 0) {
        const absSubjects = teacherAbs.map(ta => ta.subjects?.name || 'N/A').join(', ');
        scheduleInfo.innerHTML += `
          <p class="mt-2 text-sm" style="color:#B7950B;">
            Docentes ausentes: ${Utils.escapeHTML(absSubjects)} (no se computarán inasistencias)
          </p>`;
      }

      btn.disabled = false;
    } catch (e) {
      console.error('Error checking schedule:', e);
    }
  },

  async loadStudentList() {
    const courseId = document.getElementById('att-course')?.value;
    const date = document.getElementById('att-date')?.value;

    if (!courseId || !date) return;

    this.currentCourseId = courseId;
    this.currentDate = date;

    const container = document.getElementById('attendance-student-list');
    Utils.showLoading(container, 'Cargando alumnos...');

    try {
      // Get students for this course (active only)
      this.studentsData = await DB.getStudents({ courseId, status: 'activo' });

      // Get schedule for this day
      const dayOfWeek = Utils.getDayOfWeek(date);
      this.scheduleData = (await DB.getSchedule(courseId)).filter(s => s.day_of_week === dayOfWeek);

      // Get teacher absences
      this.teacherAbsences = await DB.getTeacherAbsences({ date, courseId });

      // Get existing attendance for this date
      const result = await DB.getAttendanceByCourseAndDate(courseId, date);
      this.attendanceData = result.attendance || [];

      this.showMarkStep();
      this.renderStudentList();
    } catch (e) {
      console.error('Error loading attendance data:', e);
      Utils.toastError('Error al cargar datos de asistencia');
      this.showSelectStep();
    }
  },

  showSelectStep() {
    document.getElementById('attendance-select').style.display = 'block';
    document.getElementById('attendance-mark').style.display = 'none';
  },

  showMarkStep() {
    document.getElementById('attendance-select').style.display = 'none';
    document.getElementById('attendance-mark').style.display = 'block';
  },

  renderStudentList() {
    const container = document.getElementById('attendance-student-list');
    if (!container) return;

    // Filter out recess and free slots from schedule for attendance purposes
    const activeSlots = this.scheduleData.filter(s => !s.is_recess && s.subject_id);

    if (this.studentsData.length === 0) {
      Utils.showEmpty(container, 'Sin alumnos activos', 'No hay alumnos activos en este curso.');
      return;
    }

    // Build a map of existing attendance
    const attendanceMap = {};
    this.attendanceData.forEach(a => {
      attendanceMap[`${a.student_id}_${a.schedule_id}`] = a.present;
    });

    // Check which subjects have teacher absences
    const absentSubjectIds = new Set(this.teacherAbsences.map(ta => ta.subject_id));

    // Filter schedule: exclude subjects with absent teachers
    const effectiveSlots = activeSlots.filter(s => !absentSubjectIds.has(s.subject_id));

    container.innerHTML = this.studentsData.map(student => {
      // Determine if student is present overall (present in ALL effective slots)
      let isPresentOverall = true;
      let hasAnyRecord = false;

      if (effectiveSlots.length > 0) {
        for (const slot of effectiveSlots) {
          const key = `${student.id}_${slot.id}`;
          if (attendanceMap[key] !== undefined) {
            hasAnyRecord = true;
            if (!attendanceMap[key]) {
              isPresentOverall = false;
              break;
            }
          } else {
            // No record yet, default to absent
            isPresentOverall = false;
          }
        }
      }

      const checked = hasAnyRecord ? isPresentOverall : true; // Default present
      const cardClass = checked ? '' : 'absent';

      return `
        <div class="att-student-card ${cardClass}" data-student-id="${student.id}">
          <div class="student-avatar">${Utils.getInitials(student.apellido, student.nombre)}</div>
          <span class="att-student-name">${Utils.escapeHTML(student.apellido)}, ${Utils.escapeHTML(student.nombre)}</span>
          <label class="toggle-attendance">
            <input type="checkbox" ${checked ? 'checked' : ''} data-student-id="${student.id}">
            <span class="toggle-slider"></span>
            <span class="toggle-label label-present">SI</span>
            <span class="toggle-label label-absent">NO</span>
          </label>
        </div>
      `;
    }).join('');

    // Bind toggle events
    container.querySelectorAll('.toggle-attendance input').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const card = e.target.closest('.att-student-card');
        if (e.target.checked) {
          card.classList.remove('absent');
        } else {
          card.classList.add('absent');
        }
        this.updateCounts();
      });
    });

    this.updateCounts();
  },

  updateCounts() {
    const toggles = document.querySelectorAll('#attendance-student-list .toggle-attendance input');
    let present = 0, absent = 0;
    toggles.forEach(t => {
      if (t.checked) present++;
      else absent++;
    });
    this.presentCount = present;
    this.absentCount = absent;

    const presentEl = document.getElementById('att-present-count');
    const absentEl = document.getElementById('att-absent-count');
    if (presentEl) presentEl.textContent = `${present} presentes`;
    if (absentEl) absentEl.textContent = `${absent} ausentes`;
  },

  markAll(present) {
    const toggles = document.querySelectorAll('#attendance-student-list .toggle-attendance input');
    toggles.forEach(t => {
      t.checked = present;
      const card = t.closest('.att-student-card');
      if (present) card.classList.remove('absent');
      else card.classList.add('absent');
    });
    this.updateCounts();
  },

  async save() {
    if (!this.currentCourseId || !this.currentDate) return;

    const activeSlots = this.scheduleData.filter(s => !s.is_recess && s.subject_id);
    const absentSubjectIds = new Set(this.teacherAbsences.map(ta => ta.subject_id));
    const effectiveSlots = activeSlots.filter(s => !absentSubjectIds.has(s.subject_id));

    if (effectiveSlots.length === 0) {
      Utils.toastWarning('No hay horas efectivas para registrar asistencia');
      return;
    }

    const toggles = document.querySelectorAll('#attendance-student-list .toggle-attendance input');
    const records = [];

    toggles.forEach(toggle => {
      const studentId = toggle.dataset.studentId;
      const isPresent = toggle.checked;

      effectiveSlots.forEach(slot => {
        records.push({
          student_id: studentId,
          schedule_id: slot.id,
          date: this.currentDate,
          present: isPresent
        });
      });
    });

    try {
      // Delete existing attendance for this date and schedule
      const scheduleIds = effectiveSlots.map(s => s.id);
      await DB.deleteAttendanceByDate(this.currentDate, scheduleIds);

      // Insert new attendance
      await DB.saveAttendance(records);
      Utils.toastSuccess(`Asistencia guardada: ${this.presentCount} presentes, ${this.absentCount} ausentes`);
    } catch (e) {
      console.error('Error saving attendance:', e);
      Utils.toastError('Error al guardar asistencia: ' + e.message);
    }
  }
};
