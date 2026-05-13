/* =============================================
   CEBAS Asistencia - Reports Module
   Planilla Mensual (grid) + Detalle por Alumno
   ============================================= */

const Reports = {
  chartInstance: null,
  lastGridData: null, // cache for XLSX export

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
    document.getElementById('report-type')?.addEventListener('change', () => this.onTypeChange());
    document.getElementById('report-period')?.addEventListener('change', () => this.onPeriodChange());
    document.getElementById('report-course')?.addEventListener('change', () => this.onCourseChange());
    document.getElementById('btn-generate-report')?.addEventListener('click', () => this.generate());
    document.getElementById('btn-export-report')?.addEventListener('click', () => this.exportXLSX());
  },

  async populateSelects() {
    try {
      const courses = await DB.getCourses();
      const courseSelect = document.getElementById('report-course');
      if (courseSelect) {
        const currentVal = courseSelect.value;
        courseSelect.innerHTML = '<option value="">Seleccionar curso...</option>';
        courses.forEach(c => {
          courseSelect.innerHTML += `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`;
        });
        courseSelect.value = currentVal;
      }

      // Set default month
      const monthInput = document.getElementById('report-month');
      if (monthInput && !monthInput.value) {
        monthInput.value = Utils.getCurrentMonth();
      }

      // Apply initial type filter
      this.onTypeChange();
    } catch (e) {
      console.error('Error populating report selects:', e);
    }
  },

  onTypeChange() {
    const type = document.getElementById('report-type')?.value;
    const studentSelect = document.getElementById('report-student');
    const periodSelect = document.getElementById('report-period');
    const monthSelect = document.getElementById('report-month-select');
    const customRange = document.getElementById('report-custom-range');

    if (type === 'monthly') {
      // Planilla Mensual: student is optional, period is always month
      if (studentSelect) studentSelect.disabled = false;
      if (periodSelect) { periodSelect.value = 'month'; periodSelect.disabled = true; }
      if (monthSelect) monthSelect.style.display = '';
      if (customRange) customRange.style.display = 'none';
    } else {
      // Detalle por Alumno: student required, period flexible
      if (studentSelect) studentSelect.disabled = false;
      if (periodSelect) periodSelect.disabled = false;
      this.onPeriodChange();
    }
  },

  onPeriodChange() {
    const period = document.getElementById('report-period')?.value;
    const monthSelect = document.getElementById('report-month-select');
    const customRange = document.getElementById('report-custom-range');

    if (monthSelect) monthSelect.style.display = period === 'month' ? '' : 'none';
    if (customRange) customRange.style.display = period === 'custom' ? '' : 'none';
  },

  async onCourseChange() {
    const courseId = document.getElementById('report-course')?.value;
    const studentSelect = document.getElementById('report-student');
    if (!studentSelect) return;

    try {
      const students = courseId
        ? await DB.getStudents({ courseId })
        : await DB.getStudents({});

      studentSelect.innerHTML = '<option value="">Todos los alumnos</option>';
      students.forEach(s => {
        studentSelect.innerHTML += `<option value="${s.id}">${Utils.escapeHTML(s.apellido)}, ${Utils.escapeHTML(s.nombre)}</option>`;
      });
    } catch (e) {
      console.error('Error loading students for report:', e);
    }
  },

  getDateRange() {
    const period = document.getElementById('report-period')?.value;
    let dateFrom, dateTo;

    if (period === 'month') {
      const month = document.getElementById('report-month')?.value;
      if (!month) return null;
      dateFrom = `${month}-01`;
      const [year, mon] = month.split('-').map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;
    } else if (period === 'ytd') {
      const now = new Date();
      dateFrom = `${now.getFullYear()}-01-01`;
      dateTo = Utils.getToday();
    } else if (period === 'custom') {
      dateFrom = document.getElementById('report-from')?.value;
      dateTo = document.getElementById('report-to')?.value;
      if (!dateFrom || !dateTo) return null;
    }

    return dateFrom && dateTo ? { dateFrom, dateTo } : null;
  },

  async generate() {
    const type = document.getElementById('report-type')?.value;
    const courseId = document.getElementById('report-course')?.value;
    const studentId = document.getElementById('report-student')?.value;

    if (type === 'monthly') {
      // Planilla Mensual: course + month required
      if (!courseId) {
        Utils.toastWarning('Seleccioná un curso para la planilla mensual');
        return;
      }
      const monthVal = document.getElementById('report-month')?.value;
      if (!monthVal) {
        Utils.toastWarning('Seleccioná un mes para la planilla mensual');
        return;
      }
      await this.generateMonthlyGrid(courseId, monthVal, studentId || null);
    } else {
      // Detalle por Alumno
      if (!studentId) {
        Utils.toastWarning('Seleccioná un alumno para el reporte individual');
        return;
      }
      const dateRange = this.getDateRange();
      if (!dateRange) {
        Utils.toastWarning('Seleccioná un rango de fechas válido');
        return;
      }
      await this.generateStudentDetail(studentId, dateRange, courseId);
    }
  },

  // ===================== PLANILLA MENSUAL =====================
  async generateMonthlyGrid(courseId, yearMonth, studentId = null) {
    const resultsDiv = document.getElementById('report-results');
    const container = document.getElementById('report-table-container');
    const chartContainer = document.getElementById('report-chart-container');
    chartContainer.style.display = 'none';
    Utils.showLoading(container, 'Generando planilla mensual...');
    resultsDiv.style.display = 'block';

    try {
      const data = await DB.getMonthlyGridData(courseId, yearMonth, studentId);
      this.lastGridData = { ...data, courseId };
      this.renderMonthlyGrid(data);
    } catch (e) {
      console.error('Error generating monthly grid:', e);
      Utils.toastError('Error al generar planilla mensual');
      resultsDiv.style.display = 'none';
    }
  },

  renderMonthlyGrid(data) {
    const { students, attendance, justificationsMap, holidayDates, salidasEducativasMap, dayDefaults, yearMonth, courseId } = data;

    if (!students || students.length === 0) {
      const container = document.getElementById('report-table-container');
      Utils.showEmpty(container, 'Sin alumnos', 'No hay alumnos para el curso y mes seleccionados.');
      document.getElementById('report-chart-container').style.display = 'none';
      return;
    }

    const courseName = students[0]?.courses?.name || 'Curso';
    const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const dayAbbr = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const [year, month] = yearMonth.split('-').map(Number);

    // Title
    const title = `Planilla Mensual - ${courseName} - ${monthNames[month - 1]} ${year}`;
    document.getElementById('report-title').textContent = title;

    // Build list of working days (Mon-Fri) in this month
    const lastDay = new Date(year, month, 0).getDate();
    const workDays = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      if (dow !== 0 && dow !== 6) {
        const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
        workDays.push({
          day: d,
          dateStr,
          dayName: dayAbbr[dow],
          isHoliday: holidayDates.has(dateStr)
        });
      }
    }

    // Build attendance map: student_id -> dateStr -> { hasPresent, hasAbsent, hora_entrada, hora_salida }
    const attMap = {};
    attendance.forEach(a => {
      if (!attMap[a.student_id]) attMap[a.student_id] = {};
      if (!attMap[a.student_id][a.date]) {
        attMap[a.student_id][a.date] = { hasPresent: false, hasAbsent: false, hora_entrada: null, hora_salida: null };
      }
      if (a.present) {
        attMap[a.student_id][a.date].hasPresent = true;
      } else {
        attMap[a.student_id][a.date].hasAbsent = true;
      }
      // Store times (same for all records of same student-day)
      if (a.hora_entrada) attMap[a.student_id][a.date].hora_entrada = a.hora_entrada;
      if (a.hora_salida) attMap[a.student_id][a.date].hora_salida = a.hora_salida;
    });

    // Sort students alphabetically by apellido, nombre
    const sortedStudents = [...students].sort((a, b) => {
      const cmp = (a.apellido || '').localeCompare(b.apellido || '');
      if (cmp !== 0) return cmp;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

    // Build table HTML
    const container = document.getElementById('report-table-container');

    // Row 1: Month name (merged across day columns)
    let monthHeaderCells = `<th class="order-col" rowspan="3">Nro</th>`;
    monthHeaderCells += `<th class="student-name-col" rowspan="3">Apellido y Nombre</th>`;
    monthHeaderCells += `<th class="month-header" colspan="${workDays.length}">${monthNames[month - 1]} ${year}</th>`;

    // Row 2: Day names
    let dayNameCells = '';
    workDays.forEach(wd => {
      const cls = wd.isHoliday ? ' holiday-header' : '';
      dayNameCells += `<th class="day-col${cls}">${wd.dayName}</th>`;
    });

    // Row 3: Day numbers
    let dayNumCells = '';
    workDays.forEach(wd => {
      const cls = wd.isHoliday ? ' holiday-header' : '';
      dayNumCells += `<th class="day-col${cls}">${wd.day}</th>`;
    });

    // Student rows
    let studentRows = '';
    sortedStudents.forEach((student, idx) => {
      const orderNum = idx + 1;
      const fullName = `${Utils.escapeHTML(student.apellido || '')}, ${Utils.escapeHTML(student.nombre || '')}`;
      let rowCells = `<td class="order-col">${orderNum}</td>`;
      rowCells += `<td class="student-name-col">${fullName}</td>`;

      workDays.forEach(wd => {
        // Check if student left before this day
        if (student.status === 'inactivo' && student.fecha_egreso && student.fecha_egreso < wd.dateStr) {
          rowCells += `<td class="cell-baja">Baja</td>`;
          return;
        }

        // Check if student hadn't enrolled yet
        if (student.fecha_ingreso && student.fecha_ingreso > wd.dateStr) {
          rowCells += `<td></td>`;
          return;
        }

        // Check if it's a holiday
        if (wd.isHoliday) {
          rowCells += `<td class="cell-holiday">F</td>`;
          return;
        }

        // Check if this course has a salida educativa on this date
        const seCourseIds = salidasEducativasMap?.[wd.dateStr];
        if (seCourseIds && seCourseIds.has(courseId)) {
          rowCells += `<td class="cell-salida-educativa">SE</td>`;
          return;
        }

        // Check attendance
        const dayAtt = attMap[student.id]?.[wd.dateStr];
        if (!dayAtt) {
          // No attendance record
          rowCells += `<td></td>`;
        } else if (!dayAtt.hasPresent && dayAtt.hasAbsent) {
          // All absent — check if justified
          const justKey = `${student.id}|${wd.dateStr}`;
          const isJustified = justificationsMap && justificationsMap[justKey];
          if (isJustified) {
            rowCells += `<td class="cell-absent-justified" title="${Utils.escapeHTML(isJustified)}">A*</td>`;
          } else {
            rowCells += `<td class="cell-absent">A</td>`;
          }
        } else if (dayAtt.hasPresent) {
          // Some or all present — determine P / T / RA / T·RA
          const defaults = dayDefaults?.[wd.dateStr];
          const horaEntrada = dayAtt.hora_entrada;
          const horaSalida = dayAtt.hora_salida;

          if (defaults && horaEntrada && horaSalida) {
            const isLate = horaEntrada > defaults.firstStart;
            const isEarly = horaSalida < defaults.lastEnd;

            if (isLate && isEarly) {
              rowCells += `<td class="cell-late-early">T/RA</td>`;
            } else if (isLate) {
              rowCells += `<td class="cell-late">T</td>`;
            } else if (isEarly) {
              rowCells += `<td class="cell-early">RA</td>`;
            } else {
              rowCells += `<td class="cell-present">P</td>`;
            }
          } else {
            // Old records without times
            rowCells += `<td class="cell-present">P</td>`;
          }
        } else {
          rowCells += `<td></td>`;
        }
      });

      studentRows += `<tr>${rowCells}</tr>`;
    });

    container.innerHTML = `
      <div class="monthly-grid-wrapper">
        <table class="monthly-grid">
          <thead>
            <tr>${monthHeaderCells}</tr>
            <tr class="day-name-row">${dayNameCells}</tr>
            <tr class="day-num-row">${dayNumCells}</tr>
          </thead>
          <tbody>
            ${studentRows}
          </tbody>
        </table>
      </div>
    `;
  },

  // ===================== DETALLE POR ALUMNO =====================
  async generateStudentDetail(studentId, dateRange, courseId) {
    const resultsDiv = document.getElementById('report-results');
    const container = document.getElementById('report-table-container');
    Utils.showLoading(container, 'Generando reporte...');
    resultsDiv.style.display = 'block';

    try {
      const filters = { ...dateRange, studentId };
      if (courseId) filters.courseId = courseId;

      const data = await DB.getAttendanceReport(filters);
      this.renderStudentReport(data, dateRange);
    } catch (e) {
      console.error('Error generating student report:', e);
      Utils.toastError('Error al generar reporte');
      resultsDiv.style.display = 'none';
    }
  },

  renderStudentReport(data, dateRange) {
    if (!data || data.length === 0) {
      const container = document.getElementById('report-table-container');
      Utils.showEmpty(container, 'Sin datos', 'No se encontraron registros de asistencia para el período seleccionado.');
      document.getElementById('report-chart-container').style.display = 'none';
      return;
    }

    const student = data[0]?.students;
    const title = `Detalle de ${student?.apellido || ''}, ${student?.nombre || ''} - ${Utils.formatDate(dateRange.dateFrom)} a ${Utils.formatDate(dateRange.dateTo)}`;
    document.getElementById('report-title').textContent = title;

    // Group by subject
    const subjectMap = {};
    data.forEach(record => {
      const subjectName = record.schedule?.subjects?.name || 'Sin materia';
      if (!subjectMap[subjectName]) {
        subjectMap[subjectName] = { total: 0, absences: 0 };
      }
      subjectMap[subjectName].total++;
      if (!record.present) {
        subjectMap[subjectName].absences++;
      }
    });

    const container = document.getElementById('report-table-container');
    const subjects = Object.entries(subjectMap).sort((a, b) => a[0].localeCompare(b[0]));

    let totalHours = 0, totalAbsences = 0;

    container.innerHTML = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Materia</th>
            <th style="text-align:center">Horas Totales</th>
            <th style="text-align:center">Inasistencias</th>
            <th style="text-align:center">% Asistencia</th>
          </tr>
        </thead>
        <tbody>
          ${subjects.map(([name, stats]) => {
            totalHours += stats.total;
            totalAbsences += stats.absences;
            const pct = stats.total > 0 ? ((stats.total - stats.absences) / stats.total * 100).toFixed(1) : '0.0';
            const pctClass = parseFloat(pct) < 75 ? 'absence-high' : '';
            return `
              <tr>
                <td>${Utils.escapeHTML(name)}</td>
                <td class="absence-count">${stats.total}</td>
                <td class="absence-count ${stats.absences > 0 ? 'absence-high' : ''}">${stats.absences}</td>
                <td class="absence-count ${pctClass}">${pct}%</td>
              </tr>
            `;
          }).join('')}
          <tr style="font-weight:700;border-top:2px solid var(--color-primary)">
            <td>TOTAL</td>
            <td class="absence-count">${totalHours}</td>
            <td class="absence-count ${totalAbsences > 0 ? 'absence-high' : ''}">${totalAbsences}</td>
            <td class="absence-count">${totalHours > 0 ? ((totalHours - totalAbsences) / totalHours * 100).toFixed(1) : '0.0'}%</td>
          </tr>
        </tbody>
      </table>
    `;

    // Render chart
    this.renderChart(
      subjects.map(([name]) => name),
      subjects.map(([, stats]) => stats.absences),
      subjects.map(([, stats]) => stats.total - stats.absences),
      'Inasistencias por Materia'
    );
  },

  renderChart(labels, absenceData, presentData, title) {
    const chartContainer = document.getElementById('report-chart-container');
    chartContainer.style.display = 'block';

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = document.getElementById('report-chart').getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Presentes',
            data: presentData,
            backgroundColor: 'rgba(39, 174, 96, 0.7)',
            borderColor: 'rgba(39, 174, 96, 1)',
            borderWidth: 1
          },
          {
            label: 'Inasistencias',
            data: absenceData,
            backgroundColor: 'rgba(231, 76, 60, 0.7)',
            borderColor: 'rgba(231, 76, 60, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: title, font: { size: 14 } },
          legend: { position: 'top' }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  },

  // ===================== EXPORT XLSX =====================
  exportXLSX() {
    const type = document.getElementById('report-type')?.value;

    if (type === 'monthly' && this.lastGridData) {
      this.exportMonthlyGridXLSX();
    } else {
      // Fallback: export HTML table for student detail
      const table = document.querySelector('#report-table-container table:not(.monthly-grid)');
      if (!table) {
        Utils.toastWarning('No hay datos para exportar');
        return;
      }
      try {
        const wb = XLSX.utils.table_to_book(table, { sheet: 'Reporte' });
        const reportTitle = document.getElementById('report-title')?.textContent || 'reporte';
        const filename = `reporte_${reportTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áéíóúñ]/g, '')}.xlsx`;
        XLSX.writeFile(wb, filename);
        Utils.toastSuccess('Reporte exportado');
      } catch (e) {
        console.error('Export error:', e);
        Utils.toastError('Error al exportar reporte');
      }
    }
  },

  exportMonthlyGridXLSX() {
    const data = this.lastGridData;
    if (!data || !data.students || data.students.length === 0) {
      Utils.toastWarning('No hay datos para exportar');
      return;
    }

    const { students, attendance, justificationsMap, holidayDates, salidasEducativasMap, dayDefaults, yearMonth, courseId } = data;
    const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const dayAbbr = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const [year, month] = yearMonth.split('-').map(Number);

    // Build working days
    const lastDay = new Date(year, month, 0).getDate();
    const workDays = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      if (dow !== 0 && dow !== 6) {
        const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
        workDays.push({ day: d, dateStr, dayName: dayAbbr[dow], isHoliday: holidayDates.has(dateStr) });
      }
    }

    // Build attendance map
    const attMap = {};
    attendance.forEach(a => {
      if (!attMap[a.student_id]) attMap[a.student_id] = {};
      if (!attMap[a.student_id][a.date]) {
        attMap[a.student_id][a.date] = { hasPresent: false, hasAbsent: false, hora_entrada: null, hora_salida: null };
      }
      if (a.present) attMap[a.student_id][a.date].hasPresent = true;
      else attMap[a.student_id][a.date].hasAbsent = true;
      if (a.hora_entrada) attMap[a.student_id][a.date].hora_entrada = a.hora_entrada;
      if (a.hora_salida) attMap[a.student_id][a.date].hora_salida = a.hora_salida;
    });

    // Sort students
    const sortedStudents = [...students].sort((a, b) => {
      const cmp = (a.apellido || '').localeCompare(b.apellido || '');
      if (cmp !== 0) return cmp;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

    // Build AOA (array of arrays) for SheetJS
    const aoa = [];

    // Row 1: Month header
    const row1 = ['', ''];
    workDays.forEach(() => row1.push(`${monthNames[month - 1]} ${year}`));
    aoa.push(row1);

    // Row 2: Day names
    const row2 = ['Nro', 'Apellido y Nombre'];
    workDays.forEach(wd => row2.push(wd.isHoliday ? `${wd.dayName} (F)` : wd.dayName));
    aoa.push(row2);

    // Row 3: Day numbers
    const row3 = ['', ''];
    workDays.forEach(wd => row3.push(wd.day));
    aoa.push(row3);

    // Student rows
    sortedStudents.forEach((student, idx) => {
      const row = [idx + 1, `${student.apellido || ''}, ${student.nombre || ''}`];

      workDays.forEach(wd => {
        if (student.status === 'inactivo' && student.fecha_egreso && student.fecha_egreso < wd.dateStr) {
          row.push('Baja');
          return;
        }
        if (student.fecha_ingreso && student.fecha_ingreso > wd.dateStr) {
          row.push('');
          return;
        }
        if (wd.isHoliday) {
          row.push('F');
          return;
        }
        // Check if this course has a salida educativa on this date
        const seCourseIds = salidasEducativasMap?.[wd.dateStr];
        if (seCourseIds && seCourseIds.has(courseId)) {
          row.push('SE');
          return;
        }
        const dayAtt = attMap[student.id]?.[wd.dateStr];
        if (!dayAtt) {
          row.push('');
        } else if (!dayAtt.hasPresent && dayAtt.hasAbsent) {
          const justKey = `${student.id}|${wd.dateStr}`;
          const isJustified = justificationsMap && justificationsMap[justKey];
          row.push(isJustified ? 'A*' : 'A');
        } else if (dayAtt.hasPresent) {
          const defaults = dayDefaults?.[wd.dateStr];
          const horaEntrada = dayAtt.hora_entrada;
          const horaSalida = dayAtt.hora_salida;
          if (defaults && horaEntrada && horaSalida) {
            const isLate = horaEntrada > defaults.firstStart;
            const isEarly = horaSalida < defaults.lastEnd;
            if (isLate && isEarly) row.push('T/RA');
            else if (isLate) row.push('T');
            else if (isEarly) row.push('RA');
            else row.push('P');
          } else {
            row.push('P');
          }
        } else {
          row.push('');
        }
      });

      aoa.push(row);
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Set column widths
      const colWidths = [{ wch: 5 }, { wch: 30 }];
      workDays.forEach(() => colWidths.push({ wch: 5 }));
      ws['!cols'] = colWidths;

      // Merge month header row
      if (workDays.length > 0) {
        ws['!merges'] = [
          { s: { r: 0, c: 2 }, e: { r: 0, c: 1 + workDays.length } }
        ];
      }

      XLSX.utils.book_append_sheet(wb, ws, monthNames[month - 1]);

      const courseName = students[0]?.courses?.name || 'Curso';
      const filename = `Planilla_${courseName}_${monthNames[month - 1]}_${year}.xlsx`;
      XLSX.writeFile(wb, filename);
      Utils.toastSuccess('Planilla exportada a Excel');
    } catch (e) {
      console.error('Export error:', e);
      Utils.toastError('Error al exportar planilla');
    }
  }
};
