using AutoMapper;
using FluentAssertions;
using Moq;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.RoomTypes;
using PetHotel.Application.Interfaces;
using PetHotel.Application.Services;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using Xunit;

namespace PetHotel.Tests.Services;

public class RoomTypeServiceTests
{
    private readonly Mock<IRoomTypeRepository> _roomTypeRepositoryMock;
    private readonly Mock<IRoomRepository> _roomRepositoryMock;
    private readonly Mock<IBookingRepository> _bookingRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IMapper> _mapperMock;
    private readonly Mock<ICachingService> _cachingServiceMock;
    private readonly RoomTypeService _service;

    public RoomTypeServiceTests()
    {
        _roomTypeRepositoryMock = new Mock<IRoomTypeRepository>();
        _roomRepositoryMock = new Mock<IRoomRepository>();
        _bookingRepositoryMock = new Mock<IBookingRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _mapperMock = new Mock<IMapper>();
        _cachingServiceMock = new Mock<ICachingService>();

        _service = new RoomTypeService(
            _roomTypeRepositoryMock.Object,
            _roomRepositoryMock.Object,
            _bookingRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _mapperMock.Object,
            _cachingServiceMock.Object
        );
    }

    [Fact]
    public async Task GetRoomTypeByIdAsync_WhenRoomTypeExists_ShouldReturnRoomTypeDto()
    {
        // Arrange
        var roomTypeId = Guid.NewGuid();
        var roomType = new RoomType
        {
            Id = roomTypeId,
            Name = "Standard",
            MaxCapacity = 2,
            PricePerNight = 50m,
            IsActive = true
        };

        var roomTypeDto = new RoomTypeDto
        {
            Id = roomTypeId,
            Name = "Standard",
            MaxCapacity = 2,
            PricePerNight = 50m
        };

        _cachingServiceMock
            .Setup(x => x.GetAsync<RoomTypeDto>(It.IsAny<string>()))
            .ReturnsAsync((RoomTypeDto)null!);

        _roomTypeRepositoryMock
            .Setup(x => x.GetActiveByIdAsync(roomTypeId))
            .ReturnsAsync(roomType);

        _roomRepositoryMock
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(new List<Room>());

        _mapperMock
            .Setup(x => x.Map<RoomTypeDto>(It.IsAny<RoomType>()))
            .Returns(roomTypeDto);

        // Act
        var result = await _service.GetRoomTypeByIdAsync(roomTypeId);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(roomTypeId);
        result.Name.Should().Be("Standard");
        _roomTypeRepositoryMock.Verify(x => x.GetActiveByIdAsync(roomTypeId), Times.Once);
    }

    [Fact]
    public async Task GetRoomTypeByIdAsync_WhenRoomTypeDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var roomTypeId = Guid.NewGuid();

        _cachingServiceMock
            .Setup(x => x.GetAsync<RoomTypeDto>(It.IsAny<string>()))
            .ReturnsAsync((RoomTypeDto)null!);

        _roomTypeRepositoryMock
            .Setup(x => x.GetActiveByIdAsync(roomTypeId))
            .ReturnsAsync((RoomType)null!);

        // Act
        Func<Task> act = async () => await _service.GetRoomTypeByIdAsync(roomTypeId);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Тип номера*");
    }

    [Fact]
    public async Task CreateRoomTypeAsync_WhenNameAlreadyExists_ShouldThrowBadRequestException()
    {
        // Arrange
        var request = new CreateRoomTypeRequest
        {
            Name = "Standard",
            MaxCapacity = 2,
            PricePerNight = 50m
        };

        _roomTypeRepositoryMock
            .Setup(x => x.RoomTypeNameExistsAsync(request.Name, null))
            .ReturnsAsync(true);

        // Act
        Func<Task> act = async () => await _service.CreateRoomTypeAsync(request);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*уже существует*");
    }

    [Fact]
    public async Task CreateRoomTypeAsync_WhenNameIsUnique_ShouldCreateRoomType()
    {
        // Arrange
        var request = new CreateRoomTypeRequest
        {
            Name = "VIP",
            MaxCapacity = 3,
            PricePerNight = 150m,
            PricePerAdditionalPet = 40m
        };

        var roomType = new RoomType
        {
            Id = Guid.NewGuid(),
            Name = "VIP",
            MaxCapacity = 3,
            PricePerNight = 150m
        };

        var roomTypeDto = new RoomTypeDto
        {
            Id = roomType.Id,
            Name = "VIP",
            MaxCapacity = 3,
            PricePerNight = 150m
        };

        _roomTypeRepositoryMock
            .Setup(x => x.RoomTypeNameExistsAsync(request.Name, null))
            .ReturnsAsync(false);

        _mapperMock
            .Setup(x => x.Map<RoomType>(request))
            .Returns(roomType);

        _mapperMock
            .Setup(x => x.Map<RoomTypeDto>(roomType))
            .Returns(roomTypeDto);

        // Act
        var result = await _service.CreateRoomTypeAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("VIP");
        result.AvailableRoomsCount.Should().Be(0);
        _roomTypeRepositoryMock.Verify(x => x.AddAsync(It.IsAny<RoomType>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task DeleteRoomTypeAsync_WhenRoomTypeHasRooms_ShouldThrowBadRequestException()
    {
        // Arrange
        var roomTypeId = Guid.NewGuid();
        var roomType = new RoomType { Id = roomTypeId, Name = "Standard" };

        var rooms = new List<Room>
        {
            new Room { Id = Guid.NewGuid(), RoomTypeId = roomTypeId }
        };

        _roomTypeRepositoryMock
            .Setup(x => x.GetByIdAsync(roomTypeId))
            .ReturnsAsync(roomType);

        _roomRepositoryMock
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(rooms);

        // Act
        Func<Task> act = async () => await _service.DeleteRoomTypeAsync(roomTypeId);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*привязаны номера*");
    }

    [Fact]
    public async Task DeleteRoomTypeAsync_WhenRoomTypeHasBookings_ShouldThrowBadRequestException()
    {
        // Arrange
        var roomTypeId = Guid.NewGuid();
        var roomType = new RoomType { Id = roomTypeId, Name = "Standard" };

        var bookings = new List<Booking>
        {
            new Booking { Id = Guid.NewGuid(), RoomTypeId = roomTypeId }
        };

        _roomTypeRepositoryMock
            .Setup(x => x.GetByIdAsync(roomTypeId))
            .ReturnsAsync(roomType);

        _roomRepositoryMock
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(new List<Room>());

        _bookingRepositoryMock
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(bookings);

        // Act
        Func<Task> act = async () => await _service.DeleteRoomTypeAsync(roomTypeId);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*бронированиями*");
    }

    [Fact]
    public async Task DeleteRoomTypeAsync_WhenNoConstraints_ShouldSoftDeleteRoomType()
    {
        // Arrange
        var roomTypeId = Guid.NewGuid();
        var roomType = new RoomType
        {
            Id = roomTypeId,
            Name = "Standard",
            IsActive = true
        };

        _roomTypeRepositoryMock
            .Setup(x => x.GetByIdAsync(roomTypeId))
            .ReturnsAsync(roomType);

        _roomRepositoryMock
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(new List<Room>());

        _bookingRepositoryMock
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(new List<Booking>());

        // Act
        await _service.DeleteRoomTypeAsync(roomTypeId);

        // Assert
        roomType.IsActive.Should().BeFalse();
        _roomTypeRepositoryMock.Verify(x => x.UpdateAsync(roomType), Times.Once);
        _unitOfWorkMock.Verify(x => x.SaveChangesAsync(default), Times.Once);
    }
}
