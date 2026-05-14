/* =============================================
   CEBAS Asistencia - Main Application
   Routing, sidebar, initialization, auth
   ============================================= */

const App = {
  currentView: 'setup',
  views: ['setup', 'login', 'home', 'attendance', 'justifications', 'students', 'schedule', 'reports', 'settings'],
  initialized: false,
  dbReady: false,
  authReady: false,

  async init() {
    // Show splash immediately, hide all views
    this.showSplash();

    this.bindEvents();

    // Try to restore DB connection (hardcoded > localStorage)
    if (DB.restore()) {
      const connected = await DB.testConnection();
      if (connected) {
        this.dbReady = true;

        // Check for existing auth session
        const session = await DB.getSession();
        if (session) {
          this.authReady = true;
          this.onDBConnected();
        } else {
          // DB works but no auth session → show login
          this.hideSplash();
          this.showView('login');
        }

        // Listen for auth state changes (token refresh, sign out from another tab, etc.)
        DB.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && !this.authReady) {
            this.authReady = true;
            this.onDBConnected();
          } else if (event === 'SIGNED_OUT') {
            this.authReady = false;
            this.handleSignOut();
          }
        });
      } else {
        DB.disconnect();
        this.hideSplash();
        this.showView('setup');
      }
    } else {
      this.hideSplash();
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

    // Login form
    document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));

    // Logout button
    document.getElementById('btn-logout')?.addEventListener('click', () => this.handleLogoutClick());
  },

  // ---- Auth ----
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    if (!email || !password) {
      errorEl.textContent = 'Completá email y contraseña';
      errorEl.style.display = 'block';
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Ingresando...';
    errorEl.style.display = 'none';

    try {
      await DB.signIn(email, password);
      this.authReady = true;
      // onAuthStateChange will also fire, but we proactively proceed
      this.onDBConnected();
    } catch (err) {
      console.error('Login error:', err);
      let msg = 'Error al iniciar sesión';
      if (err.message?.includes('Invalid login credentials')) {
        msg = 'Email o contraseña incorrectos';
      } else if (err.message?.includes('Email not confirmed')) {
        msg = 'Email no confirmado. Verificá tu casilla de correo.';
      } else if (err.message) {
        msg = err.message;
      }
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Ingresar';
    }
  },

  async handleLogoutClick() {
    if (!confirm('¿Querés cerrar sesión?')) return;
    await DB.signOut();
    this.handleSignOut();
  },

  handleSignOut() {
    this.authReady = false;
    this._clearAuthUI();
    this.showView('login');
    // Clear password field
    const pwField = document.getElementById('login-password');
    if (pwField) pwField.value = '';
  },

  _updateAuthUI() {
    const user = DB.getCurrentUser();
    const emailEl = document.getElementById('auth-user-email');
    const logoutBtn = document.getElementById('btn-logout');

    if (user && emailEl) {
      emailEl.textContent = user.email;
      emailEl.style.display = 'block';
    } else if (emailEl) {
      emailEl.style.display = 'none';
    }

    if (logoutBtn) {
      logoutBtn.style.display = user ? 'block' : 'none';
    }
  },

  _clearAuthUI() {
    const emailEl = document.getElementById('auth-user-email');
    const logoutBtn = document.getElementById('btn-logout');
    if (emailEl) emailEl.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  },

  // ---- Routing ----
  handleRouting() {
    const hash = window.location.hash.replace('#/', '') || 'home';

    // No DB → setup
    if (!this.dbReady && hash !== 'setup') {
      this.showView('setup');
      return;
    }

    // DB ready but no auth → login
    if (this.dbReady && !this.authReady && hash !== 'login') {
      this.showView('login');
      return;
    }

    // DB ready and auth → don't show setup or login
    if (this.dbReady && this.authReady && (hash === 'setup' || hash === 'login')) {
      this.showView('home');
      return;
    }

    this.showView(hash);
  },

  showView(viewName, force = false) {
    if (!this.views.includes(viewName)) {
      viewName = 'home';
    }

    // Skip if already on this view (unless forced, e.g. from routing after DB connect)
    if (this.currentView === viewName && !force) return;
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
      login: 'Iniciar Sesión',
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

    // Show/hide sidebar and topbar for login
    const topbar = document.querySelector('.topbar');
    const sidebar = document.getElementById('sidebar');
    if (viewName === 'login') {
      if (topbar) topbar.style.display = 'none';
      if (sidebar) sidebar.style.visibility = 'hidden';
    } else if (viewName !== 'setup') {
      if (topbar) topbar.style.display = '';
      if (sidebar) sidebar.style.visibility = '';
    }

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

    // Update auth UI
    this._updateAuthUI();

    // Hide splash
    this.hideSplash();

    // Route to the current hash (or home if no hash)
    this.handleRouting();
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

// ---- PWA Update Manager ----
const PWAUpdate = {
  _swReg: null,
  _newWorker: null,
  _updateCheckInterval: null,

  async init() {
    if (!('serviceWorker' in navigator)) return;

    try {
      this._swReg = await navigator.serviceWorker.register('./sw.js');
      console.log('[PWA] Service Worker registered:', this._swReg.scope);

      // Listen for controller change (new SW took over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New SW activated and claimed this page — reload to get fresh assets
        console.log('[PWA] New controller detected, reloading...');
        window.location.reload();
      });

      // Listen for updates
      this._swReg.addEventListener('updatefound', () => {
        this._newWorker = this._swReg.installing;
        this._newWorker.addEventListener('statechange', () => {
          if (this._newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version downloaded and waiting to activate
            this.showUpdateBanner();
          }
        });
      });

      // Periodic update check every 30 minutes
      this._updateCheckInterval = setInterval(() => {
        this.checkForUpdate();
      }, 30 * 60 * 1000);

      // Also check when the page becomes visible again
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkForUpdate();
        }
      });

    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  },

  async checkForUpdate() {
    if (this._swReg) {
      try {
        await this._swReg.update();
      } catch (e) {
        // Silently fail — might be offline
      }
    }
  },

  showUpdateBanner() {
    // Don't show multiple banners
    if (document.getElementById('update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #0E2F44; color: #fff;
      padding: 12px 16px; display: flex; align-items: center;
      justify-content: space-between; gap: 12px;
      z-index: 10000; box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
      font-size: 0.875rem;
    `;
    banner.innerHTML = `
      <span>Nueva versión disponible</span>
      <button id="btn-apply-update" style="
        background: #2E9CCA; color: #fff; border: none;
        padding: 8px 20px; border-radius: 6px; cursor: pointer;
        font-weight: 600; font-size: 0.875rem;
      ">Actualizar</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('btn-apply-update').addEventListener('click', () => {
      // Tell the waiting SW to skip waiting and activate
      if (this._newWorker) {
        this._newWorker.postMessage({ type: 'SKIP_WAITING' });
      }
      // The controllerchange event will fire and reload the page
    });
  }
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  PWAUpdate.init();
});
