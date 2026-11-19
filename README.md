# INCOG Mechanics

An offline 2D physics simulator for mechanics problems. Draw blocks, balls, ramps, ropes, springs and forces, press Play, and read the live values.

## One workspace, several topics

There is one big drawing area. The topic buttons in the title bar (Sandbox, Projectile, Forces and friction, Collisions, Statics, Energy) change the environment and add that topic's own tools in the ribbon. Your drawing stays.

- **Projectile**: open sky, ground at y = 0. Launch ball / block: click the start, click the aim (arrow length = speed, 1 m = 1 m/s). Drag the arrow tip later to change it. Target and Platform.
- **Forces and friction**: Block on slope, Pushed block.
- **Collisions**: air track (gravity 0, no friction). Carts, sticky carts and pucks, moving or at rest.
- **Statics**: Hanging weight, Beam on supports, plus ropes, rods, supports and forces.
- **Energy**: Pendulum, Spring and mass.

The **Answers** panel (top right) is worked out from what you drew, not typed in: range, tensions, accelerations, reactions, periods and so on, with "now" rows that move live while it plays. The predicted flight path is drawn dashed on the canvas before you press Play.

## Run it while developing

```
npm install
npm run electron:dev     # desktop window with live reload
npm run dev              # plain browser (file Save/Open need the desktop app)
```

## Test the built app on your computer

```
npm start                # builds, then opens the desktop app from dist/
npm run dist             # makes the Windows installer in the release/ folder
```

## Saving

- **Autosave:** every open tab is saved automatically and comes back when you reopen the app.
- **Save / Save as / Open** (Ctrl+S, Ctrl+Shift+S, Ctrl+O): one project to a `.incogmech` file you choose.

## Publishing a new version (installer + automatic updates)

1. Put your GitHub username in `package.json` under `build.publish.owner`.
2. Change `version` in `package.json` (for example `1.0.1`), then commit and push.
3. Tag and push the tag:
   ```
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. GitHub builds the installer (Actions tab, about 5 minutes) and creates a **draft** release.
5. Open the repo's **Releases** page, check the draft, and click **Publish release**.

People who installed the app get the new version the next time they open it. The release must be on a **public** repository for the updater to find it without a token.
