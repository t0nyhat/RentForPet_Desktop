using System.Text;
using System.Text.Encodings.Web;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Claims;
using AspNetCoreRateLimit;
using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using Prometheus;
using PetHotel.API.Filters;
using PetHotel.API.Middleware;
using PetHotel.API.Services;
using PetHotel.Application.Common.Settings;
using PetHotel.Application.Interfaces;
using PetHotel.Application.Mappings;
using PetHotel.Application.Services;
using PetHotel.Application.Validators.Auth;
using PetHotel.Domain.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Infrastructure.Data;
using PetHotel.Infrastructure.Repositories;
using PetHotel.Infrastructure.Services;

// Подхватываем переменные из .env, чтобы не хранить секреты в appsettings
LoadDotEnv();

void LoadDotEnv()
{
    // Пытаемся найти .env в корне решения или в текущей директории
    var candidates = new[]
    {
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "..", ".env")
    };

    foreach (var path in candidates)
    {
        if (!File.Exists(path))
            continue;

        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
                continue;

            var idx = line.IndexOf('=', StringComparison.Ordinal);
            if (idx <= 0)
                continue;

            var key = line[..idx].Trim();
            var value = line[(idx + 1)..].Trim().Trim('\'', '"');
            Environment.SetEnvironmentVariable(key, value);
        }

        break;
    }
}

var builder = WebApplication.CreateBuilder(args);

// Sentry configuration for error tracking
var sentryDsn = builder.Configuration["Sentry:Dsn"];
if (!string.IsNullOrWhiteSpace(sentryDsn))
{
    builder.WebHost.UseSentry(options =>
    {
        options.Dsn = sentryDsn;
        options.Environment = builder.Environment.EnvironmentName;
        options.TracesSampleRate = 1.0; // Capture 100% of transactions in dev, adjust for production
        options.AttachStacktrace = true;
        options.SendDefaultPii = false; // Don't send PII data
        options.MinimumBreadcrumbLevel = LogLevel.Information;
        options.MinimumEventLevel = LogLevel.Warning;
    });
}

// Trust reverse proxy forwarded headers (nginx in Docker)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    // Clear defaults so we accept headers from our proxy network
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Rate Limiting Configuration
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.Configure<IpRateLimitPolicies>(builder.Configuration.GetSection("IpRateLimitPolicies"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// JWT Settings
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
builder.Services.Configure<JwtSettings>(jwtSettings);

// Email Settings
var emailSettings = builder.Configuration.GetSection("EmailSettings");
builder.Services.Configure<EmailSettings>(emailSettings);

// Get JWT secret from environment variable or config
var configSecretKey = jwtSettings.Get<JwtSettings>()?.SecretKey;
var envSecretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
var secretKey = !string.IsNullOrEmpty(envSecretKey) ? envSecretKey
    : (!string.IsNullOrEmpty(configSecretKey) && !configSecretKey.StartsWith("${")) ? configSecretKey
    : Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

// Add services to the container.
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
})
.AddJsonOptions(options =>
{
    // Игнорируем циклические ссылки при сериализации JSON
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

builder.Services.AddEndpointsApiExplorer();

// Swagger configuration
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Pet Hotel API",
        Version = "v1",
        Description = "API для управления зоогостиницей"
    });

    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. \r\n\r\n " +
    "Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\n" +
    "Example: \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
 {
 {
 new Microsoft.OpenApi.Models.OpenApiSecurityScheme
 {
 Reference = new Microsoft.OpenApi.Models.OpenApiReference
 {
 Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
 Id = "Bearer"
 }
 },
 Array.Empty<string>()
 }
 });

    // На случай конфликтующих маршрутов (одинаковые path+method)
    options.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());

    // Избежать конфликтов схем с одинаковыми именами классов из разных пространств имён
    options.CustomSchemaIds(type => type.FullName);

    // Поддержка файловых загрузок
    options.MapType<IFormFile>(() => new Microsoft.OpenApi.Models.OpenApiSchema
    {
        Type = "string",
        Format = "binary"
    });
});

// Database: SQLite
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    // Приоритет: PETSHOTEL_DATA_PATH (от Electron) > папка data в проекте (dev режим)
    var dataPath = Environment.GetEnvironmentVariable("PETSHOTEL_DATA_PATH")?.Trim();

    if (string.IsNullOrWhiteSpace(dataPath))
    {
        // Dev режим: определяем путь к папке проекта
        // В dev: AppContext.BaseDirectory = .../PetHotel.API/bin/Debug/net8.0/
        // В production: AppContext.BaseDirectory = .../Pet Hotel.app/Contents/Resources/dotnet/
        var baseDir = AppContext.BaseDirectory;

        // Проверяем, что мы в dev режиме (путь содержит bin/Debug или bin/Release)
        if (baseDir.Contains(Path.Combine("bin", "Debug")) || baseDir.Contains(Path.Combine("bin", "Release")))
        {
            // Dev режим: идём на 4 уровня вверх до корня проекта
            var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", ".."));
            dataPath = Path.Combine(projectRoot, "data");
        }
        else
        {
            // Production режим без PETSHOTEL_DATA_PATH - fallback на системную папку
            dataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "PetHotel",
                "data");
        }
    }

    // Создаём папку если не существует
    Directory.CreateDirectory(dataPath);

    var dbFile = Path.Combine(dataPath, "pethotel.db");
    var connectionString = $"Data Source={dbFile};Cache=Shared";

    Console.WriteLine($"[Database] Путь к БД: {dbFile}");

    options.UseSqlite(connectionString);
});

// Authentication: lightweight dev-only scheme that always authenticates as Admin
builder.Services
    .AddAuthentication("AllowAll")
    .AddScheme<AuthenticationSchemeOptions, AllowAllAuthenticationHandler>("AllowAll", _ => { });

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder("AllowAll")
        .RequireAssertion(_ => true)
        .Build();
    options.FallbackPolicy = options.DefaultPolicy;
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile).Assembly);

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// Filters
builder.Services.AddScoped<ValidationFilter>();

// Unit of Work
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<IPetRepository, PetRepository>();
builder.Services.AddScoped<IRoomTypeRepository, RoomTypeRepository>();
builder.Services.AddScoped<IRoomRepository, RoomRepository>();
builder.Services.AddScoped<IBookingRepository, BookingRepository>();
builder.Services.AddScoped<IBookingPetRepository, BookingPetRepository>();
builder.Services.AddScoped<IBookingServiceRepository, BookingServiceRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IBookingSettingsRepository, BookingSettingsRepository>();

// Generic repositories for entities without specific repository
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

// Background Services
builder.Services.AddHostedService<PetHotel.API.Services.MetricsUpdateService>();

// Application Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPetService, PetService>();
builder.Services.AddScoped<IRoomTypeService, RoomTypeService>();
builder.Services.AddScoped<IRoomService, RoomService>();
builder.Services.AddScoped<IBookingService, PetHotel.Application.Services.BookingService>();
builder.Services.AddScoped<BookingOptionsService>();
builder.Services.AddScoped<IAdminBookingService, AdminBookingService>();
builder.Services.AddScoped<IAdminClientService, AdminClientService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IAdminPaymentService, AdminPaymentService>();
builder.Services.AddScoped<IBookingSettingsService, BookingSettingsService>();

// Infrastructure Services
builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IEmailService, EmailService>();

// Caching Service (Memory Cache for now, can be upgraded to Redis later)
// Note: AddMemoryCache() is called earlier for Rate Limiting
builder.Services.AddSingleton<ICachingService, MemoryCachingService>();

// Audit Service (file-based, singleton — writes to data/audit-log.txt)
builder.Services.AddSingleton<PetHotel.API.Services.AuditService>();

// CORS
// Для локального десктопного приложения разрешаем все origins
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
if (allowedOrigins.Length == 0)
{
    // Локальное десктопное приложение - разрешаем все origins
    // В production можно настроить конкретные origins через appsettings.json
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
// Включаем Swagger по конфигурации (по умолчанию в Development)
var enableSwagger = app.Configuration.GetValue<bool>("Swagger:Enabled", app.Environment.IsDevelopment());
if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Pet Hotel API v1");
        c.RoutePrefix = "swagger";
    });
}

// Ensure database is created and migrations are applied for SQLite standalone
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    string? startupLogPath = null;

    try
    {
        var connStr = db.Database.GetConnectionString();
        var dbPath = connStr != null && connStr.Contains("Data Source=")
            ? connStr.Split("Data Source=")[1].Split(';')[0].Trim()
            : "(unknown)";
        logger.LogInformation("Путь к БД: {DbPath}", dbPath);

        // Пишем лог запуска в файл (чтобы посмотреть после установки из DMG)
        try
        {
            startupLogPath = Path.Combine(Path.GetDirectoryName(dbPath) ?? ".", "pethotel-startup.log");
            var logDir = Path.GetDirectoryName(startupLogPath);
            if (!string.IsNullOrEmpty(logDir))
                Directory.CreateDirectory(logDir);
            File.AppendAllText(startupLogPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Запуск API. Путь к БД: {dbPath}\n");
        }
        catch { /* игнор ошибок записи лога */ }

        // For local SQLite: check if database needs to be recreated
        logger.LogInformation("Создание/проверка базы данных...");

        // Check if database exists and has tables by trying to query a table
        var needsRecreate = false;
        var canConnect = await db.Database.CanConnectAsync();
        if (canConnect)
        {
            try
            {
                // Try to query RoomTypes to check if tables exist
                _ = await db.RoomTypes.AnyAsync();
                logger.LogInformation("База данных существует и содержит таблицы.");
            }
            catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.Message.Contains("no such table"))
            {
                // Database exists but tables are missing - need to recreate
                logger.LogWarning("База данных существует, но таблицы отсутствуют. Пересоздаём...");
                needsRecreate = true;
            }
        }

        // Simple approach: use EnsureCreatedAsync for SQLite
        // This creates schema from model directly, no migrations needed for local desktop app
        if (needsRecreate || !canConnect)
        {
            if (needsRecreate)
            {
                logger.LogInformation("Удаление старой базы данных...");
                await db.Database.EnsureDeletedAsync();

                // Force delete database file and related files
                var connectionString = db.Database.GetConnectionString();
                if (connectionString != null && connectionString.Contains("Data Source="))
                {
                    var dbFilePath = connectionString.Split("Data Source=")[1].Split(';')[0].Trim();
                    try
                    {
                        if (File.Exists(dbFilePath))
                            File.Delete(dbFilePath);
                        if (File.Exists(dbFilePath + "-shm"))
                            File.Delete(dbFilePath + "-shm");
                        if (File.Exists(dbFilePath + "-wal"))
                            File.Delete(dbFilePath + "-wal");
                        await Task.Delay(200);
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning($"Не удалось удалить файл базы данных: {ex.Message}");
                    }
                }
            }

            // Create database and schema from model
            // Use SQL generation from model to create tables directly
            logger.LogInformation("Создание базы данных и схемы из модели...");

            // Ensure database file exists and get absolute path
            var dbConnectionString = db.Database.GetConnectionString();
            string? databasePath = null;
            if (dbConnectionString != null && dbConnectionString.Contains("Data Source="))
            {
                var rawPath = dbConnectionString.Split("Data Source=")[1].Split(';')[0].Trim();

                // Resolve relative paths relative to current working directory (where app is run from)
                // This ensures that ./data/PetHotel.db works when running from dist folder
                if (rawPath.StartsWith("./") || rawPath.StartsWith(".\\") || (!Path.IsPathRooted(rawPath) && !rawPath.Contains(":")))
                {
                    // Relative path - resolve relative to current working directory
                    var workingDir = Directory.GetCurrentDirectory();
                    var cleanPath = rawPath.Replace("./", "").Replace(".\\", "");
                    databasePath = Path.GetFullPath(Path.Combine(workingDir, cleanPath));
                }
                else
                {
                    databasePath = Path.IsPathRooted(rawPath) ? rawPath : Path.GetFullPath(rawPath);
                }

                // Ensure directory exists
                var dbDir = Path.GetDirectoryName(databasePath);
                if (!string.IsNullOrEmpty(dbDir) && !Directory.Exists(dbDir))
                {
                    Directory.CreateDirectory(dbDir);
                    logger.LogInformation($"Создана директория для базы данных: {dbDir}");
                }

                logger.LogInformation($"Путь к базе данных: {databasePath}");

                // Explicitly create empty database file if it doesn't exist
                // SQLite will create the file on first connection, but we want to ensure it's created
                if (!File.Exists(databasePath))
                {
                    // Create empty SQLite database file by opening and closing a connection
                    using (var tempConnection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={databasePath}"))
                    {
                        tempConnection.Open();
                        // Connection opened = file created
                    }
                    logger.LogInformation($"Создан файл базы данных: {databasePath}");
                }
                else
                {
                    logger.LogInformation($"Файл базы данных уже существует: {databasePath}");
                }
            }

            // Generate SQL from model and execute it directly
            try
            {
                var model = db.Model;
                var sqlGenerator = db.Database.GetService<Microsoft.EntityFrameworkCore.Storage.IRelationalDatabaseCreator>();

                // Try EnsureCreatedAsync first
                var created = await db.Database.EnsureCreatedAsync();
                logger.LogInformation($"EnsureCreatedAsync вернул: {created}");

                // Check if tables were actually created
                var connection = db.Database.GetDbConnection();
                await connection.OpenAsync();
                using var checkCommand = connection.CreateCommand();
                checkCommand.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
                var tableCount = Convert.ToInt32(await checkCommand.ExecuteScalarAsync());
                await connection.CloseAsync();

                if (tableCount == 0)
                {
                    logger.LogWarning("EnsureCreatedAsync не создал таблицы. Используем альтернативный метод...");

                    // Generate SQL from model using IRelationalDatabaseCreator
                    // This is a workaround - manually create tables using model metadata
                    await connection.OpenAsync();

                    // Get all entity types from model
                    var entityTypes = model.GetEntityTypes().ToList();
                    logger.LogInformation($"Найдено сущностей в модели: {entityTypes.Count}");

                    // Create tables manually using SQL
                    foreach (var entityType in entityTypes)
                    {
                        var tableName = entityType.GetTableName();
                        if (string.IsNullOrEmpty(tableName))
                            continue;

                        logger.LogInformation($"Создание таблицы: {tableName}");

                        // Build CREATE TABLE SQL
                        var columns = new List<string>();
                        var primaryKeys = new List<string>();

                        foreach (var property in entityType.GetProperties())
                        {
                            var columnName = property.GetColumnName();
                            var storeType = property.GetRelationalTypeMapping()?.StoreType ?? "TEXT";

                            // Map EF types to SQLite types
                            if (storeType.Contains("varchar") || storeType.Contains("nvarchar") || storeType.Contains("text"))
                            {
                                storeType = "TEXT";
                            }
                            else if (storeType.Contains("int") || storeType.Contains("bigint"))
                            {
                                storeType = "INTEGER";
                            }
                            else if (storeType.Contains("decimal") || storeType.Contains("numeric") || storeType.Contains("money"))
                            {
                                storeType = "REAL";
                            }
                            else if (storeType.Contains("bool") || storeType.Contains("bit"))
                            {
                                storeType = "INTEGER";
                            }
                            else if (storeType.Contains("date") || storeType.Contains("time"))
                            {
                                storeType = "TEXT";
                            }

                            var isNullable = property.IsNullable;
                            var defaultValue = property.GetDefaultValue();

                            var columnDef = $"\"{columnName}\" {storeType}";
                            if (!isNullable)
                            {
                                columnDef += " NOT NULL";
                            }
                            // Handle default values carefully for SQLite
                            var defaultValueSql = property.GetDefaultValueSql();
                            if (!string.IsNullOrEmpty(defaultValueSql))
                            {
                                columnDef += $" DEFAULT {defaultValueSql}";
                            }
                            else if (defaultValue != null)
                            {
                                if (defaultValue is string str)
                                {
                                    columnDef += $" DEFAULT '{str.Replace("'", "''")}'";
                                }
                                else if (defaultValue is bool boolVal)
                                {
                                    columnDef += $" DEFAULT {(boolVal ? 1 : 0)}";
                                }
                                else if (defaultValue is TimeSpan ts)
                                {
                                    // TimeSpan as string for SQLite (format: HH:mm:ss)
                                    var tsStr = $"{(int)ts.TotalHours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}";
                                    columnDef += $" DEFAULT '{tsStr}'";
                                }
                                else if (defaultValue is DateTime dt)
                                {
                                    columnDef += $" DEFAULT '{dt:yyyy-MM-dd HH:mm:ss}'";
                                }
                                else if (defaultValue is decimal dec)
                                {
                                    columnDef += $" DEFAULT {dec}";
                                }
                                else if (defaultValue is double dbl)
                                {
                                    columnDef += $" DEFAULT {dbl}";
                                }
                                else if (defaultValue is float flt)
                                {
                                    columnDef += $" DEFAULT {flt}";
                                }
                                else if (defaultValue is int || defaultValue is long || defaultValue is short || defaultValue is byte)
                                {
                                    columnDef += $" DEFAULT {defaultValue}";
                                }
                                else
                                {
                                    // Skip complex default values - they might cause syntax errors
                                    // logger.LogWarning($"Пропускаем значение по умолчанию для {columnName}: {defaultValue.GetType()}");
                                }
                            }

                            columns.Add(columnDef);

                            if (property.IsPrimaryKey())
                            {
                                primaryKeys.Add($"\"{columnName}\"");
                            }
                        }

                        // Build CREATE TABLE SQL - ensure no syntax errors
                        var tableDef = string.Join(", ", columns);
                        if (primaryKeys.Any())
                        {
                            tableDef += $", PRIMARY KEY ({string.Join(", ", primaryKeys)})";
                        }
                        var createTableSql = $"CREATE TABLE IF NOT EXISTS \"{tableName}\" ({tableDef});";

                        try
                        {
                            using var createCommand = connection.CreateCommand();
                            createCommand.CommandText = createTableSql;
                            logger.LogInformation($"Создание таблицы {tableName}...");
                            await createCommand.ExecuteNonQueryAsync();
                            logger.LogInformation($"✅ Таблица {tableName} создана.");
                        }
                        catch (Exception ex)
                        {
                            logger.LogError($"❌ Ошибка при создании таблицы {tableName}: {ex.Message}");
                            // Log first part of SQL for debugging
                            var sqlPreview = createTableSql.Length > 300 ? createTableSql.Substring(0, 300) + "..." : createTableSql;
                            logger.LogError($"SQL превью: {sqlPreview}");

                            // Try to identify the problematic column
                            foreach (var col in columns)
                            {
                                if (col.Contains("DEFAULT") && (col.Contains("-") || col.Contains("(")))
                                {
                                    logger.LogWarning($"Проблемная колонка (возможно): {col.Substring(0, Math.Min(100, col.Length))}");
                                }
                            }
                        }
                    }

                    // Close connection after creating all tables
                    await connection.CloseAsync();

                    // Small delay to ensure SQLite has flushed changes
                    await Task.Delay(100);
                }

                // Verify tables were created - use a completely fresh connection
                logger.LogInformation("Проверка созданных таблиц...");
                var verifyConnectionString = db.Database.GetConnectionString();
                string? verifyDatabasePath = null;
                if (verifyConnectionString != null && verifyConnectionString.Contains("Data Source="))
                {
                    verifyDatabasePath = verifyConnectionString.Split("Data Source=")[1].Split(';')[0].Trim();
                }

                if (!string.IsNullOrEmpty(verifyDatabasePath) && File.Exists(verifyDatabasePath))
                {
                    // Use direct SQLite connection for verification
                    using var verifyConnection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={verifyDatabasePath}");
                    await verifyConnection.OpenAsync();

                    using var verifyCommand = verifyConnection.CreateCommand();
                    verifyCommand.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;";
                    using var reader = await verifyCommand.ExecuteReaderAsync();
                    var tables = new List<string>();
                    while (await reader.ReadAsync())
                    {
                        tables.Add(reader.GetString(0));
                    }

                    await verifyConnection.CloseAsync();

                    logger.LogInformation($"Создано таблиц: {tables.Count}");
                    if (tables.Count > 0)
                    {
                        logger.LogInformation($"Таблицы: {string.Join(", ", tables.Take(10))}{(tables.Count > 10 ? "..." : "")}");
                    }

                    if (tables.Count == 0)
                    {
                        throw new InvalidOperationException("Таблицы не были созданы!");
                    }

                    if (!tables.Contains("RoomTypes"))
                    {
                        throw new InvalidOperationException($"Таблица RoomTypes не была создана! Созданные таблицы: {string.Join(", ", tables)}");
                    }
                }
                else
                {
                    logger.LogWarning($"Не удалось найти путь к базе данных для проверки: {verifyDatabasePath}");
                    // Try using EF connection as fallback
                    var efConnection = db.Database.GetDbConnection();
                    if (efConnection.State != System.Data.ConnectionState.Open)
                    {
                        await efConnection.OpenAsync();
                    }

                    using var verifyCommand = efConnection.CreateCommand();
                    verifyCommand.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;";
                    using var reader = await verifyCommand.ExecuteReaderAsync();
                    var tables = new List<string>();
                    while (await reader.ReadAsync())
                    {
                        tables.Add(reader.GetString(0));
                    }

                    if (efConnection.State == System.Data.ConnectionState.Open)
                    {
                        await efConnection.CloseAsync();
                    }

                    logger.LogInformation($"Создано таблиц (через EF): {tables.Count}");
                    if (tables.Count == 0)
                    {
                        throw new InvalidOperationException("Таблицы не были созданы!");
                    }
                }

                logger.LogInformation("✅ База данных и таблицы созданы успешно!");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ошибка при создании базы данных");
                throw;
            }
        }
        else
        {
            logger.LogInformation("✅ База данных существует и содержит таблицы.");
        }

        // Verify tables exist before seeding
        try
        {
            _ = await db.RoomTypes.AnyAsync();
            logger.LogInformation("✅ Таблицы проверены, можно заполнять тестовые данные.");
        }
        catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.Message.Contains("no such table"))
        {
            logger.LogError("❌ ОШИБКА: Таблицы не были созданы!");
            throw new InvalidOperationException("База данных создана, но таблицы отсутствуют. Возможно, проблема с конфигурацией DbContext.", ex);
        }

        // Seed test data (pass password hasher for admin/client passwords)
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        await SeedTestDataAsync(db, passwordHasher, logger);

        try
        {
            if (!string.IsNullOrEmpty(startupLogPath))
                File.AppendAllText(startupLogPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Seed данных выполнен успешно.\n");
        }
        catch { /* игнор */ }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Ошибка при создании/обновлении базы данных!");
        try
        {
            if (!string.IsNullOrEmpty(startupLogPath))
                File.AppendAllText(startupLogPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ОШИБКА: {ex.Message}\n{ex.StackTrace}\n");
        }
        catch { /* игнор */ }
        throw;
    }
}

// Configure forwarded headers for reverse proxy (Nginx in Docker)
app.UseForwardedHeaders();

// CORS - must be before UseRouting and after UseForwardedHeaders
app.UseCors("AllowFrontend");

// Rate Limiting Middleware - должен быть как можно раньше для защиты от DDoS/brute-force
app.UseIpRateLimiting();
app.UseMiddleware<RateLimitingMiddleware>();

app.UseMiddleware<ErrorHandlingMiddleware>();
// Disable HTTPS redirect for desktop app (API listens on HTTP only)
var isElectron = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("PETSHOTEL_DATA_PATH"));
var enableHttpsRedirect = app.Configuration.GetValue<bool>("HttpsRedirection:Enabled", !isElectron);
if (enableHttpsRedirect)
{
    app.UseHttpsRedirection();
}

// Security Headers Middleware
app.UseMiddleware<SecurityHeadersMiddleware>();

// Authentication/Authorization middleware (dev-only allow-all handler)
app.UseAuthentication();
app.UseAuthorization();

// AutoMapper configured

// Prometheus metrics endpoint
app.UseHttpMetrics(); // Собирает метрики HTTP-запросов
app.MapMetrics(); // Expose /metrics endpoint

// Health check endpoint для Docker
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.Now }));

app.MapControllers();

app.Run();

// Seed test data function
async Task SeedTestDataAsync(ApplicationDbContext db, IPasswordHasher passwordHasher, ILogger logger)
{
    // Ensure BookingSettings exists (HasData from EF config is not applied when using EnsureCreated)
    if (!await db.BookingSettings.AnyAsync())
    {
        await db.BookingSettings.AddAsync(new BookingSettings
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            CalculationMode = BookingCalculationMode.Days,
            CheckInTime = new TimeSpan(15, 0, 0),
            CheckOutTime = new TimeSpan(12, 0, 0),
            IsSingleton = true,
            CreatedAt = DateTime.Now
        });
        await db.SaveChangesAsync();
    }

    // If we already have RoomTypes, only ensure Admin exists (e.g. partial seed from previous run)
    if (await db.RoomTypes.AnyAsync())
    {
        if (await db.Users.AnyAsync(u => u.Role == UserRole.Admin))
        {
            logger.LogInformation("✅ Seed данных уже применён (есть типы номеров и админ).");
            return;
        }
        logger.LogInformation("Добавление отсутствующего админа в существующую БД...");
        await EnsureAdminExistsAsync(db, passwordHasher);
        logger.LogInformation("✅ Админ добавлен.");
        return;
    }

    // Create Room Types
    var roomTypes = new List<RoomType>
    {
        new()
        {
            Id = Guid.NewGuid(),
            Name = "Стандартный номер",
            Description = "Уютная комната для вашего питомца с базовым оборудованием",
            MaxCapacity = 1,
            PricePerNight = 50.00m,
            PricePerAdditionalPet = 20.00m,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
        new()
        {
            Id = Guid.NewGuid(),
            Name = "Люкс номер",
            Description = "Просторная комната с повышенным комфортом и развлечениями",
            MaxCapacity = 2,
            PricePerNight = 100.00m,
            PricePerAdditionalPet = 40.00m,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
        new()
        {
            Id = Guid.NewGuid(),
            Name = "VIP номер",
            Description = "Премиум класс с полным набором услуг и индивидуальным уходом",
            MaxCapacity = 3,
            PricePerNight = 200.00m,
            PricePerAdditionalPet = 80.00m,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
        new()
        {
            Id = Guid.NewGuid(),
            Name = "Бюджетный номер",
            Description = "Экономный вариант для короткого проживания",
            MaxCapacity = 1,
            PricePerNight = 30.00m,
            PricePerAdditionalPet = 15.00m,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
    };

    await db.RoomTypes.AddRangeAsync(roomTypes);
    await db.SaveChangesAsync();

    // Create Rooms for each room type
    var rooms = new List<Room>();
    foreach (var roomType in roomTypes)
    {
        for (int i = 1; i <= 3; i++)
        {
            rooms.Add(new Room
            {
                Id = Guid.NewGuid(),
                RoomTypeId = roomType.Id,
                RoomNumber = $"{roomType.Id.ToString()[..2]}{i}",
                IsActive = true,
                CreatedAt = DateTime.Now
            });
        }
    }

    await db.Rooms.AddRangeAsync(rooms);
    await db.SaveChangesAsync();

    // Create test user
    var userId = Guid.NewGuid();
    var user = new User
    {
        Id = userId,
        Email = "client@example.com",
        PasswordHash = "", // Standalone mode - no auth needed
        Role = UserRole.Client,
        IsActive = true,
        EmailConfirmed = true,
        CreatedAt = DateTime.Now
    };

    await db.Users.AddAsync(user);
    await db.SaveChangesAsync();

    // Create test client
    var client = new Client
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        FirstName = "Иван",
        LastName = "Петров",
        Phone = "+7 (999) 123-45-67",
        LoyaltyDiscountPercent = 0,
        CreatedAt = DateTime.Now
    };

    await db.Clients.AddAsync(client);
    await db.SaveChangesAsync();

    // Create admin user (для входа в админ-панель из десктопного приложения)
    // Password can be set via ADMIN_PASSWORD environment variable
    var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "Admin123!";
    var adminUserId = Guid.NewGuid();
    var adminUser = new User
    {
        Id = adminUserId,
        Email = "admin@example.com",
        PasswordHash = passwordHasher.HashPassword(adminPassword),
        Role = UserRole.Admin,
        IsActive = true,
        EmailConfirmed = true,
        CreatedAt = DateTime.Now
    };
    await db.Users.AddAsync(adminUser);
    await db.SaveChangesAsync();

    var adminClient = new Client
    {
        Id = Guid.NewGuid(),
        UserId = adminUserId,
        FirstName = "Админ",
        LastName = "Системы",
        Phone = "+7 (999) 000-00-00",
        LoyaltyDiscountPercent = 0,
        CreatedAt = DateTime.Now
    };
    await db.Clients.AddAsync(adminClient);
    await db.SaveChangesAsync();

    // Create test pets
    var pets = new List<Pet>
    {
        new()
        {
            Id = Guid.NewGuid(),
            ClientId = client.Id,
            Name = "Барсик",
            Species = Species.Cat,
            Breed = "Персидская кошка",
            BirthDate = new DateTime(2020, 5, 15),
            Gender = Gender.Male,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
        new()
        {
            Id = Guid.NewGuid(),
            ClientId = client.Id,
            Name = "Бобик",
            Species = Species.Dog,
            Breed = "Лабрадор",
            BirthDate = new DateTime(2019, 8, 20),
            Gender = Gender.Male,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
        new()
        {
            Id = Guid.NewGuid(),
            ClientId = client.Id,
            Name = "Рыжик",
            Species = Species.Cat,
            Breed = "Домашняя короткошёрстная",
            BirthDate = new DateTime(2021, 3, 10),
            Gender = Gender.Female,
            IsActive = true,
            CreatedAt = DateTime.Now
        },
    };

    await db.Pets.AddRangeAsync(pets);
    await db.SaveChangesAsync();

    // Create test booking
    var booking = new Booking
    {
        Id = Guid.NewGuid(),
        ClientId = client.Id,
        RoomTypeId = roomTypes[0].Id,
        AssignedRoomId = rooms[0].Id,
        CheckInDate = DateTime.Now.AddDays(1),
        CheckOutDate = DateTime.Now.AddDays(5),
        NumberOfPets = 2,
        Status = BookingStatus.Confirmed,
        BasePrice = 200.00m,
        AdditionalPetsPrice = 40.00m,
        ServicesPrice = 0,
        TotalPrice = 240.00m,
        DiscountPercent = 0,
        DiscountAmount = 0,
        SpecialRequests = "Тестовое бронирование",
        PaymentApproved = true,
        CreatedAt = DateTime.Now
    };

    await db.Bookings.AddAsync(booking);
    await db.SaveChangesAsync();

    // Add pets to booking
    var bookingPets = new List<BookingPet>
    {
        new()
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            PetId = pets[0].Id,
            CreatedAt = DateTime.Now
        },
        new()
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            PetId = pets[1].Id,
            CreatedAt = DateTime.Now
        },
    };

    await db.BookingPets.AddRangeAsync(bookingPets);
    await db.SaveChangesAsync();

    logger.LogInformation("✅ Seed данных завершён: типы номеров, комнаты, админ (admin@example.com), клиент (client@example.com), питомцы, бронирование.");
}

async Task EnsureAdminExistsAsync(ApplicationDbContext db, IPasswordHasher passwordHasher)
{
    if (await db.Users.AnyAsync(u => u.Email == "admin@example.com"))
        return;

    // Password can be set via ADMIN_PASSWORD environment variable
    var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "Admin123!";
    var adminUserId = Guid.NewGuid();
    var adminUser = new User
    {
        Id = adminUserId,
        Email = "admin@example.com",
        PasswordHash = passwordHasher.HashPassword(adminPassword),
        Role = UserRole.Admin,
        IsActive = true,
        EmailConfirmed = true,
        CreatedAt = DateTime.Now,
    };
    await db.Users.AddAsync(adminUser);
    await db.SaveChangesAsync();

    var adminClient = new Client
    {
        Id = Guid.NewGuid(),
        UserId = adminUserId,
        FirstName = "Админ",
        LastName = "Системы",
        Phone = "+7 (999) 000-00-00",
        LoyaltyDiscountPercent = 0,
        CreatedAt = DateTime.Now,
    };
    await db.Clients.AddAsync(adminClient);
    await db.SaveChangesAsync();
}

public partial class Program { }
