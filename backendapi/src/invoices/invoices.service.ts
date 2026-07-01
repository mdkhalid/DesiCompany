import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ProviderService } from '../services/entities/provider-service.entity';

interface InvoiceCharge {
  type: string;
  description: string;
  amount: number;
}

export interface InvoiceData {
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    bookingId: string;
    bookingDate: Date;
    bookingStatus: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  provider: {
    name: string;
    email: string;
    phone: string;
  };
  service: {
    category: string;
    description: string;
  };
  charges: InvoiceCharge[];
  financials: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    commissionRate: number;
    commissionAmount: number;
    providerEarnings: number;
  };
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    gatewayOrderId: string;
  } | null;
  company: {
    name: string;
    address: string;
    gstin: string;
  };
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ProviderService)
    private readonly providerServiceRepository: Repository<ProviderService>,
  ) {}

  async generateInvoice(bookingId: string): Promise<InvoiceData> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
        charges: true,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const payment = await this.paymentRepository.findOne({
      where: { booking: { id: bookingId } },
      order: { createdAt: 'DESC' },
    });

    const subtotal =
      Number(booking.totalAmount) - this.getTaxAmount(booking.totalAmount);
    const taxAmount = this.getTaxAmount(booking.totalAmount);
    const commissionRate =
      booking.commissionAmount > 0
        ? (Number(booking.commissionAmount) / Number(booking.totalAmount)) * 100
        : 0;

    return {
      invoice: {
        invoiceNumber: `INV-${booking.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        invoiceDate: new Date().toISOString(),
        bookingId: booking.id,
        bookingDate: booking.scheduledDate,
        bookingStatus: booking.status,
      },
      customer: {
        name: `${booking.customer.firstName} ${booking.customer.lastName || ''}`.trim(),
        email: booking.customer.user.email,
        phone: booking.customer.user.phone,
        address: [
          booking.customer.address,
          booking.customer.city,
          booking.customer.state,
          booking.customer.pincode,
        ]
          .filter(Boolean)
          .join(', '),
      },
      provider: {
        name: `${booking.provider.firstName} ${booking.provider.lastName || ''}`.trim(),
        email: booking.provider.user.email,
        phone: booking.provider.user.phone,
      },
      service: {
        category: booking.providerService?.category?.nameEn,
        description: booking.description,
      },
      charges: (booking.charges || []).map((charge) => ({
        type: charge.chargeType,
        description: charge.description,
        amount: Number(charge.amount),
      })),
      financials: {
        subtotal: Number(subtotal.toFixed(2)),
        taxRate: 18,
        taxAmount: Number(taxAmount.toFixed(2)),
        totalAmount: Number(booking.totalAmount),
        commissionRate: Number(commissionRate.toFixed(2)),
        commissionAmount: Number(booking.commissionAmount),
        providerEarnings: Number(booking.providerAmount),
      },
      payment: payment
        ? {
            id: payment.id,
            method: payment.method,
            status: payment.status,
            amount: Number(payment.amount),
            gatewayOrderId: payment.gatewayOrderId,
          }
        : null,
      company: {
        name: 'DesiCompany',
        address: 'Mumbai, Maharashtra, India',
        gstin: 'GSTIN-PLACEHOLDER',
      },
    };
  }

  async getInvoiceHTML(bookingId: string): Promise<string> {
    const invoice = await this.generateInvoice(bookingId);
    return this.renderInvoiceHTML(invoice);
  }

  private renderInvoiceHTML(invoice: InvoiceData): string {
    const chargesHTML = invoice.charges
      .map(
        (c) =>
          `<tr><td>${c.type}</td><td>${c.description || '-'}</td><td style="text-align:right">Rs. ${c.amount.toFixed(2)}</td></tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html><head><style>
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}
.header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:30px}
.company h1{margin:0;color:#2563eb}
.invoice-info{text-align:right}
.parties{display:flex;justify-content:space-between;margin-bottom:30px}
.party{padding:15px;border:1px solid #ddd;border-radius:8px;width:45%}
.party h3{margin-top:0;color:#666;font-size:14px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#f5f5f5;padding:10px;text-align:left;border-bottom:1px solid #ddd}
td{padding:10px;border-bottom:1px solid #eee}
.totals{margin-top:20px;margin-left:auto;width:300px}
.total-row{display:flex;justify-content:space-between;padding:5px 0}
.total-final{font-weight:bold;font-size:18px;border-top:2px solid #333;padding-top:10px}
</style></head><body>
<div class="header"><div class="company"><h1>${invoice.company.name}</h1><p>${invoice.company.address}</p><p>GSTIN: ${invoice.company.gstin}</p></div>
<div class="invoice-info"><h2>INVOICE</h2><p><strong>${invoice.invoice.invoiceNumber}</strong></p><p>Date: ${new Date(invoice.invoice.invoiceDate).toLocaleDateString('en-IN')}</p></div></div>
<div class="parties">
<div class="party"><h3>Bill To</h3><p><strong>${invoice.customer.name}</strong></p><p>${invoice.customer.phone}</p><p>${invoice.customer.email || ''}</p><p>${invoice.customer.address || ''}</p></div>
<div class="party"><h3>Service Provider</h3><p><strong>${invoice.provider.name}</strong></p><p>${invoice.provider.phone}</p><p>${invoice.provider.email || ''}</p></div></div>
<h3>Service Details</h3><table>
<thead><tr><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
<tbody><tr><td>${invoice.service.category || 'Service'}</td><td>${invoice.service.description || '-'}</td><td style="text-align:right">Rs. ${(invoice.financials.subtotal - invoice.charges.reduce((s: number, c) => s + c.amount, 0)).toFixed(2)}</td></tr>
${chargesHTML}</tbody></table>
<div class="totals"><div class="total-row"><span>Subtotal:</span><span>Rs. ${invoice.financials.subtotal.toFixed(2)}</span></div>
<div class="total-row"><span>GST (${invoice.financials.taxRate}%):</span><span>Rs. ${invoice.financials.taxAmount.toFixed(2)}</span></div>
<div class="total-row total-final"><span>Total:</span><span>Rs. ${invoice.financials.totalAmount.toFixed(2)}</span></div>
<div class="total-row" style="color:#666;margin-top:15px"><span>Platform Commission (${invoice.financials.commissionRate}%):</span><span>Rs. ${invoice.financials.commissionAmount.toFixed(2)}</span></div>
<div class="total-row" style="color:#16a34a"><span>Provider Earnings:</span><span>Rs. ${invoice.financials.providerEarnings.toFixed(2)}</span></div></div>
${invoice.payment ? `<div style="margin-top:30px;padding:15px;background:#f0f9ff;border-radius:8px"><h3>Payment Information</h3><p><strong>Method:</strong> ${invoice.payment.method} | <strong>Status:</strong> ${invoice.payment.status} | <strong>Amount:</strong> Rs. ${invoice.payment.amount.toFixed(2)}</p></div>` : ''}
</body></html>`;
  }

  private getTaxAmount(totalAmount: number): number {
    const taxRate = 0.18 / 1.18;
    return Number(totalAmount) * taxRate;
  }
}
