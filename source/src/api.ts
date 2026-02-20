export function getSettings() {
  return {
    gatewayUrl: localStorage.getItem('gatewayUrl') || '',
    token: localStorage.getItem('token') || 'decd6097769042335d4a219057655758f5a9f9d2ff16cfae',
  };
}

export function saveSettings(gatewayUrl: string, token: string) {
  localStorage.setItem('gatewayUrl', gatewayUrl);
  localStorage.setItem('token', token);
}

// The panel API is served from the same origin
export function apiBase() {
  const custom = localStorage.getItem('gatewayUrl');
  return custom || '';
}

async function req(path: string, method = 'GET', body?: unknown) {
  const token = localStorage.getItem('token') || 'decd6097769042335d4a219057655758f5a9f9d2ff16cfae';
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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const getAgents = () => req('/api/agents');
export const listMemory = () => req('/api/memory/list');
export const readMemory = (file: string) => req(`/api/memory/read?file=${encodeURIComponent(file)}`);
export const writeMemory = (file: string, content: string) => req('/api/memory/write', 'POST', { file, content });
export const listFiles = (path = '') => req(`/api/files/list?path=${encodeURIComponent(path)}`);
export const readFile = (path: string) => req(`/api/files/read?path=${encodeURIComponent(path)}`);
export const writeFile = (path: string, content: string) => req('/api/files/write', 'POST', { path, content });
export const sendChat = (message: string, contextFiles: { name: string; content: string }[]) =>
  req('/api/chat/send', 'POST', { message, contextFiles });
export const injectContext = (contextFiles: { name: string; content: string }[]) =>
  req('/api/chat/inject', 'POST', { contextFiles });
export const runAction = (action: string) => req('/api/action', 'POST', { action });

export const authUser = (userData: any) => req('/api/auth', 'POST', { userData });
export const getUserProfile = () => req('/api/user/profile');

export const getSkills = () => req('/api/skills');
export const toggleSkill = (name: string, enabled: boolean) => req('/api/skills/toggle', 'POST', { name, enabled });
