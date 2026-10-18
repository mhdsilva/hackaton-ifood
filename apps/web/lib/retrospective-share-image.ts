import type { PartyRetrospectiveSummary } from "@sidequest/contracts";
import { retrospectiveThemeLabel } from "@/lib/mock-retrospective";

const WIDTH = 1080;
const HEIGHT = 1920;
const DISPLAY_FONT = '"Fira Sans Condensed"';
const BODY_FONT = '"DM Sans Variable"';

function roundedCard(x: number, y: number, width: number, height: number) {
  const path = new Path2D();
  path.moveTo(x + 112, y);
  path.lineTo(x + width - 24, y);
  path.quadraticCurveTo(x + width, y, x + width, y + 24);
  path.lineTo(x + width, y + height - 112);
  path.quadraticCurveTo(x + width, y + height, x + width - 112, y + height);
  path.lineTo(x + 24, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - 24);
  path.lineTo(x, y + 112);
  path.quadraticCurveTo(x, y, x + 112, y);
  path.closePath();
  return path;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, family: string, weight = 700, minimum = 24) {
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && fontSize > minimum) {
    ctx.font = `${weight} ${--fontSize}px ${family}`;
  }
  let visible = text;
  if (ctx.measureText(visible).width > maxWidth) {
    const letters = Array.from(text);
    while (letters.length && ctx.measureText(`${letters.join("")}…`).width > maxWidth) letters.pop();
    visible = `${letters.join("")}…`;
  }
  ctx.fillText(visible, x, y);
  return ctx.measureText(visible).width;
}

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const logo = new Image();
    logo.onload = () => resolve(logo);
    logo.onerror = () => reject(new Error("Não foi possível carregar a marca."));
    logo.src = "/figma/logo.svg";
  });
}

/** Arte própria em PNG; usa valores finais do contrato, sem capturar DOM ou animações. */
export async function createRetrospectiveShareImage(summary: PartyRetrospectiveSummary, simulated = true): Promise<File> {
  const [logo] = await Promise.all([
    loadLogo(),
    document.fonts.load(`700 108px ${DISPLAY_FONT}`),
    document.fonts.load(`600 240px ${DISPLAY_FONT}`),
    document.fonts.load(`400 36px ${BODY_FONT}`),
    document.fonts.load(`700 32px ${BODY_FONT}`),
    document.fonts.load(`italic 900 74px ${BODY_FONT}`),
  ]);
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  const theme = getComputedStyle(document.documentElement);
  const color = (token: string, fallback: string) => theme.getPropertyValue(token).trim() || fallback;
  const background = color("--background", "#1c1c1c");
  const foreground = color("--foreground", "#ffffff");
  const primary = color("--primary", "#ea1d2c");
  const muted = color("--muted-foreground", "#8d8d8d");
  const border = color("--border", "#333333");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.translate(1080, 360);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(logo, -1100, -300, 1660, 920);
  ctx.restore();

  ctx.drawImage(logo, 64, 72, 164, 91);
  ctx.fillStyle = foreground;
  ctx.font = `italic 900 74px ${BODY_FONT}`;
  ctx.fillText("Party", 240, 143);
  ctx.fillStyle = muted;
  ctx.textAlign = "right";
  fitText(ctx, "NOSSA RETROSPECTIVA", 1016, 119, 430, 24, BODY_FONT);
  ctx.textAlign = "left";

  ctx.fillStyle = primary;
  fitText(ctx, "CADA ENCONTRO CONTA", 64, 244, 952, 26, BODY_FONT);
  ctx.fillStyle = foreground;
  fitText(ctx, "Cada um num canto.", 64, 361, 952, 108, DISPLAY_FONT, 700, 72);
  ctx.fillStyle = primary;
  fitText(ctx, "Todo mundo junto.", 64, 472, 952, 108, DISPLAY_FONT, 700, 72);
  ctx.fillStyle = foreground;
  fitText(ctx, summary.partyName, 64, 539, 952, 34, BODY_FONT, 400);

  const card = roundedCard(64, 592, 952, 712);
  ctx.fillStyle = primary;
  ctx.fill(card);
  ctx.save();
  ctx.clip(card);
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = foreground;
  ctx.font = `700 500px ${DISPLAY_FONT}`;
  ctx.fillText("&", 750, 1040);
  ctx.restore();

  ctx.fillStyle = foreground;
  ctx.textAlign = "right";
  fitText(ctx, retrospectiveThemeLabel(summary.theme), 968, 655, 510, 30, BODY_FONT);
  ctx.textAlign = "left";

  if (summary.maxDistanceKm !== undefined) {
    fitText(ctx, "LONGE SÓ", 112, 655, 260, 26, BODY_FONT);
    fitText(ctx, "NO MAPA", 112, 691, 260, 26, BODY_FONT);
    const value = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(summary.maxDistanceKm);
    const width = fitText(ctx, value, 112, 970, 686, 240, DISPLAY_FONT, 600, 100);
    ctx.font = `600 80px ${DISPLAY_FONT}`;
    ctx.fillText("km", 112 + width + 18, 970);
    fitText(ctx, "entre os pontos mais distantes.", 112, 1038, 856, 36, BODY_FONT, 400);
    fitText(ctx, "Uma mesma vibe no caminho.", 112, 1088, 856, 36, BODY_FONT);
  } else {
    fitText(ctx, "MESMO TEMA, VÁRIOS CANTOS", 112, 715, 856, 26, BODY_FONT);
    fitText(ctx, "Vários lugares.", 112, 902, 856, 150, DISPLAY_FONT, 700, 92);
    fitText(ctx, "Uma mesma vibe.", 112, 1050, 856, 150, DISPLAY_FONT, 700, 92);
  }

  ctx.save();
  ctx.strokeStyle = foreground;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(148, 1170);
  ctx.bezierCurveTo(360, 1090, 720, 1250, 932, 1170);
  ctx.stroke();
  ctx.restore();
  [148, 932].forEach((x, index) => {
    ctx.beginPath();
    ctx.arc(x, 1170, 22, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? background : foreground;
    ctx.fill();
  });
  ctx.fillStyle = primary;
  ctx.fillRect(335, 1135, 410, 74);
  ctx.textAlign = "center";
  ctx.fillStyle = foreground;
  fitText(ctx, `${summary.participantCount} pessoas. Uma Party.`, 540, 1183, 390, 30, BODY_FONT);
  fitText(ctx, summary.maxDistanceKm !== undefined ? "Distância aproximada em linha reta." : "O tema foi o ponto de encontro.", 540, 1264, 856, 25, BODY_FONT, 400);

  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  fitText(ctx, "O QUE CHEGOU À MESA", 64, 1390, 952, 26, BODY_FONT);
  const stats = [
    { value: summary.completedOrderCount, label: summary.completedOrderCount === 1 ? "pedido concluído" : "pedidos concluídos" },
    { value: summary.itemCount, label: summary.itemCount === 1 ? "item na mesa" : "itens na mesa" },
    { value: summary.merchantCount, label: summary.merchantCount === 1 ? "restaurante" : "restaurantes" },
  ];
  ctx.textAlign = "center";
  stats.forEach(({ value, label }, index) => {
    const x = 222 + index * 318;
    ctx.fillStyle = foreground;
    fitText(ctx, integer(value), x, 1524, 280, 108, DISPLAY_FONT, 600);
    ctx.fillStyle = muted;
    fitText(ctx, label, x, 1588, 288, 28, BODY_FONT, 400);
  });
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  [381, 699].forEach((x) => { ctx.moveTo(x, 1432); ctx.lineTo(x, 1620); });
  ctx.moveTo(64, 1674);
  ctx.lineTo(1016, 1674);
  ctx.stroke();
  ctx.fillStyle = foreground;
  fitText(ctx, "Os pedidos foram diferentes.", 540, 1754, 952, 34, BODY_FONT, 400);
  fitText(ctx, "O momento foi de vocês.", 540, 1804, 952, 34, BODY_FONT);
  ctx.fillStyle = muted;
  fitText(ctx, simulated ? "PRÉVIA · DADOS SIMULADOS" : "iFood Party · Cada um no seu canto.", 540, 1870, 952, 23, BODY_FONT);

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível exportar a imagem.")), "image/png"));
  return new File([blob], "minha-ifood-party.png", { type: "image/png" });
}

function integer(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

export function canShareRetrospectiveImage(file: File): boolean {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadRetrospectiveImage(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}
