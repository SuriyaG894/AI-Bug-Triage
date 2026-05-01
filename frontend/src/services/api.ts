import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  created_by: string | null;
  reporter_id?: number | null;
  repro_steps: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  assigned_to: string | null;
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
}

export interface PushBugResponse {
  success: boolean;
  external_id?: string;
  url?: string;
  message: string;
}

export const bugApi = {
  list: (params?: { severity?: string; type?: string; status?: string; search?: string }) =>
    api.get<BugListResponse>('/bugs', { params }),
  
  get: (id: number) => api.get<Bug>(`/bugs/${id}`),
  
  create: (data: BugCreate) => api.post<Bug>('/bugs', data),
  
  update: (id: number, data: Partial<Bug>) => api.put<Bug>(`/bugs/${id}`, data),
  
  delete: (id: number) => api.delete(`/bugs/${id}`),
  
  checkDuplicate: (title: string, description: string) =>
    api.post<DuplicateCheckResponse>('/bugs/check-duplicate', { title, description }),
  
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
  
  create: (data: { tool_type: string; name?: string; auth_type: string; credentials?: string }) =>
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
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Upload failed');
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
  
  listIntegrations: () => api.get('/admin/integrations'),
  
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

export default api;
