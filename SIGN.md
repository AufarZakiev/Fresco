# Code Signing

## Why

Unsigned Windows executables trigger SmartScreen warnings ("Windows protected your PC"). A code signing certificate eliminates or reduces these warnings.

## Recommended: IV (Individual Validation) Certificate

An IV certificate is verified against a government-issued ID and displays your personal name as the publisher. No legal entity (LLC, company) required.

**Provider**: Certum (~$60/year)
- https://shop.certum.eu/code-signing-certificates

SmartScreen reputation builds over time as more users run the signed executable.

## Signing in CI

After obtaining the certificate, sign the executable in GitHub Actions:

```yaml
- name: Sign executable
  if: matrix.target == 'x86_64-pc-windows-msvc' || matrix.target == 'aarch64-pc-windows-msvc'
  run: |
    echo "${{ secrets.SIGNING_CERT }}" | base64 -d > cert.pfx
    signtool sign /f cert.pfx /p "${{ secrets.SIGNING_PASSWORD }}" /tr http://timestamp.digicert.com /td sha256 /fd sha256 target/${{ matrix.target }}/release/Fresco.exe
    rm cert.pfx
```

Store the certificate as `SIGNING_CERT` (base64-encoded .pfx) and password as `SIGNING_PASSWORD` in GitHub repository secrets.

## Other Options

- **OV (Organization Validation)**: Requires a registered business entity. ~$200/year.
- **EV (Extended Validation)**: Immediate SmartScreen trust, no reputation building. ~$300-600/year. Requires business entity + hardware token or cloud HSM.
