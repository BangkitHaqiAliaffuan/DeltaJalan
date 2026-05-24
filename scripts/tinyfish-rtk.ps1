param(
    [Parameter(ValueFromPipeline = $true)]
    [string]$InputText,

    [Parameter(Position = 0)]
    [string]$Path,

    [ValidateSet("minimal", "aggressive")]
    [string]$Level = "aggressive",

    [int]$MaxLines = 100,
    [int]$MaxLineLength = 500,
    [switch]$StripHtml,
    [switch]$NoEmoji,
    [switch]$PassThru
)

begin {
    $lines = @()
}

process {
    if ($InputText) { $lines += $InputText -split "`n" }
}

end {
    if ($Path -and (Test-Path $Path)) {
        $lines = Get-Content -LiteralPath $Path
    }

    if ($lines.Count -eq 0 -and $MyInvocation.ExpectingInput -eq $false) {
        $lines = @($input | Out-String) -split "`n"
    }

    if ($lines.Count -eq 0) { return }

    if ($StripHtml) {
        $cleaned = @()
        foreach ($line in $lines) {
            $text = $line -replace '<[^>]+>', ' '
            $text = $text -replace '&[a-z]+;', ' '
            $text = $text -replace '\s+', ' '
            $text = $text.Trim()
            if ($text) { $cleaned += $text }
        }
        $lines = $cleaned
    }

    if ($Level -eq "aggressive") {
        $lines = $lines | Where-Object {
            $_ -notmatch '^\s*(cookie|privacy|terms of service|sign up|subscribe|newsletter|advertisement|sponsored|promoted)'
        } | Where-Object {
            $_ -notmatch '^\s*[-=*]{3,}\s*$'
        } | Where-Object {
            $_ -notmatch '^\s*$'
        }
    }

    $lines = $lines | Select-Object -Unique

    if ($NoEmoji) {
        $lines = $lines -replace '[^\x20-\x7E\x0A\x0D\t\x80-\uFFFF]', ''
    }

    $lines = $lines | ForEach-Object {
        $_
    } | Select-Object -First $MaxLines

    $result = $lines -join "`n"

    if ($PassThru) {
        $result
    } else {
        $stats = @(
            "--- tinyfish-rtk: $($lines.Count) lines, $(($result -split "`n" | Measure-Object -Property Length -Sum).Sum) chars ---"
            $result
        ) -join "`n"
        $stats
    }
}
