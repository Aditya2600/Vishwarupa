# Remotion Loan Reminder Asset Pack

Generated original SVG/PNG assets for recreating the uploaded portrait loan-warning video style in Remotion.

## Folders

- `public/assets/*.svg` — vector assets, best for Remotion
- `public/assets/*.png` — transparent PNG exports
- `public/assets/icons/*` — small circular icons for bullet scenes

## Important

- `logo-placeholder.svg` is a placeholder. Replace it with the official lender logo only if you have permission to use that brand asset.
- The people/phone/gavel/piggy-bank images here are original simplified vector illustrations, not scraped assets.
- Keep all customer-specific data as React text, not baked into images.

## Remotion usage

```tsx
import {Img, staticFile} from 'remotion';

<Img src={staticFile('assets/background-pattern.svg')} />
<Img src={staticFile('assets/logo-placeholder.svg')} />
<Img src={staticFile('assets/phone-frame.svg')} />
<Img src={staticFile('assets/hand-phone-npa.svg')} />
```

## Suggested mapping

- Intro/outro: `logo-placeholder.svg`, `background-pattern.svg`
- Loan details: `phone-frame.svg`, `green-shape.svg`
- NPA warning: `hand-phone-npa.svg`, `npa-screen.svg`
- Credit impact: `man-phone.svg`, `icons/*.svg`
- Legal warning: `gavel-law.svg`
- Last chance: `last-chance-man.svg`
- CTA scene: `phone-tilted.svg`, `advisor-pointing.svg`
- Financial burden: `financial-burden.svg`
