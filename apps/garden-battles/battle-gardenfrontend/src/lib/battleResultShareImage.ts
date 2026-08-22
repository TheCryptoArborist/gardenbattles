interface BattleResultShareImageInput {
  title: string;
  score: string;
  message: string;
  battleUrl: string;
  won: boolean;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = candidate;
    }
  }

  if (line) context.fillText(line, x, currentY);
  return currentY;
}

export async function createBattleResultShareImage({
  title,
  score,
  message,
  battleUrl,
  won,
}: BattleResultShareImageInput): Promise<File | null> {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const accent = won ? "#39ff88" : "#ffb347";
  const background = context.createLinearGradient(0, 0, 1080, 1080);
  background.addColorStop(0, "#003f31");
  background.addColorStop(0.55, "#001b1c");
  background.addColorStop(1, "#020914");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1080);

  const glow = context.createRadialGradient(260, 180, 20, 260, 180, 580);
  glow.addColorStop(0, won ? "rgba(57,255,136,0.28)" : "rgba(255,179,71,0.22)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1080, 1080);

  context.strokeStyle = accent;
  context.lineWidth = 6;
  context.strokeRect(42, 42, 996, 996);
  context.strokeStyle = "rgba(0,213,199,0.5)";
  context.lineWidth = 2;
  context.strokeRect(62, 62, 956, 956);

  context.fillStyle = accent;
  context.font = "900 34px Orbitron, Arial, sans-serif";
  context.fillText("THE GARDEN BATTLES", 90, 135);

  context.fillStyle = "#ffffff";
  context.font = "900 92px Orbitron, Arial, sans-serif";
  context.fillText(title.toUpperCase(), 90, 270);

  context.fillStyle = "#f5c542";
  context.font = "800 48px Orbitron, Arial, sans-serif";
  context.fillText(score, 90, 365);

  context.fillStyle = "rgba(0,0,0,0.3)";
  context.fillRect(90, 430, 900, 350);
  context.strokeStyle = "rgba(57,255,136,0.35)";
  context.strokeRect(90, 430, 900, 350);

  context.fillStyle = accent;
  context.font = "900 25px Orbitron, Arial, sans-serif";
  context.fillText("BATTLE MESSAGE", 135, 495);

  context.fillStyle = "#ecfff7";
  context.font = "600 40px Arial, sans-serif";
  drawWrappedText(context, message, 135, 575, 810, 58);

  context.fillStyle = "#9efcc2";
  context.font = "700 31px Orbitron, Arial, sans-serif";
  context.fillText("ENTER THE ARENA", 90, 895);
  context.fillStyle = "#ffffff";
  context.font = "600 35px Arial, sans-serif";
  context.fillText(battleUrl, 90, 955);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png", 0.94);
  });
  if (!blob) return null;

  return new File([blob], "garden-battles-result.png", {
    type: "image/png",
  });
}
