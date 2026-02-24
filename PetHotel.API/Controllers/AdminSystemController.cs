using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PetHotel.API.Services;
using PetHotel.Infrastructure.Data;

namespace PetHotel.API.Controllers;

[Route("api/admin/system")]
public class AdminSystemController : BaseApiController
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<AdminSystemController> _logger;
    private readonly AuditService _audit;

    public AdminSystemController(ApplicationDbContext dbContext, ILogger<AdminSystemController> logger, AuditService audit)
    {
        _dbContext = dbContext;
        _logger = logger;
        _audit = audit;
    }

    // ── Helpers ──────────────────────────────────────────────

    private string? ResolveDatabasePath()
    {
        var connectionString = _dbContext.Database.GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString)) return null;

        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.DataSource)) return null;

        return Path.IsPathRooted(builder.DataSource)
            ? builder.DataSource
            : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), builder.DataSource));
    }

    // ── Database info ───────────────────────────────────────

    [HttpGet("database/info")]
    public IActionResult GetDatabaseInfo()
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            var dbPath = ResolveDatabasePath();
            if (dbPath == null)
                return StatusCode(500, new { error = "Не удалось определить путь к базе данных" });

            var dbDir = Path.GetDirectoryName(dbPath) ?? "";
            var backupDir = Path.Combine(dbDir, "backups");

            long dbSizeBytes = 0;
            if (System.IO.File.Exists(dbPath))
                dbSizeBytes = new FileInfo(dbPath).Length;

            var backups = new List<object>();
            if (Directory.Exists(backupDir))
            {
                foreach (var file in Directory.GetFiles(backupDir, "*.db").OrderByDescending(f => f))
                {
                    var fi = new FileInfo(file);
                    backups.Add(new
                    {
                        fileName = fi.Name,
                        sizeBytes = fi.Length,
                        createdAt = fi.CreationTime,
                    });
                }
            }

            return Ok(new
            {
                databasePath = dbPath,
                databaseSizeBytes = dbSizeBytes,
                backupDirectory = backupDir,
                auditLogPath = _audit.GetLogFilePath(),
                backups,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при получении информации о БД");
            return StatusCode(500, new { error = "Ошибка при получении информации о БД", details = ex.Message });
        }
    }

    // ── Backup ──────────────────────────────────────────────

    [HttpPost("database/backup")]
    public async Task<IActionResult> CreateDatabaseBackup()
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            var databasePath = ResolveDatabasePath();
            if (databasePath == null || !System.IO.File.Exists(databasePath))
                return NotFound(new { error = "Файл базы данных не найден" });

            var databaseDirectory = Path.GetDirectoryName(databasePath)!;
            var backupDirectory = Path.Combine(databaseDirectory, "backups");
            Directory.CreateDirectory(backupDirectory);

            var backupFileName = $"pethotel-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.db";
            var backupPath = Path.Combine(backupDirectory, backupFileName);
            var escapedBackupPath = backupPath.Replace("'", "''", StringComparison.Ordinal);

            var connectionString = _dbContext.Database.GetConnectionString()!;
            await using (var backupConnection = new SqliteConnection(connectionString))
            {
                await backupConnection.OpenAsync();
                await using var command = backupConnection.CreateCommand();
                command.CommandText = $"VACUUM INTO '{escapedBackupPath}';";
                await command.ExecuteNonQueryAsync();
            }

            _logger.LogInformation("Создан бэкап базы данных: {BackupPath}", backupPath);
            await _audit.LogAsync("СОЗДАНИЕ БЭКАПА",
                $"Бэкап БД создан вручную: {backupFileName}",
                $"Путь: {backupPath}\nРазмер БД: {new FileInfo(databasePath).Length} байт");

            var stream = new FileStream(backupPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(stream, "application/octet-stream", backupFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при создании бэкапа базы данных");
            return StatusCode(500, new { error = "Ошибка при создании бэкапа базы данных", details = ex.Message });
        }
    }

    // ── Restore ─────────────────────────────────────────────

    [HttpPost("database/restore")]
    [RequestSizeLimit(100 * 1024 * 1024)]
    public async Task<IActionResult> RestoreDatabaseFromUpload(IFormFile file)
    {
        if (!IsAdmin()) return Forbid();

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Файл не предоставлен" });

        if (!file.FileName.EndsWith(".db", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Файл должен иметь расширение .db" });

        try
        {
            var databasePath = ResolveDatabasePath();
            if (databasePath == null)
                return StatusCode(500, new { error = "Не удалось определить путь к базе данных" });

            var databaseDirectory = Path.GetDirectoryName(databasePath)!;

            // 1. Validate uploaded file
            var tempPath = Path.Combine(databaseDirectory, $"restore-temp-{Guid.NewGuid()}.db");
            await using (var tempStream = new FileStream(tempPath, FileMode.Create))
            {
                await file.CopyToAsync(tempStream);
            }

            try
            {
                await using var testConn = new SqliteConnection($"Data Source={tempPath};Mode=ReadOnly");
                await testConn.OpenAsync();
                await using var testCmd = testConn.CreateCommand();
                testCmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table';";
                var tableCount = Convert.ToInt32(await testCmd.ExecuteScalarAsync());
                if (tableCount == 0)
                {
                    System.IO.File.Delete(tempPath);
                    return BadRequest(new { error = "Файл не содержит таблиц — не похож на валидную БД" });
                }
            }
            catch (Exception ex)
            {
                if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath);
                return BadRequest(new { error = "Файл не является валидной SQLite базой данных", details = ex.Message });
            }

            // 2. Auto-backup
            var backupDir = Path.Combine(databaseDirectory, "backups");
            Directory.CreateDirectory(backupDir);
            var preRestoreBackup = Path.Combine(backupDir, $"pethotel-pre-restore-{DateTime.UtcNow:yyyyMMdd-HHmmss}.db");

            if (System.IO.File.Exists(databasePath))
            {
                var connectionString = _dbContext.Database.GetConnectionString()!;
                await using (var conn = new SqliteConnection(connectionString))
                {
                    await conn.OpenAsync();
                    await using var cmd = conn.CreateCommand();
                    var escaped = preRestoreBackup.Replace("'", "''", StringComparison.Ordinal);
                    cmd.CommandText = $"VACUUM INTO '{escaped}';";
                    await cmd.ExecuteNonQueryAsync();
                }
            }

            // 3. Log BEFORE replacing the database (log is in file, not DB)
            await _audit.LogAsync("ВОССТАНОВЛЕНИЕ ИЗ ФАЙЛА",
                $"БД восстановлена из загруженного файла: {file.FileName}",
                $"Размер файла: {file.Length} байт\nПред-бэкап: {Path.GetFileName(preRestoreBackup)}");

            // 4. Replace database
            await _dbContext.Database.CloseConnectionAsync();
            SqliteConnection.ClearAllPools();
            await Task.Delay(200);

            System.IO.File.Copy(tempPath, databasePath, overwrite: true);
            System.IO.File.Delete(tempPath);

            var walPath = databasePath + "-wal";
            var shmPath = databasePath + "-shm";
            if (System.IO.File.Exists(walPath)) System.IO.File.Delete(walPath);
            if (System.IO.File.Exists(shmPath)) System.IO.File.Delete(shmPath);

            _logger.LogInformation("БД восстановлена из файла: {FileName}", file.FileName);

            return Ok(new
            {
                message = "База данных восстановлена. Рекомендуется перезапустить приложение.",
                preRestoreBackup = Path.GetFileName(preRestoreBackup),
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при восстановлении базы данных");
            return StatusCode(500, new { error = "Ошибка при восстановлении базы данных", details = ex.Message });
        }
    }

    [HttpPost("database/restore-from-backup")]
    public async Task<IActionResult> RestoreFromBackup([FromBody] RestoreFromBackupRequest request)
    {
        if (!IsAdmin()) return Forbid();

        if (string.IsNullOrWhiteSpace(request?.FileName))
            return BadRequest(new { error = "Имя файла не указано" });

        var safeName = Path.GetFileName(request.FileName);
        if (safeName != request.FileName || !safeName.EndsWith(".db", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Недопустимое имя файла" });

        try
        {
            var databasePath = ResolveDatabasePath();
            if (databasePath == null)
                return StatusCode(500, new { error = "Не удалось определить путь к базе данных" });

            var databaseDirectory = Path.GetDirectoryName(databasePath)!;
            var backupDir = Path.Combine(databaseDirectory, "backups");
            var backupPath = Path.Combine(backupDir, safeName);

            if (!System.IO.File.Exists(backupPath))
                return NotFound(new { error = "Файл бэкапа не найден" });

            // Auto-backup
            var preRestoreBackup = Path.Combine(backupDir, $"pethotel-pre-restore-{DateTime.UtcNow:yyyyMMdd-HHmmss}.db");
            if (System.IO.File.Exists(databasePath))
            {
                var connectionString = _dbContext.Database.GetConnectionString()!;
                await using (var conn = new SqliteConnection(connectionString))
                {
                    await conn.OpenAsync();
                    await using var cmd = conn.CreateCommand();
                    var escaped = preRestoreBackup.Replace("'", "''", StringComparison.Ordinal);
                    cmd.CommandText = $"VACUUM INTO '{escaped}';";
                    await cmd.ExecuteNonQueryAsync();
                }
            }

            // Log BEFORE replacing the database
            await _audit.LogAsync("ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА",
                $"БД восстановлена из бэкапа: {safeName}",
                $"Пред-бэкап: {Path.GetFileName(preRestoreBackup)}");

            // Replace
            await _dbContext.Database.CloseConnectionAsync();
            SqliteConnection.ClearAllPools();
            await Task.Delay(200);

            System.IO.File.Copy(backupPath, databasePath, overwrite: true);

            var walPath = databasePath + "-wal";
            var shmPath = databasePath + "-shm";
            if (System.IO.File.Exists(walPath)) System.IO.File.Delete(walPath);
            if (System.IO.File.Exists(shmPath)) System.IO.File.Delete(shmPath);

            _logger.LogInformation("БД восстановлена из бэкапа: {FileName}", safeName);

            return Ok(new
            {
                message = "База данных восстановлена. Рекомендуется перезапустить приложение.",
                preRestoreBackup = Path.GetFileName(preRestoreBackup),
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при восстановлении из бэкапа");
            return StatusCode(500, new { error = "Ошибка при восстановлении из бэкапа", details = ex.Message });
        }
    }

    // ── Audit log (file-based) ──────────────────────────────

    /// <summary>
    /// Returns audit log contents (plain text from file).
    /// </summary>
    [HttpGet("audit-log")]
    public IActionResult GetAuditLog()
    {
        if (!IsAdmin()) return Forbid();

        var logContent = _audit.ReadLog();
        return Ok(new
        {
            logFilePath = _audit.GetLogFilePath(),
            content = logContent,
        });
    }
}

public class RestoreFromBackupRequest
{
    public string FileName { get; set; } = "";
}
