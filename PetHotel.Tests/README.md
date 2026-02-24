# PetHotel Tests

Этот проект содержит комплексные тесты для приложения PetHotel, охватывающие различные уровни системы.

## Структура тестов

### Domain Tests (`/Domain`) - 37 тестов
Тесты доменных сущностей:
- **BookingEntityTests** - 10 тестов для сущности бронирования
- **PetEntityTests** - 5 тестов для сущности питомца
- **RoomTypeEntityTests** - 6 тестов для сущности типа номера
- **PaymentEntityTests** - 7 тестов для сущности платежа
- **EnumsTests** - 9 тестов для проверки значений перечислений

### Validator Tests (`/Validators`) - 48 тестов
Тесты валидаторов FluentValidation:
- **CreateBookingRequestValidatorTests** - 9 тестов для валидации запросов на бронирование
- **CreatePetRequestValidatorTests** - 14 тестов для валидации запросов на создание питомцев
- **LoginRequestValidatorTests** - 4 теста для валидации запросов на вход
- **RegisterRequestValidatorTests** - 17 тестов для валидации регистрации (включая проверку паролей и телефонов)

### Helper Tests (`/Helpers`) - 31 тест
Тесты вспомогательных классов:
- **BookingCalculationHelperTests** - 31 тест для критической бизнес-логики расчета бронирований
  - Расчет единиц (дни/ночи)
  - Проверка последовательности сегментов
  - Проверка пересечения периодов
  - Правильные формы русских слов

### Exception Tests (`/Exceptions`) - 10 тестов
Тесты пользовательских исключений:
- **ExceptionTests** - 10 тестов для проверки исключений (NotFoundException, BadRequestException, и т.д.)

### Service Tests (`/Services`) - 8 тестов
Тесты сервисов с мокированием зависимостей:
- **RoomTypeServiceTests** - 8 тестов для сервиса типов номеров
  - Получение типа номера по ID
  - Создание нового типа номера
  - Удаление типа номера
  - Обработка ошибок

## Запуск тестов

### Запуск всех тестов
```bash
dotnet test
```

### Запуск с подробным выводом
```bash
dotnet test --verbosity normal
```

### Запуск конкретного тестового класса
```bash
dotnet test --filter "FullyQualifiedName~BookingCalculationHelperTests"
```

### Запуск с генерацией отчета о покрытии кода
```bash
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover
```

## Используемые технологии

- **xUnit** - фреймворк для тестирования
- **FluentAssertions** - для выразительных утверждений
- **Moq** - для создания моков зависимостей
- **Coverlet** - для анализа покрытия кода

## Статистика тестов

- **Всего тестов**: 126
- **Успешных**: 100%
- **Покрытие**: Основные бизнес-логические компоненты

## Основные области покрытия

1. ✅ Критическая бизнес-логика расчетов (BookingCalculationHelper)
2. ✅ Валидация входных данных (FluentValidation validators)
3. ✅ Доменные сущности и их поведение
4. ✅ Пользовательские исключения
5. ✅ Сервисные методы с бизнес-логикой

## Рекомендации по добавлению новых тестов

1. Следуйте структуре AAA (Arrange-Act-Assert)
2. Используйте описательные имена тестов
3. Пишите независимые тесты (каждый тест должен быть изолирован)
4. Используйте моки для внешних зависимостей
5. Тестируйте граничные случаи и исключительные ситуации

## Примеры

### Пример теста с FluentAssertions
```csharp
[Fact]
public void CalculateDays_WithThreeDayPeriod_ShouldReturnThree()
{
    // Arrange
    var checkIn = new DateTime(2024, 11, 15);
    var checkOut = new DateTime(2024, 11, 17);

    // Act
    var result = BookingCalculationHelper.CalculateDays(checkIn, checkOut);

    // Assert
    result.Should().Be(3);
}
```

### Пример теста с Moq
```csharp
[Fact]
public async Task GetRoomTypeByIdAsync_WhenRoomTypeExists_ShouldReturnRoomTypeDto()
{
    // Arrange
    var roomTypeId = Guid.NewGuid();
    _repositoryMock
        .Setup(x => x.GetActiveByIdAsync(roomTypeId))
        .ReturnsAsync(roomType);

    // Act
    var result = await _service.GetRoomTypeByIdAsync(roomTypeId);

    // Assert
    result.Should().NotBeNull();
    _repositoryMock.Verify(x => x.GetActiveByIdAsync(roomTypeId), Times.Once);
}
```

## Поддержка

Для вопросов и предложений обращайтесь к команде разработки.
