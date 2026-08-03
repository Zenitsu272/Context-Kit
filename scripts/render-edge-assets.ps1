$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $repoRoot "public\icons\icon-128.png"
$outputDir = Join-Path $repoRoot "release\edge-assets"

function New-Bitmap([int]$width, [int]$height) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $bitmap.SetResolution(96, 96)
  return $bitmap
}

function Save-ResizedPng([string]$sourcePath, [string]$destinationPath, [int]$width, [int]$height) {
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $bitmap = New-Bitmap $width $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($source, 0, 0, $width, $height)
      $bitmap.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function New-BrandTile([int]$width, [int]$height, [string]$destinationPath) {
  $bitmap = New-Bitmap $width $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $icon = [System.Drawing.Image]::FromFile($iconPath)

  $backgroundStart = [System.Drawing.ColorTranslator]::FromHtml("#FFF8EE")
  $backgroundEnd = [System.Drawing.ColorTranslator]::FromHtml("#F4D27D")
  $titleColor = [System.Drawing.ColorTranslator]::FromHtml("#1E1E1E")
  $subtitleColor = [System.Drawing.ColorTranslator]::FromHtml("#5A5548")
  $accentColor = [System.Drawing.ColorTranslator]::FromHtml("#CC8B15")

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    $rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $backgroundStart, $backgroundEnd, 0.0
    $accentBrush = New-Object System.Drawing.SolidBrush $accentColor
    $titleBrush = New-Object System.Drawing.SolidBrush $titleColor
    $subtitleBrush = New-Object System.Drawing.SolidBrush $subtitleColor

    try {
      $graphics.FillRectangle($backgroundBrush, $rect)
      $graphics.FillRectangle($accentBrush, [System.Drawing.Rectangle]::new(0, 0, [Math]::Max([int]($width * 0.025), 10), $height))

      $iconSize = if ($width -le 500) { 92 } else { 180 }
      $iconX = if ($width -le 500) { 28 } else { 84 }
      $iconY = [Math]::Max([int](($height - $iconSize) / 2), 24)
      $graphics.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)

      if ($width -le 500) {
        $titleFont = New-Object System.Drawing.Font "Segoe UI Semibold", 30, ([System.Drawing.FontStyle]::Bold)
        $subtitleFont = New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Regular)
        $titlePoint = New-Object System.Drawing.PointF 144, 72
        $subtitleRect = New-Object System.Drawing.RectangleF 144, 124, 260, 74
      } else {
        $titleFont = New-Object System.Drawing.Font "Segoe UI Semibold", 66, ([System.Drawing.FontStyle]::Bold)
        $subtitleFont = New-Object System.Drawing.Font "Segoe UI", 24, ([System.Drawing.FontStyle]::Regular)
        $titlePoint = New-Object System.Drawing.PointF 320, 150
        $subtitleRect = New-Object System.Drawing.RectangleF 324, 252, 840, 128
      }

      try {
        $graphics.DrawString("Context Kit", $titleFont, $titleBrush, $titlePoint)
        $graphics.DrawString(
          "Save AI conversations as reusable context packages for faster project handoffs.",
          $subtitleFont,
          $subtitleBrush,
          $subtitleRect
        )
      } finally {
        $titleFont.Dispose()
        $subtitleFont.Dispose()
      }
    } finally {
      $backgroundBrush.Dispose()
      $accentBrush.Dispose()
      $titleBrush.Dispose()
      $subtitleBrush.Dispose()
    }

    $bitmap.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $icon.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

Save-ResizedPng -sourcePath $iconPath -destinationPath (Join-Path $outputDir "edge-logo-300.png") -width 300 -height 300
New-BrandTile -width 440 -height 280 -destinationPath (Join-Path $outputDir "edge-small-promotional-tile-440x280.png")
New-BrandTile -width 1400 -height 560 -destinationPath (Join-Path $outputDir "edge-large-promotional-tile-1400x560.png")

Write-Host "Generated Edge Add-ons promotional assets in $outputDir"
