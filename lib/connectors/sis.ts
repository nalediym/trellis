/**
 * SIS (Student Information System) connector — MOCKED, scoped.
 *
 * The real production system would be a dbt-materialized read-replica
 * hit via a scoped service account. Here we serve realistic-shaped fake
 * records from an in-memory dataset. The key point: the connector
 * enforces the `scopes_allowed` / `scopes_forbidden` arrays from
 * `platform/connectors/sis.yaml` at the function level — a read of a
 * forbidden field throws, even from the mock.
 *
 * This is the pattern a real integration would use: forbidden columns
 * are never selected, even by code that has credentials.
 */
import { getConnector } from "../manifests";

interface StudentRecord {
  first_name: string;
  grade: string;
  homeroom: string;
  // Forbidden fields included only so we can assert they're guarded.
  last_name?: string;
  ssn?: string;
  address?: string;
  medical?: string;
  counselor_notes?: string;
  iep_504_details?: string;
}

interface GuardianRecord {
  student_first_name: string;
  preferred_name: string;
  preferred_language: string;
}

interface AttendanceRecord {
  student_first_name: string;
  last_30_days: { date: string; status: "present" | "absent" | "late" }[];
}

// Realistic-shape fake data. First names only, multiple homerooms,
// varied attendance patterns — enough to make the mock feel real
// without implying any real student.
const STUDENTS: StudentRecord[] = [
  {
    first_name: "Amelie",
    grade: "7",
    homeroom: "7B",
    last_name: "[forbidden]",
    ssn: "[forbidden]",
    address: "[forbidden]",
    medical: "[forbidden]",
    counselor_notes: "[forbidden]",
    iep_504_details: "[forbidden]",
  },
  {
    first_name: "Jordan",
    grade: "8",
    homeroom: "8A",
    last_name: "[forbidden]",
  },
  {
    first_name: "Nia",
    grade: "6",
    homeroom: "6C",
    last_name: "[forbidden]",
  },
];

const GUARDIANS: GuardianRecord[] = [
  {
    student_first_name: "Amelie",
    preferred_name: "Ms. Moreno",
    preferred_language: "en",
  },
  {
    student_first_name: "Jordan",
    preferred_name: "Mr. Ellis",
    preferred_language: "en",
  },
  {
    student_first_name: "Nia",
    preferred_name: "Ms. Okafor",
    preferred_language: "es",
  },
];

function thirtyDayAttendance(
  firstName: string,
): AttendanceRecord["last_30_days"] {
  // Deterministic per-student pattern.
  const seed = Array.from(firstName).reduce((a, c) => a + c.charCodeAt(0), 0);
  const days: AttendanceRecord["last_30_days"] = [];
  for (let i = 0; i < 30; i++) {
    const v = (seed + i * 7) % 11;
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const status: "present" | "absent" | "late" =
      v === 0 ? "absent" : v === 1 ? "late" : "present";
    days.push({ date: d.toISOString().slice(0, 10), status });
  }
  return days;
}

const ATTENDANCE: AttendanceRecord[] = STUDENTS.map((s) => ({
  student_first_name: s.first_name,
  last_30_days: thirtyDayAttendance(s.first_name),
}));

// --- scope enforcement ----------------------------------------------------

type ScopeCheck = { allowed: Set<string>; forbidden: Set<string> };

function scopeCheck(): ScopeCheck {
  const conn = getConnector("sis");
  return {
    allowed: new Set(conn?.scopes_allowed ?? []),
    forbidden: new Set(conn?.scopes_forbidden ?? []),
  };
}

function assertScope(scope: string): void {
  const { allowed, forbidden } = scopeCheck();
  if (forbidden.has(scope)) {
    throw new Error(
      `SIS connector refused read of forbidden scope "${scope}" — see platform/connectors/sis.yaml`,
    );
  }
  if (allowed.size > 0 && !allowed.has(scope)) {
    throw new Error(
      `SIS connector refused read of unscoped field "${scope}" — not in scopes_allowed`,
    );
  }
}

// --- public mocked API ----------------------------------------------------

export interface SisStudentView {
  first_name: string;
  grade: string;
  homeroom: string;
}

export function listStudents(): SisStudentView[] {
  assertScope("students.first_name");
  assertScope("students.grade");
  assertScope("students.homeroom");
  return STUDENTS.map((s) => ({
    first_name: s.first_name,
    grade: s.grade,
    homeroom: s.homeroom,
  }));
}

export function getGuardian(
  studentFirstName: string,
): { preferred_name: string; preferred_language: string } | undefined {
  assertScope("guardians.preferred_name");
  assertScope("guardians.preferred_language");
  const g = GUARDIANS.find((x) => x.student_first_name === studentFirstName);
  return g
    ? {
        preferred_name: g.preferred_name,
        preferred_language: g.preferred_language,
      }
    : undefined;
}

export function getAttendance(
  studentFirstName: string,
): AttendanceRecord["last_30_days"] {
  assertScope("attendance.last_30_days");
  return ATTENDANCE.find((a) => a.student_first_name === studentFirstName)
    ?.last_30_days ?? [];
}

/** Status for the /connectors page. */
export function sisStatus(): { status: "mocked"; lastUsedAt: string | null } {
  return { status: "mocked", lastUsedAt: sisLastUsedAt };
}

let sisLastUsedAt: string | null = null;
export function markSisUsed(): void {
  sisLastUsedAt = new Date().toISOString();
}
