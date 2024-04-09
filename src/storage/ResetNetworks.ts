#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config'; // Adjust the import path as necessary

// Function to delete a directory and its contents recursively
function deleteDirectory(directoryPath: string): void {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file) => {
            const currentPath = path.join(directoryPath, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
                deleteDirectory(currentPath);
            } else {
                fs.unlinkSync(currentPath);
            }
        });
        fs.rmdirSync(directoryPath);
    }
}

// Reset networks by deleting the networksBasePath directory
deleteDirectory(config.networksBasePath);