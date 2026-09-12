import {
  Activity,
  Battery,
  Cable,
  Camera,
  CircuitBoard,
  Cpu,
  Database,
  Fan,
  Flame,
  Gamepad2,
  Gauge,
  Globe,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  MapPin,
  MemoryStick,
  Monitor,
  MousePointer,
  Network,
  Package,
  Printer,
  Router,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Speaker,
  Usb,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Data references icons by string key so it stays serialisable and free of
 * JSX. This is the single place those keys resolve to components.
 */
const iconMap: Record<string, LucideIcon> = {
  activity: Activity,
  battery: Battery,
  cable: Cable,
  camera: Camera,
  'circuit-board': CircuitBoard,
  cpu: Cpu,
  database: Database,
  fan: Fan,
  flame: Flame,
  gamepad: Gamepad2,
  gauge: Gauge,
  globe: Globe,
  'hard-drive': HardDrive,
  headphones: Headphones,
  keyboard: Keyboard,
  laptop: Laptop,
  'map-pin': MapPin,
  'memory-stick': MemoryStick,
  monitor: Monitor,
  'mouse-pointer': MousePointer,
  network: Network,
  package: Package,
  printer: Printer,
  router: Router,
  server: Server,
  shield: Shield,
  'shield-check': ShieldCheck,
  smartphone: Smartphone,
  speaker: Speaker,
  usb: Usb,
  wifi: Wifi,
  zap: Zap,
};

/** Keys offered when choosing a category icon in the admin panel. */
export const CATEGORY_ICON_KEYS = Object.keys(iconMap).filter(
  (key) => !['map-pin', 'shield-check', 'activity', 'flame', 'gauge', 'globe'].includes(key),
);

/** Falls back to the CPU glyph so an unknown key never renders nothing. */
export function resolveIcon(key: string): LucideIcon {
  return iconMap[key] ?? Cpu;
}
