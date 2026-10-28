# Resize the generated originals for small cards; preserve their alpha channel.
param([string]$Name = '*.png')
Add-Type -AssemblyName System.Drawing
$artProjectRoot = Split-Path -Parent $PSScriptRoot
$artInput = Join-Path $artProjectRoot 'artwork/originals'
$artOutput = Join-Path $artProjectRoot 'public/card-art'
New-Item -ItemType Directory -Path $artOutput -Force | Out-Null
foreach ($artFile in Get-ChildItem -LiteralPath $artInput -Filter $Name) {
  $artSource = [System.Drawing.Image]::FromFile($artFile.FullName)
  $artBitmap = [System.Drawing.Bitmap]::new(384, 384, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $artGraphics = [System.Drawing.Graphics]::FromImage($artBitmap)
  try {
    $artGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $artGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $artGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $artGraphics.Clear([System.Drawing.Color]::Transparent)
    $artGraphics.DrawImage($artSource, 0, 0, 384, 384)
    $artBitmap.Save((Join-Path $artOutput $artFile.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $artGraphics.Dispose(); $artBitmap.Dispose(); $artSource.Dispose() }
}
