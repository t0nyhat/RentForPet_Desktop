# Сборка Electron-приложения Pet Hotel

## Требования

- Node.js и npm
- .NET 8 SDK
- На Mac: Xcode Command Line Tools (для сборки нативных модулей)

## Важно: полная сборка с API и seed

Чтобы в установленном приложении был бэкенд и seed-данные, **нужно собирать одной командой**:

```bash
npm run build:mac-silicon
```

Она по очереди: собирает frontend с `VITE_API_URL=http://localhost:5226` → публикует .NET API в `PetHotel.API/out/` → запускает electron-builder.  
**Не** запускайте только `electron-builder` или `npm run build:electron` без предварительной публикации API — в .app не попадёт папка `dotnet`, API не запустится, папка `data` и лог не появятся.  
Если в приложении нет данных (типы номеров, логин) — пересоберите **одной командой** `npm run build:mac-silicon` и заново установите из DMG: фронт должен подключаться к API на `http://localhost:5226`.

## Бета-версия и имя сборок

- Имя приложения и артефактов: `RentForPet`
- Формат версии: `x.y.z-beta.n` (например, `1.0.0-beta.1`)
- Увеличить beta-номер:

```bash
npm run version:beta
```

После этого артефакты будут называться в формате:
- `RentForPet-1.0.0-beta.2-arm64.dmg`
- `RentForPet-1.0.0-beta.2-x64.exe`

## GitHub Releases и автообновления

Сборка настроена на публикацию в GitHub Releases (pre-release) и проверку обновлений из GitHub в packaged-приложении.

Перед публикацией задайте токен:

```bash
export GH_TOKEN=your_github_token
```

Команды публикации:

```bash
npm run release:beta:mac-silicon
npm run release:beta:mac-intel
npm run release:beta:win
```

Автообновление:
- при запуске packaged-приложения выполняется проверка обновлений;
- если найдено обновление, оно скачивается в фоне;
- после загрузки появится запрос на перезапуск для установки.

## Команды сборки

## Иконка приложения

Иконки уже лежат в `build/icons/` и используются сборками автоматически. Генерация при сборке **не** выполняется.

Если нужно заменить иконку, положите исходную картинку в `assets/icon-source.png` и вручную выполните:

```bash
npm run icons:generate
```

Скрипт создаст файлы в `build/icons/`:
- `icon.png` (базовая иконка),
- `icon.icns` (macOS),
- `icon.ico` (Windows, если доступна генерация через `sips`).

### Mac (Apple Silicon, M1/M2/M3)

```bash
npm run build:mac-silicon
```

Собирает: frontend → .NET API (osx-arm64) → Electron (arm64).  
Результат: `dist-electron/` — DMG и ZIP для Apple Silicon.

### Mac (Intel)

```bash
npm run build:mac-intel
```

Собирает: frontend → .NET API (osx-x64) → Electron (x64).  
Результат: `dist-electron/` — DMG и ZIP для Intel Mac.

### Запуск неподписанного приложения на Mac

Приложение собирается **без подписи** (для разработки и тестирования). При первом запуске macOS Gatekeeper может заблокировать его.

#### Способ 1: Снять карантин (рекомендуется)

После установки приложения выполните в терминале:

```bash
xattr -cr "/Applications/RentForPet.app"
```

Это удалит карантин и разрешит запуск. После этого приложение откроется без проблем.

#### Способ 2: Разрешить в Настройках

1. Попытайтесь запустить приложение (двойной клик)
2. Появится предупреждение о неподписанном приложении  
3. Откройте **Настройки** → **Конфиденциальность и безопасность**
4. Внизу будет кнопка **«Всё равно открыть»** — нажмите её
5. Подтвердите открытие приложения

#### Способ 3: Открыть через контекстное меню

1. В Finder найдите RentForPet.app
2. Удерживайте **Control** и кликните на приложение
3. Выберите **Открыть** из меню
4. В диалоге подтвердите открытие

#### Для разработчиков

Конфигурация в [electron-builder.json](electron-builder.json) отключает подпись:
- `"identity": null` — без цифровой подписи
- `"hardenedRuntime": false` — без hardened runtime  
- `"gatekeeperAssess": false` — пропуск оценки Gatekeeper

Для production-релизов нужно будет настроить подпись с Apple Developer сертификатом.

### Windows (x64)

Выполнять на Windows или в среде с поддержкой сборки под Windows:

```bash
npm run build:win
```

Собирает: frontend → .NET API (win-x64) → Electron (NSIS-установщик и ZIP).

## Режим разработки: `npm run dev`

Из корня проекта `npm run dev` запускает фронт (Vite) и API (`dotnet run --project PetHotel.API`). Переменная `PETSHOTEL_DATA_PATH` не задаётся, поэтому база создаётся в каталоге данных пользователя:

| ОС     | Путь к БД |
|--------|-----------|
| macOS  | `~/.local/share/PetHotel/data/pethotel.db` |
| Windows| `%LocalAppData%\PetHotel\data\pethotel.db` |

Резервные копии, созданные из интерфейса админа (`Расписание` → `Бэкап БД`), сохраняются в:
- macOS: `~/.local/share/PetHotel/data/backups/`
- Windows: `%LocalAppData%\PetHotel\data\backups\`

Чтобы в dev использовать ту же папку, что и у установленного приложения (macOS):  
`PETSHOTEL_DATA_PATH="$HOME/Library/Application Support/Pet Hotel/data" npm run dev:dotnet`

---

## Локальная отладка

### 1. Только веб (фронт + API, без Electron)

```bash
npm run dev
```

- Фронт: http://localhost:5173 (Vite, HMR)
- API: http://localhost:5226
- БД: `~/.local/share/PetHotel/data/pethotel.db` (macOS)

Откройте в браузере http://localhost:5173. Отладка фронта — DevTools (F12). Логи API — в терминале.

### 2. Отладка в окне Electron (как desktop)

Два терминала:

**Терминал 1** — фронт и API:
```bash
npm run dev
```

**Терминал 2** — после того как поднялись 5173 и 5226:
```bash
npm start
```

Electron откроет окно с загрузкой http://localhost:5173, подцепится к API на 5226 и автоматически откроет DevTools (рендерер). Логи API — в первом терминале.

### 3. Отладка API (точки останова)

Запустите API из IDE (Rider, Visual Studio, VS Code + C#):

- **Стартовый проект:** `PetHotel.API`
- При необходимости задайте переменную окружения `PETSHOTEL_DATA_PATH` (или используйте дефолт `~/.local/share/PetHotel/data`).
- Фронт и/или Electron запускайте отдельно (`npm run dev`, затем при необходимости `npm start`).

### 4. Отладка main-процесса Electron

Запуск с включённым инспектором Node:

```bash
npm run dev          # в первом терминале
electron --inspect . # во втором (из корня проекта)
```

В Chrome откройте `chrome://inspect` → «Open dedicated DevTools for Node» и привяжитесь к процессу Electron.

## Вспомогательные команды

| Команда | Описание |
|--------|----------|
| `npm run build:react` | Только сборка frontend (Vite) |
| `npm run build:dotnet:mac-silicon` | Только публикация .NET API под osx-arm64 в `PetHotel.API/out/` |
| `npm run build:dotnet:mac-intel` | Только публикация .NET API под osx-x64 в `PetHotel.API/out/` |
| `npm run build:dotnet:win` | Только публикация .NET API под win-x64 в `PetHotel.API/out/` |

## Конфигурация

- **Electron:** `electron-builder.json`
- **Ресурсы .NET API:** перед каждой сборкой в `electron-builder` копируется папка `PetHotel.API/out/` (её заполняет соответствующая команда `build:dotnet:*`).

Имена артефактов включают архитектуру, например:  
`RentForPet-1.0.0-beta.1-arm64.dmg`, `RentForPet-1.0.0-beta.1-x64.dmg`, `RentForPet-1.0.0-beta.1-x64.exe`.

---

## Нет seed данных после установки — куда смотреть

### 1. Проверить, что в приложении есть .NET API

Без API папка `data` и лог не создаются. В терминале:

```bash
ls "/Applications/RentForPet.app/Contents/Resources/dotnet"
```

Должны быть файлы вроде `PetHotel.API`, `PetHotel.API.deps.json` и т.д.  
Если вывода «No such file or directory» — в эту сборку API не входил. Нужно пересобрать **одной командой**:

```bash
cd /path/to/PetsHotelDesktop
npm run build:mac-silicon
```

затем заново установить из нового DMG.

### 2. Где смотреть логи и БД

- **Вывод API (старт, ошибки .NET):**  
  `~/Library/Application Support/Pet Hotel/api.log`  
  Появляется при первом запуске приложения (сразу строка «App ready»). Если файла нет — вы запускаете старую сборку: заново выполните `npm run build:mac-silicon`, установите из нового DMG (замените приложение в /Applications) и запустите снова.  
  В терминале путь содержит пробелы — **обязательно в кавычках**:  
  `cat "$HOME/Library/Application Support/Pet Hotel/api.log"`

- **Лог сида (путь к БД, «Seed выполнен» или ошибка):**  
  `~/Library/Application Support/Pet Hotel/data/pethotel-startup.log`  
  Появляется после успешного старта API.

- **База данных:**  
  `~/Library/Application Support/Pet Hotel/data/pethotel.db`

Папка `data` создаётся при первом запуске приложения. Если папки нет — создайте и откройте:

```bash
mkdir -p ~/Library/Application\ Support/Pet\ Hotel/data
open ~/Library/Application\ Support/Pet\ Hotel/data
```

После успешного запуска приложения: в папке `Pet Hotel` появится `api.log`, в `data/` — `pethotel-startup.log` и `pethotel.db`.

**Поведение:** закрытие последнего окна завершает приложение (в т.ч. на Mac). Новое окно не открывается само по себе.

**Если API не стартует (в api.log «ОШИБКА запуска» или «Выход: code=1»):** на Mac снимите карантин с приложения:
```bash
xattr -cr "/Applications/RentForPet.app"
```
Затем снова запустите приложение и проверьте лог:  
`cat "$HOME/Library/Application Support/Pet Hotel/api.log"`

### Windows

- **Лог:**  
  `%LocalAppData%\Pet Hotel\data\pethotel-startup.log`  
  (или путь из переменной `PETSHOTEL_DATA_PATH`, если задан).

- **БД:**  
  В той же папке `data`, файл `pethotel.db`.

### 3. Запуск API из терминала (увидеть вывод в консоли)

Сначала проверьте, что папка `dotnet` есть (см. п. 1). Путь к приложению может быть разным: из DMG часто ставят в `/Applications`, либо можно брать из папки сборки.

**Если приложение в /Applications:**

```bash
cd "/Applications/RentForPet.app/Contents/Resources/dotnet"
PETSHOTEL_DATA_PATH="$HOME/Library/Application Support/Pet Hotel/data" ./PetHotel.API
```

**Если приложение в папке проекта (после сборки):**

```bash
APP="/Users/tonyhat/Documents/GitHub/PetForRentDesktop/dist-electron/mac-arm64/RentForPet.app"
cd "$APP/Contents/Resources/dotnet"
PETSHOTEL_DATA_PATH="$HOME/Library/Application Support/Pet Hotel/data" ./PetHotel.API
```

В выводе смотрите строки «Путь к БД», «Seed данных завершён» или текст ошибки.

**Что проверить по логу:**

1. Есть ли строка «Seed данных выполнен успешно» — сид отработал, проблема может быть на фронте (URL API, кэш).
2. Есть ли «ОШИБКА:» — по тексту ошибки искать причину (права, диск, путь).
3. Нет ни успеха, ни ошибки — API, возможно, не стартует (проверьте запуск из терминала выше).
