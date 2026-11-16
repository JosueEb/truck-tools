import {
	AtsPlateDesign,
	AtsPlateState,
	AtsPlateTarget,
} from "@/types/fileEditTypes";

// Backgrounds and font atlases extracted from the game by
// scripts/license-plates/gen_license_plates_ats.py
const ASSETS_URL = "/license-plates-ats";

export const PLATE_WIDTH = 256;
export const PLATE_HEIGHT = 128;
export const MAX_PLATE_TEXT_LENGTH = 12;

// The plate markup positions text on a canvas about 200 units wide.
const MARKUP_UNIT = PLATE_WIDTH / 200;
const DEFAULT_TEXT_COLOR: [number, number, number] = [24, 24, 28];
const MAX_TEXT_WIDTH = PLATE_WIDTH * 0.9;

/** Plate types that fit each vehicle, best first */
export const TARGET_PLATE_TYPES: Record<AtsPlateTarget, string[]> = {
	truck: ["truck", "rigid", "truck_city", "bus"],
	trailer: ["trailer"],
	car: ["car"],
};

export const defaultDesign = (
	state: AtsPlateState,
	target: AtsPlateTarget
): AtsPlateDesign | undefined => {
	for (const type of TARGET_PLATE_TYPES[target]) {
		const design = state.designs.find((item) => item.type === type);
		if (design) return design;
	}
	return state.designs[0];
};

/** Keeps the characters the state's font can draw, uppercased */
export const sanitizePlateText = (text: string, chars: string) =>
	[...text.toUpperCase()]
		.filter((char) => chars.includes(char))
		.join("")
		.slice(0, MAX_PLATE_TEXT_LENGTH);

/** A plate number as the game would generate it for the design */
export const randomPlateText = (design: AtsPlateDesign) =>
	design.slots
		.map((options) => options[Math.floor(Math.random() * options.length)])
		.join("");

/** Pattern of the design, e.g. "ABC 1234": A = letter, 1 = digit, X = either */
export const plateTextPattern = (design: AtsPlateDesign) =>
	design.slots
		.map((options) => {
			if (options.length === 1) return options[0];
			const all = options.join("");
			if (/^[A-Z]+$/.test(all)) return "A".repeat(options[0].length);
			if (/^[0-9]+$/.test(all)) return "1".repeat(options[0].length);
			return "X".repeat(options[0].length);
		})
		.join("");

interface TextStyle {
	color: [number, number, number];
	xscale: number;
	yscale: number;
}

/** Color (game ABGR hex) and font scale the design markup gives the text */
const getTextStyle = (design: AtsPlateDesign): TextStyle => {
	const color = /<color value=([0-9a-fA-F]{8})>/.exec(design.prefix)?.[1];
	const font = /<font([^>]*)>/.exec(design.prefix)?.[1] ?? "";
	const scale = (name: string) =>
		parseFloat(new RegExp(`${name}=([0-9.]+)`).exec(font)?.[1] ?? "1") || 1;

	// The game writes colors as AABBGGRR.
	const rgb = color
		? ([6, 4, 2].map((i) => parseInt(color.slice(i, i + 2), 16)) as [
				number,
				number,
				number,
			])
		: DEFAULT_TEXT_COLOR;
	return { color: rgb, xscale: scale("xscale"), yscale: scale("yscale") };
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (url: string) => {
	let image = imageCache.get(url);
	if (!image) {
		image = new Promise<HTMLImageElement>((resolve, reject) => {
			const element = new Image();
			element.onload = () => resolve(element);
			element.onerror = () => {
				imageCache.delete(url);
				reject(new Error(`Cannot load ${url}`));
			};
			element.src = url;
		});
		imageCache.set(url, image);
	}
	return image;
};

const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
};

/**
 * Draws a preview of the plate: the state's real background and font, with the
 * color and scale of the design. The game lays the text out with the design
 * markup; here it is centered, so spacing may differ slightly in game.
 */
export const drawPlate = async (
	canvas: HTMLCanvasElement,
	stateId: string,
	state: AtsPlateState,
	design: AtsPlateDesign,
	text: string,
	side: "front" | "rear"
) => {
	const context = canvas.getContext("2d");
	if (!context) return;

	const background =
		side === "front"
			? (design.backgroundFront ?? design.backgroundRear)
			: (design.backgroundRear ?? design.backgroundFront);
	const font = state.font;
	const [backgroundImage, ...atlases] = await Promise.all([
		background
			? loadImage(`${ASSETS_URL}/${stateId}/${background}`).catch(() => null)
			: Promise.resolve(null),
		...font.images.map((image) =>
			loadImage(`${ASSETS_URL}/${stateId}/${image.file}`)
		),
	]);

	canvas.width = PLATE_WIDTH;
	canvas.height = PLATE_HEIGHT;
	context.clearRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);
	if (backgroundImage) {
		context.drawImage(backgroundImage, 0, 0, PLATE_WIDTH, PLATE_HEIGHT);
	} else {
		context.fillStyle = "#f2f2f2";
		context.fillRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);
	}

	const glyphs = [...text]
		.map((char) => font.glyphs[char])
		.filter((glyph) => glyph !== undefined);
	if (glyphs.length === 0) return;

	const style = getTextStyle(design);
	const advanceWidth = glyphs.reduce(
		(sum, glyph) => sum + glyph[6] * font.images[glyph[7]].scaleX,
		0
	);
	let scaleX = style.xscale * MARKUP_UNIT;
	const scaleY = style.yscale * MARKUP_UNIT;
	scaleX = Math.min(scaleX, MAX_TEXT_WIDTH / advanceWidth);

	const textHeight = font.vertSpan * scaleY;
	let penX = (PLATE_WIDTH - advanceWidth * scaleX) / 2;
	const top = (PLATE_HEIGHT - textHeight) / 2;

	// The atlas holds signed distance fields: draw them scaled, then turn the
	// distance into coverage so the glyph edges stay sharp at any size.
	const layer = document.createElement("canvas");
	layer.width = PLATE_WIDTH;
	layer.height = PLATE_HEIGHT;
	const layerContext = layer.getContext("2d", { willReadFrequently: true });
	if (!layerContext) return;
	layerContext.fillStyle = "#000";
	layerContext.fillRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);
	layerContext.globalCompositeOperation = "lighten";

	for (const glyph of glyphs) {
		const [atlasX, atlasY, width, height, planeX, planeY, advance, index] =
			glyph;
		const image = font.images[index];
		if (width > 0 && height > 0) {
			layerContext.drawImage(
				atlases[index],
				atlasX,
				atlasY,
				width,
				height,
				penX + planeX * image.scaleX * scaleX,
				top + planeY * image.scaleY * scaleY,
				width * image.scaleX * scaleX,
				height * image.scaleY * scaleY
			);
		}
		penX += advance * image.scaleX * scaleX;
	}

	const pixels = layerContext.getImageData(0, 0, PLATE_WIDTH, PLATE_HEIGHT);
	const [r, g, b] = style.color;
	const softness = 0.06 / Math.max(1, scaleY);
	const data = pixels.data;
	for (let i = 0; i < data.length; i += 4) {
		// Grayscale SDF atlases have equal channels; MSDF ones store the
		// distance as the median of the three.
		const distance =
			Math.max(
				Math.min(data[i], data[i + 1]),
				Math.min(Math.max(data[i], data[i + 1]), data[i + 2])
			) / 255;
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
		data[i + 3] = 255 * smoothstep(0.5 - softness, 0.5 + softness, distance);
	}
	layerContext.putImageData(pixels, 0, 0);
	context.drawImage(layer, 0, 0);
};
