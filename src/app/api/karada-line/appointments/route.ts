/**
 * LINE予約一覧 API
 * GET  /api/karada-line/appointments  — 全LINE予約を返す
 * POST /api/karada-line/appointments  — シミュレーター用: 直接予約を追加
 * PATCH /api/karada-line/appointments — ステータス更新
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLineAppointments,
  addLineAppointment,
  updateLineAppointmentStatus,
} from '@/lib/karada-line-session';

export async function GET() {
  return NextResponse.json(getLineAppointments());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const appt = addLineAppointment({
    patientName: body.patientName,
    lineUserId: body.lineUserId ?? `sim-${Date.now()}`,
    lineDisplayName: body.lineDisplayName,
    datetime: body.datetime,
    status: 'pending',
  });
  return NextResponse.json(appt);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  updateLineAppointmentStatus(body.id, body.status, body.linkedPatientId);
  return NextResponse.json({ ok: true });
}
