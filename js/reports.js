/* =============================================
   CEBAS Asistencia - Reports Module
   Monthly, YTD, custom range reports
   By student, by course
   ============================================= */

const Reports = {
  chartInstance: null,

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
        courseSelect.innerHTML = '<option value="">Todos los cursos</option>';
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
    } catch (e) {
      console.error('Error populating report selects:', e);
    }
  },

  onTypeChange() {
    const type = document.getElementById('report-type')?.value;
    const studentSelect = document.getElementById('report-student');
    if (studentSelect) {
      studentSelect.disabled = type !== 'by-student';
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
        ? await DB.getStudents({ courseId, status: 'activo' })
        : await DB.getStudents({ status: 'activo' });

      studentSelect.innerHTML = '<option value="">Seleccionar alumno...</option>';
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
    const dateRange = this.getDateRange();

    if (!dateRange) {
      Utils.toastWarning('Seleccioná un rango de fechas válido');
      return;
    }

    if (type === 'by-student' && !studentId) {
      Utils.toastWarning('Seleccioná un alumno para el reporte individual');
      return;
    }

    const resultsDiv = document.getElementById('report-results');
    const container = document.getElementById('report-table-container');
    Utils.showLoading(container, 'Generando reporte...');
    resultsDiv.style.display = 'block';

    try {
      const filters = { ...dateRange };
      if (courseId) filters.courseId = courseId;
      if (studentId) filters.studentId = studentId;

      const data = await DB.getAttendanceReport(filters);

      if (type === 'by-student') {
        this.renderStudentReport(data, dateRange);
      } else {
        this.renderCourseReport(data, dateRange, courseId);
      }
    } catch (e) {
      console.error('Error generating report:', e);
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
    const title = `Reporte de ${student?.apellido || ''}, ${student?.nombre || ''} - ${Utils.formatDate(dateRange.dateFrom)} a ${Utils.formatDate(dateRange.dateTo)}`;
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

    // Render table
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

  renderCourseReport(data, dateRange, courseId) {
    if (!data || data.length === 0) {
      const container = document.getElementById('report-table-container');
      Utils.showEmpty(container, 'Sin datos', 'No se encontraron registros de asistencia para el período seleccionado.');
      document.getElementById('report-chart-container').style.display = 'none';
      return;
    }

    const courseName = data[0]?.students?.courses?.name || 'Todos los cursos';
    const title = `Reporte del Curso ${courseName} - ${Utils.formatDate(dateRange.dateFrom)} a ${Utils.formatDate(dateRange.dateTo)}`;
    document.getElementById('report-title').textContent = title;

    // Group by student and subject
    const studentMap = {};
    data.forEach(record => {
      const studentKey = record.student_id;
      const studentName = `${record.students?.apellido || ''}, ${record.students?.nombre || ''}`;
      const subjectName = record.schedule?.subjects?.name || 'Sin materia';

      if (!studentMap[studentKey]) {
        studentMap[studentKey] = { name: studentName, total: 0, absences: 0, subjects: {} };
      }

      studentMap[studentKey].total++;
      if (!record.present) {
        studentMap[studentKey].absences++;
      }

      if (!studentMap[studentKey].subjects[subjectName]) {
        studentMap[studentKey].subjects[subjectName] = { total: 0, absences: 0 };
      }
      studentMap[studentKey].subjects[subjectName].total++;
      if (!record.present) {
        studentMap[studentKey].subjects[subjectName].absences++;
      }
    });

    // Render table
    const container = document.getElementById('report-table-container');
    const students = Object.values(studentMap).sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Alumno</th>
            <th style="text-align:center">Horas Totales</th>
            <th style="text-align:center">Inasistencias</th>
            <th style="text-align:center">% Asistencia</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const pct = s.total > 0 ? ((s.total - s.absences) / s.total * 100).toFixed(1) : '0.0';
            const pctClass = parseFloat(pct) < 75 ? 'absence-high' : '';
            return `
              <tr>
                <td>${Utils.escapeHTML(s.name)}</td>
                <td class="absence-count">${s.total}</td>
                <td class="absence-count ${s.absences > 0 ? 'absence-high' : ''}">${s.absences}</td>
                <td class="absence-count ${pctClass}">${pct}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Render chart
    this.renderChart(
      students.map(s => s.name.split(',')[0]),
      students.map(s => s.absences),
      students.map(s => s.total - s.absences),
      'Inasistencias por Alumno'
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

  exportXLSX() {
    const table = document.querySelector('#report-table-container table');
    if (!table) {
      Utils.toastWarning('No hay datos para exportar');
      return;
    }

    try {
      const wb = XLSX.utils.table_to_book(table, { sheet: 'Reporte' });
      const reportTitle = document.getElementById('report-title')?.textContent || 'reporte';
      const filename = `reporte_asistencia_${reportTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áéíóúñ]/g, '')}.xlsx`;
      XLSX.writeFile(wb, filename);
      Utils.toastSuccess('Reporte exportado');
    } catch (e) {
      console.error('Export error:', e);
      Utils.toastError('Error al exportar reporte');
    }
  }
};
