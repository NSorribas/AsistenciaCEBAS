/* =============================================
   CEBAS Asistencia - Main Application
   Routing, sidebar, initialization
   Optimized: splash screen, event dedup, caching
   ============================================= */

const App = {
  currentView: 'setup',
  views: ['setup', 'home', 'attendance', 'justifications', 'students', 'schedule', 'reports', 'settings'],
  initialized: false,
  dbReady: false,

  async init() {
    // Show splash immediately, hide all views
    this.showSplash();

    this.bindEvents();

    // Try to restore DB connection (hardcoded > localStorage)
    if (DB.restore()) {
      const connected = await DB.testConnection();
      if (connected) {
        this.dbReady = true;
        this.onDBConnected();
      } else {
        DB.disconnect();
        this.showView('setup');
      }
    } else {
      this.showView('setup');
    }

    this.initialized = true;
  },

  showSplash() {
    // Hide all views and show a loading state
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.style.display = 'none';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.visibility = 'hidden';

    // Show splash overlay
    let splash = document.getElementById('app-splash');
    if (!splash) {
      splash = document.createElement('div');
      splash.id = 'app-splash';
      splash.style.cssText = 'position:fixed;inset:0;background:rgba(14,47,68,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:#fff;gap:16px;';
      splash.innerHTML = `
        <img src="assets/logo-cebas48.png" alt="CEBAS" style="width:64px;height:64px;object-fit:contain;border-radius:8px;">
        <span style="font-size:1.25rem;font-weight:700;letter-spacing:2px;">CEBAS</span>
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.6);">Control de Asistencia</span>
        <div class="spinner" style="border-top-color:#2E9CCA;"></div>
      `;
      document.body.appendChild(splash);
    }
  },

  hideSplash() {
    const splash = document.getElementById('app-splash');
    if (splash) splash.remove();
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.style.display = '';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.visibility = '';
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

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
    window.addEventListener('hashchange', () => {
      if (this.dbReady) this.handleRouting();
    });

    // Setup form
    document.getElementById('setup-form')?.addEventListener('submit', (e) => this.handleSetup(e));

    // Copy SQL button
    document.getElementById('btn-copy-sql')?.addEventListener('click', () => this.copySQL());
  },

  // ---- Routing ----
  handleRouting() {
    const hash = window.location.hash.replace('#/', '') || 'home';

    if (!this.dbReady && hash !== 'setup') {
      this.showView('setup');
      return;
    }

    if (this.dbReady && hash === 'setup') {
      this.showView('home');
      return;
    }

    this.showView(hash);
  },

  showView(viewName) {
    if (!this.views.includes(viewName)) {
      viewName = 'home';
    }

    // Skip if already on this view (prevents redundant loads)
    if (this.currentView === viewName && this.initialized) return;
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
      justifications: 'Justificaciones',
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
        Attendance.ensureInit();
        await Attendance.populateCourseSelect();
        break;
      case 'justifications':
        Justificaciones.ensureInit();
        await Justificaciones.populateCourseSelect();
        break;
      case 'students':
        Students.ensureInit();
        break;
      case 'schedule':
        Schedule.ensureInit();
        await Schedule.populateCourseSelect();
        break;
      case 'reports':
        Reports.ensureInit();
        await Reports.populateSelects();
        break;
      case 'settings':
        Config.ensureInit();
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
        this.dbReady = true;
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

    // Hide splash and show home
    this.hideSplash();
    this.showView('home');
  },

  copySQL() {
    const sqlCode = document.getElementById('sql-code');
    if (sqlCode) {
      navigator.clipboard.writeText(sqlCode.textContent).then(() => {
        Utils.toastSuccess('SQL copiado al portapapeles');
      }).catch(() => {
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
