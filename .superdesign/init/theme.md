# Theme token summary

- Font: Inter/system sans-serif.
- Background: `#f4fbfc`; surface: `#ffffff`.
- Primary: `#087e8b`; primary dark: `#05626c`.
- Text: `#17343a`; muted: `#607b80`; line: `#cfe3e6`.
- Danger: `#b42318`; success: `#067647`.
- Radius: `.6rem` controls, `.7rem` buttons, `.8rem` cards, `1rem` panels, `1.25rem` auth card.
- Breakpoint: desktop layout at `800px`; compact adjustments at `600px`.
- Touch target: buttons minimum `44px`.

## Raw source

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #17343a;
  background: #f4fbfc;
  --primary: #087e8b;
  --primary-dark: #05626c;
  --surface: #ffffff;
  --line: #cfe3e6;
  --muted: #607b80;
  --danger: #b42318;
  --success: #067647;
}
```

Full styles are in `frontend/src/styles.css`.
