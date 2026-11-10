//#region src/model.ts
var e = Object.freeze({
	hue: 0,
	saturation: .5,
	lightness: 50,
	sourceMix: 50,
	opacity: 0
});
function t(e, t, n) {
	return n < 1 ? e + (t - e) * n : n < 3 ? t : n < 4 ? e + (t - e) * (4 - n) : e;
}
function n(e, n, r) {
	if (n <= 0) return [
		r,
		r,
		r
	];
	let i = r < .5 ? r * (1 + n) : r + n - r * n, a = 2 * r - i, o = e * 6;
	return [
		t(a, i, o < 4 ? o + 2 : o - 4),
		t(a, i, o),
		t(a, i, o > 2 ? o - 2 : o + 4)
	];
}
var r = 152587890625e-16;
function i([e, t, n]) {
	let i = Math.max(e, t, n), a = Math.min(e, t, n), o = i - a, s = (a + i) / 2;
	if (o === 0) return {
		h: 0,
		s: 0,
		l: s
	};
	let c = s < .5 ? o / Math.max(i + a, r) : o / Math.max(2 - i - a, r), l = i === e ? (t - n) / o : i === t ? 2 + (n - e) / o : 4 + (e - t) / o;
	return l /= 6, l < 0 ? l += 1 : l > 1 && --l, {
		h: l,
		s: c,
		l: s
	};
}
var a = [
	.9642,
	1,
	.8249
], o = [
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
function s(e) {
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
var c = s(o), l = 216 / 24389, u = 24389 / 27, d = Math.cbrt(l), f = "colorise", p = `${f}.lab`, m = [
	"hue",
	"saturation",
	"lightness",
	"sourceMix",
	"opacity"
], h = (e) => `${p}.${e}`;
function g(e) {
	let t = {};
	for (let n of m) t[h(n)] = e[n];
	return t;
}
function _(t) {
	let n = { ...e };
	for (let e of m) {
		let r = t[h(e)];
		typeof r == "number" && Number.isFinite(r) && (n[e] = r);
	}
	return n;
}
var ee = () => g(e), v = null;
function y(e) {
	v = e;
}
function b() {
	if (!v) throw Error("[colorise] api() called before activate()");
	return v;
}
function x(e, t, ...n) {
	return b().react.createElement(e, t, ...n);
}
//#endregion
//#region src/store.ts
var S = null;
function C() {
	S = b().stores.create((e) => ({
		picking: !1,
		setPicking: (t) => e({ picking: t })
	}));
}
function w() {
	if (!S) throw Error("[colorise] store() called before activate()");
	return S;
}
//#endregion
//#region src/Panel.ts
var T = "linear-gradient(to right, rgb(255,0,0) 0%, rgb(255,255,0) 16.6%, rgb(0,255,0) 32.2%, rgb(0,255,255) 49.8%, rgb(0,0,255) 66.4%, rgb(255,0,255) 83%, rgb(255,0,0) 100%)", E = (e) => `rgb(${e.map((e) => Math.round(e * 255)).join(",")})`;
function D(e) {
	return `linear-gradient(to right, rgb(51,51,51), ${E(n(e, 1, .5))})`;
}
var O = "Pick hue from the image";
function k() {
	let { Slider: e } = b().components, { Button: t, Row: n, Stack: r } = b().ui, { useEffect: i } = b().react, a = b().develop.useParamScope(), o = a.maskId !== null, s = w()((e) => e.picking), c = b().develop.usePickDragHeld();
	i(() => {
		!o && s && !c && w().getState().setPicking(!1);
	}, [
		o,
		s,
		c
	]);
	let l = _(a.getParams()), u = () => _(a.getParams()), d = (e) => a.setParams(g(e)), f = (e) => a.commit(`Colorise ${e}`), p = (t, n, r, i, a, o) => x(e, {
		key: t,
		label: t,
		value: n,
		min: 0,
		max: r,
		step: 1,
		defaultValue: i,
		trackBackground: o,
		onChange: (e) => d(a(u(), e)),
		onCommit: () => f(t.toLowerCase())
	}), m = p("Hue", Math.round(l.hue * 360), 360, 0, (e, t) => ({
		...e,
		hue: t / 360
	}), T), h = o ? null : x(t, {
		size: "sm",
		active: s,
		"aria-pressed": s,
		title: "Pick the hue and saturation from the image (Esc cancels)",
		"aria-label": O,
		onClick: () => w().getState().setPicking(!s)
	}, "Pick");
	return x(r, {
		gap: 2,
		style: { padding: 8 }
	}, x(n, {
		gap: 4,
		align: "center"
	}, x("div", { style: {
		flex: "1 1 auto",
		minWidth: 0
	} }, m), h), p("Saturation", Math.round(l.saturation * 100), 100, 50, (e, t) => ({
		...e,
		saturation: t / 100
	}), D(l.hue)), p("Lightness", l.lightness, 100, 50, (e, t) => ({
		...e,
		lightness: t
	})), p("Source mix", l.sourceMix, 100, 50, (e, t) => ({
		...e,
		sourceMix: t
	})), p("Opacity", l.opacity, 100, 0, (e, t) => ({
		...e,
		opacity: t
	})));
}
//#endregion
//#region src/picker.ts
function A(e, t, n) {
	if (t < 2 || n < 2) return null;
	let r = e.x / t, i = e.y / n;
	return r < 0 || r > 1 || i < 0 || i > 1 ? null : {
		x: r,
		y: i
	};
}
function j(e, t, n, r, i) {
	let a = [
		0,
		0,
		0
	], o = 0;
	for (let s = Math.max(0, i - 2); s <= Math.min(n - 1, i + 2); s++) for (let n = Math.max(0, r - 2); n <= Math.min(t - 1, r + 2); n++) {
		let r = (s * t + n) * 4;
		for (let t = 0; t < 3; t++) a[t] += e[r + t] / 255;
		o++;
	}
	return o === 0 ? null : [
		a[0] / o,
		a[1] / o,
		a[2] / o
	];
}
function M() {
	let e = b(), t = e.stores.useDevelopStore.getState();
	return e.develop.captureFrame(t.previewParams ?? t.params, { paramBag: { [h("opacity")]: 0 } });
}
function N(e) {
	let t = b().stores.useDevelopStore.getState(), { h: n, s: r } = i(e);
	t.setDynParams(g({
		..._(t.paramBag),
		hue: n,
		saturation: r
	})), t.commitEdit("Colorise pick"), w().getState().setPicking(!1);
}
function P(e) {
	return w().getState().picking && b().stores.useDevelopStore.getState().photoId === e;
}
function F(e, t) {
	try {
		let { width: n, height: r } = e, i = A(t, n, r);
		if (!i) return null;
		let a = Math.min(n - 1, Math.floor(i.x * n)), o = Math.min(r - 1, Math.floor(i.y * r)), s = Math.max(0, a - 2), c = Math.max(0, o - 2), l = Math.min(n - 1, a + 2) - s + 1, u = Math.min(r - 1, o + 2) - c + 1, d = new OffscreenCanvas(l, u).getContext("2d", { willReadFrequently: !0 });
		return d ? (d.drawImage(e, s, c, l, u, 0, 0, l, u), {
			data: d.getImageData(0, 0, l, u).data,
			width: l,
			height: u,
			cx: a - s,
			cy: o - c
		}) : null;
	} finally {
		e.close();
	}
}
async function I(e) {
	try {
		let t = b().stores.useDevelopStore.getState().photoId, n = F(await M(), e);
		if (!n || !P(t)) return;
		let r = j(n.data, n.width, n.height, n.cx, n.cy);
		r && N(r);
	} catch (e) {
		console.warn("[colorise] pick failed:", e);
	}
}
var L = { onPress: (e) => void I(e) };
function R() {
	return w().subscribe((e, t) => {
		e.picking !== t.picking && b().develop.setPickDrag(e.picking ? L : null);
	});
}
//#endregion
//#region src/stage.ts
function z(e) {
	let t = e.toPrecision(10);
	return t.includes("e") ? e.toFixed(12) : t;
}
function B(e) {
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
	].map((t) => z(e[t])).join(", ")})`;
}
var V = z(l), H = z(d), U = z(u), W = `vec3(${a.map(z).join(", ")})`, G = `
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
  return t > ${V} ? pow(t, 1.0 / 3.0) : (${U} * t + 16.0) / 116.0;
}
float czFInv(float f) {
  return f > ${H} ? f * f * f : (116.0 * f - 16.0) / ${U};
}
vec3 czLab(vec3 rgb) {
  const mat3 toXyz = ${B(o)};
  vec3 r = (toXyz * rgb) / ${W};
  vec3 f = vec3(czF(r.x), czF(r.y), czF(r.z));
  return vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
}
vec3 czRgb(vec3 lab) {
  const mat3 toRgb = ${B(c)};
  float fy = (lab.x + 16.0) / 116.0;
  float fx = lab.y / 500.0 + fy;
  float fz = fy - lab.z / 200.0;
  return toRgb * (vec3(czFInv(fx), czFInv(fy), czFInv(fz)) * ${W});
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
`, K = "\n{\n  if (opacity > 0.0) {\n#if SL_PROCESS_VERSION >= 2\n    vec3 lab = czLab(czDecode(c));\n#else\n    vec3 lab = czLab(srgbToLinear(clamp(c, 0.0, 1.0)));\n#endif\n    vec3 tint = czLab(czHsl2Rgb(hue, saturation, lightness * 0.01));\n    vec3 coloured = vec3(tint.x - sourceMix * 0.5 + lab.x * sourceMix * 0.01, tint.y, tint.z);\n#if SL_PROCESS_VERSION >= 2\n    c = czEncode(czRgb(mix(lab, coloured, opacity * 0.01)));\n#else\n    c = linearToSrgb(czRgb(mix(lab, coloured, opacity * 0.01)));\n#endif\n  }\n}\n", q = {
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
}, J = {
	hue: "hue",
	saturation: "saturation",
	lightness: "lightness",
	sourceMix: "source mix",
	opacity: "opacity"
}, Y = m.map((t) => ({
	key: t,
	glslType: "float",
	default: e[t],
	range: q[t],
	label: J[t]
}));
function X() {
	return {
		id: p,
		name: "Colorise",
		phase: "display-adjust",
		space: { encoding: "perceptual" },
		glsl: K,
		helpers: G,
		uniforms: Y,
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
var Z = `${f}.panel`, Q = null, $ = null;
function te() {
	let e = b().stores.useDevelopStore.getState();
	e.setDynParams(ee()), e.commitEdit("Colorise reset");
}
function ne(e) {
	y(e), C(), Q = e, e.registerProcessingStage(X()), e.registerPanel({
		id: Z,
		title: "Colorise",
		component: k,
		defaultDock: {
			module: "develop",
			direction: "right",
			order: 7,
			width: 268
		},
		onReset: te,
		mask: {
			component: k,
			owns: m.map(h)
		}
	}), $ = R();
}
function re() {
	let e = Q;
	if (e) {
		Q = null;
		try {
			w().getState().setPicking(!1), $?.(), $ = null, e.develop.setPickDrag(null), e.unregisterProcessingStage(p);
		} catch (e) {
			console.warn("[colorise] deactivate failed:", e);
		}
	}
}
//#endregion
export { ne as activate, re as deactivate };

//# sourceMappingURL=index.js.map