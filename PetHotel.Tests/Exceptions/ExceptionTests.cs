using FluentAssertions;
using PetHotel.Application.Common.Exceptions;
using Xunit;

namespace PetHotel.Tests.Exceptions;

public class ExceptionTests
{
    [Fact]
    public void NotFoundException_WithEntityNameAndId_ShouldSetMessage()
    {
        // Arrange
        var entityName = "Booking";
        var id = Guid.NewGuid();

        // Act
        var exception = new NotFoundException(entityName, id);

        // Assert
        exception.Message.Should().Contain(entityName);
        exception.Message.Should().Contain(id.ToString());
    }

    [Fact]
    public void NotFoundException_WithCustomMessage_ShouldSetMessage()
    {
        // Arrange
        var message = "Custom not found message";

        // Act
        var exception = new NotFoundException(message);

        // Assert
        exception.Message.Should().Be(message);
    }

    [Fact]
    public void BadRequestException_ShouldSetMessage()
    {
        // Arrange
        var message = "Invalid request data";

        // Act
        var exception = new BadRequestException(message);

        // Assert
        exception.Message.Should().Be(message);
    }

    [Fact]
    public void UnauthorizedException_ShouldSetMessage()
    {
        // Arrange
        var message = "User is not authorized";

        // Act
        var exception = new UnauthorizedException(message);

        // Assert
        exception.Message.Should().Be(message);
    }

    [Fact]
    public void ForbiddenException_ShouldSetMessage()
    {
        // Arrange
        var message = "Access is forbidden";

        // Act
        var exception = new ForbiddenException(message);

        // Assert
        exception.Message.Should().Be(message);
    }

    [Fact]
    public void NotFoundException_ShouldBeThrowable()
    {
        // Arrange
        var entityName = "Room";
        var id = Guid.NewGuid();

        // Act & Assert
        Action act = () => throw new NotFoundException(entityName, id);
        act.Should().Throw<NotFoundException>();
    }

    [Fact]
    public void BadRequestException_ShouldBeThrowable()
    {
        // Arrange
        var message = "Invalid data";

        // Act & Assert
        Action act = () => throw new BadRequestException(message);
        act.Should().Throw<BadRequestException>();
    }

    [Fact]
    public void UnauthorizedException_ShouldBeThrowable()
    {
        // Arrange
        var message = "Not authenticated";

        // Act & Assert
        Action act = () => throw new UnauthorizedException(message);
        act.Should().Throw<UnauthorizedException>();
    }

    [Fact]
    public void ForbiddenException_ShouldBeThrowable()
    {
        // Arrange
        var message = "No permission";

        // Act & Assert
        Action act = () => throw new ForbiddenException(message);
        act.Should().Throw<ForbiddenException>();
    }
}
