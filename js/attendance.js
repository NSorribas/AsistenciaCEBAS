/* =============================================
   CEBAS Asistencia - Attendance Module
   Take attendance by course, mark present/absent
   Handle late arrivals (T) and early departures (RA)
   70% rule for hora cátedra presence
   ============================================= */

const Attendance = {
  currentCourseId: null,
  currentDate: null,
  scheduleData: [],
  attendanceData: [],
  studentsData: [],
  holidays: [],
  teacherAbsences: [],
  effectiveSlots: [],
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

      // Compute effective slots (active - teacher absences)
      const activeSlots = this.scheduleData.filter(s => !s.is_recess && s.subject_id);
      const absentSubjectIds = new Set(this.teacherAbsences.map(ta => ta.subject_id));
      this.effectiveSlots = activeSlots.filter(s => !absentSubjectIds.has(s.subject_id));

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

  // ===================== TIME HELPERS =====================

  /** Convert "HH:MM" to minutes since midnight */
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  /** Get default entry/exit times for the current day's effective slots */
  getDefaultTimes() {
    if (this.effectiveSlots.length === 0) {
      return { firstStart: '07:45', lastEnd: '12:05' };
    }
    const sorted = [...this.effectiveSlots].sort((a, b) => a.hour_slot - b.hour_slot);
    return {
      firstStart: sorted[0].start_time,
      lastEnd: sorted[sorted.length - 1].end_time
    };
  },

  /**
   * Calculate per-slot presence based on entry/exit times and 70% rule.
   * Returns array of { slotId, present } for each slot.
   */
  calculateSlotPresence(horaEntrada, horaSalida, slots) {
    const entry = this.timeToMinutes(horaEntrada);
    const exit = this.timeToMinutes(horaSalida);

    if (!horaEntrada || !horaSalida || entry >= exit) {
      return slots.map(s => ({ slotId: s.id, present: false }));
    }

    return slots.map(slot => {
      const slotStart = this.timeToMinutes(slot.start_time);
      const slotEnd = this.timeToMinutes(slot.end_time);
      const slotDuration = slotEnd - slotStart;

      if (slotDuration <= 0) return { slotId: slot.id, present: false };

      // No overlap at all
      if (entry >= slotEnd || exit <= slotStart) {
        return { slotId: slot.id, present: false };
      }

      // Calculate overlap
      const overlapStart = Math.max(entry, slotStart);
      const overlapEnd = Math.min(exit, slotEnd);
      const overlapMinutes = overlapEnd - overlapStart;

      // 70% rule: present if overlap >= 70% of slot duration
      return { slotId: slot.id, present: (overlapMinutes / slotDuration) >= 0.7 };
    });
  },

  /** Calculate P/A hours for a student given their entry/exit times */
  calculateHoursSummary(horaEntrada, horaSalida) {
    if (!this.effectiveSlots.length) return { present: 0, absent: 0 };
    const presence = this.calculateSlotPresence(horaEntrada, horaSalida, this.effectiveSlots);
    const present = presence.filter(p => p.present).length;
    const absent = presence.filter(p => !p.present).length;
    return { present, absent };
  },

  // ===================== RENDER STUDENT LIST =====================

  renderStudentList() {
    const container = document.getElementById('attendance-student-list');
    if (!container) return;

    if (this.studentsData.length === 0) {
      Utils.showEmpty(container, 'Sin alumnos activos', 'No hay alumnos activos en este curso.');
      return;
    }

    const defaults = this.getDefaultTimes();

    // Build attendance map: student_id -> schedule_id -> { present, hora_entrada, hora_salida }
    const attendanceMap = {};
    const studentTimes = {};
    this.attendanceData.forEach(a => {
      if (!attendanceMap[a.student_id]) attendanceMap[a.student_id] = {};
      attendanceMap[a.student_id][a.schedule_id] = a.present;
      // Times are same for all records of same student-day; store once
      if (a.hora_entrada) {
        studentTimes[a.student_id] = {
          hora_entrada: a.hora_entrada,
          hora_salida: a.hora_salida
        };
      }
    });

    container.innerHTML = this.studentsData.map(student => {
      // Determine existing state
      const hasRecords = attendanceMap[student.id] &&
        this.effectiveSlots.some(s => attendanceMap[student.id][s.id] !== undefined);

      let isPresent, horaEntrada, horaSalida;

      if (hasRecords) {
        const allAbsent = this.effectiveSlots.every(s => attendanceMap[student.id][s.id] === false);
        isPresent = !allAbsent;
        const times = studentTimes[student.id];
        horaEntrada = times ? times.hora_entrada : defaults.firstStart;
        horaSalida = times ? times.hora_salida : defaults.lastEnd;
      } else {
        // No records yet — default to present with default times
        isPresent = true;
        horaEntrada = defaults.firstStart;
        horaSalida = defaults.lastEnd;
      }

      const disabled = isPresent ? '' : 'disabled';
      const cardClass = isPresent ? '' : 'absent';

      // Calculate P/A summary for the current times
      let summary = '';
      if (isPresent) {
        const hours = this.calculateHoursSummary(horaEntrada, horaSalida);
        summary = `<span class="att-hours-summary">${hours.present}P / ${hours.absent}A</span>`;
      } else {
        summary = `<span class="att-hours-summary">${0}P / ${this.effectiveSlots.length}A</span>`;
      }

      return `
        <div class="att-student-card ${cardClass}" data-student-id="${student.id}">
          <div class="student-avatar">${Utils.getInitials(student.apellido, student.nombre)}</div>
          <div class="att-student-details">
            <span class="att-student-name">${Utils.escapeHTML(student.apellido)}, ${Utils.escapeHTML(student.nombre)}</span>
            <div class="att-time-row">
              <div class="att-time-group">
                <label>Ent</label>
                <input type="time" class="att-time-input" data-field="entrada" value="${horaEntrada || ''}" ${disabled}>
              </div>
              <div class="att-time-group">
                <label>Sal</label>
                <input type="time" class="att-time-input" data-field="salida" value="${horaSalida || ''}" ${disabled}>
              </div>
              ${summary}
            </div>
          </div>
          <label class="toggle-attendance">
            <input type="checkbox" ${isPresent ? 'checked' : ''} data-student-id="${student.id}">
            <span class="toggle-slider"></span>
            <span class="toggle-label label-present">SI</span>
            <span class="toggle-label label-absent">NO</span>
          </label>
        </div>
      `;
    }).join('');

    // Bind toggle events
    container.querySelectorAll('.toggle-attendance input').forEach(toggle => {
      toggle.addEventListener('change', (e) => this.onToggleChange(e));
    });

    // Bind time input events
    container.querySelectorAll('.att-time-input').forEach(input => {
      input.addEventListener('change', (e) => this.onTimeChange(e));
    });

    this.updateCounts();
  },

  /** Handle toggle change for a student card */
  onToggleChange(e) {
    const card = e.target.closest('.att-student-card');
    const isPresent = e.target.checked;
    const timeInputs = card.querySelectorAll('.att-time-input');
    const defaults = this.getDefaultTimes();

    if (isPresent) {
      card.classList.remove('absent');
      timeInputs.forEach(input => {
        input.disabled = false;
        // Set defaults if empty
        if (!input.value) {
          input.value = input.dataset.field === 'entrada' ? defaults.firstStart : defaults.lastEnd;
        }
      });
    } else {
      card.classList.add('absent');
      timeInputs.forEach(input => input.disabled = true);
      // Update summary to show all absent
      const summaryEl = card.querySelector('.att-hours-summary');
      if (summaryEl) summaryEl.textContent = `0P / ${this.effectiveSlots.length}A`;
    }

    if (isPresent) {
      // Recalculate summary with current times
      this.updateCardSummary(card);
    }

    this.updateCounts();
  },

  /** Handle time input change for a student card */
  onTimeChange(e) {
    const card = e.target.closest('.att-student-card');
    const entradaInput = card.querySelector('[data-field="entrada"]');
    const salidaInput = card.querySelector('[data-field="salida"]');

    // Validate: entrada must be before salida
    const entryMin = this.timeToMinutes(entradaInput.value);
    const exitMin = this.timeToMinutes(salidaInput.value);

    if (entradaInput.value && salidaInput.value && entryMin >= exitMin) {
      Utils.toastWarning('La hora de entrada debe ser anterior a la de salida');
      // Revert the changed input
      const defaults = this.getDefaultTimes();
      if (e.target.dataset.field === 'entrada') {
        entradaInput.value = defaults.firstStart;
      } else {
        salidaInput.value = defaults.lastEnd;
      }
    }

    this.updateCardSummary(card);
  },

  /** Update P/A hours summary for a specific card */
  updateCardSummary(card) {
    const entradaInput = card.querySelector('[data-field="entrada"]');
    const salidaInput = card.querySelector('[data-field="salida"]');
    const summaryEl = card.querySelector('.att-hours-summary');

    if (!entradaInput || !salidaInput || !summaryEl) return;

    const hours = this.calculateHoursSummary(entradaInput.value, salidaInput.value);
    summaryEl.textContent = `${hours.present}P / ${hours.absent}A`;

    // Visual feedback: if partially absent, add a subtle indicator
    if (hours.absent > 0 && hours.present > 0) {
      summaryEl.classList.add('partial');
    } else {
      summaryEl.classList.remove('partial');
    }
  },

  updateCounts() {
    const cards = document.querySelectorAll('#attendance-student-list .att-student-card');
    let present = 0, absent = 0;
    cards.forEach(card => {
      const toggle = card.querySelector('.toggle-attendance input');
      if (toggle?.checked) present++;
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
    const defaults = this.getDefaultTimes();
    const cards = document.querySelectorAll('#attendance-student-list .att-student-card');

    cards.forEach(card => {
      const toggle = card.querySelector('.toggle-attendance input');
      const timeInputs = card.querySelectorAll('.att-time-input');
      const summaryEl = card.querySelector('.att-hours-summary');

      toggle.checked = present;

      if (present) {
        card.classList.remove('absent');
        timeInputs.forEach(input => {
          input.disabled = false;
          if (!input.value) {
            input.value = input.dataset.field === 'entrada' ? defaults.firstStart : defaults.lastEnd;
          }
        });
        // Update summary
        if (summaryEl) {
          const entrada = card.querySelector('[data-field="entrada"]')?.value || defaults.firstStart;
          const salida = card.querySelector('[data-field="salida"]')?.value || defaults.lastEnd;
          const hours = this.calculateHoursSummary(entrada, salida);
          summaryEl.textContent = `${hours.present}P / ${hours.absent}A`;
        }
      } else {
        card.classList.add('absent');
        timeInputs.forEach(input => input.disabled = true);
        if (summaryEl) summaryEl.textContent = `0P / ${this.effectiveSlots.length}A`;
      }
    });

    this.updateCounts();
  },

  async save() {
    if (!this.currentCourseId || !this.currentDate) return;

    if (this.effectiveSlots.length === 0) {
      Utils.toastWarning('No hay horas efectivas para registrar asistencia');
      return;
    }

    const cards = document.querySelectorAll('#attendance-student-list .att-student-card');
    const records = [];

    cards.forEach(card => {
      const studentId = card.dataset.studentId;
      const toggle = card.querySelector('.toggle-attendance input');
      const isPresent = toggle.checked;

      if (isPresent) {
        const horaEntrada = card.querySelector('[data-field="entrada"]')?.value || null;
        const horaSalida = card.querySelector('[data-field="salida"]')?.value || null;

        // Calculate per-slot presence using 70% rule
        const slotPresence = this.calculateSlotPresence(horaEntrada, horaSalida, this.effectiveSlots);

        slotPresence.forEach(sp => {
          records.push({
            student_id: studentId,
            schedule_id: sp.slotId,
            date: this.currentDate,
            present: sp.present,
            hora_entrada: horaEntrada,
            hora_salida: horaSalida
          });
        });
      } else {
        // Absent all day
        this.effectiveSlots.forEach(slot => {
          records.push({
            student_id: studentId,
            schedule_id: slot.id,
            date: this.currentDate,
            present: false,
            hora_entrada: null,
            hora_salida: null
          });
        });
      }
    });

    try {
      // Delete existing attendance for this date and schedule
      const scheduleIds = this.effectiveSlots.map(s => s.id);
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
