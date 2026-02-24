using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PetHotel.Infrastructure.Data;

namespace PetHotel.API.Services;

/// <summary>
/// Файловый аудит-лог действий пользователя.
/// Хранит последние 100 записей в текстовом файле (не в БД).
/// Каждые 50 операций автоматически создаёт бэкап БД (перезаписывая предыдущий).
/// </summary>
public class AuditService
{
    private const int MaxEntries = 100;
    private const int BackupEvery = 50;
    private const string LogFileName = "audit-log.txt";
    private const string AutoBackupFileName = "pethotel-auto-backup.db";
    private const string Separator = "════════════════════════════════════════════════════════════════";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AuditService> _logger;
    private readonly string _logFilePath;
    private readonly string _dataDir;

    private readonly object _fileLock = new();
    private int _operationCounter;

    public AuditService(IServiceScopeFactory scopeFactory, ILogger<AuditService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        // Determine data directory (same logic as Program.cs)
        var dataPath = Environment.GetEnvironmentVariable("PETSHOTEL_DATA_PATH")?.Trim();
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            var baseDir = AppContext.BaseDirectory;
            if (baseDir.Contains(Path.Combine("bin", "Debug")) || baseDir.Contains(Path.Combine("bin", "Release")))
            {
                dataPath = Path.Combine(Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..")), "data");
            }
            else
            {
                dataPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PetHotel", "data");
            }
        }

        Directory.CreateDirectory(dataPath);
        _dataDir = dataPath;
        _logFilePath = Path.Combine(dataPath, LogFileName);

        // Initialize counter from existing log
        _operationCounter = CountExistingEntries();
    }

    /// <summary>
    /// Записать действие в аудит-лог с полной информацией.
    /// </summary>
    public async Task LogAsync(string action, string description, string? details = null)
    {
        var entry = new StringBuilder();
        entry.AppendLine(Separator);
        entry.AppendLine($"  [{DateTime.Now:yyyy-MM-dd HH:mm:ss}]  {action}");
        entry.AppendLine($"  {description}");
        if (!string.IsNullOrWhiteSpace(details))
        {
            foreach (var line in details.Split('\n'))
            {
                entry.AppendLine($"    {line.TrimEnd()}");
            }
        }
        entry.AppendLine();

        lock (_fileLock)
        {
            try
            {
                File.AppendAllText(_logFilePath, entry.ToString(), Encoding.UTF8);
                TrimToMaxEntries();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ошибка записи в аудит-лог");
            }
        }

        // Auto-backup every N operations
        var count = Interlocked.Increment(ref _operationCounter);
        if (count % BackupEvery == 0)
        {
            await CreateAutoBackupAsync();
        }
    }

    /// <summary>
    /// Read audit log file contents.
    /// </summary>
    public string ReadLog()
    {
        lock (_fileLock)
        {
            return File.Exists(_logFilePath)
                ? File.ReadAllText(_logFilePath, Encoding.UTF8)
                : "";
        }
    }

    /// <summary>
    /// Get the file path of the audit log.
    /// </summary>
    public string GetLogFilePath() => _logFilePath;

    // ── Private ─────────────────────────────────────────

    private int CountExistingEntries()
    {
        try
        {
            if (!File.Exists(_logFilePath)) return 0;
            var text = File.ReadAllText(_logFilePath, Encoding.UTF8);
            return text.Split(Separator).Length - 1;
        }
        catch
        {
            return 0;
        }
    }

    private void TrimToMaxEntries()
    {
        try
        {
            if (!File.Exists(_logFilePath)) return;

            var text = File.ReadAllText(_logFilePath, Encoding.UTF8);
            var blocks = text.Split(Separator, StringSplitOptions.RemoveEmptyEntries);

            if (blocks.Length <= MaxEntries) return;

            // Keep last MaxEntries blocks
            var kept = blocks.Skip(blocks.Length - MaxEntries).ToArray();
            var sb = new StringBuilder();
            foreach (var block in kept)
            {
                sb.Append(Separator);
                sb.Append(block);
            }

            File.WriteAllText(_logFilePath, sb.ToString(), Encoding.UTF8);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ошибка при обрезке аудит-лога");
        }
    }

    private async Task CreateAutoBackupAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var connectionString = db.Database.GetConnectionString();
            if (string.IsNullOrWhiteSpace(connectionString)) return;

            var builder = new SqliteConnectionStringBuilder(connectionString);
            if (string.IsNullOrWhiteSpace(builder.DataSource)) return;

            var dbPath = Path.IsPathRooted(builder.DataSource)
                ? builder.DataSource
                : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), builder.DataSource));

            if (!File.Exists(dbPath)) return;

            var backupDir = Path.Combine(Path.GetDirectoryName(dbPath)!, "backups");
            Directory.CreateDirectory(backupDir);
            var backupPath = Path.Combine(backupDir, AutoBackupFileName);
            var escaped = backupPath.Replace("'", "''", StringComparison.Ordinal);

            // Remove old auto-backup first (VACUUM INTO fails if file exists)
            if (File.Exists(backupPath)) File.Delete(backupPath);

            await using var conn = new SqliteConnection(connectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"VACUUM INTO '{escaped}';";
            await cmd.ExecuteNonQueryAsync();

            _logger.LogInformation("Авто-бэкап создан (каждые {N} операций): {Path}", BackupEvery, backupPath);

            // Also log this in the audit file
            lock (_fileLock)
            {
                var entry = $"{Separator}\n  [{DateTime.Now:yyyy-MM-dd HH:mm:ss}]  АВТО-БЭКАП\n  Автоматический бэкап БД создан (операция #{_operationCounter})\n    Файл: {backupPath}\n\n";
                File.AppendAllText(_logFilePath, entry, Encoding.UTF8);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ошибка при создании авто-бэкапа");
        }
    }
}
