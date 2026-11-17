# The 3D agent's pictures

`assets/agent3d/*.png` (the layers `src/agent/sprites.ts` stacks) and the app icons are renders of `model.html`, a
three.js scene of the engine's agent built from rounded solids.

To render them again:

1. `npm i three@0.170 playwright` here (the scene imports three from `./node_modules`), and `pip install playwright`
   with a Chromium (`playwright install chromium`).
2. `python3 shoot.py "model.html?view=sprite&only=body&color=sky@512@512@body-sky.png"` and likewise for each layer:
   `only=body&color=<sky|indigo|violet|rose|amber|green|teal|graphite>`, `only=eyes&eyes=<kind>`,
   `only=acc&wears=<name>`. Every layer is shot from the same place, so they stack.
3. The white mark and the icons: `model.html?view=icon&color=snow` at 1024, then
   `python3 icons.py ../../assets/app-icons <that render> ../../assets/images/notification-icon.png`.

If the body's place in the pictures changes, update `BODY_BOX` in `src/agent/sprites.ts` (the alpha box of a body
layer, as fractions of the square).
