/* ==========================================================================
   Celestial-Equatorial (RA/Dec) Demonstrator  --  Accessible HTML5 port
   Ported from celestialEquatorialDemo008 (Adobe Flash / AS1, 22 July 2009).

   GROUND TRUTH for behaviour is the decompiled ActionScript. All geometry,
   constants and label text below are copied verbatim from that source. The
   rendering is reproduced on an HTML5 <canvas>; controls are native and
   keyboard-operable; equations/symbols are typeset by MathJax.

   The original is a generic 3-D "celestial sphere" engine (CelestialSphere)
   wired by the demo's controller. We keep its exact projection math:
     theta  = viewer azimuth rotation of the sphere   (radians internally)
     phi    = viewer altitude / tilt                  (radians)
     lat    = observer latitude (this demo fixes 90)  (radians)
     sTime  = sidereal time (this demo fixes 0)       (radians)
   Matrices: a* world->screen, m* celestial->world, b* celestial->screen.
   ========================================================================== */
'use strict';
(function () {

  // ---- angle / unit constants (verbatim radians-per-unit from the AS) -------
  var D2R   = 0.017453292519943295;   // deg -> rad
  var R2D   = 57.29577951308232;       // rad -> deg
  var H2R   = 0.2617993877991494;      // hours -> rad (15 deg)
  var R2H   = 3.819718634205488;       // rad -> hours
  var TWO_PI = 6.283185307179586;
  var HALF_PI = 1.5707963267948966;
  var PI = 3.141592653589793;

  // ---- demo colour constants (verbatim decimal RGB from the AS) -------------
  var raColor  = 4934654;    // #4B4BFE  (RA arc/label, blue)
  var decColor = 16665419;   // #FE4B4B  (Dec arc/label, red)

  function mod(n, m) { return ((n % m) + m) % m; }

  // AS color int (decimal RGB) + alpha(0-100) -> css rgba
  function css(intColor, alpha) {
    var r = (intColor >> 16) & 255, g = (intColor >> 8) & 255, b = intColor & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + ((alpha == null ? 100 : alpha) / 100) + ')';
  }

  // Number formatting -- reproduces the AS Number.prototype.toFixed polyfill
  // (Math.round(x*10^d), zero-padded), so on-screen numbers match exactly.
  function asFixed(x, d) {
    if (isNaN(x)) return 'NaN';
    var s = ''; if (x < 0) { s = '-'; x = -x; }
    var str, n = Math.round(x * Math.pow(10, d));
    str = (n === 0) ? '0' : String(n);
    if (d > 0) {
      var k = str.length;
      if (k <= d) { var z = ''; for (var i = 0; i < d + 1 - k; i++) z += '0'; str = z + str; k = d + 1; }
      str = str.substr(0, k - d) + '.' + str.substr(k - d);
    }
    return s + str;
  }

  // Spoken form of a number for screen readers: a leading "-" glyph is routinely
  // dropped, so render it as the word "minus".
  function spokenNum(x, d) {
    var t = asFixed(x, d);
    return (t.charAt(0) === '-') ? 'minus ' + t.slice(1) : t;
  }

  /* ========================================================================
     CelestialSphere engine -- faithful port of the AS prototype methods.
     One instance is the big sphere (r=160); a second nested instance is the
     little Earth's sphere (r=30) carrying the globe + Earth's equator.
     ======================================================================== */
  function Sphere(r) {
    this._c = {};
    this._c.r = r;
    this._c.r2 = r * r;
    this._theta = 0;
    this._phi   = HALF_PI / 3;        // matches AS init seed (not user-visible)
    this._lat   = 41 * D2R;
    this._sTime = 0;
    this._showUnder = true;
    this.circles = [];
    this.lines   = [];
    this.objects = [];
    this.setLatitude(90);
    this.setSiderealTime(0);
  }
  var S = Sphere.prototype;

  // --- orientation setters (port of "2 CS Getter Setter.as") ---
  S.setThetaAndPhi = function (newTheta, newPhi) {
    this._theta = D2R * mod(newTheta, 360);
    if (newPhi > 90) newPhi = 90; else if (newPhi < -90) newPhi = -90;
    this._phi = newPhi * D2R;
    this.doA(); this.doB();
  };
  S.getTheta = function () { return R2D * this._theta; };
  S.getPhi   = function () { return R2D * this._phi; };
  S.setSize = function (size) {
    this._c.r = size / 2; this._c.r2 = this._c.r * this._c.r; this.doA(); this.doB();
  };
  S.setLatitude = function (lat) {
    if (lat > 90) lat = 90; else if (lat < -90) lat = -90;
    this._lat = lat * D2R; this.doM(); this.doB();
  };
  S.setSiderealTime = function (t) {
    this._sTime = mod(t, 24) * H2R; this.doM(); this.doB();
  };

  // --- matrices (port of "3 CS Geometry.as": doA / doM / doB) ---
  S.doA = function () {
    var c = this._c, ct = Math.cos(this._theta), st = Math.sin(this._theta),
        cp = Math.cos(this._phi), sp = Math.sin(this._phi), r = c.r;
    c.a0 = -r * st;       c.a1 = r * ct;
    c.a3 = r * ct * sp;   c.a4 = r * st * sp;   c.a5 = -r * cp;
    c.a6 = r * ct * cp;   c.a7 = r * st * cp;   c.a8 = r * sp;
  };
  S.doM = function () {
    var c = this._c;
    c.m2 = Math.cos(this._lat);
    c.m3 = Math.sin(this._sTime);
    c.m4 = -Math.cos(this._sTime);
    c.m8 = Math.sin(this._lat);
    c.m0 = c.m4 * c.m8; c.m1 = -c.m3 * c.m8;
    c.m6 = -c.m2 * c.m4; c.m7 = c.m2 * c.m3;
  };
  S.doB = function () {
    var c = this._c;
    c.b0 = c.a0 * c.m0 + c.a1 * c.m3;
    c.b1 = c.a0 * c.m1 + c.a1 * c.m4;
    c.b2 = c.a0 * c.m2;
    c.b3 = c.a3 * c.m0 + c.a4 * c.m3 + c.a5 * c.m6;
    c.b4 = c.a3 * c.m1 + c.a4 * c.m4 + c.a5 * c.m7;
    c.b5 = c.a3 * c.m2 + c.a5 * c.m8;
    c.b6 = c.a6 * c.m0 + c.a7 * c.m3 + c.a8 * c.m6;
    c.b7 = c.a6 * c.m1 + c.a7 * c.m4 + c.a8 * c.m7;
    c.b8 = c.a6 * c.m2 + c.a8 * c.m8;
  };

  // --- projections (port of "3 CS Geometry.as") ---
  S.WtoSz = function (p, sp) {
    var c = this._c;
    sp.x = p.x * c.a0 + p.y * c.a1;
    sp.y = p.x * c.a3 + p.y * c.a4 + p.z * c.a5;
    sp.z = p.x * c.a6 + p.y * c.a7 + p.z * c.a8;
  };
  S.CtoSz = function (p, sp) {
    var c = this._c;
    sp.x = p.x * c.b0 + p.y * c.b1 + p.z * c.b2;
    sp.y = p.x * c.b3 + p.y * c.b4 + p.z * c.b5;
    sp.z = p.x * c.b6 + p.y * c.b7 + p.z * c.b8;
  };
  S.CtoW = function (p, w) {
    var c = this._c;
    w.x = p.x * c.m0 + p.y * c.m1 + p.z * c.m2;
    w.y = p.x * c.m3 + p.y * c.m4;
    w.z = p.x * c.m6 + p.y * c.m7 + p.z * c.m8;
  };
  S.WtoC = function (p, cp) {
    var c = this._c;
    cp.x = p.x * c.m0 + p.y * c.m3 + p.z * c.m6;
    cp.y = p.x * c.m1 + p.y * c.m4 + p.z * c.m7;
    cp.z = p.x * c.m2 + p.z * c.m8;
  };
  S.CtoMH = function (cp, hp) {
    var sd = Math.sin(cp.dec), cd = Math.cos(cp.dec),
        sl = Math.sin(this._lat), cl = Math.cos(this._lat),
        h = this._sTime - cp.ra, ch = Math.cos(h),
        caz = sd * cl - cd * ch * sl, saz = cd * Math.sin(h);
    hp.az = (caz === 0) ? 0 : mod(Math.atan2(saz, caz), TWO_PI);
    hp.alt = Math.asin(sd * sl + cd * ch * cl);
  };
  S.MHtoC = function (hp, cp) {
    var salt = Math.sin(hp.alt), calt = Math.cos(hp.alt),
        saz = Math.sin(hp.az), caz = Math.cos(hp.az),
        sl = Math.sin(this._lat), cl = Math.cos(this._lat),
        sh = calt * saz, ch = salt * cl - calt * sl * caz;
    cp.ra = (ch === 0) ? 0 : mod(this._sTime - Math.atan2(sh, ch), TWO_PI);
    cp.dec = Math.asin(salt * sl + calt * caz * cl);
  };
  // Screen -> "mathematical horizon" spherical (port of StoMH)
  S.StoMH = function (sp, hp) {
    var M = Math, d = M.sqrt(sp.x * sp.x + sp.y * sp.y) / this._c.r;
    if (d > 1) d = 1;
    var b = M.asin(d), A = M.atan2(sp.x, -sp.y);
    if (this._phi === HALF_PI) {
      hp.alt = HALF_PI - b; hp.az = this._theta + PI - A;
    } else if (this._phi === -HALF_PI) {
      hp.alt = -HALF_PI + b; hp.az = this._theta + A;
    } else {
      var c = HALF_PI - this._phi, cc = M.cos(c), sc = M.sin(c),
          cb = M.cos(b), sb = M.sin(b), ca = cb * cc + sb * sc * M.cos(A);
      hp.alt = HALF_PI - M.acos(ca);
      hp.az = this._theta + M.atan2(sb * M.sin(A), (cb - ca * cc) / sc);
    }
    hp.az = mod(hp.az, TWO_PI);
  };
  // Screen (sphere-centred px) -> RA/Dec in (hours, deg). Port of getMouseRaDec.
  S.screenToRaDec = function (x, y) {
    var d = Math.sqrt(x * x + y * y);
    if (d > this._c.r) return null;
    var hp = {}, cp = {};
    this.StoMH({ x: x, y: y }, hp);
    this.MHtoC(hp, cp);
    return { ra: cp.ra * R2H, dec: cp.dec * R2D };
  };

  // --- point parsing (port of parsePointInput) ---
  S.parse = function (a) {
    var o = {}, r;
    if (a.az != null && a.alt != null) {
      o.sys = 0; r = (a.r != null) ? a.r : 1;
      var d = r * Math.cos(a.alt * D2R);
      o.x = d * Math.cos(a.az * D2R);
      o.y = d * Math.sin(-a.az * D2R);
      o.z = r * Math.sin(a.alt * D2R);
      o.r = Math.abs(r);
    } else if (a.ra != null && a.dec != null) {
      o.sys = 1; r = (a.r != null) ? a.r : 1;
      var d2 = r * Math.cos(a.dec * D2R);
      o.x = d2 * Math.cos(a.ra * H2R);
      o.y = d2 * Math.sin(a.ra * H2R);
      o.z = r * Math.sin(a.dec * D2R);
      o.r = Math.abs(r);
    } else { // x/y/z given
      o.sys = (a.system === 'horizon') ? 0 : (a.system === 'celestial') ? 1 : -1;
      o.x = a.x; o.y = a.y; o.z = a.z;
      o.r = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
      if (o.r < 1.000001 && o.r > 0.999999) o.r = 1;
    }
    return o;
  };

  /* ---- Circles (port of "8 CS Circles.as") -------------------------------- */
  function Circle(sphere, style, def) {
    this.s = sphere;
    this._sys = 0; this._tilt = 0; this._lambda = 0; this._beta = 0;
    this._gS = 0; this._gE = 0; this._c = {};
    this._thick = (style && style.thickness != null) ? style.thickness : 1;
    this._color = (style && style.color != null) ? style.color : 16711680;
    this._alpha = (style && style.alpha != null) ? style.alpha : 80;
    this._visible = true;
    if (def) this.setParameters(def);
  }
  Circle.prototype._minStep = 0.7853981633974483;
  Circle.prototype.mod = mod;
  Circle.prototype.setParameters = function (a) {
    if (a.az != null && a.alt != null && a.tilt != null) {
      this._sys = 0;
      if (isFinite(a.tilt)) this._tilt = (a.tilt < 0 ? 0 : a.tilt > 180 ? PI : a.tilt * D2R);
      if (isFinite(a.alt))  this._lambda = (a.alt < -90 ? -PI : a.alt > 90 ? PI : a.alt * D2R);
      if (isFinite(a.az))   this._beta = D2R * mod(-a.az, 360);
      if (isFinite(a.gammaStart)) this._gS = D2R * mod(a.gammaStart, 360);
      if (isFinite(a.gammaEnd))   this._gE = D2R * mod(a.gammaEnd, 360);
    } else if (a.ra != null && a.dec != null && a.tilt != null) {
      this._sys = 1;
      if (isFinite(a.tilt)) this._tilt = (a.tilt < 0 ? 0 : a.tilt > 180 ? PI : a.tilt * D2R);
      if (isFinite(a.dec))  this._lambda = (a.dec < -90 ? -PI : a.dec > 90 ? PI : a.dec * D2R);
      if (isFinite(a.ra))   this._beta = H2R * mod(a.ra, 24);
      if (isFinite(a.gammaStart)) this._gS = D2R * mod(a.gammaStart, 360);
      if (isFinite(a.gammaEnd))   this._gE = D2R * mod(a.gammaEnd, 360);
    }
    this.doW();
  };
  Circle.prototype.doW = function () {
    var st = Math.sin(this._tilt), ct = Math.cos(this._tilt),
        sb = Math.sin(this._beta), cb = Math.cos(this._beta),
        cl = Math.cos(this._lambda), sl = Math.sin(this._lambda), c = this._c;
    c.w0 = cl * cb;        c.w1 = -cl * sb * ct;  c.w2 = sl * sb * st;
    c.w3 = cl * sb;        c.w4 = cl * cb * ct;   c.w5 = -sl * cb * st;
    c.w7 = cl * st;        c.w8 = sl * ct;
  };
  // Compute v* and split into front/back arcs (returns {v, front:[], back:[]})
  Circle.prototype.computeArcs = function () {
    var tc = this._c, pc = this.s._c, v0, v1, v2, v3, v4, v5, v6, v7, v8;
    if (this._sys === 0) {
      v0 = pc.a0 * tc.w0 + pc.a1 * tc.w3; v1 = pc.a0 * tc.w1 + pc.a1 * tc.w4; v2 = pc.a0 * tc.w2 + pc.a1 * tc.w5;
      v3 = pc.a3 * tc.w0 + pc.a4 * tc.w3; v4 = pc.a3 * tc.w1 + pc.a4 * tc.w4 + pc.a5 * tc.w7; v5 = pc.a3 * tc.w2 + pc.a4 * tc.w5 + pc.a5 * tc.w8;
      v6 = pc.a6 * tc.w0 + pc.a7 * tc.w3; v7 = pc.a6 * tc.w1 + pc.a7 * tc.w4 + pc.a8 * tc.w7; v8 = pc.a6 * tc.w2 + pc.a7 * tc.w5 + pc.a8 * tc.w8;
    } else {
      v0 = pc.b0 * tc.w0 + pc.b1 * tc.w3; v1 = pc.b0 * tc.w1 + pc.b1 * tc.w4 + pc.b2 * tc.w7; v2 = pc.b0 * tc.w2 + pc.b1 * tc.w5 + pc.b2 * tc.w8;
      v3 = pc.b3 * tc.w0 + pc.b4 * tc.w3; v4 = pc.b3 * tc.w1 + pc.b4 * tc.w4 + pc.b5 * tc.w7; v5 = pc.b3 * tc.w2 + pc.b4 * tc.w5 + pc.b5 * tc.w8;
      v6 = pc.b6 * tc.w0 + pc.b7 * tc.w3; v7 = pc.b6 * tc.w1 + pc.b7 * tc.w4 + pc.b8 * tc.w7; v8 = pc.b6 * tc.w2 + pc.b7 * tc.w5 + pc.b8 * tc.w8;
    }
    var v = [v0, v1, v2, v3, v4, v5, v6, v7, v8];
    var front = [], back = [], A = Math.sqrt(v6 * v6 + v7 * v7);
    var gS = this._gS, gE = this._gE;
    if (A === 0) {
      (v8 < 0 ? back : front).push([gS, gE]);
      return { v: v, front: front, back: back };
    }
    var sj = -v8 / A;
    if (sj <= -1) { front.push([gS, gE]); return { v: v, front: front, back: back }; }
    if (sj >= 1)  { back.push([gS, gE]);  return { v: v, front: front, back: back }; }
    var j = Math.asin(sj), t = Math.atan2(v6, v7), gDesc, gAsc;
    if (Math.cos(j) < 0) {
      gDesc = mod(j - t, TWO_PI); gAsc = mod(PI - j - t, TWO_PI);
    } else {
      gDesc = mod(PI - j - t, TWO_PI); gAsc = mod(j - t, TWO_PI);
    }
    if (gS === gE) {
      front.push([gAsc, gDesc]); back.push([gDesc, gAsc]);
      return { v: v, front: front, back: back };
    }
    // partial arc: walk the sorted breakpoints (gAsc=0, gDesc=1, gS=2, gE=3)
    var arr = [[gAsc, 0], [gDesc, 1], [gS, 2], [gE, 3]];
    arr.sort(function (a, b) { return a[0] - b[0]; });
    var draw = false, isFront = true, k;
    for (k = 0; k < 4; k++) {
      if (arr[k][1] === 0) isFront = true; else if (arr[k][1] === 1) isFront = false;
      else if (arr[k][1] === 2) draw = true; else draw = false;
    }
    var prev = arr[3];
    for (k = 0; k < 4; k++) {
      var g1 = prev; prev = arr[k];
      if (draw && g1[0] !== prev[0]) (isFront ? front : back).push([g1[0], prev[0]]);
      if (prev[1] === 0) isFront = true; else if (prev[1] === 1) isFront = false;
      else if (prev[1] === 2) draw = true; else draw = false;
    }
    return { v: v, front: front, back: back };
  };

  // Emit an arc to a 2-D context using the AS curveTo tessellation (identical shape)
  function drawArc(ctx, v, g1, g2, minStep) {
    if (g2 < g1) g2 += TWO_PI;
    var arc = g2 - g1; if (arc === 0) arc = TWO_PI;
    var n = Math.ceil(arc / minStep), step = arc / n, half = step / 2,
        cRad = 1 / Math.cos(half), ax = Math.cos(g1), ay = Math.sin(g1);
    ctx.moveTo(v[0] * ax + v[1] * ay + v[2], v[3] * ax + v[4] * ay + v[5]);
    var aA = g1 + step, cA = aA - half;
    for (var i = 0; i < n; i++) {
      ax = Math.cos(aA); ay = Math.sin(aA);
      var cx = cRad * Math.cos(cA), cy = cRad * Math.sin(cA);
      ctx.quadraticCurveTo(v[0] * cx + v[1] * cy + v[2], v[3] * cx + v[4] * cy + v[5],
                           v[0] * ax + v[1] * ay + v[2], v[3] * ax + v[4] * ay + v[5]);
      aA += step; cA += step;
    }
  }

  /* ---- Lines (port of "9 CS Lines.as") ------------------------------------ */
  function Line(sphere, style, head, tail) {
    this.s = sphere;
    this._thick = (style && style.thickness != null) ? style.thickness : 1;
    this._color = (style && style.color != null) ? style.color : 255;
    this._alpha = (style && style.alpha != null) ? style.alpha : 100;
    this._visible = true;
    this._head = sphere.parse(head); if (this._head.sys === -1) this._head.sys = 0;
    this._tail = sphere.parse(tail); if (this._tail.sys === -1) this._tail.sys = 0;
  }
  // Returns array of screen segments {x1,y1,x2,y2,layer} where layer in bE|fE|bI|aI
  Line.prototype.computeSegments = function () {
    if (!this._visible) return [];
    var s = this.s, head = {}, tail = {};
    if (this._head.sys === 0) s.WtoSz(this._head, head); else s.CtoSz(this._head, head);
    if (this._tail.sys === 0) s.WtoSz(this._tail, tail); else s.CtoSz(this._tail, tail);
    var mx = head.x - tail.x, my = head.y - tail.y, mz = head.z - tail.z,
        A = mx * mx + my * my + mz * mz,
        B = 2 * (mx * tail.x + my * tail.y + mz * tail.z),
        C = tail.x * tail.x + tail.y * tail.y + tail.z * tail.z,
        rad = s._c.r, rad2 = rad * rad, phi = s._phi, tp,
        stmp = [], D = B * B - 4 * A * (C - rad2);
    if (D > 0) { var sD = Math.sqrt(D); stmp.push((-B + sD) / (2 * A)); stmp.push((-B - sD) / (2 * A)); }
    if (phi > -HALF_PI && phi < HALF_PI) {
      tp = Math.tan(phi);
      if (my !== tp * mz) stmp.push((tp * tail.z - tail.y) / (my - tp * mz));
      if (mz !== 0) { var tmp = -tail.z / mz; if (tmp * (tmp * A + B) + C >= rad2) stmp.push(tmp); }
    } else if (mz !== 0) { stmp.push(-tail.z / mz); }
    var sArr = [0, 1], i, k;
    for (i = 0; i < stmp.length; i++) {
      if (stmp[i] > 0 && stmp[i] < 1) {
        k = 1; while (stmp[i] > sArr[k]) k++;
        if (stmp[i] !== sArr[k]) sArr.splice(k, 0, stmp[i]);
      }
    }
    var out = [];
    for (i = 0; i < sArr.length - 1; i++) {
      var s1 = sArr[i], s2 = sArr[i + 1], mid = s1 + (s2 - s1) / 2,
          r2 = mid * (mid * A + B) + C, layer;
      if (r2 < rad2) {
        if (phi === -HALF_PI) layer = (mid * mz + tail.z > 0) ? 'bI' : 'aI';
        else if (phi === HALF_PI) layer = (mid * mz + tail.z > 0) ? 'aI' : 'bI';
        else layer = (mid * my + tail.y - (mid * mz + tail.z) * tp > 1e-9) ? 'bI' : 'aI';
      } else { layer = (mid * mz + tail.z < 0) ? 'bE' : 'fE'; }
      out.push({ x1: s1 * mx + tail.x, y1: s1 * my + tail.y, x2: s2 * mx + tail.x, y2: s2 * my + tail.y, layer: layer });
    }
    return out;
  };

  /* ---- Objects (port of "7 CS Objects.as"): screen position + orientation - */
  function SphereObject(sphere, position, opts) {
    this.s = sphere;
    this._o = { x: 0, y: 0, z: 0 };
    this._n = { x: 0, y: 0, z: 1 };
    this._u = { x: 0, y: 1, z: 0 };
    this._oType = 0;             // 0 flat/skewed, 2 absolute
    this.visible = true;         // display toggle (labels / east arrow)
    this._sp = { x: 0, y: 0, z: 0 };
    this.opts = opts || {};
    if (position) this.setPosition(position); else { this._p = { x: 0, y: 0, z: 1 }; this._sys = 0; this._r = 1; }
  }
  SphereObject.prototype.setPosition = function (a) {
    var p = this.s.parse(a);
    this._sys = (p.sys === 1) ? 1 : 0;
    this._p = p; this._r = p.r;
  };
  SphereObject.prototype.setOrientationAbsolute = function () {
    this._oType = 2;
    var p = this._p, nm = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    this._n = { x: p.x / nm, y: p.y / nm, z: p.z / nm };
    if (!(this._n.x === 0 && this._n.y === 0)) {
      var u = { x: -this._n.x * this._n.z, y: -this._n.z * this._n.y, z: this._n.x * this._n.x + this._n.y * this._n.y },
          nu = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
      this._u = { x: u.x / nu, y: u.y / nu, z: u.z / nu };
    } else { this._u = { x: 0, y: 1, z: 0 }; }
    this._p_u = { x: p.x + this._u.x, y: p.y + this._u.y, z: p.z + this._u.z };
    this._p_n = { x: p.x + this._n.x, y: p.y + this._n.y, z: p.z + this._n.z };
  };
  // Computes _sp (screen pos), z, and (for absolute) rotation/yscale of the symbol
  SphereObject.prototype.update = function () {
    var s = this.s, c = s._c, sp = this._sp;
    if (this._sys === 0) s.WtoSz(this._p, sp); else s.CtoSz(this._p, sp);
    if (this._oType === 2) {
      var sp_u = {}, sp_n = {}, npz;
      if (this._sys === 0) {
        npz = (this._n.x * c.a6 + this._n.y * c.a7 + this._n.z * c.a8) / c.r;
        s.WtoSz(this._p_n, sp_n); s.WtoSz(this._p_u, sp_u);
      } else {
        npz = (this._n.x * c.b6 + this._n.y * c.b7 + this._n.z * c.b8) / c.r;
        s.CtoSz(this._p_n, sp_n); s.CtoSz(this._p_u, sp_u);
      }
      this.yscale = npz;                       // signed; mirrors Flash _yscale/100
      var Aa = Math.atan2(sp_n.y - sp.y, sp_n.x - sp.x) + HALF_PI;
      this.rotation = Aa;                       // shell rotation (rad)
      var cA = Math.cos(Aa), sA = Math.sin(Aa),
          x0 = sp_u.x - sp.x, y0 = sp_u.y - sp.y,
          x1 = cA * x0 + sA * y0, y1 = -sA * x0 + cA * y0,
          x2 = x1, y2 = y1 / npz;
      this.instRotation = Math.atan2(y2, x2) + HALF_PI; // inner art rotation (rad)
    } else {
      this.yscale = 1; this.rotation = 0; this.instRotation = 0;
    }
  };

  // ============================ DEMO CONTROLLER ============================ //
  var sphere = new Sphere(160);    // main celestial sphere (size 320 -> r 160)
  var inner  = new Sphere(30);     // Earth's little sphere (size 60 -> r 30)
  inner.setLatitude(90); inner.setSiderealTime(0);

  // shoreline data for the central Earth (verbatim from "Globe Component v2.as")
  var SHORE = [[{x:-0.3346,y:0.0459,z:0.9413},{x:-0.3416,y:0.0996,z:0.9346},{x:-0.2114,y:0.2266,z:0.9508},{x:-0.096,y:0.2606,z:0.9607},{x:-0.0754,y:0.2221,z:0.9721},{x:0.1858,y:0.3188,z:0.9294},{x:0.2601,y:0.2689,z:0.9274},{x:0.3333,y:0.1093,z:0.9365},{x:0.5148,y:0.0304,z:0.8568},{x:0.5205,y:0.0699,z:0.851},{x:0.4949,y:0.0935,z:0.8639},{x:0.5415,y:0.1316,z:0.8304},{x:0.4746,y:0.1559,z:0.8663},{x:0.4533,y:0.1428,z:0.8798},{x:0.3811,y:0.182,z:0.9064},{x:0.5518,y:0.1955,z:0.8107},{x:0.5657,y:0.1123,z:0.8169},{x:0.5325,y:0.0913,z:0.8415},{x:0.5788,y:0.0726,z:0.8123},{x:0.6521,y:0.0005,z:0.7582},{x:0.6599,y:-0.0552,z:0.7494},{x:0.6902,y:-0.0128,z:0.7235},{x:0.7263,y:-0.0199,z:0.6871},{x:0.7223,y:-0.1168,z:0.6817},{x:0.7875,y:-0.1261,z:0.6033},{x:0.8049,y:-0.079,z:0.5882},{x:0.7916,y:-0.0099,z:0.611},{x:0.7267,y:0.0424,z:0.6856},{x:0.7059,y:0.1082,z:0.7},{x:0.7406,y:0.2044,z:0.6401},{x:0.761,y:0.2109,z:0.6135},{x:0.7249,y:0.2418,z:0.645},{x:0.7003,y:0.1548,z:0.6969},{x:0.6782,y:0.1634,z:0.7165},{x:0.701,y:0.2505,z:0.6677},{x:0.7398,y:0.316,z:0.5939},{x:0.7024,y:0.2932,z:0.6486},{x:0.6614,y:0.3481,z:0.6644},{x:0.5977,y:0.3465,z:0.723},{x:0.5499,y:0.4863,z:0.679},{x:0.6837,y:0.3491,z:0.6408},{x:0.7121,y:0.3693,z:0.5971},{x:0.6462,y:0.4721,z:0.5996},{x:0.7063,y:0.479,z:0.5213},{x:0.7515,y:0.4162,z:0.5118},{x:0.7804,y:0.3107,z:0.5427},{x:0.816,y:0.2808,z:0.5053},{x:0.8186,y:0.1474,z:0.5552},{x:0.7832,y:0.1514,z:0.6031},{x:0.8072,y:-0.0792,z:0.5849},{x:0.8913,y:-0.2764,z:0.3594},{x:0.9222,y:-0.2913,z:0.2545},{x:0.968,y:-0.2156,z:0.1285},{x:0.996,y:-0.0345,z:0.0829},{x:0.991,y:0.0669,z:0.116},{x:0.9841,y:0.1734,z:0.0387},{x:0.9529,y:0.2358,z:-0.191},{x:0.9216,y:0.199,z:-0.3334},{x:0.7843,y:0.2596,z:-0.5635},{x:0.7424,y:0.3784,z:-0.5528},{x:0.7432,y:0.53,z:-0.4084},{x:0.7742,y:0.5361,z:-0.3363},{x:0.7322,y:0.6312,z:-0.2559},{x:0.7731,y:0.629,z:-0.0816},{x:0.6711,y:0.7371,z:0.0794},{x:0.6185,y:0.7582,z:0.2064},{x:0.7094,y:0.6835,z:0.172},{x:0.7425,y:0.6167,z:0.2616},{x:0.7323,y:0.4634,z:0.499},{x:0.7047,y:0.6485,z:0.288},{x:0.709,y:0.6702,z:0.2195},{x:0.547,y:0.7839,z:0.2936},{x:0.4669,y:0.7999,z:0.3771},{x:0.5075,y:0.7499,z:0.4244},{x:0.5708,y:0.7106,z:0.4113},{x:0.5873,y:0.6439,z:0.4903},{x:0.5637,y:0.6524,z:0.5065},{x:0.4562,y:0.7854,z:0.4183},{x:0.285,y:0.8918,z:0.3513},{x:0.2137,y:0.9667,z:0.1405},{x:0.1742,y:0.9683,z:0.179},{x:0.1617,y:0.9492,z:0.2701},{x:-0.0245,y:0.9218,z:0.3868},{x:-0.0724,y:0.9584,z:0.276},{x:-0.1291,y:0.9498,z:0.2851},{x:-0.1512,y:0.9825,z:0.1087},{x:-0.2453,y:0.9692,z:0.024},{x:-0.2253,y:0.9697,z:0.0943},{x:-0.162,y:0.9742,z:0.1569},{x:-0.1693,y:0.9583,z:0.2302},{x:-0.2604,y:0.9534,z:0.1521},{x:-0.324,y:0.9204,z:0.2189},{x:-0.2558,y:0.9105,z:0.3249},{x:-0.4007,y:0.8273,z:0.3937},{x:-0.461,y:0.7336,z:0.4994},{x:-0.4007,y:0.7145,z:0.5736},{x:-0.428,y:0.6691,z:0.6076},{x:-0.385,y:0.6794,z:0.6247},{x:-0.4476,y:0.6263,z:0.6383},{x:-0.4855,y:0.663,z:0.5698},{x:-0.5161,y:0.6355,z:0.5743},{x:-0.4692,y:0.6094,z:0.6391},{x:-0.5192,y:0.5174,z:0.6803},{x:-0.5026,y:0.4055,z:0.7635},{x:-0.4193,y:0.3708,z:0.8287},{x:-0.4622,y:0.1663,z:0.871},{x:-0.5025,y:0.2226,z:0.8355},{x:-0.5765,y:0.2476,z:0.7787},{x:-0.5338,y:0.1583,z:0.8306},{x:-0.4863,y:0.1283,z:0.8643},{x:-0.4672,y:0.0074,z:0.8841},{x:-0.418,y:0.0021,z:0.9084},{x:-0.4004,y:-0.072,z:0.9135}],[{x:0.206,y:-0.5678,z:-0.797},{x:0.3392,y:-0.6758,z:-0.6544},{x:0.5784,y:-0.6598,z:-0.4797},{x:0.5974,y:-0.6792,z:-0.4264},{x:0.6996,y:-0.6096,z:-0.3727},{x:0.7597,y:-0.612,z:-0.22},{x:0.8105,y:-0.5663,z:-0.1498},{x:0.8141,y:-0.5728,z:-0.0954},{x:0.6662,y:-0.7455,z:0.0175},{x:0.6302,y:-0.767,z:0.1205},{x:0.3556,y:-0.9081,z:0.2212},{x:0.2267,y:-0.9645,z:0.1355},{x:0.1876,y:-0.9681,z:0.1662},{x:0.1322,y:-0.9786,z:0.1575},{x:0.1114,y:-0.9592,z:0.2597},{x:0.0201,y:-0.9619,z:0.2728},{x:0.0499,y:-0.9301,z:0.3639},{x:-0.0045,y:-0.9324,z:0.3614},{x:-0.0268,y:-0.9479,z:0.3173},{x:-0.1023,y:-0.9327,z:0.3458},{x:-0.125,y:-0.8816,z:0.4551},{x:-0.0824,y:-0.8601,z:0.5034},{x:0.0953,y:-0.8597,z:0.5018},{x:0.1497,y:-0.8938,z:0.4228},{x:0.1263,y:-0.8453,z:0.5192},{x:0.1937,y:-0.7964,z:0.5729},{x:0.2105,y:-0.7227,z:0.6583},{x:0.2559,y:-0.7013,z:0.6653},{x:0.2381,y:-0.6877,z:0.6859},{x:0.2978,y:-0.6315,z:0.7159},{x:0.3001,y:-0.6601,z:0.6886},{x:0.3373,y:-0.6187,z:0.7096},{x:0.2658,y:-0.6144,z:0.7428},{x:0.2193,y:-0.6474,z:0.7299},{x:0.2561,y:-0.5848,z:0.7697},{x:0.3205,y:-0.5532,z:0.7689},{x:0.3322,y:-0.4862,z:0.8082},{x:0.284,y:-0.4991,z:0.8187},{x:0.2136,y:-0.4479,z:0.8682},{x:0.195,y:-0.4938,z:0.8474},{x:0.1718,y:-0.4534,z:0.8746},{x:0.0976,y:-0.4563,z:0.8845},{x:0.1089,y:-0.6066,z:0.7875},{x:0.0729,y:-0.5727,z:0.8165},{x:-0.0263,y:-0.5471,z:0.8366},{x:-0.0364,y:-0.4856,z:0.8734},{x:0.0594,y:-0.3827,z:0.922},{x:0.052,y:-0.3518,z:0.9346},{x:0.0091,y:-0.376,z:0.9266},{x:-0.0262,y:-0.3095,z:0.9505},{x:-0.0904,y:-0.365,z:0.9266},{x:-0.2194,y:-0.2788,z:0.9349},{x:-0.2931,y:-0.1264,z:0.9477},{x:-0.3515,y:-0.0852,z:0.9323},{x:-0.3753,y:-0.1338,z:0.9172},{x:-0.407,y:-0.0856,z:0.9094},{x:-0.406,y:-0.1419,z:0.9028},{x:-0.4614,y:-0.1161,z:0.8795},{x:-0.4954,y:-0.1572,z:0.8543},{x:-0.4735,y:-0.2013,z:0.8575},{x:-0.5529,y:-0.168,z:0.8162},{x:-0.4737,y:-0.2264,z:0.8511},{x:-0.4053,y:-0.2586,z:0.8768},{x:-0.3598,y:-0.3663,z:0.8581},{x:-0.3688,y:-0.5542,z:0.7462},{x:-0.433,y:-0.6465,z:0.6282},{x:-0.3806,y:-0.7794,z:0.4977},{x:-0.3212,y:-0.8604,z:0.3956},{x:-0.3576,y:-0.7715,z:0.5262},{x:-0.2197,y:-0.924,z:0.313},{x:0.0463,y:-0.9711,z:0.2343},{x:0.1108,y:-0.9829,z:0.1468},{x:0.1636,y:-0.9786,z:0.125},{x:0.1918,y:-0.9704,z:0.147},{x:0.2199,y:-0.9734,z:0.0637},{x:0.1579,y:-0.9849,z:-0.0705},{x:0.2319,y:-0.939,z:-0.254},{x:0.3228,y:-0.8834,z:-0.3398},{x:0.2626,y:-0.7902,z:-0.5538},{x:0.2245,y:-0.7628,z:-0.6064},{x:0.1743,y:-0.5802,z:-0.7956}],[{x:0.2884,y:-0.169,z:0.9425},{x:0.258,y:-0.135,z:0.9567},{x:0.2665,y:-0.0991,z:0.9587},{x:0.1582,y:-0.0467,z:0.9863},{x:0.0767,y:-0.1085,z:0.9911},{x:0.0709,y:-0.1896,z:0.9793},{x:0.2796,y:-0.3484,z:0.8947},{x:0.3541,y:-0.3522,z:0.8663}],[{x:-0.6199,y:0.4769,z:-0.6232},{x:-0.7027,y:0.3948,z:-0.5919},{x:-0.8027,y:0.4056,z:-0.4373},{x:-0.7799,y:0.5977,z:-0.1855},{x:-0.7366,y:0.6049,z:-0.3026},{x:-0.6881,y:0.6783,z:-0.2577},{x:-0.7106,y:0.6728,z:-0.2059},{x:-0.6562,y:0.7295,z:-0.193},{x:-0.6152,y:0.7435,z:-0.2623},{x:-0.5707,y:0.7852,z:-0.2406},{x:-0.487,y:0.8068,z:-0.3345},{x:-0.3773,y:0.8479,z:-0.3725},{x:-0.3439,y:0.7982,z:-0.4946},{x:-0.4027,y:0.7092,z:-0.5787},{x:-0.5375,y:0.6569,z:-0.5288},{x:-0.616,y:0.5528,z:-0.5612}],[{x:0.195,y:-0.4301,z:0.8815},{x:0.1489,y:-0.3678,z:0.9179},{x:0.1884,y:-0.3839,z:0.9039},{x:0.1903,y:-0.3474,z:0.9182},{x:0.0234,y:-0.286,z:0.9579},{x:0.0282,y:-0.3259,z:0.945},{x:0.1146,y:-0.3675,z:0.9229},{x:0.1043,y:-0.411,z:0.9056}],[{x:0.3616,y:0.0008,z:-0.9323},{x:0.2757,y:-0.095,z:-0.9565},{x:0.1623,y:-0.1217,z:-0.9792},{x:0.1207,y:-0.2253,z:-0.9668},{x:0.2426,y:-0.377,z:-0.8939},{x:0.0849,y:-0.3383,z:-0.9372},{x:0.0888,y:-0.2744,z:-0.9575},{x:-0.0569,y:-0.3062,z:-0.9503},{x:-0.1779,y:-0.2219,z:-0.9587},{x:-0.2086,y:0.0366,z:-0.9773},{x:-0.3158,y:0.0556,z:-0.9472},{x:-0.2925,y:0.2905,z:-0.9111},{x:-0.0938,y:0.4102,z:-0.9072},{x:0.056,y:0.4063,z:-0.912},{x:0.0955,y:0.3336,z:-0.9379},{x:0.2419,y:0.3294,z:-0.9127},{x:0.3116,y:0.1986,z:-0.9292},{x:0.3043,y:0.1373,z:-0.9426}],[{x:-0.8538,y:0.5009,z:-0.1421},{x:-0.7416,y:0.6703,z:-0.0256},{x:-0.709,y:0.7032,z:-0.0528},{x:-0.6683,y:0.7438,z:-0.0045},{x:-0.6686,y:0.741,z:-0.0628},{x:-0.74,y:0.6658,z:-0.0956},{x:-0.7476,y:0.6484,z:-0.1438},{x:-0.7854,y:0.5973,z:-0.1622},{x:-0.8088,y:0.5738,z:-0.129}],[{x:0.412,y:-0.5346,z:0.7379},{x:0.3479,y:-0.5141,z:0.784},{x:0.3439,y:-0.5681,z:0.7477},{x:0.3846,y:-0.5658,z:0.7293}],[{x:-0.476,y:0.8794,z:0.0094},{x:-0.4487,y:0.8918,z:0.0578},{x:-0.4865,y:0.8683,z:0.0968},{x:-0.4544,y:0.8824,z:0.1219},{x:-0.3257,y:0.9452,z:0.0238},{x:-0.3543,y:0.9338,z:-0.0508},{x:-0.4199,y:0.9043,z:-0.0771}],[{x:0.6229,y:-0.0015,z:0.7823},{x:0.5351,y:-0.0161,z:0.8447},{x:0.5191,y:-0.045,z:0.8535},{x:0.5664,y:-0.054,z:0.8224},{x:0.6044,y:-0.0332,z:0.796},{x:0.6377,y:-0.0634,z:0.7677}],[{x:-0.6002,y:0.5602,z:0.5709},{x:-0.63,y:0.5126,z:0.5834},{x:-0.5865,y:0.4671,z:0.6617},{x:-0.5851,y:0.5637,z:0.583},{x:-0.5406,y:0.6248,z:0.5634},{x:-0.5876,y:0.603,z:0.5395}],[{x:0.617,y:0.664,z:-0.4225},{x:0.6136,y:0.7434,z:-0.2664},{x:0.6383,y:0.7414,z:-0.2071},{x:0.6869,y:0.6617,z:-0.3006},{x:0.6624,y:0.6263,z:-0.4111}],[{x:-0.5157,y:0.8519,z:-0.0911},{x:-0.5141,y:0.857,z:-0.0346},{x:-0.5742,y:0.8181,z:0.0314},{x:-0.5062,y:0.8623,z:0.0162},{x:-0.4805,y:0.8757,z:-0.0484}],[{x:0.4193,y:-0.1148,z:0.9006},{x:0.3867,y:-0.0987,z:0.9169},{x:0.3781,y:-0.1507,z:0.9134},{x:0.4088,y:-0.1714,z:0.8964}],[{x:0.6119,y:-0.0864,z:0.7862},{x:0.5713,y:-0.0666,z:0.818},{x:0.5764,y:-0.1031,z:0.8107},{x:0.605,y:-0.1146,z:0.7879}],[{x:-0.7522,y:0.0451,z:-0.6574},{x:-0.8171,y:0.0431,z:-0.5749},{x:-0.8274,y:0.0859,z:-0.555},{x:-0.7623,y:0.0812,z:-0.6421}],[{x:-0.2696,y:0.958,z:-0.0974},{x:-0.2767,y:0.9593,z:-0.0563},{x:-0.2353,y:0.9719,z:0.0031},{x:-0.0907,y:0.9911,z:0.0973}],[{x:0.2428,y:-0.9068,z:0.3446},{x:0.1414,y:-0.9078,z:0.3949},{x:0.0949,y:-0.9173,z:0.3867},{x:0.1925,y:-0.9144,z:0.3562},{x:0.2009,y:-0.9193,z:0.3384}],[{x:0.0223,y:-0.7332,z:0.6796},{x:0.0589,y:-0.6836,z:0.7275},{x:-0.0229,y:-0.6822,z:0.7308},{x:0.0178,y:-0.6568,z:0.7539},{x:0.1038,y:-0.6978,z:0.7087},{x:0.0942,y:-0.7242,z:0.6831},{x:0.0629,y:-0.698,z:0.7134},{x:0.0448,y:-0.7453,z:0.6652}],[{x:0.4824,y:0.5331,z:0.6951},{x:0.4116,y:0.5444,z:0.7309},{x:0.4499,y:0.5682,z:0.689},{x:0.4702,y:0.6478,z:0.5994},{x:0.521,y:0.5986,z:0.6085}],[{x:0.3431,y:-0.8806,z:0.3269},{x:0.2745,y:-0.8987,z:0.3421},{x:0.2662,y:-0.9088,z:0.3212},{x:0.3042,y:-0.8984,z:0.3167}],[{x:-0.5955,y:0.4446,z:0.6691},{x:-0.6012,y:0.4083,z:0.6869},{x:-0.5515,y:0.4322,z:0.7135},{x:-0.5679,y:0.4685,z:0.6767},{x:-0.5955,y:0.4446,z:0.6691},{x:-0.5955,y:0.4446,z:0.6691}]];

  // ----- demo state -----
  var state = { ra: 4, dec: 60, theta: 217, phi: 32, labels: {
      earthPoles: false, equator: false, celPoles: false, celEquator: false,
      zeroHours: false, ecliptic: false, eastArrow: false } };

  // ----- build the scene exactly as the AS init() does -----
  // (colours/alphas/tilts copied verbatim from "Celestial Equatorial Demo.as")
  var C = {};   // named circles
  function addCircle(name, style, def) { var c = new Circle(sphere, style, def); sphere.circles.push(c); C[name] = c; return c; }
  var L = {};
  function addLine(name, style, head, tail) { var l = new Line(sphere, style, head, tail); sphere.lines.push(l); L[name] = l; return l; }

  // big-sphere circles
  addCircle('celestialEquator', { thickness: 2, color: 2188081, alpha: 100 }, { ra: 0, dec: 0, tilt: 0 });
  addCircle('meridian1', { thickness: 1, color: 0, alpha: 10 }, { ra: 0, dec: 0, tilt: 90, gammaStart: 90, gammaEnd: -90 });
  addCircle('meridian2', { thickness: 1, color: 0, alpha: 10 }, { ra: 6, dec: 0, tilt: 90 });
  addCircle('zeroHoursCircle', { thickness: 2, color: 2188081, alpha: 100 }, { ra: 0, dec: 0, tilt: 90, gammaStart: -90, gammaEnd: 90 });
  addCircle('ecliptic', { thickness: 2, color: 10039775, alpha: 100 }, { ra: 0, dec: 0, tilt: 23.5 });
  addCircle('raCircle', { thickness: 1, color: 10526880, alpha: 100 }, { ra: 0, dec: 0, tilt: 90 });
  addCircle('decCircle', { thickness: 1, color: 10526880, alpha: 100 }, { ra: 0, dec: 0, tilt: 90 });
  addCircle('raArc', { thickness: 3, color: raColor, alpha: 100 }, { ra: 0, dec: 0, tilt: 0 });
  addCircle('decArc', { thickness: 3, color: decColor, alpha: 100 }, { ra: 0, dec: 0, tilt: 90 });
  // pole axis extensions sticking out of the sphere (grey)
  addLine('ncpLineExtension', { thickness: 2, color: 5263440, alpha: 100 }, { ra: 0, dec: 90, r: 1 }, { ra: 0, dec: 90, r: 1.3 });
  addLine('scpLineExtension', { thickness: 2, color: 5263440, alpha: 100 }, { ra: 0, dec: -90, r: 1 }, { ra: 0, dec: -90, r: 1.3 });

  // inner-sphere Earth equator (port: innerSphere.addCircle("equator", color 2188081, dec0 tilt0))
  var earthEquator = new Circle(inner, { thickness: 1, color: 2188081, alpha: 100 }, { ra: 0, dec: 0, tilt: 0 });
  inner.circles.push(earthEquator);

  // ----- graphical objects on the big sphere -----
  var OBJ = {};
  function addObj(name, position, opts, absolute) {
    var o = new SphereObject(sphere, position, opts);
    if (absolute) o.setOrientationAbsolute();
    sphere.objects.push(o); OBJ[name] = o; return o;
  }
  // markers at the celestial poles + rotation arrow (absolute oriented)
  addObj('ncpMarker', { ra: 0, dec: 90 }, { kind: 'marker' }, true);
  addObj('scpMarker', { ra: 0, dec: -90 }, { kind: 'marker' }, true);
  addObj('rotationArrow', { ra: 0, dec: 90, r: 0.4 }, { kind: 'rotationArrow' }, true);
  addObj('eastArrow', { x: 0, y: 0, z: 0, r: 1.2 }, { kind: 'eastArrow' }, false);
  addObj('star', { ra: 0, dec: 0 }, { kind: 'star' }, true);

  // ----- text labels (verbatim strings recovered from texts/*.txt) -----
  // Rendered upright for legibility (see ACCESSIBILITY.md). Each carries the
  // 3-D position the AS gives it so it tracks the rotating sphere.
  var LBL = {};
  function addLabel(name, position, text, opts) {
    var o = new SphereObject(sphere, position, opts || {});
    o.text = text; o.label = true; sphere.objects.push(o); LBL[name] = o; return o;
  }
  // Feature labels use a leader-line callout (text offset from the feature with a
  // thin pointer line), matching the original Flash label symbols.
  addLabel('northPole', { x: 0, y: 0, z: 0.2, system: 'horizon' }, 'North Pole', { leader: true });
  addLabel('southPole', { x: 0, y: 0, z: -0.2, system: 'horizon' }, 'South Pole', { leader: true });
  addLabel('equator',   { x: 0, y: 0, z: 0, system: 'horizon' }, 'Equator', { leader: true });
  addLabel('ncp',       { x: 0, y: 0, z: 1, system: 'horizon' }, 'North Celestial Pole', { leader: true });
  addLabel('scp',       { x: 0, y: 0, z: -1, system: 'horizon' }, 'South Celestial Pole', { leader: true });
  addLabel('ecliptic',  { x: 0, y: 0, z: 0, system: 'horizon' }, 'Ecliptic', { leader: true });
  addLabel('ce',        { x: 0, y: 0, z: 0, system: 'horizon' }, 'Celestial Equator', { leader: true });
  addLabel('eastArrowLbl', { x: 0, y: 0, z: 0, r: 1.2 }, 'East', { dy: 16 });
  addLabel('zeroHours', { ra: 0, dec: 35, r: 1 }, '0h Circle', { leader: true });
  // RA/Dec readout labels that ride next to the star (always visible)
  addLabel('raLabel', { ra: 0, dec: 0, r: 1.001 }, '', { color: raColor });
  addLabel('decLabel', { ra: 0, dec: 0, r: 1.001 }, '', { color: decColor });

  // -------- controller methods (port of "Celestial Equatorial Demo.as") -----
  function onSphereOrientationChanged() {
    inner.setThetaAndPhi(sphere.getTheta(), sphere.getPhi());
    // East arrow position depends on theta (port of onSphereOrientationChanged)
    OBJ.eastArrow.setPosition({ alt: 0, az: -sphere.getTheta(), r: 1.15 });
    OBJ.eastArrow.setOrientationAbsolute();
    LBL.eastArrowLbl.setPosition({ alt: 0, az: -sphere.getTheta(), r: 1.15 });
    // ecliptic label tilt-tracking (verbatim trig)
    var t2 = -34 - sphere.getTheta();
    var t3 = Math.atan(Math.sin(t2 * D2R) * 0.4348123749609336) * R2D;
    LBL.ecliptic.setPosition({ alt: t3, az: t2, r: 1.01 });
    LBL.equator.setPosition({ alt: 0, az: 394 - sphere.getTheta(), r: 0.2 });
    LBL.ce.setPosition({ alt: 0, az: 394 - sphere.getTheta(), r: 1.01 });
  }

  function setStarLocation(ra, dec, skipSliderSync) {
    state.ra = ra; state.dec = dec;
    LBL.raLabel.text = asFixed(ra, 1) + 'h';
    LBL.raLabel.setPosition({ ra: ra - 0.9, dec: 5, r: 1.001 }); LBL.raLabel.setOrientationAbsolute();
    LBL.decLabel.text = asFixed(dec, 1) + '°';
    LBL.decLabel.setPosition({ ra: ra + 0.9, dec: dec / 2, r: 1.001 }); LBL.decLabel.setOrientationAbsolute();
    OBJ.star.setPosition({ ra: ra, dec: dec }); OBJ.star.setOrientationAbsolute();
    // RA arc (green) only when ra != 0
    if (ra !== 0) { C.raArc.setParameters({ ra: 0, dec: 0, tilt: 0, gammaStart: 0, gammaEnd: 15 * ra }); C.raArc._visible = true; }
    else C.raArc._visible = false;
    C.raCircle.setParameters({ ra: ra, dec: 0, tilt: 90, gammaStart: -90, gammaEnd: 90 });
    if (dec < 0) { C.decArc.setParameters({ ra: ra, dec: 0, tilt: 90, gammaStart: dec, gammaEnd: 0 }); C.decArc._visible = true; }
    else if (dec > 0) { C.decArc.setParameters({ ra: ra, dec: 0, tilt: 90, gammaStart: 0, gammaEnd: dec }); C.decArc._visible = true; }
    else C.decArc._visible = false;
    C.decCircle.setParameters({ ra: 0, dec: dec, tilt: 0 });
    if (!skipSliderSync) { raRange.value = ra; decRange.value = dec; raField.value = asFixed(ra, 1); decField.value = asFixed(dec, 1); }
    syncReadouts();
  }

  function updateLabelsVisibility() {
    LBL.eastArrowLbl.visible = OBJ.eastArrow.visible = state.labels.eastArrow;
    C.ecliptic._visible = state.labels.ecliptic;
    LBL.ecliptic.visible = state.labels.ecliptic;
    LBL.northPole.visible = LBL.southPole.visible = state.labels.earthPoles;
    LBL.equator.visible = state.labels.equator;
    LBL.ncp.visible = LBL.scp.visible = state.labels.celPoles;
    LBL.ce.visible = state.labels.celEquator;
    LBL.zeroHours.visible = state.labels.zeroHours;
  }

  function reset() {
    setStarLocation(4, 60);
    sphere.setThetaAndPhi(217, 32);
    onSphereOrientationChanged();
    // hide all labels
    for (var k in state.labels) state.labels[k] = false;
    syncCheckboxes();
    updateLabelsVisibility();
    requestRender();
    announce('View reset. Star at right ascension ' + asFixed(4, 1) + ' hours, declination ' + asFixed(60, 1) + ' degrees. All labels hidden.');
  }

  /* ============================ RENDERING ================================= */
  var canvas = document.getElementById('sky-canvas');
  var ctx = canvas.getContext('2d');
  var STAGE = 480, CX = STAGE / 2, CY = STAGE / 2;

  function fitCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = STAGE * dpr; canvas.height = STAGE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestRender();
  }

  // exported art (reused as-is): loaded as <img> for compositing. Known intrinsic
  // sizes are recorded as a fallback because Safari reports naturalWidth === 0 for
  // some SVGs, which would otherwise skip the draw.
  var IMG = {}, IMGDIM = {
    star: [21.9, 21.15], starHi: [20.9, 20.15],
    eastArrow: [42.25, 20.75], rotationArrow: [39.5, 34.2]
  };
  function loadImg(key, src) { var im = new Image(); im.onload = requestRender; im.src = src; IMG[key] = im; }
  loadImg('star', 'assets/star.svg');
  loadImg('starHi', 'assets/star-hi.svg');
  loadImg('eastArrow', 'assets/east-arrow.svg');
  loadImg('rotationArrow', 'assets/rotation-arrow.svg');

  function strokeArcs(arcs, v, color, thick, alpha) {
    ctx.strokeStyle = css(color, alpha); ctx.lineWidth = Math.max(thick, 0.6);
    for (var i = 0; i < arcs.length; i++) { ctx.beginPath(); drawArc(ctx, v, arcs[i][0], arcs[i][1], 0.7853981633974483); ctx.stroke(); }
  }

  // radial sphere shading (approximation of the AS gradient-disk + edge shading)
  function drawSphereShading(front) {
    var r = sphere._c.r;
    if (!front) {
      var gb = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gb.addColorStop(0, 'rgba(255,255,255,0.5)'); gb.addColorStop(1, 'rgba(255,255,255,0.6)');
      ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
    } else {
      var gf = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gf.addColorStop(0, 'rgba(255,255,255,0.05)'); gf.addColorStop(0.75, 'rgba(255,255,255,0.0)'); gf.addColorStop(1, 'rgba(0,0,0,0.20)');
      ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
    }
  }

  // central Earth: blue water disk + front-facing continents (q matrix == identity
  // at precession/rotation/sTime 0, so shore points map straight through inner.CtoSz)
  function drawEarth() {
    var r = inner._c.r;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.clip();
    // water
    var wg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    wg.addColorStop(0, '#bcd2f5'); wg.addColorStop(1, '#5b86d6');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
    // continents (front-facing segments)
    ctx.fillStyle = '#3f8f4a';
    for (var i = 0; i < SHORE.length; i++) {
      var poly = SHORE[i], started = false;
      ctx.beginPath();
      for (var j = 0; j < poly.length; j++) {
        var sp = {}; inner.CtoSz(poly[j], sp);
        if (sp.z > 0) {
          if (!started) { ctx.moveTo(sp.x, sp.y); started = true; } else ctx.lineTo(sp.x, sp.y);
        }
      }
      if (started) { ctx.closePath(); ctx.fill(); }
    }
    // Earth rotation axis (black, through the poles) -- port of globe axis lines
    var nAx = {}, sAx = {};
    inner.CtoSz({ x: 0, y: 0, z: 1.0 }, nAx); inner.CtoSz({ x: 0, y: 0, z: -1.0 }, sAx);
    ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sAx.x, sAx.y); ctx.lineTo(nAx.x, nAx.y); ctx.stroke();
    ctx.restore();
    // Earth equator with front/back occlusion (thin)
    var ea = earthEquator.computeArcs();
    strokeArcs(ea.back, ea.v, earthEquator._color, earthEquator._thick, 35);
    strokeArcs(ea.front, ea.v, earthEquator._color, earthEquator._thick, 100);
  }

  function drawLineSegs(segs, which, color, thick, alpha) {
    ctx.strokeStyle = css(color, alpha); ctx.lineWidth = Math.max(thick, 0.6);
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].layer !== which) continue;
      ctx.beginPath(); ctx.moveTo(segs[i].x1, segs[i].y1); ctx.lineTo(segs[i].x2, segs[i].y2); ctx.stroke();
    }
  }

  function drawGraphicalObject(o) {
    var k = o.opts.kind, sp = o._sp, img;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    if (k === 'marker') {
      ctx.fillStyle = '#888'; ctx.strokeStyle = '#444'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TWO_PI); ctx.fill(); ctx.stroke();
      ctx.restore(); return;
    }
    var imgKey;
    if (k === 'star') { imgKey = (o === OBJ.star && starHover && sp.z > 0) ? 'starHi' : 'star'; }
    else if (k === 'eastArrow') imgKey = 'eastArrow';
    else if (k === 'rotationArrow') imgKey = 'rotationArrow';
    img = IMG[imgKey];
    if (img && img.complete) {
      // apply absolute orientation (rotation + signed y-scale) like Flash
      ctx.rotate(o.rotation || 0);
      var ys = o.yscale || 1;
      ctx.scale(1, ys === 0 ? 0.001 : ys);
      ctx.rotate(o.instRotation || 0);
      // Use intrinsic size (falling back to known dims when naturalWidth is 0, as on
      // Safari) and let the canvas matrix do the shrink -- this avoids relying on
      // SVG-to-canvas rescaling, which is inconsistent across browsers.
      var dim = IMGDIM[imgKey];
      var w = img.naturalWidth || dim[0], h = img.naturalHeight || dim[1], sc = (k === 'star') ? 0.7 : 0.6;
      ctx.globalAlpha = sp.z < 0 ? 0.5 : 1;
      ctx.scale(sc, sc);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function drawLabel(o) {
    if (!o.visible) return;
    var sp = o._sp;
    ctx.save();
    ctx.font = '12px SimVerdana, Verdana, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = sp.z < 0 ? 0.5 : 1;
    var col = (o.opts && o.opts.color != null) ? css(o.opts.color, 100) : '#1a1a1a';
    if (o.opts && o.opts.leader) {
      // Callout: thin leader line from the feature point out to offset text.
      var ax = sp.x, ay = sp.y, len = Math.sqrt(ax * ax + ay * ay), dx, dy;
      if (len < 1) { dx = -0.7071; dy = -0.7071; } else { dx = ax / len; dy = ay / len; }
      var off = 32, tx = ax + dx * off, ty = ay + dy * off;
      ctx.strokeStyle = 'rgba(70,70,70,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.textAlign = (dx < 0) ? 'right' : 'left';
      var lx = tx + (dx < 0 ? -3 : 3);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(o.text, lx, ty);
      ctx.fillStyle = col; ctx.fillText(o.text, lx, ty);
    } else {
      // Plain text on/near the feature (RA/dec read-outs, East arrow label).
      // opts.dx/dy give a fixed screen offset (used to drop "East" below the arrow).
      var ox = (o.opts && o.opts.dx) || 0, oy = (o.opts && o.opts.dy) || 0;
      var px = sp.x + ox, py = sp.y + oy;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(o.text, px, py);
      ctx.fillStyle = col; ctx.fillText(o.text, px, py);
    }
    ctx.restore();
  }

  var starHover = false;
  var renderQueued = false;
  function requestRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }

  function render() {
    renderQueued = false;
    sphere.doA(); sphere.doB(); inner.doA(); inner.doB();
    // recompute object screen positions
    var i;
    for (i = 0; i < sphere.objects.length; i++) sphere.objects[i].update();

    ctx.clearRect(0, 0, STAGE, STAGE);
    ctx.save();
    ctx.translate(CX, CY);

    // ---- back layer ----
    drawSphereShading(false);
    var circleData = [];
    for (i = 0; i < sphere.circles.length; i++) {
      var c = sphere.circles[i];
      if (!c._visible) { circleData.push(null); continue; }
      circleData.push(c.computeArcs());
    }
    // back circles
    for (i = 0; i < sphere.circles.length; i++) { var cd = circleData[i], cc = sphere.circles[i];
      if (cd) strokeArcs(cd.back, cd.v, cc._color, cc._thick, cc._alpha * 0.5); }
    // back lines
    var lineSegs = [];
    for (i = 0; i < sphere.lines.length; i++) lineSegs.push(sphere.lines[i].computeSegments());
    for (i = 0; i < sphere.lines.length; i++) { drawLineSegs(lineSegs[i], 'bE', sphere.lines[i]._color, sphere.lines[i]._thick, sphere.lines[i]._alpha); drawLineSegs(lineSegs[i], 'bI', sphere.lines[i]._color, sphere.lines[i]._thick, sphere.lines[i]._alpha); }
    // back-facing graphical objects
    for (i = 0; i < sphere.objects.length; i++) { var o = sphere.objects[i]; if (!o.label && o.visible !== false && o._sp.z < 0) drawGraphicalObject(o); }

    // ---- middle: Earth ----
    drawEarth();

    // ---- front layer ----
    for (i = 0; i < sphere.circles.length; i++) { var cd2 = circleData[i], cc2 = sphere.circles[i];
      if (cd2) strokeArcs(cd2.front, cd2.v, cc2._color, cc2._thick, cc2._alpha); }
    for (i = 0; i < sphere.lines.length; i++) { drawLineSegs(lineSegs[i], 'fE', sphere.lines[i]._color, sphere.lines[i]._thick, sphere.lines[i]._alpha); drawLineSegs(lineSegs[i], 'aI', sphere.lines[i]._color, sphere.lines[i]._thick, sphere.lines[i]._alpha); }
    drawSphereShading(true);
    // sphere outline
    ctx.strokeStyle = 'rgba(120,120,120,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, sphere._c.r, 0, TWO_PI); ctx.stroke();
    // front-facing graphical objects
    for (i = 0; i < sphere.objects.length; i++) { var o2 = sphere.objects[i]; if (!o2.label && o2.visible !== false && o2._sp.z >= 0) drawGraphicalObject(o2); }
    // labels on top (upright)
    for (i = 0; i < sphere.objects.length; i++) { var o3 = sphere.objects[i]; if (o3.label) drawLabel(o3); }

    ctx.restore();
    positionStarHandle();
  }

  // Keep the focusable star control positioned over the star (so its focus ring
  // lands on the star). Uses the same live geometry as the pointer mapping.
  function positionStarHandle() {
    if (!starHandle) return;
    var op = starHandle.offsetParent; if (!op) return;
    var cr = canvas.getBoundingClientRect(), wr = op.getBoundingClientRect();
    var scale = cr.width / STAGE, sp = OBJ.star._sp;
    starHandle.style.left = (cr.left - wr.left + (CX + sp.x) * scale) + 'px';
    starHandle.style.top  = (cr.top - wr.top + (CY + sp.y) * scale) + 'px';
  }

  /* ============================ INTERACTION =============================== */
  function toStage(ev) {
    // Map client px -> original stage coordinates using the LIVE displayed size,
    // so it stays correct even after the layout reflows or the canvas is resized.
    var rect = canvas.getBoundingClientRect();
    var sx = rect.width ? STAGE / rect.width : 1;
    var sy = rect.height ? STAGE / rect.height : 1;
    var x = (ev.clientX - rect.left) * sx - CX;
    var y = (ev.clientY - rect.top) * sy - CY;
    return { x: x, y: y };
  }

  var drag = null;          // {mode:'view'|'star', ...}
  var starHandle = document.getElementById('star-handle');   // focusable star control
  canvas.addEventListener('pointerdown', function (ev) {
    canvas.setPointerCapture(ev.pointerId);
    var m = toStage(ev);
    // hit-test star: near star screen pos and star on the near side
    var st = OBJ.star._sp, dx = m.x - st.x, dy = m.y - st.y;
    if (st.z > 0 && Math.sqrt(dx * dx + dy * dy) <= 12) {
      drag = { mode: 'star' };
      if (starHandle) starHandle.focus();   // clicking the star selects the star control
    } else {
      drag = { mode: 'view', x: m.x, y: m.y, theta: sphere._theta, phi: sphere._phi };
      canvas.focus();                        // clicking the sphere selects the view (rotate) control
    }
    ev.preventDefault();
  });
  canvas.addEventListener('pointermove', function (ev) {
    var m = toStage(ev);
    if (!drag) { // hover highlight on star
      var st = OBJ.star._sp, d = Math.sqrt((m.x - st.x) * (m.x - st.x) + (m.y - st.y) * (m.y - st.y));
      var h = (st.z > 0 && d <= 12); if (h !== starHover) { starHover = h; requestRender(); }
      return;
    }
    if (drag.mode === 'view') {
      sphere.setThetaAndPhi(R2D * (drag.theta - (m.x - drag.x) / sphere._c.r),
                            R2D * (drag.phi + (m.y - drag.y) / sphere._c.r));
      onSphereOrientationChanged();
      requestRender();
    } else { // star drag: map screen -> RA/Dec
      var rd = sphere.screenToRaDec(m.x, m.y);
      if (rd) setStarLocation(rd.ra, rd.dec, false), requestRender();
    }
    ev.preventDefault();
  });
  function endDrag(ev) {
    if (drag) {
      if (drag.mode === 'view') announce(viewDescription());
      else announce(starDescription());
    }
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Focused canvas (the sphere): arrow keys rotate the view (Shift = larger steps).
  canvas.addEventListener('keydown', function (ev) {
    var step = ev.shiftKey ? 15 : 5, t = sphere.getTheta(), p = sphere.getPhi(), used = true;
    switch (ev.key) {
      case 'ArrowLeft':  sphere.setThetaAndPhi(t - step, p); break;
      case 'ArrowRight': sphere.setThetaAndPhi(t + step, p); break;
      case 'ArrowUp':    sphere.setThetaAndPhi(t, p + step); break;
      case 'ArrowDown':  sphere.setThetaAndPhi(t, p - step); break;
      default: used = false;
    }
    if (used) { ev.preventDefault(); onSphereOrientationChanged(); requestRender(); announce(viewDescription()); }
  });

  // Focused star marker (2nd Tab stop): arrow keys move the star (Shift = finer steps).
  if (starHandle) starHandle.addEventListener('keydown', function (ev) {
    var used = true, raStep = ev.shiftKey ? 0.1 : 0.5, decStep = ev.shiftKey ? 1 : 5, ra = state.ra, dec = state.dec;
    switch (ev.key) {
      case 'ArrowLeft':  ra = clampRa(ra - raStep); break;
      case 'ArrowRight': ra = clampRa(ra + raStep); break;
      case 'ArrowUp':    dec = clampDec(dec + decStep); break;
      case 'ArrowDown':  dec = clampDec(dec - decStep); break;
      case 'Enter': case ' ': ev.preventDefault(); return;  // no activation; avoid page scroll
      default: used = false;
    }
    if (used) { ev.preventDefault(); setStarLocation(ra, dec, false); requestRender(); announce(starDescription()); }
  });

  /* ============================ CONTROLS ================================== */
  var raRange = document.getElementById('ra-range'), decRange = document.getElementById('dec-range');
  var raField = document.getElementById('ra-field'), decField = document.getElementById('dec-field');
  var checks = {
    earthPoles: document.getElementById('cb-earthpoles'),
    equator: document.getElementById('cb-equator'),
    celPoles: document.getElementById('cb-celpoles'),
    celEquator: document.getElementById('cb-celequator'),
    zeroHours: document.getElementById('cb-zerohours'),
    ecliptic: document.getElementById('cb-ecliptic'),
    eastArrow: document.getElementById('cb-eastarrow')
  };

  function clampRa(v) { v = parseFloat(v); if (isNaN(v)) return state.ra; return Math.max(0, Math.min(24, v)); }
  function clampDec(v) { v = parseFloat(v); if (isNaN(v)) return state.dec; return Math.max(-90, Math.min(90, v)); }

  raRange.addEventListener('input', function () { setStarLocation(clampRa(raRange.value), state.dec, true); raField.value = asFixed(state.ra, 1); requestRender(); });
  decRange.addEventListener('input', function () { setStarLocation(state.ra, clampDec(decRange.value), true); decField.value = asFixed(state.dec, 1); requestRender(); });
  raRange.addEventListener('change', function () { announce(starDescription()); });
  decRange.addEventListener('change', function () { announce(starDescription()); });
  function commitField(field, isRa) {
    var v = isRa ? clampRa(field.value) : clampDec(field.value);
    if (isRa) setStarLocation(v, state.dec, false); else setStarLocation(state.ra, v, false);
    requestRender(); announce(starDescription());
  }
  raField.addEventListener('change', function () { commitField(raField, true); });
  decField.addEventListener('change', function () { commitField(decField, false); });

  // When a value field is focused, Up/Down arrows and the mouse wheel step the value
  // (Shift = larger step), like a native number stepper. Both drive the same state.
  function stepField(field, isRa, delta) {
    var cur = isRa ? clampRa(field.value) : clampDec(field.value);
    var v = isRa ? clampRa(cur + delta) : clampDec(cur + delta);
    if (isRa) setStarLocation(v, state.dec, false); else setStarLocation(state.ra, v, false);
    requestRender(); announce(starDescription());
  }
  function wireFieldStepping(field, isRa) {
    field.addEventListener('keydown', function (ev) {
      var dir = (ev.key === 'ArrowUp' || ev.key === 'PageUp') ? 1
              : (ev.key === 'ArrowDown' || ev.key === 'PageDown') ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      stepField(field, isRa, dir * (ev.shiftKey || ev.key === 'PageUp' || ev.key === 'PageDown' ? 1 : 0.1));
    });
    field.addEventListener('wheel', function (ev) {
      if (document.activeElement !== field) return;   // only when the field is selected
      ev.preventDefault();
      stepField(field, isRa, (ev.deltaY < 0 ? 1 : -1) * (ev.shiftKey ? 1 : 0.1));
    }, { passive: false });
  }
  wireFieldStepping(raField, true);
  wireFieldStepping(decField, false);

  for (var key in checks) (function (k) {
    checks[k].addEventListener('change', function () {
      state.labels[k] = checks[k].checked; updateLabelsVisibility(); requestRender();
      announce(checks[k].checked ? labelName(k) + ' labels shown.' : labelName(k) + ' labels hidden.');
    });
  })(key);

  document.getElementById('btn-showall').addEventListener('click', function () { setAll(true); });
  document.getElementById('btn-hideall').addEventListener('click', function () { setAll(false); });
  function setAll(v) {
    for (var k in state.labels) state.labels[k] = v;
    syncCheckboxes(); updateLabelsVisibility(); requestRender();
    announce(v ? 'All labels shown.' : 'All labels hidden.');
  }
  function syncCheckboxes() { for (var k in checks) checks[k].checked = state.labels[k]; }

  function labelName(k) {
    return { earthPoles: 'North and South Pole', equator: 'Equator', celPoles: 'North and South Celestial Pole',
      celEquator: 'Celestial Equator', zeroHours: 'Zero-hour circle', ecliptic: 'Ecliptic', eastArrow: 'East arrow' }[k];
  }

  // reset comes from the shared masthead component
  document.addEventListener('sim-reset', reset);

  /* ===================== MathJax readouts + a11y text ==================== */
  function syncReadouts() {
    var decSign = state.dec >= 0 ? '+' : '';
    if (window.klunlShowEquation) {
      // Dynamic star coordinate readout (RA / dec with units) -- typeset by MathJax,
      // paired with a spoken, units-complete description for screen readers.
      klunlShowEquation(
        ['star-eqn', '\\(\\mathrm{RA} = ' + asFixed(state.ra, 1) + '^{\\mathrm{h}}, \\quad \\mathrm{dec} = ' + decSign + asFixed(state.dec, 1) + '^{\\circ}\\)'],
        ['star-eqn-sr', 'Star position: right ascension ' + spokenNum(state.ra, 1) + ' hours, declination ' + spokenNum(state.dec, 1) + ' degrees.']);
    }
    // The slider's spoken value (name comes from aria-label; this carries value + unit).
    raRange.setAttribute('aria-valuetext', spokenNum(state.ra, 1) + ' hours');
    decRange.setAttribute('aria-valuetext', spokenNum(state.dec, 1) + ' degrees');
    // The focusable star marker announces the current position + how to move it.
    if (starHandle) starHandle.setAttribute('aria-label',
      'Star at right ascension ' + spokenNum(state.ra, 1) + ' hours, declination ' + spokenNum(state.dec, 1) +
      ' degrees. Use the arrow keys to move it: left and right change right ascension, up and down change declination.');
  }

  function starDescription() {
    return 'Star at right ascension ' + spokenNum(state.ra, 1) + ' hours, declination ' + spokenNum(state.dec, 1) + ' degrees.';
  }
  function viewDescription() {
    return 'View rotated. Azimuth ' + spokenNum(mod(sphere.getTheta(), 360), 0) + ' degrees, tilt ' + spokenNum(sphere.getPhi(), 0) + ' degrees. ' + starDescription();
  }
  // Full, units-complete description of what the canvas currently depicts. Reached by
  // screen readers via the canvas's aria-describedby; updated silently from state.
  function describeScene() {
    var shown = [];
    if (state.labels.earthPoles) shown.push('Earth poles');
    if (state.labels.equator) shown.push('equator');
    if (state.labels.celPoles) shown.push('celestial poles');
    if (state.labels.celEquator) shown.push('celestial equator');
    if (state.labels.zeroHours) shown.push('zero-hour circle');
    if (state.labels.ecliptic) shown.push('ecliptic');
    if (state.labels.eastArrow) shown.push('east arrow');
    return 'Celestial sphere with the Earth at its centre, viewed at azimuth ' +
      spokenNum(mod(sphere.getTheta(), 360), 0) + ' degrees and tilt ' + spokenNum(sphere.getPhi(), 0) +
      ' degrees. A star is plotted at right ascension ' + spokenNum(state.ra, 1) + ' hours, declination ' +
      spokenNum(state.dec, 1) + ' degrees, with its right ascension and declination shown as coloured arcs. ' +
      (shown.length ? 'Labels shown: ' + shown.join(', ') + '.' : 'No labels shown.') +
      ' Arrow keys rotate this view; Tab to the star marker to move the star with the arrow keys instead.';
  }
  var live = document.getElementById('sr-status');
  var skyDesc = document.getElementById('sky-desc');
  function announce(msg) { if (live) live.textContent = msg; if (skyDesc) skyDesc.textContent = describeScene(); }

  // klunlInitEqn is called by the foundation on load; redefine to set up our math
  // (dynamic readouts + a one-time typeset of the static inline math in the page).
  window.klunlInitEqn = function () {
    syncReadouts();
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise().catch(function (e) { console.error(e); });
    }
  };

  /* ============================ STARTUP ================================== */
  // Keep the one MathJax equation out of the Tab order. MathJax marks its rendered
  // containers tabbable (for its keyboard menu); we force tabindex="-1" so Tab skips
  // it. Right-click still opens the MathJax menu. A MutationObserver re-applies this
  // every time the equation is re-typeset (it updates as the star moves).
  (function () {
    var el = document.getElementById('star-eqn');
    if (!el) return;
    function strip() {
      var cs = el.querySelectorAll('mjx-container[tabindex]:not([tabindex="-1"])');
      for (var i = 0; i < cs.length; i++) cs[i].setAttribute('tabindex', '-1');
    }
    if (window.MutationObserver) {
      new MutationObserver(strip).observe(el, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex']
      });
    }
    strip();
  })();

  window.addEventListener('resize', fitCanvas);
  // Re-render once the vendored font has loaded so canvas labels use it.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRender);
  fitCanvas();
  reset();
  // Typeset once MathJax is ready (it loads asynchronously after this script).
  if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
    MathJax.startup.promise.then(function () { window.klunlInitEqn(); });
  } else {
    syncReadouts();
  }

})();
