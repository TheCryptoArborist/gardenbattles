param(
  [string]$SourceDirectory = "D:\Finance\Crypto\Repos\gardenbattles\design-assets\battle-trees\user-supplied-masters",
  [string]$OutputDirectory = "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles\battle-gardenfrontend\public\assets\battle-trees"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("BattleArtProcessor" -as [type])) {
  $platformAssemblies = ([AppContext]::GetData("TRUSTED_PLATFORM_ASSEMBLIES") -split [IO.Path]::PathSeparator)
  $drawingAssemblies = @($platformAssemblies) + @(
    [object].Assembly.Location
    [AppDomain]::CurrentDomain.GetAssemblies() |
      Where-Object { $_.GetName().Name -like "System.Drawing*" -or $_.GetName().Name -like "System.Private.Windows*" } |
      Select-Object -ExpandProperty Location
  ) | Select-Object -Unique
  Add-Type -ReferencedAssemblies $drawingAssemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BattleArtProcessor
{
    public static void Extract(string sourcePath, string outputPath, Rectangle region, int tolerance)
    {
        using (var source = new Bitmap(sourcePath))
        using (var cropped = new Bitmap(region.Width, region.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(cropped))
            {
                graphics.Clear(Color.Transparent);
                graphics.DrawImage(source, new Rectangle(0, 0, region.Width, region.Height), region, GraphicsUnit.Pixel);
            }

            RemoveConnectedBackground(cropped, tolerance);
            var bounds = FindVisibleBounds(cropped);
            if (bounds.IsEmpty) throw new InvalidOperationException("No visible artwork found in " + sourcePath);

            const int canvasSize = 768;
            const int padding = 44;
            var scale = Math.Min((canvasSize - padding * 2.0) / bounds.Width, (canvasSize - padding * 2.0) / bounds.Height);
            var drawWidth = Math.Max(1, (int)Math.Round(bounds.Width * scale));
            var drawHeight = Math.Max(1, (int)Math.Round(bounds.Height * scale));
            var left = (canvasSize - drawWidth) / 2;
            var top = (canvasSize - drawHeight) / 2;

            using (var output = new Bitmap(canvasSize, canvasSize, PixelFormat.Format32bppArgb))
            using (var graphics = Graphics.FromImage(output))
            {
                graphics.Clear(Color.Transparent);
                graphics.CompositingMode = CompositingMode.SourceCopy;
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                graphics.DrawImage(cropped, new Rectangle(left, top, drawWidth, drawHeight), bounds, GraphicsUnit.Pixel);
                output.Save(outputPath, ImageFormat.Png);
            }
        }
    }

    private static void RemoveConnectedBackground(Bitmap bitmap, int tolerance)
    {
        var rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        var data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        try
        {
            var bytes = new byte[Math.Abs(data.Stride) * bitmap.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
            var visited = new bool[bitmap.Width * bitmap.Height];
            var queue = new int[bitmap.Width * bitmap.Height];
            var queueHead = 0;
            var queueTail = 0;
            var cornerOffsets = new[] { 0, (bitmap.Width - 1) * 4, (bitmap.Height - 1) * data.Stride, (bitmap.Height - 1) * data.Stride + (bitmap.Width - 1) * 4 };
            var bgB = 0; var bgG = 0; var bgR = 0;
            foreach (var offset in cornerOffsets) { bgB += bytes[offset]; bgG += bytes[offset + 1]; bgR += bytes[offset + 2]; }
            bgB /= 4; bgG /= 4; bgR /= 4;
            var toleranceSquared = tolerance * tolerance;

            Action<int, int> enqueue = (x, y) => {
                if (x < 0 || y < 0 || x >= bitmap.Width || y >= bitmap.Height) return;
                var index = y * bitmap.Width + x;
                if (visited[index]) return;
                var offset = y * data.Stride + x * 4;
                var db = bytes[offset] - bgB;
                var dg = bytes[offset + 1] - bgG;
                var dr = bytes[offset + 2] - bgR;
                if (db * db + dg * dg + dr * dr > toleranceSquared) return;
                visited[index] = true;
                queue[queueTail++] = index;
            };

            for (var x = 0; x < bitmap.Width; x++) { enqueue(x, 0); enqueue(x, bitmap.Height - 1); }
            for (var y = 0; y < bitmap.Height; y++) { enqueue(0, y); enqueue(bitmap.Width - 1, y); }

            while (queueHead < queueTail)
            {
                var index = queue[queueHead++];
                var x = index % bitmap.Width;
                var y = index / bitmap.Width;
                var offset = y * data.Stride + x * 4;
                bytes[offset + 3] = 0;
                enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1);
            }

            Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    private static Rectangle FindVisibleBounds(Bitmap bitmap)
    {
        var rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        var data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            var bytes = new byte[Math.Abs(data.Stride) * bitmap.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
            var minX = bitmap.Width; var minY = bitmap.Height; var maxX = -1; var maxY = -1;
            for (var y = 0; y < bitmap.Height; y++)
            for (var x = 0; x < bitmap.Width; x++)
            {
                if (bytes[y * data.Stride + x * 4 + 3] <= 8) continue;
                minX = Math.Min(minX, x); minY = Math.Min(minY, y);
                maxX = Math.Max(maxX, x); maxY = Math.Max(maxY, y);
            }
            return maxX < minX ? Rectangle.Empty : Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }
}
'@
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$playerStages = @(
  @{ Source = "player-stage-1-master.jpg"; Name = "player-stage-1.png" },
  @{ Source = "player-stage-2-master.jpg"; Name = "player-stage-2.png" },
  @{ Source = "player-stage-3-master.jpg"; Name = "player-stage-3.png" },
  @{ Source = "player-stage-4-master.jpg"; Name = "player-stage-4.png" }
)

foreach ($stage in $playerStages) {
  $source = Join-Path $SourceDirectory $stage.Source
  $image = [System.Drawing.Image]::FromFile($source)
  try {
    $region = [System.Drawing.Rectangle]::new(0, 0, $image.Width, $image.Height)
  } finally {
    $image.Dispose()
  }
  [BattleArtProcessor]::Extract($source, (Join-Path $OutputDirectory $stage.Name), $region, 42)
}

$botStages = @(
  @{ Source = "garden-bot-stage-1-master.jpg"; Name = "garden-bot-stage-1.png" },
  @{ Source = "garden-bot-stage-2-master.jpg"; Name = "garden-bot-stage-2.png" },
  @{ Source = "garden-bot-stage-3-master.jpg"; Name = "garden-bot-stage-3.png" },
  @{ Source = "garden-bot-stage-4-master.jpg"; Name = "garden-bot-stage-4.png" }
)

foreach ($stage in $botStages) {
  $source = Join-Path $SourceDirectory $stage.Source
  $image = [System.Drawing.Image]::FromFile($source)
  try {
    $region = [System.Drawing.Rectangle]::new(0, 0, $image.Width, $image.Height)
  } finally {
    $image.Dispose()
  }
  [BattleArtProcessor]::Extract($source, (Join-Path $OutputDirectory $stage.Name), $region, 52)
}

Get-ChildItem -LiteralPath $OutputDirectory -Filter "*.png" | Sort-Object Name | Select-Object Name, Length
