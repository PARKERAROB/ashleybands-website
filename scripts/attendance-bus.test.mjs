import assert from "node:assert/strict";
import test from "node:test";
import { busRides, isValidRide, rideLabel, summarizeLeg } from "../lib/attendanceBus.mjs";

const students = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const checks = [
  { studentId: "a", leg: "to_venue", ride: "bus_1" },
  { studentId: "b", leg: "to_venue", ride: "bus_2" },
  { studentId: "c", leg: "to_venue", ride: "own_ride" },
  { studentId: "a", leg: "return", ride: "bus_2" }
];

test("each leg counts riders per bus and lists who is missing", () => {
  const going = summarizeLeg(students, checks, "to_venue");
  assert.deepEqual(going.counts, { bus_1: 1, bus_2: 1, own_ride: 1 });
  assert.deepEqual(going.missing.map((student) => student.id), ["d"]);
  const back = summarizeLeg(students, checks, "return");
  assert.deepEqual(back.counts, { bus_2: 1 });
  assert.deepEqual(back.missing.map((student) => student.id), ["b", "c", "d"]);
  assert.equal(back.rideByStudent.get("a"), "bus_2");
});

test("only known rides are accepted, matching the table constraint", () => {
  for (const ride of ["bus_1", "bus_9", "own_ride", "not_traveling"]) assert.ok(isValidRide(ride), ride);
  for (const ride of ["bus_0", "bus_10", "bus_", "present", "", null, "constructor"]) {
    assert.equal(isValidRide(ride), false, String(ride));
  }
  assert.equal(rideLabel("bus_3"), "Bus 3");
  assert.equal(rideLabel("not_traveling"), "Not going");
});

test("bus buttons default to two and never hide a saved bus", () => {
  assert.deepEqual(busRides(undefined), ["bus_1", "bus_2"]);
  assert.deepEqual(busRides("3"), ["bus_1", "bus_2", "bus_3"]);
  assert.deepEqual(busRides("1", [{ ride: "bus_4" }]), ["bus_1", "bus_2", "bus_3", "bus_4"]);
  assert.equal(busRides("99").length, 9);
});
