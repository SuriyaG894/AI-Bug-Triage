import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentToken: string | null = null;

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[API] 401 Unauthorized for:', error.config?.url);
      console.error('[API] Token present:', !!currentToken);
    }
    return Promise.reject(error);
  }
);

export const setToken = (token: string | null) => {
  currentToken = token;
};

export const getToken = () => currentToken;

export interface Bug {
  id: number;
  title: string;
  description: string;
  priority: string | null;
  severity: string;
  type: string;
  status: string;
  source: string;
  external_id: string | null;
  push_to_external: boolean;
  project_id: number | null;
  created_by: string | null;
  reporter_id?: number | null;
  repro_steps: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  assigned_to: string | null;
  attachments?: { url: string; name: string }[] | null;
  created_at: string;
  updated_at: string;
  analysis: AnalysisResult | null;
  duplicate_justification?: string | null;
  duplicate_of_external_ids?: string[] | null;
}

export interface AnalysisResult {
  bug_id: number;
  root_causes: Array<{cause: string; confidence: number}>;
  confidence_scores: Record<string, number>;
  analyzed_at: string;
}

export interface BugCreate {
  title: string;
  description: string;
  priority?: string;
  severity?: string;
  repro_steps?: string;
  expected_result?: string;
  actual_result?: string;
  attachments?: { url: string; name: string }[] | string[];
  assigned_to?: string;
  created_by?: string;
  reporter_id?: number;
  duplicate_justification?: string;
  duplicate_of_external_ids?: string[];
  project_id?: number | null;
}

export interface BugSuggestion {
  priority: string;
  severity: string;
  bug_type: string;
  confidence: number;
  reasoning: string;
}

export interface BugListResponse {
  total: number;
  bugs: Bug[];
}

export interface DuplicateCheckResponse {
  is_duplicate: boolean;
  similar_bugs: Array<{
    id: number | null;
    title: string;
    description: string;
    severity: string;
    type: string;
    status: string;
    source: string;
    similarity: number;
    external_url?: string | null;
    external_id?: string | null;
  }>;
  message: string;
}

export interface Integration {
  id: number;
  tool_type: string;
  name: string | null;
  auth_type: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  org: string | null;
  project: string | null;
}

export interface PushBugResponse {
  success: boolean;
  external_id?: string;
  url?: string;
  message: string;
  attachment_errors?: string[];
}

export const bugApi = {
  list: (params?: { severity?: string; type?: string; status?: string; search?: string; project_id?: number }) =>
    api.get<BugListResponse>('/bugs', { params }),

  get: (id: number) => api.get<Bug>(`/bugs/${id}`),

  create: (data: BugCreate) => api.post<Bug>('/bugs', data),

  update: (id: number, data: Partial<Bug>) => api.put<Bug>(`/bugs/${id}`, data),

  delete: (id: number) => api.delete(`/bugs/${id}`),

  checkDuplicate: (title: string, description: string, reproSteps?: string) =>
    api.post<DuplicateCheckResponse>('/bugs/check-duplicate', { title, description, repro_steps: reproSteps }),

  checkDuplicateWithExclude: (title: string, description: string, omitBugId: number, reproSteps?: string) =>
    api.post<DuplicateCheckResponse>('/bugs/check-duplicate', { title, description, omit_bug_id: omitBugId, repro_steps: reproSteps }),

  suggest: (title: string, description: string, reproSteps?: string) =>
    api.post<BugSuggestion>('/bugs/suggest', {
      title,
      description,
      repro_steps: reproSteps
    }),

  pushToExternal: (bugId: number, toolType: string, projectKey?: string) =>
    api.post<PushBugResponse>(`/bugs/${bugId}/push`, null, {
      params: { tool_type: toolType, project_key: projectKey }
    }),
};

export const analyticsApi = {
  summary: () => api.get('/analytics/summary'),
  severityDistribution: () => api.get('/analytics/severity-distribution'),
  typeDistribution: () => api.get('/analytics/type-distribution'),
  trends: (days?: number) => api.get('/analytics/trends', { params: { days } }),
  commonRootCauses: () => api.get('/analytics/common-root-causes'),
};

export const integrationApi = {
  list: () => api.get<Integration[]>('/integrations'),
  
  create: (data: { tool_type: string; name?: string; auth_type: string; credentials?: string; config?: any; org?: string; project?: string }) =>
    api.post<Integration>('/integrations', data),
  
  get: (id: number) => api.get<Integration>(`/integrations/${id}`),
  
  update: (id: number, data: Partial<Integration>) =>
    api.put<Integration>(`/integrations/${id}`, data),
  
  delete: (id: number) => api.delete(`/integrations/${id}`),
  
  sync: (id: number) => api.post(`/integrations/${id}/sync`),
  
  status: (id: number) => api.get(`/integrations/${id}/status`),
};

export const uploadApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      let detail = 'Upload failed';
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.detail) detail = parsed.detail;
      } catch {}
      throw new Error(detail);
    }
    return response.json();
  },
};

export interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  ado_project_id: string | null;
  ado_project_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  assigned_users?: Array<{ user_id: number; email: string; full_name: string | null }>;
}

export const projectApi = {
  list: () => api.get<Project[]>('/admin/projects'),
  get: (id: number) => api.get<Project>(`/admin/projects/${id}`),
  create: (data: { name: string; description?: string; ado_project_id?: string; ado_project_name?: string }) =>
    api.post<Project>('/admin/projects', data),
  update: (id: number, data: { name?: string; description?: string; is_active?: boolean }) =>
    api.put<Project>(`/admin/projects/${id}`, data),
  delete: (id: number) => api.delete(`/admin/projects/${id}`),
  assignUsers: (projectId: number, userIds: number[]) =>
    api.post(`/admin/projects/${projectId}/assign-users`, { user_ids: userIds }),
  syncFromADO: () => api.post('/admin/projects/sync-from-ado'),
  myProjects: () => api.get<Project[]>('/admin/my/projects'),
};

export interface AdminDashboardStats {
  total_users: number;
  active_users: number;
  total_bugs: number;
  open_bugs: number;
  closed_bugs: number;
  synced_bugs: number;
}

export interface AdminSyncStatus {
  is_running: boolean;
  interval_minutes: number;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_result: Record<string, unknown> | null;
  total_synced: number;
  next_sync_at: string | null;
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>('/admin/users'),
  
  getUser: (id: number) => api.get<AdminUser>(`/admin/users/${id}`),
  
  updateUserRole: (id: number, is_admin: boolean) => 
    api.patch(`/admin/users/${id}/role`, { is_admin }),
  
  updateUserStatus: (id: number, is_active: boolean) => 
    api.patch(`/admin/users/${id}/status`, { is_active }),
  
  getDashboardStats: () => api.get<AdminDashboardStats>('/admin/dashboard/stats'),
  
  getSyncStatus: () => api.get<AdminSyncStatus>('/admin/sync/status'),
  
  triggerSync: () => api.post('/admin/sync/trigger'),
  
  updateSyncConfig: (interval_minutes: number, auto_sync_enabled: boolean) => 
    api.post('/admin/sync/config', { interval_minutes, auto_sync_enabled }),
  
  startSync: () => api.post('/admin/sync/start'),
  
  stopSync: () => api.post('/admin/sync/stop'),
  
  clearSync: () => api.post('/admin/sync/clear'),
  
  listIntegrations: () => api.get('/admin/integrations'),
  
  testIntegrationCredentials: (data: { tool_type: string; credentials: string; org?: string }) =>
    api.post('/admin/integrations/test-credentials', data),
  
  testIntegration: (id: number) => api.post(`/admin/integrations/test/${id}`),
};

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export const authApi = {
  updateProfile: (full_name: string) =>
    api.patch<AuthUser>('/auth/me', { full_name }),
  
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  
  verifyOTP: (email: string, otp: string) =>
    api.post<{ reset_token: string; message: string }>('/auth/verify-otp', { email, otp }),
  
  resetPassword: (reset_token: string, new_password: string) =>
    api.post('/auth/reset-password', { reset_token, new_password }),
};

export interface PasswordResetResponse {
  reset_token?: string;
  message: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  total: number;
  logs: AuditLogEntry[];
  page: number;
  page_size: number;
}

export const auditApi = {
  myLogs: (params?: { days?: number; page?: number; page_size?: number }) =>
    api.get<AuditLogListResponse>('/audit/logs', { params }),

  adminListLogs: (params?: { user_id?: number; user_email?: string; action?: string; days?: number; page?: number; page_size?: number }) =>
    api.get<AuditLogListResponse>('/admin/audit-logs', { params }),
};

export interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  metadata_?: Record<string, any> | null;
  created_at: string;
}

export interface NotificationListResponse {
  total: number;
  unread_count: number;
  notifications: NotificationItem[];
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationApi = {
  list: (params?: { limit?: number; offset?: number; unread_only?: boolean }) =>
    api.get<NotificationListResponse>('/notifications', { params }),

  unreadCount: () =>
    api.get<UnreadCountResponse>('/notifications/unread-count'),

  markRead: (id: number) =>
    api.put(`/notifications/${id}/read`),

  markAllRead: () =>
    api.put('/notifications/read-all'),

  getSettings: () =>
    api.get<{ email_notifications: boolean }>('/notifications/settings'),

  updateSettings: (data: { email_notifications: boolean }) =>
    api.put('/notifications/settings', data),
};

export default api;
