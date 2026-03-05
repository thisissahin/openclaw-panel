export function getSettings() {
  return {
    gatewayUrl: localStorage.getItem('gatewayUrl') || '',
    token: localStorage.getItem('token') || '',
  };
}

export function saveSettings(gatewayUrl: string, token: string) {
  localStorage.setItem('gatewayUrl', gatewayUrl);
  localStorage.setItem('token', token);
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}

export function logout() {
  localStorage.removeItem('token');
}

export function apiBase() {
  const custom = localStorage.getItem('gatewayUrl');
  return custom || '';
}

async function req(path: string, method = 'GET', body?: unknown) {
  const token = localStorage.getItem('token') || '';
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get('agent') || 'main';

  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Agent-Id': agentId,
      'X-User-Id': localStorage.getItem('userId') || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const ping = () => fetch(`${apiBase()}/api/ping`).then(r => r.json());
export const getAgents = () => req('/api/agents');
export const createAgent = (payload: { id?: string; name: string; botToken: string; model?: string }) => req('/api/agents/create', 'POST', payload);
export const listMemory = () => req('/api/memory/list');
export const readMemory = (file: string) => req(`/api/memory/read?file=${encodeURIComponent(file)}`);
export const writeMemory = (file: string, content: string) => req('/api/memory/write', 'POST', { file, content });
export const listFiles = (path = '') => req(`/api/files/list?path=${encodeURIComponent(path)}`);
export const readFile = (path: string) => req(`/api/files/read?path=${encodeURIComponent(path)}`);
export const writeFile = (path: string, content: string) => req('/api/files/write', 'POST', { path, content });
export const deleteFile = (path: string) => req(`/api/files/delete?path=${encodeURIComponent(path)}`, 'DELETE');
export const sendChat = (message: string, contextFiles: { name: string; content: string }[]) =>
  req('/api/chat/send', 'POST', { message, contextFiles });
export const runAction = (action: string) => req('/api/action', 'POST', { action });
export const getSkills = () => req('/api/skills');
export const toggleSkill = (name: string, enabled: boolean) => req('/api/skills/toggle', 'POST', { name, enabled });

// OpenClaw config
export const getConfig = () => req('/api/config');
export const patchConfig = (path: string, value: unknown) => req('/api/config', 'PATCH', { path, value });
export const restartGateway = () => req('/api/config/restart', 'POST');

// Sessions (live model switching + management)
export const getSessions = () => req('/api/sessions');
export const patchSessionModel = (key: string, model: string) =>
  req(`/api/sessions/${encodeURIComponent(key)}/model`, 'PATCH', { model });
export const compactSession = (key: string) =>
  req(`/api/sessions/${encodeURIComponent(key)}/compact`, 'POST');
export const resetSession = (key: string) =>
  req(`/api/sessions/${encodeURIComponent(key)}/reset`, 'POST');

// Usage & cost
export const getUsage = () => req('/api/usage');

// Cron jobs
export const getCronJobs = () => req('/api/cron');
export const runCronJob = (id: string) => req(`/api/cron/${id}/run`, 'POST');
export const updateCronJob = (id: string, patch: object) => req(`/api/cron/${id}`, 'PATCH', patch);
export const deleteCronJob = (id: string) => req(`/api/cron/${id}`, 'DELETE');
export const getCronRuns = (id: string) => req(`/api/cron/${id}/runs`);
export const createCronJob = (job: object) => req('/api/cron', 'POST', job);

// Terminal tabs (DB-backed)
export const getTabs = () => req('/api/tabs');
export const saveTab = (id: string, name: string) => req('/api/tabs', 'POST', { id, name });
export const renameTab = (id: string, name: string) => req(`/api/tabs/${id}`, 'PATCH', { name });
export const deleteTab = (id: string) => req(`/api/tabs/${id}`, 'DELETE');
