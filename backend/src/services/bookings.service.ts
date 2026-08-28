import { supabaseAdmin } from '../config/supabaseAdmin';
import { unwrap } from '../utils/db';
import { HttpError } from '../middleware/auth';
import { logActivity } from '../utils/activityLog';
import { AuthUser } from '../types';
import { getLeadById, updateLead } from './leads.service';

export interface Booking {
  id: string;
  lead_id: string;
  staff_id: string;
  project_id: string;
  property_plot: string;
  amount: number;
  down_payment_done: boolean;
  booking_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingInput {
  leadId: string;
  propertyPlot: string;
  amount: number;
  downPaymentDone?: boolean;
  notes?: string;
}

export interface BookingWithLead extends Booking {
  lead: {
    id: string;
    name: string;
    phone: string | null;
    company: string | null;
    city: string | null;
    source_id: string | null;
    assigned_staff_id: string | null;
    assigned_team_lead_id: string | null;
    status: string;
  } | null;
}

/**
 * Lists every recorded sale (i.e. every won lead), newest first. Scoped the
 * same way leads are: admin sees all, team_lead sees their team's, staff
 * sees only their own — enforced through an inner join on the lead.
 */
export async function listBookings(user: AuthUser, projectId?: string): Promise<BookingWithLead[]> {
  let query = supabaseAdmin
    .from('bookings')
    .select(
      '*, lead:leads!inner(id, name, phone, company, city, source_id, assigned_staff_id, assigned_team_lead_id, status)',
    );

  if (user.role === 'staff') {
    query = query.eq('lead.assigned_staff_id', user.id);
  } else if (user.role === 'team_lead') {
    query = query.eq('lead.assigned_team_lead_id', user.id);
  }
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query.order('booking_date', { ascending: false });
  if (error) {
    throw new HttpError(400, error.message);
  }
  return (data ?? []) as BookingWithLead[];
}

/**
 * Records a sale against a lead and moves it to "won". Reuses updateLead()
 * for the status change so notifications/scoping stay in one place instead
 * of being duplicated here.
 */
export async function createBooking(user: AuthUser, input: CreateBookingInput): Promise<Booking> {
  // Scoped fetch: 404s (not 403) if this lead is outside the user's visibility.
  const lead = await getLeadById(user, input.leadId);
  const staffId = user.role === 'staff' ? user.id : (lead.assigned_staff_id ?? user.id);

  const booking = unwrap(
    await supabaseAdmin
      .from('bookings')
      .insert({
        lead_id: input.leadId,
        staff_id: staffId,
        project_id: lead.project_id,
        property_plot: input.propertyPlot,
        amount: input.amount,
        down_payment_done: input.downPaymentDone ?? false,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  ) as Booking;

  await updateLead(user, input.leadId, { status: 'won' });

  await logActivity({
    actorId: user.id,
    entityType: 'lead',
    entityId: input.leadId,
    action: 'booking_created',
    metadata: {
      bookingId: booking.id,
      propertyPlot: booking.property_plot,
      amount: booking.amount,
      downPaymentDone: booking.down_payment_done,
    },
  });

  return booking;
}
