param(
    [string]$OutFile,
    [string]$Title,
    [string]$Subtitle = "LEMBANG ONLINE STORE"
)
# Membuat gambar placeholder JPG sederhana (latar putih + teks)
Add-Type -AssemblyName System.Drawing
$size = 600
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "AntiAlias"
$g.TextRenderingHint = "AntiAlias"
$g.Clear([System.Drawing.Color]::White)

$borderColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$pen = New-Object System.Drawing.Pen($borderColor, 4)
$pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawRectangle($pen, 8, 8, $size - 16, $size - 16)

$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

$rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$fontJudul = New-Object System.Drawing.Font("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font("Segoe UI", 24)

$g.DrawString($Title, $fontJudul, [System.Drawing.Brushes]::DimGray, $rect, $format)

$rectSub = New-Object System.Drawing.RectangleF(0, 380, $size, 160)
$g.DrawString($Subtitle, $fontSub, [System.Drawing.Brushes]::Gray, $rectSub, $format)

$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$bmp.Dispose()
Write-Output "dibuat: $OutFile"
