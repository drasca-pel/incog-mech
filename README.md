# INCOG Mechanics

Build a mechanics problem on a canvas, press Play, and read the answers with the working.
Topics: Sandbox, Projectile, Forces and friction, Collisions, Statics, Energy.
Works on a phone (portrait and landscape), on a tablet, on a computer, and offline.

## Run it on your computer

    npm install
    npm run electron:dev     # desktop window with live reload
    npm run dev              # in the browser (try it with the phone layout too)
    npm start                # build, then open the built desktop app
    npm test                 # checks the calculators and the saved-projects library

## The phone app (install it from a web address)

The app is also a website that can be installed like an app (a PWA).

One-time setup, so GitHub hosts it for you:
1. Push this project to GitHub (the `main` branch).
2. In the repository open **Settings > Pages**, and under "Build and deployment" set **Source: GitHub Actions**.
3. Open the **Actions** tab. The "Publish web app" workflow runs by itself on every push. When it finishes, your address is
   `https://<your-github-name>.github.io/incog-mech/`

On the phone:
- **Android (Chrome):** open the address, then Menu (three dots) > **Install app**, or use **Install the app** inside INCOG's own menu.
- **iPhone / iPad (Safari):** open the address, tap **Share**, then **Add to Home Screen**.

After the first visit it opens with no internet. The icon is a pendulum on a ceiling mount.

To try the phone layout on your own computer: press F12 in the browser, turn on the phone/tablet toggle, and reload.

## Screens

The app picks the layout by itself: the phone layout on a phone, the desktop layout on a computer.
**Menu > View, gravity and screen layout** lets you force Phone or Desktop. Both rotate to portrait or landscape.

Phone: top bar (menu, project name, undo, redo, reset, play), the drawing full screen, a tool strip and bottom buttons
(Tools, Properties, Answers, Topic, View). Pinch to zoom, drag the empty background to move around, tap an object to edit or delete it.

## Saving

- Everything autosaves and comes back when you reopen the app.
- **Menu > My projects** keeps named projects on the device, like the project list of a circuit simulator.
  A saved project holds the drawing of EVERY topic, so friction, collisions and the rest come back together.
  You can open, rename, copy, share (as a `.incog` file) and delete them, and import a shared file.
- Desktop app only: Ctrl+S / Ctrl+O also save and open `.incog` files.

## Publishing a desktop installer (Windows)

    npm run dist             # builds the installer into the release folder

or use the "Release" workflow on GitHub (Actions > Release) to publish it with automatic updates.
