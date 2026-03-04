// ============================================================
// Boxstock Timing — Race State Machine
// ============================================================
//
// Pure reducer: no side effects, no DB calls, no WebHID.
// UI dispatches actions → reducer returns new state.
// Middleware handles persistence (IndexedDB + Supabase sync).
//

import type {
  Race,
  RaceParticipant,
  RaceLap,
  RaceAction,
  LeaderboardEntry,
  DecoderState,
  SuppressionConfig,
  DEFAULT_SUPPRESSION,
} from '@/types/timing';

// --- Full Race State ---

export interface RaceState {
  race: Race;
  participants: RaceParticipant[];
  laps: RaceLap[];
  decoder: DecoderState;
  suppression: SuppressionConfig;

  // Derived / cached
  leaderboard: LeaderboardEntry[];
  sessionBestLapMs: number | null;
  sessionBestLapParticipantId: string | null;
  remainingMs: number | null;      // null for practice, countdown for race

  // Transponder detection mode
  detectingForParticipantId: string | null;

  // Track last detection per transponder for debounce + lap calc
  lastDetection: Map<number, { decoderTsMs: number; participantId: string }>;
}

// --- Reducer ---

export function raceReducer(state: RaceState, action: RaceAction): RaceState {
  switch (action.type) {

    // ── Participants ──────────────────────────────────────

    case 'ADD_PARTICIPANT': {
      if (state.race.status !== 'setup') return state;
      const participant: RaceParticipant = {
        ...action.participant,
        id: crypto.randomUUID(),
      };
      return {
        ...state,
        participants: [...state.participants, participant],
      };
    }

    case 'REMOVE_PARTICIPANT': {
      if (state.race.status !== 'setup') return state;
      return {
        ...state,
        participants: state.participants.filter(p => p.id !== action.participantId),
      };
    }

    case 'ASSIGN_TRANSPONDER': {
      if (state.race.status !== 'setup') return state;
      // Check for duplicate in this race
      const duplicate = state.participants.find(
        p => p.transponderId === action.transponderId && p.id !== action.participantId
      );
      if (duplicate) return state; // reject duplicate

      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.participantId
            ? {
                ...p,
                transponderId: action.transponderId,
                transponderHex: action.transponderId.toString(16).toUpperCase().padStart(4, '0'),
              }
            : p
        ),
        detectingForParticipantId: null, // exit detect mode
      };
    }

    // ── Race Control ──────────────────────────────────────

    case 'START_RACE': {
      if (state.race.status !== 'setup') return state;
      if (state.participants.length === 0) return state;
      if (state.decoder.status !== 'connected') return state;
      if (!state.race.durationMs) return state;

      return {
        ...state,
        race: {
          ...state.race,
          status: 'active',
          startedAt: new Date().toISOString(),
        },
        remainingMs: state.race.durationMs,
        lastDetection: new Map(),
      };
    }

    case 'START_PRACTICE': {
      if (state.race.status !== 'setup') return state;
      if (state.participants.length === 0) return state;
      if (state.decoder.status !== 'connected') return state;

      return {
        ...state,
        race: {
          ...state.race,
          status: 'practice',
          mode: 'practice',
          startedAt: new Date().toISOString(),
        },
        remainingMs: null,
        lastDetection: new Map(),
      };
    }

    case 'STOP_RACE': {
      if (state.race.status !== 'active' && state.race.status !== 'practice') return state;

      const results = computeResults(state);
      return {
        ...state,
        race: {
          ...state.race,
          status: 'complete',
          endedAt: new Date().toISOString(),
        },
      };
    }

    case 'TIME_EXPIRED': {
      if (state.race.status !== 'active') return state;
      return raceReducer(state, { type: 'STOP_RACE' });
    }

    // ── Decoder Events ────────────────────────────────────

    case 'DECODER_CONNECTED': {
      return {
        ...state,
        decoder: { status: 'connected', lastTickMs: null, error: null },
      };
    }

    case 'DECODER_DISCONNECTED': {
      return {
        ...state,
        decoder: { status: 'disconnected', lastTickMs: state.decoder.lastTickMs, error: null },
      };
    }

    case 'TICK': {
      return {
        ...state,
        decoder: { ...state.decoder, lastTickMs: action.decoderTsMs },
      };
    }

    // ── Lap Detection ─────────────────────────────────────

    case 'LAP_DETECTED': {
      // In detect-to-assign mode: assign transponder instead of recording lap
      if (state.detectingForParticipantId && state.race.status === 'setup') {
        return raceReducer(state, {
          type: 'ASSIGN_TRANSPONDER',
          participantId: state.detectingForParticipantId,
          transponderId: action.transponderId,
        });
      }

      // Only record laps during active race or practice
      if (state.race.status !== 'active' && state.race.status !== 'practice') return state;

      // Find participant by transponder
      const participant = state.participants.find(p => p.transponderId === action.transponderId);
      if (!participant) return state; // unknown transponder

      // Debounce / suppression
      const lastDet = state.lastDetection.get(action.transponderId);
      if (lastDet) {
        const elapsed = action.decoderTsMs - lastDet.decoderTsMs;
        if (elapsed < state.suppression.debounceMs) return state; // debounce
        if (elapsed < state.suppression.minLapMs) {
          // Log suppressed but don't count
          const suppressedLap: RaceLap = {
            id: crypto.randomUUID(),
            raceId: state.race.id,
            participantId: participant.id,
            lapNumber: 0,
            lapTimeMs: elapsed,
            decoderTsMs: action.decoderTsMs,
            wallClockAt: new Date().toISOString(),
            suppressed: true,
          };
          return {
            ...state,
            laps: [...state.laps, suppressedLap],
            lastDetection: new Map(state.lastDetection).set(action.transponderId, {
              decoderTsMs: action.decoderTsMs,
              participantId: participant.id,
            }),
          };
        }
      }

      // Valid lap
      const participantLaps = state.laps.filter(
        l => l.participantId === participant.id && !l.suppressed
      );
      const lapNumber = participantLaps.length + 1;
      const lapTimeMs = lastDet
        ? action.decoderTsMs - lastDet.decoderTsMs
        : 0; // first crossing = lap 0 time (start line)

      const newLap: RaceLap = {
        id: crypto.randomUUID(),
        raceId: state.race.id,
        participantId: participant.id,
        lapNumber,
        lapTimeMs,
        decoderTsMs: action.decoderTsMs,
        wallClockAt: new Date().toISOString(),
        suppressed: false,
      };

      const newLaps = [...state.laps, newLap];
      const newLastDetection = new Map(state.lastDetection).set(action.transponderId, {
        decoderTsMs: action.decoderTsMs,
        participantId: participant.id,
      });

      // Recompute leaderboard
      const leaderboard = computeLeaderboard(state.participants, newLaps);
      const sessionBest = leaderboard.reduce<{ ms: number | null; id: string | null }>(
        (best, entry) => {
          if (entry.bestLapMs && (!best.ms || entry.bestLapMs < best.ms)) {
            return { ms: entry.bestLapMs, id: entry.participant.id };
          }
          return best;
        },
        { ms: null, id: null }
      );

      return {
        ...state,
        laps: newLaps,
        lastDetection: newLastDetection,
        leaderboard,
        sessionBestLapMs: sessionBest.ms,
        sessionBestLapParticipantId: sessionBest.id,
      };
    }

    default:
      return state;
  }
}

// --- Leaderboard Computation ---

function computeLeaderboard(
  participants: RaceParticipant[],
  laps: RaceLap[]
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = participants.map(participant => {
    const pLaps = laps.filter(l => l.participantId === participant.id && !l.suppressed && l.lapNumber > 0);
    const totalLaps = pLaps.length;
    const lastLap = pLaps[pLaps.length - 1];
    const bestLap = pLaps.reduce<RaceLap | null>(
      (best, l) => (!best || l.lapTimeMs < best.lapTimeMs ? l : best),
      null
    );
    const totalTimeMs = pLaps.reduce((sum, l) => sum + l.lapTimeMs, 0);

    return {
      participant,
      position: 0, // computed after sort
      totalLaps,
      lastLapMs: lastLap?.lapTimeMs ?? null,
      bestLapMs: bestLap?.lapTimeMs ?? null,
      totalTimeMs,
      isSessionBestLap: false, // set after sort
    };
  });

  // Sort: most laps first, then fastest total time
  entries.sort((a, b) => {
    if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps;
    return a.totalTimeMs - b.totalTimeMs;
  });

  // Assign positions and mark session best
  let sessionBestMs: number | null = null;
  let sessionBestIdx = -1;
  entries.forEach((entry, i) => {
    entry.position = i + 1;
    if (entry.bestLapMs && (!sessionBestMs || entry.bestLapMs < sessionBestMs)) {
      sessionBestMs = entry.bestLapMs;
      sessionBestIdx = i;
    }
  });
  if (sessionBestIdx >= 0) {
    entries[sessionBestIdx].isSessionBestLap = true;
  }

  return entries;
}

// --- Results Computation (at race end) ---

function computeResults(state: RaceState) {
  return state.leaderboard.map(entry => ({
    id: crypto.randomUUID(),
    raceId: state.race.id,
    participantId: entry.participant.id,
    position: entry.position,
    totalLaps: entry.totalLaps,
    bestLapMs: entry.bestLapMs,
    totalTimeMs: entry.totalTimeMs,
  }));
}
