const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');

function deleteDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir).filter(file => file !== '.' && file !== '..');
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        
        if (fs.lstatSync(filePath).isDirectory()) {
            deleteDir(filePath);
        } else {
            fs.unlinkSync(filePath);
        }
    });
    
    fs.rmdirSync(dir);
}

function cleanup() {
    const stages = ['stage1', 'stage2', 'stage3'];
    const now = Date.now();
    
    stages.forEach(stage => {
        const stageDir = path.join(CACHE_DIR, stage);
        
        if (!fs.existsSync(stageDir)) return;
        
        const folders = fs.readdirSync(stageDir).filter(folder => folder !== '.' && folder !== '..');
        
        folders.forEach(folder => {
            const folderPath = path.join(stageDir, folder);
            
            if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
                const stats = fs.statSync(folderPath);
                const ageInSeconds = (now - stats.mtimeMs) / 1000;
                
                if (ageInSeconds > 600) { // 10 minutes
                    console.log(`Deleting old directory: ${folderPath} (age: ${Math.round(ageInSeconds)}s)`);
                    deleteDir(folderPath);
                }
            }
        });
    });
    
    console.log('Cleanup completed');
}

// Export for use in Express/HTTP server
module.exports = { cleanup, deleteDir };

// If run directly (for cron job)
if (require.main === module) {
    cleanup();
}
