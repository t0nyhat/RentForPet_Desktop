#!/usr/bin/env bash

# Setup Git hooks for PetHotel project
# This script should be run after cloning the repository

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔧 Настройка Git hooks для PetHotel..."
echo ""

# Определяем директорию git hooks (поддержка worktrees)
GIT_DIR=$(cd "$PROJECT_ROOT" && git rev-parse --git-dir)
HOOKS_DIR="$GIT_DIR/hooks"

# Создаем директорию hooks если её нет
mkdir -p "$HOOKS_DIR"

# Копируем pre-commit hook из .husky в .git/hooks
echo "📝 Установка pre-commit hook в $HOOKS_DIR/pre-commit..."
if [ -f "$PROJECT_ROOT/.husky/pre-commit" ]; then
  # Создаем адаптированную версию для .git/hooks
  cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env sh

# Сохраняем корневую директорию проекта (поддержка worktrees)
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

echo "🚀 Запуск pre-commit проверок..."
echo ""

# ============================================
# FRONTEND ПРОВЕРКИ
# ============================================
cd "$PROJECT_ROOT/frontend" || exit 1

# 1. Lint-staged (ESLint + Prettier для измененных файлов)
echo "📝 [Frontend] Проверка ESLint и Prettier (lint-staged)..."
npx lint-staged || {
  echo "❌ ESLint или Prettier проверка не пройдена!"
  exit 1
}
echo "✅ [Frontend] ESLint и Prettier прошли проверку"
echo ""

# 2. TypeScript type checking
echo "🔍 [Frontend] Проверка типов TypeScript..."
npm run type-check || {
  echo "❌ TypeScript проверка типов не пройдена!"
  exit 1
}
echo "✅ [Frontend] TypeScript типы корректны"
echo ""

# ============================================
# BACKEND ПРОВЕРКИ (C#)
# ============================================
cd "$PROJECT_ROOT" || exit 1

# Проверяем, есть ли измененные C# файлы
CS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.cs$' || true)

if [ -n "$CS_FILES" ]; then
  echo "🔍 [Backend] Обнаружены измененные C# файлы, запуск проверок..."
  
  # 4. StyleCop + Build
  echo "📝 [Backend] Проверка StyleCop и сборка проекта..."
  BUILD_OUTPUT=$(dotnet build --no-incremental 2>&1)
  BUILD_EXIT=$?
  
  # Подсчитываем предупреждения StyleCop
  STYLECOP_WARNINGS=$(echo "$BUILD_OUTPUT" | grep -c "warning SA" || true)
  
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "❌ C# сборка не пройдена!"
    echo "$BUILD_OUTPUT"
    exit 1
  fi
  
  if [ $STYLECOP_WARNINGS -gt 0 ]; then
    echo "⚠️  Найдено $STYLECOP_WARNINGS предупреждений StyleCop:"
    echo "$BUILD_OUTPUT" | grep "warning SA" | head -20
    echo ""
    echo "💡 Исправьте предупреждения StyleCop или используйте 'git commit --no-verify' для пропуска проверки"
    exit 1
  fi
  
  echo "✅ [Backend] StyleCop и сборка прошли успешно (0 предупреждений)"
  echo ""
else
  echo "ℹ️  [Backend] Нет измененных C# файлов, пропускаем проверки"
  echo ""
fi

echo "🎉 ✅ Все проверки успешно пройдены!"
EOF

  chmod +x "$HOOKS_DIR/pre-commit"
  echo "✅ Pre-commit hook установлен в $HOOKS_DIR/pre-commit"
else
  echo "⚠️  Файл .husky/pre-commit не найден!"
  exit 1
fi

echo ""
echo "✅ Git hooks успешно настроены!"
echo ""
echo "Теперь при каждом коммите будут проверяться:"
echo "  - ESLint и Prettier (frontend)"
echo "  - TypeScript типы (frontend)"
echo "  - StyleCop (backend, если есть изменения в .cs)"
echo "  - Сборка проекта (backend, если есть изменения в .cs)"
echo ""
echo "Для пропуска проверок используйте: git commit --no-verify"
