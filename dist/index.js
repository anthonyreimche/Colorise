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
var v = () => g(e), y = null;
function b(e) {
	y = e;
}
function x() {
	if (!y) throw Error("[colorise] api() called before activate()");
	return y;
}
function S(e, t, ...n) {
	return x().react.createElement(e, t, ...n);
}
//#endregion
//#region src/store.ts
var C = null;
function w() {
	C = x().stores.create((e) => ({
		picking: !1,
		setPicking: (t) => e({ picking: t })
	}));
}
function T() {
	if (!C) throw Error("[colorise] store() called before activate()");
	return C;
}
//#endregion
//#region src/Panel.ts
var E = "linear-gradient(to right, rgb(255,0,0) 0%, rgb(255,255,0) 16.6%, rgb(0,255,0) 32.2%, rgb(0,255,255) 49.8%, rgb(0,0,255) 66.4%, rgb(255,0,255) 83%, rgb(255,0,0) 100%)", D = (e) => `rgb(${e.map((e) => Math.round(e * 255)).join(",")})`;
function O(e) {
	return `linear-gradient(to right, rgb(51,51,51), ${D(n(e, 1, .5))})`;
}
var k = "Pick hue from the image";
function A() {
	let { Slider: e } = x().components, { Button: t, Row: n, Stack: r } = x().ui, i = x().develop.useParamScope(), a = i.maskId !== null, o = T()((e) => e.picking), s = _(i.getParams()), c = () => _(i.getParams()), l = (e) => i.setParams(g(e)), u = (e) => i.commit(`Colorise ${e}`), d = (t, n, r, i, a, o) => S(e, {
		key: t,
		label: t,
		value: n,
		min: 0,
		max: r,
		step: 1,
		defaultValue: i,
		trackBackground: o,
		onChange: (e) => l(a(c(), e)),
		onCommit: () => u(t.toLowerCase())
	}), f = d("Hue", Math.round(s.hue * 360), 360, 0, (e, t) => ({
		...e,
		hue: t / 360
	}), E), p = a ? null : S(t, {
		size: "sm",
		active: o,
		"aria-pressed": o,
		title: "Pick the hue and saturation from the image (Esc cancels)",
		"aria-label": k,
		onClick: () => T().getState().setPicking(!o)
	}, "Pick");
	return S(r, {
		gap: 2,
		style: { padding: 8 }
	}, S(n, {
		gap: 4,
		align: "center"
	}, S("div", { style: {
		flex: "1 1 auto",
		minWidth: 0
	} }, f), p), d("Saturation", Math.round(s.saturation * 100), 100, 50, (e, t) => ({
		...e,
		saturation: t / 100
	}), O(s.hue)), d("Lightness", s.lightness, 100, 50, (e, t) => ({
		...e,
		lightness: t
	})), d("Source mix", s.sourceMix, 100, 50, (e, t) => ({
		...e,
		sourceMix: t
	})), d("Opacity", s.opacity, 100, 0, (e, t) => ({
		...e,
		opacity: t
	})));
}
//#endregion
//#region src/picker.ts
function j(e, t, n, r, i) {
	if (!i || n.width <= 0 || n.height <= 0 || i.w <= 0 || i.h <= 0) return null;
	let a = r / n.width, o = ((e - n.left) * a - i.x) / i.w, s = ((t - n.top) * a - i.y) / i.h;
	return o < 0 || o > 1 || s < 0 || s > 1 ? null : {
		x: o,
		y: s
	};
}
function M(e, t, n, r, i) {
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
function N() {
	let e = x(), t = e.stores.useDevelopStore.getState();
	return e.develop.captureFrame(t.previewParams ?? t.params, { paramBag: { [h("opacity")]: 0 } });
}
function P(e) {
	let t = x().stores.useDevelopStore.getState(), { h: n, s: r } = i(e);
	t.setDynParams(g({
		..._(t.paramBag),
		hue: n,
		saturation: r
	})), t.commitEdit("Colorise pick"), T().getState().setPicking(!1);
}
function F(e) {
	return T().getState().picking && x().stores.useDevelopStore.getState().photoId === e;
}
function I(e, t) {
	try {
		let { width: n, height: r } = e;
		if (n < 2 || r < 2) return null;
		let i = Math.min(n - 1, Math.floor(t.x * n)), a = Math.min(r - 1, Math.floor(t.y * r)), o = Math.max(0, i - 2), s = Math.max(0, a - 2), c = Math.min(n - 1, i + 2) - o + 1, l = Math.min(r - 1, a + 2) - s + 1, u = new OffscreenCanvas(c, l).getContext("2d", { willReadFrequently: !0 });
		return u ? (u.drawImage(e, o, s, c, l, 0, 0, c, l), {
			data: u.getImageData(0, 0, c, l).data,
			width: c,
			height: l,
			cx: i - o,
			cy: a - s
		}) : null;
	} finally {
		e.close();
	}
}
async function L(e, t, n, r) {
	try {
		if (!n) return;
		let i = x().stores.useDevelopStore.getState().photoId, a = j(e, t, n.getBoundingClientRect(), n.clientWidth, r);
		if (!a) return;
		let o = I(await N(), a);
		if (!o || !F(i)) return;
		let s = M(o.data, o.width, o.height, o.cx, o.cy);
		s && P(s);
	} catch (e) {
		console.warn("[colorise] pick failed:", e);
	}
}
function R() {
	let { useEffect: e, useRef: t } = x().react, n = T()((e) => e.picking), r = x().stores.useDevelopStore((e) => e.cropping), i = x().stores.useDevelopStore((e) => e.activeTool), a = x().stores.useDevelopStore((e) => e.wbPicking), o = x().stores.useDevelopStore((e) => e.hslPicking), s = x().develop.useDevelopOverlay(), c = t(null);
	return e(() => {
		if (!n) return;
		let e = (e) => {
			e.key === "Escape" && T().getState().setPicking(!1);
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [n]), !n || r || i !== "none" || a || o ? null : S("div", {
		ref: c,
		style: {
			position: "absolute",
			inset: 0,
			pointerEvents: "auto",
			cursor: x().cursors.resolve("pick")
		},
		onPointerDown: (e) => {
			e.button !== 0 || e.ctrlKey || e.metaKey || (e.preventDefault(), L(e.clientX, e.clientY, c.current, s.rect));
		}
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
`, K = "\n{\n  if (opacity > 0.0) {\n    vec3 lab = czLab(srgbToLinear(clamp(c, 0.0, 1.0)));\n    vec3 tint = czLab(czHsl2Rgb(hue, saturation, lightness * 0.01));\n    vec3 coloured = vec3(tint.x - sourceMix * 0.5 + lab.x * sourceMix * 0.01, tint.y, tint.z);\n    c = linearToSrgb(czRgb(mix(lab, coloured, opacity * 0.01)));\n  }\n}\n", q = {
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
		after: ["colour-correction.lab"]
	};
}
//#endregion
//#region src/index.ts
var Z = `${f}.panel`, Q = `${f}.picker`, $ = null;
function ee() {
	let e = x().stores.useDevelopStore.getState();
	e.setDynParams(v()), e.commitEdit("Colorise reset");
}
function te(e) {
	b(e), w(), $ = e, e.registerProcessingStage(X()), e.registerPanel({
		id: Z,
		title: "Colorise",
		component: A,
		defaultDock: {
			module: "develop",
			direction: "right",
			order: 7,
			width: 268
		},
		onReset: ee,
		mask: {
			component: A,
			owns: m.map(h)
		}
	}), e.registerSlot({
		id: Q,
		slot: "develop-canvas-overlay",
		component: R,
		order: 60
	});
}
function ne() {
	let e = $;
	if (e) {
		$ = null;
		try {
			T().getState().setPicking(!1), e.unregisterProcessingStage(p), e.unregisterSlot(Q);
		} catch (e) {
			console.warn("[colorise] deactivate failed:", e);
		}
	}
}
//#endregion
export { te as activate, ne as deactivate };

//# sourceMappingURL=index.js.map