import Icon from "../core/icons.jsx";

const Row = ({ icon, title, sub, onClick, disabled }) => (
  <button className="m-menurow" onClick={onClick} disabled={disabled}>
    <Icon name={icon} size={22} />
    <span>
      <strong>{title}</strong>
      {sub && <em>{sub}</em>}
    </span>
  </button>
);

// The main menu. Used on the phone and on the desktop.
export default function MenuDrawer({ onNew, onProjects, onSaveToLibrary, onTopics, onEnvironment, onSettings, desktopFiles, onSaveFile, onOpenFile, install, onHelp }) {
  return (
    <div className="m-menu">
      <div className="m-brand">
        <img src="./icons/icon-192.png" alt="" width="44" height="44" />
        <div>
          <strong>INCOG Mechanics</strong>
          <span>Build it, press Play, read the answers</span>
        </div>
      </div>
      <h3>Projects</h3>
      <Row icon="folder" title="My projects" sub="Open, rename, copy or share saved projects" onClick={onProjects} />
      <Row icon="save" title="Save this project" sub="Keeps every topic's drawing on this device" onClick={onSaveToLibrary} />
      <Row icon="open" title="New project" onClick={onNew} />
      {desktopFiles && (
        <>
          <Row icon="saveAs" title="Save to a file…" sub="Ctrl+S" onClick={onSaveFile} />
          <Row icon="open" title="Open a file…" sub="Ctrl+O" onClick={onOpenFile} />
        </>
      )}
      <h3>Workspace</h3>
      <Row icon="topic" title="Topic" sub="Projectile, forces, collisions, statics, energy" onClick={onTopics} />
      <Row icon="grid" title="View, gravity and screen layout" onClick={onSettings} />
      <Row icon="wall" title="Environment" sub="Room, friction and air resistance" onClick={onEnvironment} />
      <h3>App</h3>
      {install.installed ? (
        <Row icon="download" title="Installed on this device" sub="You are using the installed app" disabled />
      ) : install.canInstall ? (
        <Row icon="download" title="Install the app" sub="Adds it to your home screen. Works with no internet." onClick={install.install} />
      ) : install.ios ? (
        <Row icon="download" title="Install on iPhone or iPad" sub="Tap the Share button in Safari, then Add to Home Screen." disabled />
      ) : (
        <Row icon="download" title="Install the app" sub="Open the browser menu and choose Install app or Add to Home screen." disabled />
      )}
      <Row icon="answers" title="How to use it" onClick={onHelp} />
      <p className="m-note">Version 1.1</p>
    </div>
  );
}
