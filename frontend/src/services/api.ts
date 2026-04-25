import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  repro_steps: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  analysis?: AnalysisResult | null;
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
    id: number;
    title: string;
    description: string;
    severity: string;
    type: string;
    status: string;
    source: string;
    similarity: number;
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

export default api;
