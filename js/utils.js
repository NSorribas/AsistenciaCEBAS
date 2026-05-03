/* =============================================
   CEBAS Asistencia - Utilities
   Toast notifications, formatting, helpers
   ============================================= */

const Utils = {
  // ---- Toast Notifications (bottom-right) ----
  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },

  toastSuccess(msg) { this.toast(msg, 'success'); },
  toastError(msg) { this.toast(msg, 'error', 5000); },
  toastWarning(msg) { this.toast(msg, 'warning'); },
  toastInfo(msg) { this.toast(msg, 'info'); },

  // ---- Date Formatting ----
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateLong(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },

  formatMonth(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  },

  getToday() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  },

  getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  getDayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  },

  getDayName(dayNum) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayNum] || '';
  },

  getWeekdayName(dayOfWeek) {
    // dayOfWeek: 1=Lun, 5=Vie (our DB format)
    const days = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
    return days[dayOfWeek] || '';
  },

  // ---- Local Storage ----
  saveLocal(key, value) {
    try {
      localStorage.setItem(`cebas_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  },

  loadLocal(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(`cebas_${key}`);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  removeLocal(key) {
    localStorage.removeItem(`cebas_${key}`);
  },

  // ---- Debounce ----
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // ---- Modal ----
  showModal(contentHTML) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = contentHTML;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  },

  hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  },

  // ---- Generate initials ----
  getInitials(apellido, nombre) {
    return ((apellido?.[0] || '') + (nombre?.[0] || '')).toUpperCase();
  },

  // ---- Escape HTML ----
  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ---- UUID generator (fallback) ----
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  // ---- Loading state ----
  showLoading(container, message = 'Cargando...') {
    container.innerHTML = `
      <div class="loading-container">
        <div class="spinner spinner-lg"></div>
        <p>${this.escapeHTML(message)}</p>
      </div>
    `;
  },

  // ---- Empty state ----
  showEmpty(container, title, description, icon = '') {
    container.innerHTML = `
      <div class="empty-state">
        ${icon}
        <h3>${this.escapeHTML(title)}</h3>
        <p>${this.escapeHTML(description)}</p>
      </div>
    `;
  },

  // ---- Validate DNI ----
  isValidDNI(dni) {
    if (!dni) return false;
    const clean = dni.replace(/\./g, '').replace(/,/g, '');
    return /^\d{6,8}$/.test(clean);
  },

  // ---- Format DNI ----
  formatDNI(dni) {
    if (!dni) return '';
    const clean = dni.replace(/\D/g, '');
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
};

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') {
    Utils.hideModal();
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    Utils.hideModal();
  }
});
