//#region src/model.ts
var e = Object.freeze({
	hue: 0,
	saturation: .5,
	lightness: 50,
	sourceMix: 50,
	opacity: 0
}), t = (e) => e < 0 ? 0 : e > 1 ? 1 : e;
function n(e, t, n) {
	return n < 1 ? e + (t - e) * n : n < 3 ? t : n < 4 ? e + (t - e) * (4 - n) : e;
}
function r(e, t, r) {
	if (t <= 0) return [
		r,
		r,
		r
	];
	let i = r < .5 ? r * (1 + t) : r + t - r * t, a = 2 * r - i, o = e * 6;
	return [
		n(a, i, o < 4 ? o + 2 : o - 4),
		n(a, i, o),
		n(a, i, o > 2 ? o - 2 : o + 4)
	];
}
var i = 152587890625e-16;
function a([e, t, n]) {
	let r = Math.max(e, t, n), a = Math.min(e, t, n), o = r - a, s = (a + r) / 2;
	if (o === 0) return {
		h: 0,
		s: 0,
		l: s
	};
	let c = s < .5 ? o / Math.max(r + a, i) : o / Math.max(2 - r - a, i), l = r === e ? (t - n) / o : r === t ? 2 + (n - e) / o : 4 + (e - t) / o;
	return l /= 6, l < 0 ? l += 1 : l > 1 && --l, {
		h: l,
		s: c,
		l: s
	};
}
function o(e) {
	let n = t(e);
	return n < .0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - .055;
}
var s = [
	.9642,
	1,
	.8249
], c = [
	.4360747,
	.3850649,
	.1430804,
	.2225045,
	.7168786,
	.0606169,
	.0139322,
	.0971045,
	.7141733
];
function l(e) {
	let [t, n, r, i, a, o, s, c, l] = e, u = a * l - o * c, d = -(i * l - o * s), f = i * c - a * s, p = t * u + n * d + r * f;
	return [
		u / p,
		-(n * l - r * c) / p,
		(n * o - r * a) / p,
		d / p,
		(t * l - r * s) / p,
		-(t * o - r * i) / p,
		f / p,
		-(t * c - n * s) / p,
		(t * a - n * i) / p
	];
}
var u = l(c), d = 216 / 24389, f = 24389 / 27, p = Math.cbrt(d), m = "colorise", h = `${m}.lab`, g = [
	"hue",
	"saturation",
	"lightness",
	"sourceMix",
	"opacity"
], _ = (e) => `${h}.${e}`;
function v(e) {
	let t = {};
	for (let n of g) t[_(n)] = e[n];
	return t;
}
function y(t) {
	let n = { ...e };
	for (let e of g) {
		let r = t[_(e)];
		typeof r == "number" && Number.isFinite(r) && (n[e] = r);
	}
	return n;
}
var b = () => v(e), x = null;
function S(e) {
	x = e;
}
function C() {
	if (!x) throw Error("[colorise] api() called before activate()");
	return x;
}
function w(e, t, ...n) {
	return C().react.createElement(e, t, ...n);
}
//#endregion
//#region src/Panel.ts
var T = "linear-gradient(to right, rgb(255,0,0) 0%, rgb(255,255,0) 16.6%, rgb(0,255,0) 32.2%, rgb(0,255,255) 49.8%, rgb(0,0,255) 66.4%, rgb(255,0,255) 83%, rgb(255,0,0) 100%)", E = (e) => `rgb(${e.map((e) => Math.round(e * 255)).join(",")})`;
function D(e) {
	return `linear-gradient(to right, rgb(51,51,51), ${E(r(e, 1, .5))})`;
}
function O(e, t, n) {
	let [i, a, s] = r(e / 360, t / 100, n / 100);
	return [
		o(i),
		o(a),
		o(s)
	];
}
function k(e) {
	let { h: t, s: n } = a(e);
	return {
		hue: t * 360,
		saturation: n * 100,
		lightness: 50
	};
}
var A = { paramBag: { [_("opacity")]: 0 } };
function j() {
	let { Slider: e } = C().components, { ColourField: t, Stack: n } = C().ui, r = C().develop.useParamScope(), i = y(r.getParams()), a = () => y(r.getParams()), o = (e) => r.setParams(v(e)), s = (e) => r.commit(`Colorise ${e}`), c = (t, n, r, i, c, l) => w(e, {
		key: t,
		label: t,
		value: n,
		min: 0,
		max: r,
		step: 1,
		defaultValue: i,
		trackBackground: l,
		onChange: (e) => o(c(a(), e)),
		onCommit: () => s(t.toLowerCase())
	}), l = c("Hue", Math.round(i.hue * 360), 360, 0, (e, t) => ({
		...e,
		hue: t / 360
	}), T);
	return w(n, {
		gap: 2,
		style: { padding: 8 }
	}, w(t, {
		label: "Colour",
		hue: Math.round(i.hue * 360),
		saturation: Math.round(i.saturation * 100),
		toRgb: (e, t) => O(e, t, a().lightness),
		fromRgb: k,
		pick: A,
		title: "The tint's hue and saturation; the eyedropper takes them from the photo",
		onChange: ({ hue: e, saturation: t }) => o({
			...a(),
			hue: e / 360,
			...t === void 0 ? {} : { saturation: t / 100 }
		}),
		onCommit: () => s("hue")
	}), l, c("Saturation", Math.round(i.saturation * 100), 100, 50, (e, t) => ({
		...e,
		saturation: t / 100
	}), D(i.hue)), c("Lightness", i.lightness, 100, 50, (e, t) => ({
		...e,
		lightness: t
	})), c("Source mix", i.sourceMix, 100, 50, (e, t) => ({
		...e,
		sourceMix: t
	})), c("Opacity", i.opacity, 100, 0, (e, t) => ({
		...e,
		opacity: t
	})));
}
//#endregion
//#region src/stage.ts
function M(e) {
	let t = e.toPrecision(10);
	return t.includes("e") ? e.toFixed(12) : t;
}
function N(e) {
	return `mat3(${[
		0,
		3,
		6,
		1,
		4,
		7,
		2,
		5,
		8
	].map((t) => M(e[t])).join(", ")})`;
}
var P = M(d), F = M(p), I = M(f), L = `vec3(${s.map(M).join(", ")})`, R = `
#if SL_PROCESS_VERSION >= 2
vec3 czDecode(vec3 y) {
  vec3 a = abs(y);
  return sign(y) * mix(a / 12.92, pow((a + 0.055) / 1.055, vec3(2.4)), step(0.04045, a));
}
vec3 czEncode(vec3 x) {
  vec3 a = abs(x);
  return sign(x) * mix(a * 12.92, 1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, a));
}
#endif
float czF(float t) {
  return t > ${P} ? pow(t, 1.0 / 3.0) : (${I} * t + 16.0) / 116.0;
}
float czFInv(float f) {
  return f > ${F} ? f * f * f : (116.0 * f - 16.0) / ${I};
}
vec3 czLab(vec3 rgb) {
  const mat3 toXyz = ${N(c)};
  vec3 r = (toXyz * rgb) / ${L};
  vec3 f = vec3(czF(r.x), czF(r.y), czF(r.z));
  return vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
}
vec3 czRgb(vec3 lab) {
  const mat3 toRgb = ${N(u)};
  float fy = (lab.x + 16.0) / 116.0;
  float fx = lab.y / 500.0 + fy;
  float fz = fy - lab.z / 200.0;
  return toRgb * (vec3(czFInv(fx), czFInv(fy), czFInv(fz)) * ${L});
}
float czHue2Rgb(float m1, float m2, float angle) {
  if (angle < 1.0) return m1 + (m2 - m1) * angle;
  if (angle < 3.0) return m2;
  return angle < 4.0 ? m1 + (m2 - m1) * (4.0 - angle) : m1;
}
vec3 czHsl2Rgb(float h, float s, float l) {
  if (s <= 0.0) return vec3(l);
  float m2 = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float m1 = 2.0 * l - m2;
  float angle = h * 6.0;
  return vec3(
    czHue2Rgb(m1, m2, angle < 4.0 ? angle + 2.0 : angle - 4.0),
    czHue2Rgb(m1, m2, angle),
    czHue2Rgb(m1, m2, angle > 2.0 ? angle - 2.0 : angle + 4.0));
}
`, z = "\n{\n  if (opacity > 0.0) {\n#if SL_PROCESS_VERSION >= 2\n    vec3 lab = czLab(czDecode(c));\n#else\n    vec3 lab = czLab(srgbToLinear(clamp(c, 0.0, 1.0)));\n#endif\n    vec3 tint = czLab(czHsl2Rgb(hue, saturation, lightness * 0.01));\n    vec3 coloured = vec3(tint.x - sourceMix * 0.5 + lab.x * sourceMix * 0.01, tint.y, tint.z);\n#if SL_PROCESS_VERSION >= 2\n    c = czEncode(czRgb(mix(lab, coloured, opacity * 0.01)));\n#else\n    c = linearToSrgb(czRgb(mix(lab, coloured, opacity * 0.01)));\n#endif\n  }\n}\n", B = {
	hue: {
		min: 0,
		max: 1,
		step: .001
	},
	saturation: {
		min: 0,
		max: 1,
		step: .01
	},
	lightness: {
		min: 0,
		max: 100,
		step: 1
	},
	sourceMix: {
		min: 0,
		max: 100,
		step: 1
	},
	opacity: {
		min: 0,
		max: 100,
		step: 1
	}
}, V = {
	hue: "hue",
	saturation: "saturation",
	lightness: "lightness",
	sourceMix: "source mix",
	opacity: "opacity"
}, H = g.map((t) => ({
	key: t,
	glslType: "float",
	default: e[t],
	range: B[t],
	label: V[t]
}));
function U() {
	return {
		id: h,
		name: "Colorise",
		phase: "display-adjust",
		space: { encoding: "perceptual" },
		glsl: z,
		helpers: R,
		uniforms: H,
		presetScope: "global",
		mask: { maskable: !0 },
		after: [
			"colour-correction.lab",
			"saturation-curve.lab",
			"colour-zones.lab"
		]
	};
}
//#endregion
//#region src/index.ts
var W = `${m}.panel`, G = null;
function K() {
	let e = C().stores.useDevelopStore.getState();
	e.setDynParams(b()), e.commitEdit("Colorise reset");
}
function q(e) {
	S(e), G = e, e.registerProcessingStage(U()), e.registerPanel({
		id: W,
		title: "Colorise",
		component: j,
		defaultDock: {
			module: "develop",
			direction: "right",
			order: 7,
			width: 268
		},
		onReset: K,
		mask: {
			component: j,
			owns: g.map(_)
		}
	});
}
function J() {
	let e = G;
	if (e) {
		G = null;
		try {
			e.unregisterProcessingStage(h);
		} catch (e) {
			console.warn("[colorise] deactivate failed:", e);
		}
	}
}
//#endregion
export { q as activate, J as deactivate };

//# sourceMappingURL=index.js.map