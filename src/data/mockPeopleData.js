import { tileGrid, isWalkable } from '../map/mockStadiumMap.js';

// ============================================================================
// STAFF MEMBERS — each has a fixed zone/location within the stadium
// ============================================================================
export const STAFF_MEMBERS = [
  // Security
  { id: 'staff-001', name: 'Carlos Mendes',   role: 'SEC', roleLabel: 'Security',   tileX: 29, tileY: 5,  zone: 'North Gate Area',       phone: '+1-555-0101', color: '#ef4444' },
  { id: 'staff-002', name: 'Aisha Kamara',    role: 'SEC', roleLabel: 'Security',   tileX: 35, tileY: 5,  zone: 'North Concourse',       phone: '+1-555-0102', color: '#ef4444' },
  { id: 'staff-003', name: 'Liam O\'Brien',   role: 'SEC', roleLabel: 'Security',   tileX: 29, tileY: 32, zone: 'South Gate Area',       phone: '+1-555-0103', color: '#ef4444' },
  { id: 'staff-004', name: 'Zara Patel',      role: 'SEC', roleLabel: 'Security',   tileX: 3,  tileY: 18, zone: 'West Entrance',         phone: '+1-555-0104', color: '#ef4444' },
  { id: 'staff-005', name: 'Marcus Webb',     role: 'SEC', roleLabel: 'Security',   tileX: 46, tileY: 18, zone: 'East Entrance',         phone: '+1-555-0105', color: '#ef4444' },
  // Operations
  { id: 'staff-006', name: 'Fatima Al-Hassan',role: 'OPS', roleLabel: 'Operations', tileX: 10, tileY: 4,  zone: 'North Food Stand 1',    phone: '+1-555-0106', color: '#3b82f6' },
  { id: 'staff-007', name: 'Diego Vega',      role: 'OPS', roleLabel: 'Operations', tileX: 16, tileY: 4,  zone: 'North Food Stand 2',    phone: '+1-555-0107', color: '#3b82f6' },
  { id: 'staff-008', name: 'Priya Nair',      role: 'OPS', roleLabel: 'Operations', tileX: 40, tileY: 4,  zone: 'North Food Stand 3',    phone: '+1-555-0108', color: '#3b82f6' },
  { id: 'staff-009', name: 'Tom Fischer',     role: 'OPS', roleLabel: 'Operations', tileX: 10, tileY: 32, zone: 'South Food Stand 4',    phone: '+1-555-0109', color: '#3b82f6' },
  { id: 'staff-010', name: 'Ana Sousa',       role: 'OPS', roleLabel: 'Operations', tileX: 28, tileY: 32, zone: 'South Food Stand 5',    phone: '+1-555-0110', color: '#3b82f6' },
  // Medical
  { id: 'staff-011', name: 'Dr. Kenji Ito',   role: 'MED', roleLabel: 'Medical',    tileX: 22, tileY: 4,  zone: 'North Medical Bay',     phone: '+1-555-0111', color: '#10b981' },
  { id: 'staff-012', name: 'Dr. Clara Stein', role: 'MED', roleLabel: 'Medical',    tileX: 22, tileY: 32, zone: 'South Medical Bay',     phone: '+1-555-0112', color: '#10b981' },
  { id: 'staff-013', name: 'Nurse Raj Singh', role: 'MED', roleLabel: 'Medical',    tileX: 4,  tileY: 16, zone: 'West Medical Point',    phone: '+1-555-0113', color: '#10b981' },
  { id: 'staff-014', name: 'Nurse Yemi Bello',role: 'MED', roleLabel: 'Medical',    tileX: 46, tileY: 22, zone: 'East Medical Point',    phone: '+1-555-0114', color: '#10b981' },
  // Stewards
  { id: 'staff-015', name: 'Sophie Martin',   role: 'STW', roleLabel: 'Steward',    tileX: 6,  tileY: 2,  zone: 'Section 101',           phone: '+1-555-0115', color: '#a855f7' },
  { id: 'staff-016', name: 'James Kim',       role: 'STW', roleLabel: 'Steward',    tileX: 18, tileY: 2,  zone: 'Section 103',           phone: '+1-555-0116', color: '#a855f7' },
  { id: 'staff-017', name: 'Layla Hassan',    role: 'STW', roleLabel: 'Steward',    tileX: 36, tileY: 2,  zone: 'Section 106',           phone: '+1-555-0117', color: '#a855f7' },
  { id: 'staff-018', name: 'Ben Torres',      role: 'STW', roleLabel: 'Steward',    tileX: 6,  tileY: 33, zone: 'Section 108',           phone: '+1-555-0118', color: '#a855f7' },
  { id: 'staff-019', name: 'Nina Chávez',     role: 'STW', roleLabel: 'Steward',    tileX: 30, tileY: 33, zone: 'Section 112',           phone: '+1-555-0119', color: '#a855f7' },
  { id: 'staff-020', name: 'Omar Farouq',     role: 'STW', roleLabel: 'Steward',    tileX: 42, tileY: 33, zone: 'Section 114',           phone: '+1-555-0120', color: '#a855f7' },
  // Management
  { id: 'staff-021', name: 'Elena Kovač',     role: 'MGR', roleLabel: 'Manager',    tileX: 24, tileY: 4,  zone: 'Control Room (North)',   phone: '+1-555-0121', color: '#f59e0b' },
  { id: 'staff-022', name: 'Victor Durand',   role: 'MGR', roleLabel: 'Manager',    tileX: 24, tileY: 32, zone: 'Control Room (South)',   phone: '+1-555-0122', color: '#f59e0b' },
  // Merchandise
  { id: 'staff-023', name: 'Grace Osei',      role: 'MRC', roleLabel: 'Merch',      tileX: 28, tileY: 4,  zone: 'North Merch Stand',     phone: '+1-555-0123', color: '#ec4899' },
  { id: 'staff-024', name: 'Finn Larsen',     role: 'MRC', roleLabel: 'Merch',      tileX: 16, tileY: 32, zone: 'South Merch Stand',     phone: '+1-555-0124', color: '#ec4899' },
  // Cleaning
  { id: 'staff-025', name: 'Rosa Lima',       role: 'CLN', roleLabel: 'Cleaning',   tileX: 4,  tileY: 4,  zone: 'North Restrooms',       phone: '+1-555-0125', color: '#6b7280' },
  { id: 'staff-026', name: 'Hamid Reza',      role: 'CLN', roleLabel: 'Cleaning',   tileX: 4,  tileY: 32, zone: 'South Restrooms',       phone: '+1-555-0126', color: '#6b7280' },
  { id: 'staff-027', name: 'Mei Lin',         role: 'CLN', roleLabel: 'Cleaning',   tileX: 34, tileY: 4,  zone: 'NE Concourse',          phone: '+1-555-0127', color: '#6b7280' },
  { id: 'staff-028', name: 'Kwame Asante',    role: 'CLN', roleLabel: 'Cleaning',   tileX: 34, tileY: 32, zone: 'SE Concourse',          phone: '+1-555-0128', color: '#6b7280' },
  // IT / Tech
  { id: 'staff-029', name: 'Aleksei Petrov',  role: 'TCH', roleLabel: 'Tech',       tileX: 22, tileY: 16, zone: 'Network Hub (Center)',  phone: '+1-555-0129', color: '#06b6d4' },
  { id: 'staff-030', name: 'Sara Watanabe',   role: 'TCH', roleLabel: 'Tech',       tileX: 26, tileY: 18, zone: 'AV Control',            phone: '+1-555-0130', color: '#06b6d4' },
];

// ============================================================================
// SECTION DEFINITIONS — approximate bounding areas for clustering
// ============================================================================
export const SECTIONS = [
  { id: 'north-concourse', name: 'North Concourse', minX: 5,  maxX: 44, minY: 1,  maxY: 7  },
  { id: 'south-concourse', name: 'South Concourse', minX: 5,  maxX: 44, minY: 29, maxY: 35 },
  { id: 'west-concourse',  name: 'West Concourse',  minX: 1,  maxX: 7,  minY: 8,  maxY: 28 },
  { id: 'east-concourse',  name: 'East Concourse',  minX: 42, maxX: 48, minY: 8,  maxY: 28 },
  { id: 'inner-field',     name: 'Inner Bowl',      minX: 8,  maxX: 41, minY: 8,  maxY: 28 },
];

// ============================================================================
// GENERATE RANDOM FAN POSITIONS on walkable tiles
// ============================================================================
let _cachedFans = null;

export function generateFanPositions(count = 500) {
  if (_cachedFans) return _cachedFans;

  const walkable = [];
  const rows = tileGrid.length;
  const cols = tileGrid[0].length;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isWalkable(x, y)) walkable.push({ x, y });
    }
  }

  // Shuffle and pick
  for (let i = walkable.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [walkable[i], walkable[j]] = [walkable[j], walkable[i]];
  }

  _cachedFans = walkable.slice(0, count).map((pos, i) => ({
    id: `fan-${i}`,
    tileX: pos.x,
    tileY: pos.y
  }));

  return _cachedFans;
}

// ============================================================================
// CROWD STATS — section occupancy (deterministic with some variation)
// ============================================================================
export function getSectionStats() {
  const fans = generateFanPositions();
  const stats = {};

  SECTIONS.forEach(sec => {
    const count = fans.filter(f =>
      f.tileX >= sec.minX && f.tileX <= sec.maxX &&
      f.tileY >= sec.minY && f.tileY <= sec.maxY
    ).length;
    stats[sec.id] = {
      name: sec.name,
      count,
      capacity: 1200,
      pct: Math.round((count / 1200) * 100)
    };
  });

  return stats;
}

// ============================================================================
// AI ALERTS — time-triggered deterministic simulation
// ============================================================================
const ALERT_TEMPLATES = [
  {
    id: 'a1',
    severity: 'warning',
    icon: '🍕',
    title: 'Halftime Rush Predicted',
    message: 'Break in ~5 min. North Food Stands 1–3 will see 3× traffic. Pre-position 2 staff at Stand 1.',
    location: 'North Food Stands',
    actionLabel: 'Deploy Staff',
    delay: 0
  },
  {
    id: 'a2',
    severity: 'critical',
    icon: '🚨',
    title: 'Gate 10 Overcrowding',
    message: 'Entry rate at Gate 10 is up 28% vs. last 5 min average. Queue forming outside. Dispatch team immediately.',
    location: 'Gate 10',
    actionLabel: 'Dispatch Team',
    delay: 18000
  },
  {
    id: 'a3',
    severity: 'warning',
    icon: '💺',
    title: 'Section 108–110 Near Capacity',
    message: 'South stand sections 108–110 at 91% capacity. Consider opening overflow Section 108-EXT.',
    location: 'South Concourse',
    actionLabel: 'Open Overflow',
    delay: 35000
  },
  {
    id: 'a4',
    severity: 'info',
    icon: '🚻',
    title: 'West Restroom Queue Building',
    message: 'Density near West Restroom 5 is 4× baseline. Average wait est. 8 min. Suggest opening staff restroom as relief.',
    location: 'West Concourse',
    actionLabel: 'Open Relief Point',
    delay: 55000
  },
  {
    id: 'a5',
    severity: 'critical',
    icon: '🏥',
    title: 'Medical Response Likely Needed',
    message: 'High crowd density spike near South Concourse. Statistically elevated risk of heat/crush incident. Alert Medical Team 2.',
    location: 'South Concourse',
    actionLabel: 'Alert Medical',
    delay: 80000
  },
  {
    id: 'a6',
    severity: 'warning',
    icon: '🚪',
    title: 'Gate 4 Exit Bottleneck',
    message: 'Post-goal crowd movement toward Gate 4. Estimated 340 people/min. Open auxiliary gate to reduce congestion.',
    location: 'Gate 4',
    actionLabel: 'Open Aux Gate',
    delay: 105000
  },
  {
    id: 'a7',
    severity: 'info',
    icon: '🎽',
    title: 'Merch Stand Low Stock Alert',
    message: 'North Merchandise Stand 1 is projecting stock depletion in ~12 min at current sales rate. Restock from storage bay.',
    location: 'North Merch Stand',
    actionLabel: 'Restock Now',
    delay: 130000
  },
  {
    id: 'a8',
    severity: 'critical',
    icon: '⚡',
    title: 'Crowd Surge — East Entrance',
    message: 'Sudden 40% jump in East Concourse density. Possible crowd surge event. All East Zone staff to stations.',
    location: 'East Concourse',
    actionLabel: 'All Stations',
    delay: 160000
  },
  {
    id: 'a9',
    severity: 'info',
    icon: '🅿️',
    title: 'Parking Lot A Filling Fast',
    message: 'Exterior Lot A at 87% capacity. Redirect incoming vehicles to Lot B via signage on North Road.',
    location: 'Parking Lot A',
    actionLabel: 'Redirect Traffic',
    delay: 190000
  },
  {
    id: 'a10',
    severity: 'warning',
    icon: '🔊',
    title: 'PA Announcement Recommended',
    message: 'Fan flow analysis suggests many fans will converge on Gate 1 at final whistle. PA queue-management announcement advised.',
    location: 'All Gates',
    actionLabel: 'Make Announcement',
    delay: 220000
  }
];

export function getAlertTemplates() {
  return ALERT_TEMPLATES;
}
