import { promises as fs, Dirent } from 'fs';

export interface IStorageMiddleware {
    writeFile(path: string, data: string): Promise<void>;
    readFile(path: string): Promise<string>;
    readDir(path: string): Promise<Dirent[]>
    deleteFile(path: string): Promise<void>;
    ensureDir(path: string): Promise<void>;
    moveDir(srcPath: string, destPath: string): Promise<void>;
    copyFile(srcPath: string, destPath: string): Promise<void>;
    copyDirectory(srcDir: string, destDir: string): Promise <void>;
}