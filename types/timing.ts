// ============================================================
// Boxstock Timing System — Types
// ============================================================

// --- Race State Machine ---
//
//   SETUP ──→ ACTIVE ──→ COMPLETE
//     │                     ▲
//     └──→ PRACTICE ────────┘
//
//   SETUP:    configuring participants & transponders
//   ACTIVE:   race running, countdown ticking, laps recording
//   PRACTICE: free session, no countdown, manual stop only
//   COMPLETE: race finished, results frozen
//

export type RaceStatus = 'setup' | 'active' | 'complete' | 'practice';
export type RaceMode = 'race' | 'practice';

export interface Race {
  id: string;
  createdBy: string | null;
  status: RaceStatus;
  mode: RaceMode;
  durationMs: number | null;       // null for practice
  trackId: string | null;          // optional link to saved layout
  title: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface RaceParticipant {
  id: string;
  raceId: string;
  userId: string | null;           // null for guests
  displayName: string;
  transponderId: number;           // raw 2-byte value (e.g. 0x3958 = 14680)
  transponderHex: string;          // display string (e.g. "3958")
  isGuest: boolean;
}

export interface RaceLap {
  id: string;
  raceId: string;
  participantId: string;
  lapNumber: number;
  lapTimeMs: number;               // duration of this lap
  decoderTsMs: number;             // raw decoder timestamp
  wallClockAt: string;
  suppressed: boolean;
}

export interface RaceResult {
  id: string;
  raceId: string;
  participantId: string;
  position: number;
  totalLaps: number;
  bestLapMs: number | null;
  totalTimeMs: number;
}

// --- Live Leaderboard (client-side computed) ---

export interface LeaderboardEntry {
  participant: RaceParticipant;
  position: number;
  totalLaps: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  totalTimeMs: number;
  isSessionBestLap: boolean;       // true if this driver holds the overall fastest lap
}

// --- Transponder Assignment ---

export type AssignMode = 'manual' | 'detect';

export interface TransponderAssignment {
  participantId: string;
  mode: AssignMode;
  detecting: boolean;              // true when listening for next transponder event
}

// --- Decoder Connection ---

export type DecoderStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DecoderState {
  status: DecoderStatus;
  lastTickMs: number | null;       // last decoder heartbeat timestamp
  error: string | null;
}

// --- Duplicate Suppression Config ---

export interface SuppressionConfig {
  debounceMs: number;              // ignore repeat reads within this window (default 2000)
  minLapMs: number;                // minimum valid lap time (default 3000)
}

export const DEFAULT_SUPPRESSION: SuppressionConfig = {
  debounceMs: 2000,
  minLapMs: 3000,
};

// --- Race State Transitions ---

export type RaceAction =
  | { type: 'ADD_PARTICIPANT'; participant: Omit<RaceParticipant, 'id'> }
  | { type: 'REMOVE_PARTICIPANT'; participantId: string }
  | { type: 'ASSIGN_TRANSPONDER'; participantId: string; transponderId: number }
  | { type: 'START_RACE' }
  | { type: 'START_PRACTICE' }
  | { type: 'STOP_RACE' }
  | { type: 'LAP_DETECTED'; transponderId: number; decoderTsMs: number }
  | { type: 'TICK'; decoderTsMs: number }
  | { type: 'DECODER_CONNECTED' }
  | { type: 'DECODER_DISCONNECTED' }
  | { type: 'TIME_EXPIRED' };

// --- Valid Transitions ---
//
// SETUP      → ACTIVE       (START_RACE: requires ≥1 participant, all transponders assigned, decoder connected)
// SETUP      → PRACTICE     (START_PRACTICE: same requirements minus duration)
// ACTIVE     → COMPLETE     (STOP_RACE or TIME_EXPIRED)
// PRACTICE   → COMPLETE     (STOP_RACE)
// COMPLETE   → (terminal)
//

// --- CSV Export ---

export interface ExportRow {
  position: number;
  name: string;
  laps: number;
  bestLap: string;                 // formatted "12.345"
  totalTime: string;               // formatted "5:23.456"
}

// --- IndexedDB (offline storage) ---

export interface LocalRaceRecord {
  race: Race;
  participants: RaceParticipant[];
  laps: RaceLap[];
  results: RaceResult[];
  synced: boolean;                 // false until successfully POSTed to Supabase
}
