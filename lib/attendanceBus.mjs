// Trip bus check (#197). Pure helpers shared by the API and /attendance/bus.
export const BUS_LEGS = Object.freeze({ to_venue: "To event", return: "Return" });
export const OTHER_RIDES = Object.freeze({ own_ride: "Own ride", not_traveling: "Not going" });
const BUS_RIDE = /^bus_([1-9])$/;

export function isValidRide(ride) {
  return BUS_RIDE.test(ride) || Object.hasOwn(OTHER_RIDES, ride);
}

export function rideLabel(ride) {
  const bus = BUS_RIDE.exec(ride || "");
  return bus ? `Bus ${bus[1]}` : OTHER_RIDES[ride] || "";
}

// Bus buttons to show: the requested count, widened to any bus already marked
// so a saved mark is never hidden.
export function busRides(requested, checks = []) {
  const used = checks.map((check) => Number(BUS_RIDE.exec(check.ride || "")?.[1] || 0));
  const count = Math.min(9, Math.max(1, Number(requested) || 2, ...used));
  return Array.from({ length: count }, (_, index) => `bus_${index + 1}`);
}

// students: [{ id, ... }]; checks: [{ studentId, leg, ride }].
export function summarizeLeg(students, checks, leg) {
  const rideByStudent = new Map(checks
    .filter((check) => check.leg === leg)
    .map((check) => [check.studentId, check.ride]));
  const counts = {};
  const missing = [];
  for (const student of students) {
    const ride = rideByStudent.get(student.id);
    if (ride) counts[ride] = (counts[ride] || 0) + 1;
    else missing.push(student);
  }
  return { rideByStudent, counts, missing };
}
