import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { UserModel } from '../models/User.js';

/**
 * 🐳 PROVISIONING CORE
 * Automates isolated environment setup and container lifecycles for users.
 */
export class Provisioning {
  static ROOT_WORKSPACES = '/root/.openclaw/workspaces';
  static SOUL_TEMPLATE = '/root/.openclaw/templates/starter/SOUL.md';
  static IMAGE_NAME = 'openclaw-node-runtime:latest'; // Custom image with OpenClaw installed

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
      
      const templatePath = '/usr/lib/node_modules/openclaw/templates/SOUL.md';
      if (fs.existsSync(templatePath)) {
        soulContent = fs.readFileSync(templatePath, 'utf8');
      }
      
      fs.writeFileSync(soulTarget, soulContent, 'utf8');
    }

    return userPath;
  }

  /**
   * Spawn an isolated container for the user's agent.
   */
  static spawnRuntime(userId) {
    const user = UserModel.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const containerName = `clawbot-${userId}`;
    const userPath = path.join(this.ROOT_WORKSPACES, userId);

    // Stop and remove existing container if it exists
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch (e) {}

    // Spawn new container with resource limits (128MB RAM, 0.5 CPU)
    // -v: Mount the user's workspace
    // --restart: Auto-restart unless stopped
    const dockerCmd = [
      'docker run -d',
      `--name ${containerName}`,
      `--memory 128m`,
      `--cpus 0.5`,
      `-v ${userPath}:/root/.openclaw/workspace`,
      `-e USER_ID=${userId}`,
      `-e AGENT_NAME=${user.username}`,
      this.IMAGE_NAME,
      'openclaw gateway start --foreground'
    ].join(' ');

    console.log(`🐳 Spawning container ${containerName} for user ${userId}`);
    const containerId = execSync(dockerCmd).toString().trim();

    return { containerId, name: containerName, path: userPath };
  }

  /**
   * Stop and cleanup the user's runtime.
   */
  static killRuntime(userId) {
    const containerName = `clawbot-${userId}`;
    try {
      execSync(`docker rm -f ${containerName}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Get runtime status.
   */
  static getStatus(userId) {
    const containerName = `clawbot-${userId}`;
    try {
      const status = execSync(`docker inspect -f '{{.State.Status}}' ${containerName}`).toString().trim();
      return { online: status === 'running', status };
    } catch (e) {
      return { online: false, status: 'not_found' };
    }
  }
}
