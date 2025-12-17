const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Enable error reporting for debugging
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
});

// Function to generate random directory name
function generateRandomName(length = 16) {
    return crypto.randomBytes(length / 2).toString('hex');
}

// Function to read SQL dump from .png file
function readSQLDump(filename) {
    if (!fs.existsSync(filename)) {
        throw new Error(`Error: File ${filename} not found`);
    }
    return fs.readFileSync(filename, 'utf8');
}

// Function to create SQLite database from SQL dump
async function createSQLiteFromDump(sqlDump, outputFile) {
    try {
        // Remove or replace ALL unistr() functions - more aggressive approach
        // Match unistr with single or double quotes, with or without spaces
        sqlDump = sqlDump.replace(
            /unistr\s*\(\s*['"]([^'"]*)['"]\s*\)/gi,
            function(matches) {
                let str = matches[1];
                // Convert \XXXX to actual unicode characters
                str = str.replace(/\\\\([0-9A-Fa-f]{4})/g, function(m) {
                    const hex = m[1];
                    return Buffer.from(hex, 'hex').toString('utf16le');
                });
                return "'" + str.replace(/'/g, "''") + "'";
            }
        );
        
        // Alternative: If still failing, just remove unistr entirely and keep the string
        sqlDump = sqlDump.replace(/unistr\s*\(\s*(['"][^'"]*['"])\s*\)/gi, "$1");
        
        // Create SQLite database using sqlite3 command line
        // We'll write the SQL to a temp file and execute it
        const tempSqlFile = outputFile.replace('.sqlite', '_temp.sql');
        fs.writeFileSync(tempSqlFile, sqlDump);
        
        // Create empty database file
        fs.writeFileSync(outputFile, '');
        
        // Execute SQL commands using sqlite3 CLI
        // Note: This requires sqlite3 to be installed on the system
        try {
            execSync(`sqlite3 ${outputFile} < ${tempSqlFile}`, { stdio: 'inherit' });
        } catch (sqlError) {
            console.warn('SQL execution warnings:', sqlError.message);
        }
        
        // Clean up temp file
        fs.unlinkSync(tempSqlFile);
        
        return true;
    } catch (e) {
        throw new Error(`Error creating SQLite database: ${e.message}`);
    }
}

// Main function to handle the request
async function handleRequest(params) {
    const basePath = process.cwd(); // Current working directory
    
    const { prd, guid, sn } = params;
    
    if (!prd || !guid || !sn) {
        throw new Error("Error: Missing required parameters (prd, guid, sn)");
    }
    
    // Replace comma with dash in prd
    const prdFormatted = prd.replace(/,/g, '-');
    
    // Step 1: Get the plist file
    let plistPath = path.join(basePath, "Maker", prdFormatted, "com.apple.MobileGestalt.plist");
    
    // Debug: Check actual file system
    if (!fs.existsSync(plistPath)) {
        // Try alternative paths
        const altPath1 = path.join(__dirname, "Maker", prdFormatted, "com.apple.MobileGestalt.plist");
        const altPath2 = path.join(process.env.DOCUMENT_ROOT || "", "bee33", "Maker", prdFormatted, "com.apple.MobileGestalt.plist");
        
        if (fs.existsSync(altPath1)) {
            plistPath = altPath1;
        } else if (fs.existsSync(altPath2)) {
            plistPath = altPath2;
        } else {
            throw new Error(`Error: Plist file not found. Tried:
1. ${plistPath}
2. ${altPath1}
3. ${altPath2}
Script Dir: ${__dirname}
Document Root: ${process.env.DOCUMENT_ROOT || 'Not set'}`);
        }
    }
    
    // Step 2: Create ZIP file with Caches folder
    const randomName1 = generateRandomName();
    const firstStepDir = path.join(basePath, "firststp", randomName1);
    if (!fs.existsSync(firstStepDir)) {
        fs.mkdirSync(firstStepDir, { recursive: true, mode: 0o755 });
    }
    
    const zipPath = path.join(firstStepDir, "temp.zip");
    const fixedFilePath = path.join(firstStepDir, "fixedfile");
    
    // Create ZIP file (simplified - in real app you'd use archiver or similar)
    // For now, we'll just create the directory structure
    const cachesDir = path.join(firstStepDir, "Caches");
    if (!fs.existsSync(cachesDir)) {
        fs.mkdirSync(cachesDir, { recursive: true });
    }
    
    // Copy plist to Caches folder
    fs.copyFileSync(plistPath, path.join(cachesDir, "com.apple.MobileGestalt.plist"));
    
    // Create a simple zip (this is a placeholder - use a proper zip library in production)
    const zipContent = "ZIP placeholder - use archiver library for actual zip creation";
    fs.writeFileSync(zipPath, zipContent);
    
    // Rename zip to fixedfile
    fs.renameSync(zipPath, fixedFilePath);
    
    // Get the URL for fixedfile
    const protocol = process.env.NODE_ENV === 'production' ? "https" : "http";
    const host = process.env.HOST || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;
    const fixedFileUrl = `${baseUrl}/firststp/${randomName1}/fixedfile`;
    
    // Step 3: Process BLDatabaseManager.png
    const blDatabaseDump = readSQLDump(path.join(basePath, "BLDatabaseManager.png"));
    
    // Replace the URL in the dump
    const updatedBlDump = blDatabaseDump.replace(/KEYOOOOOO/g, fixedFileUrl);
    
    // Create SQLite database
    const randomName2 = generateRandomName();
    const secondStepDir = path.join(basePath, "2ndd", randomName2);
    if (!fs.existsSync(secondStepDir)) {
        fs.mkdirSync(secondStepDir, { recursive: true, mode: 0o755 });
    }
    
    const blSqlitePath = path.join(secondStepDir, "BLDatabaseManager.sqlite");
    await createSQLiteFromDump(updatedBlDump, blSqlitePath);
    
    // Rename to BLDatabaseM.png
    const blFinalPath = path.join(secondStepDir, "belliloveu.png");
    fs.renameSync(blSqlitePath, blFinalPath);
    
    // Get the URL for BLDatabaseM.png
    const blDatabaseUrl = `${baseUrl}/2ndd/${randomName2}/belliloveu.png`;
    
    // Step 4: Process downloads.28.png
    const downloadsDump = readSQLDump(path.join(basePath, "downloads.28.png"));
    
    // Replace URLs and GOODKEY
    let updatedDownloadsDump = downloadsDump.replace(/https:\/\/google\.com/g, blDatabaseUrl);
    updatedDownloadsDump = updatedDownloadsDump.replace(/GOODKEY/g, guid);
    
    // Create final SQLite database
    const randomName3 = generateRandomName();
    const lastStepDir = path.join(basePath, "last", randomName3);
    if (!fs.existsSync(lastStepDir)) {
        fs.mkdirSync(lastStepDir, { recursive: true, mode: 0o755 });
    }
    
    const finalSqlitePath = path.join(lastStepDir, "downloads.sqlitedb");
    await createSQLiteFromDump(updatedDownloadsDump, finalSqlitePath);
    
    // Rename to filework.png
    const finalPath = path.join(lastStepDir, "apllefuckedhhh.png");
    fs.renameSync(finalSqlitePath, finalPath);
    
    // Get the URL for final file
    const finalUrl = `${baseUrl}/last/${randomName3}/apllefuckedhhh.png`;
    
    // Return the result
    return {
        success: true,
        parameters: {
            prd: prd,
            guid: guid,
            sn: sn
        },
        links: {
            step1_fixedfile: fixedFileUrl,
            step2_bldatabase: blDatabaseUrl,
            step3_final: finalUrl
        },
        paths: {
            step1: fixedFilePath,
            step2: blFinalPath,
            step3: finalPath
        }
    };
}

// Export the function for use in Express/HTTP server
module.exports = { handleRequest, generateRandomName, readSQLDump, createSQLiteFromDump };

// If run directly (for testing)
if (require.main === module) {
    const params = {
        prd: process.argv[2] || '',
        guid: process.argv[3] || '',
        sn: process.argv[4] || ''
    };
    
    handleRequest(params)
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => console.error(error.message));
}
