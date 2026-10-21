Add-Type -AssemblyName System.Drawing

function Resize-Icon {
    param(
        [string]$src,
        [string]$dest,
        [int]$size,
        [bool]$maskable,
        [System.Drawing.Color]$bgColor
    )
    $sourceImg = [System.Drawing.Bitmap]::FromFile($src)
    $destBmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bgColor.A -gt 0) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $g.FillRectangle($brush, 0, 0, $size, $size)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    if ($maskable) {
        $innerSize = [int]($size * 0.78)
        $offset = [int](($size - $innerSize) / 2)
        $g.DrawImage($sourceImg, $offset, $offset, $innerSize, $innerSize)
    } else {
        $g.DrawImage($sourceImg, 0, 0, $size, $size)
    }

    $destBmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $destBmp.Dispose()
    $sourceImg.Dispose()
}

$src = "public/logo-icon.png"
$darkBg = [System.Drawing.ColorTranslator]::FromHtml("#191511")
$trans = [System.Drawing.Color]::Transparent

Resize-Icon -src $src -dest "public/icons/icon-192.png" -size 192 -maskable $false -bgColor $trans
Resize-Icon -src $src -dest "public/icons/icon-512.png" -size 512 -maskable $false -bgColor $trans
Resize-Icon -src $src -dest "public/icons/icon-maskable-192.png" -size 192 -maskable $true -bgColor $darkBg
Resize-Icon -src $src -dest "public/icons/icon-maskable-512.png" -size 512 -maskable $true -bgColor $darkBg
Resize-Icon -src $src -dest "public/icons/apple-touch-icon.png" -size 180 -maskable $true -bgColor $darkBg
Resize-Icon -src $src -dest "public/apple-touch-icon.png" -size 180 -maskable $true -bgColor $darkBg

Write-Output "Icons generated successfully"
