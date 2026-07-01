import { BookingStatus } from '../common/enums/booking-status.enum';

/**
 * Template for a role-specific chat message with {placeholder} variables
 * that get filled in with actual values at call time.
 */
export interface ChatMessageTemplate {
  /** Message shown to the customer */
  customer: string;
  /** Message shown to the provider */
  provider: string;
}

/**
 * Format a template string by replacing {key} placeholders with actual values.
 */
export function formatTemplate(
  template: string,
  data: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

// ──────────────────────────────────────
// Booking Status Change Messages
// ──────────────────────────────────────
// When adding a new BookingStatus, add its templates here.
// If you forget, getStatusChatTemplate returns null and no message is sent.

const STATUS_CHAT_TEMPLATES: Partial<
  Record<BookingStatus, ChatMessageTemplate>
> = {
  [BookingStatus.ACCEPTED]: {
    customer:
      '✅ Booking Accepted — {providerName} has accepted your booking. They will be on their way shortly.',
    provider:
      '✅ Booking Accepted — You accepted the booking from {customerName}. They have been notified.',
  },
  [BookingStatus.REJECTED]: {
    customer:
      '❌ Booking Rejected — {providerName} has declined the booking. Please look for other providers.',
    provider:
      '❌ Booking Rejected — You declined the booking from {customerName}.',
  },
  [BookingStatus.ON_THE_WAY]: {
    customer:
      '🚗 Provider On The Way — {providerName} is on their way to your location.',
    provider:
      '🚗 On The Way — You marked yourself as on the way to {customerName}.',
  },
  [BookingStatus.WORKING]: {
    customer:
      '🔧 Service Started — {providerName} has started working on the service.',
    provider: '🔧 In Progress — You started working for {customerName}.',
  },
  [BookingStatus.COMPLETED]: {
    customer:
      '✅ Service Completed — {providerName} has completed the booking. Please rate your experience.',
    provider:
      '✅ Service Completed — You completed the job for {customerName}.',
  },
  [BookingStatus.CANCELLED]: {
    customer:
      '❌ Booking Cancelled — You cancelled the booking with {providerName}.',
    provider: '❌ Booking Cancelled — {customerName} cancelled the booking.',
  },
};

/**
 * Get the role-specific chat message template for a booking status.
 * Returns null if no template is defined (e.g. REQUESTED, PROPOSED_NEW_TIME).
 *
 * @example
 * const tmpl = getStatusChatTemplate(BookingStatus.ACCEPTED);
 * if (tmpl) {
 *   const customerMsg = formatTemplate(tmpl.customer, { providerName: 'Raj' });
 *   const providerMsg = formatTemplate(tmpl.provider, { customerName: 'Amit' });
 * }
 */
export function getStatusChatTemplate(
  status: BookingStatus,
): ChatMessageTemplate | null {
  return STATUS_CHAT_TEMPLATES[status] ?? null;
}

// ──────────────────────────────────────
// Booking Confirmation Messages (quote accepted)
// ──────────────────────────────────────

/**
 * Build role-specific booking confirmation messages.
 */
export function getBookingConfirmationMessages(
  providerName: string,
  customerName: string,
  amount: number,
): ChatMessageTemplate {
  return {
    customer: `✅ Booking confirmed! Amount: ₹${amount}. Provider: ${providerName}. They will contact you shortly.`,
    provider: `✅ Booking confirmed! You have a new booking from ${customerName} for ₹${amount}. Please contact them shortly.`,
  };
}
