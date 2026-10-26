/* Shade Gen — 11-step scale in OKLCH: lightness follows Tailwind's curve, re-anchored so your colour lands exactly on one step. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  var LT = [0.971, 0.936, 0.885, 0.808, 0.707, 0.623, 0.546, 0.488, 0.424, 0.379, 0.282]; // Tailwind v4 lightness, averaged
  var CM = [0.10, 0.22, 0.42, 0.66, 0.88, 1, 1, 0.94, 0.82, 0.68, 0.50];                  // chroma envelope

  // ---------- colour science (Björn Ottosson's OKLab) ----------
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLin(x) { return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; }
  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbToHex(rgb) { return "#" + rgb.map(function (v) { return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"); }).join(""); }
  function hexToOklch(hex) {
    var c = hexToRgb(hex).map(toLin);
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
    var m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
    var s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    var H = Math.atan2(b, a) * 180 / Math.PI;
    return { l: L, c: Math.sqrt(a * a + b * b), h: H < 0 ? H + 360 : H };
  }
  function oklchToSrgb(L, C, H) {
    var hr = H * Math.PI / 180, a = C * Math.cos(hr), b = C * Math.sin(hr);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(fromLin);
  }
  function inGamut(rgb) { return rgb.every(function (v) { return v >= -1e-4 && v <= 1 + 1e-4; }); }
  function oklchToHex(L, C, H) {
    L = Math.min(1, Math.max(0, L));
    var rgb = oklchToSrgb(L, C, H);
    if (!inGamut(rgb)) {
      var lo = 0, hi = C;
      for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (inGamut(oklchToSrgb(L, mid, H))) lo = mid; else hi = mid; }
      rgb = oklchToSrgb(L, lo, H);
    }
    return rgbToHex(rgb.map(function (v) { return v * 255; }));
  }
  function lum(hex) { var c = hexToRgb(hex).map(toLin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function normHex(v) { var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v).trim()); if (!m) return null; var x = m[1]; if (x.length === 3) x = x.replace(/./g, "$&$&"); return "#" + x.toLowerCase(); }
  function lchCss(hex) { var o = hexToOklch(hex); return "oklch(" + (o.l * 100).toFixed(1) + "% " + o.c.toFixed(3) + " " + (o.c < 0.0005 ? 0 : o.h.toFixed(1)) + ")"; }

  // ---------- the scale ----------
  function closest(L) { var best = 0; LT.forEach(function (t, i) { if (Math.abs(t - L) < Math.abs(LT[best] - L)) best = i; }); return best; }
  function scale(base, opt) {
    opt = Object.assign({ anchor: "auto", hueShift: 0, sat: 100 }, opt);
    var o = hexToOklch(base), a = opt.anchor === "auto" ? closest(o.l) : STEPS.indexOf(+opt.anchor);
    var hue = o.c < 0.0005 ? 0 : o.h;
    return STEPS.map(function (step, i) {
      if (i === a) return { step: step, hex: base, base: true };
      // white end pinned at 1 above the anchor, black end pinned at 0 below it, so the curve bends through your colour
      var L = i < a ? 1 - (1 - LT[i]) * (1 - o.l) / (1 - LT[a]) : LT[i] * o.l / LT[a];
      var C = o.c * CM[i] / CM[a] * opt.sat / 100;
      return { step: step, hex: oklchToHex(L, C, hue + opt.hueShift * (a - i) / 10), base: false };
    });
  }
  function slug(n) { return String(n).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "brand"; }
  function exportText(kind, sc, name, val) {
    function v(x) { return val === "oklch" ? lchCss(x.hex) : x.hex; }
    if (kind === "tw3") return "// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        '" + name + "': {\n" +
      sc.map(function (x) { return "          " + x.step + ": '" + v(x) + "',"; }).join("\n") + "\n        },\n      },\n    },\n  },\n};\n";
    if (kind === "tw4") return "@theme {\n" + sc.map(function (x) { return "  --color-" + name + "-" + x.step + ": " + v(x) + ";"; }).join("\n") + "\n}\n";
    if (kind === "css") return ":root {\n" + sc.map(function (x) { return "  --" + name + "-" + x.step + ": " + v(x) + ";"; }).join("\n") + "\n}\n";
    if (kind === "scss") return sc.map(function (x) { return "$" + name + "-" + x.step + ": " + v(x) + ";"; }).join("\n") +
      "\n\n$" + name + ": (\n" + sc.map(function (x) { return "  " + x.step + ": $" + name + "-" + x.step; }).join(",\n") + "\n);\n";
    var o = {}; o[name] = {}; sc.forEach(function (x) { o[name][x.step] = v(x); });
    return JSON.stringify(o, null, 2) + "\n";
  }

  // ---------- UI ----------
  var st = Object.assign({ base: "#0e9f9a", name: "brand", anchor: "auto", hueShift: 0, sat: 100, fmt: "tw3", val: "hex" }, S3.store("sg.settings") || {});
  var cur = [];
  STEPS.forEach(function (s) { $("#anchor").appendChild(S3.h("option", { value: s, text: String(s) })); });
  function seg(el, key) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === st[key]));
      b.addEventListener("click", function () { st[key] = b.dataset.v; $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); update(); });
    });
  }
  function sync() {
    $("#pick").value = st.base; $("#hex").value = st.base; $("#name").value = st.name; $("#anchor").value = st.anchor;
    $("#hshift").value = st.hueShift; $("#sat").value = st.sat;
  }
  function update() {
    S3.store("sg.settings", st);
    cur = scale(st.base, st);
    $("#hsLbl").textContent = (st.hueShift > 0 ? "+" : "") + st.hueShift + "°"; $("#satLbl").textContent = st.sat + "%";
    var box = $("#scale"); box.innerHTML = "";
    cur.forEach(function (x) {
      var cw = contrast(x.hex, "#ffffff"), cb = contrast(x.hex, "#000000"), fg = cw >= cb ? "#ffffff" : "#111418";
      var b = S3.h("button", { "class": "sg-sw" + (x.base ? " base" : ""), role: "listitem", style: "background:" + x.hex + ";color:" + fg, title: "Copy " + x.hex + " (" + lchCss(x.hex) + ")" }, [
        S3.h("b", { text: String(x.step) }),
        S3.h("span", { "class": "mono", text: x.hex.toUpperCase() }),
        S3.h("small", { text: (cw >= cb ? "W " + cw.toFixed(1) : "B " + cb.toFixed(1)) + (x.base ? " · base" : "") })
      ]);
      b.addEventListener("click", function () { S3.copy(x.hex, st.name + "-" + x.step + " " + x.hex + " copied"); });
      box.appendChild(b);
    });
    var c = {}; cur.forEach(function (x) { c[x.step] = x.hex; });
    var ui = $("#ui");
    function set(k, css) { $$("[data-k=" + k + "]", ui).forEach(function (e) { e.style.cssText = css; }); }
    set("solid", "background:" + c[600] + ";color:#fff;border-color:" + c[600]);
    set("outline", "background:transparent;color:" + c[700] + ";border-color:" + c[300]);
    set("badge", "background:" + c[100] + ";color:" + c[800]);
    set("alert", "background:" + c[50] + ";border-color:" + c[200] + ";color:" + c[900]);
    set("dark", "background:" + c[950] + ";color:" + c[100]);
    $(".sg-link", ui).style.color = c[400];
    $("#out").textContent = exportText(st.fmt, cur, slug(st.name), st.val);
  }
  $("#pick").addEventListener("input", function () { st.base = this.value; $("#hex").value = this.value; update(); });
  $("#hex").addEventListener("input", function () { var v = normHex(this.value); if (v) { st.base = v; $("#pick").value = v; update(); } });
  $("#hex").addEventListener("change", function () { this.value = st.base; });
  $("#name").addEventListener("input", function () { st.name = this.value; update(); });
  $("#anchor").addEventListener("change", function () { st.anchor = this.value; update(); });
  $("#hshift").addEventListener("input", function () { st.hueShift = +this.value; update(); });
  $("#sat").addEventListener("input", function () { st.sat = +this.value; update(); });
  $("#random").addEventListener("click", function () {
    st.base = oklchToHex(0.5 + Math.random() * 0.2, 0.08 + Math.random() * 0.14, Math.random() * 360); sync(); update();
  });
  seg($("#fmt"), "fmt"); seg($("#val"), "val");
  var FILE = { tw3: "tailwind.colors.js", tw4: "theme.css", css: "colors.css", scss: "_colors.scss", json: "colors.json" };
  $("#copy").addEventListener("click", function () { S3.copy(exportText(st.fmt, cur, slug(st.name), st.val)); S3.done(); });
  $("#dl").addEventListener("click", function () { S3.download(exportText(st.fmt, cur, slug(st.name), st.val), FILE[st.fmt], "text/plain"); S3.done(); });
  sync(); update();

  window.S3_DEMO = function () { Object.assign(st, { base: "#3b82f6", name: "ocean", anchor: "auto", hueShift: 0, sat: 100, fmt: "tw4", val: "oklch" }); sync(); $$("#fmt button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === "tw4")); }); $$("#val button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === "oklch")); }); update(); };

  window.S3_SELFTEST = function () {
    function near(o, l, c, h) { return Math.abs(o.l - l) < 5e-4 && Math.abs(o.c - c) < 5e-4 && (h == null || Math.abs(o.h - h) < 0.05); }
    var ok = near(hexToOklch("#ff0000"), 0.62796, 0.25768, 29.234) && near(hexToOklch("#00ff00"), 0.86644, 0.29483, 142.495) &&
      near(hexToOklch("#0000ff"), 0.45201, 0.31321, 264.052) && near(hexToOklch("#ffffff"), 1, 0) &&
      oklchToHex(0.62796, 0.25768, 29.234) === "#ff0000" && lchCss("#000000") === "oklch(0.0% 0.000 0)";
    var s = scale("#3b82f6"), Ls = s.map(function (x) { return hexToOklch(x.hex).l; });
    ok = ok && s.length === 11 && s[5].hex === "#3b82f6" && s[5].base && s.every(function (x) { return /^#[0-9a-f]{6}$/.test(x.hex); });
    for (var i = 1; i < 11; i++) ok = ok && Ls[i] < Ls[i - 1];
    var H0 = hexToOklch("#3b82f6").h;
    ok = ok && s.every(function (x) { var o = hexToOklch(x.hex); return o.c < 0.03 || Math.abs(o.h - H0) < 3; });
    var g = scale("#6b7280"); ok = ok && g.every(function (x) { return hexToOklch(x.hex).c < 0.05; });
    var w = scale("#ffffff", { anchor: "50" }); ok = ok && w[0].hex === "#ffffff" && hexToOklch(w[10].hex).l < 0.35;
    var sh = scale("#3b82f6", { hueShift: 20 }); ok = ok && Math.abs(hexToOklch(sh[1].hex).h - H0) > 3 && sh[5].hex === "#3b82f6";
    var t = exportText("tw4", s, "brand", "hex"); ok = ok && t.indexOf("--color-brand-500: #3b82f6;") > 0 && slug(" My Brand! ") === "my-brand";
    ok = ok && JSON.parse(exportText("json", s, "x", "hex")).x["950"] === s[10].hex;
    return ok;
  };
})();
