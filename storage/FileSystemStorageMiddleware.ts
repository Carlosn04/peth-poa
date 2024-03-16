import { promises as fs } from 'fs';
import { join } from 'path';
import { IStorageMiddleware } from '../interfaces/IStorageMiddleware';

export default class FileSystemStorageMiddleware implements IStorageMiddleware {
  async writeFile(path: string, data: string): Promise<void> {
    await fs.writeFile(path, data);
  }

  async readFile(path: string): Promise<string> {
    return fs.readFile(path, { encoding: 'utf8' });
  }

  async deleteFile(path: string): Promise<void> {
    await fs.unlink(path);
  }

  async ensureDir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  async moveDir(srcPath: string, destPath: string): Promise<void> {
    await fs.rename(srcPath, destPath)
  }

  async copyFile(srcPath: string, destPath: string): Promise<void> {
    await fs.copyFile(srcPath, destPath);
  }

  async copyDirectory(srcDir: string, destDir: string): Promise<void> {
    await this.ensureDir(destDir); // Ensure the destination directory exists
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath); // Recursively copy subdirectories
      } else {
        await fs.copyFile(srcPath, destPath); // Copy files
      }
    }
  }
}