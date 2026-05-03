/* =============================================
   CEBAS Asistencia - Main Application
   Routing, sidebar, initialization
   ============================================= */

const App = {
  currentView: 'setup',
  views: ['setup', 'home', 'attendance', 'students', 'schedule', 'reports', 'settings'],

  async init() {
    this.bindEvents();
    this.handleRouting();

    // Try to restore DB connection
    if (DB.restore()) {
      const connected = await DB.testConnection();
      if (connected) {
        this.onDBConnected();
      } else {
        DB.disconnect();
        this.showView('setup');
      }
    } else {
      this.showView('setup');
    }
  },

  bindEvents() {
    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('sidebar-close')?.addEventListener('click', () => this.closeSidebar());
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => this.closeSidebar());

    // Navigation clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) {
          window.location.hash = `#/${view}`;
          this.closeSidebar();
        }
      });
    });

    // Hash change
    window.addEventListener('hashchange', () => this.handleRouting());

    // Setup form
    document.getElementById('setup-form')?.addEventListener('submit', (e) => this.handleSetup(e));

    // Copy SQL button
    document.getElementById('btn-copy-sql')?.addEventListener('click', () => this.copySQL());
  },

  // ---- Routing ----
  handleRouting() {
    const hash = window.location.hash.replace('#/', '') || 'home';

    if (!DB.connected && hash !== 'setup') {
      this.showView('setup');
      return;
    }

    if (DB.connected && hash === 'setup') {
      this.showView('home');
      return;
    }

    this.showView(hash);
  },

  showView(viewName) {
    if (!this.views.includes(viewName)) {
      viewName = 'home';
    }

    this.currentView = viewName;

    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Show target view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Update page title
    const titles = {
      setup: 'Configuración',
      home: 'Inicio',
      attendance: 'Asistencia',
      students: 'Alumnos',
      schedule: 'Horarios',
      reports: 'Reportes',
      settings: 'Configuración'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[viewName] || 'CEBAS';

    // Load view data
    this.loadViewData(viewName);
  },

  async loadViewData(viewName) {
    switch (viewName) {
      case 'home':
        await this.loadHomeStats();
        break;
      case 'attendance':
        await Attendance.init();
        await Attendance.populateCourseSelect();
        break;
      case 'students':
        await Students.init();
        break;
      case 'schedule':
        await Schedule.init();
        await Schedule.populateCourseSelect();
        break;
      case 'reports':
        await Reports.init();
        await Reports.populateSelects();
        break;
      case 'settings':
        await Config.init();
        await Config.loadAll();
        break;
    }
  },

  // ---- Sidebar ----
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  },

  // ---- Setup ----
  async handleSetup(e) {
    e.preventDefault();

    const url = document.getElementById('supabase-url').value.trim();
    const key = document.getElementById('supabase-key').value.trim();

    if (!url || !key) {
      Utils.toastWarning('Completá los campos de conexión');
      return;
    }

    Utils.toastInfo('Conectando...');

    if (DB.init(url, key)) {
      const connected = await DB.testConnection();
      if (connected) {
        Utils.toastSuccess('Conexión establecida');
        this.onDBConnected();
      } else {
        Utils.toastError('No se pudo conectar. Verificá la URL y la clave.');
        DB.disconnect();
      }
    } else {
      Utils.toastError('Error al inicializar la conexión');
    }
  },

  async onDBConnected() {
    // Update connection status
    const connDot = document.getElementById('connection-status');
    if (connDot) {
      connDot.className = 'status-dot online';
      connDot.title = 'Conectado a base de datos';
    }

    // Show home
    this.showView('home');
  },

  copySQL() {
    const sqlCode = document.getElementById('sql-code');
    if (sqlCode) {
      navigator.clipboard.writeText(sqlCode.textContent).then(() => {
        Utils.toastSuccess('SQL copiado al portapapeles');
      }).catch(() => {
        // Fallback
        const range = document.createRange();
        range.selectNodeContents(sqlCode);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        sel.removeAllRanges();
        Utils.toastSuccess('SQL copiado al portapapeles');
      });
    }
  },

  // ---- Home Stats ----
  async loadHomeStats() {
    const container = document.getElementById('home-stats');
    if (!container) return;

    try {
      const stats = await DB.getStats();
      container.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Cursos</div>
          <div class="stat-value">${stats.totalCourses}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Alumnos Activos</div>
          <div class="stat-value">${stats.activeStudents}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Materias</div>
          <div class="stat-value">${stats.totalSubjects}</div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = '';
    }
  }
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
