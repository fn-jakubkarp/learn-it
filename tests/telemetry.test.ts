import { describe, expect, test } from "bun:test";
import { isTelemetryDisabled } from "../src/telemetry";

// The opt-out matrix is the whole privacy contract — assert it directly so a
// refactor can't silently flip telemetry on where it should be off. A non-empty
// key is the only thing that enables it, and any opt-out signal wins.
const REAL_KEY = "phc_realprojectkey";

describe("isTelemetryDisabled — opt-out matrix", () => {
	test("enabled only with a real key and no opt-out signal", () => {
		expect(isTelemetryDisabled({}, REAL_KEY)).toBe(false);
	});

	test("an empty key keeps it off (build shipped with telemetry disabled)", () => {
		expect(isTelemetryDisabled({}, "")).toBe(true);
	});

	test("DO_NOT_TRACK truthy disables; 0/false does not", () => {
		expect(isTelemetryDisabled({ DO_NOT_TRACK: "1" }, REAL_KEY)).toBe(true);
		expect(isTelemetryDisabled({ DO_NOT_TRACK: "yes" }, REAL_KEY)).toBe(true);
		expect(isTelemetryDisabled({ DO_NOT_TRACK: "0" }, REAL_KEY)).toBe(false);
		expect(isTelemetryDisabled({ DO_NOT_TRACK: "false" }, REAL_KEY)).toBe(
			false,
		);
	});

	test("LEARN_IT_TELEMETRY=0/false disables", () => {
		expect(isTelemetryDisabled({ LEARN_IT_TELEMETRY: "0" }, REAL_KEY)).toBe(
			true,
		);
		expect(isTelemetryDisabled({ LEARN_IT_TELEMETRY: "false" }, REAL_KEY)).toBe(
			true,
		);
	});

	test("CI disables (automated runs aren't adoption)", () => {
		expect(isTelemetryDisabled({ CI: "true" }, REAL_KEY)).toBe(true);
	});
});
