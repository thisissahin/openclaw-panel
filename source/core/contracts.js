/**
 * Runtime Interface Contract
 * All execution engines (NanoBot, OpenClaw, etc.) must implement this.
 */
export interface ClawBotsRuntime {
  id: string; // 'nanobot' | 'openclaw'
  
  // Lifecycle
  spawn(userId: string): Promise<string>; // returns containerId
  kill(userId: string): Promise<void>;
  
  // Messaging
  sendMessage(userId: string, text: string): Promise<string>;
  
  // State
  getLogs(userId: string): Promise<string[]>;
}

/**
 * Interface Contract
 * All entry points (Telegram, Web, etc.) must implement this.
 */
export interface ClawBotsInterface {
  id: string; // 'telegram' | 'web'
  
  // Messaging
  notifyUser(userId: string, text: string): Promise<void>;
  
  // Auth
  verify(payload: any): Promise<boolean>;
}
