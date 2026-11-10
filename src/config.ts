export const config = {
  adminCode: "idbbali",
  formCode: "12345",
  formEmail: "akumahasiswa2gmail.com",
  formNim: "123456",
  time: {
    timezone: "Asia/Makassar",
    witaOffsetMinutes: 480,
    requireStartAlignment: true,
    allowCrossDay: false,
    slotMinutes: 30,
    minDurationMinutes: 30,
  },
  operatingHours: {
    weekday: { open: "08:30", close: "17:30" },
    saturday: { open: "08:30", close: "14:00" },
    sundayOpen: false,
  },
  leadTime: {
    openRoomMinutes: 60,
    approvalWorkingDays: 1,
    eventWorkingDays: 3,
    pendingGuardHours: 2,
  },
  quota: {
    maxActivePersonal: 2,
    maxHoursPerReservation: 3,
    roomTypes: ["diskusi", "kelas"],
  },
  idempotencyRetentionHours: 24,
} as const;

export type AppConfig = typeof config;
