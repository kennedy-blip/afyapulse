import { CalendarClock, Pill, Settings2, Stethoscope } from 'lucide-react'

export const NAV_ITEMS = [
  {
    id: 'triage',
    label: 'Triage',
    icon: Stethoscope,
    title: 'Triage & Patient Register',
    subtitle: 'Intake, vitals and clinical risk flags',
    badge: 'urgent',
  },
  {
    id: 'schedules',
    label: 'Schedules',
    icon: CalendarClock,
    title: 'Follow-up & Immunisation',
    subtitle: 'ANC contacts, EPI milestones and overdue alerts',
    badge: 'overdue',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    title: 'Dispensary & Cold Chain',
    subtitle: 'Stock levels, expiries and dispensing ledger',
    badge: 'stock',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings2,
    title: 'Clinic Settings',
    subtitle: 'Roles, ward lighting, storage and the APK centre',
    badge: null,
  },
]

export function navItem(id) {
  return NAV_ITEMS.find((item) => item.id === id) || NAV_ITEMS[0]
}
