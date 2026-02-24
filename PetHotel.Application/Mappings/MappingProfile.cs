using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using AutoMapper;
using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.DTOs.Auth;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.DTOs.Pets;
using PetHotel.Application.DTOs.Rooms;
using PetHotel.Application.DTOs.RoomTypes;
using PetHotel.Application.DTOs.Services;
using PetHotel.Domain.Entities;

namespace PetHotel.Application.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // User mappings
        CreateMap<User, UserDto>()
        .ForMember(dest => dest.Client, opt => opt.MapFrom(src => src.Client));

        CreateMap<Client, ClientDto>();
        CreateMap<Client, BookingClientDto>()
        .ForMember(dest => dest.Email, opt => opt.MapFrom(src =>
            SanitizeClientEmail(src.User.Email, src.User.IsActive)));
        CreateMap<Client, AdminClientDto>()
        .ForMember(dest => dest.Email, opt => opt.MapFrom(src =>
            SanitizeClientEmail(src.User.Email, src.User.IsActive)))
        .ForMember(dest => dest.Pets, opt => opt.MapFrom(src => src.Pets))
        .ForMember(dest => dest.InternalNotes, opt => opt.MapFrom(src => src.InternalNotes));

        // Pet mappings
        CreateMap<Pet, PetDto>()
        .ForMember(dest => dest.AgeYears, opt => opt.MapFrom(src =>
        src.BirthDate.HasValue
        ? DateTime.Now.Year - src.BirthDate.Value.Year
        : (int?)null));

        CreateMap<Pet, AdminPetDto>()
        .IncludeBase<Pet, PetDto>()
        .ForMember(dest => dest.InternalNotes, opt => opt.MapFrom(src => src.InternalNotes));

        CreateMap<CreatePetRequest, Pet>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.ClientId, opt => opt.Ignore())
        .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());

        CreateMap<UpdatePetRequest, Pet>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.ClientId, opt => opt.Ignore())
        .ForMember(dest => dest.Species, opt => opt.Ignore())
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());

        // RoomType mappings
        CreateMap<RoomType, RoomTypeDto>()
        .ForMember(dest => dest.Features, opt => opt.MapFrom(src => DeserializeFeatures(src.Features)))
        .ForMember(dest => dest.AvailableRoomsCount, opt => opt.Ignore()); // Будет заполняться в сервисе

        CreateMap<CreateRoomTypeRequest, RoomType>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
        .ForMember(dest => dest.Features, opt => opt.Ignore())
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.Rooms, opt => opt.Ignore())
        .ForMember(dest => dest.Bookings, opt => opt.Ignore())
        .AfterMap((src, dest) =>
        {
            var sanitized = src.Features?
     .Select(feature => feature.Trim())
     .Where(feature => !string.IsNullOrWhiteSpace(feature))
     .ToList();

            dest.Features = sanitized is { Count: > 0 }
     ? JsonSerializer.Serialize(sanitized)
     : null;
        });

        CreateMap<UpdateRoomTypeRequest, RoomType>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.Features, opt => opt.Ignore())
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.Rooms, opt => opt.Ignore())
        .ForMember(dest => dest.Bookings, opt => opt.Ignore())
        .AfterMap((src, dest) =>
        {
            var sanitized = src.Features?
     .Select(feature => feature.Trim())
     .Where(feature => !string.IsNullOrWhiteSpace(feature))
     .ToList();

            dest.Features = sanitized is { Count: > 0 }
     ? JsonSerializer.Serialize(sanitized)
     : null;
        });

        // Room mappings
        CreateMap<Room, RoomDto>()
        .ForMember(dest => dest.RoomTypeName, opt => opt.MapFrom(src => src.RoomType.Name));

        CreateMap<CreateRoomRequest, Room>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.RoomType, opt => opt.Ignore())
        .ForMember(dest => dest.AssignedBookings, opt => opt.Ignore());

        CreateMap<UpdateRoomRequest, Room>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.RoomType, opt => opt.Ignore())
        .ForMember(dest => dest.AssignedBookings, opt => opt.Ignore());

        // Booking mappings
        CreateMap<Booking, BookingDto>()
        // ПРИМЕЧАНИЕ: NumberOfNights использует Days mode формулу как fallback
        // Сервисы, создающие бронирования (BookingService, AdminBookingService),
        // явно пересчитывают это значение используя BookingCalculationHelper с учетом текущего режима
        .ForMember(dest => dest.NumberOfNights, opt => opt.MapFrom(src =>
        (src.CheckOutDate - src.CheckInDate).Days + 1))
        .ForMember(dest => dest.PaidAmount, opt => opt.Ignore()) // Будет рассчитано в AfterMap
        .ForMember(dest => dest.RemainingAmount, opt => opt.Ignore()) // Будет рассчитано в AfterMap
        .AfterMap((src, dest) =>
        {
            // Для составных бронирований учитываем платежи дочерних сегментов
            decimal paidAmount;
            if (src.IsComposite && src.ChildBookings != null && src.ChildBookings.Any())
            {
                var parentPayments = src.Payments != null
         ? src.Payments
         .Where(p => p.PaymentStatus == Domain.Enums.PaymentStatus.Completed || p.PaymentStatus == Domain.Enums.PaymentStatus.Refunded)
         .Sum(p => p.Amount)
         : 0;

                // Сначала пытаемся использовать замапленные дочерние бронирования (если они уже замаплены)
                decimal childPayments = 0;
                if (dest.ChildBookings != null && dest.ChildBookings.Any())
                {
                    childPayments = dest.ChildBookings.Sum(cb => cb.PaidAmount);
                }
                else if (src.ChildBookings != null)
                {
                    // Если дочерние еще не замаплены, используем исходные сущности
                    childPayments = src.ChildBookings
             .Where(cb => cb.Payments != null)
             .SelectMany(cb => cb.Payments)
             .Where(p => p.PaymentStatus == Domain.Enums.PaymentStatus.Completed || p.PaymentStatus == Domain.Enums.PaymentStatus.Refunded)
             .Sum(p => p.Amount);
                }

                paidAmount = parentPayments + childPayments;
            }
            else
            {
                // Для обычных бронирований считаем только свои платежи
                paidAmount = src.Payments != null
         ? src.Payments.Where(p => p.PaymentStatus == Domain.Enums.PaymentStatus.Completed).Sum(p => p.Amount) +
         src.Payments.Where(p => p.PaymentStatus == Domain.Enums.PaymentStatus.Refunded).Sum(p => p.Amount)
         : 0;
            }

            dest.PaidAmount = paidAmount;
            dest.RemainingAmount = src.TotalPrice - paidAmount;
        })
        .ForMember(dest => dest.DiscountPercent, opt => opt.MapFrom(src => src.DiscountPercent))
        .ForMember(dest => dest.LoyaltyDiscountPercent, opt => opt.MapFrom(src => src.Client != null ? src.Client.LoyaltyDiscountPercent : 0))
        .ForMember(dest => dest.DiscountAmount, opt => opt.MapFrom(src =>
        src.DiscountAmount != 0
        ? src.DiscountAmount
        : (src.BasePrice + src.AdditionalPetsPrice + src.ServicesPrice) - src.TotalPrice))
        .ForMember(dest => dest.RoomType, opt => opt.MapFrom(src => src.RoomType))
        .ForMember(dest => dest.RoomTypeName, opt => opt.MapFrom(src => src.RoomType != null ? src.RoomType.Name : null))
        .ForMember(dest => dest.AssignedRoom, opt => opt.MapFrom(src => src.AssignedRoom)) // Назначенный номер
        .ForMember(dest => dest.Pets, opt => opt.MapFrom(src =>
        src.BookingPets != null ? src.BookingPets.Where(bp => bp.Pet != null).Select(bp => bp.Pet).ToList() : new List<Pet>()))
        .ForMember(dest => dest.Client, opt => opt.MapFrom(src => src.Client))
        .ForMember(dest => dest.Services, opt => opt.MapFrom(src => src.BookingServices))
        .ForMember(dest => dest.Payments, opt => opt.MapFrom(src => src.Payments))
        .ForMember(dest => dest.OverpaymentConvertedToRevenue, opt => opt.MapFrom(src => src.OverpaymentConvertedToRevenue))
        .ForMember(dest => dest.RevenueConversionAmount, opt => opt.MapFrom(src => src.RevenueConversionAmount))
        .ForMember(dest => dest.RevenueConversionComment, opt => opt.MapFrom(src => src.RevenueConversionComment))
        .ForMember(dest => dest.ChildBookings, opt => opt.MapFrom(src =>
            src.ChildBookings != null && src.ChildBookings.Any()
                ? src.ChildBookings.OrderBy(cb => cb.SegmentOrder ?? 0).ToList()
                : new List<Booking>()));
        // ChildBookings will be mapped automatically by AutoMapper (Booking -> BookingDto recursively)

        // BookingService mappings
        CreateMap<BookingService, BookingServiceDto>()
        .ForMember(dest => dest.Service, opt => opt.MapFrom(src => src.Service))
        .ForMember(dest => dest.PetName, opt => opt.MapFrom(src => src.BookingPet != null ? src.BookingPet.Pet.Name : null));

        // AdditionalService mappings
        CreateMap<AdditionalService, AdditionalServiceDto>();

        // Payment mappings
        CreateMap<Payment, PaymentDto>()
        .ForMember(dest => dest.Booking, opt => opt.MapFrom(src => src.Booking));
        CreateMap<CreatePaymentRequest, Payment>()
        .ForMember(dest => dest.Id, opt => opt.Ignore())
        .ForMember(dest => dest.PaymentStatus, opt => opt.MapFrom(src => Domain.Enums.PaymentStatus.Pending))
        .ForMember(dest => dest.TransactionId, opt => opt.Ignore())
        .ForMember(dest => dest.PaidAt, opt => opt.Ignore())
        .ForMember(dest => dest.AdminComment, opt => opt.Ignore())
        .ForMember(dest => dest.ConfirmedAt, opt => opt.Ignore())
        .ForMember(dest => dest.ConfirmedByAdminId, opt => opt.Ignore())
        .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
        .ForMember(dest => dest.Booking, opt => opt.Ignore());
    }

    private static List<string> DeserializeFeatures(string? featuresJson)
    {
        if (string.IsNullOrWhiteSpace(featuresJson))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(featuresJson) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }

    private static string SanitizeClientEmail(string? email, bool isActiveUser)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        if (!isActiveUser && email.EndsWith("@no-login.local", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        return email;
    }
}
