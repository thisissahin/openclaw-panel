import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { UserModel } from '../models/User.js';

/**
 * 🚀 PROVISIONING CORE
 * Automates isolated environment setup for users.
 */
export class Provisioning {
  static ROOT_WORKSPACES = '/root/.openclaw/workspaces';
  static SOUL_TEMPLATE = '/root/.openclaw/templates/starter/SOUL.md';

  /**
   * Set up a user's isolated workspace.
   */
  static setupWorkspace(userId, username) {
    const userPath = path.join(this.ROOT_WORKSPACES, userId);
    
    // 1. Create directory
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true });
    }

    // 2. Provision initial Soul
    const soulTarget = path.join(userPath, 'SOUL.md');
    if (!fs.existsSync(soulTarget)) {
      let soulContent = `# SOUL for ${username}\nYou are a helpful AI bot running in an isolated container.`;
      
      if (fs.existsSync(this.SOUL_TEMPLATE)) {
        soulContent = fs.readFileSync(this.SOUL_TEMPLATE, 'utf8');
      }
      
      fs.writeFileSync(soulTarget, soulContent, 'utf8');
    }

    return userPath;
  }

  /**
   * Spawn an isolated NanoBot container (MOCK for now).
   */
  static spawnRuntime(userId) {
    const user = UserModel.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const containerName = `clawbot-${userId}`;
    
    // Real Docker command would go here:
    // execSync(`docker run -d --name ${containerName} ...`);
    
    console.log(`🐳 [MOCK] Spawning container ${containerName} for user ${userId}`);
    
    return { containerId: `mock-cont-${userId}`, name: containerName };
  }
}
