/*
 * orbit.js — TLE parsing + a lightweight perturbed-Keplerian propagator.
 *
 * This is not a full SGP4 implementation. It propagates the two-body
 * (Keplerian) orbit from a TLE's mean elements and layers on the two
 * dominant J2 secular perturbations (nodal regression + apsidal
 * precession) plus the TLE's mean-motion drift term. For a small LEO
 * demonstrator satellite over a span of days-to-weeks around the TLE
 * epoch, this tracks the real ephemeris closely while staying compact
 * and dependency-free.
 */

const ORBIT = (() => {
  const MU = 398600.4418;        // Earth gravitational parameter, km^3/s^2
  const RE = 6378.137;           // Earth equatorial radius, km
  const J2 = 0.00108263;         // Earth oblateness coefficient
  const DEG = Math.PI / 180;
  const TWO_PI = Math.PI * 2;

  function parseTLE(line1, line2) {
    const epochYear2 = parseInt(line1.substring(18, 20), 10);
    const epochYear = epochYear2 < 57 ? 2000 + epochYear2 : 1900 + epochYear2;
    const epochDay = parseFloat(line1.substring(20, 32));
    const ndotField = parseFloat(line1.substring(33, 43));

    const inc = parseFloat(line2.substring(8, 16)) * DEG;
    const raan0 = parseFloat(line2.substring(17, 25)) * DEG;
    const ecc = parseFloat('0.' + line2.substring(26, 33).trim());
    const argp0 = parseFloat(line2.substring(34, 42)) * DEG;
    const ma0 = parseFloat(line2.substring(43, 51)) * DEG;
    const meanMotion0 = parseFloat(line2.substring(52, 63));

    const epochMs = Date.UTC(epochYear, 0, 1) + (epochDay - 1) * 86400000;

    const n0 = meanMotion0 * TWO_PI;          // rad/day
    const ndot = 2 * ndotField * TWO_PI;      // rad/day^2
    const n0_rad_s = n0 / 86400;
    const a0 = Math.cbrt(MU / (n0_rad_s * n0_rad_s));
    const p0 = a0 * (1 - ecc * ecc);
    const cosI = Math.cos(inc);

    const raanDot = -1.5 * n0_rad_s * J2 * Math.pow(RE / p0, 2) * cosI;                     // rad/s
    const argpDot = 0.75 * n0_rad_s * J2 * Math.pow(RE / p0, 2) * (5 * cosI * cosI - 1);    // rad/s

    return {
      epochMs, inc, raan0, ecc, argp0, ma0, meanMotion0,
      n0, ndot, raanDot, argpDot,
      periodMin: 1440 / meanMotion0
    };
  }

  function solveKepler(M, e) {
    let E = M;
    for (let i = 0; i < 10; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }

  // Full state at a given wall-clock time (ms since epoch, UTC)
  function propagate(tle, dateMs) {
    const dtDays = (dateMs - tle.epochMs) / 86400000;
    const dtSec = dtDays * 86400;

    const meanMotionRad = tle.n0 + tle.ndot * dtDays; // rad/day, current
    const n_rad_s = meanMotionRad / 86400;
    const a = Math.cbrt(MU / (n_rad_s * n_rad_s));

    const raan = tle.raan0 + tle.raanDot * dtSec;
    const argp = tle.argp0 + tle.argpDot * dtSec;

    let M = tle.ma0 + tle.n0 * dtDays + 0.5 * tle.ndot * dtDays * dtDays;
    M = ((M % TWO_PI) + TWO_PI) % TWO_PI;

    const e = tle.ecc;
    const E = solveKepler(M, e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = a * (1 - e * Math.cos(E));

    const xpf = r * Math.cos(nu), ypf = r * Math.sin(nu);

    const cO = Math.cos(raan), sO = Math.sin(raan);
    const cw = Math.cos(argp), sw = Math.sin(argp);
    const ci = Math.cos(tle.inc), si = Math.sin(tle.inc);

    const x = (cO * cw - sO * sw * ci) * xpf + (-cO * sw - sO * cw * ci) * ypf;
    const y = (sO * cw + cO * sw * ci) * xpf + (-sO * sw + cO * cw * ci) * ypf;
    const z = (sw * si) * xpf + (cw * si) * ypf;

    const v = Math.sqrt(MU * (2 / r - 1 / a));
    const periodMin = TWO_PI / n_rad_s / 60;

    return { x, y, z, r, v, a, altitude: r - RE, periodMin, trueAnomaly: nu, meanAnomaly: M };
  }

  // One full revolution of the current osculating ellipse, in ECI km — for drawing the orbit line
  function ellipsePoints(tle, dateMs, steps = 180) {
    const dtDays = (dateMs - tle.epochMs) / 86400000;
    const dtSec = dtDays * 86400;
    const meanMotionRad = tle.n0 + tle.ndot * dtDays;
    const n_rad_s = meanMotionRad / 86400;
    const a = Math.cbrt(MU / (n_rad_s * n_rad_s));
    const raan = tle.raan0 + tle.raanDot * dtSec;
    const argp = tle.argp0 + tle.argpDot * dtSec;
    const e = tle.ecc;

    const cO = Math.cos(raan), sO = Math.sin(raan);
    const cw = Math.cos(argp), sw = Math.sin(argp);
    const ci = Math.cos(tle.inc), si = Math.sin(tle.inc);

    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const nu = (i / steps) * TWO_PI;
      const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
      const xpf = r * Math.cos(nu), ypf = r * Math.sin(nu);
      const x = (cO * cw - sO * sw * ci) * xpf + (-cO * sw - sO * cw * ci) * ypf;
      const y = (sO * cw + cO * sw * ci) * xpf + (-sO * sw + cO * cw * ci) * ypf;
      const z = (sw * si) * xpf + (cw * si) * ypf;
      pts.push(x, y, z);
    }
    return pts;
  }

  function gmstRad(dateMs) {
    const JD = dateMs / 86400000 + 2440587.5;
    const T = (JD - 2451545.0) / 36525;
    let gmst = 280.46061837 + 360.98564736629 * (JD - 2451545.0) +
               0.000387933 * T * T - (T * T * T) / 38710000;
    gmst = ((gmst % 360) + 360) % 360;
    return gmst * DEG;
  }

  function eciToGeodetic(x, y, z, dateMs) {
    const gst = gmstRad(dateMs);
    const cg = Math.cos(gst), sg = Math.sin(gst);
    const xe = x * cg + y * sg;
    const ye = -x * sg + y * cg;
    const r = Math.sqrt(xe * xe + ye * ye + z * z);
    const lat = Math.asin(z / r) / DEG;
    const lon = Math.atan2(ye, xe) / DEG;
    return { lat, lon };
  }

  return { RE, MU, parseTLE, propagate, ellipsePoints, gmstRad, eciToGeodetic };
})();
