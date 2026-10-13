import { Compass, Heart, PartyPopper, Music, Home, Sparkles, CheckCircle, Gift, Camera, Utensils, Hotel, Car, Ticket, ShoppingBag, ShieldCheck } from 'lucide-react';

export interface EventTypeConfig {
  id: string;
  title: string;
  iconName: string;
  emoji: string;
  badge?: string;
  badgeBg: string;
  badgeText: string;
  borderActive: string;
  bgActive: string;
  description: string;
  placeholder: string;
  categories: { name: string; emoji: string }[];
  features: string[];
}

export const EVENT_TYPES: EventTypeConfig[] = [
  {
    id: 'trip',
    title: 'Trip / Vacation',
    iconName: 'Compass',
    emoji: '✈️',
    badge: 'Popular',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderActive: 'border-emerald-500 ring-emerald-500/20',
    bgActive: 'bg-emerald-50/50',
    description: 'Road trips, weekend getaways, group vacations & adventures',
    placeholder: 'e.g. Ella & Badulla Trip 2026',
    categories: [
      { name: 'Hotel & Lodging', emoji: '🏨' },
      { name: 'Transport & Flights', emoji: '🚗' },
      { name: 'Food & Dining', emoji: '🍽️' },
      { name: 'Sightseeing & Tickets', emoji: '🎟️' },
      { name: 'Fuel & Tolls', emoji: '⛽' },
      { name: 'Shopping & Souvenirs', emoji: '🛍️' },
    ],
    features: [
      'Multi-currency support for international travel',
      'Offline calculation on remote locations',
      'Penny-exact debt minimization',
    ],
  },
  {
    id: 'wedding',
    title: 'Wedding Planning',
    iconName: 'Heart',
    emoji: '💍',
    badge: 'Dedicated Suite',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    borderActive: 'border-rose-500 ring-rose-500/20',
    bgActive: 'bg-rose-50/50',
    description: 'Bride, Groom, family & committee vendor budget manager',
    placeholder: 'e.g. Nimal & Sunethra Wedding 2026',
    categories: [
      { name: 'Venue & Hall', emoji: '🏰' },
      { name: 'Catering & Food', emoji: '🍽️' },
      { name: 'Photography & Video', emoji: '📸' },
      { name: 'Attire & Makeup', emoji: '👗' },
      { name: 'Flowers & Decor', emoji: '💐' },
      { name: 'Gifts & Favors', emoji: '🎁' },
      { name: 'Music & Entertainment', emoji: '🎵' },
    ],
    features: [
      'Vendor advance payment tracking',
      'Bride/Groom & Family split allocation',
      'Settlement history & proof records',
    ],
  },
  {
    id: 'party',
    title: 'Party / Night Out',
    iconName: 'PartyPopper',
    emoji: '🎉',
    badge: 'Fun & Fast',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    borderActive: 'border-amber-500 ring-amber-500/20',
    bgActive: 'bg-amber-50/50',
    description: 'Birthday parties, pub nights, beach bashes & celebrations',
    placeholder: 'e.g. Kasun\'s 25th Birthday Bash',
    categories: [
      { name: 'Drinks & Spirits', emoji: '🍾' },
      { name: 'Food & Snacks', emoji: '🍕' },
      { name: 'Venue Rent', emoji: '🎪' },
      { name: 'Decorations & Props', emoji: '🎈' },
      { name: 'Cake & Desserts', emoji: '🎂' },
    ],
    features: [
      'Quick batch entry for multiple round bills',
      'Equal or custom drinks split among attendees',
      'Instant settlement summary QR link',
    ],
  },
  {
    id: 'music_event',
    title: 'Music Event / Concert',
    iconName: 'Music',
    emoji: '🎵',
    badge: 'Gigs & Shows',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderActive: 'border-purple-500 ring-purple-500/20',
    bgActive: 'bg-purple-50/50',
    description: 'Concerts, music festivals, gig passes & crew stay',
    placeholder: 'e.g. Summer Music Fest 2026',
    categories: [
      { name: 'Tickets & Passes', emoji: '🎟️' },
      { name: 'Cabs & Transport', emoji: '🚕' },
      { name: 'Drinks & Food', emoji: '🍔' },
      { name: 'Merchandise', emoji: '👕' },
      { name: 'Hotel & Stay', emoji: '🏨' },
    ],
    features: [
      'Ticket cost sharing with specific attendees',
      'Instant breakdown of pass vs travel costs',
      'Mobile bottom navigation for fast entry during shows',
    ],
  },
  {
    id: 'home_function',
    title: 'Home Function',
    iconName: 'Home',
    emoji: '🏠',
    badge: 'Family Gathering',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    borderActive: 'border-blue-500 ring-blue-500/20',
    bgActive: 'bg-blue-50/50',
    description: 'Housewarming, alms-givings, family dinners & ceremonies',
    placeholder: 'e.g. Family New Year Gathering',
    categories: [
      { name: 'Groceries & Supplies', emoji: '🛒' },
      { name: 'Catering & Rentals', emoji: '🍲' },
      { name: 'Refreshments & Tea', emoji: '☕' },
      { name: 'Helper & Service Charges', emoji: '🤝' },
      { name: 'Utilities & Setup', emoji: '💡' },
    ],
    features: [
      'Share expense summary with extended family',
      'Itemized receipt log for grocery bills',
      'Simplified net balances between relatives',
    ],
  },
  {
    id: 'other',
    title: 'General / Custom',
    iconName: 'Sparkles',
    emoji: '⚡',
    badge: 'Flexible',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    borderActive: 'border-brand-500 ring-brand-500/20',
    bgActive: 'bg-brand-50/40',
    description: 'Roommates, shared office expenses & custom events',
    placeholder: 'e.g. Apartment Monthly Expenses',
    categories: [
      { name: 'Food', emoji: '🍲' },
      { name: 'Transport', emoji: '🚗' },
      { name: 'Bills & Utilities', emoji: '📄' },
      { name: 'Shopping', emoji: '🛍️' },
      { name: 'Other', emoji: '📦' },
    ],
    features: [
      'Fully custom splitting rules',
      'PDF & Excel summary export',
      'Member approval request workflow',
    ],
  },
];
