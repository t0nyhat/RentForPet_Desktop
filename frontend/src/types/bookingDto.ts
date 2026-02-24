import type { BookingStatusKey } from "../constants/bookingStatusTheme";

export type PetDto = {
  id: string;
  name: string;
  species: number;
  gender: number;
};

export type RoomDto = {
  id: string;
  roomNumber: string;
  roomType: string;
};

export type BookingServiceDto = {
  id: string;
  bookingId: string;
  serviceId: string;
  quantity: number;
  price: number;
  service?: {
    id: string;
    serviceType: number;
    name: string;
    description?: string;
    price: number;
    unit: number;
  };
  petName?: string;
};

export type BookingDto = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: BookingStatusKey;
  numberOfPets: number;
  numberOfNights: number;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  discountPercent?: number;
  loyaltyDiscountPercent?: number;
  discountAmount?: number;
  basePrice: number;
  additionalPetsPrice: number;
  servicesPrice: number;
  specialRequests?: string;
  paymentApproved: boolean;
  requiredPrepaymentAmount: number;
  room?: RoomDto;
  pets: PetDto[];
  services: BookingServiceDto[];
  isEarlyCheckout?: boolean;
  originalCheckOutDate?: string | null;
  isComposite?: boolean;
  parentBookingId?: string | null;
  segmentOrder?: number | null;
  childBookings?: BookingDto[];
};
