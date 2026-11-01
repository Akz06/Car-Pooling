# Drop-in 3D car models

Every car in `shared/catalog.ts` is built in 3D from its real dimensions, paint and seat layout.
To show a real 3D model instead, put a binary glTF file here named after the catalog id:

```
client/public/models/cars/<model-id>.glb      e.g. hyundai-creta.glb, mahindra-xuv700.glb
```

The app loads it automatically, turns it so its length runs nose-to-tail, scales it to the
model's real length, and puts it on the floor. Seat badges stay on top, so riders can still
pick seats (the "Seat map" tab always works too).

Tips
- Keep files small for phones (≈5–15 MB). Compress with `npx @gltf-transform/cli optimize in.glb out.glb --compress draco` only if you also add a Draco decoder; otherwise use `--compress meshopt` off and `--texture-compress webp`.
- If the car faces backwards, rotate it 180° in Blender (or any glTF editor) before exporting.
- Model ids: maruti-swift, hyundai-creta, honda-city, tata-nexon, mahindra-xuv700, toyota-innova-crysta,
  maruti-ertiga, kia-carens, toyota-fortuner, tesla-model-y, hyundai-verna, tata-punch, mahindra-thar,
  mahindra-scorpio-n, maruti-brezza, maruti-baleno, maruti-dzire, hyundai-venue, hyundai-i20, kia-seltos,
  kia-sonet, toyota-hyryder, mg-hector, tata-safari, tata-harrier, maruti-wagonr, honda-amaze,
  mahindra-xuv3xo, maruti-fronx, toyota-innova-hycross
