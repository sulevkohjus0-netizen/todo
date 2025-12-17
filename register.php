<?php
// server/public/register.php
$dbPath = __DIR__ . '/../database.db';
$db = new SQLite3($dbPath);

// Create the registration table if it's missing
$db->exec("CREATE TABLE IF NOT EXISTS registered_devices (serial_number TEXT UNIQUE)");

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['sn'])) {
    $sn = strtoupper(trim($_POST['sn']));
    $stmt = $db->prepare("INSERT OR IGNORE INTO registered_devices (serial_number) VALUES (:sn)");
    $stmt->bindValue(':sn', $sn, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo "<p style='color:green'>✅ S/N <b>$sn</b> is now registered locally!</p>";
    } else {
        echo "<p style='color:red'>❌ Error saving to database.</p>";
    }
}
?>
<form method="POST">
    <h2>Local S/N Registration</h2>
    <input type="text" name="sn" placeholder="C38JCATYDTWF" required>
    <button type="submit">Register S/N</button>
</form>