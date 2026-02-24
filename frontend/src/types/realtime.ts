export type BookingRealtimeDto = {
  id: string;
  clientId: string;
  status: string;
  remainingAmount?: number;
};

export type PaymentRealtimeDto = {
  id: string;
  bookingId: string;
  amount: number;
  paymentStatus: number;
  paymentType: number;
};

export type RealtimeEventMap = {
  BookingCreated: BookingRealtimeDto;
  BookingUpdated: BookingRealtimeDto;
  PaymentReceived: PaymentRealtimeDto;
};

export type RealtimeEvent = keyof RealtimeEventMap;
