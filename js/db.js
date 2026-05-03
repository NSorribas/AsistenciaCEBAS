/* =============================================
   CEBAS Asistencia - Database Module (Supabase)
   All CRUD operations for the application
   ============================================= */

const DB = {
  client: null,
  connected: false,

  // ---- Hardcoded credentials (auto-connect from any device) ----
  // The anon key is public by design - it's sent in every browser request anyway.
  // Replace these values with your actual Supabase project credentials:
  DEFAULT_URL: 'https://zkrtvxuxmwhilhunapoj.supabase.co',
  DEFAULT_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcnR2eHV4bXdoaWxodW5hcG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDI0ODgsImV4cCI6MjA5MzQxODQ4OH0.rGmDUeL0aeK3h2dQ433vgL4boF-3tUndidWpxmIfb90',

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
    Utils.removeLocal('supabase_url');
    Utils.removeLocal('supabase_key');
  },

  // ---- Restore connection (hardcoded > localStorage > setup) ----
  restore() {
    // Try hardcoded credentials first (works on any device)
    if (this.DEFAULT_URL && this.DEFAULT_KEY) {
      return this.init(this.DEFAULT_URL, this.DEFAULT_KEY);
    }
    // Fall back to localStorage
    const url = Utils.loadLocal('supabase_url');
    const key = Utils.loadLocal('supabase_key');
    if (url && key) {
      return this.init(url, key);
    }
    return false;
  },

  // ===================== COURSES =====================
  async getCourses() {
    const { data, error } = await this.client
      .from('courses')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async addCourse(name) {
    const { data, error } = await this.client
      .from('courses')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCourse(id, name) {
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
    const { error } = await this.client
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== SUBJECTS =====================
  async getSubjects() {
    const { data, error } = await this.client
      .from('subjects')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async addSubject(name) {
    const { data, error } = await this.client
      .from('subjects')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSubject(id, name) {
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
    const { error } = await this.client
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== STUDENTS =====================
  async getStudents(filters = {}) {
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
    return data || [];
  },

  async getStudentById(id) {
    const { data, error } = await this.client
      .from('students')
      .select('*, courses(id, name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async addStudent(student) {
    const { data, error } = await this.client
      .from('students')
      .insert(student)
      .select('*, courses(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async addStudentsBatch(students) {
    const { data, error } = await this.client
      .from('students')
      .insert(students)
      .select('*, courses(id, name)');
    if (error) throw error;
    return data || [];
  },

  async updateStudent(id, updates) {
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
    const { error } = await this.client
      .from('students')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ===================== SCHEDULE =====================
  async getSchedule(courseId) {
    const { data, error } = await this.client
      .from('schedule')
      .select('*, subjects(id, name)')
      .eq('course_id', courseId)
      .order('day_of_week')
      .order('hour_slot');
    if (error) throw error;
    return data || [];
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
    const { data, error } = await this.client
      .from('schedule')
      .insert(entry)
      .select('*, subjects(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async addScheduleBatch(entries) {
    const { data, error } = await this.client
      .from('schedule')
      .insert(entries)
      .select('*, subjects(id, name)');
    if (error) throw error;
    return data || [];
  },

  async updateScheduleEntry(id, updates) {
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
    const { error } = await this.client
      .from('schedule')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async deleteScheduleByCourse(courseId) {
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
    // Get schedule for this course and day, then get attendance
    const jsDay = Utils.getDayOfWeek(date); // 0=Sun, 1=Mon...
    if (jsDay === 0 || jsDay === 6) return { schedule: [], attendance: [] };

    const dbDay = jsDay; // 1=Mon...5=Fri matches our DB

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
    // Upsert attendance records
    const { data, error } = await this.client
      .from('attendance')
      .upsert(records, { onConflict: 'student_id,schedule_id,date' })
      .select();
    if (error) throw error;
    return data || [];
  },

  async deleteAttendanceByDate(date, scheduleIds) {
    if (!scheduleIds || scheduleIds.length === 0) return;
    const { error } = await this.client
      .from('attendance')
      .delete()
      .eq('date', date)
      .in('schedule_id', scheduleIds);
    if (error) throw error;
  },

  // ===================== HOLIDAYS =====================
  async getHolidays() {
    const { data, error } = await this.client
      .from('holidays')
      .select('*')
      .order('date');
    if (error) throw error;
    return data || [];
  },

  async addHoliday(date, description) {
    const { data, error } = await this.client
      .from('holidays')
      .insert({ date, description })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteHoliday(id) {
    const { error } = await this.client
      .from('holidays')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async isHoliday(date) {
    const { data, error } = await this.client
      .from('holidays')
      .select('id')
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
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
    const { data, error } = await this.client
      .from('teacher_absences')
      .insert({ subject_id: subjectId, course_id: courseId, date })
      .select('*, subjects(id, name), courses(id, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTeacherAbsence(id) {
    const { error } = await this.client
      .from('teacher_absences')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async isTeacherAbsent(subjectId, courseId, date) {
    const { data, error } = await this.client
      .from('teacher_absences')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('course_id', courseId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
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

    // Filter out recess entries for reporting
    query = query.eq('schedule.is_recess', false);

    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date', filters.dateTo);
    if (filters.courseId) query = query.eq('students.course_id', filters.courseId);
    if (filters.studentId) query = query.eq('student_id', filters.studentId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // ===================== STATS =====================
  async getStats() {
    try {
      const [courses, students, subjects] = await Promise.all([
        this.getCourses(),
        this.getStudents({ status: 'activo' }),
        this.getSubjects()
      ]);
      return {
        totalCourses: courses.length,
        activeStudents: students.length,
        totalSubjects: subjects.length
      };
    } catch (e) {
      return { totalCourses: 0, activeStudents: 0, totalSubjects: 0 };
    }
  }
};
