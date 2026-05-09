/* =============================================
   CEBAS Asistencia - Database Module (Supabase)
   All CRUD operations for the application
   Optimized: simple cache for frequently accessed data
   ============================================= */

const DB = {
  client: null,
  connected: false,

  // ---- Hardcoded credentials (auto-connect from any device) ----
  DEFAULT_URL: 'https://zkrtvxuxmwhilhunapoj.supabase.co',
  DEFAULT_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcnR2eHV4bXdoaWxodW5hcG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDI0ODgsImV4cCI6MjA5MzQxODQ4OH0.rGmDUeL0aeK3h2dQ433vgL4boF-3tUndidWpxmIfb90',

  // ---- Simple in-memory cache ----
  _cache: {},
  _cacheTTL: 30000, // 30 seconds

  _cacheKey(table, filters = '') {
    return `${table}_${JSON.stringify(filters)}`;
  },

  _getCached(key) {
    const entry = this._cache[key];
    if (!entry) return null;
    if (Date.now() - entry.time > this._cacheTTL) {
      delete this._cache[key];
      return null;
    }
    return entry.data;
  },

  _setCache(key, data) {
    this._cache[key] = { data, time: Date.now() };
  },

  clearCache(tables = null) {
    if (!tables) {
      this._cache = {};
      return;
    }
    Object.keys(this._cache).forEach(k => {
      if (tables.some(t => k.startsWith(t + '_'))) {
        delete this._cache[k];
      }
    });
  },

  // ---- Initialize Supabase Client ----
  init(url, key) {
    try {
      this.client = supabase.createClient(url, key);
      this.connected = true;
      Utils.saveLocal('supabase_url', url);
      Utils.saveLocal('supabase_key', key);
      return true;
    } catch (e) {
      console.error('Supabase init error:', e);
      this.connected = false;
      return false;
    }
  },

  // ---- Test Connection ----
  async testConnection() {
    if (!this.client) return false;
    try {
      const { data, error } = await this.client.from('courses').select('id').limit(1);
      if (error) throw error;
      this.connected = true;
      return true;
    } catch (e) {
      console.error('Connection test failed:', e);
      this.connected = false;
      return false;
    }
  },

  // ---- Disconnect ----
  disconnect() {
    this.client = null;
    this.connected = false;
    this._cache = {};
    Utils.removeLocal('supabase_url');
    Utils.removeLocal('supabase_key');
  },

  // ---- Restore connection (hardcoded > localStorage > setup) ----
  restore() {
    if (this.DEFAULT_URL && this.DEFAULT_KEY) {
      return this.init(this.DEFAULT_URL, this.DEFAULT_KEY);
    }
    const url = Utils.loadLocal('supabase_url');
    const key = Utils.loadLocal('supabase_key');
    if (url && key) {
      return this.init(url, key);
    }
    return false;
  },

  // ===================== COURSES (cached) =====================
  async getCourses() {
    const key = this._cacheKey('courses');
    const cached = this._getCached(key);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('courses')
      .select('*')
      .order('name');
    if (error) throw error;
    const result = data || [];
    this._setCache(key, result);
    return result;
  },

  async addCourse(name) {
    this.clearCache(['courses']);
    const { data, error } = await this.client
      .from('courses')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCourse(id, name) {
    this.clearCache(['courses']);
    const { data, error } = await this.client
      .from('courses')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCourse(id) {
    this.clearCache(['courses', 'students', 'schedule', 'attendance']);
    const { error } = await this.client
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== SUBJECTS (cached) =====================
  async getSubjects() {
    const key = this._cacheKey('subjects');
    const cached = this._getCached(key);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('subjects')
      .select('*')
      .order('name');
    if (error) throw error;
    const result = data || [];
    this._setCache(key, result);
    return result;
  },

  async addSubject(name) {
    this.clearCache(['subjects']);
    const { data, error } = await this.client
      .from('subjects')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSubject(id, name) {
    this.clearCache(['subjects']);
    const { data, error } = await this.client
      .from('subjects')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteSubject(id) {
    this.clearCache(['subjects', 'schedule']);
    const { error } = await this.client
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== STUDENTS (cached) =====================
  async getStudents(filters = {}) {
    const key = this._cacheKey('students', filters);
    const cached = this._getCached(key);
    if (cached) return cached;

    let query = this.client
      .from('students')
      .select('*, courses(id, name)')
      .order('apellido')
      .order('nombre');

    if (filters.courseId) query = query.eq('course_id', filters.courseId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) {
      query = query.or(`apellido.ilike.%${filters.search}%,nombre.ilike.%${filters.search}%,dni.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const result = data || [];
    this._setCache(key, result);
    return result;
  },

  async addStudent(student) {
    this.clearCache(['students']);
    const { data, error } = await this.client
      .from('students')
      .insert(student)
      .select('*, courses(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async addStudentsBatch(students) {
    this.clearCache(['students']);
    const { data, error } = await this.client
      .from('students')
      .insert(students)
      .select('*, courses(id, name)');
    if (error) throw error;
    return data || [];
  },

  async updateStudent(id, updates) {
    this.clearCache(['students']);
    const { data, error } = await this.client
      .from('students')
      .update(updates)
      .eq('id', id)
      .select('*, courses(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteStudent(id) {
    this.clearCache(['students', 'attendance']);
    const { error } = await this.client
      .from('students')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== SCHEDULE (cached per course) =====================
  async getSchedule(courseId) {
    const key = this._cacheKey('schedule', { courseId });
    const cached = this._getCached(key);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('schedule')
      .select('*, subjects(id, name)')
      .eq('course_id', courseId)
      .order('day_of_week')
      .order('hour_slot');
    if (error) throw error;
    const result = data || [];
    this._setCache(key, result);
    return result;
  },

  async getAllSchedule() {
    const { data, error } = await this.client
      .from('schedule')
      .select('*, subjects(id, name), courses(id, name)')
      .order('course_id')
      .order('day_of_week')
      .order('hour_slot');
    if (error) throw error;
    return data || [];
  },

  async addScheduleEntry(entry) {
    this.clearCache(['schedule']);
    const { data, error } = await this.client
      .from('schedule')
      .insert(entry)
      .select('*, subjects(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async addScheduleBatch(entries) {
    this.clearCache(['schedule']);
    const { data, error } = await this.client
      .from('schedule')
      .insert(entries)
      .select('*, subjects(id, name)');
    if (error) throw error;
    return data || [];
  },

  async updateScheduleEntry(id, updates) {
    this.clearCache(['schedule']);
    const { data, error } = await this.client
      .from('schedule')
      .update(updates)
      .eq('id', id)
      .select('*, subjects(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteScheduleEntry(id) {
    this.clearCache(['schedule', 'attendance']);
    const { error } = await this.client
      .from('schedule')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async deleteScheduleByCourse(courseId) {
    this.clearCache(['schedule', 'attendance']);
    const { error } = await this.client
      .from('schedule')
      .delete()
      .eq('course_id', courseId);
    if (error) throw error;
  },

  // ===================== ATTENDANCE =====================
  async getAttendance(filters = {}) {
    let query = this.client
      .from('attendance')
      .select('*, students(id, apellido, nombre, dni, course_id), schedule(id, subject_id, day_of_week, hour_slot, start_time, end_time, is_recess, subjects(id, name))');

    if (filters.date) query = query.eq('date', filters.date);
    if (filters.studentId) query = query.eq('student_id', filters.studentId);
    if (filters.scheduleId) query = query.eq('schedule_id', filters.scheduleId);
    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date', filters.dateTo);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAttendanceByCourseAndDate(courseId, date) {
    const jsDay = Utils.getDayOfWeek(date);
    if (jsDay === 0 || jsDay === 6) return { schedule: [], attendance: [] };

    const dbDay = jsDay;

    const { data: scheduleData, error: schedErr } = await this.client
      .from('schedule')
      .select('*, subjects(id, name)')
      .eq('course_id', courseId)
      .eq('day_of_week', dbDay)
      .order('hour_slot');
    if (schedErr) throw schedErr;

    const scheduleIds = (scheduleData || []).map(s => s.id);
    if (scheduleIds.length === 0) return { schedule: scheduleData || [], attendance: [] };

    const { data: attData, error: attErr } = await this.client
      .from('attendance')
      .select('*')
      .eq('date', date)
      .in('schedule_id', scheduleIds);
    if (attErr) throw attErr;

    return { schedule: scheduleData || [], attendance: attData || [] };
  },

  async saveAttendance(records) {
    this.clearCache(['attendance']);
    const { data, error } = await this.client
      .from('attendance')
      .upsert(records, { onConflict: 'student_id,schedule_id,date' })
      .select();
    if (error) throw error;
    return data || [];
  },

  async deleteAttendanceByDate(date, scheduleIds) {
    if (!scheduleIds || scheduleIds.length === 0) return;
    this.clearCache(['attendance']);
    const { error } = await this.client
      .from('attendance')
      .delete()
      .eq('date', date)
      .in('schedule_id', scheduleIds);
    if (error) throw error;
  },

  // ===================== JUSTIFICATIONS =====================
  async getJustifications(filters = {}) {
    let query = this.client
      .from('justifications')
      .select('*');

    if (filters.date) query = query.eq('date', filters.date);
    if (filters.studentId) query = query.eq('student_id', filters.studentId);
    if (filters.studentIds && filters.studentIds.length > 0) {
      query = query.in('student_id', filters.studentIds);
    }
    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date', filters.dateTo);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async saveJustifications(records) {
    this.clearCache(['justifications']);
    const { data, error } = await this.client
      .from('justifications')
      .upsert(records, { onConflict: 'student_id,date' })
      .select();
    if (error) throw error;
    return data || [];
  },

  async deleteJustifications(date, studentIds) {
    if (!studentIds || studentIds.length === 0) return;
    this.clearCache(['justifications']);
    const { error } = await this.client
      .from('justifications')
      .delete()
      .eq('date', date)
      .in('student_id', studentIds);
    if (error) throw error;
  },

  // ===================== HOLIDAYS =====================
  async getHolidays() {
    const key = this._cacheKey('holidays');
    const cached = this._getCached(key);
    if (cached) return cached;

    const { data, error } = await this.client
      .from('holidays')
      .select('*')
      .order('date');
    if (error) throw error;
    const result = data || [];
    this._setCache(key, result);
    return result;
  },

  async addHoliday(date, description) {
    this.clearCache(['holidays']);
    const { data, error } = await this.client
      .from('holidays')
      .insert({ date, description })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteHoliday(id) {
    this.clearCache(['holidays']);
    const { error } = await this.client
      .from('holidays')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async isHoliday(date) {
    // Use cached holidays list instead of a separate query
    try {
      const holidays = await this.getHolidays();
      return holidays.some(h => h.date === date);
    } catch (e) {
      return false;
    }
  },

  // ===================== TEACHER ABSENCES =====================
  async getTeacherAbsences(filters = {}) {
    let query = this.client
      .from('teacher_absences')
      .select('*, subjects(id, name), courses(id, name)')
      .order('date', { ascending: false });

    if (filters.date) query = query.eq('date', filters.date);
    if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);
    if (filters.courseId) query = query.eq('course_id', filters.courseId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addTeacherAbsence(subjectId, courseId, date) {
    this.clearCache(['teacher_absences']);
    const { data, error } = await this.client
      .from('teacher_absences')
      .insert({ subject_id: subjectId, course_id: courseId, date })
      .select('*, subjects(id, name), courses(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTeacherAbsence(id) {
    this.clearCache(['teacher_absences']);
    const { error } = await this.client
      .from('teacher_absences')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== REPORTS =====================
  async getAttendanceReport(filters = {}) {
    let query = this.client
      .from('attendance')
      .select(`
        id, date, present,
        students(id, apellido, nombre, dni, course_id, courses(id, name)),
        schedule(id, subject_id, hour_slot, is_recess, subjects(id, name))
      `);

    query = query.eq('schedule.is_recess', false);

    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date', filters.dateTo);
    if (filters.courseId) query = query.eq('students.course_id', filters.courseId);
    if (filters.studentId) query = query.eq('student_id', filters.studentId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // ===================== MONTHLY GRID =====================
  async getMonthlyGridData(courseId, yearMonth, studentId = null) {
    const [year, month] = yearMonth.split('-').map(Number);
    const dateFrom = `${yearMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    // Get students: active + inactive with egreso in this month or later
    let studentQuery = this.client
      .from('students')
      .select('*, courses(id, name)')
      .eq('course_id', courseId)
      .order('apellido')
      .order('nombre');

    if (studentId) {
      studentQuery = studentQuery.eq('id', studentId);
    }

    const { data: allStudents, error: studErr } = await studentQuery;
    if (studErr) throw studErr;

    // Filter: active students OR inactive whose egreso is in this month or later
    const monthStart = dateFrom;
    const students = (allStudents || []).filter(s => {
      if (s.status === 'activo') return true;
      if (s.status === 'inactivo' && s.fecha_egreso && s.fecha_egreso >= monthStart) return true;
      return false;
    });

    if (students.length === 0) {
      return { students: [], attendance: [], holidayDates: new Set(), dayDefaults: {}, dateFrom, dateTo, yearMonth };
    }

    // Get attendance for these students in this month (non-recess only)
    const studentIds = students.map(s => s.id);
    const { data: attendance, error: attErr } = await this.client
      .from('attendance')
      .select('id, student_id, date, present, hora_entrada, hora_salida, schedule_id, schedule(is_recess)')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .in('student_id', studentIds);
    if (attErr) throw attErr;

    // Get justifications for these students in this month
    const { data: justificationsData, error: justErr } = await this.client
      .from('justifications')
      .select('student_id, date, justificacion')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .in('student_id', studentIds);
    if (justErr) throw justErr;

    // Build justifications map: "student_id|date" -> justificacion
    const justificationsMap = {};
    (justificationsData || []).forEach(j => {
      const key = `${j.student_id}|${j.date}`;
      if (j.justificacion && j.justificacion.trim()) {
        justificationsMap[key] = j.justificacion;
      }
    });

    // Get holidays for this month
    const holidays = await this.getHolidays();
    const monthHolidays = holidays.filter(h => h.date >= dateFrom && h.date <= dateTo);
    const holidayDates = new Set(monthHolidays.map(h => h.date));

    // Fetch schedule for default entry/exit times per day
    const schedule = await this.getSchedule(courseId);

    // Fetch teacher absences for the month
    const { data: teacherAbsences } = await this.client
      .from('teacher_absences')
      .select('date, subject_id')
      .eq('course_id', courseId)
      .gte('date', dateFrom)
      .lte('date', dateTo);
    const tAbsences = teacherAbsences || [];

    // Compute default entry/exit times per working day
    const dayDefaults = {};
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay(); // 1=Mon, 5=Fri (matches our DB)
      if (dow === 0 || dow === 6) continue;

      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const daySchedule = schedule
        .filter(s => s.day_of_week === dow && !s.is_recess && s.subject_id)
        .sort((a, b) => a.hour_slot - b.hour_slot);

      if (daySchedule.length === 0) continue;

      // Exclude teacher-absent subjects for this date
      const dayAbsentSubjects = new Set(
        tAbsences.filter(ta => ta.date === dateStr).map(ta => ta.subject_id)
      );
      const effectiveSlots = daySchedule.filter(s => !dayAbsentSubjects.has(s.subject_id));

      if (effectiveSlots.length > 0) {
        dayDefaults[dateStr] = {
          firstStart: effectiveSlots[0].start_time,
          lastEnd: effectiveSlots[effectiveSlots.length - 1].end_time
        };
      }
    }

    return {
      students,
      #attendance: (attendance || []).filter(a => !a.schedule?.is_recess),
      justificationsMap,
      holidayDates,
      holidays: monthHolidays,
      dayDefaults,
      dateFrom,
      dateTo,
      yearMonth
    };
  },

  // ===================== STATS (optimized) =====================
  async getStats() {
    try {
      // Use cached getCourses/getSubjects + lightweight count for students
      const [courses, subjects] = await Promise.all([
        this.getCourses(),
        this.getSubjects()
      ]);

      // Count active students efficiently
      const { count, error } = await this.client
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'activo');
      if (error) throw error;

      return {
        totalCourses: courses.length,
        activeStudents: count || 0,
        totalSubjects: subjects.length
      };
    } catch (e) {
      return { totalCourses: 0, activeStudents: 0, totalSubjects: 0 };
    }
  }
};
